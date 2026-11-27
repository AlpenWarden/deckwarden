"use client";

/**
 * Suggestions panel (P3.2) — the right pane's second tab, rendering the
 * recommendation engine's evidence payload (P3.1). Never a bare "add this":
 * every row leads with its strongest evidence sentence and keeps its source
 * names visible even collapsed; expanding shows every evidence entry — why,
 * the deck partners involved (linked), how often the source has seen it, and
 * a per-evidence confidence rendered exactly as reported ("low" says low —
 * the honesty is the product, so it is never restyled away).
 *
 * Fetch policy (the P3.2 decision): one GET per settled autosave burst.
 * Fetch only while the tab is visible AND a leader-zone card exists (no
 * leader = ci_mask 0 = colorless-only noise; the empty state says to add
 * one) AND autosave reports "saved" (the server rows ARE the engine's
 * input) AND the (card, zone, qty) key changed. Tag and meta edits never
 * refetch; the budget toggle, the deck total and Refresh do.
 *
 * Drafts (Y2b, WAVE4 D2): with no deck row yet — a seeded precon, combo,
 * Surprise me or chosen leader — the panel asks POST /api/recommendations
 * with the draft's snapshot instead (ids and copies; the server reads every
 * fact), under the same gate and the same key, so a seeded draft gets
 * Suggestions without minting a row, and only while this tab is open. The
 * moment a row exists the GET takes over; the key doesn't change when the
 * row mints, because the GET would answer the same snapshot.
 *
 * Adds ride the editor's normal path via the shared useResolvedAdd hook
 * (resolve once with the id guard, then onAdd → addCard → autosave); the
 * refetch-key/leader-gate helpers live in decks/panel-view.ts — both shared
 * with the Combo Radar (P3.3). Game knowledge (leader noun, source
 * labels/links) comes off the adapter.
 *
 * "Only cards I own" (P3.7): the engine's collections hook as an explicit
 * opt-in (`?owned=1`). Enabled only when the editor knows the user has an
 * imported collection; otherwise the checkbox is disabled with the honest
 * hint. The server may still decline (session expired, collection wiped in
 * another tab) — its `owned.reason` is shown, never a silent empty list.
 * On a draft the toggle stays off (AUTOFILL-OWNED, the owner's decision 8 of
 * 2026-11-24): since that build a draft's editor learns its player has a
 * collection, but the draft's route (POST /api/recommendations) takes no
 * owned flag, so an enabled toggle there would tick and filter nothing. A
 * collector's draft says the filter starts once the deck is saved, and the
 * first save (any Add) enables it with no reload (LATER row 165's second
 * half).
 *
 * Goals (Y6a, WAVE4 D7): the deck's target and per-card budget, checked by
 * the server (rank all → goals → slice, recommend/goals.ts) — this panel
 * shows what came back:
 * - one goals line on top ("Your goals: Bracket 2 (Core), ≤ $5 a card" and
 *   Change; with none, "No bracket target yet" and "Set one" — LATER row 175's
 *   door); its action opens the Why sheet at Your target;
 * - the budget control starts from the deck's own per-card budget; picking
 *   another tier shows "Save as this deck's budget", which saves it as a
 *   goal (a draft mints its row, like a target);
 * - "N hidden by your goals · Show": the cards the target took out of the
 *   list, shown with their reasons on request (this session only — a
 *   reload hides them again);
 * - each row's goal lines beside its evidence — with no target, what a card
 *   would make the deck ("Would make this deck at least Bracket 3 — a Game
 *   Changer (Wizards' list)"); with a budget, a card over it;
 * - a combo scan that hit its cap says so.
 * The fetch key carries the goals, so a goals change asks again once it has
 * saved (the GET reads them off the row); a draft sends them in its body.
 * Adds are announced by the editor's toast ("Added X · Undo"), so the live
 * line keeps only failures.
 *
 * Deck total (SUGGEST-TOTAL, the owner's ask of 2026-11-26: "the same
 * option to type your budget to get more specific in the suggestion tab"):
 * under Budget, the Autofill sheet's own field (./deck-total-field.tsx:
 * whole dollars typed and set, $50 to $250, or Not set), starting at the
 * deck's saved total. The owner's two answers, before the build:
 * - "Fits what's left": a total narrows the list to the cards at or under
 *   what is left of it (the total less the deck's estimate), so adding any
 *   card shown keeps the deck at or under it. What's left is a price limit
 *   like the tiers, and the tighter one is asked for (the request's
 *   `budget`, ../../lib/recommend/suggest-total.ts): the routes are as they
 *   were and read no total. A line under the field says what is left and
 *   for how many cards. At or over the total nothing is asked, and the
 *   list's place says nothing more fits.
 * - "Save link, like Budget": a total of the panel's own narrows the list at
 *   once and offers "Save $100 as this deck's total" ("Remove this deck's
 *   total" for Not set), a goals edit like "Save as this deck's budget".
 * The goals line keeps reading the deck's saved total, with its "Fit my
 * budget" door while over it. Between an Add and the answer its save asks
 * for, the rows already shown are kept to the new limit, so none offers an
 * Add that would go over. With "Only cards I own" ticked and applied the
 * total narrows nothing (an owned card costs nothing to add), and its line
 * says so; a tick the server declined narrows by the total again.
 *
 * Maybe (MAYBE-LIST): with `onMaybe` (a format with a Maybe zone) every row
 * carries a small "Maybe" at the end of its sources line, so the name keeps
 * its width and "Add" or "Swap in…" stays on the first line; at any deck
 * size, since a Maybe card counts toward nothing (the owner's decision 1:
 * beside "Swap in…" at the maximum). A card already parked reads "In Maybe";
 * its Add still moves it into the deck. A Maybe edit never refetches: the
 * key reads the playable list (deckStateKey), and Maybe is not part of it.
 */
import { ArrowRightIcon, ArrowUpRightIcon, GaugeIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { GoalsLine } from "@/components/deck/goals-line";
import { Segmented } from "@/components/deck/segmented";
import { DeckTotalField } from "@/components/editor/deck-total-field";
import {
  IMPORT_COLLECTION_HINT,
  ImportCollectionHint,
  ONLY_OWNED_LABEL,
  OWNED_DRAFT_HINT,
} from "@/components/editor/owned-copy";
import { useResolvedAdd } from "@/components/editor/use-resolved-add";
import { BRACKET_COPY } from "@/lib/brackets/copy";
import { formatUsd } from "@/lib/collection/ownership";
import { deckSizeCount, type EditorCard } from "@/lib/decks/editor-state";
import {
  goalsPatchBody,
  suggestionGoals,
  withBudget,
  withTotal,
  type DeckGoals,
} from "@/lib/decks/goals";
import { MAYBE_COPY } from "@/lib/decks/maybe-copy";
import { deckStateKey, hasLeader, snapshotBody } from "@/lib/decks/panel-view";
import { playableEntries } from "@/lib/decks/playable";
import { DECK_TOKEN_HEADER, getDeckToken } from "@/lib/decks/token-store";
import type { GoalConflict } from "@/lib/recommend/goals";
import type { Confidence, Recommendation } from "@/lib/recommend/types";
import {
  BUDGET_OPTIONS,
  TOTAL_PRESETS_USD,
  tierOf,
  usdOf,
  type BudgetTier,
} from "@/lib/recommend/budget";
import { FIT_COPY, totalPhrase, type FitEstimate } from "@/lib/recommend/fit";
import {
  fitsLimit,
  limitKey,
  SUGGEST_TOTAL_COPY,
  suggestionLimit,
  suggestTotalLine,
  usdLeft,
} from "@/lib/recommend/suggest-total";
import { TOTAL_COPY } from "@/lib/recommend/total-copy";
import { orderEvidence } from "@/lib/recommend/view";
import type { FormatDef, GameAdapter } from "@/lib/games/types";

/** A row as the routes answer it (Y6a): the recommendation, its goal conflicts beside the evidence. */
type SuggestionRec = Recommendation & { conflicts?: GoalConflict[] };

interface RecommendationsPanelProps {
  adapter: GameAdapter;
  format: FormatDef;
  /** Live deck id — null until draft mode's first autosave creates the row. */
  deckId: string | null;
  entries: readonly { cardId: string; zone: string; qty: number }[];
  /** Copies the deck holds (MAYBE-LIST: the playable list, never Maybe) — rows flip to "in deck". */
  inDeckQty: ReadonlyMap<string, number>;
  /** MAYBE-LIST: the cards parked in Maybe — their rows read "In Maybe". */
  inMaybe?: ReadonlySet<string>;
  saveStatus: "saved" | "dirty" | "saving" | "error";
  /** Tab visibility: no fetching (lazy) and no work while hidden. */
  active: boolean;
  /** Add to the main zone via the editor's own edit path — the editor toasts it with Undo (Y6a). */
  onAdd: (card: EditorCard) => string | undefined;
  /** MAYBE-LIST: park the card in Maybe (the editor's edit, toasted with Undo); absent = no Maybe button. */
  onMaybe?: (card: EditorCard) => string | undefined;
  /** The user has an imported collection (P3.7) — enables "only cards I own". */
  ownedAvailable?: boolean;
  /** The deck's goals (Y6a): the target and per-card budget the list follows. */
  goals?: DeckGoals | null;
  /** Y8: the deck's estimate — the goals line reads it beside a total. */
  estimate?: FitEstimate | null;
  /** Saves a goals change — "Save as this deck's budget" (the editor's goals edit). */
  onGoalsChange?: (next: DeckGoals | null) => void;
  /** The goals line's "Change": the Why sheet at Your target. Absent = the line only reads. */
  onChangeGoals?: () => void;
  /** Y8: the goals line's "Fit my budget" (over the total) — the Fit sheet. */
  onFit?: () => void;
  /** Y7b: the deck is at its maximum — Add reads "Swap in…" (the editor opens the swap-in sheet). */
  swapIn?: boolean;
}

interface OwnedFilterMeta {
  requested: boolean;
  applied: boolean;
  reason?: "signed-out" | "no-collection";
}

export function RecommendationsPanel({
  adapter,
  format,
  deckId,
  entries,
  inDeckQty,
  inMaybe,
  saveStatus,
  active,
  onAdd,
  onMaybe,
  ownedAvailable = false,
  goals = null,
  estimate = null,
  onGoalsChange,
  onChangeGoals,
  onFit,
  swapIn = false,
}: RecommendationsPanelProps) {
  // The budget starts from the deck's goal; a pick of its own wins until it's saved.
  const goalTier = tierOf(goals?.budget?.perCardUsd);
  const [pick, setPick] = useState<BudgetTier | null>(null);
  const budget = pick ?? goalTier;
  // The deck total (SUGGEST-TOTAL), the same way: the deck's saved total
  // until the panel picks one of its own (Not set included). A saved total
  // that moves (this panel's Save, the Fit sheet, Autofill's Add) wins over
  // the pick, so the panel follows the deck again; until it moves the pick
  // stands, so a Save never flickers back to the old total and asks twice.
  // Adjusted during render, one pass.
  const savedTotal = goals?.budget?.totalUsd ?? null;
  const [totalPick, setTotalPick] = useState<{ usd: number | null } | null>(null);
  const [seenSaved, setSeenSaved] = useState(savedTotal);
  if (seenSaved !== savedTotal) {
    setSeenSaved(savedTotal);
    setTotalPick(null);
  }
  const total = totalPick ? totalPick.usd : savedTotal;
  const totalLineId = useId();
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [ownedMeta, setOwnedMeta] = useState<OwnedFilterMeta | null>(null);
  const [recs, setRecs] = useState<SuggestionRec[] | null>(null);
  const [hidden, setHidden] = useState<SuggestionRec[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [combosTruncated, setCombosTruncated] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // Force-refetch counter (Refresh button / error retry) — part of the key.
  const [nonce, setNonce] = useState(0);
  const lastKeyRef = useRef<string | null>(null);
  // The latest ask started (SUGGEST-TOTAL's review): an ask cut short clears
  // "Updating…" only when no newer ask took its place, which clears it itself
  // when it lands. Before, a cut-short ask whose key came straight back (a
  // tier, a total or the tab left and found again) left it, and Refresh off,
  // for good.
  const askRef = useRef(0);
  const { pendingAdd, pendingMaybe, notice, add, maybe } = useResolvedAdd(adapter, format, onAdd, {
    announce: false,
    onMaybe,
  });

  const leader = hasLeader(entries, format);
  // The owned filter needs a collection AND a deck row: a draft's route takes
  // no owned flag (decision 8), so there the toggle is off and says when it
  // starts. Without this gate it would tick and send a request that ignores it.
  const ownedReady = ownedAvailable && deckId !== null;
  const wantOwned = onlyOwned && ownedReady;
  // The owned filter as the last answer had it: a tick the server declined
  // (signed out, no collection) filters nothing, so the total narrows again.
  const ownedOn = wantOwned && !(ownedMeta?.requested === true && !ownedMeta.applied);
  // The goals the server checks (Y6a), canonical: an edit that leaves them
  // alone (the exceptions line) never asks again; one that changes them does.
  const sentGoals = useMemo(() => suggestionGoals(goals), [goals]);
  const goalsKey = goalsPatchBody(sentGoals);
  // What a card may cost (SUGGEST-TOTAL): the tier's limit, or what's left of
  // the total when that is tighter. Nothing left: nothing is asked. The key
  // reads the limit itself, so a tier or a total that leaves it as it was
  // asks nothing again, and an add that moves what's left asks once, with
  // the add's own settled burst. One more ask can follow a burst for a
  // collector: the editor's owned lookup, landing after the save, counts a
  // card they own at $0 and so moves what's left. Memoized so the compiler
  // reads it as frozen (the draft body's memo below depends on it).
  const limit = useMemo(
    () => suggestionLimit({ tierUsd: usdOf(budget), totalUsd: total, estimate, owned: ownedOn }),
    [budget, total, estimate, ownedOn],
  );
  const { priceUsd, full } = limit;
  const fetchKey = `${deckStateKey(playableEntries(entries, format))}§p:${limitKey(limit)}§o:${wantOwned ? 1 : 0}§g:${goalsKey}§n:${nonce}`;
  // A draft's request (Y2b): a string, so an edit that leaves the snapshot
  // alone (a tag, a printing) leaves the effect alone too.
  const draftBody = useMemo(
    () =>
      deckId === null
        ? JSON.stringify(
            snapshotBody(adapter.id, format, entries, priceUsd ?? undefined, sentGoals),
          )
        : null,
    [deckId, adapter.id, format, entries, priceUsd, sentGoals],
  );

  useEffect(() => {
    // Nothing left of the total (SUGGEST-TOTAL): nothing to ask.
    if (!active || !leader || saveStatus !== "saved" || full) return;
    if (fetchKey === lastKeyRef.current) return;
    const controller = new AbortController();
    void (async () => {
      const ask = ++askRef.current;
      setFetching(true);
      setFetchError(null);
      try {
        let res: Response;
        if (deckId === null) {
          res = await fetch("/api/recommendations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: draftBody,
            cache: "no-store",
            signal: controller.signal,
          });
        } else {
          const search = new URLSearchParams();
          if (priceUsd !== null) search.set("budget", String(priceUsd));
          if (wantOwned) search.set("owned", "1");
          const query = search.toString();
          const params = query ? `?${query}` : "";
          const token = getDeckToken(deckId);
          res = await fetch(`/api/decks/${deckId}/recommendations${params}`, {
            headers: token ? { [DECK_TOKEN_HEADER]: token } : {},
            cache: "no-store",
            signal: controller.signal,
          });
        }
        if (res.status === 429) {
          throw new Error("Suggestions are rate-limited for a moment. Try again shortly.");
        }
        if (!res.ok) throw new Error(`Suggestions failed to load (${res.status}).`);
        const json: {
          recommendations: SuggestionRec[];
          hidden?: SuggestionRec[];
          combosTruncated?: boolean;
          owned?: OwnedFilterMeta;
        } = await res.json();
        lastKeyRef.current = fetchKey;
        setRecs(json.recommendations);
        setHidden(json.hidden ?? []);
        setCombosTruncated(json.combosTruncated ?? false);
        setOwnedMeta(json.owned ?? null);
        setFetching(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          if (askRef.current === ask) setFetching(false);
          return;
        }
        setFetching(false);
        setFetchError(err instanceof Error ? err.message : "Suggestions failed to load.");
      }
    })();
    return () => controller.abort();
  }, [active, leader, deckId, saveStatus, fetchKey, priceUsd, full, wantOwned, draftBody]);

  const toggleExpanded = (cardId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(cardId)) next.add(cardId);
      return next;
    });
  };

  if (!leader) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
        Add a {adapter.display.leaderNoun} to get suggestions. They’re built on its color identity.
      </div>
    );
  }

  const brackets = adapter.brackets;
  // "Save as this deck's budget": a pick the deck's own budget doesn't hold yet.
  const canSaveBudget = onGoalsChange !== undefined && pick !== null && pick !== goalTier;
  const saveBudget = () => {
    onGoalsChange?.(withBudget(goals, usdOf(budget)));
    setPick(null); // the control follows the saved goal again
  };
  // SUGGEST-TOTAL: "Save $100 as this deck's total" (or "Remove this deck's
  // total") for a pick the deck doesn't hold yet, the same goals edit.
  const canSaveTotal =
    onGoalsChange !== undefined && totalPick !== null && totalPick.usd !== savedTotal;
  // The pick gives way once the saved total moves to it (above).
  const saveTotal = () => onGoalsChange?.(withTotal(goals, total));
  const totalLine = suggestTotalLine({
    totalUsd: total,
    savedUsd: savedTotal,
    limit,
    toAdd: Math.max(0, format.deckSize.min - deckSizeCount(entries, format)),
    owned: ownedOn,
    phrase: total === null ? "" : totalPhrase(total, estimate),
  });
  // The last answer's rows, kept to the limit in force now (SUGGEST-TOTAL's
  // review): an Add tightens what's left at once, while the next answer waits
  // for the save to settle, and until it lands a row the deck can no longer
  // afford leaves the list rather than offer an Add that would go over. A
  // card the deck now holds keeps its row ("In deck ✓").
  const affordable = (rec: SuggestionRec) =>
    (inDeckQty.get(rec.cardId) ?? 0) > 0 || fitsLimit(rec.cheapestUsd, priceUsd);
  const shownRecs = recs?.filter(affordable) ?? null;
  const shownHidden = hidden.filter(affordable);

  return (
    <div className="p-3">
      <GoalsLine
        brackets={brackets}
        goals={goals}
        estimate={estimate}
        onChange={onChangeGoals}
        onFit={onFit}
        className="mb-1.5"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Budget" options={BUDGET_OPTIONS} value={budget} onChange={setPick} />
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setNonce((n) => n + 1)}
          disabled={fetching || full}
        >
          Refresh
        </Button>
      </div>
      {canSaveBudget && (
        <button
          type="button"
          onClick={saveBudget}
          className="text-foreground mt-1 cursor-pointer text-xs font-medium underline underline-offset-4 hover:no-underline pointer-coarse:min-h-11"
        >
          {BRACKET_COPY.saveBudget}
        </button>
      )}

      {/* Deck total (SUGGEST-TOTAL): the Autofill sheet's field, under Budget,
          then what is left of it and, for a pick of the panel's own, its save.
          The lines sit under the field, so it never moves when they change. */}
      <div data-slot="suggest-total" className="mt-1.5 space-y-1">
        <DeckTotalField
          quiet
          committed={total}
          presets={TOTAL_PRESETS_USD}
          submitLabel={TOTAL_COPY.set}
          onCommit={(usd) => setTotalPick({ usd })}
          notSet={{ label: TOTAL_COPY.notSet, onClear: () => setTotalPick({ usd: null }) }}
          describedBy={totalLine ? totalLineId : undefined}
        />
        {totalLine && (
          <p
            id={totalLineId}
            data-slot="suggest-total-line"
            className="text-muted-foreground text-xs"
          >
            {totalLine}
          </p>
        )}
        {canSaveTotal && (
          <button
            type="button"
            onClick={saveTotal}
            className="text-foreground cursor-pointer text-xs font-medium underline underline-offset-4 hover:no-underline pointer-coarse:min-h-11"
          >
            {total === null ? FIT_COPY.removeTotal : FIT_COPY.saveTotal(total)}
          </button>
        )}
      </div>

      {/* U10a (WAVE5.md D10, D1): the toggle is a Checkbox in a horizontal
          Field; without a collection the Field is disabled and the reason the
          `title` carried on hover is a FieldDescription under it, on every
          pointer, with the Account link inside the sentence. A collector's
          draft is disabled too (AUTOFILL-OWNED), with its own reason. */}
      <Field
        orientation="horizontal"
        disabled={!ownedReady}
        className="mt-1.5 flex-wrap gap-y-0.5 text-xs"
        title={
          ownedReady
            ? "Restrict suggestions to cards you own any printing of"
            : ownedAvailable
              ? OWNED_DRAFT_HINT
              : IMPORT_COLLECTION_HINT
        }
      >
        <Checkbox
          checked={wantOwned}
          onCheckedChange={(next) => setOnlyOwned(next)}
          data-testid="only-owned-toggle"
        />
        <FieldLabel>{ONLY_OWNED_LABEL}</FieldLabel>
        {!ownedAvailable ? (
          <FieldDescription className="basis-full">
            <ImportCollectionHint />
          </FieldDescription>
        ) : (
          deckId === null && (
            <FieldDescription className="basis-full">{OWNED_DRAFT_HINT}</FieldDescription>
          )
        )}
      </Field>

      <p
        aria-live="polite"
        className={`mt-1 min-h-5 text-xs ${notice?.tone === "err" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {notice?.text ??
          (fetching && recs !== null
            ? "Updating…"
            : wantOwned && ownedMeta?.requested && !ownedMeta.applied
              ? ownedMeta.reason === "signed-out"
                ? "Sign in to filter by your collection. Showing all suggestions."
                : "No collection found on this account. Showing all suggestions."
              : wantOwned && ownedMeta?.applied
                ? "Showing only cards in your collection."
                : "")}
      </p>

      {!full && shownRecs !== null && shownHidden.length > 0 && (
        <div data-slot="goals-hidden" className="mt-1">
          <p className="text-muted-foreground text-xs">
            {BRACKET_COPY.hiddenByGoals(shownHidden.length)}
            {" · "}
            <button
              type="button"
              aria-expanded={showHidden}
              onClick={() => setShowHidden((v) => !v)}
              className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:no-underline pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              {showHidden ? BRACKET_COPY.hideHidden : BRACKET_COPY.showHidden}
            </button>
          </p>
          {showHidden && (
            <ul aria-label="Hidden by your goals" className="mt-1 space-y-1.5">
              {shownHidden.map((rec) => (
                <SuggestionRow
                  key={rec.cardId}
                  adapter={adapter}
                  rec={rec}
                  hidden
                  inDeck={(inDeckQty.get(rec.cardId) ?? 0) > 0}
                  inMaybe={inMaybe?.has(rec.cardId) ?? false}
                  expanded={expanded.has(rec.cardId)}
                  pending={pendingAdd === rec.cardId}
                  pendingMaybe={pendingMaybe === rec.cardId}
                  swapIn={swapIn}
                  onToggle={() => toggleExpanded(rec.cardId)}
                  onAdd={() => void add({ cardId: rec.cardId, name: rec.name })}
                  onMaybe={
                    onMaybe ? () => void maybe({ cardId: rec.cardId, name: rec.name }) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {!full && recs !== null && combosTruncated && (
        <p className="text-muted-foreground mt-1 text-xs">{BRACKET_COPY.combosCapped}</p>
      )}

      {full && total !== null ? (
        // SUGGEST-TOTAL: at or over the total no card fits what's left, so
        // nothing was asked; the way out is the field right above.
        <p data-slot="suggest-total-full" className="text-muted-foreground mt-2 text-sm">
          {SUGGEST_TOTAL_COPY.full(formatUsd(total))}
        </p>
      ) : fetchError ? (
        <div className="mt-2 text-sm">
          <p className="text-destructive">{fetchError}</p>
          <Button
            variant="outline"
            size="xs"
            className="mt-2"
            onClick={() => setNonce((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      ) : shownRecs === null ? (
        // With the gate passed, either the fetch is in flight or it's waiting
        // on the settle (a draft's first edit minting its row included) — the
        // effect fires on save.
        <p className="text-muted-foreground mt-2 text-sm">
          {fetching ? "Finding suggestions…" : "Suggestions appear once the deck saves."}
        </p>
      ) : shownRecs.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          {ownedMeta?.applied
            ? "Nothing you own fits this deck right now. Untick “Only cards I own” for the full list."
            : shownHidden.length > 0
              ? "Nothing else fits your goals right now."
              : limit.binding === "total" && limit.leftUsd !== null && total !== null
                ? SUGGEST_TOTAL_COPY.noneLeft(usdLeft(limit.leftUsd), formatUsd(total))
                : limit.binding === "tier"
                  ? `No suggestions with a known price of $${budget} or less. Try a wider budget.`
                  : "No suggestions right now."}
        </p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {shownRecs.map((rec) => (
            <SuggestionRow
              key={rec.cardId}
              adapter={adapter}
              rec={rec}
              inDeck={(inDeckQty.get(rec.cardId) ?? 0) > 0}
              inMaybe={inMaybe?.has(rec.cardId) ?? false}
              expanded={expanded.has(rec.cardId)}
              pending={pendingAdd === rec.cardId}
              pendingMaybe={pendingMaybe === rec.cardId}
              swapIn={swapIn}
              onToggle={() => toggleExpanded(rec.cardId)}
              onAdd={() => void add({ cardId: rec.cardId, name: rec.name })}
              onMaybe={
                onMaybe ? () => void maybe({ cardId: rec.cardId, name: rec.name }) : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Confidence exactly as the engine reports it — text, not just color.
 *  Exported for the Cut Coach panel (P3.4) — one confidence rendering.
 *  U10b (WAVE5 D10): a label, not a chip, so it is a Badge (outline, at its
 *  12 px weight 400), its tone on the line and the word. */
export function ConfidenceChip({ level }: { level: Confidence }) {
  const tone =
    level === "high"
      ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-400"
      : level === "medium"
        ? "border-amber-600/40 text-amber-700 dark:text-amber-400"
        : "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={`font-normal ${tone}`}>
      {level}
    </Badge>
  );
}

/** Adapter-declared display name for a source slug; the raw slug otherwise.
 *  Exported for the Cut Coach panel (P3.4) — one attribution lookup. */
export function sourceMeta(adapter: GameAdapter, source: string): { label: string; href?: string } {
  return adapter.recommend?.sources?.[source] ?? { label: source };
}

function SuggestionRow({
  adapter,
  rec,
  hidden = false,
  inDeck,
  inMaybe = false,
  expanded,
  pending,
  pendingMaybe = false,
  swapIn = false,
  onToggle,
  onAdd,
  onMaybe,
}: {
  adapter: GameAdapter;
  rec: SuggestionRec;
  /** Hidden by the goals (Y6a), shown on request: a dashed border beside its reasons. */
  hidden?: boolean;
  inDeck: boolean;
  /** MAYBE-LIST: the card is parked in Maybe — the button reads "In Maybe". */
  inMaybe?: boolean;
  expanded: boolean;
  pending: boolean;
  pendingMaybe?: boolean;
  /** Y7b: the deck is full — the add opens the swap-in sheet. */
  swapIn?: boolean;
  onToggle: () => void;
  onAdd: () => void;
  /** MAYBE-LIST: park the card in Maybe; absent = no button (a format without a Maybe zone). */
  onMaybe?: () => void;
}) {
  const evidence = orderEvidence(rec.evidence);
  const top = evidence[0];
  const sourceLabels = [...new Set(evidence.map((e) => sourceMeta(adapter, e.source).label))];
  const price = rec.cheapestUsd !== null ? `$${Number(rec.cheapestUsd).toFixed(2)}` : null;

  return (
    <li
      data-goals={hidden ? "hidden" : rec.conflicts?.length ? "flagged" : undefined}
      className={`rounded-lg border px-2.5 py-2 ${hidden ? "border-dashed" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} evidence for ${rec.name}`}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{rec.name}</span>
          <ConfidenceChip level={rec.confidence} />
        </button>
        {inDeck ? (
          <span className="text-muted-foreground shrink-0 text-xs">In deck ✓</span>
        ) : (
          <Button
            size="xs"
            variant="secondary"
            disabled={pending}
            aria-label={swapIn ? `Swap in ${rec.name}…` : `Add ${rec.name} to the deck`}
            onClick={onAdd}
          >
            {pending ? "Adding…" : swapIn ? "Swap in…" : "Add"}
          </Button>
        )}
      </div>

      {/* Strongest evidence leads even collapsed — never a bare "add this". */}
      <p className={`mt-1 text-xs leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{top.why}</p>
      {/* MAYBE-LIST: Maybe ends the sources line, so the name keeps the first line's width. */}
      <div className="mt-0.5 flex items-center gap-2">
        <p className="text-muted-foreground min-w-0 flex-1 text-xs">
          {sourceLabels.join(", ")}
          {price ? ` · ${price}` : ""}
        </p>
        {onMaybe &&
          !inDeck &&
          (inMaybe ? (
            // On touch the line keeps the button's 44 px, so the row never moves under the finger.
            <span
              data-slot="in-maybe"
              className="text-muted-foreground inline-flex shrink-0 items-center text-xs pointer-coarse:min-h-11"
            >
              {MAYBE_COPY.inMaybe}
            </span>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              disabled={pendingMaybe}
              aria-label={MAYBE_COPY.buttonLabel(rec.name)}
              onClick={onMaybe}
            >
              {pendingMaybe ? "Adding…" : MAYBE_COPY.button}
            </Button>
          ))}
      </div>
      {/* Goals (Y6a): beside the evidence, never part of it — each line names its source. */}
      {rec.conflicts?.map((c) => (
        <p
          key={`${c.rule}:${c.why}`}
          data-conflict={c.rule}
          className="text-muted-foreground mt-0.5 flex items-baseline gap-1 text-xs"
        >
          {c.rule !== "budget" && (
            <GaugeIcon aria-hidden className="size-3.5 shrink-0 translate-y-[2px]" />
          )}
          <span>{c.why}</span>
        </p>
      ))}

      {expanded && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {evidence.map((e, i) => {
            const src = sourceMeta(adapter, e.source);
            return (
              <div key={i} className="text-xs">
                <p className="flex items-center gap-1.5">
                  {src.href ? (
                    <a
                      href={src.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground underline"
                    >
                      {src.label}
                      <ArrowUpRightIcon
                        aria-hidden
                        className="ml-0.5 inline size-3.5 align-[-0.15em]"
                      />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{src.label}</span>
                  )}
                  <ConfidenceChip level={e.confidence} />
                </p>
                {/* The top entry's why is already shown in full above. */}
                {i > 0 && <p className="mt-0.5 leading-relaxed">{e.why}</p>}
                {e.with.length > 0 && (
                  <p className="text-muted-foreground mt-0.5">
                    with{" "}
                    {e.with.map((w, j) => (
                      <span key={w.cardId}>
                        {j > 0 && " + "}
                        <Link
                          href={`/cards/${w.cardId}`}
                          target="_blank"
                          className="hover:underline"
                        >
                          {w.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                {e.howOften && <p className="text-muted-foreground mt-0.5">{e.howOften}</p>}
              </div>
            );
          })}
          <p className="text-xs">
            <Link
              href={`/cards/${rec.cardId}`}
              target="_blank"
              className="text-muted-foreground hover:underline"
            >
              Card page
              <ArrowRightIcon aria-hidden className="ml-1 inline size-3.5 align-[-0.15em]" />
            </Link>
          </p>
        </div>
      )}
    </li>
  );
}
