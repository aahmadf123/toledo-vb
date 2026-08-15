import type { PositionGroup, TeamStatLine, Weights } from "./schema";
import type { Parser, ParseContext, ParseResult, RawFile } from "./types";
import { parseRawPath } from "./filename";
import { matchPlayer } from "./roster";
import { resolveSessionMeta, sessionFromMeta } from "./session";
import { addr, cellNum, cellStr, getSheetLoose, readWorkbook, type Sheet } from "./xlsx-utils";

/**
 * Format A: the Team practice workbook. One sheet named "PRACTICE " (trailing
 * space). Rows 2-3 carry configurable scoring weights; row 6 the column
 * headers; rows 7-42 player rows grouped into position blocks with subtotal
 * rows; TOTALS in column B ends the data. Layout (0-based columns):
 *   A jersey · B label · C-J attacking (K,E,Blk,Att,Eff,K%,E%,B%)
 *   K-Q reception (ATT,AVG,PP,PP%,E,FBSO%,IN-SYS%) · R-V serving (Att,A,E,xPS,Made%)
 * Blank attacking cells = liberos; blank reception ATT = setters.
 * Literal "#ERROR" strings are cached div-by-zero values -> null.
 */

const GROUPS: Array<{ pattern: RegExp; group: PositionGroup }> = [
  { pattern: /OUTSIDE/i, group: "OH" },
  { pattern: /OPPOS/i, group: "OPP" }, // sheet says "OPPOSITIES" — match loosely
  { pattern: /MIDDLE/i, group: "MB" },
  { pattern: /LIBERO/i, group: "L" },
  { pattern: /SETTER/i, group: "S" },
];

const COLS = {
  jersey: 0,
  label: 1,
  atk: { k: 2, e: 3, blk: 4, att: 5, eff: 6, kPct: 7, ePct: 8, bPct: 9 },
  rec: { att: 10, avg: 11, pp: 12, ppPct: 13, err: 14, fbsoPct: 15, inSysPct: 16 },
  srv: { att: 17, aces: 18, err: 19, xps: 20, madePct: 21 },
} as const;

const EXPECTED_HEADERS: Array<[number, string]> = [
  [2, "K"], [3, "E"], [4, "Blk"], [5, "Att"], [6, "Eff"],
  [10, "ATT"], [11, "AVG"], [12, "PP"], [15, "FBSO%"], [16, "IN-SYS%"],
  [17, "Att"], [20, "xPS"], [21, "Made%"],
];

const HEADER_ROW = 5; // row 6, 0-based
const FIRST_DATA_ROW = 6; // row 7
const LAST_DATA_ROW = 44; // generous margin past the expected TOTALS at row 43

function readWeights(sheet: Sheet, warn: ParseContext["warn"]): Weights {
  const reception = [2, 3, 4, 5, 6, 7].map((c) => cellNum(sheet, addr(c, 2), warn));
  const serving = [15, 16, 17, 18, 19, 20].map((c) => cellNum(sheet, addr(c, 2), warn));
  return { reception, serving };
}

export const teamParser: Parser = {
  format: "team",

  detect(file: RawFile): boolean {
    try {
      const wb = readWorkbook(file.buffer);
      return wb.SheetNames.some((n) => n.trim().toLowerCase() === "practice");
    } catch {
      return false;
    }
  },

  parse(file: RawFile, ctx: ParseContext): ParseResult {
    const wb = readWorkbook(file.buffer);
    const sheet = getSheetLoose(wb, "PRACTICE", ctx.warn);

    for (const [c, want] of EXPECTED_HEADERS) {
      const found = cellStr(sheet, addr(c, HEADER_ROW));
      if (found?.toLowerCase() !== want.toLowerCase()) {
        ctx.warn({
          code: "header-drift",
          message: `Team sheet header ${addr(c, HEADER_ROW)}: expected "${want}", found "${found ?? ""}"`,
          cell: addr(c, HEADER_ROW),
        });
      }
    }

    const parsed = parseRawPath(file.relPath, ctx.config);
    for (const w of parsed.warnings) ctx.warn(w);
    const meta = resolveSessionMeta(parsed);
    const num = (c: number, r: number) => cellNum(sheet, addr(c, r), ctx.warn);
    const count = (c: number, r: number) => num(c, r) ?? 0;

    const teamStatLines: TeamStatLine[] = [];
    const seenPlayers = new Set<string>();
    let currentGroup: PositionGroup | null = null;
    let sawTotals = false;

    for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
      const label = cellStr(sheet, addr(COLS.label, r));
      const jerseyCell = cellNum(sheet, addr(COLS.jersey, r));

      if (label?.toUpperCase() === "TOTALS") {
        sawTotals = true;
        break;
      }

      if (jerseyCell === null) {
        // Block header or subtotal: both carry the group name in column B.
        // Headers precede their players (no numbers in the stat columns);
        // subtotals follow them (column C is numeric). Only headers switch
        // the current group.
        const grp = label ? GROUPS.find((g) => g.pattern.test(label)) : undefined;
        if (grp && cellNum(sheet, addr(COLS.atk.k, r)) === null) {
          currentGroup = grp.group;
        }
        continue;
      }

      if (!currentGroup) {
        ctx.warn({
          code: "header-drift",
          message: `Player row ${r + 1} before any position block header`,
        });
        continue;
      }

      const player = matchPlayer(ctx.roster, { jersey: jerseyCell, label }, ctx.warn);
      if (!player) continue;
      if (seenPlayers.has(player.id)) {
        ctx.warn({
          code: "duplicate-player-row",
          message: `${player.last} appears twice in ${file.relPath}`,
        });
        continue;
      }
      seenPlayers.add(player.id);

      // A group section is null when its anchor attempt cell is blank
      // (liberos never attack, setters never receive on this sheet).
      const atkAtt = num(COLS.atk.att, r);
      const attacking =
        atkAtt === null && num(COLS.atk.k, r) === null
          ? null
          : {
              k: count(COLS.atk.k, r),
              e: count(COLS.atk.e, r),
              blk: count(COLS.atk.blk, r),
              att: atkAtt ?? 0,
            };

      const recAtt = num(COLS.rec.att, r);
      const reception =
        recAtt === null
          ? null
          : {
              att: recAtt,
              avg: num(COLS.rec.avg, r),
              pp: count(COLS.rec.pp, r),
              err: count(COLS.rec.err, r),
              fbsoPct: num(COLS.rec.fbsoPct, r),
              inSysPct: num(COLS.rec.inSysPct, r),
            };

      const srvAtt = num(COLS.srv.att, r);
      const serving =
        srvAtt === null
          ? null
          : {
              att: srvAtt,
              aces: count(COLS.srv.aces, r),
              err: count(COLS.srv.err, r),
              xps: num(COLS.srv.xps, r),
              madePct: num(COLS.srv.madePct, r),
            };

      const satOut =
        (attacking?.att ?? 0) === 0 && (reception?.att ?? 0) === 0 && (serving?.att ?? 0) === 0;
      if (satOut) {
        ctx.warn({
          code: "zero-attempt-row",
          message: `${player.last} has zero attempts in ${file.relPath} (sat out)`,
        });
      }

      teamStatLines.push({
        sessionId: meta.id,
        playerId: player.id,
        positionGroup: currentGroup,
        attacking,
        reception,
        serving,
        satOut,
        sourceFile: file.relPath,
      });
    }

    if (!sawTotals) {
      ctx.warn({
        code: "header-drift",
        message: `No TOTALS row found by row ${LAST_DATA_ROW + 1} in ${file.relPath}`,
      });
    }
    if (teamStatLines.length === 0) throw new Error("No player rows parsed");

    const session = sessionFromMeta(meta, file.relPath);
    session.weights = readWeights(sheet, ctx.warn);
    return { sessions: [session], teamStatLines };
  },
};
