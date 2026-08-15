"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, COOKIE_MAX_AGE_S, passwordMatches, signAuthCookie } from "@/lib/auth";

export async function login(formData: FormData): Promise<void> {
  const submitted = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");
  const actual = process.env.TEAM_PASSWORD;

  if (!actual || !(await passwordMatches(submitted, actual))) {
    redirect(`/login?error=1${from !== "/" ? `&from=${encodeURIComponent(from)}` : ""}`);
  }

  const jar = await cookies();
  jar.set(AUTH_COOKIE, await signAuthCookie(actual), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_S,
    path: "/",
  });
  // Only allow same-site relative redirect targets.
  redirect(from.startsWith("/") && !from.startsWith("//") ? from : "/");
}
