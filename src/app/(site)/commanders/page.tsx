/**
 * /commanders — the leader index (P2.4): browse commanders by color and
 * popularity. Rows come straight from card data (edhrec_rank order), so the
 * page is honest with zero users. R5a: the color filter is the shared
 * ColorChip (C14), the rows render through LeaderIndexView — the image grid
 * in the server HTML since U7a (WAVE5 F14), the compact list behind the
 * List / Grid toggle persisted under `deckwarden:index-view` — and
 * `data-game="mtg"` gives the chips and frames the Magic accent.
 *
 * Caching intent: force-dynamic — ?colors= / ?match= / ?page= / ?q= (W4,
 * REC-2: a name filter on name_norm over the trgm index, so "browse to
 * choose" works across 4,012 commanders; X2 REC-3: the shared ranked
 * matcher, best match first) drive the query, and one partial-indexed read
 * (ci_leaders, now with the default printing joined) per request is cheap;
 * if this page ever shows up in Neon compute, the upgrade path is ISR per
 * filter combination, not a rethink.
 *
 * Color filter semantics: exact color identity ("Azorius commanders", not
 * "commanders that include W or U") — the way players name the space. That
 * is the default and what every link without `match` means. COLOR-INCLUDES
 * (the owner's note of 2026-11-15) adds a second reading of the same chips,
 * turned on by one toggle chip after them, "Include other colors"
 * (`?match=including`): every commander whose identity holds all the picked
 * colors, alone or with others, in the index's own order. A link like the
 * color chips, no client JavaScript; the reader's mode rides on every link
 * the page builds and in the name form. Colorless is always exact, and the
 * page says so. `src/lib/hub/color-filter.ts` holds the rule, the URL and
 * the words.
 *
 * The filter row's height (the owner's review, "Fix phone height"): the
 * toggle flows in the chips' own wrapping row, so the default page is as
 * tall as it was before the mode wherever the toggle fits on the chips'
 * last line and one row taller where it does not; the line that explains
 * the including reading sits under the whole row and only in that reading.
 */
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { colorChipDef, ColorChipLink } from "@/components/color-chip";
import { EmptyState } from "@/components/empty-state";
import { GameSwitch } from "@/components/game-switch";
import { LeaderIndexView, type IndexLeader } from "@/components/hub/leader-index-view";
import { LeaderPickBanner } from "@/components/hub/leader-pick-banner";
import { NameSuggest } from "@/components/search/name-suggest";
import { Chip } from "@/components/ui/chip";
import { normalizeCardName } from "@/lib/cards/normalize";
import { leaderTileImage } from "@/lib/decks/tiles";
import { COLOR_ORDER } from "@/lib/games/colors";
import {
  COLOR_FILTER_COPY,
  colorFilterEmpty,
  colorFilterLetters,
  colorFilterNote,
  colorFilterQuery,
  MATCH_PARAM,
  otherMatch,
  parseColorFilter,
  toggleColorLetter,
  type ColorMatch,
} from "@/lib/hub/color-filter";
import { LEADERS_PAGE_SIZE, loadLeaderIndex } from "@/lib/hub/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commanders",
  description: "Browse Commander leaders by color identity and popularity.",
  // Filter/page variants (?colors=, ?match=, ?page=) canonicalize to the bare
  // index — hubs are the real landing pages; faceted lists shouldn't split
  // them (P2.6).
  alternates: { canonical: "/commanders" },
};

/** The id that ties the toggle chip to the line under the filters. */
const MATCH_NOTE_ID = "commanders-match-note";

/**
 * The toggle's label keeps one width. A pressed chip is medium weight, which
 * makes these words 3.4 px wider, and where the chips' row is full to within
 * that (every touch screen from 1022 px, measured) pressing the toggle would
 * drop the toggle itself to the next row. So the label always reserves its
 * pressed width: the same words in medium weight, as generated content with
 * no height, never drawn and never read out (the `/ ''` alternative text; the
 * editor header's `data-was` is the precedent), under the visible ones.
 */
const TOGGLE_LABEL =
  "inline-flex flex-col items-center after:invisible after:h-0 after:font-medium after:content-[attr(data-label)_/_'']";

export default async function CommandersPage({ searchParams }: PageProps<"/commanders">) {
  const sp = await searchParams;
  const rawPage = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100 ? rawPage : 1;
  // Name filter (W4, REC-2): normalized in the query itself; qActive gates
  // the filtered empty state, rawQ echoes what the reader typed. The GET
  // form carries no page input — a new filter restarts at page 1.
  const rawQ = typeof sp.q === "string" ? sp.q : "";
  const qActive = normalizeCardName(rawQ) !== "";

  // The color filter (COLOR-INCLUDES): `colors` as it always read ("c" alone
  // is colorless, mask 0; letters are that identity) and `match`, the way to
  // read them: exactly unless it says including.
  const filter = parseColorFilter(sp.colors, sp.match);
  const ciMask = filter.mask;
  const activeLetters = colorFilterLetters(filter);
  const including = filter.match === "including";
  // Every link the page builds goes through here, so each one carries the
  // reader's mode; only the toggle chip names the other.
  const filterHref = (letters: string, toPage = 1, q = "", match: ColorMatch = filter.match) =>
    `/commanders${colorFilterQuery({ letters, match, page: toPage, q })}`;
  // The line under the filters: nothing in the exact reading, as before.
  const matchNote = colorFilterNote(
    filter,
    [...activeLetters].flatMap((c) => colorChipDef("mtg", c)?.name ?? []),
  );

  // The loader gets the reader's mode as chosen; it runs Colorless exactly.
  const leaders = await loadLeaderIndex({ ciMask, ciMatch: filter.match, page, q: rawQ });
  const hasNext = leaders.length === LEADERS_PAGE_SIZE;
  const rows: IndexLeader[] = leaders.flatMap((leader, i) =>
    leader.slug === null
      ? []
      : [
          {
            id: leader.id,
            name: leader.name,
            slug: leader.slug,
            rank: (page - 1) * LEADERS_PAGE_SIZE + i + 1,
            ciMask: leader.ciMask,
            image: leaderTileImage(
              leader.printingId
                ? { id: leader.printingId, imageOverride: leader.imageOverride }
                : null,
            ),
          },
        ],
  );

  return (
    <main id="main" className="max-w-browse mx-auto w-full flex-1 px-4 py-8" data-game="mtg">
      <h1 className="type-title">Commanders</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Ranked by EDHREC decklist popularity via Scryfall: how many published decklists include each
        card, as commander or in the 99, not how often it&apos;s played.
      </p>

      {/* Contextual game switch (R1b, REDESIGN.md §2): the One Piece index is one pill away. */}
      <GameSwitch active="mtg" className="mt-4" />

      {/* Pick banner (W4, D3): null server snapshot — appears after
          hydration only, when this tab is browsing for a saved deck. Sits
          above the whole filter row: it is context for the page, not one
          more filter. */}
      <LeaderPickBanner game="mtg" noun="commander" />

      {/* The name box, then the chips. The row is top-aligned, not centered:
          the chips can wrap to a second row beside the box (the toggle, or a
          color, where the row is too narrow), and a centered row would then
          float the box between them. From `sm` the chips take the rest of
          the box's row and wrap there. With a mouse a chip is 24 px and the
          box 32, so the chips start 4 px lower (`pt-1`), which is where
          `items-center` put a single row of them; on touch both are 44 px. */}
      <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        {/* Name filter (W4, REC-2): a plain GET form — Enter submits; the
            current color selection rides along as a hidden input so q and
            colors combine instead of fighting (and, since COLOR-INCLUDES,
            the including mode beside it). No page input: page resets.
            X2: the box is the predictive island — its server render is the
            same <input name="q"> with the typed value, so the form works
            without JavaScript; a row opens that commander's hub, the last
            row submits the form. Keyed on the server's q so a navigation
            that changes it (Clear filter) resets the box. */}
        <form action="/commanders" method="get" role="search" className="w-full sm:w-56">
          <label htmlFor="commanders-q" className="sr-only">
            Filter by name
          </label>
          <NameSuggest
            key={rawQ}
            id="commanders-q"
            name="q"
            defaultValue={rawQ}
            placeholder="Filter by name…"
            game="mtg"
            scope="leaders"
            rowHref={{ prefix: "/c/", key: "slug" }}
            detail="colors"
            footerNoun="commander"
          />
          {activeLetters && (
            <input type="hidden" name="colors" value={activeLetters.toLowerCase()} />
          )}
          {including && <input type="hidden" name={MATCH_PARAM} value="including" />}
        </form>
        <nav
          aria-label="Color identity filter"
          className="flex min-w-0 flex-wrap gap-1.5 sm:flex-1 sm:pointer-fine:pt-1"
        >
          <Chip
            render={<Link href={filterHref("", 1, rawQ)} />}
            aria-current={ciMask === null ? "page" : undefined}
            pressed={ciMask === null}
          >
            All
          </Chip>
          {COLOR_ORDER.map((c, i) => {
            // Toggle the letter within the current selection (both readings).
            const active = c === "C" ? activeLetters === "C" : activeLetters.includes(c);
            return (
              <ColorChipLink
                key={c}
                game="mtg"
                color={c}
                href={filterHref(toggleColorLetter(activeLetters, c), 1, rawQ)}
                active={active}
                // With a mouse the last color keeps a little air after it, so
                // the toggle that follows on its line does not read as a
                // seventh color. On the chip before, not on the toggle: a
                // toggle that wraps starts flush with the chips above it. Not
                // on touch, where the chips are wider and the row has no
                // pixel to give: at the page's full width the air alone put
                // the toggle on a second row (measured, REDESIGN.md).
                className={i === COLOR_ORDER.length - 1 ? "pointer-fine:mr-1.5" : undefined}
              />
            );
          })}
          {/* How the chips are read (COLOR-INCLUDES): one toggle, a link like
              each color chip, pressed while including is on. It keeps the
              colors and the name and restarts at page 1. Its group draws no
              box (`contents`), so the toggle flows in the chips' own row and
              takes the last line's spare room before it takes a new line. */}
          <div role="group" aria-label={COLOR_FILTER_COPY.matchLabel} className="contents">
            <Chip
              render={<Link href={filterHref(activeLetters, 1, rawQ, otherMatch(filter.match))} />}
              aria-current={including ? "page" : undefined}
              aria-describedby={matchNote ? MATCH_NOTE_ID : undefined}
              pressed={including}
            >
              <span data-label={COLOR_FILTER_COPY.includeOthers} className={TOGGLE_LABEL}>
                {COLOR_FILTER_COPY.includeOthers}
              </span>
            </Chip>
          </div>
        </nav>
      </div>

      {/* What the including reading lists, on its own line under the whole
          filter row: nothing in the exact reading, so that page pays no
          height for it. */}
      {matchNote && (
        <p id={MATCH_NOTE_ID} className="text-muted-foreground mt-2 text-sm">
          {matchNote}
        </p>
      )}

      {rows.length === 0 ? (
        qActive ? (
          <EmptyState
            className="mt-6"
            title={`No commanders match “${rawQ.trim()}”`}
            action={
              <Link href={filterHref(activeLetters)} className="underline">
                Clear filter
              </Link>
            }
          />
        ) : (
          <p className="text-muted-foreground mt-6 text-sm">
            {colorFilterEmpty(filter, page)}{" "}
            <Link href={filterHref(activeLetters)} className="underline">
              Back to page 1
            </Link>
          </p>
        )
      ) : (
        <LeaderIndexView leaders={rows} />
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link href={filterHref(activeLetters, page - 1, rawQ)} className="underline">
            <ArrowLeftIcon aria-hidden className="mr-1 inline size-4 align-[-0.2em]" />
            Previous
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={filterHref(activeLetters, page + 1, rawQ)} className="underline">
            Next
            <ArrowRightIcon aria-hidden className="ml-1 inline size-4 align-[-0.2em]" />
          </Link>
        )}
      </div>

      <p className="text-muted-foreground mt-12 text-xs">
        Card data and images courtesy of{" "}
        <a href="https://scryfall.com" className="underline" rel="noreferrer" target="_blank">
          Scryfall
        </a>
        . Deckwarden is unofficial Fan Content and is not endorsed by Wizards of the Coast.
      </p>
    </main>
  );
}
