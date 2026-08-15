// Web Crypto only — this module runs in the Edge middleware runtime as well
// as in server actions, so node:crypto is off the table.

export const AUTH_COOKIE = "tvb_auth";
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 days

// Key is derived from TEAM_PASSWORD, so rotating the password invalidates
// every issued cookie. The salt just domain-separates the HMAC key.
const KEY_SALT = "toledo-vb-auth-v1";

async function hmacKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(`${KEY_SALT}:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signAuthCookie(password: string, now = Date.now()): Promise<string> {
  const expiresAt = now + COOKIE_MAX_AGE_S * 1000;
  const key = await hmacKey(password);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expiresAt)));
  return `${expiresAt}.${toHex(mac)}`;
}

export async function verifyAuthCookie(
  value: string | undefined,
  password: string | undefined,
  now = Date.now()
): Promise<boolean> {
  if (!value || !password) return false;
  const dot = value.indexOf(".");
  if (dot === -1) return false;
  const expiresAt = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < now) return false;
  const key = await hmacKey(password);
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expiresAt)
  );
  return timingSafeEqualHex(mac, toHex(expected));
}

/** Compare two lowercase hex MACs without early exit. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Constant-time-ish password check: compare HMACs of both strings under a
 * random per-call key so length and content never leak through timing.
 */
export async function passwordMatches(submitted: string, actual: string): Promise<boolean> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(submitted)),
    crypto.subtle.sign("HMAC", key, enc.encode(actual)),
  ]);
  return timingSafeEqualHex(toHex(a), toHex(b));
}
