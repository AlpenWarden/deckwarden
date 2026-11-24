/**
 * Leader captions (R3 → R5b): the printed id and stat line a leader card
 * carries beside its name — "OP15-058 · 5000 Power · 5 Life" for One
 * Piece, "3/4" for a Magic commander — read through the adapter's display
 * contract, never hand-rolled in core. `LeaderZone` shows the caption in
 * the facts line beside the editor's raised card (`leaderFacts`, U3b; at
 * every tier since U4a). The mono caption it drew under an unraised card
 * went with that shape (TRIM-T4): `leaderFacts` is `leaderCaption`'s one
 * caller outside its test, and the export stays for that test. The share
 * page's header named every leader with its caption through `leaderLine`
 * until U6, whose meta line carries the names and printed ids with the
 * format, the card itself carrying the stats.
 * Pure, no IO.
 */
import type { CardData, GameAdapter } from "@/lib/games/types";

type Display = Pick<GameAdapter, "display">;

/** "OP15-058 · 5000 Power · 5 Life", "3/4", or "" when the adapter declares neither. */
export function leaderCaption(adapter: Display | undefined, card: CardData): string {
  if (!adapter) return "";
  return [adapter.display.idBadge?.(card), adapter.display.statLine?.(card)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The facts beside the editor's raised leader card (U3b, WAVE5 D4): the
 * type line and the caption as the adapter gives them, data not copy —
 * "Legendary Creature — Angel · 2/2", "Leader · OP15-058 · 5000 Power ·
 * 5 Life" — or "" with no adapter.
 */
export function leaderFacts(adapter: Display | undefined, card: CardData): string {
  if (!adapter) return "";
  return [adapter.display.subtitle(card), leaderCaption(adapter, card)].filter(Boolean).join(" · ");
}
