import type { SetterHitter } from "./schema";
import type { Parser, ParseContext, ParseResult, RawFile } from "./types";
import { parseRawPath } from "./filename";
import { matchPlayer } from "./roster";
import { resolveSessionMeta, sessionFromMeta } from "./session";
import { addr, cellNum, cellStr, getSheetLoose, readWorkbook } from "./xlsx-utils";

/**
 * Format B: Setter Hitter workbook. Sheet "Sheet1 " (trailing space).
 * B1 = session type label. Five setter column blocks of five columns each
 * (K, E-Unf, E-Blk, TA, Hit %) starting at columns C, H, M, R, W; row 4
 * carries the setter jersey, row 5 the setter name, row 6 the headers.
 * Attacker rows follow row 6 until the TOTALS row. Rows 45+ are a dropdown
 * legend to ignore. The setter axis legitimately includes liberos (they set
 * out-of-system balls) — never assume it only holds rostered setters.
 */

const BLOCK_STARTS = [2, 7, 12, 17, 22];
const JERSEY_ROW = 3; // row 4, 0-based
const NAME_ROW = 4;
const HEADER_ROW = 5;
const FIRST_ATTACKER_ROW = 6;
const LEGEND_CUTOFF_ROW = 43; // hard stop well before the row-45 legend

export const setterHitterParser: Parser = {
  format: "setter-hitter",

  detect(file: RawFile): boolean {
    try {
      const wb = readWorkbook(file.buffer);
      const sheet = getSheetLoose(wb, "Sheet1");
      return cellStr(sheet, addr(3, HEADER_ROW)) === "E-Unf";
    } catch {
      return false;
    }
  },

  parse(file: RawFile, ctx: ParseContext): ParseResult {
    const wb = readWorkbook(file.buffer);
    const sheet = getSheetLoose(wb, "Sheet1", ctx.warn);

    const parsed = parseRawPath(file.relPath, ctx.config);
    for (const w of parsed.warnings) ctx.warn(w);
    // B1 announces the session type but is unreliable (the Blue Gold
    // scrimmage aggregate says PRACTICE), so path rules win; B1 only fills
    // in when no rule matched the path.
    const b1 = cellStr(sheet, "B1");
    const kindFromSheet =
      parsed.kind !== null || !b1
        ? undefined
        : /match/i.test(b1)
          ? ("match" as const)
          : /scout/i.test(b1)
            ? ("scrimmage" as const)
            : undefined;
    const meta = resolveSessionMeta(parsed, { kindOverride: kindFromSheet });

    // Discover setter blocks from the jersey/name rows; a template with
    // fewer than five setters just leaves trailing blocks blank.
    const setters: Array<{ col: number; playerId: string }> = [];
    for (const col of BLOCK_STARTS) {
      const jersey = cellNum(sheet, addr(col, JERSEY_ROW));
      const name = cellStr(sheet, addr(col, NAME_ROW));
      if (jersey === null && !name) continue;
      const header = cellStr(sheet, addr(col + 1, HEADER_ROW));
      if (header !== "E-Unf") {
        ctx.warn({
          code: "header-drift",
          message: `Setter block at column ${addr(col, HEADER_ROW)}: expected "E-Unf" header, found "${header ?? ""}"`,
        });
      }
      const player = matchPlayer(ctx.roster, { jersey, label: name }, ctx.warn);
      if (player) setters.push({ col, playerId: player.id });
    }
    if (setters.length === 0) throw new Error("No setter blocks found");

    const setterHitter: SetterHitter[] = [];
    for (let r = FIRST_ATTACKER_ROW; r <= LEGEND_CUTOFF_ROW; r++) {
      const label = cellStr(sheet, addr(1, r));
      if (label?.toUpperCase() === "TOTALS") break;
      const jersey = cellNum(sheet, addr(0, r));
      if (jersey === null) continue;
      const hitter = matchPlayer(ctx.roster, { jersey, label }, ctx.warn);
      if (!hitter) continue;

      for (const s of setters) {
        const k = cellNum(sheet, addr(s.col, r), ctx.warn) ?? 0;
        const eUnf = cellNum(sheet, addr(s.col + 1, r), ctx.warn) ?? 0;
        const eBlk = cellNum(sheet, addr(s.col + 2, r), ctx.warn) ?? 0;
        const ta = cellNum(sheet, addr(s.col + 3, r), ctx.warn) ?? 0;
        // A pair with no attempts carries no connection information.
        if (k === 0 && eUnf === 0 && eBlk === 0 && ta === 0) continue;
        setterHitter.push({
          sessionId: meta.id,
          setterId: s.playerId,
          hitterId: hitter.id,
          k,
          eUnf,
          eBlk,
          ta,
          sourceFile: file.relPath,
        });
      }
    }

    return { sessions: [sessionFromMeta(meta, file.relPath)], setterHitter };
  },
};
