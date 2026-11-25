"use client";

/**
 * The deck total's field (Y8, WAVE4 D9; one component since AUTOFILL-TOTAL):
 * a whole-dollar field with presets, wherever a total for the whole deck is
 * set. The Fit sheet has had it since Y8; the Autofill sheet shows the same
 * field under Budget, so the two cannot drift apart.
 *
 * - Typing commits nothing. The submit button, Enter or a preset does
 *   (`onCommit`, whole dollars from 1 to TOTAL_MAX_USD). Anything else typed
 *   is refused with one line, and nothing is committed.
 * - The field follows the total in force (`committed`): a preset pressed, or
 *   a total cleared from outside, shows in the box at once.
 * - `notSet` (the Autofill sheet) adds a first chip that clears the total;
 *   it reads pressed while there is none. The Fit sheet has its own "Remove
 *   this deck's total" and leaves it out.
 * - `quiet` is the Autofill sheet's controls row: the label in the row's
 *   muted ink and an outline submit, so the field sits level with Budget and
 *   Reroll. Without it, the Fit sheet's own look, as it was.
 * - `disabled` switches the whole control off with its value still in view
 *   (the Autofill sheet, while "Only cards I own" is ticked); the reason is a
 *   line of the caller's, named by `describedBy`.
 */
import { useId, useState, type FormEvent, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/collection/ownership";
import { TOTAL_MAX_USD } from "@/lib/recommend/budget";
import { FIT_COPY } from "@/lib/recommend/fit";
import { cn } from "@/lib/utils";

/** A pressed chip reads as Segmented's pressed item does. */
const CHIP = "pointer-coarse:min-h-11 aria-pressed:bg-accent aria-pressed:text-accent-foreground";

const textOf = (usd: number | null) => (usd === null ? "" : String(usd));

export function DeckTotalField({
  committed,
  presets,
  submitLabel,
  onCommit,
  notSet,
  inputRef,
  quiet = false,
  disabled = false,
  describedBy,
}: {
  /** The total in force, whole dollars; null = none. */
  committed: number | null;
  presets: readonly number[];
  /** The submit button's word ("Fit", "Set"). */
  submitLabel: string;
  onCommit: (usd: number) => void;
  /** A first chip that clears the total: its label, and what it does. */
  notSet?: { label: string; onClear: () => void };
  inputRef?: Ref<HTMLInputElement>;
  quiet?: boolean;
  disabled?: boolean;
  /** The id of the line that says why the control is off. */
  describedBy?: string;
}) {
  const fieldId = useId();
  const [field, setField] = useState(() => textOf(committed));
  const [invalid, setInvalid] = useState(false);
  // The box follows the total in force (adjusted during render, one pass).
  const [shown, setShown] = useState(committed);
  if (shown !== committed) {
    setShown(committed);
    setField(textOf(committed));
    setInvalid(false);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const usd = Number(field.replace(/[$,\s]/g, ""));
    if (!Number.isInteger(usd) || usd < 1 || usd > TOTAL_MAX_USD) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    // The same total again still tidies the box ("$100" becomes "100").
    setField(String(usd));
    onCommit(usd);
  };

  return (
    <>
      <form
        data-slot="deck-total"
        onSubmit={submit}
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
      >
        <span className="flex items-center gap-x-2">
          <label
            htmlFor={fieldId}
            className={quiet ? "text-muted-foreground text-xs" : "text-sm font-medium"}
          >
            {FIT_COPY.totalLabel}
          </label>
          <span className="flex items-center gap-1">
            <span aria-hidden className="text-muted-foreground text-sm">
              $
            </span>
            <Input
              ref={inputRef}
              id={fieldId}
              inputMode="numeric"
              autoComplete="off"
              value={field}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                setField(e.target.value);
                setInvalid(false);
              }}
              className={cn("tabular-nums", quiet ? "h-7 w-20" : "h-8 w-24")}
            />
          </span>
          <Button
            type="submit"
            size="sm"
            variant={quiet ? "outline" : "default"}
            disabled={disabled}
          >
            {submitLabel}
          </Button>
        </span>
        <span className="flex flex-wrap gap-1">
          {notSet && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              aria-pressed={committed === null}
              onClick={notSet.onClear}
              className={CHIP}
            >
              {notSet.label}
            </Button>
          )}
          {presets.map((usd) => (
            <Button
              key={usd}
              type="button"
              size="xs"
              variant="outline"
              disabled={disabled}
              aria-pressed={committed === usd}
              onClick={() => onCommit(usd)}
              className={CHIP}
            >
              {formatUsd(usd)}
            </Button>
          ))}
        </span>
      </form>
      {invalid && (
        <p role="alert" className="text-destructive text-xs">
          {FIT_COPY.invalidTotal}
        </p>
      )}
    </>
  );
}
