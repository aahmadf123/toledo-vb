import type { MatchBoxLine } from "./schema";
import type { Parser, ParseContext, ParseResult, RawFile } from "./types";
import { parseRawPath } from "./filename";
import { matchPlayer } from "./roster";
import { resolveSessionMeta, sessionFromMeta } from "./session";

/**
 * Format D: VolleyStation box score CSV. The header row starts with
 * "Athlete Stats" and the "S Att" header appears TWICE (serve attempts at
 * index 5, set attempts at index 19), so every column is read by position —
 * never by header name. Empty cells mean zero for counts, null for rates.
 */

// Column indices, counting the athlete-name column as 0.
const COL = {
  name: 0, mp: 1, sp: 2, ace: 3, sErr: 4, sAtt: 5, sRtg: 6, sPct: 7,
  rtg3: 8, rtg2: 9, rtg1: 10, srErr: 11, srAtt: 12, srRtg: 13,
  kills: 14, aErr: 15, aAtt: 16, aPct: 17, ast: 18, setAtt: 19, setPct: 20,
  bSolo: 21, bAst: 22, bTot: 23, digs: 24, fbRcv: 25, fbSnt: 26,
  viol: 27, bhErr: 28,
} as const;

const EXPECTED_HEADERS = [
  "Athlete Stats", "MP", "SP", "Ace", "S Err", "S Att", "S Rtg", "S%",
  "Rtg 3", "Rtg 2", "Rtg 1", "SR Err", "SR Att", "SR Rtg", "Kills",
  "A Err", "A Att", "A %", "Ast", "S Att", "Set %", "B Solo", "B Ast",
  "B Tot", "Digs", "FB Rcv", "FB Snt", "Viol", "BH Err",
];

const TEAM_ROW = "University of Toledo";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(field); field = ""; }
    else field += ch;
  }
  out.push(field);
  return out;
}

function count(fields: string[], idx: number): number {
  const v = fields[idx]?.trim();
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rate(fields: string[], idx: number): number | null {
  const v = fields[idx]?.trim();
  if (!v) return null;
  const pct = v.endsWith("%");
  const n = Number(pct ? v.slice(0, -1) : v);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

export const boxScoreParser: Parser = {
  format: "box-score",

  detect(file: RawFile): boolean {
    return file.buffer.toString("utf8", 0, 500).includes("Athlete Stats");
  },

  parse(file: RawFile, ctx: ParseContext): ParseResult {
    const text = file.buffer.toString("utf8").replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const headerIdx = lines.findIndex((l) => splitCsvLine(l)[0]?.trim() === "Athlete Stats");
    if (headerIdx === -1) throw new Error('No "Athlete Stats" header row');

    const headers = splitCsvLine(lines[headerIdx]).map((h) => h.trim());
    EXPECTED_HEADERS.forEach((want, i) => {
      if ((headers[i] ?? "") !== want) {
        ctx.warn({
          code: "header-drift",
          message: `Box score column ${i}: expected "${want}", found "${headers[i] ?? ""}"`,
        });
      }
    });

    const parsed = parseRawPath(file.relPath, ctx.config);
    const meta = resolveSessionMeta(parsed, { isBoxScore: true });
    for (const w of parsed.warnings) ctx.warn(w);

    const matchBoxLines: MatchBoxLine[] = [];
    for (const line of lines.slice(headerIdx + 1)) {
      const fields = splitCsvLine(line);
      const name = fields[COL.name]?.trim();
      if (!name) continue;

      let playerId: string | null = null;
      if (name === TEAM_ROW) {
        playerId = "team";
      } else {
        const m = name.match(/^#(\d+)\s+(.+)$/);
        const player = matchPlayer(
          ctx.roster,
          { jersey: m ? Number(m[1]) : undefined, label: m ? m[2] : name },
          ctx.warn
        );
        if (!player) continue; // warned already; row is unattributable
        playerId = player.id;
      }

      matchBoxLines.push({
        sessionId: meta.id,
        playerId,
        mp: count(fields, COL.mp), sp: count(fields, COL.sp),
        ace: count(fields, COL.ace), sErr: count(fields, COL.sErr),
        sAtt: count(fields, COL.sAtt), sRtg: rate(fields, COL.sRtg),
        sPct: rate(fields, COL.sPct),
        rtg3: count(fields, COL.rtg3), rtg2: count(fields, COL.rtg2),
        rtg1: count(fields, COL.rtg1), srErr: count(fields, COL.srErr),
        srAtt: count(fields, COL.srAtt), srRtg: rate(fields, COL.srRtg),
        kills: count(fields, COL.kills), aErr: count(fields, COL.aErr),
        aAtt: count(fields, COL.aAtt), aPct: rate(fields, COL.aPct),
        ast: count(fields, COL.ast), setAtt: count(fields, COL.setAtt),
        setPct: rate(fields, COL.setPct),
        bSolo: count(fields, COL.bSolo), bAst: count(fields, COL.bAst),
        bTot: count(fields, COL.bTot), digs: count(fields, COL.digs),
        fbRcv: count(fields, COL.fbRcv), fbSnt: count(fields, COL.fbSnt),
        viol: count(fields, COL.viol), bhErr: count(fields, COL.bhErr),
        sourceFile: file.relPath,
      });
    }

    if (matchBoxLines.length === 0) throw new Error("No player rows parsed");

    return { sessions: [sessionFromMeta(meta, file.relPath)], matchBoxLines };
  },
};
