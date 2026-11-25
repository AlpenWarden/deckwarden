"use client";

/**
 * The autofill review sheet (W9b, D8): renders POST /api/decks/autofill —
 * every pick with its evidence, price and a checkbox — and applies the
 * checked picks as ONE whole-list swap through the editor's applyListSwap
 * (Undo built in). The sheet itself never writes: Reroll and the control
 * changes re-POST (the route writes nothing), and only Apply touches the
 * deck.
 *
 * State model (pinned): everything lives in this component, which mounts on
 * open and unmounts on close — nothing survives a close/reopen, and
 * reopening refetches. Stale-shell invalidation is structural: the sheet is
 * modal, so the deck cannot change underneath an open shell. The response's
 * seed is held with the shell (a "same view" is reproducible in state) but
 * rendered nowhere — a shareable seed is W9c-adjacent, deliberately not
 * free-lanced here.
 *
 * Request semantics: leaders come from the leader zone; "Keep my N cards"
 * checked sends every non-leader entry as `keep`, unchecked sends none —
 * and Apply then REPLACES the non-leader list (the plan was built without
 * those cards; stacking picks on top would overfill). Reroll and every
 * control change POST without a seed (the server rolls). A 429 renders its
 * sentence with Retry disabled for the advertised window — never an
 * auto-retry.
 *
 * Row identity (pinned): one row per pick entry (zone, cardId) — a filler
 * entry renders once as "Wastes × 11", matching D8's one-row-per-card.
 * Validation `issues` (adapter validate over keep + picks, server-side)
 * surface as a warning block above the footer — the cheap honest slot.
 *
 * Pinned pieces (X3, WAVE3.md D3): with `pinned` (a combo from the hub
 * door's seed or the Combo Radar's "Suggest full list") the sheet is
 * "Build around this combo" — the lead names the combo, its pieces in the
 * deck render first as "Combo pieces · N" (always kept, no checkbox, each
 * labeled "Combo piece"), they are ALWAYS in the request's `keep` and
 * always in the list Apply builds, and "Keep my N cards" governs the other
 * cards only. Leader-zone pieces (the commander) ride `leaderIds`, never
 * `keep`, and are not counted. Without `pinned` nothing above changes.
 *
 * Goals (Y6b, WAVE4 D7): the deck's goals ride the request as Suggestions'
 * draft POST sends them (`suggestionGoals` — the target, the budget, the
 * answers; spread only when there are any, so a deck without goals sends
 * today's exact body), and the route keeps the shell inside the target. The
 * budget control starts from the deck's per-card goal, as Suggestions' does;
 * a pick of the sheet's own wins for as long as it's open (the budget is
 * one-shot — no "Save as this deck's budget" here). With a budget, the goals
 * line reads above the controls, without its Change: the Why sheet is
 * another dialog. The notes say what the target kept out, and what
 * building up to it brought in or is still short (AUTOFILL-REACH: the
 * route's doing, this sheet sends the same body).
 *
 * Your target (AUTOFILL-TARGET, the owner's note of 2026-11-15: "the option
 * to set your desired bracket as you click the autofill a starter shell
 * button"; it reverses Y6b's "no Save in the one-shot sheet; a read-only
 * goals line" for the target alone): where the adapter declares `brackets`,
 * the controls hold the Why sheet's own choice (the levels, then Not set),
 * starting at the deck's target.
 * - A pick asks the route again with `suggestionGoals(withTarget(goals,
 *   pick))`: nothing else in the body moves, so a pick of N sends what a
 *   deck whose target is N sends, and no pick sends today's body.
 * - The pick is the sheet's own until Add: opening, picking, rerolling and
 *   Cancel write nothing. Add hands it over with the list (`target`), and
 *   the editor stores it as the deck's target in the same burst when it
 *   differs. Under the choice, one line says so, and only then.
 * - The after-line, above Add: the read of exactly the list Add would hand
 *   over (`nextList`, built once for both), its combo facts through
 *   `useBracketFacts` (one GET per settled id set, the editor's own hook),
 *   worded by ../../lib/brackets/autofill-target.ts. A target is a ceiling:
 *   the planner never goes above it and promises nothing about reaching it,
 *   so the line says what the cards show, "That's your target." only when
 *   the read reaches it, anything above the choice in the read's own
 *   sentences (the commander, a kept card, a pinned combo), the deck's own
 *   line where the read leaves something open (a call that is the player's,
 *   a short list, a feed it couldn't check), a checking state, and Retry on
 *   a failure. Add never waits for it.
 * - The goals line stops naming the target (the choice does); its budget
 *   part stays.
 *
 * Only cards I own (AUTOFILL-OWNED, the owner's ask of 2026-11-24): a
 * checkbox in the controls row, in Suggestions' toggle's own words
 * (./owned-copy.tsx). The sheet asks nothing about the collection itself:
 * the editor hands it what it knows (`collection`), and the box follows.
 * - available: the box can be ticked. Ticked, the request gains
 *   `ownedOnly: true` and loses `budgetUsd` (nothing else moves, so the
 *   unticked body is today's byte for byte), Budget is switched off with its
 *   value still in view, and a line under the controls says why: a price
 *   limit says nothing about a card the player already has (the owner's
 *   decision 5). The route builds the list from the player's cards and says
 *   so (`owned.applied`).
 * - unavailable (a guest, or an account with no collection): disabled, with
 *   Suggestions' hint and its Account link. checking (a draft's editor is
 *   still asking): disabled, no line. failed: disabled, "Couldn't check your
 *   collection."
 * - The tick is the sheet's own, like Budget: it is never stored on the deck
 *   (decision 6), and a reopened sheet starts unticked.
 * - With the filter applied the footer counts the checked picks that came
 *   from the collection, in the price estimate's place: every pick but the
 *   adapter's fillers, which the list takes as needed and never checks (the
 *   route's note says so, with the other notes).
 * - The route refuses such an ask from a signed-out caller (401) or an
 *   account with no collection (409): a session that ended, or a collection
 *   wiped in another tab, while the sheet was open. Each gets its own
 *   sentence and Retry; nothing is asked again until the player acts, and
 *   the box stays ticked so nothing unfiltered is ever asked for them.
 */
import { CheckIcon, ChevronDownIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { CardNamePreview } from "@/components/deck/card-name-preview";
import { GoalsLine } from "@/components/deck/goals-line";
import { Segmented } from "@/components/deck/segmented";
import { useBracketFacts } from "@/components/deck/use-bracket-facts";
import { ImportCollectionHint, ONLY_OWNED_LABEL } from "@/components/editor/owned-copy";
import { sourceMeta } from "@/components/editor/recommendations-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  autofillAfter,
  autofillTargetNote,
  type AutofillAfter,
} from "@/lib/brackets/autofill-target";
import { BRACKET_COPY, NO_TARGET, targetChoices } from "@/lib/brackets/copy";
import { factsIds, type BracketFactsState } from "@/lib/brackets/facts";
import { alsoNeedsLine, type ComboPin } from "@/lib/combos/view";
import {
  mergeEntries,
  toEditorCard,
  type CardWire,
  type EditorCard,
  type EditorEntry,
} from "@/lib/decks/editor-state";
import { suggestionGoals, withTarget, type DeckGoals } from "@/lib/decks/goals";
import { isPlayableZone, playableEntries } from "@/lib/decks/playable";
import { addMorePhrase, deckProgress } from "@/lib/decks/progress";
import { toDeckSnapshot } from "@/lib/decks/validation";
import type { FormatDef, GameAdapter, ValidationIssue } from "@/lib/games/types";
import type { ShellGroup, ShellPick } from "@/lib/recommend/autofill";
import type { FitEstimate } from "@/lib/recommend/fit";
import { BUDGET_OPTIONS, tierOf, type BudgetTier } from "@/lib/recommend/budget";
import type { RecommendationEvidence } from "@/lib/recommend/types";
import { cn } from "@/lib/utils";

export const SHEET_TITLE = "Autofill a starter shell";
/** The title with a pinned combo (X3, D3). */
export const COMBO_SHEET_TITLE = "Build around this combo";

/** What Apply hands back: the full next list (pre-merge) + wires + the toast count. */
export interface AutofillApply {
  entries: EditorEntry[];
  cards: CardWire[];
  added: number;
  /**
   * AUTOFILL-TARGET: the sheet's choice of Your target when Add was pressed,
   * a level or null for Not set; the editor stores it as the deck's target
   * when it differs. Absent for a game without `brackets` (no choice shown).
   */
  target?: number | null;
  /**
   * AUTOFILL-OWNED: the added cards the route built from the player's
   * collection (every checked pick but the fillers), so the editor can mark
   * them owned with the list. Present only when the filter was applied.
   */
  owned?: string[];
}

/**
 * What the editor knows of the player's collection (AUTOFILL-OWNED), which
 * decides the "Only cards I own" box: `available` (an imported collection),
 * `unavailable` (a guest, or an account with none), `checking` (a draft's
 * editor is still asking) or `failed` (that check did not answer).
 */
export type CollectionState = "available" | "unavailable" | "checking" | "failed";

/** The route's response, as W9a shipped it (shapes shared via the planner's types). */
interface ShellResponse {
  seed: number;
  picks: ShellPick[];
  groups: ShellGroup[];
  notes: string[];
  totals: { picks: number; estUsd: number | null; unpriced: number };
  issues: ValidationIssue[];
  cards: CardWire[];
  /** AUTOFILL-OWNED: present, and applied, only when the list was built from the player's cards. */
  owned?: { applied: boolean };
}

type SheetState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; shell: ShellResponse };

/**
 * Retry's reason while a 429's window runs (U1, disabled with a reason): the
 * Button's `title`, which keeps it focusable and hoverable, and — U10a,
 * WAVE5.md D10's home for D1's reason — a `FieldDescription` beside the
 * button for as long as the lock runs, on every pointer: a phone has no
 * hover, and a control change during the window can replace the 429
 * sentence above with another error while Retry stays locked (LATER row
 * 216), so the line under Retry is what always says why.
 */
const RETRY_WAIT_REASON = "Too many requests. Retry works again after the wait.";

/** AUTOFILL-OWNED: the sheet's own sentences (pinned in its test). */
export const OWNED_COPY = {
  /** Under the controls while the box is ticked: why Budget is off. */
  budgetOff: "Budget is off. Price limits don't apply to cards you own.",
  /** The editor's collection check did not answer. */
  checkFailed: "Couldn't check your collection.",
  /** The route's 401: the session ended while the sheet was open. */
  signedOut: `Sign in to build from your collection, or untick “${ONLY_OWNED_LABEL}” for the full list.`,
  /** The route's 409: the collection is gone (wiped in another tab). */
  noCollection: `No collection found on this account. Untick “${ONLY_OWNED_LABEL}” for the full list.`,
} as const;

/**
 * The footer's count with the filter applied (AUTOFILL-OWNED): how many of
 * the cards Add would add came from the collection. The rest are the
 * adapter's fillers, which the route's note covers.
 */
export function collectionCountLine(fromCollection: number, added: number): string {
  if (added === 1) {
    return fromCollection === 1
      ? "This card is from your collection."
      : "This card isn't from your collection.";
  }
  return `${fromCollection} of these ${added} cards are from your collection.`;
}

const pickKey = (p: { zone: string; cardId: string }) => `${p.zone}\u0000${p.cardId}`;

export function AutofillSheet({
  adapter,
  format,
  entries,
  cards,
  phone,
  pinned,
  goals = null,
  estimate = null,
  linkPreviews = true,
  upgradeDoor = false,
  collection = "unavailable",
  onApply,
  onClose,
}: {
  adapter: GameAdapter;
  format: FormatDef;
  /** The editor's CURRENT list — leaders drive the request, non-leaders are the keeps. */
  entries: readonly EditorEntry[];
  cards: ReadonlyMap<string, EditorCard>;
  /** Phone tier renders the bottom Drawer; md+ the wide Dialog (D8). */
  phone: boolean;
  /** The combo this sheet is built around (X3): its pieces are always kept. */
  pinned?: ComboPin;
  /** The deck's goals (Y6b): the shell keeps inside the target; the budget starts from them. */
  goals?: DeckGoals | null;
  /** Y8: the deck's estimate — the goals line reads it beside a total. */
  estimate?: FitEstimate | null;
  /** AUTOFILL-TARGET: whether the deck's link previews draw a target (never for a private deck), as the Why sheet takes it. */
  linkPreviews?: boolean;
  /** AUTOFILL-TARGET: whether the editor can open Upgrade toward once the cards are in (it names the door for a shell short of its target). */
  upgradeDoor?: boolean;
  /** AUTOFILL-OWNED: what the editor knows of the player's collection; absent = none to build from. */
  collection?: CollectionState;
  onApply: (apply: AutofillApply) => void;
  onClose: () => void;
}) {
  const leaderZone = format.zones.find((z) => z.isLeaderZone);
  const leaders = useMemo(
    () => (leaderZone ? entries.filter((e) => e.zone === leaderZone.id) : []),
    [entries, leaderZone],
  );
  // The playable list's non-leader cards (DECK-TOKENS): tokens are neither kept nor counted.
  const keeps = useMemo(
    () => playableEntries(entries, format).filter((e) => e.zone !== leaderZone?.id),
    [entries, format, leaderZone],
  );
  // Pinned (X3): the combo's pieces among the keeps — always sent, always
  // applied. "Keep my N cards" counts and governs only the rest.
  const pinnedIds = useMemo(() => new Set(pinned?.pieceIds ?? []), [pinned]);
  const pinnedKeeps = useMemo(
    () => keeps.filter((e) => pinnedIds.has(e.cardId)),
    [keeps, pinnedIds],
  );
  const keepCount = keeps.filter((e) => !pinnedIds.has(e.cardId)).reduce((n, e) => n + e.qty, 0);

  // The budget starts from the deck's goal (Y6b, as Suggestions'); a pick of its own wins.
  const [pick, setPick] = useState<BudgetTier | null>(null);
  const budget = pick ?? tierOf(goals?.budget?.perCardUsd);
  // Your target (AUTOFILL-TARGET): the sheet's own choice, starting at the
  // deck's. It rides the request's goals and nothing else; the deck's target
  // moves only on Add.
  const brackets = adapter.brackets;
  const deckTarget = brackets ? (goals?.targetLevel ?? null) : null;
  const [target, setTarget] = useState<number | null>(deckTarget);
  // The sheet opens with focus on the choice's pressed segment (the Why
  // sheet's way): the first tabbable would otherwise be its first level, one
  // keypress from a pick nobody made. No choice (no brackets, no commander):
  // the dialog's own default.
  const targetRef = useRef<HTMLDivElement>(null);
  const initialFocus = brackets
    ? () => targetRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? null
    : undefined;
  const sentGoals = useMemo(
    () => suggestionGoals(brackets ? withTarget(goals, target) : goals),
    [brackets, goals, target],
  );
  const [keepChecked, setKeepChecked] = useState(true);
  // Only cards I own (AUTOFILL-OWNED): the sheet's own tick, and only ever
  // sent while the editor says there is a collection to build from.
  const [ownedTicked, setOwnedTicked] = useState(false);
  const ownedOnly = ownedTicked && collection === "available";
  const ownedNoteId = useId();
  const [nonce, setNonce] = useState(0);
  const [sheet, setSheet] = useState<SheetState>({ state: "loading" });
  /** Unchecked pick keys (default: everything checked) and expanded evidence keys. */
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  /** 429: Retry stays disabled for the advertised window (never auto-retried). */
  const [retryLocked, setRetryLocked] = useState(false);
  const retryReasonId = useId();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    [],
  );

  // One POST per open and per control change / reroll; the cleanup abort
  // means a closed sheet never spends another rate unit and a superseded
  // request never lands (the reroll budget IS the rate budget).
  const leaderIds = leaders.map((e) => e.cardId).join(",");
  useEffect(() => {
    if (!leaderZone || leaderIds === "") return;
    const controller = new AbortController();
    void (async () => {
      setSheet({ state: "loading" });
      try {
        const res = await fetch("/api/decks/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            game: adapter.id,
            format: format.code,
            leaderIds: leaderIds.split(","),
            keep: keeps
              .filter((e) => keepChecked || pinnedIds.has(e.cardId))
              .map((e) => ({ cardId: e.cardId, zone: e.zone, qty: e.qty })),
            // AUTOFILL-OWNED: ticked, the per-card budget is left out (it is
            // off) and the flag goes last; unticked, neither line changes
            // the body by a byte.
            ...(budget !== "all" && !ownedOnly ? { budgetUsd: Number(budget) } : {}),
            ...(sentGoals ? { goals: sentGoals } : {}),
            ...(ownedOnly ? { ownedOnly: true } : {}),
          }),
        });
        if (res.status === 429) {
          const after = Math.max(1, Number(res.headers.get("Retry-After")) || 30);
          setRetryLocked(true);
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => setRetryLocked(false), after * 1000);
          setSheet({
            state: "error",
            message: `Too many autofill requests. Try again in ${after} seconds.`,
          });
          return;
        }
        // AUTOFILL-OWNED: the route's two refusals of an owned ask. Each has
        // its sentence and an enabled Retry; nothing is asked again until
        // the player presses it or changes a control.
        if (ownedOnly && (res.status === 401 || res.status === 409)) {
          setSheet({
            state: "error",
            message: res.status === 401 ? OWNED_COPY.signedOut : OWNED_COPY.noCollection,
          });
          return;
        }
        if (!res.ok) throw new Error(`Autofill failed (${res.status})`);
        const shell: ShellResponse = await res.json();
        setExcluded(new Set());
        setExpanded(new Set());
        setSheet({ state: "ready", shell });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSheet({
          state: "error",
          message: "Couldn't build the shell. Check your connection and try again.",
        });
      }
    })();
    return () => controller.abort();
    // keeps derives from entries and pinnedIds from the pin — both stable
    // while this modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    adapter.id,
    format.code,
    leaderZone,
    leaderIds,
    keepChecked,
    budget,
    ownedOnly,
    sentGoals,
    nonce,
  ]);

  const shell = sheet.state === "ready" ? sheet.shell : null;
  const checkedPicks = useMemo(
    () => (shell ? shell.picks.filter((p) => !excluded.has(pickKey(p))) : []),
    [shell, excluded],
  );
  const addedCount = checkedPicks.reduce((n, p) => n + p.qty, 0);
  // Live totals over the CHECKED picks (the server's totals cover them all).
  const est = useMemo(() => {
    let usd = 0;
    let priced = false;
    let unpriced = 0;
    for (const p of checkedPicks) {
      if (p.cheapestUsd !== null) {
        usd += Number(p.cheapestUsd) * p.qty;
        priced = true;
      } else {
        unpriced += p.qty;
      }
    }
    return { usd: priced ? usd : null, unpriced };
  }, [checkedPicks]);
  // AUTOFILL-OWNED: the list on screen was built from the player's cards
  // (the route's word, not the box's), and how many of the checked picks
  // those are: every pick but the adapter's fillers.
  const ownedApplied = shell?.owned?.applied === true;
  const fromCollectionCount = checkedPicks.reduce(
    (n, p) => n + (p.tier === "filler" ? 0 : p.qty),
    0,
  );

  /** "41 from Topdeck.gg, 21 from EDHREC, 37 from Land template" — adapter labels (U9: one dot a line). */
  const sourceLine = useMemo(() => {
    if (!shell) return null;
    const byLabel = new Map<string, number>();
    for (const p of shell.picks) {
      const source = p.evidence[0]?.source;
      if (!source) continue;
      const { label } = sourceMeta(adapter, source);
      byLabel.set(label, (byLabel.get(label) ?? 0) + p.qty);
    }
    if (byLabel.size === 0) return null;
    return [...byLabel].map(([label, qty]) => `${qty} from ${label}`).join(", ");
  }, [shell, adapter]);

  const toggle = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleGroup = (picks: readonly ShellPick[], allChecked: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const p of picks) {
        if (allChecked) next.add(pickKey(p));
        else next.delete(pickKey(p));
      }
      return next;
    });
  };

  // The list Add hands over (AUTOFILL-TARGET: built once, for Add and for
  // the after-line's read); null with nothing checked.
  const nextList = useMemo<EditorEntry[] | null>(() => {
    if (!shell || addedCount === 0) return null;
    // Keep checked: picks land on top of the whole current list. Unchecked:
    // the plan was built without the non-leader cards, so Apply replaces
    // them — leaders + picks (see the module doc; pinned in tests) — except
    // a pinned combo's pieces, which the plan was built around (X3), and the
    // Tokens zone (DECK-TOKENS), which was never part of the 100 it rebuilt.
    const base = keepChecked
      ? [...entries]
      : entries.filter(
          (e) =>
            (leaderZone && e.zone === leaderZone.id) ||
            pinnedIds.has(e.cardId) ||
            !isPlayableZone(format, e.zone),
        );
    return [
      ...base,
      ...checkedPicks.map((p) => ({ cardId: p.cardId, zone: p.zone, qty: p.qty, tags: [] })),
    ];
  }, [shell, addedCount, keepChecked, entries, format, leaderZone, pinnedIds, checkedPicks]);

  const apply = useCallback(() => {
    if (!shell || !nextList) return;
    onApply({
      entries: nextList,
      cards: shell.cards,
      added: addedCount,
      ...(brackets ? { target } : {}),
      ...(ownedApplied
        ? { owned: checkedPicks.filter((p) => p.tier !== "filler").map((p) => p.cardId) }
        : {}),
    });
  }, [shell, nextList, addedCount, brackets, target, ownedApplied, checkedPicks, onApply]);

  // The after-line's read (AUTOFILL-TARGET): that list as the editor will
  // hold it (merged), its combo facts by the editor's own hook (one GET per
  // settled id set, nothing written), the adapter's assess with the choice
  // as its target, and the deck's answers as the deck pane's read takes them.
  const afterList = useMemo(() => (nextList ? mergeEntries(nextList) : null), [nextList]);
  const afterIds = useMemo(
    () => (afterList ? factsIds(playableEntries(afterList, format)) : []),
    [afterList, format],
  );
  const facts = useBracketFacts({
    game: adapter.id,
    enabled: brackets !== undefined && afterList !== null,
    ids: afterIds,
  });
  const allCards = useMemo(() => {
    const all = new Map<string, EditorCard>(cards);
    if (shell) for (const w of shell.cards) if (!all.has(w.id)) all.set(w.id, toEditorCard(w));
    return all;
  }, [cards, shell]);
  const answers = goals?.answers ?? null;
  const after = useMemo<AutofillAfter | null>(() => {
    if (!brackets || !afterList || facts.state !== "ready") return null;
    const deck = toDeckSnapshot(adapter.id, format, afterList);
    const input = {
      deck,
      cards: allCards,
      combos: facts.combos,
      freshness: facts.freshness,
      targetLevel: target,
      answers,
    };
    const read = brackets.assess(input);
    return autofillAfter({
      brackets,
      read,
      input,
      target,
      line: brackets.line(read, {
        deck,
        cards: allCards,
        progress: addMorePhrase(deckProgress(afterList, format).toGo),
        targetLevel: target,
      }),
      upgradeDoor,
    });
  }, [
    brackets,
    afterList,
    facts.state,
    facts.combos,
    facts.freshness,
    adapter.id,
    format,
    allCards,
    target,
    answers,
    upgradeDoor,
  ]);
  // Under the choice: what Add will do to the deck's target, only when it would move it.
  const targetNote = brackets
    ? autofillTargetNote(brackets, deckTarget, target, linkPreviews)
    : null;

  const leaderNames = leaders
    .map((e) => cards.get(e.cardId)?.name)
    .filter((n): n is string => Boolean(n))
    .join(" + ");
  const wireById = useMemo(() => {
    const map = new Map<string, CardWire>();
    if (shell) for (const w of shell.cards) map.set(w.id, w);
    return map;
  }, [shell]);

  const title = pinned ? COMBO_SHEET_TITLE : SHEET_TITLE;
  const alsoNeeds = pinned ? alsoNeedsLine(pinned.templates) : null;
  // The line under the controls (AUTOFILL-OWNED): why the box is off, or,
  // ticked, why Budget is. Nothing while the editor is still checking.
  const ownedNote =
    collection === "unavailable" ? (
      <ImportCollectionHint />
    ) : collection === "failed" ? (
      OWNED_COPY.checkFailed
    ) : ownedOnly ? (
      OWNED_COPY.budgetOff
    ) : null;
  const content =
    leaders.length === 0 ? (
      <p className="text-muted-foreground text-sm">
        Set a {adapter.display.leaderNoun.toLowerCase()} first. The starter shell is built around
        one.
      </p>
    ) : (
      <>
        <p className="text-muted-foreground text-sm">
          {pinned ? (
            <>
              {pinned.label}. The rest comes from real decklists and tournament results. Every pick
              shows why.
            </>
          ) : (
            <>
              Built from real decklists and tournament results for{" "}
              {leaderNames || `your ${adapter.display.leaderNoun}`}. Every pick shows why.
            </>
          )}
        </p>

        {/* The deck's budget goals (Y6b): read-only here — the Why sheet is
            another dialog. The target is the choice below (AUTOFILL-TARGET),
            so the line never names it: no `brackets`, the budget alone. */}
        {(goals?.budget?.perCardUsd !== undefined || goals?.budget?.totalUsd !== undefined) && (
          <GoalsLine brackets={undefined} goals={goals} estimate={estimate} />
        )}

        {/* Your target (AUTOFILL-TARGET): the Why sheet's own choice, the
            sheet's until Add. Its label wraps above it on a phone, where six
            44 px segments take the row. */}
        {brackets && (
          <div ref={targetRef} data-slot="autofill-target" className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <span aria-hidden className="text-muted-foreground text-xs">
                {BRACKET_COPY.yourTarget}
              </span>
              <Segmented
                ariaLabel={BRACKET_COPY.yourTarget}
                options={targetChoices(brackets)}
                value={target === null ? NO_TARGET : String(target)}
                onChange={(value) => setTarget(value === NO_TARGET ? null : Number(value))}
              />
            </div>
            {targetNote && (
              <p data-slot="autofill-target-note" className="text-muted-foreground text-xs">
                {targetNote}
              </p>
            )}
          </div>
        )}

        {/* Controls: budget chips · keep checkbox · only cards I own · Reroll
            (D8; AUTOFILL-OWNED). The line under them is the owned box's: why
            it is off, or, ticked, why Budget is. It sits under the row, so no
            control moves when it comes and goes. */}
        <div data-slot="autofill-controls" className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmented
              label="Budget"
              options={BUDGET_OPTIONS}
              value={budget}
              onChange={setPick}
              disabled={ownedOnly}
              describedBy={ownedOnly ? ownedNoteId : undefined}
            />
            {keepCount > 0 && (
              <Field orientation="horizontal" className="w-auto gap-1.5">
                <Checkbox checked={keepChecked} onCheckedChange={(next) => setKeepChecked(next)} />
                <FieldLabel className="cursor-pointer">
                  Keep my {keepCount} card{keepCount === 1 ? "" : "s"}
                </FieldLabel>
              </Field>
            )}
            <Field
              orientation="horizontal"
              disabled={collection !== "available"}
              className="w-auto gap-1.5"
            >
              <Checkbox
                checked={ownedOnly}
                onCheckedChange={(next) => setOwnedTicked(next)}
                aria-describedby={ownedNote ? ownedNoteId : undefined}
              />
              <FieldLabel className={collection === "available" ? "cursor-pointer" : undefined}>
                {ONLY_OWNED_LABEL}
              </FieldLabel>
            </Field>
            <Button
              variant="outline"
              size="sm"
              disabled={sheet.state === "loading"}
              onClick={() => setNonce((n) => n + 1)}
            >
              <RotateCcwIcon aria-hidden />
              Reroll
            </Button>
          </div>
          {ownedNote && (
            <p
              id={ownedNoteId}
              data-slot="autofill-owned-note"
              className="text-muted-foreground text-xs"
            >
              {ownedNote}
            </p>
          )}
        </div>

        {sheet.state === "loading" && (
          <div className="space-y-2" aria-label="Building the shell…">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        )}

        {sheet.state === "error" && (
          <Field className="gap-2">
            <p className="text-destructive text-sm">{sheet.message}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                variant="outline"
                size="sm"
                disabled={retryLocked}
                title={retryLocked ? RETRY_WAIT_REASON : undefined}
                aria-describedby={retryLocked ? retryReasonId : undefined}
                onClick={() => setNonce((n) => n + 1)}
              >
                Retry
              </Button>
              {retryLocked && (
                <FieldDescription id={retryReasonId}>{RETRY_WAIT_REASON}</FieldDescription>
              )}
            </div>
          </Field>
        )}

        {shell && (
          <>
            {sourceLine && <p className="text-muted-foreground text-xs">{sourceLine}</p>}
            {/* The planner's notes, verbatim (vocabulary pinned server-side). */}
            {shell.notes.map((note) => (
              <p key={note} className="text-sm">
                {note}
              </p>
            ))}

            {/* From md the list scrolls inside the Modal, never under 10 rem:
                a short window scrolls the whole dialog before the list is
                squeezed out. On a phone the sheet scrolls as one and the
                footer below is pinned (AUTOFILL-TARGET: the choice, its note
                and the after-line would otherwise leave the list no room). */}
            <div
              data-slot="autofill-picks"
              className={phone ? "space-y-2" : "min-h-40 flex-1 space-y-2 overflow-y-auto"}
            >
              {pinnedKeeps.length > 0 && <PinnedGroup entries={pinnedKeeps} cards={cards} />}
              {shell.groups.map((group) => (
                <PickGroup
                  key={group.id}
                  adapter={adapter}
                  group={group}
                  picks={shell.picks.filter((p) => p.group === group.id)}
                  excluded={excluded}
                  expanded={expanded}
                  wireById={wireById}
                  onToggle={toggle}
                  onToggleGroup={toggleGroup}
                  onToggleEvidence={(key) =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                />
              ))}
            </div>

            {/* The pinned combo's non-card requirements (D3), in the Radar's words. */}
            {alsoNeeds && <p className="text-xs text-amber-700 dark:text-amber-400">{alsoNeeds}</p>}

            {shell.picks.length > 0 && (
              <p className="text-muted-foreground text-xs">
                A starter shell, not a tuned list. Swap in your{" "}
                {adapter.display.leaderNoun.toLowerCase()}&apos;s synergy pieces.
              </p>
            )}

            {/* Server-side validate over keep + picks — the honest slot above Apply. */}
            {shell.issues.length > 0 && (
              <div className="space-y-0.5">
                {shell.issues.map((issue, i) => (
                  <p
                    key={i}
                    className={`text-xs ${issue.severity === "error" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {issue.message}
                  </p>
                ))}
              </div>
            )}

            <div
              data-slot="autofill-footer"
              className={cn(
                "flex flex-wrap items-end justify-between gap-2 border-t pt-3",
                // The phone's pinned footer: the Drawer's own surface, edge to
                // edge, clear of the home indicator; `mt-auto` keeps it at
                // the foot when the list is short.
                phone &&
                  "sticky bottom-0 z-10 -mx-4 mt-auto bg-popover px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
              )}
            >
              <div className="min-w-0 flex-1 basis-56 space-y-1">
                {/* AUTOFILL-TARGET: what the list Add would build reads, above Add. */}
                {brackets && (
                  <AfterLine
                    shown={afterList !== null}
                    state={facts.state}
                    after={after}
                    onRetry={facts.retry}
                  />
                )}
                {/* The price estimate; with the list built from the player's
                    cards (AUTOFILL-OWNED), the count of those in its place. */}
                <p className="text-muted-foreground text-xs">
                  {ownedApplied ? (
                    addedCount > 0 && collectionCountLine(fromCollectionCount, addedCount)
                  ) : (
                    <>
                      {addedCount > 0 &&
                        (est.usd !== null
                          ? `Est. total $${est.usd.toFixed(0)} (cheapest printings)`
                          : "No price data for these picks.")}
                      {est.unpriced > 0 && ` · ${est.unpriced} unpriced`}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" disabled={addedCount === 0} onClick={apply}>
                  Add {addedCount} card{addedCount === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </>
        )}
      </>
    );

  // Dialog (wide) from md; full-height bottom Drawer on phones (D8; the W5
  // printing drawer and R4 card sheet are the house styles).
  if (phone) {
    return (
      <Drawer
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        showSwipeHandle
      >
        <DrawerContent
          aria-label={title}
          initialFocus={initialFocus}
          className="[--drawer-height:calc(100dvh-3rem)]"
        >
          <DrawerHeader className="pb-2">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          {/* With a shell the pinned footer carries the foot's padding. */}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4",
              !shell && "pb-6",
            )}
          >
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Modal label={title} onClose={onClose} wide initialFocus={initialFocus}>
      {content}
    </Modal>
  );
}

/** A text control after a gap in a line (U9). */
const INLINE_ACTION = "cursor-pointer underline underline-offset-4 pointer-coarse:min-h-11";

/**
 * The after-line (AUTOFILL-TARGET): what the list Add would build reads,
 * in ../../lib/brackets/autofill-target.ts' words. Nothing while nothing is
 * checked; "Checking…" until the list's combo facts land; a failure said
 * plainly with Retry (none over the facts route's id cap, where nothing is
 * asked). A short polite status says the verdict alone, never "Checking…".
 */
function AfterLine({
  shown,
  state,
  after,
  onRetry,
}: {
  /** A list to read: at least one pick checked. */
  shown: boolean;
  state: BracketFactsState;
  after: AutofillAfter | null;
  onRetry: () => void;
}) {
  const C = BRACKET_COPY;
  let body = null;
  if (shown) {
    if (state === "failed" || state === "over") {
      body = (
        <p data-slot="autofill-after" data-after="failed" className="text-sm">
          {C.autofillAfterFailed}
          {state === "failed" && (
            <>
              {" "}
              <button type="button" onClick={onRetry} className={INLINE_ACTION}>
                {C.retry}
              </button>
            </>
          )}
        </p>
      );
    } else if (!after) {
      body = (
        <p
          data-slot="autofill-after"
          data-after="checking"
          className="text-muted-foreground text-sm"
        >
          {C.autofillAfterChecking}
        </p>
      );
    } else if (after.kind === "above") {
      body = (
        <div data-slot="autofill-after" data-after="above" className="text-sm">
          <p className="font-medium">{after.lead}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs">
            {after.above.map((f) => (
              <li key={f.id} data-after-conflict={f.id} className="break-words">
                {f.sentence}
              </li>
            ))}
          </ul>
        </div>
      );
    } else if (after.kind === "line") {
      body = (
        <div data-slot="autofill-after" data-after="line" className="text-sm">
          <p className="text-muted-foreground text-xs">{after.lead}</p>
          <p className="font-medium break-words">{after.line}</p>
        </div>
      );
    } else {
      body = (
        <div data-slot="autofill-after" data-after={after.kind} className="text-sm">
          <p className="font-medium">{after.head}</p>
          {after.notes.length > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">{after.notes.join(" ")}</p>
          )}
        </div>
      );
    }
  }
  return (
    <>
      {body}
      <span role="status" data-slot="autofill-after-status" className="sr-only">
        {shown && after ? after.status : ""}
      </span>
    </>
  );
}

/** The pinned combo's pieces (X3, D3): first, always kept — no checkbox, nothing to toggle. */
function PinnedGroup({
  entries,
  cards,
}: {
  entries: readonly EditorEntry[];
  cards: ReadonlyMap<string, EditorCard>;
}) {
  return (
    <section aria-label="Combo pieces" className="rounded-lg border">
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium">
        <span className="min-w-0 flex-1 truncate">
          Combo pieces · {entries.reduce((n, e) => n + e.qty, 0)}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs font-normal">always kept</span>
      </div>
      <ul className="space-y-1 border-t px-2.5 py-1.5">
        {entries.map((entry) => {
          const card = cards.get(entry.cardId);
          const name = card?.name ?? "Combo piece";
          return (
            <li key={pickKey(entry)} className="flex items-center gap-2 text-sm">
              {/* The Radar's "complete" green: text-primary is 1.49:1 on the dark sheet. */}
              <CheckIcon
                aria-hidden
                className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
              />
              <CardNamePreview name={name} image={card?.image ?? null}>
                <Link
                  href={`/cards/${entry.cardId}`}
                  target="_blank"
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {name}
                </Link>
              </CardNamePreview>
              <span className="text-muted-foreground shrink-0 text-xs">Combo piece</span>
              {card?.cheapestUsd != null && (
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  ${card.cheapestUsd.toFixed(2)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PickGroup({
  adapter,
  group,
  picks,
  excluded,
  expanded,
  wireById,
  onToggle,
  onToggleGroup,
  onToggleEvidence,
}: {
  adapter: GameAdapter;
  group: ShellGroup;
  picks: readonly ShellPick[];
  excluded: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  wireById: ReadonlyMap<string, CardWire>;
  onToggle: (key: string) => void;
  onToggleGroup: (picks: readonly ShellPick[], allChecked: boolean) => void;
  onToggleEvidence: (key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const checked = picks.filter((p) => !excluded.has(pickKey(p)));
  const allChecked = checked.length === picks.length;
  const someChecked = checked.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Checkbox
          aria-label={`Include ${group.label}`}
          checked={allChecked}
          indeterminate={someChecked && !allChecked}
          onCheckedChange={() => onToggleGroup(picks, allChecked)}
        />
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-sm font-medium">
          <span className="min-w-0 flex-1 truncate">
            {group.label} · {checked.reduce((n, p) => n + p.qty, 0)}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <ul className="space-y-1 border-t px-2.5 py-1.5">
          {picks.map((pick) => (
            <PickRow
              key={pickKey(pick)}
              adapter={adapter}
              pick={pick}
              checked={!excluded.has(pickKey(pick))}
              expanded={expanded.has(pickKey(pick))}
              wire={wireById.get(pick.cardId)}
              onToggle={() => onToggle(pickKey(pick))}
              onToggleEvidence={() => onToggleEvidence(pickKey(pick))}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PickRow({
  adapter,
  pick,
  checked,
  expanded,
  wire,
  onToggle,
  onToggleEvidence,
}: {
  adapter: GameAdapter;
  pick: ShellPick;
  checked: boolean;
  expanded: boolean;
  wire: CardWire | undefined;
  onToggle: () => void;
  onToggleEvidence: () => void;
}) {
  const top = pick.evidence[0];
  const more = pick.evidence.length - 1;
  const price = pick.cheapestUsd !== null ? `$${Number(pick.cheapestUsd).toFixed(2)}` : null;
  // One row per pick entry: a filler's quantity rides the row ("Wastes × 11").
  const label = pick.qty > 1 ? `${pick.name} × ${pick.qty}` : pick.name;

  return (
    <li className="text-sm">
      <div className="flex items-center gap-2">
        <Checkbox aria-label={`Include ${label}`} checked={checked} onCheckedChange={onToggle} />
        <CardNamePreview name={pick.name} image={wire?.image ?? null}>
          <Link
            href={`/cards/${pick.cardId}`}
            target="_blank"
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {label}
          </Link>
        </CardNamePreview>
        {price && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{price}</span>
        )}
      </div>
      {top && (
        <p className="text-muted-foreground mt-0.5 pl-6 text-xs leading-relaxed">
          {top.why}
          <SourceCredit adapter={adapter} evidence={top} />
          {more > 0 && (
            <button
              type="button"
              className="ml-1.5 cursor-pointer underline"
              aria-expanded={expanded}
              onClick={onToggleEvidence}
            >
              {expanded ? "less" : `+${more} more`}
            </button>
          )}
        </p>
      )}
      {expanded &&
        pick.evidence.slice(1).map((e, i) => (
          <p key={i} className="text-muted-foreground mt-0.5 pl-6 text-xs leading-relaxed">
            {e.why}
            <SourceCredit adapter={adapter} evidence={e} />
          </p>
        ))}
    </li>
  );
}

/** The evidence entry's source label — linked when declared (Topdeck.gg credit
 *  is the hard attribution rule wherever tournament evidence renders). */
function SourceCredit({
  adapter,
  evidence,
}: {
  adapter: GameAdapter;
  evidence: RecommendationEvidence;
}) {
  const src = sourceMeta(adapter, evidence.source);
  return (
    <>
      {" ("}
      {src.href ? (
        <a href={src.href} target="_blank" rel="noreferrer" className="underline">
          {src.label}
        </a>
      ) : (
        src.label
      )}
      {")"}
    </>
  );
}
