/**
 * A deck row's adapter + FormatDef (the core <-> adapter seam every card
 * writer needs). Undefined for a row whose seeded game/format has no
 * adapter (azuki is seeded without one) — which routes surface as a 500.
 *
 * Its own module since MAYBE-LIST (it was route-helpers.ts', which still
 * re-exports it): the link preview's read and the version writers need the
 * format's zones without the route helpers' session and limiter imports.
 */
import { findFormatById, gameCodeById } from "@/db/seed-data";
import { findAdapter } from "@/lib/games/registry";
import type { FormatDef, GameAdapter } from "@/lib/games/types";

export function deckFormat(deck: {
  gameId: number;
  formatId: number;
}): { adapter: GameAdapter; format: FormatDef } | undefined {
  const adapter = findAdapter(gameCodeById(deck.gameId));
  const formatCode = findFormatById(deck.formatId)?.code;
  const format = adapter?.formats.find((f) => f.code === formatCode);
  return adapter && format ? { adapter, format } : undefined;
}
