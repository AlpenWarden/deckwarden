/**
 * The collection page's first view (COLLECTION-PAGE, the owner's idea 1 of
 * 2026-11-24): the leaders a player owns, each with how many of their cards
 * fit inside its colors. "Leader" is the shared word; the page prints the
 * game's own noun (Magic: Commander).
 *
 * Two reads, then arithmetic:
 *
 * - `loadOwnedColorCounts`: the player's cards of one game, counted by color
 *   identity. A color identity is a mask of at most five colors, so Magic
 *   answers in 32 rows or fewer whatever the collection's size.
 * - `loadOwnedLeaders`: the leader candidates among those cards, each with
 *   its current ruling in the format a new deck would be built in. The rule
 *   is the hub's (`loadLeaderStatus`, src/lib/hub/queries.ts), applied to a
 *   whole list: the current unconditional row, and no row means legal.
 * - `rankOwnedLeaders` (pure): the count beside a leader is the sum of the
 *   first read's rows whose identity fits inside the leader's, less one for
 *   the leader itself. No third statement, and nothing per leader.
 *
 * What is counted (the owner's decision 12): every card the player owns
 * that fits, lands included, each card once however many printings or
 * copies of it the collection holds. Leaders with more colors therefore
 * lead, and the page says so. "Owned" is the site's one rule: any printing.
 *
 * The collection is private. Both reads are keyed by the session's own user
 * id and nothing here takes another player's. Neither is cached.
 */
import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb, schema, type DbExecutor } from "@/db";
import { ownedCondition } from "@/lib/recommend/queries";

const { cardIdentities: ci, cardPrintings: cp, collections, legalities } = schema;

/** A leader the player owns, as the second read returns it. */
export interface OwnedLeader {
  id: string;
  name: string;
  /** What the new-deck link seeds by (`?leader=`), the hub build button's key. */
  externalKey: string;
  ciMask: number;
  /** The game's popularity rank (lower is more played), or null without one. */
  popularity: number | null;
  /** The current unconditional ruling in the format; "legal" when there is no row. */
  status: string;
}

/** A leader a deck can be built with, and how many other owned cards fit its colors. */
export interface RankedLeader extends OwnedLeader {
  fits: number;
}

/**
 * The player's cards of one game counted by color identity: mask → cards.
 * One row per identity the collection holds a printing of, never per copy.
 */
export async function loadOwnedColorCounts(
  userId: string,
  gameId: number,
  db: DbExecutor = getDb(),
): Promise<Map<number, number>> {
  // The player's cards first, each once (a card may be held in several
  // printings and finishes), then their identities: the card table is read
  // once per card, not once per collection row.
  const owned = db
    .selectDistinct({ identityId: cp.cardIdentityId })
    .from(collections)
    .innerJoin(cp, eq(cp.id, collections.printingId))
    .where(eq(collections.userId, userId))
    .as("owned");
  const rows = await db
    .select({ ciMask: ci.ciMask, cards: sql<number>`count(*)::int` })
    .from(owned)
    .innerJoin(ci, eq(ci.id, owned.identityId))
    .where(eq(ci.gameId, gameId))
    .groupBy(ci.ciMask);
  return new Map(rows.map((row) => [row.ciMask, row.cards]));
}

/**
 * The leader candidates the player owns, in no particular order, with each
 * one's ruling in `formatId`. A double-faced leader is one card and one
 * row; a partner is its own row with its own colors. The probe is the
 * recommendation engine's (`ownedCondition`): does a printing of this card
 * sit in this player's collection.
 */
export async function loadOwnedLeaders(
  userId: string,
  gameId: number,
  formatId: number,
  db: DbExecutor = getDb(),
): Promise<OwnedLeader[]> {
  return db
    .select({
      id: ci.id,
      name: ci.name,
      externalKey: ci.externalKey,
      ciMask: ci.ciMask,
      popularity: ci.popularity,
      status: sql<string>`coalesce(${legalities.status}, 'legal')`,
    })
    .from(ci)
    .leftJoin(
      legalities,
      and(
        eq(legalities.cardIdentityId, ci.id),
        eq(legalities.formatId, formatId),
        isNull(legalities.effectiveTo),
        isNull(legalities.condition),
      ),
    )
    .where(
      and(
        eq(ci.gameId, gameId),
        eq(ci.isLeaderCandidate, true),
        eq(ci.isRemoved, false),
        ownedCondition(userId),
      ),
    );
}

/** How many counted cards have a color identity inside `ciMask` (the fit test: `(card & ~leader) = 0`). */
export function cardsWithin(counts: ReadonlyMap<number, number>, ciMask: number): number {
  let cards = 0;
  for (const [mask, n] of counts) if ((mask & ~ciMask) === 0) cards += n;
  return cards;
}

const byName = (a: OwnedLeader, b: OwnedLeader) =>
  a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);

/**
 * The page's order. Legal leaders: most owned cards inside their colors
 * first, then the more played one (unranked last), then the name. The
 * leader itself is left out of its own count: it is one of the player's
 * cards and it fits its own colors. A leader the format does not allow is
 * set apart, by name; the page names it and offers no build action.
 */
export function rankOwnedLeaders(
  leaders: readonly OwnedLeader[],
  counts: ReadonlyMap<number, number>,
): { legal: RankedLeader[]; notLegal: OwnedLeader[] } {
  const legal: RankedLeader[] = [];
  const notLegal: OwnedLeader[] = [];
  for (const leader of leaders) {
    if (leader.status === "legal") {
      legal.push({ ...leader, fits: Math.max(0, cardsWithin(counts, leader.ciMask) - 1) });
    } else {
      notLegal.push(leader);
    }
  }
  legal.sort(
    (a, b) =>
      b.fits - a.fits ||
      (a.popularity ?? Number.POSITIVE_INFINITY) - (b.popularity ?? Number.POSITIVE_INFINITY) ||
      byName(a, b),
  );
  notLegal.sort(byName);
  return { legal, notLegal };
}
