"use client";

/**
 * The "Changes from <precon>" sheet (PRECON-CHANGES, the owner's pick of
 * 2026-11-15: "have a page to click on that shows what has been swapped
 * from your original list … so you can refer to it as you are physically
 * building the deck"). The editor's dialog slot ("precon-changes"), opened
 * only by the deck pane's "See changes": a full-height Drawer on phones, the
 * wide Modal from md (SheetShell), so the hotkeys stand down.
 *
 * - **Two lists, each with its count**: "Take out" (what the box holds and
 *   the list no longer does) and "Add" (what the list holds beyond the
 *   box's copies), from `preconChanges` over the list on screen. Rows are
 *   grouped by type as the deck list groups by default and run A to Z; a
 *   row says its quantity when above one, and its name shows the card on
 *   hover. Add rows carry the cheapest price and the collection's mark.
 *   Names wrap: a list to pull cards by never cuts a name short. Under
 *   "Add" one line says what the deck list's circled plus means: on a touch
 *   screen the mark's own name is out of reach.
 * - **One cost line**, for the copies to add that the player does not own
 *   (`preconAddCost` over the collection's set, the price line's own). With
 *   the precon owned it is the ownership line's "missing", to the cent.
 * - **Copy as text**: two headed blocks of `1 Name` lines, the export's
 *   grammar. It waits for every name.
 * - **Names for cards this session has not seen** (a cut card after a
 *   reload: the editor holds the current list's cards only) come from ONE
 *   `GET /api/precons/<slug>`, the draft seeder's public source, a day at
 *   the edge, asked when the sheet opens and only when a name is missing: a
 *   draft holds every card from its seed and asks nothing. A failure says
 *   so with Try again; closing aborts, and an aborted ask writes nothing
 *   and is asked again (StrictMode's twin included). A card that list can't
 *   name (a product re-read since) is listed as "Unknown card".
 * - **Nothing jumps when the names land.** While they load the sheet shows
 *   "Take out", its count and the wait, and the Add list comes with the
 *   answer (the names, or the failure): on a phone the lists are stacked,
 *   and an Add list shown first would drop by the whole Take out list. And
 *   the phone's Drawer is full height from the start, so its top stays put.
 *
 * Read-only: opening, loading and copying write nothing to the deck.
 */
import { CirclePlusIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { CopyStatus, useCopyToClipboard } from "@/components/copy-status";
import { CardNamePreview } from "@/components/deck/card-name-preview";
import { SheetShell, type SheetFinalFocus } from "@/components/editor/sheet-shell";
import { Button } from "@/components/ui/button";
import { BRACKET_COPY } from "@/lib/brackets/copy";
import { PRECON_COPY } from "@/lib/collection/precon-copy";
import { toEditorCard, type CardWire, type EditorCard } from "@/lib/decks/editor-state";
import {
  preconAddCost,
  preconChangesText,
  type PreconChange,
  type PreconChanges,
} from "@/lib/decks/precon-changes";
import { groupDeckEntries, type DeckGroup } from "@/lib/decks/view-model";
import type { GameAdapter } from "@/lib/games/types";

/** What a row shows of its card. */
type RowCard = Pick<EditorCard, "name" | "image" | "primaryType" | "costValue" | "cheapestUsd">;
type RowEntry = { cardId: string; qty: number; tags: string[] };
type RowGroup = DeckGroup<RowEntry, RowCard>;

/** The precon's own cards, asked once per open when a name is missing. */
type Load =
  | { status: "loading" }
  | { status: "done"; cards: ReadonlyMap<string, EditorCard> }
  | { status: "error" };

/** A card of the box the precon's own list can't name. */
const UNKNOWN: RowCard = {
  name: PRECON_COPY.unknownCard,
  image: null,
  primaryType: null,
  costValue: null,
  cheapestUsd: null,
};

/** A text control after a gap in a line (U9). */
const INLINE_ACTION =
  "text-foreground ml-1 cursor-pointer font-medium underline underline-offset-4 hover:no-underline pointer-coarse:min-h-11 pointer-coarse:min-w-11";

const usd = (n: number) => `$${n.toFixed(2)}`;

export function PreconChangesSheet({
  adapter,
  precon,
  changes,
  cards,
  owned,
  phone,
  finalFocus,
  onClose,
}: {
  adapter: GameAdapter;
  /** The precon the deck started from: its slug (the one request's key) and its name. */
  precon: { slug: string; name: string };
  /** What the list on screen changed from the box (precon-changes.ts). */
  changes: PreconChanges;
  /** Every card the editor has seen this session. */
  cards: ReadonlyMap<string, EditorCard>;
  /** The collection's identity set, the price line's own; null = no collection. */
  owned: ReadonlySet<string> | null;
  phone: boolean;
  /** Where focus goes on close, over Base UI's default (the editor names "See changes"). */
  finalFocus?: SheetFinalFocus;
  onClose: () => void;
}) {
  // A cut card the editor never saw (after a reload) has no name here yet.
  const needed = useMemo(() => changes.out.some((c) => !cards.has(c.cardId)), [changes, cards]);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  // The ask whose answer landed: a re-run of the effect never asks it again.
  const settledRef = useRef<number | null>(null);

  // ONE GET for the precon's own list, only when a name is missing. The list
  // can't change under a modal; closing aborts, and an aborted ask writes nothing.
  useEffect(() => {
    if (!needed || settledRef.current === nonce) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/precons/${encodeURIComponent(precon.slug)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Precon failed (${res.status})`);
        const json = (await res.json()) as { cards?: { cardId: string; card: CardWire }[] };
        if (controller.signal.aborted) return;
        settledRef.current = nonce;
        setLoad({
          status: "done",
          cards: new Map((json.cards ?? []).map((c) => [c.cardId, toEditorCard(c.card)])),
        });
      } catch {
        if (controller.signal.aborted) return;
        settledRef.current = nonce;
        setLoad({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [needed, nonce, precon.slug]);

  const retry = () => {
    setLoad({ status: "loading" });
    setNonce((n) => n + 1);
  };

  // The Take out list waits for its names. The Add list's cards are all on
  // screen, and it comes with the answer, so nothing below the wait moves.
  const outState = !needed ? "ready" : load.status === "done" ? "ready" : load.status;
  const fetched = load.status === "done" ? load.cards : null;

  const outGroups = useMemo(() => {
    if (outState !== "ready") return [];
    const known = new Map<string, RowCard>();
    for (const c of changes.out) {
      known.set(c.cardId, cards.get(c.cardId) ?? fetched?.get(c.cardId) ?? UNKNOWN);
    }
    return grouped(changes.out, known, adapter);
  }, [outState, changes.out, cards, fetched, adapter]);
  const inGroups = useMemo(() => grouped(changes.in, cards, adapter), [changes.in, cards, adapter]);

  const cost = PRECON_COPY.addCost(preconAddCost(changes.in, cards, owned));
  const text = useMemo(
    () =>
      outState === "ready"
        ? preconChangesText(
            changes,
            (id) => cards.get(id)?.name ?? fetched?.get(id)?.name ?? PRECON_COPY.unknownCard,
            { out: PRECON_COPY.takeOut, in: PRECON_COPY.add },
          )
        : null,
    [outState, changes, cards, fetched],
  );
  const copy = useCopyToClipboard();

  return (
    <SheetShell
      title={PRECON_COPY.changesTitle(precon.name)}
      phone={phone}
      wide
      tall
      finalFocus={finalFocus}
      onClose={onClose}
    >
      <div data-slot="precon-changes-sheet" data-out-state={outState} className="space-y-3">
        <p className="text-muted-foreground text-sm">{PRECON_COPY.changesLead}</p>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1 basis-56 space-y-0.5">
            {cost && (
              <p data-slot="precon-changes-cost" className="text-sm tabular-nums">
                {cost}
              </p>
            )}
            {changes.in.length > 0 && (
              <p className="text-muted-foreground text-xs">{BRACKET_COPY.fitPrices}</p>
            )}
          </div>
          {/* On a phone the control wraps under the cost: at the row's end, its status before it. */}
          <div className="ml-auto flex items-center gap-2">
            <CopyStatus copy={copy} failed={PRECON_COPY.copyFailed} />
            <Button
              variant="outline"
              size="sm"
              className="pointer-coarse:min-h-11"
              disabled={!text}
              onClick={() => {
                if (text) copy.copy(text);
              }}
            >
              {PRECON_COPY.copy}
            </Button>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <ChangeList
            side="out"
            heading={PRECON_COPY.takeOut}
            count={changes.outQty}
            groups={outGroups}
            empty={PRECON_COPY.nothingOut}
            owned={null}
            waiting={
              outState === "loading" ? (
                <p
                  data-slot="precon-changes-loading"
                  className="text-muted-foreground mt-2 text-sm"
                >
                  {PRECON_COPY.loading}
                </p>
              ) : outState === "error" ? (
                <p data-slot="precon-changes-failed" className="text-destructive mt-2 text-sm">
                  {PRECON_COPY.loadFailed}{" "}
                  <button type="button" onClick={retry} className={INLINE_ACTION}>
                    {PRECON_COPY.retry}
                  </button>
                </p>
              ) : null
            }
          />
          {/* With the first answer; a Try again keeps it where it is. */}
          {(outState !== "loading" || nonce > 0) && (
            <ChangeList
              side="in"
              heading={PRECON_COPY.add}
              count={changes.inQty}
              groups={inGroups}
              empty={PRECON_COPY.nothingIn}
              owned={owned}
              priced
              note={
                changes.in.length > 0 && (
                  <p
                    data-slot="precon-changes-mark-note"
                    className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs"
                  >
                    <CirclePlusIcon aria-hidden className="text-foreground size-3.5 shrink-0" />
                    {PRECON_COPY.markNote}
                  </p>
                )
              }
            />
          )}
        </div>

        {/* The polite word for the one wait: the names landed, or they didn't. */}
        <span role="status" data-slot="precon-changes-status" className="sr-only">
          {needed && outState === "error" ? PRECON_COPY.loadFailed : ""}
        </span>
      </div>
    </SheetShell>
  );
}

/** The deck list's own default grouping (by type, in the adapter's order), A to Z inside. */
function grouped(
  list: readonly PreconChange[],
  cards: ReadonlyMap<string, RowCard>,
  adapter: GameAdapter,
): RowGroup[] {
  return groupDeckEntries(
    list.map((c) => ({ cardId: c.cardId, qty: c.qty, tags: [] })),
    cards,
    adapter.display.defaultGroupBy,
    "name",
    adapter.display.typeOrder,
  );
}

/** One side of the difference: its heading and count, then its rows by type (or what it waits on). */
function ChangeList({
  side,
  heading,
  count,
  groups,
  empty,
  owned,
  priced = false,
  waiting = null,
  note,
}: {
  side: "out" | "in";
  heading: string;
  count: number;
  groups: RowGroup[];
  /** The sentence for a side with nothing in it. */
  empty: string;
  /** The collection's set, for the mark; null = no marks. */
  owned: ReadonlySet<string> | null;
  /** Add rows carry each card's cheapest price. */
  priced?: boolean;
  /** What the list shows instead of its rows while it waits on names (loading, a failure). */
  waiting?: ReactNode;
  /** A line under the heading (Add: what the deck list's mark means). */
  note?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section data-list={side} aria-labelledby={headingId} className="min-w-0">
      <h3 id={headingId} className="flex items-baseline gap-2 border-b pb-1 text-sm font-semibold">
        {heading}{" "}
        <span data-slot="list-count" className="tabular-nums">
          {count}
        </span>
      </h3>
      {note}
      {waiting}
      {waiting === null && count === 0 && (
        <p className="text-muted-foreground mt-2 text-sm">{empty}</p>
      )}
      {groups.map((group) => (
        <div key={group.key} data-group={group.key}>
          <h4 className="flex items-baseline gap-2 pt-3 pb-1">
            <span className="type-eyebrow text-muted-foreground">{group.label}</span>{" "}
            <span className="text-foreground text-xs font-semibold tabular-nums">{group.qty}</span>
          </h4>
          <ul>
            {group.items.map(({ entry, card }) => {
              const price = card.cheapestUsd;
              return (
                <li
                  key={entry.cardId}
                  data-change-row={entry.cardId}
                  className="flex items-baseline gap-1.5 py-0.5 text-sm pointer-coarse:py-1.5"
                >
                  {/* The spaces between a row's parts are dropped by the flex row and kept
                      in its text: "2 Forest $0.10 each" when read aloud or selected. */}
                  {entry.qty > 1 && (
                    <>
                      <span data-slot="qty" className="shrink-0 font-medium tabular-nums">
                        {entry.qty}
                      </span>{" "}
                    </>
                  )}
                  <CardNamePreview name={card.name} image={card.image}>
                    <span className="min-w-0 break-words">{card.name}</span>
                  </CardNamePreview>
                  {owned?.has(entry.cardId) && (
                    <>
                      {" "}
                      <span
                        role="img"
                        aria-label={PRECON_COPY.inCollection}
                        title={PRECON_COPY.inCollection}
                        className="shrink-0 text-xs text-emerald-700 dark:text-emerald-400"
                      >
                        ✓
                      </span>
                    </>
                  )}
                  {priced && " "}
                  {priced && (
                    <span
                      data-slot="price"
                      className="text-muted-foreground ml-auto shrink-0 pl-2 text-xs tabular-nums"
                    >
                      {price === null
                        ? BRACKET_COPY.fitNoPrice
                        : entry.qty > 1
                          ? PRECON_COPY.each(usd(price))
                          : usd(price)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
