/**
 * A build action's address and its words on the two search surfaces
 * (COMMANDER-DOOR): the entry under the top row of the header search's
 * dropdown and the link under a tile of the /cards results. Which cards get
 * one is ./leader-build.ts.
 *
 * No import that survives compilation: the header's dropdown ships to every
 * page, and it must carry neither the seeded rows nor the adapter registry.
 */
import type { GameCode } from "@/db/seed-data";

/**
 * A new deck with this leader in place: the hub button's address
 * (src/components/hub/hub-build-cta.tsx), by the card's external key
 * (Magic's oracle id, One Piece's card number). Nothing is saved until the
 * first edit.
 */
export function leaderBuildHref(game: GameCode, externalKey: string): string {
  return `/decks/new?game=${game}&leader=${externalKey}`;
}

/**
 * "Build with Atraxa, Praetors' Voice". `key` joins the name in brackets
 * where the game tells cards apart by a printed id, because One Piece's
 * leaders share names: "Build with Monkey.D.Luffy (OP01-003)".
 */
export function leaderBuildWords(name: string, key?: string | null): string {
  return key ? `Build with ${name} (${key})` : `Build with ${name}`;
}
