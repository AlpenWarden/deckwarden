/**
 * The collection page's address (COLLECTION-PAGE): which of its two views,
 * which page, and for the card list its name filter and its order. Pure, so
 * the page reads the query here and builds every link here, and a link can
 * only name a state the page reads back the same way.
 *
 *   /collection                                  the leaders the player owns
 *   /collection?page=2                           … their second page
 *   /collection?view=cards                       the cards, A to Z
 *   /collection?view=cards&q=bolt&sort=rank&page=3
 *
 * Whatever is not one of these reads as the default, never as an error: an
 * unknown view is the leaders, an unknown order is by name, a page that is
 * not a whole number from 1 to COLLECTION_PAGE_MAX is page 1, and a repeated
 * parameter is ignored. The leaders view has no filter and one order, so
 * `q` and `sort` are dropped from its links.
 *
 * `buildFromCollectionHref` is the page's one action: the new-deck link with
 * the leader in place, the Autofill sheet open (`autofill=1`) and its "Only
 * cards I own" box ticked (`owned=1`). Both flags are one-time: the new-deck
 * page strips them from its address, so a reload reopens nothing. The link
 * names no player and carries no card of theirs. Opened by someone else it
 * builds from that person's own collection, or from none.
 */

/** Rows a page of either view holds. */
export const COLLECTION_PAGE_SIZE = 60;

/**
 * The last page an address may name. The import keeps 20,000 rows, so 334
 * pages of sixty hold any collection; a larger number reads as page 1.
 */
export const COLLECTION_PAGE_MAX = 400;

export const COLLECTION_VIEWS = ["leaders", "cards"] as const;
export type CollectionView = (typeof COLLECTION_VIEWS)[number];

export const COLLECTION_SORTS = ["name", "rank"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

/** Characters of a typed name the page keeps (the matcher itself reads the first hundred, normalized). */
export const COLLECTION_NAME_MAX = 100;

export interface CollectionQuery {
  view: CollectionView;
  /** 1-based. */
  page: number;
  /** The card list's order. Always "name" in the leaders view. */
  sort: CollectionSort;
  /** The card list's name filter as typed, trimmed; "" for none. Always "" in the leaders view. */
  q: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The query as the page acts on it. `rankSort` says whether the game has a
 * rank to order by (its adapter declares one); without it `sort=rank` reads
 * as by name.
 */
export function parseCollectionQuery(
  sp: SearchParams,
  { rankSort }: { rankSort: boolean },
): CollectionQuery {
  const view: CollectionView = sp.view === "cards" ? "cards" : "leaders";
  const rawPage = typeof sp.page === "string" && /^\d{1,4}$/.test(sp.page) ? Number(sp.page) : 1;
  const page = rawPage >= 1 && rawPage <= COLLECTION_PAGE_MAX ? rawPage : 1;
  if (view === "leaders") return { view, page, sort: "name", q: "" };
  return {
    view,
    page,
    sort: sp.sort === "rank" && rankSort ? "rank" : "name",
    q: typeof sp.q === "string" ? sp.q.trim().slice(0, COLLECTION_NAME_MAX) : "",
  };
}

/** The address of a state: defaults are left out, so the plain page is `/collection`. */
export function collectionHref({
  view = "leaders",
  page = 1,
  sort = "name",
  q = "",
}: Partial<CollectionQuery> = {}): string {
  const params = new URLSearchParams();
  if (view === "cards") {
    params.set("view", "cards");
    if (q) params.set("q", q);
    if (sort === "rank") params.set("sort", "rank");
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/collection?${query}` : "/collection";
}

/** Pages a list of `total` rows takes; an empty list is one (empty) page. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));
}

/** The rows of one page of a list already in order. */
export function pageSlice<T>(rows: readonly T[], page: number): T[] {
  return rows.slice((page - 1) * COLLECTION_PAGE_SIZE, page * COLLECTION_PAGE_SIZE);
}

/** "Build from my collection": a new deck with this leader, the Autofill sheet open and its owned box ticked. */
export function buildFromCollectionHref(game: string, leaderKey: string): string {
  return `/decks/new?game=${encodeURIComponent(game)}&leader=${encodeURIComponent(leaderKey)}&autofill=1&owned=1`;
}
