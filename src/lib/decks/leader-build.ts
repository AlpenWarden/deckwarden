/**
 * The leader build rule (COMMANDER-DOOR, the owner's idea 4 of 2026-11-24):
 * which cards get a build action ("Build with this commander", "Build with
 * <card name>") on the card page, in the header search's dropdown and under
 * the tiles of the /cards results. "Leader" is the shared word; each surface
 * prints the game's own noun, or the card's name.
 *
 * The rule: a card gets a build action when it is a leader candidate and its
 * status in the format a new deck opens in is `legal`. Its status is that of
 * its current unconditional row there (`effective_to IS NULL`, `condition IS
 * NULL`), and `legal` when it has no such row. So `banned`, `not_legal` and
 * `restricted` block, and a conditional row never does: One Piece's pair
 * bans are conditional, and a leader named in one can still lead a deck.
 *
 * No surface reads a format's default. "No row" reads as legal, which is
 * true only while every seeded format defaults to `legal`; this module's
 * test pins that, so a format seeded with another default fails there first.
 *
 * The rule has two older homes, each in its own code and left as they are:
 * the commander hub's page (`status === "legal"` over `loadLeaderStatus`,
 * src/lib/hub/queries.ts) and the collection page's read (`loadOwnedLeaders`
 * and `rankOwnedLeaders`, src/lib/collection/leaders.ts). The header's
 * dropdown reads it from a column built on `leaderFormat` here
 * (`buildBlockedSql`, src/lib/search/suggest.ts).
 *
 * Client-safe on purpose: it imports the seeded reference rows, a file with
 * no imports of its own, and never `@/db` or the adapter registry. The grid
 * is a client component, and the card page is imported whole by tests that
 * replace the hub's queries. The action's address and words are a module of
 * their own with no import at all (./leader-build-link.ts), because the
 * header's dropdown ships to every page.
 */
import { FORMATS, GAME_ID, type GameCode, type SeededFormat } from "@/db/seed-data";
import type { LegalityEntry } from "@/lib/games/types";

/**
 * The format a game's new deck opens in: the game's first seeded row, which
 * is the adapter's first format (`adapter.formats[0]`, the new-deck page's
 * own rule; this module's test pins that the two agree). Undefined for a
 * game with no seeded format.
 */
export function leaderFormat(game: GameCode): SeededFormat | undefined {
  return FORMATS.find((format) => format.gameId === GAME_ID[game]);
}

/**
 * The rule. `status` is the card's current unconditional status in
 * `leaderFormat`'s format, or undefined when it has no such row.
 */
export function leaderCanBuild(
  isLeaderCandidate: boolean,
  status: LegalityEntry["status"] | undefined,
): boolean {
  return isLeaderCandidate && (status ?? "legal") === "legal";
}

/**
 * The status the rule reads, out of a card's current rows for one format as
 * the search route sends them (`legality`): the entry with no condition, or
 * undefined. The table allows one such row per card and format.
 */
export function unconditionalStatus(
  legality: readonly LegalityEntry[] | undefined,
): LegalityEntry["status"] | undefined {
  return legality?.find((entry) => !entry.condition)?.status;
}
