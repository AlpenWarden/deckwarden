/**
 * A read against a target, as facts: the verdict under a list a sheet is
 * about to apply. BRACKET-UP's after-line ("After these swaps…") worked it
 * out inline; AUTOFILL-TARGET's ("With these added…") says different
 * sentences over the same verdict, so the rule lives here once and the
 * words stay the callers' (BRACKET_COPY). Pure; types only.
 *
 * - `above`: the read's findings above the target, in the read's order
 *   (its `conflicts`). None without a target: a read assessed with no
 *   target names none.
 * - `reached`: nothing above the target, and the floor (the answers' level
 *   when something is answered, else the minimum the cards prove) at or
 *   over it. Never without a target.
 * - `head`: what the first sentence is about. Findings above the target
 *   lead; then the level the cards and the answers say; then nothing
 *   flagged at all; else the floor the cards prove.
 * - `proving`: the findings at the read's minimum, what proves the floor
 *   (none while the minimum is the lowest level).
 *
 * A read's status is not read here: a list under the format's size, a card
 * that is not legal and a source that couldn't be checked are the caller's
 * to say (Upgrade toward keeps a list's size and legality, so it never met
 * the first two; Autofill can build a short list, and says so).
 */
import type { BracketFactor, BracketRead, BracketsMeta } from "@/lib/games/types";

export type AfterHead =
  | { kind: "above"; count: number }
  | { kind: "answers"; level: number }
  | { kind: "nothing" }
  | { kind: "floor"; level: number };

export interface AfterVerdict {
  above: BracketFactor[];
  reached: boolean;
  head: AfterHead;
  proving: BracketFactor[];
}

export function afterVerdict(
  brackets: Pick<BracketsMeta, "levels">,
  read: BracketRead,
  target: number | null,
): AfterVerdict {
  const lowest = brackets.levels[0]?.level ?? 1;
  const above = read.factors.filter((f) => read.conflicts.includes(f.id));
  const floor = read.suggested ?? read.minimum;
  return {
    above,
    reached: target !== null && above.length === 0 && floor >= target,
    head:
      above.length > 0
        ? { kind: "above", count: above.length }
        : read.suggested !== null
          ? { kind: "answers", level: read.suggested }
          : read.minimum <= lowest
            ? { kind: "nothing" }
            : { kind: "floor", level: read.minimum },
    proving:
      read.minimum > lowest
        ? read.factors.filter((f) => f.atLeast !== null && f.atLeast === read.minimum)
        : [],
  };
}
