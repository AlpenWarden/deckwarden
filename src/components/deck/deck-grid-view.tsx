"use client";

/**
 * Image-grid view (P1.3): default-printing card images through CardImage
 * (R1b — lazy, sized, framed; the CDN and attribution rules live in its
 * docblock), a quantity badge overlay, click → detail pane. Same precomputed
 * groups as the text view.
 *
 * R3 (C13): the printed id (`display.idBadge`) joins the owned badge in the
 * TOP-LEFT corner and the quantity stays top-right — top corners only, since
 * the frame's bottom carries the artist / © line (Magic) or Bandai's text
 * (One Piece). `stickyHeaders` mirrors the text view's editor-only sticky
 * group headers.
 *
 * R6 (status never color-only): a card with a validation issue carries the
 * severity as text — an sr-only "Has a problem" / "Warning" (the text
 * view's words) wired through `aria-describedby`, so the button's name
 * stays "Show {name}" and the ring's hue is no longer the only channel.
 *
 * U3a (WAVE5 D4): the text view's `GroupHeading` — label and count on
 * space — on the editor and, since U6 (WAVE5 D7), the share page too.
 *
 * PRECON-CHANGES: `beyondPrecon` (the editor's alone) badges each card the
 * list holds beyond the precon's copies: a circled plus and "Added", named
 * "Not in the precon", in the top-left corner under the id and owned
 * badges (a badge of its own, so their row is as it was). The share page
 * passes nothing.
 *
 * MAYBE-LIST (the grid's Maybe tiles): `tileFooter` puts the caller's
 * controls under a tile's image, in the tile's own flow, never over the
 * card (the frame's bottom carries the artist / © line), and `countLabel`
 * names the ×N badge for a list that is not the deck ("1 in Maybe"). The
 * deck's own tiles, Tokens and the share page pass neither.
 */
import { CirclePlusIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

import { CardImage } from "@/components/cards/card-image";
import { GroupHeading } from "@/components/deck/deck-text-view";
import { PRECON_COPY } from "@/lib/collection/precon-copy";
import type { EditorCard, EditorEntry } from "@/lib/decks/editor-state";
import type { DeckGroup } from "@/lib/decks/view-model";
import type { GameAdapter } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface DeckGridViewProps {
  groups: DeckGroup<EditorEntry, EditorCard>[];
  /** Worst validation severity per card id (P1.4) — drives the card rings. */
  severity: ReadonlyMap<string, "error" | "warning">;
  onPreview: (card: EditorCard) => void;
  /** Card ids the viewer owns any printing of (P3.7); absent = no collection, no badges. */
  owned?: ReadonlySet<string>;
  /**
   * PRECON-CHANGES: identity → the copies the list holds beyond the precon's
   * (precon-changes.ts `beyondPrecon`); absent = no precon lineage, no badges.
   */
  beyondPrecon?: ReadonlyMap<string, number>;
  /**
   * The mark's name ("Not in the precon"); FIRST-LIST passes "Not in your
   * first full list". The precon's words when absent.
   */
  beyondLabel?: (beyond: number, qty: number) => string;
  /** For the printed-id badge (C13); absent = no id badges. */
  adapter?: GameAdapter;
  /** Editor: group headers stick to the top of the scrolling pane (C12). */
  stickyHeaders?: boolean;
  /** False = no group headings (the Tokens section, whose disclosure is its heading). */
  headings?: boolean;
  /** False = no ×N badge (TOKEN-FILL: a derived token carries no quantity). */
  counts?: boolean;
  /** The ×N badge's accessible name; default "N in deck". */
  countLabel?: (qty: number) => string;
  /** MAYBE-LIST: controls under each tile's image (the Maybe tiles' move and remove); absent = none. */
  tileFooter?: (entry: EditorEntry, card: EditorCard) => ReactNode;
}

const BADGE_CLASS =
  "bg-background/85 pointer-events-none rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums shadow-sm";

export function DeckGridView({
  groups,
  severity,
  onPreview,
  owned,
  beyondPrecon,
  beyondLabel = PRECON_COPY.rowMark,
  adapter,
  stickyHeaders = false,
  headings = true,
  counts = true,
  countLabel = (qty) => `${qty} in deck`,
  tileFooter,
}: DeckGridViewProps) {
  const idPrefix = useId();
  return (
    <>
      {groups.map((group) => (
        <section key={group.key}>
          {headings && <GroupHeading label={group.label} qty={group.qty} sticky={stickyHeaders} />}
          <ul
            className={cn(
              "grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2",
              headings && "mt-2",
            )}
          >
            {group.items.map(({ entry, card }) => {
              const badge = adapter?.display.idBadge?.(card);
              const level = severity.get(card.id);
              const levelId = level ? `${idPrefix}-${entry.zone}-${card.id}` : undefined;
              const beyond = beyondPrecon?.get(card.id) ?? 0;
              return (
                <li key={`${entry.zone}:${entry.cardId}`} className="relative">
                  <button
                    type="button"
                    onClick={() => onPreview(card)}
                    aria-label={`Show ${card.name}`}
                    aria-describedby={levelId}
                    className={`focus-visible:ring-ring/50 block w-full rounded-[4.75%/3.5%] outline-none focus-visible:ring-3 ${
                      level === "error"
                        ? "ring-destructive ring-2"
                        : level === "warning"
                          ? "ring-2 ring-amber-500"
                          : ""
                    }`}
                  >
                    <CardImage
                      src={card.image}
                      alt={card.name}
                      width={488}
                      height={680}
                      frame
                      className="w-full text-xs shadow-sm"
                    />
                  </button>
                  {level && (
                    <span id={levelId} data-slot="severity" className="sr-only">
                      {level === "error" ? "Has a problem" : "Warning"}
                    </span>
                  )}
                  {counts && (
                    <span
                      aria-label={countLabel(entry.qty)}
                      className={cn(BADGE_CLASS, "absolute top-1 right-1")}
                    >
                      ×{entry.qty}
                    </span>
                  )}
                  {/* Top-left: the printed id, then the owned badge (P3.7). The
                      bottom of the frame is the artist/© line and stays uncovered (CLAUDE.md). */}
                  {(badge || owned?.has(card.id)) && (
                    <span className="pointer-events-none absolute top-1 left-1 flex max-w-[calc(100%-3.5rem)] gap-1">
                      {badge && <span className={cn(BADGE_CLASS, "truncate")}>{badge}</span>}
                      {owned?.has(card.id) && (
                        <span
                          aria-label="In your collection"
                          className={cn(BADGE_CLASS, "text-emerald-700 dark:text-emerald-400")}
                        >
                          ✓ Owned
                        </span>
                      )}
                    </span>
                  )}
                  {/* PRECON-CHANGES: its own badge, under the id / owned row when there is one. */}
                  {beyond > 0 && (
                    <span
                      role="img"
                      data-slot="precon-mark"
                      aria-label={beyondLabel(beyond, entry.qty)}
                      className={cn(
                        BADGE_CLASS,
                        "absolute left-1 inline-flex items-center gap-1",
                        badge || owned?.has(card.id) ? "top-7" : "top-1",
                      )}
                    >
                      <CirclePlusIcon aria-hidden className="size-3" />
                      {PRECON_COPY.added}
                    </span>
                  )}
                  {tileFooter?.(entry, card)}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
