import type { AttackBySetType } from "./schema";
import type { Parser, ParseContext, ParseResult, RawFile } from "./types";
import { parseRawPath } from "./filename";
import { matchPlayer } from "./roster";
import { resolveSessionMeta, sessionFromMeta } from "./session";
import { addr, cellNum, cellStr, getSheetLoose, readWorkbook, type Sheet } from "./xlsx-utils";

/**
 * Format C: Hitter by Set Type workbook. Sheet "Sheet1 ", A1 = "TOL 26".
 * Three stacked grids (Outsides, Opposites, Middles), each headed by three
 * rows: set codes ("PG"), set names ("GO"), stat headers (K, E, TA, Hit %),
 * with column groups four wide starting at column C. Set codes are only
 * meaningful scoped to their grid (PD = DOG for outsides, Dog for middles),
 * and a player can hold rows in two grids of the same file (Pertzborn plays
 * both OPP and MB) — records stay per-grid; merging happens at query time.
 */

const GRID_ORDER = ["OH", "OPP", "MB"] as const;

const KNOWN_CODES: Record<(typeof GRID_ORDER)[number], Set<string>> = {
  OH: new Set(["PG", "P4", "PD", "P5", "PR", "PP"]),
  OPP: new Set(["PG", "P4", "PD", "P5", "P9", "PP"]),
  MB: new Set(["P1", "P3", "PS", "PA", "PD", "P2"]),
};

const FIRST_GROUP_COL = 2;
const GROUP_WIDTH = 4;

function isCodeRow(sheet: Sheet, r: number): boolean {
  const code = cellStr(sheet, addr(FIRST_GROUP_COL, r));
  return (
    !!code &&
    /^P[A-Z0-9]$/.test(code) &&
    cellStr(sheet, addr(FIRST_GROUP_COL, r + 2)) === "K"
  );
}

export const setTypeParser: Parser = {
  format: "attack-by-set-type",

  detect(file: RawFile): boolean {
    try {
      const wb = readWorkbook(file.buffer);
      const sheet = getSheetLoose(wb, "Sheet1");
      return cellStr(sheet, "A1")?.startsWith("TOL") ?? false;
    } catch {
      return false;
    }
  },

  parse(file: RawFile, ctx: ParseContext): ParseResult {
    const wb = readWorkbook(file.buffer);
    const sheet = getSheetLoose(wb, "Sheet1", ctx.warn);

    const parsed = parseRawPath(file.relPath, ctx.config);
    for (const w of parsed.warnings) ctx.warn(w);
    const meta = resolveSessionMeta(parsed);

    // Locate the three grid header triplets dynamically — daily files vary
    // in how many player rows each grid holds.
    const gridStarts: number[] = [];
    for (let r = 0; r < 60; r++) {
      if (isCodeRow(sheet, r)) gridStarts.push(r);
    }
    if (gridStarts.length !== GRID_ORDER.length) {
      ctx.warn({
        code: "header-drift",
        message: `Expected 3 set-type grids, found ${gridStarts.length} in ${file.relPath}`,
      });
    }
    if (gridStarts.length === 0) throw new Error("No set-type grids found");

    const attackBySetType: AttackBySetType[] = [];

    gridStarts.slice(0, GRID_ORDER.length).forEach((codeRow, gi) => {
      const grid = GRID_ORDER[gi];

      const groups: Array<{ col: number; code: string; name: string }> = [];
      for (let col = FIRST_GROUP_COL; col < 40; col += GROUP_WIDTH) {
        const code = cellStr(sheet, addr(col, codeRow));
        if (!code) break;
        const name = cellStr(sheet, addr(col, codeRow + 1)) ?? code;
        if (!KNOWN_CODES[grid].has(code)) {
          ctx.warn({
            code: "unknown-set-code",
            message: `Unknown set code "${code}" (${name}) in ${grid} grid of ${file.relPath}`,
          });
        }
        groups.push({ col, code, name });
      }

      const seenInGrid = new Set<string>();
      const nextGridStart = gridStarts[gi + 1] ?? 60;
      for (let r = codeRow + 3; r < nextGridStart; r++) {
        const jersey = cellNum(sheet, addr(0, r));
        if (jersey === null) {
          // Grids end at the first non-player row.
          break;
        }
        const label = cellStr(sheet, addr(1, r));
        const player = matchPlayer(ctx.roster, { jersey, label }, ctx.warn);
        if (!player) continue;
        if (seenInGrid.has(player.id)) {
          ctx.warn({
            code: "duplicate-player-row",
            message: `${player.last} appears twice in the ${grid} grid of ${file.relPath}`,
          });
          continue;
        }
        seenInGrid.add(player.id);

        for (const g of groups) {
          const k = cellNum(sheet, addr(g.col, r), ctx.warn) ?? 0;
          const e = cellNum(sheet, addr(g.col + 1, r), ctx.warn) ?? 0;
          const ta = cellNum(sheet, addr(g.col + 2, r), ctx.warn) ?? 0;
          if (k === 0 && e === 0 && ta === 0) continue;
          attackBySetType.push({
            sessionId: meta.id,
            playerId: player.id,
            grid,
            setCode: g.code,
            setName: g.name,
            k,
            e,
            ta,
            sourceFile: file.relPath,
          });
        }
      }
    });

    return { sessions: [sessionFromMeta(meta, file.relPath)], attackBySetType };
  },
};
