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
 */
import { useId } from "react";

import { PRECON_COPY } from "@/lib/collection/precon-copy";
import { cn } from "@/lib/utils";

const ACTION =
  "text-foreground shrink-0 cursor-pointer font-medium underline underline-offset-4 hover:no-underline pointer-coarse:min-h-11 pointer-coarse:min-w-11";

export function PreconChangesLine({
  changes,
  onSee,
  className,
}: {
  /** Copies out of the box and copies added to it (precon-changes.ts). */
  changes: { outQty: number; inQty: number };
  /** Opens the sheet; absent = the words alone. */
  onSee?: () => void;
  className?: string;
}) {
  const textId = useId();
  const changed = changes.outQty > 0 || changes.inQty > 0;
  return (
    <p
      data-slot="precon-changes-line"
      data-state={changed ? "changed" : "none"}
      className={cn(
        "text-muted-foreground flex items-center gap-x-1.5 text-xs pointer-coarse:min-h-11",
        className,
      )}
    >
      <span id={textId} className="min-w-0 tabular-nums">
        {changed ? PRECON_COPY.changed(changes.outQty, changes.inQty) : PRECON_COPY.noChanges}
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
