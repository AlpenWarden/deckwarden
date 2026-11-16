/**
 * The Autofill sheet's choice of Your target, in words (AUTOFILL-TARGET, the
 * owner's note of 2026-11-15: "the option to set your desired bracket as you
 * click the autofill a starter shell button"). Pure: the sheet renders what
 * these return, and the copy guard reads every line they can say.
 *
 * - `autofillTargetNote`: under the choice, what Add will do to the deck's
 *   target, and only when it would move it. A set or changed target says
 *   where a target shows.
 * - `autofillTargetToast`: the toast's second line when Add moved the
 *   target, in TARGET-CHANGES' titles, and that its Undo is the list's alone.
 * - `autofillAfter`: the after-line over the read of the list Add would
 *   build. Measured before it was worded (REDESIGN.md, AUTOFILL-TARGET, step
 *   0: 1,710 shells): a shell never reads above its target; at targets 1 and
 *   2 the list is one nothing flags (or, at 2, one that shows exactly 2); at
 *   3 it shows 3; at 4 it shows 4 on 241 of 285 and 3 on the rest; at 5 no
 *   list shows it. So:
 *   - **above**: a finding above the choice leads, the read's own sentences
 *     after it. A shell's picks never cause one; the commander, a kept card
 *     or a pinned combo can.
 *   - **line**: a read with something left open claims nothing: a call that
 *     is the player's (a combo or a card the read asks about: "Bracket 3 or
 *     4 · one combo is your call", 19 of the 285 shells at a target of 4), a
 *     list short of the format's size, a card that isn't legal, a source it
 *     couldn't check. The deck's own line is quoted, as the adapter says it
 *     and as the deck pane will show it. Every sentence below speaks for a
 *     read with nothing left open.
 *   - **reached**: the floor is at the target (`afterVerdict`'s rule,
 *     BRACKET-UP's, where nothing but the target's own level can pass it):
 *     what the cards show, then "That's your target."
 *   - **over**: the player's own answers under How it plays say a level
 *     past the target (no finding is above it, so nothing is listed). What
 *     the cards and the answers say, and never "That's your target.": it
 *     isn't.
 *   - **within**: nothing above the target and the read is in its band (the
 *     Why sheet's rule, `belowTargetBand`): a list nothing flags under a
 *     target of 1 or 2 says nothing goes past the target, and names it. It
 *     is never said to show it: the cards can't tell those levels apart.
 *   - **below**: what the cards show, and where the rest is. Where more of
 *     the cards the adapter counts (`toward`) would show the target, a
 *     target is a ceiling for Autofill and Upgrade toward is the next step;
 *     where no count shows it (the top level), the rest is How it plays.
 *   - **open**: no target chosen. What the cards show, nothing else.
 */
import type { BracketFactor, BracketInput, BracketRead, BracketsMeta } from "@/lib/games/types";

import { afterVerdict } from "./after-verdict";
import { BRACKET_COPY, levelLabel, levelNumberLabel } from "./copy";
import { belowTargetBand } from "./target-bands";

type Levels = Pick<BracketsMeta, "noun" | "levels">;

/** Under the choice: what Add will do to the deck's target; null when it would leave it as it is. */
export function autofillTargetNote(
  brackets: Levels,
  from: number | null,
  to: number | null,
  linkPreviews: boolean,
): string | null {
  if (from === to) return null;
  if (to === null) return BRACKET_COPY.autofillClears;
  const what =
    from === null
      ? BRACKET_COPY.autofillSets(levelLabel(brackets, to))
      : BRACKET_COPY.autofillChanges(
          levelNumberLabel(brackets, from),
          levelNumberLabel(brackets, to),
        );
  return `${what} ${BRACKET_COPY.autofillTargetShows(linkPreviews)}`;
}

/** The toast's second line when Add moved the deck's target; null when it didn't. */
export function autofillTargetToast(
  brackets: Levels,
  from: number | null,
  to: number | null,
): string | null {
  if (from === to) return null;
  const title =
    to === null
      ? BRACKET_COPY.targetCleared
      : from === null
        ? BRACKET_COPY.targetSet(levelLabel(brackets, to))
        : BRACKET_COPY.targetChanged(
            levelNumberLabel(brackets, from),
            levelNumberLabel(brackets, to),
          );
  return `${title}. ${BRACKET_COPY.autofillUndoKeeps}`;
}

export type AutofillAfter =
  | {
      kind: "above";
      /** "With these added, these put the deck above Bracket 2:" */
      lead: string;
      /** The read's findings above the target, in its order: their sentences follow the lead. */
      above: BracketFactor[];
      /** What a screen reader hears: a whole sentence. */
      status: string;
    }
  | {
      kind: "line";
      /** "With these added, the deck's bracket line says:" */
      lead: string;
      /** The adapter's line for the read, verbatim. */
      line: string;
      status: string;
    }
  | {
      kind: "reached" | "over" | "within" | "below" | "open";
      /** The verdict, "That's your target." included when reached. */
      head: string;
      /** Where the rest is, when the read is short of the target; else none. */
      notes: string[];
      status: string;
    };

export function autofillAfter(i: {
  brackets: BracketsMeta;
  /** The read of the list Add would build, assessed with the choice as its target. */
  read: BracketRead;
  /** The input that read came from (the adapter's `toward` takes it). */
  input: BracketInput;
  /** The sheet's choice: a level, or null for Not set. */
  target: number | null;
  /** The deck's own line for the read (the adapter's `line`), quoted where the read leaves something open. */
  line: string;
  /** Whether the editor can open Upgrade toward once the cards are in. */
  upgradeDoor: boolean;
}): AutofillAfter {
  const { brackets, read, target } = i;
  const C = BRACKET_COPY;
  const v = afterVerdict(brackets, read, target);

  if (target !== null && v.above.length > 0) {
    const level = levelNumberLabel(brackets, target);
    return {
      kind: "above",
      lead: C.autofillAfterAbove(level),
      above: v.above,
      status: C.autofillAfterAboveCount(v.above.length, level),
    };
  }
  // A read with something left open (a call that is the player's, a short
  // list, a card that isn't legal, a source unchecked): say the deck's own
  // line, claim nothing.
  if (read.status !== "read") {
    const lead = C.autofillAfterLine(brackets.noun);
    return { kind: "line", lead, line: i.line, status: `${lead} ${i.line}` };
  }

  const shows =
    v.head.kind === "answers"
      ? C.autofillAfterAnswers(levelLabel(brackets, v.head.level))
      : v.head.kind === "floor"
        ? C.autofillAfter(levelLabel(brackets, v.head.level))
        : C.autofillAfterNothing(brackets.noun);
  if (target === null) return { kind: "open", head: shows, notes: [], status: shows };

  const inBand = !belowTargetBand(brackets, read, target);
  // Nothing flagged, under a target in the band nothing flagged can tell apart.
  if (v.head.kind === "nothing" && inBand) {
    const head = C.autofillAfterWithin(levelLabel(brackets, target));
    return { kind: "within", head, notes: [], status: head };
  }
  if (v.reached) {
    // Past the target with nothing above it: only the player's answers say so.
    if ((read.suggested ?? read.minimum) > target) {
      return { kind: "over", head: shows, notes: [], status: shows };
    }
    const head = `${shows} ${C.upReached}`;
    return { kind: "reached", head, notes: [], status: head };
  }
  if (inBand) return { kind: "within", head: shows, notes: [], status: shows };

  // Short of the target: a count of the cards the adapter counts would show
  // it (a ceiling Autofill doesn't build up to), or no count does.
  const toward = brackets.toward?.(read, i.input, target) ?? null;
  const notes = toward
    ? [
        C.autofillBelowCeiling,
        ...(i.upgradeDoor
          ? [C.autofillBelowUpgrade(C.upTitle(levelNumberLabel(brackets, target)))]
          : []),
      ]
    : [C.autofillBelowFloor(levelLabel(brackets, target))];
  return { kind: "below", head: shows, notes, status: shows };
}
