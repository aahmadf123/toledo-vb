import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { detectFormat } from "./detect";
import { isIgnoredPath } from "./filename";
import { manifestEntry, needsParse, readManifest, sha256, writeManifest } from "./manifest";
import { boxScoreParser } from "./parse-box-score";
import { teamParser } from "./parse-team";
import { setterHitterParser } from "./parse-setter-hitter";
import { setTypeParser } from "./parse-set-type";
import { buildRosterIndex } from "./roster";
import {
  IngestConfigSchema,
  PlayerSchema,
  type FileFormat,
  type Manifest,
  type Warning,
} from "./schema";
import { readStores, removeSourceFiles, upsertResult, writeStores } from "./store";
import type { Parser, RawFile } from "./types";

const PARSERS: Record<string, Parser> = {
  team: teamParser,
  "setter-hitter": setterHitterParser,
  "attack-by-set-type": setTypeParser,
  "box-score": boxScoreParser,
};

export interface IngestOptions {
  rootDir: string; // repo root
  force?: boolean;
  fileFilter?: (relPath: string) => boolean;
  check?: boolean; // parse everything, write nothing
  now?: () => string; // injectable for tests
}

export interface IngestSummary {
  ok: string[];
  warned: string[];
  errored: Array<{ relPath: string; error: string }>;
  skipped: string[];
  ignored: string[];
  manifest: Manifest;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function runIngest(opts: IngestOptions): IngestSummary {
  const dataDir = path.join(opts.rootDir, "data");
  const rawDir = path.join(dataDir, "raw");
  const normalizedDir = path.join(dataDir, "normalized");
  const manifestPath = path.join(dataDir, "manifest.json");
  const now = opts.now ?? (() => new Date().toISOString());

  const config = IngestConfigSchema.parse(
    JSON.parse(fs.readFileSync(path.join(dataDir, "ingest-config.json"), "utf8"))
  );
  const roster = buildRosterIndex(
    z.array(PlayerSchema).parse(JSON.parse(fs.readFileSync(path.join(dataDir, "players.json"), "utf8")))
  );

  const manifest = readManifest(manifestPath, config.seasonYear);
  const stores = readStores(normalizedDir);

  const summary: IngestSummary = {
    ok: [],
    warned: [],
    errored: [],
    skipped: [],
    ignored: [],
    manifest,
  };

  const allPaths = fs.existsSync(rawDir)
    ? walk(rawDir)
        .map((p) => path.relative(rawDir, p).split(path.sep).join("/"))
        .sort()
    : [];

  // Files that vanished from the raw tree take their records with them.
  const present = new Set(allPaths);
  const vanished = Object.keys(manifest.files).filter((p) => !present.has(p));
  if (vanished.length > 0 && !opts.check) {
    removeSourceFiles(stores, new Set(vanished));
    for (const p of vanished) delete manifest.files[p];
  }

  for (const relPath of allPaths) {
    if (opts.fileFilter && !opts.fileFilter(relPath)) continue;

    if (isIgnoredPath(relPath)) {
      summary.ignored.push(relPath);
      if (!opts.check && path.basename(relPath) !== ".gitkeep") {
        manifest.files[relPath] = manifestEntry(
          {
            sha256: "",
            size: fs.statSync(path.join(rawDir, relPath)).size,
            format: "ignored",
            status: "ignored",
            sessionIds: [],
            warnings: [],
          },
          now()
        );
      }
      continue;
    }

    const buffer = fs.readFileSync(path.join(rawDir, relPath));
    const hash = sha256(buffer);
    if (!needsParse(manifest, relPath, hash, opts.force ?? false)) {
      summary.skipped.push(relPath);
      continue;
    }

    const file: RawFile = { relPath, buffer, sha256: hash };
    const warnings: Warning[] = [];
    const warn = (w: Warning) => warnings.push(w);
    const formatName = detectFormat(file);
    const parser = formatName ? PARSERS[formatName] : undefined;
    const format: FileFormat = formatName ?? "unknown";

    if (!parser) {
      summary.errored.push({ relPath, error: "Unrecognized file format" });
      if (!opts.check) {
        manifest.files[relPath] = manifestEntry(
          {
            sha256: hash,
            size: buffer.length,
            format,
            status: "error",
            sessionIds: [],
            warnings,
            error: "Unrecognized file format",
          },
          now()
        );
      }
      continue;
    }

    try {
      const result = parser.parse(file, { roster, config, warn });
      if (!opts.check) {
        removeSourceFiles(stores, new Set([relPath]));
        upsertResult(stores, result, warn);
        manifest.files[relPath] = manifestEntry(
          {
            sha256: hash,
            size: buffer.length,
            format,
            status: warnings.length > 0 ? "ok-with-warnings" : "ok",
            sessionIds: result.sessions.map((s) => s.id),
            warnings,
          },
          now()
        );
      }
      (warnings.length > 0 ? summary.warned : summary.ok).push(relPath);
    } catch (err) {
      const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
      summary.errored.push({ relPath, error: message });
      if (!opts.check) {
        // A failed re-parse must not leave stale rows from the old version.
        removeSourceFiles(stores, new Set([relPath]));
        manifest.files[relPath] = manifestEntry(
          {
            sha256: hash,
            size: buffer.length,
            format,
            status: "error",
            sessionIds: [],
            warnings,
            error: message,
          },
          now()
        );
      }
    }
  }

  if (!opts.check) {
    manifest.lastSyncAt = now();
    writeStores(normalizedDir, stores);
    writeManifest(manifestPath, manifest);
  }

  return summary;
}
