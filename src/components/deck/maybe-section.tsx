"use client";

/**
 * The Maybe section (MAYBE-LIST): the cards the player is considering — the
 * format's Maybe zone (playable.ts `maybeZoneOf`), outside the deck's size
 * and never validated — as one collapsible group after Tokens, on the editor
 * and on the share page. Closed by default; the heading is the disclosure,
 * as the Tokens section's is (Base UI's Collapsible trigger inside an h3,
 * the zone's label beside its count).
 *
 * The cards follow the pane's View, as Tokens do (MAYBE-LIST amended, the
 * owner's ask: "view the maybe list in the grid format as well"): the text
 * view's rows, or the grid's tiles, with no legality mark of any kind (a
 * Maybe card is not checked, so a banned or off-color card here reads like
 * any other). In the editor each card carries its way into the deck as a
 * button in words, always shown (the owner's answer: "Labeled button,
 * always"): "Move to deck" (`onMove`, the editor's handleMoveToDeck), or
 * "Swap in…" at the deck's maximum (`deckFull`), which opens the swap
 * sheet. A row puts it before its remove (revealed on hover like the deck's
 * own, and on touch both take a second line); a tile puts it under its
 * image with an always-shown remove beside it, since a tile's click only
 * shows the card. The share page passes neither, and renders the section
 * only when it holds a card (the owner's decision 4: visitors see it,
 * closed).
 */
import { ChevronDownIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { DeckGridView } from "@/components/deck/deck-grid-view";
import { DeckTextView, GROUP_HEADER_CLASS } from "@/components/deck/deck-text-view";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { EditorCard, EditorEntry } from "@/lib/decks/editor-state";
import { MAYBE_COPY } from "@/lib/decks/maybe-copy";
import type { DeckGroup, ViewItem } from "@/lib/decks/view-model";
import type { DeckViewMode } from "@/lib/decks/view-prefs";
import type { GameAdapter, ZoneDef } from "@/lib/games/types";

/** Nothing in Maybe is checked: no row or tile carries a severity. */
const NO_SEVERITY: ReadonlyMap<string, "error" | "warning"> = new Map();

interface MaybeSectionProps {
  adapter: GameAdapter;
  zone: ZoneDef;
  items: ViewItem<EditorEntry, EditorCard>[];
  /** The pane's View: text rows or grid tiles. */
  view: DeckViewMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (card: EditorCard) => void;
  owned?: ReadonlySet<string>;
  /** Editor: "Move to deck" on each card — an error sentence, or nothing. Absent = read-only (share page). */
  onMove?: (cardId: string) => string | undefined;
  /** Editor: the deck is at its maximum, so the move is "Swap in…". */
  deckFull?: boolean;
  /** Editor: the card's remove (the editor's Undo path). */
  onRemove?: (zoneId: string, cardId: string) => void;
  /** Share page: hover and focus previews on the names. */
  preview?: boolean;
  className?: string;
}

export function MaybeSection({
  adapter,
  zone,
  items,
  view,
  open,
  onOpenChange,
  onPreview,
  owned,
  onMove,
  deckFull = false,
  onRemove,
  preview = false,
  className,
}: MaybeSectionProps) {
  const [error, setError] = useState<string | null>(null);
  const qty = items.reduce((n, i) => n + i.entry.qty, 0);
  // One group in name order, no heading of its own (the disclosure is the heading).
  const group: DeckGroup<EditorEntry, EditorCard> = {
    key: `zone:${zone.id}`,
    label: zone.label,
    qty,
    items: [...items].sort((a, b) => a.card.name.localeCompare(b.card.name)),
  };
  const editor = onMove !== undefined;
  // The way into the deck, in words: the row's control and the tile's.
  const moveButton = (card: EditorCard, className?: string) =>
    onMove && (
      <Button
        variant="secondary"
        size="xs"
        aria-label={deckFull ? MAYBE_COPY.swapInLabel(card.name) : MAYBE_COPY.moveLabel(card.name)}
        data-maybe-move={card.id}
        className={className}
        onClick={() => setError(onMove(card.id) ?? null)}
      >
        <span className="truncate">{deckFull ? MAYBE_COPY.swapIn : MAYBE_COPY.move}</span>
      </Button>
    );

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      render={<section data-slot="maybe-section" className={className} />}
    >
      <h3 className={GROUP_HEADER_CLASS}>
        <CollapsibleTrigger className="group/trigger flex items-center gap-2 rounded text-left hover:underline pointer-coarse:min-h-11">
          <span className="type-eyebrow text-muted-foreground">{zone.label}</span>
          <span
            data-slot="group-count"
            className="text-foreground text-sm font-semibold tabular-nums"
          >
            {qty}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="text-muted-foreground size-3.5 motion-safe:transition-transform motion-safe:duration-[120ms] group-data-panel-open/trigger:rotate-180"
          />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{MAYBE_COPY.empty}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {editor ? MAYBE_COPY.note : MAYBE_COPY.visitorNote}
            </p>
            {view === "grid" ? (
              <DeckGridView
                groups={[group]}
                severity={NO_SEVERITY}
                onPreview={onPreview}
                owned={owned}
                adapter={adapter}
                headings={false}
                countLabel={MAYBE_COPY.countLabel}
                tileFooter={
                  onMove
                    ? (entry, card) => (
                        <div
                          data-slot="maybe-tile-actions"
                          className="mt-1 flex items-center gap-1"
                        >
                          {moveButton(card, "min-w-0 flex-1")}
                          {onRemove && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={MAYBE_COPY.removeLabel(card.name)}
                              className="pointer-coarse:size-11"
                              onClick={() => onRemove(entry.zone, entry.cardId)}
                            >
                              <XIcon />
                            </Button>
                          )}
                        </div>
                      )
                    : undefined
                }
              />
            ) : (
              <DeckTextView
                adapter={adapter}
                groups={[group]}
                severity={NO_SEVERITY}
                onRemove={onRemove}
                removeLabel={(card) => MAYBE_COPY.removeLabel(card.name)}
                onPreview={onPreview}
                owned={owned}
                preview={preview}
                headings={false}
                rowAction={
                  onMove ? (_entry, card) => moveButton(card, "pointer-coarse:px-3") : undefined
                }
              />
            )}
          </>
        )}
        {error && (
          <p aria-live="polite" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
