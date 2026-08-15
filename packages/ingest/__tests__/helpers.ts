import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { sha256 } from "@ingest/manifest";
import { buildRosterIndex } from "@ingest/roster";
import { IngestConfigSchema, PlayerSchema, type Warning } from "@ingest/schema";
import type { ParseContext, RawFile } from "@ingest/types";

const ROOT = path.resolve(__dirname, "../../..");

export const roster = buildRosterIndex(
  z
    .array(PlayerSchema)
    .parse(JSON.parse(fs.readFileSync(path.join(ROOT, "data/players.json"), "utf8")))
);

export const config = IngestConfigSchema.parse(
  JSON.parse(fs.readFileSync(path.join(ROOT, "data/ingest-config.json"), "utf8"))
);

export function fixture(fixturePath: string, relPath: string): RawFile {
  const buffer = fs.readFileSync(path.join(__dirname, "../fixtures", fixturePath));
  return { relPath, buffer, sha256: sha256(buffer) };
}

export function makeCtx(): { ctx: ParseContext; warnings: Warning[] } {
  const warnings: Warning[] = [];
  return { ctx: { roster, config, warn: (w) => warnings.push(w) }, warnings };
}

export const rawDir = path.join(ROOT, "data/raw");
