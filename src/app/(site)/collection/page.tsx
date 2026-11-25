/**
 * /collection (COLLECTION-PAGE, package 2 of
 * OWNER-NOTES-2026-11-24-session-prompt.md; the owner's idea 1 of
 * 2026-11-24: "a separate page to view your collection of cards and have
 * features to build off that"). A signed-in player sees the leaders they
 * own, each with how many of their cards fit its colors, starts a deck
 * built from the collection in one press, and can read the collection as a
 * list. Read-only, in text rows (the owner's decision 10): the import, the
 * wipe and every count beyond these stay on /account.
 *
 * Caching intent: force-dynamic, like /account. Every byte below the header
 * is one player's, read for the session's own user and never stored: Next
 * answers a dynamic page `private, no-cache, no-store`. Not indexed (the
 * metadata below) and disallowed for crawlers (src/app/robots.ts).
 *
 * The collection is private. There is no address that shows a collection to
 * anyone but its owner: this page takes no id, and its reads are keyed by
 * the session. Signed out, it draws the sign-in buttons and reads nothing
 * about any collection; `next` brings the player back here once signed in
 * (through /account, where the deck claim runs: src/lib/auth/next-path.ts).
 *
 * Shared code. The page knows one thing about games: which one a collection
 * holds (`COLLECTION_GAME`). The leader's noun, the format a new deck is
 * built in (whose rulings decide what can be built), the rank's words and
 * its source's name, and whether a starter list exists at all come off that
 * game's adapter. Nothing here spells a game's own term.
 *
 * Reads, by view (each was measured at the 20,000-row cap before this page
 * existed; REDESIGN.md, "The collection page"):
 * - the leaders: the cards counted by color identity and the owned leaders
 *   with their rulings, two statements, then arithmetic and the page's cut
 *   in code (src/lib/collection/leaders.ts);
 * - the cards: one statement for the page of rows and their total
 *   (src/lib/collection/browse.ts), and one row asked for only when that
 *   page is empty, to tell "no collection" from "nothing matches".
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { CollectionPager } from "@/components/collection/collection-pager";
import { OwnedCardList, type CardListItem } from "@/components/collection/owned-card-list";
import { OwnedLeaderList, type LeaderListItem } from "@/components/collection/owned-leader-list";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { findFormat, GAME_ID } from "@/db/seed-data";
import { getSessionUserId } from "@/lib/auth";
import { loadOwnedCards } from "@/lib/collection/browse";
import {
  loadOwnedColorCounts,
  loadOwnedLeaders,
  rankOwnedLeaders,
  type OwnedLeader,
} from "@/lib/collection/leaders";
import { hasCollection } from "@/lib/collection/owned";
import {
  buildFromCollectionHref,
  collectionHref,
  pageCount,
  pageSlice,
  parseCollectionQuery,
  type CollectionQuery,
} from "@/lib/collection/page-query";
import { COLLECTION_GAME } from "@/lib/collection/types";
import { getAdapter } from "@/lib/games/registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection",
  description: "The cards you imported, private to your account.",
  // Belt-and-suspenders with robots.txt's /collection disallow.
  robots: { index: false },
};

/** Where the import, the wipe and the collection's other counts live. */
const IMPORT_HREF = "/account#collection";

const MAIN_CLASS = "max-w-browse mx-auto w-full flex-1 px-4 py-8";
const CENTERED_CLASS =
  "max-w-reading mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-12";

const count = (n: number) => n.toLocaleString("en-US");

/** A ruling as a word in a sentence: "banned", "not legal". */
const rulingWord = (status: string) => status.replace(/_/g, " ");

/** Past this many, the names of the leaders a format does not allow fold behind their count. */
const NOT_LEGAL_INLINE_MAX = 10;

/**
 * The quiet line for leaders the format does not allow: named, each with its
 * ruling, and no build action anywhere on the page. A few are one sentence.
 * Many (a large collection of old or odd cards) would be a screen of names
 * on a phone, so past NOT_LEGAL_INLINE_MAX the sentence counts them and the
 * names open under it.
 */
function NotLegalLeaders({
  leaders,
  formatLabel,
  nouns,
}: {
  leaders: readonly OwnedLeader[];
  formatLabel: string;
  /** The game's leader noun, plural and lower case. */
  nouns: string;
}) {
  const names = leaders.map((l) => `${l.name} (${rulingWord(l.status)})`).join(", ");
  if (leaders.length <= NOT_LEGAL_INLINE_MAX) {
    return (
      <p data-slot="collection-not-legal" className="text-muted-foreground mt-4 text-xs">
        {`Also in your collection, with no build button because ${formatLabel} does not allow them: ${names}.`}
      </p>
    );
  }
  return (
    <details data-slot="collection-not-legal" className="text-muted-foreground mt-4 text-xs">
      {/* 44 px on touch by padding: `flex` would drop the disclosure marker. */}
      <summary className="cursor-pointer pointer-coarse:py-3.5">
        {`Also in your collection, with no build button because ${formatLabel} does not allow them: ${count(leaders.length)} ${nouns}`}
      </summary>
      <p className="mt-1">{`${names}.`}</p>
    </details>
  );
}

function NoCollection() {
  return (
    <main id="main" className={MAIN_CLASS}>
      <h1 className="type-title">Collection</h1>
      <EmptyState
        mark
        className="mt-6"
        title="No collection imported yet"
        hint="Import your collection on the Account page to see it here and to build decks from the cards you own."
        action={
          <Link href={IMPORT_HREF} className={buttonVariants({ size: "sm" })}>
            Import a collection
          </Link>
        }
      />
    </main>
  );
}

export default async function CollectionPage({ searchParams }: PageProps<"/collection">) {
  const [userId, sp] = await Promise.all([getSessionUserId(await headers()), searchParams]);

  if (!userId) {
    return (
      <main id="main" className={CENTERED_CLASS}>
        <h1 className="type-title">Your collection</h1>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          Sign in to see the collection you imported and to build decks from the cards you own. A
          collection is private: it is only ever shown to you.
        </p>
        <SignInButtons next={collectionHref()} />
      </main>
    );
  }

  const game = COLLECTION_GAME;
  const gameId = GAME_ID[game];
  const adapter = getAdapter(game);
  // The format a new deck is built in: the new-deck page's own rule (its first).
  const format = adapter.formats[0];
  const formatRow = findFormat(game, format.code);
  if (!formatRow) throw new Error(`No seeded format for ${game}/${format.code}`);
  const noun = adapter.display.leaderNoun;
  const nouns = `${noun}s`;
  const popularity = adapter.recommend?.popularity;
  const rankSource = popularity
    ? (adapter.recommend?.sources?.[popularity.source]?.label ?? popularity.source)
    : null;
  // A starter list exists only where the adapter declares one; elsewhere the leaders are listed without the action.
  const canBuild =
    Boolean(adapter.recommend?.autofill) && format.zones.some((zone) => zone.isLeaderZone);

  const query = parseCollectionQuery(sp, { rankSort: popularity !== undefined });

  let body;
  if (query.view === "leaders") {
    const [counts, owned] = await Promise.all([
      loadOwnedColorCounts(userId, gameId),
      loadOwnedLeaders(userId, gameId, formatRow.id),
    ]);
    if (counts.size === 0) return <NoCollection />;
    let cards = 0;
    for (const n of counts.values()) cards += n;
    const { legal, notLegal } = rankOwnedLeaders(owned, counts);
    const pages = pageCount(legal.length);
    const rows: LeaderListItem[] = pageSlice(legal, query.page).map((leader) => ({
      id: leader.id,
      name: leader.name,
      ciMask: leader.ciMask,
      fits: leader.fits,
      buildHref: canBuild ? buildFromCollectionHref(game, leader.externalKey) : null,
    }));
    const browse = adapter.display.leaderBrowse;
    body = (
      <section aria-labelledby="collection-leaders" className="mt-6">
        <h2 id="collection-leaders" className="type-section">
          {nouns} you own
        </h2>
        {legal.length === 0 ? (
          <EmptyState
            className="mt-3"
            title={`No ${nouns.toLowerCase()} to build with in your collection`}
            hint={`None of your ${count(cards)} card${cards === 1 ? "" : "s"} can lead a ${format.label} deck.`}
            action={
              browse && (
                <Link href={browse.href} className="underline">
                  {browse.label}
                </Link>
              )
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground mt-1 text-sm">
              {`${count(legal.length)} ${(legal.length === 1 ? noun : nouns).toLowerCase()} among your ${count(cards)} card${cards === 1 ? "" : "s"}.`}{" "}
              {nouns} with more colors come first, because more of your cards fit them: each count
              is every other card you own inside that {noun.toLowerCase()}&apos;s colors.
            </p>
            {rows.length === 0 ? (
              <p className="text-muted-foreground mt-4 text-sm">
                Nothing on page {count(query.page)}.{" "}
                <Link href={collectionHref()} className="underline">
                  Back to page 1
                </Link>
              </p>
            ) : (
              <>
                <div className="mt-4">
                  <OwnedLeaderList leaders={rows} game={game} />
                </div>
                <CollectionPager
                  page={query.page}
                  pages={pages}
                  previousHref={query.page > 1 ? collectionHref({ page: query.page - 1 }) : null}
                  nextHref={query.page < pages ? collectionHref({ page: query.page + 1 }) : null}
                />
              </>
            )}
          </>
        )}
        {notLegal.length > 0 && (
          <NotLegalLeaders
            leaders={notLegal}
            formatLabel={format.label}
            nouns={nouns.toLowerCase()}
          />
        )}
      </section>
    );
  } else {
    const cards = await loadOwnedCards({
      userId,
      gameId,
      page: query.page,
      sort: query.sort,
      q: query.q,
    });
    if (cards.rows.length === 0 && !(await hasCollection(userId))) return <NoCollection />;
    const rows: CardListItem[] = cards.rows.map((card) => ({
      id: card.id,
      name: card.name,
      primaryType: card.primaryType,
      ciMask: card.ciMask,
      rank:
        popularity && card.popularity !== null
          ? popularity.evidence(card.popularity).howOften
          : null,
      copies: card.copies,
    }));
    // Known whenever the page holds a row, which is the only time the pager is drawn.
    const pages = pageCount(cards.total ?? 0);
    const here = (over: Partial<CollectionQuery>) =>
      collectionHref({ view: "cards", sort: query.sort, q: query.q, ...over });
    body = (
      <section aria-labelledby="collection-cards" className="mt-6">
        <h2 id="collection-cards" className="type-section">
          Your cards
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* A plain GET form: Enter or the button submits, and it works
              without JavaScript. The view and the order ride along as hidden
              inputs; no page input, so a new filter starts at page 1. Keyed
              on the filter so a navigation that clears it resets the box. */}
          <form
            action="/collection"
            method="get"
            role="search"
            className="flex w-full items-center gap-2 sm:w-80"
          >
            <input type="hidden" name="view" value="cards" />
            {query.sort === "rank" && <input type="hidden" name="sort" value="rank" />}
            <label htmlFor="collection-q" className="sr-only">
              Filter your cards by name
            </label>
            <Input
              key={query.q}
              id="collection-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Filter by name…"
              autoComplete="off"
            />
            <Button type="submit" variant="outline" className="shrink-0">
              Filter
            </Button>
          </form>
          {rankSource && (
            <nav aria-label="Order" className="flex flex-wrap items-center gap-1.5">
              <Chip
                render={<Link href={here({ sort: "name", page: 1 })} />}
                aria-current={query.sort === "name" ? "page" : undefined}
                pressed={query.sort === "name"}
              >
                A to Z
              </Chip>
              <Chip
                render={<Link href={here({ sort: "rank", page: 1 })} />}
                aria-current={query.sort === "rank" ? "page" : undefined}
                pressed={query.sort === "rank"}
              >
                {rankSource} rank
              </Chip>
            </nav>
          )}
        </div>
        {cards.total !== null && (
          <p className="text-muted-foreground mt-3 text-sm">
            {query.q ? (
              <>
                {`${count(cards.total)} of your cards match${cards.total === 1 ? "es" : ""} “${query.q}”.`}{" "}
                <Link href={here({ q: "", page: 1 })} className="underline">
                  Clear filter
                </Link>
              </>
            ) : (
              <>
                {count(cards.total)} card{cards.total === 1 ? "" : "s"}, one row each, with the
                copies of every printing added up.
              </>
            )}
          </p>
        )}
        {rows.length > 0 ? (
          <>
            <div className="mt-3">
              <OwnedCardList cards={rows} game={game} />
            </div>
            <CollectionPager
              page={query.page}
              pages={pages}
              previousHref={query.page > 1 ? here({ page: query.page - 1 }) : null}
              nextHref={query.page < pages ? here({ page: query.page + 1 }) : null}
            />
          </>
        ) : query.page > 1 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Nothing on page {count(query.page)}.{" "}
            <Link href={here({ page: 1 })} className="underline">
              Back to page 1
            </Link>
          </p>
        ) : query.q ? (
          <EmptyState
            className="mt-4"
            title={`No cards in your collection match “${query.q}”`}
            action={
              <Link href={here({ q: "", page: 1 })} className="underline">
                Clear filter
              </Link>
            }
          />
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">No cards to list.</p>
        )}
      </section>
    );
  }

  return (
    <main id="main" className={MAIN_CLASS} data-game={game}>
      <h1 className="type-title">Collection</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Private: only you can see this page.{" "}
        <Link href={IMPORT_HREF} className="underline">
          Update or delete your collection
        </Link>
      </p>
      <nav aria-label="Collection views" className="mt-4 flex flex-wrap gap-1.5">
        <Chip
          render={<Link href={collectionHref()} />}
          aria-current={query.view === "leaders" ? "page" : undefined}
          pressed={query.view === "leaders"}
        >
          {nouns} you own
        </Chip>
        <Chip
          render={<Link href={collectionHref({ view: "cards" })} />}
          aria-current={query.view === "cards" ? "page" : undefined}
          pressed={query.view === "cards"}
        >
          Your cards
        </Chip>
      </nav>
      {body}
    </main>
  );
}
