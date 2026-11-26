"use client";

/**
 * "Changed from the precon" (PRECON-CHANGES, the owner's pick of
 * 2026-11-15): the second quiet line under the leader zone, directly after
 * "Do you own this precon?", the owner's alone, on every deck with a precon
 * lineage. It says how many copies the list has taken out of the box and
 * how many it has added, and "See changes" opens the sheet with both lists.
 * The count is derived from the list on screen, so it lands the moment a
 * swap applies and goes back with its Undo.
 *
 * It arrives with the list (the owner's GET carries the precon; a draft
 * takes it from its seed), so nothing below it moves once the list is on
 * screen. And its box does not move when the first change lands: on a
 * coarse pointer the line keeps the control's 44 px whether the control is
 * there or not, and the words wrap inside their own box beside it (320 px),
 * so a stepper tapped twice never has the list move under the finger.
 *
 * The control follows the words after a gap, underlined (U9, the precon
 * line's way). The toast already announces a swap, so the line is not a
 * live region.
 *
 * FIRST-LIST: the same line for a deck built by hand, under the leader zone
 * where it is the only line ("Changed from your first full list: 3 out, 3
 * in."): its words come in `words`, and its `slot` names it for the focus
 * that comes back when its sheet closes.
 */
import { useId } from "react";

import { PRECON_COPY } from "@/lib/collection/precon-copy";
import { cn } from "@/lib/utils";

const PRECON_WORDS = { changed: PRECON_COPY.changed, none: PRECON_COPY.noChanges };

const ACTION =
  "text-foreground shrink-0 cursor-pointer font-medium underline underline-offset-4 hover:no-underline pointer-coarse:min-h-11 pointer-coarse:min-w-11";

export function PreconChangesLine({
  changes,
  onSee,
  words = PRECON_WORDS,
  slot = "precon-changes-line",
  className,
}: {
  /** Copies out of the box and copies added to it (precon-changes.ts). */
  changes: { outQty: number; inQty: number };
  /** Opens the sheet; absent = the words alone. */
  onSee?: () => void;
  /** The line's two sentences; the precon's by default (FIRST-LIST passes its own). */
  words?: { changed: (out: number, added: number) => string; none: string };
  /** The line's data-slot, which the editor's focus return looks up. */
  slot?: string;
  className?: string;
}) {
  const textId = useId();
  const changed = changes.outQty > 0 || changes.inQty > 0;
  return (
    <p
      data-slot={slot}
      data-state={changed ? "changed" : "none"}
      className={cn(
        "text-muted-foreground flex items-center gap-x-1.5 text-xs pointer-coarse:min-h-11",
        className,
      )}
    >
      {/* Focusable from script only: where focus lands when a sheet's change leaves no "See changes" (FIRST-LIST's reset). */}
      <span id={textId} tabIndex={-1} className="min-w-0 tabular-nums">
        {changed ? words.changed(changes.outQty, changes.inQty) : words.none}
      </span>
      {changed && onSee && (
        <>
          {/* Dropped by the flex row, kept for the text itself: "…in. See changes". */}{" "}
          <button
            type="button"
            aria-describedby={textId}
            aria-haspopup="dialog"
            onClick={onSee}
            className={ACTION}
          >
            {PRECON_COPY.seeChanges}
          </button>
        </>
      )}
    </p>
  );
}
