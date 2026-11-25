"use client";

/**
 * Client search UI over /api/cards/search. Deliberately minimal for P0.6 —
 * the deck editor (P1.2) gets the full keyboard flow; this proves the API and
 * gives cards a browsable home. Game-scoped since P4.4: /cards passes the
 * game (from ?game=) plus initial filter values (so hub browse links land
 * with filters preset); filter options come from that adapter's searchFields.
 *
 * Per-game wiring the adapter defs force: MTG filters color identity
 * (ci=within:), OP filters printed color (color=within: — OP has no CI
 * concept, punk-map). The color toggles are the shared ColorChip since R5a
 * (C14) — the params and the group labels are unchanged. OP adds sort=name explicitly — the route's default
 * sort is popularity, which is all-NULL for OP and would order arbitrarily;
 * MTG keeps it. The trait typeahead renders only when the page passes
 * `distinctField` (OP traits — 171 values, resolved via /api/cards/options;
 * MTG's keywords field is also distinct-from-db but stays un-surfaced here,
 * a deliberate non-goal of P4.4).
 *
 * R6 (REDESIGN.md §2 "Card search"): the filters stand in labelled groups
 * (`<fieldset>` + `<legend>`: Name · Type · Colors · Traits for One Piece),
 * the selected filters show as a row of chips — each a button that removes
 * that one filter — with a Clear all, and the first response in flight
 * paints a skeleton grid of the same columns and card aspect instead of a
 * bare "Loading…" line (Load more keeps its own loading label). The URL
 * params, the API calls, the `ColorChipButton`s and the `autoFocus` are
 * unchanged — a page whose purpose is search focuses its box (phone
 * browsers do not raise the keyboard for `autofocus` without a gesture).
 *
 * X2 (WAVE3.md D2): the Name box is the predictive island, still controlled
 * by `q` (so the chips, Clear all and the grid read the same text), its
 * input now a `combobox` named "Card name". A row opens the card page — for
 * leaders too; the card page links the hub — and a pick never rewrites `q`,
 * so the grid is not re-run on the way out. The grid itself keeps updating
 * as you type; with a name it asks for `sort=best` (REC-2), the dropdown's
 * order, so the first tile is the first suggestion. Enter does nothing new:
 * there is no form, and the grid is already live.
 *
 * X4a (WAVE3.md D4 + the owner's answers of 2026-09-28): a Set group, only
 * when the game's adapter declares a `"set"` field (Magic; its one
 * declaration is the rollback). Its box is the SetPicker over GET
 * /api/sets — fetched the first time the picker opens, or at mount when
 * the page arrived with `?set=` (the chip and the header need the name);
 * otherwise mount still costs exactly one request. A chosen set:
 * - joins the requests as `set=<code>` (after the other filters, before
 *   `sort`); with no name the grid asks for `sort=number` — collector-number
 *   order — and with a name keeps `sort=best`, the dropdown's order;
 * - shows as a chip ("Set: Eldritch Moon (EMN)", the code alone until the
 *   list has named it) that × clears, like Clear all;
 * - heads the results with its place in its line ("Eldritch Moon — the 71st
 *   expansion set"), then — while no name is typed — "Most popular in
 *   Eldritch Moon": the 12 best EDHREC-ranked cards (a second request,
 *   `sort=pop&limit=12`, unranked cards dropped, hidden when the whole list
 *   fits in 12), then the full list;
 * - makes every tile show and link its printing in the set:
 *   `/cards/<id>?printing=<printingId>` (the card page restores it after
 *   hydration).
 * The Name box's dropdown stays unscoped while a set scopes the grid — a
 * suggestion is "go to this card" (LATER row 124). Filters are still read
 * once at load and never written back to the URL.
 *
 * SEARCH-EXAMPLES (DESIGN-REFERENCES-session-prompt.md build 3): under the
 * filters, one sentence of real searches at the meta step, "Try Atraxa,
 * Edgar Markov or Sol Ring." (One Piece: "Try OP01-001."), the page's
 * examples for this game. Each is a link to `/cards?q=…`, which the page
 * mounts as a fresh search. The line shows only while no name is typed and
 * no set scopes the grid, and leaves for good at the first typed character
 * or chosen set: clearing the box never brings it back, so it never
 * flashes while a name is edited. On touch each link is a 44 px target
 * whose margins give the extra back, so the line keeps its height.
 *
 * COMMANDER-DOOR (the owner's idea 4 of 2026-11-24): a tile whose card can
 * lead a deck and is legal in the format a new deck opens in gets one link
 * under its image, "Build with <card name>" (One Piece: with the card
 * number, "Build with Monkey.D.Luffy (OP01-003)", because its leaders share
 * names), to a new deck with that card in place. The rule is
 * src/lib/decks/leader-build.ts's, read off each row's `legality`, so the
 * grid's request, and only it, carries `format=<code>` after its other
 * params. Caching intent of that fetch: the route's header is unchanged
 * (`s-maxage=300, stale-while-revalidate=3600`); the address is a new CDN
 * key, which starts cold; and an uncached page that has rows costs one
 * more statement (the legality read, about a quarter of a millisecond in
 * the database for 60 ids). So a new ban reaches the grid within about an
 * hour, and the editor flags a banned leader at once. The strip's request
 * and tiles are as they were: without `format` every row answers
 * `legality: []`, which the rule would read as legal, so the strip is never
 * drawn through the grid's tile and gets no links (LATER.md has the row).
 * No links while a commander pick is pending for this game
 * (src/lib/decks/leader-pick-intent.ts): a link would open a new deck
 * while the banner says the player is choosing for a saved one. The link
 * is a block of its own under the image, never over it: on touch a 44 px
 * target with no negative margin (a tap on the image's bottom edge still
 * opens the card), its words in a span that wraps and breaks a long word.
 * Tab order is image, build, next image: up to 120 stops on a page of 60
 * commanders. "Load more" pages and set-scoped tiles behave the same.
 */
import { XIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import { PRINTING_PARAM } from "@/app/(site)/cards/[id]/printing-param";
import { CardImage } from "@/components/cards/card-image";
import { SetPicker } from "@/components/cards/set-picker";
import { ColorChipButton, colorChipDef, colorChipDefs } from "@/components/color-chip";
import { NameSuggest } from "@/components/search/name-suggest";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CardWire } from "@/lib/decks/editor-state";
import { leaderCanBuild, leaderFormat, unconditionalStatus } from "@/lib/decks/leader-build";
import { leaderBuildHref, leaderBuildWords } from "@/lib/decks/leader-build-link";
import { usePickIntent } from "@/lib/decks/leader-pick-intent";
import { getAdapter } from "@/lib/games/registry";
import type { SearchExample } from "@/lib/search/examples";
import { setFieldKey, setPlace, type ReleasedSet } from "@/lib/sets/lines";
import { eventDateLabel } from "@/lib/tournaments/format";

const PAGE_SIZE = 60;
/** Two rows of the widest grid (5 columns) while the first page loads. */
export const SKELETON_CARDS = 10;
/** "Most popular in {set}": the owner's 12 (2026-09-28; worded by Y1). */
export const MOST_PLAYED = 12;

const GRID_CLASS = "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
const LEGEND_CLASS = "text-muted-foreground mb-1 text-xs font-medium";
/**
 * The page's 36 px field look, shared by the name box and the Set picker
 * (unstyled Autocomplete inputs) and the Type select: ui/input.tsx's recipe
 * at `h-9` — the edge token, the dark fill, 16 px text on phones (U10a,
 * WAVE5.md D10; the Traits box is an `<Input>` at the same height).
 */
const FIELD_CLASS =
  "h-9 rounded-lg border border-(--border-control) bg-transparent px-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 pointer-coarse:min-h-11";
/**
 * An example's link (SEARCH-EXAMPLES): foreground ink on the muted line. On
 * touch the box is 44 px and its margins give back the 28 px past the
 * meta step's 16 px line (the bracket line's recipe), so the target grows
 * and the line doesn't.
 */
const EXAMPLE_LINK_CLASS =
  "text-foreground focus-visible:ring-ring/50 rounded-sm font-medium underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-2 pointer-coarse:-my-[14px] pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center";

/**
 * A tile's build link (COMMANDER-DOOR): the start doors' recipe
 * (new-deck-chooser.tsx) as a block. On touch it is a 44 px target with no
 * negative margin, so it never lies over the card's own link or the next
 * row; the 2 px above it there keep its focus ring, and the image's, off
 * each other.
 */
const TILE_BUILD_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-1.5 block rounded-sm text-sm leading-snug underline underline-offset-4 outline-none focus-visible:ring-2 pointer-coarse:mt-0.5 pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center";

/**
 * "Build with <card name>" under a results tile: the whole sentence, shown
 * and wrapped (the owner's choice of 2026-11-25 over a bare "Build"). The
 * words have a span of their own so that on touch (a flex box) a long word
 * breaks instead of setting the link's width.
 */
function TileBuildLink({ href, words }: { href: string; words: string }) {
  return (
    // No prefetch: a page holds up to 60 of these, and one is followed.
    <Link href={href} prefetch={false} data-slot="tile-build" className={TILE_BUILD_CLASS}>
      <span className="min-w-0 wrap-break-word">{words}</span>
    </Link>
  );
}

/**
 * A results row: the search route's card (the editor's `CardWire`, which
 * the adapter's `idBadge` takes whole), plus the printing in the chosen set
 * on a set-scoped answer (X4a).
 */
type SearchResult = CardWire & { printingId?: string };

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

/** The card page, on the tile's printing when the answer was set-scoped (X4a). */
function tileHref(card: SearchResult): string {
  return card.printingId
    ? `/cards/${card.id}?${PRINTING_PARAM}=${card.printingId}`
    : `/cards/${card.id}`;
}

function typeOptions(game: "mtg" | "optcg"): { value: string; label: string }[] {
  const field = getAdapter(game).searchFields.find((f) => f.key === "type");
  if (field?.kind === "multiselect" && Array.isArray(field.options)) return field.options;
  return [];
}

export interface CardSearchProps {
  game: "mtg" | "optcg";
  initialName?: string;
  initialType?: string;
  /** Colorset value ("within:RU" or bare letters) — hub links preset this. */
  initialColors?: string;
  /** Key of a distinct-from-db multiselect to expose as a typeahead (OP traits). */
  distinctField?: string;
  initialDistinct?: string;
  /** X4a: a set code (`?set=`), honored only when the game declares a set field. */
  initialSet?: string;
  /** SEARCH-EXAMPLES: this game's "Try" searches for the day, the page's. */
  examples?: readonly SearchExample[];
}

/**
 * "Atraxa, Edgar Markov or Sol Ring": the examples as one phrase of links.
 * Each is named for what it does ("Search for Sol Ring", the words inside
 * the name): the grid's first tile is often the same card by the same
 * name, and a list of links must tell the search from the card page.
 */
function ExampleLinks({ examples }: { examples: readonly SearchExample[] }) {
  return examples.map((example, i) => (
    <Fragment key={example.href}>
      {i > 0 && (i === examples.length - 1 ? " or " : ", ")}
      <Link
        href={example.href}
        prefetch={false}
        aria-label={`Search for ${example.text}`}
        className={EXAMPLE_LINK_CLASS}
      >
        {example.text}
      </Link>
    </Fragment>
  ));
}

/** One selected filter as the chip row shows it: the group's word and the value. */
interface ActiveFilter {
  key: string;
  group: string;
  value: string;
  clear: () => void;
}

export function CardSearch({
  game,
  initialName = "",
  initialType = "",
  initialColors = "",
  distinctField,
  initialDistinct = "",
  initialSet = "",
  examples = [],
}: CardSearchProps) {
  const [q, setQ] = useState(initialName);
  const [type, setType] = useState(initialType);
  const [colors, setColors] = useState<string[]>(() => {
    // Accept both "within:RU" (hub links) and bare "RU".
    const letters = initialColors.includes(":") ? initialColors.split(":", 2)[1] : initialColors;
    const known = colorChipDefs(game).map((c) => c.key);
    return [
      ...new Set(
        letters
          .toUpperCase()
          .split("")
          .filter((c) => known.includes(c)),
      ),
    ];
  });
  const [distinct, setDistinct] = useState(initialDistinct);
  const [distinctOptions, setDistinctOptions] = useState<string[]>([]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // X4a: the set scope — only for a game whose adapter declares the field.
  const setField = setFieldKey(getAdapter(game).searchFields);
  const [setCode, setSetCode] = useState(() => (setField ? initialSet.trim().toLowerCase() : ""));
  /** The list is wanted once the picker opens, or at mount for a preset set. */
  const [wantSets, setWantSets] = useState(() => setField !== null && setCode !== "");
  const [setsAttempt, setSetsAttempt] = useState(0);
  const [sets, setSets] = useState<ReleasedSet[] | null>(null);
  const [setsFailed, setSetsFailed] = useState(false);
  /** "Most popular in {set}", with the set and the total it was asked for. */
  const [strip, setStrip] = useState<{ code: string; rows: SearchResult[]; total: number } | null>(
    null,
  );
  const stripAbortRef = useRef<AbortController | null>(null);
  const chosenSet = setCode ? (sets?.find((set) => set.code === setCode) ?? null) : null;
  const scoped = setField !== null && setCode !== "";
  /** SEARCH-EXAMPLES: gone at the first typed name or chosen set, and for good. */
  const [examplesGone, setExamplesGone] = useState(() => initialName.trim() !== "" || scoped);

  const colorParam = game === "mtg" ? "ci" : "color";

  // COMMANDER-DOOR: the format the build rule reads (a new deck's; both
  // games have one, which leader-build.test.ts pins for every adapter), and
  // the pending pick that silences the links for this game.
  const adapter = getAdapter(game);
  const buildFormat = leaderFormat(game);
  const pick = usePickIntent(game);
  /** The words of a tile's build link, or null when its card gets none. */
  const buildWords = (card: SearchResult): string | null =>
    pick === null && leaderCanBuild(card.isLeaderCandidate, unconditionalStatus(card.legality))
      ? leaderBuildWords(card.name, adapter.display.idBadge?.(card) ?? null)
      : null;

  /** The grid's request — or, with `mostPlayed`, the set's "Most popular" strip. */
  const buildUrl = (offset: number, mostPlayed = false) => {
    const params = new URLSearchParams({
      game,
      limit: String(mostPlayed ? MOST_PLAYED : PAGE_SIZE),
    });
    if (q.trim() && !mostPlayed) params.set("name", q.trim());
    if (type) params.set("type", type);
    if (colors.length) params.set(colorParam, `within:${colors.join("")}`);
    if (distinctField && distinct.trim()) params.set(distinctField, distinct.trim());
    if (setField && scoped) params.set(setField, setCode);
    // With a name: the ranked matcher's order (X2, REC-2), both games. Without
    // one the route's default sort is popularity — NULL for every OP row (P4.1
    // measured 0/2,785), which orders arbitrarily. Name is the honest OP
    // default; Magic keeps popularity. X4a: a set with no name lists in
    // collector-number order, and its strip asks for popularity outright.
    if (mostPlayed) params.set("sort", "pop");
    else if (q.trim()) params.set("sort", "best");
    else if (scoped) params.set("sort", "number");
    else if (game === "optcg") params.set("sort", "name");
    if (offset) params.set("offset", String(offset));
    // COMMANDER-DOOR: the grid's rows carry their ruling in the new-deck
    // format. Last, and never on the strip's request (the docblock).
    if (!mostPlayed && buildFormat) params.set("format", buildFormat.code);
    return `/api/cards/search?${params}`;
  };

  const load = async (offset: number, append: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(offset), { signal: controller.signal });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const json: SearchResponse = await res.json();
      offsetRef.current = offset;
      setData(json);
      setResults((prev) => (append ? [...prev, ...json.results] : json.results));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  // X4a: the strip rides the grid's debounce — asked for only with a set and
  // no name. Unranked cards are dropped: "most popular" needs a rank to say so.
  const loadStrip = async () => {
    stripAbortRef.current?.abort();
    stripAbortRef.current = null;
    if (!scoped || q.trim()) {
      setStrip(null);
      return;
    }
    const controller = new AbortController();
    stripAbortRef.current = controller;
    try {
      const res = await fetch(buildUrl(0, true), { signal: controller.signal });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const json: SearchResponse = await res.json();
      const rows = json.results.filter((card) => card.popularity != null);
      setStrip({ code: setCode, rows, total: json.total });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setStrip(null);
    }
  };

  // Debounced re-search whenever any filter changes.
  useEffect(() => {
    const t = setTimeout(() => {
      void load(0, false);
      void loadStrip();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, colors.join(""), distinct, setCode]);

  // X4a: the released-set list, once — on the picker's first open, or at
  // mount for a preset `?set=`. A failure retries on the picker's next open.
  useEffect(() => {
    if (!wantSets || sets) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/sets?game=${game}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Sets failed (${res.status})`);
        const json = (await res.json()) as { sets: ReleasedSet[] };
        setSets(json.sets);
        setSetsFailed(false);
      } catch {
        if (!controller.signal.aborted) setSetsFailed(true);
      }
    })();
    return () => controller.abort();
  }, [game, wantSets, sets, setsAttempt]);

  const wantSetList = () => {
    setWantSets(true);
    if (setsFailed) {
      setSetsFailed(false);
      setSetsAttempt((n) => n + 1);
    }
  };

  // Distinct options (traits) load once per mount — they change only at ingest.
  useEffect(() => {
    if (!distinctField) return;
    const controller = new AbortController();
    fetch(`/api/cards/options?game=${game}&field=${distinctField}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { options: [] }))
      .then((json: { options?: string[] }) => setDistinctOptions(json.options ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [game, distinctField]);

  const toggleColor = (c: string) =>
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const types = typeOptions(game);
  const active: ActiveFilter[] = [
    ...(q.trim() ? [{ key: "name", group: "Name", value: q.trim(), clear: () => setQ("") }] : []),
    ...(type
      ? [
          {
            key: "type",
            group: "Type",
            value: types.find((o) => o.value === type)?.label ?? type,
            clear: () => setType(""),
          },
        ]
      : []),
    ...colors.map((c) => ({
      key: `color-${c}`,
      group: "Color",
      value: colorChipDef(game, c)?.name ?? c,
      clear: () => toggleColor(c),
    })),
    ...(distinctField && distinct.trim()
      ? [{ key: "trait", group: "Trait", value: distinct.trim(), clear: () => setDistinct("") }]
      : []),
    ...(scoped
      ? [
          {
            key: "set",
            group: "Set",
            value: chosenSet
              ? `${chosenSet.name} (${setCode.toUpperCase()})`
              : setCode.toUpperCase(),
            clear: () => setSetCode(""),
          },
        ]
      : []),
  ];
  const clearAll = () => {
    setQ("");
    setType("");
    setColors([]);
    setDistinct("");
    setSetCode("");
  };
  /** The set view: a set chosen and no name typed (the strip and the collector order). */
  const setView = scoped && !q.trim();
  const showStrip =
    setView &&
    strip !== null &&
    strip.code === setCode &&
    strip.rows.length > 0 &&
    strip.total > MOST_PLAYED;
  const otherFilters = type !== "" || colors.length > 0 || (!!distinctField && !!distinct.trim());

  // The skeleton stands in for the FIRST page only: nothing has ever
  // rendered, so the grid's shape is all there is to show. A later
  // re-search keeps the previous results under the live line's count, and
  // Load more keeps its own "Loading…" label.
  const firstLoad = data === null && !error;

  return (
    <div className="mt-6">
      <div data-slot="filter-groups" className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <fieldset className="min-w-0 flex-1 basis-56">
          <legend className={LEGEND_CLASS}>Name</legend>
          <NameSuggest
            game={game}
            scope="cards"
            rowHref={{ prefix: "/cards/", key: "id" }}
            detail={game === "mtg" ? "type" : "number"}
            value={q}
            onValueChange={(next) => {
              setQ(next);
              if (next.trim()) setExamplesGone(true);
            }}
            placeholder="Search card names…"
            aria-label="Card name"
            autoFocus
            inputClassName={`${FIELD_CLASS} w-full max-w-sm`}
          />
        </fieldset>
        <fieldset className="min-w-0">
          <legend className={LEGEND_CLASS}>Type</legend>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Card type"
            className={`${FIELD_CLASS} px-2`}
          >
            <option value="">Any type</option>
            {types.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset className="min-w-0">
          {/* Magic filters color IDENTITY (ci=within:), One Piece the printed color. */}
          <legend className={LEGEND_CLASS}>{game === "mtg" ? "Color identity" : "Colors"}</legend>
          <div className="flex flex-wrap gap-1">
            {/* R5a (C14): the shared ColorChip — Magic pips keep the compact letter look with the
                color's name for screen readers; One Piece shows the names as before. */}
            {colorChipDefs(game).map((def) => (
              <ColorChipButton
                key={def.key}
                game={game}
                color={def.key}
                pressed={colors.includes(def.key)}
                onClick={() => toggleColor(def.key)}
                showLabel={game === "optcg"}
              />
            ))}
          </div>
        </fieldset>
        {distinctField && (
          <fieldset className="min-w-0">
            <legend className={LEGEND_CLASS}>Traits</legend>
            <Input
              type="text"
              value={distinct}
              onChange={(e) => setDistinct(e.target.value)}
              placeholder="e.g. Straw Hat Crew"
              aria-label="Trait"
              list="card-search-distinct-options"
              className="h-9 max-w-52 px-3"
            />
            <datalist id="card-search-distinct-options">
              {distinctOptions.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </fieldset>
        )}
        {setField && (
          <fieldset className="min-w-0 flex-1 basis-56">
            <legend className={LEGEND_CLASS}>Set</legend>
            <SetPicker
              sets={sets}
              failed={setsFailed}
              chosen={chosenSet}
              onWantSets={wantSetList}
              onPick={(set) => {
                setSetCode(set.code);
                setExamplesGone(true);
              }}
              inputClassName={`${FIELD_CLASS} w-full max-w-sm`}
            />
          </fieldset>
        )}
      </div>

      {examples.length > 0 && !examplesGone && !q.trim() && !scoped && (
        // On touch the margin matches the links' 14 px reach, so no target overlaps the filters.
        <p
          data-slot="search-examples"
          className="type-meta text-muted-foreground mt-3 pointer-coarse:mt-3.5"
        >
          Try <ExampleLinks examples={examples} />.
        </p>
      )}

      {active.length > 0 && (
        <div data-slot="active-filters" className="mt-3 flex flex-wrap items-center gap-1.5">
          <ul aria-label="Active filters" className="contents">
            {active.map((f) => (
              <li key={f.key}>
                <Chip
                  render={<button type="button" />}
                  variant="muted"
                  size="sm"
                  aria-label={`Remove filter: ${f.group} ${f.value}`}
                  onClick={f.clear}
                >
                  <span className="text-muted-foreground">{f.group}:</span> {f.value}
                  <XIcon aria-hidden />
                </Chip>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="xs" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      )}

      {scoped && (chosenSet || sets) && (
        <div data-slot="set-header" className="mt-6">
          {chosenSet ? (
            <>
              <h2 className="type-section">
                {chosenSet.name}{" "}
                <span className="text-muted-foreground font-normal">({setPlace(chosenSet)})</span>
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {setCode.toUpperCase()} · Released {eventDateLabel(chosenSet.releasedAt)}
              </p>
            </>
          ) : (
            <p className="text-sm">No released set has the code “{setCode.toUpperCase()}”.</p>
          )}
        </div>
      )}

      {showStrip && strip && (
        <section aria-labelledby="most-played-heading" data-slot="most-played" className="mt-6">
          <h3 id="most-played-heading" className="type-section">
            Most popular in {chosenSet?.name ?? setCode.toUpperCase()}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Ranked by EDHREC decklist popularity via Scryfall.
          </p>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {strip.rows.map((card) => (
              <li key={card.id}>
                <Link
                  href={tileHref(card)}
                  className="focus-visible:ring-accent-game block rounded-[4.75%/3.5%] outline-none focus-visible:ring-2"
                >
                  <CardImage src={card.image} alt={card.name} width={488} height={680} frame />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-muted-foreground mt-3 text-sm" aria-live="polite">
        {error
          ? `Error: ${error}`
          : data
            ? setView && data.total > 0
              ? `${otherFilters ? "" : "All "}${data.total.toLocaleString()} card${data.total === 1 ? "" : "s"}, in collector-number order`
              : `${data.total.toLocaleString()} card${data.total === 1 ? "" : "s"}`
            : "Loading…"}
      </p>

      {firstLoad ? (
        <ul aria-hidden data-slot="results-skeleton" className={GRID_CLASS}>
          {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <li key={i}>
              <Skeleton
                className="w-full rounded-[4.75%/3.5%]"
                style={{ aspectRatio: "488 / 680" }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={GRID_CLASS} aria-busy={loading || undefined}>
          {results.map((card) => {
            const words = buildWords(card);
            return (
              <li key={card.id}>
                <Link
                  href={tileHref(card)}
                  className="focus-visible:ring-accent-game block rounded-[4.75%/3.5%] outline-none focus-visible:ring-2"
                >
                  <CardImage src={card.image} alt={card.name} width={488} height={680} frame />
                </Link>
                {words !== null && (
                  <TileBuildLink href={leaderBuildHref(game, card.externalKey)} words={words} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && results.length < data.total && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load(offsetRef.current + PAGE_SIZE, true)}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
