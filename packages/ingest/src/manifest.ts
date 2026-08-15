import { createHash } from "node:crypto";
import fs from "node:fs";
import { ManifestSchema, type Manifest, type ManifestFile } from "./schema";

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function emptyManifest(season: number): Manifest {
  return { season, lastSyncAt: "", files: {} };
}

export function readManifest(path: string, season: number): Manifest {
  if (!fs.existsSync(path)) return emptyManifest(season);
  try {
    return ManifestSchema.parse(JSON.parse(fs.readFileSync(path, "utf8")));
  } catch {
    // A corrupt manifest just means a full re-parse; raw files are the truth.
    return emptyManifest(season);
  }
}

export function writeManifest(path: string, manifest: Manifest): void {
  const sortedFiles = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(
    path,
    JSON.stringify({ ...manifest, files: sortedFiles }, null, 2) + "\n"
  );
}

export function needsParse(
  manifest: Manifest,
  relPath: string,
  hash: string,
  force: boolean
): boolean {
  if (force) return true;
  const entry = manifest.files[relPath];
  if (!entry) return true;
  if (entry.sha256 !== hash) return true;
  // Retry previously failed files every run: the fix may be in parser code.
  return entry.status === "error";
}

export function manifestEntry(
  partial: Omit<ManifestFile, "parsedAt">,
  parsedAt: string
): ManifestFile {
  return { ...partial, parsedAt };
}
