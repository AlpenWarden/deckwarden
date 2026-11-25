/**
 * The collection page's second view (COLLECTION-PAGE, the owner's idea 1 of
 * 2026-11-24): the player's cards as a list, one row per card with its
 * copies added up over every printing and finish, sixty a page, optionally
 * narrowed by name, in one of two orders.
 *
 * One statement a page. Nothing indexes a player's cards by name or by
 * rank, so the statement gathers the player's rows (a prefix scan of the
 * collection's primary key), folds them to cards, and sorts all of them
 * before it cuts the page. The cost therefore depends on the collection's
 * size and not on the page asked for: the last page costs what the first
 * does. The total rides along as a window count over the same rows, so no
 * second statement counts them. Measured at the 20,000-row cap before the
 * page was written (REDESIGN.md, "The collection page").
 *
 * The name filter is the site's one matcher (src/lib/search/name-match.ts,
 * the "list" reading the leader index uses): every typed word somewhere in
 * the name, plus near misses from four characters on. The order stays the
 * reader's choice, by name or by rank; the matcher's own ranking is for a
 * search box, and this is a list.
 *
 * Read-only and private: keyed by the session's own user id, never cached.
 */
import { and, eq, sql, type SQL } from "drizzle-orm";

import { getDb, schema, type DbExecutor } from "@/db";
import { nameMatchCondition, parseNameQuery } from "@/lib/search/name-match";

import { COLLECTION_PAGE_SIZE, type CollectionSort } from "./page-query";

const { cardIdentities: ci, cardPrintings: cp, collections } = schema;

export interface OwnedCardRow {
  id: string;
  name: string;
  primaryType: string | null;
  ciMask: number;
  /** The game's popularity rank (lower is more played), or null without one. */
  popularity: number | null;
  /** Copies over every printing and finish of the card. */
  copies: number;
}

export interface OwnedCardsPage {
  rows: OwnedCardRow[];
  /**
   * Cards that match, over every page. Null only when `rows` is empty: a
   * page past the end, or no match, which the page tells apart by its number.
   */
  total: number | null;
}

/** The two orders: A to Z, or most played first with unranked cards last. Both end on the id, so pages never overlap. */
function orderFor(sort: CollectionSort): SQL[] {
  const byName = [sql`${ci.nameNorm} ASC`, sql`${ci.id} ASC`];
  return sort === "rank" ? [sql`${ci.popularity} ASC NULLS LAST`, ...byName] : byName;
}

export async function loadOwnedCards(
  opts: {
    userId: string;
    gameId: number;
    /** 1-based. */
    page: number;
    sort: CollectionSort;
    /** The typed name, as typed; nothing that survives normalization means no filter. */
    q?: string;
  },
  db: DbExecutor = getDb(),
): Promise<OwnedCardsPage> {
  const owned = db
    .select({
      identityId: cp.cardIdentityId,
      copies: sql<number>`sum(${collections.quantity})::int`.as("copies"),
    })
    .from(collections)
    .innerJoin(cp, eq(cp.id, collections.printingId))
    .where(eq(collections.userId, opts.userId))
    .groupBy(cp.cardIdentityId)
    .as("owned");

  const conditions: SQL[] = [eq(ci.gameId, opts.gameId)];
  const nameQuery = parseNameQuery(opts.q);
  if (nameQuery) conditions.push(nameMatchCondition(nameQuery, "list"));

  const rows = await db
    .select({
      id: ci.id,
      name: ci.name,
      primaryType: ci.primaryType,
      ciMask: ci.ciMask,
      popularity: ci.popularity,
      copies: owned.copies,
      total: sql<number>`(count(*) OVER ())::int`,
    })
    .from(owned)
    .innerJoin(ci, eq(ci.id, owned.identityId))
    .where(and(...conditions))
    .orderBy(...orderFor(opts.sort))
    .limit(COLLECTION_PAGE_SIZE)
    .offset((opts.page - 1) * COLLECTION_PAGE_SIZE);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      primaryType: row.primaryType,
      ciMask: row.ciMask,
      popularity: row.popularity,
      copies: row.copies,
    })),
    total: rows[0]?.total ?? null,
  };
}
