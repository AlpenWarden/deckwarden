"use client";

/**
 * NameSuggest (X2, WAVE3.md D2): the predictive name box — the input and its
 * dropdown over GET /api/cards/suggest. One island, three boxes: the
 * /commanders and /leaders GET forms (uncontrolled, `name="q"`, a footer row
 * that submits the form) and the /cards Name box (controlled by its grid's
 * `q`, no form, no footer).
 *
 * It owns the three things D2 gives it: the 150 ms debounce, the abort of a
 * stale request, and the request key — `nameKey(text)`, THE normalizer's
 * output, so "Sol", "sol" and "sol " are one request and one edge-cache key,
 * and one normalized letter sends nothing. A request goes out only once the
 * box has asked to open (the reader typed), so a page that lands with `?q=`
 * filled in costs no suggest call.
 *
 * D0's popup rules, and how each is met:
 * - Opens at two characters: the popup is controlled — Base UI asks to open
 *   on any typed character, and `open` also needs NAME_MIN_CHARS and an
 *   answer to show.
 * - At most 8 rows (the route's limit), 44 px on coarse pointers, as wide as
 *   the input and never under 18 rem (ui/autocomplete.tsx).
 * - While a request is in flight the previous rows stay; the rows reset only
 *   when the text drops below two characters, so a new query never flashes
 *   an old one's rows.
 * - "No matches" is one quiet line; a failed request closes the popup and
 *   the box keeps working (the form, the grid).
 * - Nothing is highlighted until an arrow key: `highlightItemOnHover` is off
 *   (hover is CSS only), so a resting pointer never arms Enter. Enter with no
 *   highlight closes the popup and does what the box did before — Base UI
 *   leaves the keydown alone, so the browser submits the form (or, on
 *   /cards, nothing happens). Esc closes and keeps the text (Base UI
 *   prevents the default, so a search input's native Esc-clear does not
 *   run); a second Esc, with the popup shut, clears the box as it always did.
 * - A `role="status"` line, mounted outside the popup, announces the count.
 * - Leaving the box before the first answer lands withdraws the request to
 *   open (Base UI dismisses on focus-out only once the popup is open), so a
 *   late answer never pops a list up beside a box nobody is in.
 *
 * Inside a form (`name` set) the island also renders an invisible default
 * submit button: Base UI's Root adds a second, unnamed text input, and HTML
 * implicit submission ignores Enter in a form with two text fields and no
 * submit button — with or without script (measured in the pane).
 *
 * A pick navigates: every row is a `Link` (no prefetch — rows churn while
 * typing), and Base UI lets a link row follow its href without writing the
 * row's text into the box (verified in jsdom). So a pick never rewrites `q`
 * — on /cards the grid is not re-run on the way out. The footer row is the
 * one non-link row; its value stringifies to the current text, so Base UI's
 * fill-on-press is a no-op, and its click submits the owning form.
 *
 * X5's pick mode: with `onPick` in place of `rowHref`, rows are plain
 * options and a pick (click, or Enter on a highlighted row) hands the row
 * to the caller and writes its name into the box — the change-picture
 * dialog's card box, which chooses a card instead of leaving the page.
 *
 * `mode="none"`: the server ranked and filtered; Base UI neither re-filters
 * (its default `contains` filter drops Urza's Saga for "urzas saga") nor
 * re-orders.
 *
 * HEADER-SEARCH's two opt-in props, for the site header's box (which reads
 * its game off the open page, so its game can change while it is mounted):
 * - `fallback`: when `game` answers no rows for a key, the other game is
 *   asked once — one extra request, and only on a miss — and its rows show
 *   under one quiet line that names both games ("No Magic cards match. 3
 *   One Piece cards."), the status line saying the same. A
 *   failed second request leaves the first game's honest "No matches".
 * - `onAnswer`: every answer that lands, with its key and the game whose
 *   rows it shows, so the caller's form can follow the game that answered.
 * An answer is kept per key AND per game asked, so a box whose game changes
 * asks again for the same text. Without these props (every other caller,
 * whose game never changes while mounted) nothing differs: the same one
 * request per key, the same rows, words and timing.
 *
 * SEARCH-EXAMPLES' opt-in `examples` (the header's box again): an empty
 * state. Focus with fewer than NAME_MIN_CHARS characters, and the popup
 * offers the examples under a quiet "Try" line: options like the rows
 * (arrow keys, Enter, 44 px on coarse pointers), each a link to its /cards
 * search, a search icon where a row's thumbnail sits and the caller's
 * detail (the game) where its type line sits. They stand while the text is
 * too short to ask and while the first ask for a longer text is in flight,
 * so the popup never shuts and reopens between examples and rows. A focus
 * on a box that already holds a name changes nothing (no request, no
 * popup) until a key is typed, as before.
 *
 * COMMANDER-DOOR's opt-in `buildEntry` (the header's box once more): when
 * the top row is a leader candidate that the answer does not mark
 * `buildBlocked` (a banned or not-legal commander carries that member, see
 * src/lib/search/suggest.ts), one more entry sits directly under it, "Build
 * with <card name>", a link to a new deck with that card in place. It is an
 * option like the rows (arrow keys, Enter, 44 px on coarse pointers, its
 * words its accessible name), with a hammer where a thumbnail sits, and its
 * words wrap, so a long name is never cut off. Only the top row gets one
 * (LATER row 506). The prop names the games that may get an entry and, per
 * game, whether the words carry the row's printed id ("Build with
 * Monkey.D.Luffy (OP01-003)": One Piece's leaders share names); the box
 * reads it for the game whose rows show, so after a fallback the other
 * game's entry is that game's. Never among the examples, never in pick
 * mode. The status line counts rows only, as with the footer. So the popup
 * now holds up to 8 rows, this entry and the footer, which amends D0's "at
 * most 8 rows". The highlight is a position in the list, and an answer that
 * lands does not clear it (Base UI offers no way to), so an answer landing
 * under a highlight on the second position puts this entry under it
 * (LATER.md has the row). Without the prop (the five other boxes) nothing
 * differs.
 */
import { HammerIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { CardImage } from "@/components/cards/card-image";
import { ColorChipList } from "@/components/color-chip";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus,
} from "@/components/ui/autocomplete";
import { leaderBuildHref, leaderBuildWords } from "@/lib/decks/leader-build-link";
import { NAME_MIN_CHARS, nameKey } from "@/lib/search/name-key";
import type { SuggestGame, SuggestResponse, SuggestRow } from "@/lib/search/suggest";
import { cn } from "@/lib/utils";

export const SUGGEST_DEBOUNCE_MS = 150;

const FOOTER = { footer: true } as const;

/** SEARCH-EXAMPLES: one offered search — its words, its link, its quiet detail. */
export interface NameExample {
  text: string;
  href: string;
  detail: string;
}

type ExampleEntry = NameExample & { example: true };

/** COMMANDER-DOOR: the entry under a top row that can lead a new deck. */
interface BuildEntry {
  build: true;
  /** The top row's id, for a key of the entry's own beside the row's. */
  id: string;
  href: string;
  words: string;
}

type Entry = SuggestRow | typeof FOOTER | ExampleEntry | BuildEntry;

export interface NameSuggestProps {
  game: "mtg" | "optcg";
  /** "leaders": leader candidates with a hub (the index boxes); "cards": every card. */
  scope: "cards" | "leaders";
  /** Where a row goes: `prefix` + the row's slug or id ("/c/" + slug, "/cards/" + id). */
  rowHref?: { prefix: string; key: "slug" | "id" };
  /** Pick mode (X5): a row is chosen, not followed. Takes the place of `rowHref`. */
  onPick?: (row: SuggestRow) => void;
  /** The row's one quiet detail: color chips, the type line, or the card number. */
  detail: "colors" | "type" | "number";
  /** The input's form name (the GET forms: "q"). */
  name?: string;
  id?: string;
  /** Uncontrolled initial text (the forms echo the server's `?q=`). */
  defaultValue?: string;
  /** Controlled text (/cards: the grid's `q`). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** "Show every <noun> matching “…”" — a last row that submits the owning form. */
  footerNoun?: string;
  placeholder?: string;
  autoFocus?: boolean;
  type?: "search" | "text";
  /** Replaces the input's look (ui/autocomplete.tsx `unstyled`); omitted = the shadcn Input look. */
  inputClassName?: string;
  "aria-label"?: string;
  /**
   * HEADER-SEARCH: the game to ask, once, when `game` has no rows for a key,
   * and the names the line above its rows uses (the header's short names).
   */
  fallback?: { game: SuggestGame; names: Record<SuggestGame, string> };
  /** HEADER-SEARCH: each answer that lands — its key, and the game whose rows it shows. */
  onAnswer?: (answer: { key: string; game: SuggestGame }) => void;
  /**
   * SEARCH-EXAMPLES: searches offered while the box is focused with fewer
   * than NAME_MIN_CHARS characters. Undefined (every box but the header's):
   * no empty state. Empty: none yet, nothing shows until they arrive.
   */
  examples?: readonly NameExample[];
  /**
   * COMMANDER-DOOR: the games whose top row may get a "Build with <card
   * name>" entry under it, each with whether the words carry the row's
   * printed id. Read for the game whose rows show. Undefined, or a game left
   * out: no entry for it.
   */
  buildEntry?: Partial<Record<SuggestGame, { withKey: boolean }>>;
}

/** The line over the other game's rows, and the status line's words for them. */
function fallbackLine(
  names: Record<SuggestGame, string>,
  asked: SuggestGame,
  shown: SuggestGame,
  count: number,
): string {
  return `No ${names[asked]} cards match. ${count} ${names[shown]} card${count === 1 ? "" : "s"}.`;
}

function rowHref(row: SuggestRow, target: NameSuggestProps["rowHref"]): string | null {
  if (!target) return null;
  const key = target.key === "slug" ? row.slug : row.id;
  return key ? `${target.prefix}${encodeURIComponent(key)}` : null;
}

export function NameSuggest({
  game,
  scope,
  rowHref: target,
  onPick,
  detail,
  name,
  id,
  defaultValue,
  value,
  onValueChange,
  footerNoun,
  placeholder,
  autoFocus,
  type = "search",
  inputClassName,
  "aria-label": ariaLabel,
  fallback,
  onAnswer,
  examples,
  buildEntry,
}: NameSuggestProps) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const text = value ?? inner;
  const key = nameKey(text);
  const active = key.length >= NAME_MIN_CHARS;

  /** The reader's intent, from Base UI's open requests (typing, Esc, outside press…). */
  const [want, setWant] = useState(false);
  /**
   * The latest answer: the key and the game it was asked of, and the game
   * whose rows it holds — `fallback.game` after a miss, else the same one.
   */
  const [answer, setAnswer] = useState<{
    key: string;
    asked: SuggestGame;
    game: SuggestGame;
    rows: SuggestRow[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const landed = useEffectEvent((answered: { key: string; game: SuggestGame }) => {
    onAnswer?.(answered);
  });

  const answerKey = answer?.key ?? null;
  const answerAsked = answer?.asked ?? null;
  const fallbackGame = fallback?.game;
  useEffect(() => {
    if (!want || key.length < NAME_MIN_CHARS || (key === answerKey && game === answerAsked)) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ game, scope, q: key });
        const res = await fetch(`/api/cards/suggest?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Suggest failed (${res.status})`);
        const json = (await res.json()) as SuggestResponse;
        if (controller.signal.aborted) return;
        let rows = json.results;
        let shown = game;
        if (rows.length === 0 && fallbackGame !== undefined && fallbackGame !== game) {
          // HEADER-SEARCH: a miss asks the other game once. Its failure is
          // not the box's: the first game's empty answer still stands.
          try {
            const other = new URLSearchParams({ game: fallbackGame, scope, q: key });
            const more = await fetch(`/api/cards/suggest?${other}`, {
              signal: controller.signal,
            });
            if (!more.ok) throw new Error(`Suggest failed (${more.status})`);
            const found = ((await more.json()) as SuggestResponse).results;
            if (found.length > 0) {
              rows = found;
              shown = fallbackGame;
            }
          } catch {
            // Aborted (dropped below) or failed (the miss stands).
          }
          if (controller.signal.aborted) return;
        }
        setAnswer({ key, asked: game, game: shown, rows });
        setFailed(false);
        landed({ key, game: shown });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [want, key, answerKey, answerAsked, game, scope, fallbackGame]);

  const rows = (answer?.rows ?? []).filter((row) => onPick || rowHref(row, target) !== null);
  const exampleEntries = useMemo(
    () => (examples ?? []).map((example): ExampleEntry => ({ ...example, example: true })),
    [examples],
  );
  // The examples stand until the first answer for a long enough text lands.
  const showExamples = exampleEntries.length > 0 && (!active || (answer === null && !failed));
  const open = want && (showExamples || (active && answer !== null && !failed));
  /** The game whose rows show (the other game's after a fallback). */
  const rowGame = answer?.game ?? game;
  // COMMANDER-DOOR: the top row's build entry. The top row is read off the
  // answer itself (the first row with a place to go, which is `rows[0]`),
  // and the entry is memoized on that row's own text and the option, so the
  // list's items keep their identity between renders.
  const withKey = onPick ? undefined : buildEntry?.[rowGame]?.withKey;
  const top =
    withKey === undefined ? undefined : answer?.rows.find((row) => rowHref(row, target) !== null);
  const topId = top !== undefined && top.isLeader && !top.buildBlocked ? top.id : null;
  const topName = top?.name ?? "";
  const topKey = top?.externalKey ?? "";
  const build = useMemo<BuildEntry | null>(
    () =>
      topId === null
        ? null
        : {
            build: true,
            id: topId,
            href: leaderBuildHref(rowGame, topKey),
            words: leaderBuildWords(topName, withKey ? topKey : null),
          },
    [topId, topName, topKey, withKey, rowGame],
  );
  const listed: Entry[] = build ? [rows[0], build, ...rows.slice(1)] : rows;
  const entries: Entry[] = showExamples
    ? exampleEntries
    : footerNoun
      ? [...listed, FOOTER]
      : listed;
  const typed = text.trim();
  const note =
    fallback && answer && answer.game !== answer.asked && rows.length > 0
      ? fallbackLine(fallback.names, answer.asked, answer.game, rows.length)
      : null;

  const handleValueChange = (next: string) => {
    if (nameKey(next).length < NAME_MIN_CHARS) {
      setAnswer(null);
      setFailed(false);
    }
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  return (
    <Autocomplete
      items={entries}
      mode="none"
      value={text}
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={(next, details) => {
        // SEARCH-EXAMPLES: Base UI shuts the popup when the box is emptied;
        // with examples, an empty box still offers them.
        if (!next && details.reason === "input-clear" && examples !== undefined) return;
        setWant(next);
      }}
      highlightItemOnHover={false}
      itemToStringValue={(entry: Entry) =>
        "footer" in entry || "build" in entry ? text : "example" in entry ? entry.text : entry.name
      }
      name={name}
    >
      <AutocompleteInput
        ref={inputRef}
        id={id}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onFocus={() => {
          // SEARCH-EXAMPLES: too little text to ask, so offer the examples.
          if (examples !== undefined && !active) setWant(true);
        }}
        onBlur={() => {
          if (!open) setWant(false);
        }}
        unstyled={inputClassName !== undefined}
        className={inputClassName}
      />
      {name && (
        // Base UI's Root renders a second, unnamed TEXT input beside this one
        // (its form-value mirror). HTML implicit submission refuses a form
        // with two text fields and no submit button — measured in the pane:
        // Enter submitted nothing, with the popup open or shut, and a
        // script-less form could not be submitted at all. This invisible
        // default button is what Enter now "clicks". Rendered (sr-only, not
        // `hidden`): WebKit skips a default button that has no box.
        <button type="submit" tabIndex={-1} aria-hidden className="sr-only" />
      )}
      <AutocompleteStatus>
        {open
          ? showExamples
            ? `${exampleEntries.length} example${exampleEntries.length === 1 ? "" : "s"}`
            : rows.length
              ? (note ?? `${rows.length} suggestion${rows.length === 1 ? "" : "s"}`)
              : "No matches"
          : ""}
      </AutocompleteStatus>
      <AutocompleteContent data-slot="name-suggest-popup">
        {showExamples ? (
          <p
            data-slot="name-suggest-try"
            className="text-muted-foreground px-1.5 py-1 text-xs font-medium"
          >
            Try
          </p>
        ) : (
          rows.length === 0 && (
            <p className="text-muted-foreground px-1.5 py-1 text-sm">No matches</p>
          )
        )}
        {note && (
          <p data-slot="name-suggest-note" className="text-muted-foreground px-1.5 py-1 text-sm">
            {note}
          </p>
        )}
        <AutocompleteList>
          {(entry: Entry) =>
            "example" in entry ? (
              <AutocompleteItem
                key={`example:${entry.href}`}
                value={entry}
                render={<Link href={entry.href} prefetch={false} />}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) setWant(false);
                }}
              >
                <ExampleBody example={entry} />
              </AutocompleteItem>
            ) : "footer" in entry ? (
              <FooterRow
                key="footer"
                noun={footerNoun ?? ""}
                typed={typed}
                separated={rows.length > 0}
                onPick={() => inputRef.current?.form?.requestSubmit()}
              />
            ) : "build" in entry ? (
              <AutocompleteItem
                key={`build:${entry.id}`}
                value={entry}
                render={<Link href={entry.href} prefetch={false} />}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) setWant(false);
                }}
              >
                <BuildBody words={entry.words} />
              </AutocompleteItem>
            ) : onPick ? (
              <AutocompleteItem
                key={entry.id}
                value={entry}
                onClick={() => {
                  setWant(false);
                  onPick(entry);
                }}
              >
                <RowBody row={entry} detail={detail} game={rowGame} />
              </AutocompleteItem>
            ) : (
              <AutocompleteItem
                key={entry.id}
                value={entry}
                render={<Link href={rowHref(entry, target)!} prefetch={false} />}
                onClick={(e) => {
                  // A plain pick leaves the page: close now rather than
                  // while the next route loads. A new-tab click keeps it.
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) setWant(false);
                }}
              >
                <RowBody row={entry} detail={detail} game={rowGame} />
              </AutocompleteItem>
            )
          }
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  );
}

/** An example's search icon (in the thumbnail's column), words and detail. */
function ExampleBody({ example }: { example: NameExample }) {
  return (
    <>
      <span
        aria-hidden
        data-slot="example-icon"
        className="text-muted-foreground flex w-[1.625rem] shrink-0 justify-center"
      >
        <SearchIcon />
      </span>
      <span className="min-w-0 flex-1 truncate">{example.text}</span>
      <span className="text-muted-foreground max-w-[45%] shrink-0 truncate text-xs">
        {example.detail}
      </span>
    </>
  );
}

/**
 * The build entry's hammer (in the thumbnail's column) and its words. They
 * wrap rather than truncate, as the footer's do: the card's whole name is
 * the entry's point.
 */
function BuildBody({ words }: { words: string }) {
  return (
    <>
      <span
        aria-hidden
        data-slot="build-icon"
        className="text-muted-foreground flex w-[1.625rem] shrink-0 justify-center"
      >
        <HammerIcon />
      </span>
      <span className="min-w-0 flex-1 wrap-break-word">{words}</span>
    </>
  );
}

/** A row's thumbnail, name and detail — the same in both modes. */
function RowBody({
  row: entry,
  detail,
  game,
}: {
  row: SuggestRow;
  detail: NameSuggestProps["detail"];
  game: NameSuggestProps["game"];
}) {
  return (
    <>
      <span
        aria-hidden
        data-slot="thumb"
        className="h-9 w-[1.625rem] shrink-0 overflow-hidden rounded-[2px]"
      >
        {entry.image && (
          <CardImage src={entry.image} alt="" width={146} height={204} className="h-9 w-auto" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      <RowDetail row={entry} detail={detail} game={game} />
    </>
  );
}

function RowDetail({
  row,
  detail,
  game,
}: {
  row: SuggestRow;
  detail: NameSuggestProps["detail"];
  game: NameSuggestProps["game"];
}) {
  if (detail === "colors") {
    return (
      <ColorChipList
        game={game}
        mask={game === "mtg" ? row.ciMask : row.colorsMask}
        className="text-xs"
      />
    );
  }
  const text = detail === "number" ? row.externalKey : row.typeLine;
  if (!text) return null;
  return (
    <span
      className={cn(
        "text-muted-foreground max-w-[45%] shrink-0 truncate text-xs",
        detail === "number" && "tabular-nums",
      )}
    >
      {text}
    </span>
  );
}

/**
 * D2's last row on the index boxes: submits the owning GET form — the same
 * list Enter with no highlight asks for, which is always a superset of the
 * rows above it (the list accepts classes 1–4 and near misses). A border,
 * not a separator element: a listbox may only own options.
 */
function FooterRow({
  noun,
  typed,
  separated,
  onPick,
}: {
  noun: string;
  typed: string;
  separated: boolean;
  onPick: () => void;
}) {
  return (
    <AutocompleteItem
      value={FOOTER}
      onClick={onPick}
      className={cn("text-muted-foreground", separated && "mt-1 rounded-t-none border-t")}
    >
      {/* Wraps rather than truncates: at the 18 rem floor the sentence is
          already longer than one line, and the typed text is its point. */}
      <span className="min-w-0 flex-1 wrap-break-word">
        Show every {noun} matching “{typed}”
      </span>
      <span aria-hidden className="text-xs">
        ↵
      </span>
    </AutocompleteItem>
  );
}
