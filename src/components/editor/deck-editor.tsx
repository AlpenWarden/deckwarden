"use client";

/**
 * The deck editor (P1.2): three panes — card search | deck list | card detail.
 * P3.2 makes the right pane tabbed (Card | Suggestions | Combos, P3.3) —
 * each panel tab only for games whose adapter declares its signals
 * (recommend / capabilities.combos); explicit card interactions anywhere
 * (search preview, deck-row click) flip back to the Card tab, while adds
 * from the panels stay put and update the preview silently.
 *
 * The in-memory list is the single source of truth: every edit applies
 * optimistically via the pure helpers in src/lib/decks/editor-state.ts, then a
 * debounced (~1s) autosave PUTs the full list (the P1.1 route built for exactly
 * this). Ownership proof is the claim token from localStorage when this
 * browser holds one, else the Better Auth session cookie (claimed/account
 * decks, P2.1) that rides along automatically. Reload hydrates from GET
 * /api/decks/[id]; a hidden tab, pagehide and unmount flush with keepalive
 * fetch so no edit is lost mid-navigation or to a discarded tab.
 *
 * R3 (REDESIGN.md §2 "Desktop builder"): the editor's own header
 * (EditorHeader — game/format chip, name, the fixed-width save slot, Share
 * primary, More; the mark and the appearance menu moved up to the site
 * header on 2026-10-17, decks/layout.tsx), one window hotkey listener
 * (useEditorHotkeys — `/` and `?`, inert while any dialog is open), the add
 * toast with Undo (F3 — Undo is a real edit through applyEdit), the leader
 * replace for max-1 zones, the tool pane on Base UI Tabs with every panel
 * kept mounted, and the `?` shortcut sheet.
 *
 * R2 (REDESIGN.md §3): the ambient layer under the workspace — the art
 * leader's crop (useLeaderArt: one request per leader change, never the
 * preview) or the color-identity gradient — gated by the adapter's
 * `ambientArt` and the reader's Background art preference. None of it
 * touches deck state: no art event marks dirty or creates a deck.
 *
 * R4 (REDESIGN.md §2 "Responsive structure"): the same editor in three
 * tiers through EditorLayout — three panes at `wide:`, search · deck with
 * the tools in a Drawer at `md:`, one pane under Deck / Search / Tools
 * tabs on phones — with every pane kept mounted, so the query, the
 * preview, the tool tab and the panels' fetched results survive a tab
 * change or a resize (only a tier crossing remounts the tools content). A
 * PASSIVE preview (typing, arrows, adds) never opens anything; an EXPLICIT
 * inspection (a click or tap on a card) opens the phone's card sheet or
 * the md drawer. A tab change, a drawer, a sheet or a resize never creates
 * a deck or marks it dirty — only applyEdit, the name and the details do.
 *
 * Y2b (WAVE4 D2): the empty list's start doors — Paste a list (the Import
 * dialog; `?import=1` from the picker), Start from a precon (a link) and
 * Surprise me (the W9c roll, state only) — for a draft whose seed has
 * settled; Suggestions answer a draft through POST /api/recommendations
 * (the panel's own branch); and the first approval offers "Share this
 * deck" under the Warden line once per deck per browser
 * (useFirstApproval). None of it mints a row.
 *
 * Y4a (WAVE4 D5): the bracket line after the Warden line — the adapter's
 * pure read (`brackets.assess`) beside validate, over the same snapshot and
 * card wires, with the combo facts from one GET per settled id set
 * (useBracketFacts) — and its "Why?" sheet as the "bracket" dialog. A GET,
 * never a POST, so a seeded draft still sends none; a game without
 * `brackets` shows nothing.
 *
 * Y4b (WAVE4 D5): the deck's goals — the target, the answers, the table's
 * exceptions — set in the Why sheet and fed back into the read. They save
 * like any edit, through autosave, with their own baseline and their own
 * PATCH body `{goals}` (which never moves updated_at); a draft's first
 * goals edit mints the row with the goals in its create, and no PATCH
 * follows. A goals change never asks for the combo facts again.
 *
 * Y7b (WAVE4 D8, swap in place): a swap is made from where the player is,
 * so a full deck never passes through 99 or 101. A text row's "Swap…" and
 * each card of the Why sheet's conflict callout open the swap sheet ("swap":
 * that card's alternatives under the goals); at the deck's maximum, an add
 * from search, Suggestions or the Radar's one-away row opens "swap-in" (the
 * card in, a cut partner out). Every one of them lands in `swapOne` — Y7a's
 * swap, one copy out and one in, in place — with one toast, "Swapped A → B",
 * whose one Undo restores both cards.
 *
 * Y8 (WAVE4 D9, Budget Twin): "fit" is the Fit sheet — More's "Fit my
 * budget…" or the Suggestions goals line's "Fit my budget" while the
 * estimate is over the deck's total. Its apply is ONE `applyListSwap`
 * ("Swapped N cards", one Undo for the batch) and saves the total it fit to
 * in the same autosave burst — a draft mints exactly one row carrying it.
 * The estimate (`deckEstimate`: cheapest printings, owned copies at $0 only
 * with a collection) feeds every goals line.
 *
 * Y9a (WAVE4 D10, the journal): "games" is the Games dialog — More's
 * "Games…" on a live deck whose game declares a journal. A log flushes
 * autosave first, so the list the game keeps is the list on screen (a
 * failed save logs nothing), then closes the dialog for the toast "Logged
 * a win · Undo"; Undo deletes the game, and the played snapshot it minted
 * when no other game was played with it.
 *
 * DECK-PREVIEW-BRACKET (DECKCHECK-STUDY §2.4): the Share dialog says what
 * link previews show about the bracket whenever the Why sheet can open; its
 * action opens that sheet at Your target, and closing the sheet brings the
 * Share dialog back (focus on the action), whose close hands focus to the
 * header's Share.
 *
 * PRECON-OWNED: a deck started from a precon asks once, in the deck pane,
 * "Do you own this precon?" — the precon from the owner's GET, or for a
 * draft from its own seed (no second request). The answer is a setting like
 * the goals: its own baseline and PATCH body `{ownsPrecon}`; on a draft a
 * real edit that mints the row, whose create carries `fromPrecon` (whatever
 * edit mints it) and the answer, so no PATCH follows. A Yes owns the
 * precon's own copies (`ownedPreconCopies`): the ownership line, every goals
 * line's estimate and the Fit sheet count them at $0, and the sheets take
 * ONE identity-level owned set, `ownedSetForPricing` (the collection's ∪
 * the owned precon's). The rows' collection mark is unchanged.
 *
 * BRACKET-FIT (the owner's ask of 2026-10-24): "target-fit" is the "Swap to
 * fit" sheet, opened only by the conflict callout's door (wherever the
 * adapter declares fixes and Swap Lab and the read has a conflict; when no
 * card can go out, the sheet says why each one stays).
 * Its apply is ONE `applyListSwap` ("Swapped N cards", one Undo for the
 * batch), and focus comes back to "Why?" as after a callout's Swap…. It
 * prices the cards coming in against `ownedSetForPricing` too, so a card the
 * owned precon already holds costs nothing.
 *
 * BRACKET-UP (the owner's ask of 2026-10-27): "target-up" is the "Upgrade
 * toward" sheet, opened only by Your target's "Below your target" door
 * (wherever the adapter declares Swap in's swap and cuts; the Why sheet
 * shows it when the target is above what the cards show). Its apply is
 * Swap to fit's: ONE `applyListSwap`, "Swapped N cards" with one Undo, focus
 * back to "Why?", the cards coming in priced against `ownedSetForPricing`.
 *
 * PRECON-CHANGES (the owner's pick of 2026-11-15, LATER row 345): what a
 * deck started from a precon has changed from the box, derived on every
 * render from the precon's own list (`precon.cards`) and the list on screen
 * (`preconChanges`), never stored: the deck pane's second line ("Changed
 * from the precon: 25 out, 25 in."), the rows' marks, and "precon-changes",
 * the sheet "See changes" opens with both lists. So an Undo, a reload or an
 * edit by hand moves all three in the same render. The sheet prices its Add
 * list against the collection's set alone, the ownership line's own: the
 * precon's copies are already out of that list.
 *
 * FIRST-LIST (the owner's ask and four calls of 2026-11-26): the same line,
 * marks and sheet ("first-list-changes") for a deck with no precon lineage,
 * counted from its baseline (first-list.ts), the first full list. The
 * editor sets it, and its own PATCH body `{baseline}` stores it, the goals'
 * way: the save that first sends a full list sets it to that list
 * (`firstListStamp`, in save() and in the keepalive copy), and a deck
 * already full on load with none takes the list it loaded, saved with its
 * next edit's save (the owner's call 4). Until a baseline exists a full list
 * says "No changes from your first full list yet." "I've made these
 * changes" in the sheet makes the list on screen the baseline
 * (`source: "owner"`), with a toast and an Undo that puts the previous one
 * back. The owner's GET carries the cards the list no longer holds
 * (`baselineCards`), so their names are in the card map from the load.
 *
 * AUTOFILL-TARGET (the owner's note of 2026-11-15): the Autofill sheet has
 * Your target's choice. The pick is the sheet's own until Add, and then
 * `handleAutofillApply` stores it as the deck's target in the same burst as
 * the list swap when it differs: a draft's create carries it, a saved deck
 * sends its goals PATCH beside the PUT. The toast says both; its Undo
 * restores the list and leaves the target, as the Fit sheet's total stays.
 *
 * AUTOFILL-OWNED (the owner's ask of 2026-11-24): a draft learns whether its
 * player has a collection. A saved deck is told by its own GET; a draft has
 * no GET (/decks/new is static, and its first save swaps the URL without a
 * reload), so it never knew (LATER row 165). Now a draft reads the session
 * the header's account slot already holds (`authClient.useSession`: the
 * same store, no second request) and, for a signed-in player, asks GET
 * /api/collection once per mount. A guest asks nothing. From then on a
 * draft behaves as a saved deck with a collection does: the owned lookups
 * mark cards, the ownership line shows, and the estimate and the Fit sheet
 * count owned cards at $0. The Autofill sheet gets the answer as
 * `collection` (available, unavailable, checking or failed) for its "Only
 * cards I own" box, and hands back the picks it built from the collection,
 * so the ownership line is right in the render the list lands in.
 *
 * COLLECTION-PAGE (the owner's idea 1 of 2026-11-24): "Build from my
 * collection" on /collection is the new-deck link with `?autofill=1` and
 * `?owned=1`. `draftOwned` is that second flag: the sheet the latch opens
 * gets it as the first value of its "Only cards I own" box
 * (`startOwned`), and only that sheet. The flag is spent when the sheet
 * closes, so a sheet opened later from a door or the More menu starts
 * unticked like any other, and the tick is still never stored on the deck.
 *
 * Game-agnostic by construction: zones, labels, and card display all come off
 * the adapter registry (FormatDef, display.*) — nothing MTG-specific here.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AmbientArt } from "@/components/deck/ambient-art";
import { AnalyticsBlocks } from "@/components/deck/analytics-blocks";
import { BracketLine } from "@/components/deck/bracket-line";
import { BracketSheet } from "@/components/deck/bracket-sheet";
import { BuyDeckDialog, countedEntries } from "@/components/deck/buy-deck-menu";
import { SampleHand } from "@/components/deck/sample-hand";
import { useBracketFacts } from "@/components/deck/use-bracket-facts";
import type { SwapEditing } from "@/components/editor/alternatives-section";
import {
  AutofillSheet,
  type AutofillApply,
  type CollectionState,
} from "@/components/editor/autofill-sheet";
import {
  CardDetailPane,
  type PrintingEditing,
  type SheetActions,
} from "@/components/editor/card-detail-pane";
import { ComboRadarPanel } from "@/components/editor/combo-radar-panel";
import { CutCoachPanel } from "@/components/editor/cut-coach-panel";
import { FitSheet, type FitApply } from "@/components/editor/fit-sheet";
import { GamesDialog } from "@/components/editor/games-dialog";
import { showLoggedToast } from "@/components/editor/logged-toast";
import { DeckListPane } from "@/components/editor/deck-list-pane";
import { DetailsDialog, type DeckDetails } from "@/components/editor/details-dialog";
import { EditorAttribution } from "@/components/editor/editor-attribution";
import { EditorHeader, type EditorDialog } from "@/components/editor/editor-header";
import {
  EDITOR_CREDIT_INSET,
  EDITOR_TOAST_VIEWPORT_CLASS,
  EditorLayout,
  type EditorPane,
} from "@/components/editor/editor-layout";
import { HistoryDialog } from "@/components/editor/history-dialog";
import { ExportDialog, ImportDialog } from "@/components/editor/import-export";
import { ChangesSheet, PreconChangesSheet } from "@/components/editor/precon-changes-sheet";
import { RecommendationsPanel } from "@/components/editor/recommendations-panel";
import { SearchPane, type SearchPaneHandle } from "@/components/editor/search-pane";
import { SwapInSheet, SwapSheet } from "@/components/editor/swap-sheet";
import { TargetFitSheet, type TargetFitApply } from "@/components/editor/target-fit-sheet";
import { TargetUpSheet } from "@/components/editor/target-up-sheet";
import { ShareDialog, type DeckVisibility } from "@/components/editor/share-dialog";
import { ShortcutsSheet } from "@/components/editor/shortcuts-sheet";
import { useAutosave } from "@/components/editor/use-autosave";
import { useEditorHotkeys } from "@/components/editor/use-editor-hotkeys";
import { useFirstApproval } from "@/components/editor/use-first-approval";
import { useKeyboardInset } from "@/components/editor/use-keyboard-inset";
import { useLeaderArt } from "@/components/editor/use-leader-art";
import { useTier } from "@/components/editor/use-tier";
import { Button } from "@/components/ui/button";
import { ModalFinalFocus } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, Toaster } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { autofillTargetTitle } from "@/lib/brackets/autofill-target";
import { factsIds } from "@/lib/brackets/facts";
import { targetFitDoor } from "@/lib/brackets/target-fit";
import { deckOwnership } from "@/lib/collection/ownership";
import { embeddablePrintingImageUrl } from "@/lib/cards/images";
import { type GalleryPrinting } from "@/lib/cards/printings";
import type { ComboView } from "@/lib/combos/queries";
import { comboPin, type ComboPin } from "@/lib/combos/view";
import { leaderArtTarget, orderLeadersBy } from "@/lib/decks/ambient-art";
import { leaderDenorm } from "@/lib/decks/cards";
import {
  addCard,
  deckSizeCount,
  enteredDeck,
  leaveMaybe,
  maybeCardIds,
  mergeEntries,
  playableQty,
  removeCard,
  replaceLeader,
  restoreEntry,
  restoreRows,
  setPrinting,
  setQty,
  setTags,
  swapCard,
  toEditorCard,
  toSavePayload,
  zoneQty,
  type CardWire,
  type EditorCard,
  type EditorEntry,
  type EditResult,
  type TakenRow,
} from "@/lib/decks/editor-state";
import type { ForkCredit } from "@/lib/decks/fork-credit";
import {
  goalsPatchBody,
  readGoals,
  suggestionGoals,
  withTarget,
  withTotal,
  type DeckGoals,
} from "@/lib/decks/goals";
import {
  baselineDate,
  baselineOf,
  baselinePatchBody,
  listComplete,
  type DeckBaseline,
} from "@/lib/decks/first-list";
import { FIRST_LIST_COPY } from "@/lib/decks/first-list-copy";
import { beyondPrecon, preconChanges, type PreconChanges } from "@/lib/decks/precon-changes";
import {
  ownedForPricing,
  ownedPreconCopies,
  ownsPreconPatchBody,
  preconCards,
  type DeckPrecon,
} from "@/lib/decks/precon-owned";
import { hiddenTokensPatchBody, normalizeHiddenTokens } from "@/lib/decks/token-fill";
import type { LogResult } from "@/lib/journal/games";
import type { ImportOutcome } from "@/lib/decks/import";
import { clearPickIntent, pickIntentFor, writePickIntent } from "@/lib/decks/leader-pick-intent";
import { hasLeader, snapshotBody } from "@/lib/decks/panel-view";
import { MAYBE_COPY } from "@/lib/decks/maybe-copy";
import { isPlayableZone, maybeZoneOf, playableEntries, tokenZoneOf } from "@/lib/decks/playable";
import { addMorePhrase, deckProgress } from "@/lib/decks/progress";
import { startDoors } from "@/lib/decks/start-doors";
import {
  DECK_TOKEN_HEADER,
  getDeckToken,
  removeDeckToken,
  setDeckToken,
} from "@/lib/decks/token-store";
import { toDeckSnapshot } from "@/lib/decks/validation";
import { getAdapter } from "@/lib/games/registry";
import { deckEstimate, FIT_COPY } from "@/lib/recommend/fit";
import { autofillSavedToast, autofillTotalTitle } from "@/lib/recommend/total-copy";
import { useAppearance } from "@/lib/theme/appearance";
import { cn } from "@/lib/utils";
import type {
  AnalyticsBlock,
  FormatDef,
  GameAdapter,
  GameId,
  ValidationIssue,
} from "@/lib/games/types";

interface DeckResponse {
  deck: {
    id: string;
    publicId: string;
    game: GameId | null;
    format: string | null;
    name: string;
    description: string | null;
    notes: string | null;
    visibility: DeckVisibility;
    isOwner: boolean;
    /** Fork credit (P3.6), resolved for this viewer; null = not a fork. */
    forkedFrom: ForkCredit | null;
    /** The decks-row leader order (R2): keeps a partner deck's art leader stable across reloads. */
    leaderIds: string[];
    /** The deck's goals (Y4b) — the owner's wire carries every one. */
    goals?: DeckGoals | null;
    /** The derived tokens the owner hid (TOKEN-FILL) — the owner's wire alone. */
    hiddenTokens?: string[] | null;
    /** The precon the deck started from and the answer (PRECON-OWNED) — the owner's wire alone. */
    precon?: DeckPrecon | null;
    /** The list a hand-built deck's changes count from (FIRST-LIST) — the owner's wire alone. */
    baseline?: DeckBaseline | null;
  };
  cards: {
    cardId: string;
    zone: string;
    qty: number;
    tags: string[];
    printingId: string | null;
    card: CardWire;
  }[];
  /** Ids among `cards` the signed-in requester owns any printing of (P3.7). */
  owned: string[];
  /** Whether the requester has imported a collection at all (P3.7). */
  hasCollection: boolean;
  /** FIRST-LIST: the baseline's cards the list no longer holds — the owner's wire alone. */
  baselineCards?: CardWire[];
}

/**
 * FIRST-LIST: the baseline a save sets, or null. A deck with none, no precon
 * lineage and a full list takes that list as its first full list (the
 * owner's call 1); every other save sets nothing. Pure over its inputs, so
 * save() and the keepalive copy call the one rule.
 */
function firstListStamp(
  baseline: DeckBaseline | null,
  precon: DeckPrecon | null,
  format: FormatDef | null,
  entries: readonly EditorEntry[],
): DeckBaseline | null {
  if (baseline || precon || !format || !listComplete(entries, format)) return null;
  return baselineOf(entries, format, "complete", new Date().toISOString());
}

type LoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; adapter: GameAdapter; format: FormatDef };

// U4b: the phone's strip adds the analytics and the sample hand as tabs.
type RightTab = "card" | "suggest" | "combos" | "cuts" | "analytics" | "hand";

/** Add-toast lifetime (F3): long enough to reach Undo, short enough to never stack up. */
const TOAST_MS = 5000;
/**
 * How long a save waits on keepalive copies still in flight (LATER row 163):
 * long enough for a slow write to answer, short enough that a copy whose
 * answer never comes back (sent as the page froze or left) can't hold the
 * autosave for good.
 */
const KEEPALIVE_WAIT_MS = 10_000;

/**
 * The phone's Tools strip (U4b): one row of six at 360 px. The list spans
 * the row and its tabs share what is left over; 13 px labels on 4 px
 * sides, each at least 44 px on touch; a strip wider than the row (a
 * larger text setting, a narrower phone) scrolls sideways instead of
 * wrapping or clipping a name. LATER row 244: the tabs start at the row's
 * left edge (the list's own `justify-center` split the overflow and put
 * half of Card out of reach of the scroll at 320 px), and the edge with
 * more tabs past it fades (`scroll-cue-x`, globals.css), the cue a
 * hidden scrollbar leaves out.
 */
const PHONE_STRIP_CLASS =
  "w-full justify-start gap-0 overflow-x-auto [scrollbar-width:none] scroll-cue-x";
const PHONE_TAB_CLASS = "flex-[1_0_auto] px-1 text-[0.8125rem] pointer-coarse:min-w-11";

/** Write headers: token when this browser holds one, else the session cookie authenticates. */
/**
 * The editor's Maybe rule (MAYBE-LIST): a card that goes into a deck zone
 * leaves Maybe. `list` without the Maybe rows of `cardIds` when `zoneId`
 * is one of the deck's (playable) zones, and the rows it took with their
 * starting indexes — the edit then adds to the list it returns, and its
 * Undo puts them back with restoreRows. Taken BEFORE the add, so a deck at
 * MAX_ENTRIES lines can still move a card in, and an add that fails takes
 * nothing.
 */
function leaveForDeck(
  format: FormatDef,
  list: readonly EditorEntry[],
  zoneId: string,
  cardIds: readonly string[],
): { entries: EditorEntry[]; left: TakenRow[] } {
  return isPlayableZone(format, zoneId)
    ? leaveMaybe(list, format, cardIds)
    : { entries: [...list], left: [] };
}

function writeHeaders(deckId: string): Record<string, string> {
  const token = getDeckToken(deckId);
  return { "Content-Type": "application/json", ...(token ? { [DECK_TOKEN_HEADER]: token } : {}) };
}

/**
 * One PATCH body for every autosaved meta field (name + P2.7's details).
 * Deterministic serialization doubles as the dirty check; an empty name is
 * omitted (the route requires min 1 — the old name simply stands), empty
 * description/notes save as null.
 */
function metaPatchBody(meta: { name: string; description: string; notes: string }): string {
  const name = meta.name.trim();
  return JSON.stringify({
    ...(name ? { name } : {}),
    description: meta.description.trim() ? meta.description : null,
    notes: meta.notes.trim() ? meta.notes : null,
  });
}

export function DeckEditor({
  deckId: initialDeckId,
  draftGame,
  draftFormat,
  draftLeaderKey,
  draftFromSlug,
  draftSurprise,
  draftComboKey,
  draftAutofill,
  draftOwned,
  draftImport,
  applyLeaderKey,
}: {
  /** null = draft mode (/decks/new): no server deck exists until the first real edit. */
  deckId: string | null;
  /** Draft mode only: what the lazily-created deck will be. */
  draftGame?: GameId;
  draftFormat?: string;
  /**
   * Draft mode only (P4.6): external key of a leader to seed into the leader
   * zone — the hub CTA's "Build with this leader" made literal. Seeding is
   * state only, never a save: bouncing still leaves no row (the P2.8 draft
   * contract), and the first real edit persists the leader with the rest.
   */
  draftLeaderKey?: string;
  /**
   * Draft mode only (W8b): a precon slug from "Start from this precon" —
   * the whole product list (entries WITH the precon's own printings, plus
   * the product's name) seeded as STATE ONLY, never through applyImport
   * (whose merge drops printingId) and never marking dirty: bouncing
   * leaves no row, and the first real edit persists everything — the
   * create POST carries the seeded name, so no extra meta PATCH fires.
   */
  draftFromSlug?: string;
  /**
   * Draft mode only (W9c): "Surprise me" — seed a RANDOM legal leader off
   * GET /api/leaders/random. Same state-only discipline as draftLeaderKey
   * (bouncing leaves no row), but the GET returns the full wire, so no
   * resolve unit is spent and a surprise draft fires zero POSTs until a
   * real edit. Supersedes draftLeaderKey and draftComboKey (the one seed
   * precedence rule below).
   */
  draftSurprise?: boolean;
  /**
   * Draft mode only (X3): a Commander Spellbook key from the hub's "Build
   * around this combo" — with draftLeaderKey naming which piece is the
   * commander. ONE GET /api/combos/[key] seeds the commander and every
   * other piece, state only (same discipline as draftLeaderKey, which it
   * supersedes), and makes the combo the review sheet's pinned context.
   * Ignored where the adapter declares no combos.
   */
  draftComboKey?: string;
  /**
   * Draft mode only (W9c): `?autofill=1` from the hub's "Start with a
   * starter shell" CTA (and X3's "Build around this combo"). Opens the
   * review sheet ONCE, after any pending draft seed SETTLES (not
   * necessarily succeeds — a failed seed opens the
   * sheet to its honest "set a commander first" sentence, which fires no
   * POST; that degraded state is the pinned decision). Never auto-applies:
   * the sheet's Apply stays the only write path. Gated on the adapter's
   * autofill declaration like every other door.
   */
  draftAutofill?: boolean;
  /**
   * Draft mode only (COLLECTION-PAGE): `?owned=1` beside `?autofill=1`, from
   * the collection page's "Build from my collection". The sheet that latch
   * opens starts with "Only cards I own" ticked. The sheet holds its one
   * opening request until this editor knows whether the player has a
   * collection, so that request already carries the flag for a collector
   * and none for a guest or a player without one, who see the box unticked
   * with its hint and never an error. Without `draftAutofill` it does
   * nothing: no sheet opens.
   */
  draftOwned?: boolean;
  /**
   * Draft mode only (Y2b): `?import=1` from the picker's "Paste a list"
   * door. Opens the Import dialog ONCE, with the ?autofill=1 latch's
   * discipline (after any pending seed settles; the chooser strips the
   * param, so a reload never re-opens it), for every game — every adapter
   * parses a decklist. The dialog creates nothing until its Apply, a real
   * edit like any import. A crafted link carrying both latches opens the
   * review sheet.
   */
  draftImport?: boolean;
  /**
   * Saved decks only (W4): `?leader=` from the hub's "Use for …" CTA.
   * Applied ONLY with a matching un-expired pick intent and an empty leader
   * zone, through handleAdd (a real edit — Undo toast, autosave); the URL
   * param is stripped and the intent cleared on apply. A crafted link with
   * no matching intent changes nothing.
   */
  applyLeaderKey?: string;
}) {
  const router = useRouter();
  // Draft mode is ready (or misconfigured) synchronously — only a real deck
  // id has anything to load.
  const [load, setLoad] = useState<LoadState>(() => {
    if (initialDeckId !== null) return { state: "loading" };
    const adapter = draftGame ? getAdapter(draftGame) : null;
    const format = adapter?.formats.find((f) => f.code === draftFormat);
    if (!adapter || !format) {
      return { state: "error", message: "This editor link is missing its game or format." };
    }
    return { state: "ready", adapter, format };
  });
  const [deckName, setDeckName] = useState("");
  const [details, setDetails] = useState<DeckDetails>({ description: "", notes: "" });
  // The deck's goals (Y4b): what the read is assessed with and the sheet edits.
  const [goals, setGoals] = useState<DeckGoals | null>(null);
  // The derived tokens the owner hid (TOKEN-FILL): a setting like goals, its own PATCH.
  const [hiddenTokens, setHiddenTokens] = useState<string[] | null>(null);
  // The precon the deck started from and its answer (PRECON-OWNED): a setting, its own PATCH.
  const [precon, setPrecon] = useState<DeckPrecon | null>(null);
  // The list a hand-built deck's changes count from (FIRST-LIST): a setting, its own PATCH.
  const [baseline, setBaseline] = useState<DeckBaseline | null>(null);
  const [entries, setEntries] = useState<EditorEntry[]>([]);
  const [cards, setCards] = useState<ReadonlyMap<string, EditorCard>>(new Map());
  const [preview, setPreview] = useState<EditorCard | null>(null);
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  // Where the Why sheet opens (Y6a): at Your target when the goals line's
  // "Change" opened it, at its top from "Why?".
  const [sheetAt, setSheetAt] = useState<"target" | null>(null);
  // DECK-PREVIEW-BRACKET: who opened the sheet — the Share dialog's bracket
  // line, whose dialog the sheet's close brings back — and where that
  // dialog's focus lands on open (back from the sheet: the line's action).
  const [sheetFrom, setSheetFrom] = useState<"share" | null>(null);
  const [shareAt, setShareAt] = useState<"bracket" | null>(null);
  // The swap sheets (Y7b): whose alternatives "swap" shows and who asked (a
  // deck row or the conflict callout); what "swap-in" brings in, and from
  // where (search or a panel). `closeFocusRef` says where focus goes once
  // the sheet has closed — resolved after that commit (see the effect), as
  // the element it names may only exist then.
  const [swapTarget, setSwapTarget] = useState<{
    card: EditorCard;
    from: "row" | "callout";
  } | null>(null);
  const [swapInTarget, setSwapInTarget] = useState<{
    card: EditorCard;
    qty: number;
    from: "search" | "panel";
  } | null>(null);
  const closeFocusRef = useRef<(() => HTMLElement | null) | null>(null);
  // Who opened the dialog decides where focus lands when it closes: a
  // menu-opened one goes back to the More trigger (its menu item is gone by
  // then); the `?` sheet returns to wherever `?` was pressed (R3).
  const [dialogFromMenu, setDialogFromMenu] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  // accountDeck (Y1): owned through the session — this browser holds no
  // claim token — so the Share dialog's Private line reads "Only you".
  const [share, setShare] = useState<{
    publicId: string;
    visibility: DeckVisibility;
    accountDeck: boolean;
  } | null>(null);
  const [forkedFrom, setForkedFrom] = useState<ForkCredit | null>(null);
  // Collection (P3.7): the owned identity set, grown lazily as cards are
  // added; ownedCheckedRef remembers every id already asked about so the
  // lookup effect only ever asks about NEW cards.
  const [owned, setOwned] = useState<ReadonlySet<string>>(() => new Set());
  const [hasCollection, setHasCollection] = useState(false);
  const ownedCheckedRef = useRef<Set<string>>(new Set());
  // AUTOFILL-OWNED: a draft's own answer to "does this player have a
  // collection?". A saved deck's GET says it; a draft has no GET. The
  // session is the one the header's account slot holds (the client's one
  // store), read here for drafts only; a signed-in player is asked about
  // once per mount (the effect below), a guest never. "unknown" until that
  // answer lands; a collection found sets `hasCollection` itself.
  const session = authClient.useSession();
  const draftPlayerId = initialDeckId === null ? (session.data?.user?.id ?? null) : null;
  const [draftCollection, setDraftCollection] = useState<"unknown" | "none" | "failed">("unknown");
  const draftCollectionAskedRef = useRef(false);
  // Right pane tab (P3.2/P3.3/P3.4). liveDeckId mirrors deckIdRef as STATE so
  // the panels re-render when draft mode's first save mints the row.
  const [rightTab, setRightTab] = useState<RightTab>("card");
  const [liveDeckId, setLiveDeckId] = useState<string | null>(initialDeckId);
  const searchRef = useRef<SearchPaneHandle>(null);
  // Layout state (R4): the tier is the viewport's (matchMedia); the rest is
  // session state — the phone's active pane, the md tools drawer, the phone
  // card sheet. None of it is persisted and none of it touches the deck.
  const tier = useTier();
  // LATER 551: the toasts stand above an on-screen keyboard (iOS covers them).
  useKeyboardInset();
  const [activePane, setActivePane] = useState<EditorPane>("deck");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Refs mirror the state the save callback needs, so an autosave always
  // serializes the latest edits regardless of when the debounce fires. The
  // initial baselines are exactly what a fresh server deck would save, which
  // is what draft mode needs; server hydration overwrites them before any
  // save can fire.
  const entriesRef = useRef<EditorEntry[]>([]);
  const metaRef = useRef({ name: "", description: "", notes: "" });
  const goalsRef = useRef<DeckGoals | null>(null);
  const hiddenRef = useRef<string[] | null>(null);
  const preconRef = useRef<DeckPrecon | null>(null);
  const baselineRef = useRef<DeckBaseline | null>(null);
  // FIRST-LIST, the owner's call 4: true while the baseline is the list a
  // full deck loaded with, unsaved. It goes out with the first save that
  // sends the list (a target or a rename alone is no change to the deck).
  const baselineWaitsRef = useRef(false);
  // FIRST-LIST: the format the save's stamp counts a full list by (the draft's now, a loaded deck's at hydrate).
  const formatRef = useRef<FormatDef | null>(load.state === "ready" ? load.format : null);
  const lastSavedRef = useRef({
    cards: JSON.stringify({ cards: toSavePayload([]) }),
    meta: metaPatchBody({ name: "", description: "", notes: "" }),
    // Y4b: goals' own baseline — their own PATCH, never the meta one's.
    goals: goalsPatchBody(null),
    // TOKEN-FILL: the hidden tokens' own baseline, the same way.
    hidden: hiddenTokensPatchBody(null),
    // PRECON-OWNED: the precon answer's own baseline, the same way.
    precon: ownsPreconPatchBody(null),
    // FIRST-LIST: the changes' baseline list, the same way.
    baseline: baselinePatchBody(null),
  });

  // The live deck id: the prop for existing decks, set by ensureDeck once a
  // draft's first save creates the row. A ref because save/keepalive closures
  // must see the fresh id without re-subscribing.
  const deckIdRef = useRef<string | null>(initialDeckId);
  const createChainRef = useRef<Promise<string> | null>(null);
  // Keepalive copies still in flight (LATER row 163), settled or not: the
  // next save waits for their answers before it diffs.
  const keepaliveRef = useRef<Promise<void> | null>(null);

  /**
   * Draft mode's whole point (P2.8 follow-up): the deck row is created by the
   * FIRST flush that has something to say — a card added or a name typed —
   * never by merely opening /decks/new. Click around and leave, and nothing
   * lands on your account. Single-flight so a debounce/flush race can't mint
   * two decks; a failed create clears the chain so autosave's retry re-runs
   * it instead of wedging.
   */
  const ensureDeck = useCallback(async (): Promise<string> => {
    if (deckIdRef.current) return deckIdRef.current;
    createChainRef.current ??= (async () => {
      // A seeded draft's name rides the create itself (W8b): the precon
      // seeder wrote metaRef.name AND the meta baseline, so without this
      // the row would mint as "Untitled deck" and nothing would ever PATCH
      // the name in. A typed name goes along too — its PATCH then no-ops
      // into the debounced meta diff as before.
      const name = metaRef.current.name.trim();
      // Goals ride the create too (Y4b): a target or an answer is a real
      // edit, and the draft mints with it — see the baseline below.
      const goals = goalsRef.current;
      // The precon a seeded draft came from (PRECON-OWNED) rides it whatever
      // edit mints the row, and so does its answer when it came first.
      const precon = preconRef.current;
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `website` is the create route's honeypot — always sent empty.
        body: JSON.stringify({
          game: draftGame,
          format: draftFormat,
          ...(name ? { name } : {}),
          ...(goals ? { goals } : {}),
          ...(precon
            ? {
                fromPrecon: precon.slug,
                ...(precon.owns !== null ? { ownsPrecon: precon.owns } : {}),
              }
            : {}),
          website: "",
        }),
      });
      if (!res.ok) throw new Error(`Deck creation failed (${res.status})`);
      const json: {
        deck: { id: string; publicId: string; visibility: DeckVisibility };
        claimToken: string | null;
      } = await res.json();
      // Adopt the deck before the token check: if storage is broken the row
      // exists either way, and retrying must not mint duplicates.
      deckIdRef.current = json.deck.id;
      // The row holds the goals the create carried: no PATCH for them (a
      // change made while the create was in flight still differs, and saves).
      lastSavedRef.current.goals = goalsPatchBody(goals);
      // The same for the precon's answer (PRECON-OWNED).
      lastSavedRef.current.precon = ownsPreconPatchBody(precon?.owns ?? null);
      setLiveDeckId(json.deck.id);
      setShare({
        publicId: json.deck.publicId,
        visibility: json.deck.visibility,
        accountDeck: json.claimToken === null,
      });
      // Same editor, real URL from here on — reloads and back/forward land on
      // /decks/[id]/edit; no remount, no lost pane state.
      window.history.replaceState(null, "", `/decks/${json.deck.id}/edit`);
      if (json.claimToken && !setDeckToken(json.deck.id, json.claimToken)) {
        throw new Error(
          "Couldn't store this deck's edit key. Enable browser storage and try again.",
        );
      }
      return json.deck.id;
    })().catch((err: unknown) => {
      if (!deckIdRef.current) createChainRef.current = null;
      throw err;
    });
    return createChainRef.current;
  }, [draftGame, draftFormat]);

  /**
   * A draft with nothing to say (LATER row 164): no row yet, and the list and
   * the meta still serialize to their baselines — what a fresh server deck
   * would save. An edit undone back to nothing leaves a draft here: a seeded
   * commander removed, a typed name erased.
   */
  const isBlankDraft = useCallback(
    () =>
      deckIdRef.current === null &&
      JSON.stringify({ cards: toSavePayload(entriesRef.current) }) === lastSavedRef.current.cards &&
      metaPatchBody(metaRef.current) === lastSavedRef.current.meta &&
      // Y4b: a target or an answer is something to say (D5) — the draft mints.
      goalsPatchBody(goalsRef.current) === lastSavedRef.current.goals &&
      // PRECON-OWNED: so is "Do you own this precon?"'s answer.
      ownsPreconPatchBody(preconRef.current?.owns ?? null) === lastSavedRef.current.precon,
    [],
  );

  const save = useCallback(async () => {
    // A blank draft mints nothing: the row is for the first flush that has
    // something to say. useAutosave settles back to "saved", so the slot
    // reads "Draft" again and the draft-only doors stay.
    if (isBlankDraft()) return;
    const deckId = await ensureDeck();
    // A keepalive copy still in flight (a hidden tab, LATER row 163) answers
    // first: a newer list never races an older copy to the server, and a
    // copy that failed leaves its diff for this save. Bounded, and waited
    // out once: a copy whose answer never comes can't wedge the autosave.
    const pending = keepaliveRef.current;
    if (pending) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        pending,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, KEEPALIVE_WAIT_MS);
        }),
      ]);
      clearTimeout(timer);
      if (keepaliveRef.current === pending) keepaliveRef.current = null;
    }
    // FIRST-LIST: the save that first sends a full list sets the baseline to
    // it; its PATCH follows the list's PUT below.
    const stamped = firstListStamp(
      baselineRef.current,
      preconRef.current,
      formatRef.current,
      entriesRef.current,
    );
    if (stamped) {
      baselineRef.current = stamped;
      setBaseline(stamped);
    }
    const headers = writeHeaders(deckId);
    const cardsBody = JSON.stringify({ cards: toSavePayload(entriesRef.current) });
    if (cardsBody !== lastSavedRef.current.cards) {
      const res = await fetch(`/api/decks/${deckId}/cards`, {
        method: "PUT",
        headers,
        body: cardsBody,
      });
      if (!res.ok) throw new Error(`Card save failed (${res.status})`);
      lastSavedRef.current.cards = cardsBody;
      baselineWaitsRef.current = false;
    }
    const metaBody = metaPatchBody(metaRef.current);
    if (metaBody !== lastSavedRef.current.meta) {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers,
        body: metaBody,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      lastSavedRef.current.meta = metaBody;
    }
    // Goals (Y4b): their own PATCH body, so the route leaves updated_at —
    // and the deck's place in every "recent" order — alone.
    const goalsBody = goalsPatchBody(goalsRef.current);
    if (goalsBody !== lastSavedRef.current.goals) {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers,
        body: goalsBody,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      lastSavedRef.current.goals = goalsBody;
    }
    // Hidden tokens (TOKEN-FILL): the same kind of body, the same rule. A
    // dismiss needs a derived token, which needs cards, so the row exists
    // (or ensureDeck just minted it) by the time this runs — no create change.
    const hiddenBody = hiddenTokensPatchBody(hiddenRef.current);
    if (hiddenBody !== lastSavedRef.current.hidden) {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers,
        body: hiddenBody,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      lastSavedRef.current.hidden = hiddenBody;
    }
    // The precon's answer (PRECON-OWNED): the same kind of body, the same
    // rule. A draft's rides its create (ensureDeck moved the baseline).
    const preconBody = ownsPreconPatchBody(preconRef.current?.owns ?? null);
    if (preconBody !== lastSavedRef.current.precon) {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers,
        body: preconBody,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      lastSavedRef.current.precon = preconBody;
    }
    // The baseline (FIRST-LIST): the same kind of body, the same rule. It
    // needs a full list, which mints the row, so a draft needs no create change.
    const baselineBody = baselinePatchBody(baselineRef.current);
    if (baselineBody !== lastSavedRef.current.baseline && !baselineWaitsRef.current) {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers,
        body: baselineBody,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      lastSavedRef.current.baseline = baselineBody;
    }
  }, [isBlankDraft, ensureDeck]);

  const autosave = useAutosave(save);
  const { markDirty, isDirty, flush } = autosave;

  // Hydrate from the server (GET joins card data — no N+1): once on mount for
  // an existing deck, and again after a version restore (P3.6) replaced the
  // list server-side — the refs and the last-saved baselines are reset too,
  // so the next autosave can't push the pre-restore list back. Draft mode
  // has no server row yet — its ready state and baselines were set at init.
  const hydrate = useCallback(async (deckId: string, signal?: AbortSignal) => {
    const token = getDeckToken(deckId);
    const res = await fetch(`/api/decks/${deckId}`, {
      headers: token ? { [DECK_TOKEN_HEADER]: token } : {},
      signal,
      cache: "no-store",
    });
    // A private deck this browser holds no key for answers the unknown id's 404
    // (route-helpers.ts), so the one message covers both.
    if (res.status === 404) {
      throw new Error("Deck not found. If it's private, this browser doesn't have its key.");
    }
    if (!res.ok) throw new Error(`Failed to load deck (${res.status}).`);
    const json: DeckResponse = await res.json();
    if (!json.deck.isOwner) {
      throw new Error(
        "You don't have edit access to this deck on this browser. " +
          "The edit key lives where the deck was created, and if you've " +
          "claimed it into an account, sign in from the Account page first.",
      );
    }
    const adapter = json.deck.game ? getAdapter(json.deck.game) : null;
    const format = adapter?.formats.find((f) => f.code === json.deck.format);
    if (!adapter || !format) throw new Error("This deck has an unknown game or format.");

    // The wire sorts by name within a zone; leaders take the decks-row
    // order instead (R2) so the art leader of a partner deck is the same
    // one before and after a reload, and the next save writes it back.
    const loadedEntries: EditorEntry[] = orderLeadersBy(
      json.cards.map((c) => ({
        cardId: c.cardId,
        zone: c.zone,
        qty: c.qty,
        tags: c.tags,
        ...(c.printingId ? { printingId: c.printingId } : {}),
      })),
      format,
      json.deck.leaderIds ?? [],
    );
    entriesRef.current = loadedEntries;
    metaRef.current = {
      name: json.deck.name,
      description: json.deck.description ?? "",
      notes: json.deck.notes ?? "",
    };
    goalsRef.current = readGoals(json.deck.goals);
    hiddenRef.current = normalizeHiddenTokens(json.deck.hiddenTokens);
    preconRef.current = json.deck.precon ?? null;
    formatRef.current = format;
    baselineRef.current = json.deck.baseline ?? null;
    lastSavedRef.current = {
      cards: JSON.stringify({ cards: toSavePayload(loadedEntries) }),
      meta: metaPatchBody(metaRef.current),
      goals: goalsPatchBody(goalsRef.current),
      hidden: hiddenTokensPatchBody(hiddenRef.current),
      precon: ownsPreconPatchBody(preconRef.current?.owns ?? null),
      baseline: baselinePatchBody(baselineRef.current),
    };
    // FIRST-LIST, the owner's call 4: a list already full with no baseline
    // keeps itself as it loaded. Not saved here (a load writes nothing): it
    // differs from the saved body, so the next edit's save sends it.
    if (!baselineRef.current) {
      baselineRef.current = firstListStamp(null, preconRef.current, format, loadedEntries);
    }
    baselineWaitsRef.current = baselineRef.current !== null && !json.deck.baseline;
    setEntries(loadedEntries);
    setGoals(goalsRef.current);
    setHiddenTokens(hiddenRef.current);
    setPrecon(preconRef.current);
    setBaseline(baselineRef.current);
    // FIRST-LIST: the baseline's cut cards join the map, so "Take out" names them.
    setCards(
      new Map([
        ...(json.baselineCards ?? []).map((c) => [c.id, toEditorCard(c)] as const),
        ...json.cards.map((c) => [c.cardId, toEditorCard(c.card)] as const),
      ]),
    );
    setDeckName(json.deck.name);
    setDetails({ description: json.deck.description ?? "", notes: json.deck.notes ?? "" });
    setShare({
      publicId: json.deck.publicId,
      visibility: json.deck.visibility,
      accountDeck: token === null,
    });
    setForkedFrom(json.deck.forkedFrom ?? null);
    setOwned(new Set(json.owned ?? []));
    setHasCollection(json.hasCollection ?? false);
    ownedCheckedRef.current = new Set(json.cards.map((c) => c.cardId));
    setLoad({ state: "ready", adapter, format });
  }, []);

  // ONE seeder per draft (X3): a precon list beats a random roll beats a
  // combo beats a plain leader — the first kind present runs, alone, and
  // alone flips seedSettled, so the ?autofill=1 sheet below can never open
  // on a half-seeded draft. Every kind but `from` places a leader, so a
  // format with no leader zone expects none of them. A combo needs the
  // adapter's combo capability: One Piece reads `combo` as noise and seeds
  // its leader as if it were absent (no apology copy).
  const draftSeed: "from" | "surprise" | "combo" | "leader" | null =
    initialDeckId !== null || load.state !== "ready"
      ? null
      : draftFromSlug
        ? "from"
        : !load.format.zones.some((z) => z.isLeaderZone)
          ? null
          : draftSurprise
            ? "surprise"
            : draftComboKey && load.adapter.capabilities.combos
              ? "combo"
              : draftLeaderKey
                ? "leader"
                : null;

  // Seed the hub CTA's leader into a fresh draft (P4.6). Resolve by external
  // key (the exact-id pass), then add the leader-zone entry WITHOUT marking
  // dirty — state only, so abandoning the draft still creates nothing. The
  // ref guard keeps StrictMode's double-effect from seeding twice; the fetch
  // is deliberately not aborted on cleanup (StrictMode's immediate
  // mount/unmount would cancel the one attempt the guard allows), and the
  // occupied-zone check makes a late response a no-op rather than a clobber.
  const seededLeaderRef = useRef(false);
  // Draft seed settlement (W9c): flips true once the one seeder that ran has
  // finished — success OR failure — so the ?autofill=1 sheet-open below can
  // wait for the seed to land without ever waiting forever.
  const [seedSettled, setSeedSettled] = useState(false);
  // The combo the review sheet is built around (X3): set by the combo
  // seeder (for its ?autofill=1 sheet) and by the Combo Radar's "Suggest
  // full list", cleared whenever the sheet closes (Cancel, Esc, Apply);
  // the empty-deck door and More → Autofill… open the plain sheet.
  const [autofillPin, setAutofillPin] = useState<ComboPin | null>(null);
  // COLLECTION-PAGE: whether the sheet now open starts with "Only cards I
  // own" ticked. Set by the `?autofill=1` latch from `draftOwned`, and
  // cleared with the pin whenever the sheet closes or another door opens it.
  const [autofillStartOwned, setAutofillStartOwned] = useState(false);
  useEffect(() => {
    if (draftSeed !== "leader" || !draftLeaderKey || seededLeaderRef.current) return;
    if (load.state !== "ready") return;
    seededLeaderRef.current = true;
    const { adapter, format } = load;
    const leaderZone = format.zones.find((z) => z.isLeaderZone);
    // No leader zone: nothing to seed — the sheet-open latch below counts
    // this as "no seed expected", so no settle mark is needed here.
    if (!leaderZone) return;
    void (async () => {
      try {
        const res = await fetch("/api/cards/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: adapter.id, format: format.code, names: [draftLeaderKey] }),
        });
        if (!res.ok) return; // a broken CTA key degrades to the plain editor
        const json: { results: { match: CardWire | null }[] } = await res.json();
        const wire = json.results[0]?.match;
        if (!wire || !wire.isLeaderCandidate) return;
        if (entriesRef.current.some((e) => e.zone === leaderZone.id)) return;
        const next: EditorEntry[] = [
          ...entriesRef.current,
          { cardId: wire.id, zone: leaderZone.id, qty: 1, tags: [] },
        ];
        entriesRef.current = next;
        setEntries(next);
        const card = toEditorCard(wire);
        setCards((prev) => new Map(prev).set(wire.id, card));
        setPreview(card);
      } catch {
        // Seeding is a convenience — the editor works without it.
      } finally {
        setSeedSettled(true);
      }
    })();
  }, [draftSeed, draftLeaderKey, load]);

  // "Surprise me" (W9c): seed a RANDOM legal leader — same state-only
  // discipline as the key seeder above, but the route returns the full
  // wire, so nothing else is spent: a surprise draft stays at zero POSTs
  // until a real edit. Unlike the key seeder, failure SAYS so (a toast) —
  // the roll was the whole point of the click. One roll, two doors (Y2b):
  // the ?surprise=1 latch below (StrictMode ref guard) and the empty
  // draft's own Surprise me (surpriseDoor, further down).
  const rollLeader = useCallback(async () => {
    if (load.state !== "ready") return;
    const { adapter, format } = load;
    const leaderZone = format.zones.find((z) => z.isLeaderZone);
    if (!leaderZone) return;
    const sayNoRoll = () =>
      toast.add({
        title: `Couldn't pick a random ${adapter.display.leaderNoun}. Try again.`,
        type: "error",
        timeout: TOAST_MS,
      });
    try {
      const res = await fetch(`/api/leaders/random?game=${adapter.id}`);
      if (!res.ok) {
        sayNoRoll();
        return;
      }
      const json: { leader: CardWire | null } = await res.json();
      const wire = json.leader;
      if (!wire || !wire.isLeaderCandidate) {
        sayNoRoll();
        return;
      }
      // Late-response guard: never clobber a leader added meanwhile.
      if (entriesRef.current.some((e) => e.zone === leaderZone.id)) return;
      const next: EditorEntry[] = [
        ...entriesRef.current,
        { cardId: wire.id, zone: leaderZone.id, qty: 1, tags: [] },
      ];
      entriesRef.current = next;
      setEntries(next);
      const card = toEditorCard(wire);
      setCards((prev) => new Map(prev).set(wire.id, card));
      setPreview(card);
      // A roll that lands on a deck row is an edit (LATER row 167): the door
      // stays until a create answers, so a roll clicked while a typed name's
      // create was in flight can land after it, and state only it would sit
      // under "Saved" and leave with the tab. On a draft it stays state only;
      // a roll that lands mid-create rides that save (it reads the refs).
      if (deckIdRef.current !== null) markDirty();
    } catch {
      sayNoRoll();
    }
  }, [load, markDirty]);
  const seededSurpriseRef = useRef(false);
  useEffect(() => {
    if (draftSeed !== "surprise" || seededSurpriseRef.current) return;
    if (load.state !== "ready") return;
    seededSurpriseRef.current = true;
    // Same as the key seeder: no leader zone = no seed expected below.
    if (!load.format.zones.some((z) => z.isLeaderZone)) return;
    void rollLeader().finally(() => setSeedSettled(true));
  }, [draftSeed, load, rollLeader]);

  // "Start from this precon" (W8b): seed the WHOLE product list into a
  // fresh draft — entries with the precon's own printings straight off
  // GET /api/precons/[slug], never through applyImport (its merge drops
  // printingId). State only, no markDirty: opening the seeded draft fires
  // no POST, and the first real edit mints the row (the create carries the
  // seeded name — see ensureDeck) and PUTs the full list. Same StrictMode
  // ref guard + late-response discipline as the leader seeder above; an
  // unknown or mismatched `from` seeds nothing and SAYS so (a visible
  // toast, never a silent no-op).
  const seededFromRef = useRef(false);
  useEffect(() => {
    if (draftSeed !== "from" || !draftFromSlug || seededFromRef.current) return;
    if (load.state !== "ready") return;
    seededFromRef.current = true;
    const { adapter, format } = load;
    const sayMissing = () =>
      toast.add({
        title: "Couldn't find that precon. Starting an empty deck instead.",
        type: "error",
        timeout: TOAST_MS,
      });
    void (async () => {
      try {
        const res = await fetch(`/api/precons/${encodeURIComponent(draftFromSlug)}`);
        if (!res.ok) {
          sayMissing();
          return;
        }
        const json: {
          precon?: { slug: string; productName: string };
          deck: { name: string; game: string; format: string; leaderIds: string[] };
          cards: {
            cardId: string;
            zone: string;
            qty: number;
            tags: string[];
            printingId: string | null;
            card: CardWire;
          }[];
        } = await res.json();
        // A crafted link can point a One Piece draft at an MTG product —
        // treat the mismatch exactly like an unknown slug.
        if (json.deck.game !== adapter.id || json.deck.format !== format.code) {
          sayMissing();
          return;
        }
        // Late-response guard: never clobber what the user built meanwhile.
        if (entriesRef.current.length > 0) return;
        const seeded: EditorEntry[] = orderLeadersBy(
          json.cards.map((c) => ({
            cardId: c.cardId,
            zone: c.zone,
            qty: c.qty,
            tags: c.tags,
            ...(c.printingId ? { printingId: c.printingId } : {}),
          })),
          format,
          json.deck.leaderIds,
        );
        entriesRef.current = seeded;
        setEntries(seeded);
        setCards(new Map(json.cards.map((c) => [c.cardId, toEditorCard(c.card)])));
        // The product's name, state-only: baseline moves WITH metaRef so
        // nothing turns dirty — ensureDeck sends it when the row mints.
        metaRef.current = { ...metaRef.current, name: json.deck.name };
        lastSavedRef.current.meta = metaPatchBody(metaRef.current);
        setDeckName(json.deck.name);
        // The precon itself (PRECON-OWNED), off the same response, state
        // only: its own list in its own quantities and no answer yet (the
        // baseline's), so its line lands with the list and nothing turns
        // dirty; ensureDeck sends the slug when the row mints.
        const seededPrecon: DeckPrecon = {
          slug: json.precon?.slug ?? draftFromSlug,
          name: json.precon?.productName ?? json.deck.name,
          owns: null,
          cards: preconCards(json.cards, format),
        };
        preconRef.current = seededPrecon;
        setPrecon(seededPrecon);
        const leaderWire = json.cards.find((c) => c.cardId === json.deck.leaderIds[0])?.card;
        if (leaderWire) setPreview(toEditorCard(leaderWire));
      } catch {
        sayMissing();
      } finally {
        setSeedSettled(true);
      }
    })();
  }, [draftSeed, draftFromSlug, load]);

  // "Build around this combo" (X3, WAVE3.md D3): ONE GET /api/combos/[key]
  // answers every piece as a full wire — the piece whose external key is
  // `draftLeaderKey` goes to the leader zone, the rest to the main deck,
  // STATE ONLY (no markDirty, no resolve spent): the door's draft fires no
  // POST until Apply or a first real edit. The pin is set in the same
  // batch as the pieces and the settle flag, so the ?autofill=1 sheet
  // opens on the whole seed, built around the combo. Same StrictMode ref
  // guard and late-response discipline as the seeders above; a combo link
  // with no leader, an unknown (or gone) key, or a leader that is not one
  // of its pieces seeds nothing and SAYS so, in the unknown-`from=` voice.
  const seededComboRef = useRef(false);
  useEffect(() => {
    if (draftSeed !== "combo" || !draftComboKey || seededComboRef.current) return;
    if (load.state !== "ready") return;
    seededComboRef.current = true;
    const { adapter, format } = load;
    const leaderZone = format.zones.find((z) => z.isLeaderZone);
    const mainZone = format.zones.find((z) => !z.isLeaderZone && z.countsTowardSize);
    const noun = adapter.display.leaderNoun.toLowerCase();
    const say = (title: string) => toast.add({ title, type: "error", timeout: TOAST_MS });
    const sayMissing = () => say("Couldn't find that combo. Starting an empty deck instead.");
    void (async () => {
      try {
        if (!draftLeaderKey) {
          say(`That combo link names no ${noun}. Starting an empty deck instead.`);
          return;
        }
        const res = await fetch(`/api/combos/${encodeURIComponent(draftComboKey)}`);
        if (!res.ok) {
          sayMissing();
          return;
        }
        const json: { combo: ComboView; cards: CardWire[] } = await res.json();
        const leader = json.cards.find((c) => c.externalKey === draftLeaderKey);
        if (!leader || !leader.isLeaderCandidate || !leaderZone || !mainZone) {
          say(`That combo doesn't include that ${noun}. Starting an empty deck instead.`);
          return;
        }
        // Late-response guard: never clobber what the user built meanwhile.
        if (entriesRef.current.length > 0) return;
        const next: EditorEntry[] = [
          { cardId: leader.id, zone: leaderZone.id, qty: 1, tags: [] },
          ...json.cards
            .filter((c) => c.id !== leader.id)
            .map((c) => ({ cardId: c.id, zone: mainZone.id, qty: 1, tags: [] })),
        ];
        entriesRef.current = next;
        setEntries(next);
        setCards((prev) => {
          const map = new Map(prev);
          for (const c of json.cards) map.set(c.id, toEditorCard(c));
          return map;
        });
        setPreview(toEditorCard(leader));
        // The pin is the latched sheet's context; with no ?autofill=1 there
        // is no sheet to pin (the Radar's button pins its own combo).
        if (draftAutofill) setAutofillPin(comboPin(json.combo.pieces, json.combo.templates));
      } catch {
        sayMissing();
      } finally {
        setSeedSettled(true);
      }
    })();
  }, [draftSeed, draftComboKey, draftLeaderKey, draftAutofill, load]);

  // A draft learns its player's collection (AUTOFILL-OWNED): ONE GET
  // /api/collection per mount, and only once the session names a player, so
  // a guest's draft asks nothing. The ref guard keeps StrictMode's double
  // effect, and a session refetch for the same player, from asking twice;
  // like the seeders above the request is not aborted on cleanup. Any row
  // means a collection: the owned lookups below start marking cards, and the
  // Autofill sheet's box enables. The server's 401 (a session that ended) is
  // "none", the guest's answer; any other failure says it could not check.
  useEffect(() => {
    if (draftPlayerId === null || draftCollectionAskedRef.current) return;
    draftCollectionAskedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/collection", { cache: "no-store" });
        if (res.status === 401) {
          setDraftCollection("none");
          return;
        }
        if (!res.ok) throw new Error(`collection check failed (${res.status})`);
        const json: { summary?: { rows?: number } } = await res.json();
        if ((json.summary?.rows ?? 0) > 0) setHasCollection(true);
        else setDraftCollection("none");
      } catch {
        setDraftCollection("failed");
      }
    })();
  }, [draftPlayerId]);

  // Owned lookups for cards added mid-session (P3.7): one debounced POST per
  // burst of new ids, only for users with a collection. A failed lookup
  // un-marks its ids so the next edit retries instead of leaving a card
  // silently "not owned" for the rest of the session.
  useEffect(() => {
    if (!hasCollection) return;
    const unknown = [...new Set(entries.map((e) => e.cardId))].filter(
      (id) => !ownedCheckedRef.current.has(id),
    );
    if (unknown.length === 0) return;
    const ids = unknown.slice(0, 400);
    const timer = setTimeout(() => {
      for (const id of ids) ownedCheckedRef.current.add(id);
      void (async () => {
        try {
          const res = await fetch("/api/collection/owned", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          if (!res.ok) throw new Error(`owned lookup failed (${res.status})`);
          const json: { owned: string[] } = await res.json();
          if (json.owned.length > 0) {
            setOwned((prev) => {
              const next = new Set(prev);
              for (const id of json.owned) next.add(id);
              return next;
            });
          }
        } catch {
          for (const id of ids) ownedCheckedRef.current.delete(id);
        }
      })();
    }, 600);
    return () => clearTimeout(timer);
  }, [entries, hasCollection]);

  useEffect(() => {
    if (initialDeckId === null) return;
    const controller = new AbortController();
    void (async () => {
      try {
        await hydrate(initialDeckId, controller.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ state: "error", message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => controller.abort();
  }, [initialDeckId, hydrate]);

  // Flush pending edits when the tab goes hidden or closes (pagehide), or
  // the component unmounts on client-side navigation. keepalive lets the
  // request outlive the page; the await-less send is the best a closing tab
  // allows. Hidden is the Page Lifecycle's last reliable event on a phone:
  // an OS that discards a backgrounded tab, or a crash, sends no pagehide
  // (LATER row 163). A draft whose deck doesn't exist yet has nothing
  // persisted to protect — leaving inside the first debounce window drops
  // that sliver of input rather than minting the empty deck this feature
  // exists to prevent.
  //
  // The gate is the body diff alone, and a baseline moves only when its copy
  // is answered OK (row 163): a list the debounced save has in flight goes
  // again (flush cleared the dirty flag first, and a full replace is
  // idempotent), and a copy that failed — the page back from the
  // back/forward cache, or a hidden tab gone offline — leaves its diff for
  // the next save instead of a silent "Saved". save() waits on the copies.
  //
  // The deps must stay empty: the cleanup's flush then runs on unmount only.
  // A dep that changed per render sent every edit at once through an
  // unchecked keepalive PUT, bypassing the debounce (LATER row 161).
  useEffect(() => {
    const flushKeepalive = () => {
      const deckId = deckIdRef.current;
      if (!deckId) return;
      const headers = writeHeaders(deckId);
      const copies: Promise<void>[] = [];
      // FIRST-LIST: a list going out full for the first time sets the
      // baseline here too (save()'s rule), so a tab closed on its 100th card
      // keeps it. Only with that list: a hidden tab with nothing to send writes nothing.
      const cardsBody = JSON.stringify({ cards: toSavePayload(entriesRef.current) });
      if (cardsBody !== lastSavedRef.current.cards) {
        // The list goes: a baseline a full deck loaded with goes with it (call 4).
        baselineWaitsRef.current = false;
        const stamped = firstListStamp(
          baselineRef.current,
          preconRef.current,
          formatRef.current,
          entriesRef.current,
        );
        if (stamped) {
          baselineRef.current = stamped;
          setBaseline(stamped);
        }
      }
      const send = (
        field: "cards" | "meta" | "goals" | "hidden" | "precon" | "baseline",
        url: string,
        method: "PUT" | "PATCH",
        body: string,
      ) => {
        if (body === lastSavedRef.current[field]) return;
        copies.push(
          (async () => {
            try {
              const res = await fetch(url, { method, headers, body, keepalive: true });
              if (res.ok) lastSavedRef.current[field] = body;
            } catch {
              // Lost to the network: the diff stays for the next save.
            }
          })(),
        );
      };
      send("cards", `/api/decks/${deckId}/cards`, "PUT", cardsBody);
      send("meta", `/api/decks/${deckId}`, "PATCH", metaPatchBody(metaRef.current));
      send("goals", `/api/decks/${deckId}`, "PATCH", goalsPatchBody(goalsRef.current));
      send("hidden", `/api/decks/${deckId}`, "PATCH", hiddenTokensPatchBody(hiddenRef.current));
      send(
        "precon",
        `/api/decks/${deckId}`,
        "PATCH",
        ownsPreconPatchBody(preconRef.current?.owns ?? null),
      );
      // A deck loaded full holds its baseline unsaved until the list's own
      // copy goes (the owner's call 4); any other baseline goes as it is.
      if (!baselineWaitsRef.current) {
        send("baseline", `/api/decks/${deckId}`, "PATCH", baselinePatchBody(baselineRef.current));
      }
      if (copies.length === 0) return;
      const settled: Promise<void> = Promise.all([keepaliveRef.current, ...copies]).then(() => {
        if (keepaliveRef.current === settled) keepaliveRef.current = null;
      });
      keepaliveRef.current = settled;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushKeepalive();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushKeepalive);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushKeepalive);
      flushKeepalive();
    };
  }, []);

  /** Apply a pure edit result; returns the error (if any) for pane-local display. */
  const applyEdit = useCallback(
    (result: EditResult): string | undefined => {
      if (!result.error) {
        entriesRef.current = result.entries;
        setEntries(result.entries);
        markDirty();
      }
      return result.error;
    },
    [markDirty],
  );

  const format = load.state === "ready" ? load.format : null;
  const adapter = load.state === "ready" ? load.adapter : null;

  // An add's or a swap's Undo (MAYBE-LIST): the deck side back, then the
  // Maybe rows the edit took, each where it stood. A deck side that can't
  // come back (a zone filled meanwhile) leaves the list as it is, as before.
  const applyUndo = useCallback(
    (back: EditResult, rows: readonly TakenRow[]) => {
      if (back.error || !format) return;
      applyEdit(rows.length > 0 ? restoreRows(back.entries, format, rows) : back);
    },
    [format, applyEdit],
  );

  // The editor's global keys (R3, C5): ONE listener, off while any dialog is
  // open. `/` focuses search through the pane's handle — the same handle the
  // leader zone's "Choose commander / leader" uses; `?` opens the sheet.
  // On a phone the box may sit in a hidden pane: switch to Search first and
  // focus once the pane is on screen (the layout effect below) — still inside
  // the user's gesture, so the software keyboard may open. "Add cards" and
  // "Choose commander / leader" come through here too.
  const focusAfterSwitchRef = useRef(false);
  const focusSearch = useCallback(() => {
    if (tier === "phone" && activePane !== "search") {
      focusAfterSwitchRef.current = true;
      setActivePane("search");
      return;
    }
    searchRef.current?.focus();
  }, [tier, activePane]);
  useLayoutEffect(() => {
    if (!focusAfterSwitchRef.current || activePane !== "search") return;
    focusAfterSwitchRef.current = false;
    searchRef.current?.focus();
  }, [activePane]);

  // Browse commanders / leaders from the empty zone (W4, D3): a SAVED deck
  // writes the pick intent so the hub CTA can bring the pick back to this
  // exact deck, and flushes autosave so the round trip never leaves an edit
  // behind (the unmount keepalive backstops the debounce window). Drafts
  // write nothing — the P4.6 `?leader=` draft seed is their return path.
  const handleBrowseLeader = useCallback(() => {
    const deckId = deckIdRef.current;
    if (!deckId || !adapter) return;
    writePickIntent({
      deckId,
      deckName: metaRef.current.name.trim() || "Untitled",
      game: adapter.id,
    });
    void flush();
  }, [adapter, flush]);
  const openShortcuts = useCallback(() => {
    setDialogFromMenu(false);
    setDialog("shortcuts");
  }, []);
  const openFromHeader = useCallback((next: EditorDialog) => {
    // More → Autofill… is the plain sheet, never a combo's (X3) and never
    // the collection link's ticked one (COLLECTION-PAGE).
    if (next === "autofill") {
      setAutofillPin(null);
      setAutofillStartOwned(false);
    }
    // The header's Share opens the dialog at its top (DECK-PREVIEW-BRACKET).
    if (next === "share") setShareAt(null);
    setDialogFromMenu(next !== "share");
    setDialog(next);
  }, []);
  useEditorHotkeys({ enabled: dialog === null, onSlash: focusSearch, onHelp: openShortcuts });

  const handleNameChange = useCallback(
    (name: string) => {
      setDeckName(name);
      metaRef.current = { ...metaRef.current, name };
      markDirty();
    },
    [markDirty],
  );

  // Add feedback (F3): one toast per successful search-pane add, with an
  // Undo that is a REAL edit — setQty back to the previous quantity (0
  // removes) through applyEdit, so the next autosave PUTs it. Rejections go
  // back to the pane's live line instead; nothing announces twice. The
  // panels' adds keep their own notices (they announce there already).
  const notify = useCallback((title: string, undo: () => void, description?: string) => {
    const id = toast.add({
      title,
      // A second line (AUTOFILL-TARGET: the target Add moved, and what its Undo leaves).
      ...(description ? { description } : {}),
      type: "success",
      timeout: TOAST_MS,
      actionProps: {
        children: "Undo",
        onClick: () => {
          undo();
          toast.close(id);
        },
      },
    });
  }, []);

  // Showing a card flips the tool pane back to Card (P3.2). Two channels
  // since R4: PASSIVE (search responses and arrow moves, adds) updates the
  // preview silently at every tier; EXPLICIT (a click or tap on a search
  // row, a deck row, a grid card, the leader, a validation chip, a dealt
  // card) also opens the phone's card sheet or the md tools drawer — the
  // only ways either ever opens. Nothing here touches the deck.
  const showCard = useCallback(
    (card: EditorCard, explicit = false) => {
      setPreview(card);
      setRightTab("card");
      if (!explicit) return;
      if (tier === "phone") setSheetOpen(true);
      else if (tier === "md") setToolsOpen(true);
    },
    [tier],
  );
  const inspectCard = useCallback((card: EditorCard) => showCard(card, true), [showCard]);
  // U4b: a dealt card on the phone's Hand tab opens the sheet over the hand
  // and leaves the strip where it is (inspectCard would flip it to Card, so
  // the hand would be gone when the sheet closes). Phone-only by its caller.
  const inspectInPlace = useCallback((card: EditorCard) => {
    setPreview(card);
    setSheetOpen(true);
  }, []);

  // The swap sheets' doors (Y7b). Both are the dialog slot, so opening one
  // from the Why sheet's callout closes that sheet; neither touches the deck.
  // A callout's sheet hands focus to "Why?" — or, while the new list's facts
  // are checked and "Why?" is away, to the bracket line, one Tab before it.
  const focusBracketLine = useCallback(() => {
    const line = document.querySelector<HTMLElement>("[data-slot=bracket-line]");
    return line?.querySelector<HTMLElement>("button[aria-haspopup=dialog]") ?? line;
  }, []);
  const openSwap = useCallback(
    (card: EditorCard, from: "row" | "callout") => {
      // The callout's own button is gone with its sheet: "Why?" either way.
      // A row's goes back to its "Swap…" — named, since a click doesn't focus
      // a button everywhere (Safari), so "what was focused" can't be trusted.
      closeFocusRef.current =
        from === "callout"
          ? focusBracketLine
          : () => document.querySelector<HTMLElement>(`[data-swap-row="${card.id}"]`);
      setSwapTarget({ card, from });
      setDialogFromMenu(false);
      setDialog("swap");
    },
    [focusBracketLine],
  );
  // BRACKET-FIT: the callout's "Swap to fit" door, the same way out as its
  // Swap…: the Why sheet closes, and focus comes back to "Why?".
  const openTargetFit = useCallback(() => {
    closeFocusRef.current = focusBracketLine;
    setDialogFromMenu(false);
    setDialog("target-fit");
  }, [focusBracketLine]);
  // BRACKET-UP: Below your target's "Upgrade toward" door, Swap to fit's way out.
  const openTargetUp = useCallback(() => {
    closeFocusRef.current = focusBracketLine;
    setDialogFromMenu(false);
    setDialog("target-up");
  }, [focusBracketLine]);
  const openSwapIn = useCallback((card: EditorCard, qty: number, from: "search" | "panel") => {
    // From search, focus goes back to the box either way (the add flow's
    // rule); a panel's opener keeps Base UI's default.
    closeFocusRef.current = from === "search" ? () => searchRef.current?.element() ?? null : null;
    setSwapInTarget({ card, qty, from });
    setDialogFromMenu(false);
    setDialog("swap-in");
  }, []);
  // A sheet's swap landed (Y7b): say where focus goes instead (null keeps
  // what the opener set), then close the sheet.
  const swapLanded = useCallback((focus: (() => HTMLElement | null) | null) => {
    if (focus) closeFocusRef.current = focus;
    setDialog(null);
  }, []);
  // Base UI's own return focus stands down whenever a target is set: it
  // resolves its target before the closing commit reaches the DOM.
  const sheetFinalFocus = useCallback(() => closeFocusRef.current === null, []);
  useEffect(() => {
    if (dialog !== null || closeFocusRef.current === null) return;
    const target = closeFocusRef.current();
    closeFocusRef.current = null;
    target?.focus();
  }, [dialog]);
  // "Swap in…" needs the adapter's swap and cut declarations (One Piece: neither).
  const swapInOn = Boolean(adapter?.recommend?.swap && adapter.recommend.cuts);
  /** The list is at (or past) the format's maximum: an add would push it over. */
  const atMax = useCallback(
    (list: readonly EditorEntry[]) =>
      format !== null &&
      format.deckSize.max !== null &&
      deckSizeCount(list, format) >= format.deckSize.max,
    [format],
  );

  const handleAdd = useCallback(
    (card: EditorCard, zoneId: string, qty: number): string | undefined => {
      if (!format || !adapter) return "Deck not loaded yet";
      const zone = format.zones.find((z) => z.id === zoneId);
      if (!zone) return `Unknown zone "${zoneId}"`;
      setCards((prev) => (prev.has(card.id) ? prev : new Map(prev).set(card.id, card)));
      showCard(card);
      const before = entriesRef.current;
      const previousQty = before.find((e) => e.zone === zoneId && e.cardId === card.id)?.qty ?? 0;
      // Leader replace (R3 builder fix): a DIFFERENT card into a full max-1
      // leader zone swaps the occupant out, with Undo. Magic's max-2 zone
      // never takes this path — addCard's "full" message stands there.
      // MAYBE-LIST: the card leaves Maybe on its way into the deck.
      const { entries: from, left } = leaveForDeck(format, before, zoneId, [card.id]);
      const leftNote = left.length > 0 ? MAYBE_COPY.leftMaybe : undefined;
      if (
        zone.isLeaderZone &&
        zone.max === 1 &&
        previousQty === 0 &&
        zoneQty(before, zoneId) >= 1
      ) {
        const result = replaceLeader(from, format, zoneId, card.id);
        const error = applyEdit(result);
        if (error) return error;
        const previousId = result.replaced;
        if (previousId) {
          const previousName = cards.get(previousId)?.name ?? `the previous ${zone.label}`;
          notify(
            `Replaced ${previousName} with ${card.name}`,
            () => applyUndo(replaceLeader(entriesRef.current, format, zoneId, previousId), left),
            leftNote,
          );
        }
        // A leader add is a destination, not a step in a streak (P2.8b): a
        // phone returns to the Deck pane to show the result. Zone-based, so
        // OP's Leader button behaves the same; plain adds never switch.
        if (tier === "phone") setActivePane("deck");
        return undefined;
      }
      const error = applyEdit(addCard(from, format, zoneId, card.id, qty));
      if (error) return error;
      if (zone.isLeaderZone && tier === "phone") setActivePane("deck");
      const where = zone.isLeaderZone ? ` as ${adapter.display.leaderNoun}` : "";
      notify(
        `Added ${qty > 1 ? `${qty}× ` : ""}${card.name}${where}`,
        () => applyUndo(setQty(entriesRef.current, format, zoneId, card.id, previousQty), left),
        leftNote,
      );
      return undefined;
    },
    [format, adapter, cards, applyEdit, applyUndo, showCard, notify, tier],
  );

  // The saved-deck half of the browse round trip (W4, D3): apply ?leader=
  // ONLY with a matching un-expired intent and an empty leader zone, through
  // handleAdd — Undo toast and autosave built in, unlike the draft seeder
  // above (state-only by design). One-shot ref like the seeder; every state
  // write happens inside the async IIFE (the combo-radar discipline). On
  // apply the intent clears and replaceState strips the param without a
  // history entry; a crafted link with no matching intent changes nothing.
  const appliedLeaderRef = useRef(false);
  useEffect(() => {
    if (initialDeckId === null || !applyLeaderKey || appliedLeaderRef.current) return;
    if (load.state !== "ready") return;
    appliedLeaderRef.current = true;
    const { adapter: gameAdapter, format: deckFormat } = load;
    const leaderZone = deckFormat.zones.find((z) => z.isLeaderZone);
    if (!leaderZone) return;
    if (pickIntentFor(initialDeckId, gameAdapter.id) === null) return;
    void (async () => {
      if (entriesRef.current.some((e) => e.zone === leaderZone.id)) {
        searchRef.current?.announce(
          `This deck already has a ${leaderZone.label.toLowerCase()}. The browsed pick was not applied.`,
        );
        return;
      }
      try {
        const res = await fetch("/api/cards/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: gameAdapter.id,
            format: deckFormat.code,
            names: [applyLeaderKey],
          }),
        });
        if (!res.ok) return; // a broken key degrades to the plain editor
        const json: { results: { match: CardWire | null }[] } = await res.json();
        const wire = json.results[0]?.match;
        if (!wire || !wire.isLeaderCandidate) return;
        // Late-response guard: never replace what arrived in the meantime.
        if (entriesRef.current.some((e) => e.zone === leaderZone.id)) return;
        if (handleAdd(toEditorCard(wire), leaderZone.id, 1) !== undefined) return;
        clearPickIntent();
        window.history.replaceState(window.history.state, "", `/decks/${initialDeckId}/edit`);
      } catch {
        // The pick is a convenience — the editor works without it.
      }
    })();
  }, [initialDeckId, applyLeaderKey, load, handleAdd]);

  // Adds from the right-pane panels (Suggestions P3.2, Combo Radar P3.3):
  // same edit path as handleAdd, but the preview updates without stealing
  // the tab — the user is mid-scan.
  // MAYBE-LIST: the card leaves Maybe on its way in (`leave`, the default);
  // the combo pieces' batch takes every piece's Maybe row once, up front.
  const handlePanelAdd = useCallback(
    (card: EditorCard, leave = true): { error?: string; left: TakenRow[] } => {
      if (!format) return { error: "Deck not loaded yet", left: [] };
      const mainZone = format.zones.find((z) => !z.isLeaderZone);
      if (!mainZone) return { error: "This format has no main zone", left: [] };
      setCards((prev) => (prev.has(card.id) ? prev : new Map(prev).set(card.id, card)));
      setPreview(card);
      const { entries: from, left } = leave
        ? leaveForDeck(format, entriesRef.current, mainZone.id, [card.id])
        : { entries: entriesRef.current, left: [] };
      const error = applyEdit(addCard(from, format, mainZone.id, card.id, 1));
      return { error, left: error ? [] : left };
    },
    [format, applyEdit],
  );

  // The panels' announced adds (Y6a Suggestions, Y6b the Combo Radar —
  // WAVE4 D7): the panels' path plus the add toast — "Added X" with an
  // Undo that is a REAL edit back to the previous quantity, like the search
  // pane's (F3). The panels' live lines keep only failures.
  const handleUndoableAdd = useCallback(
    (card: EditorCard): string | undefined => {
      // Y7b: at the maximum the panels' single add is "Swap in…" — the sheet, no add.
      if (swapInOn && atMax(entriesRef.current)) {
        openSwapIn(card, 1, "panel");
        return undefined;
      }
      const mainZone = format?.zones.find((z) => !z.isLeaderZone);
      const previousQty =
        entriesRef.current.find((e) => e.zone === mainZone?.id && e.cardId === card.id)?.qty ?? 0;
      const { error, left } = handlePanelAdd(card);
      if (error || !format || !mainZone) return error;
      notify(
        `Added ${card.name}`,
        () =>
          applyUndo(setQty(entriesRef.current, format, mainZone.id, card.id, previousQty), left),
        left.length > 0 ? MAYBE_COPY.leftMaybe : undefined,
      );
      return undefined;
    },
    [format, handlePanelAdd, notify, applyUndo, swapInOn, atMax, openSwapIn],
  );

  // A combo's pieces from the Combo Radar (Y6b, LATER row 179): each one
  // through the panels' path, then — unless the autofill sheet opens on
  // them — ONE toast for the batch, whose Undo sets every piece it added
  // back to the quantity it had (a real edit, like a single add's).
  const handleComboPiecesAdd = useCallback(
    (cards: readonly EditorCard[], announce: boolean): string | undefined => {
      const mainZone = format?.zones.find((z) => !z.isLeaderZone);
      if (!format || !mainZone) return "Deck not loaded yet";
      const qtyOf = (cardId: string) =>
        entriesRef.current.find((e) => e.zone === mainZone.id && e.cardId === cardId)?.qty ?? 0;
      const added: { cardId: string; previousQty: number }[] = [];
      let firstError: string | undefined;
      for (const card of cards) {
        const previousQty = qtyOf(card.id);
        const { error } = handlePanelAdd(card, false);
        if (error) firstError ??= error;
        else added.push({ cardId: card.id, previousQty });
      }
      // MAYBE-LIST: the pieces that landed leave Maybe in one step after the
      // adds — which append, so the rows' indexes are the batch's starting ones.
      const { entries: next, left } = leaveMaybe(
        entriesRef.current,
        format,
        added.map((a) => a.cardId),
      );
      if (left.length > 0) applyEdit({ entries: next });
      if (announce && added.length > 0) {
        notify(
          `Added ${added.length} combo piece${added.length === 1 ? "" : "s"}`,
          () => {
            let entries = entriesRef.current;
            for (const a of added) {
              entries = setQty(entries, format, mainZone.id, a.cardId, a.previousQty).entries;
            }
            applyUndo({ entries }, left);
          },
          left.length > 0 ? MAYBE_COPY.leftMaybe : undefined,
        );
      }
      return firstError;
    },
    [format, handlePanelAdd, notify, applyEdit, applyUndo],
  );

  // Swap Lab (Y7a, WAVE4 D8): one copy out, one in (swapCard), so the
  // count never moves — the Card tab's Alternatives pick and, since Y7b,
  // every swap sheet. The toast's Undo is a REAL edit per card (Y6b's
  // per-piece rule, not applyListSwap's whole-list restore): the new card
  // back to the quantity it had, the old row restored exactly — tags,
  // printing, place — so an edit made in between survives. The preview
  // follows the new card; `quiet` (a panel's swap-in) keeps the tab, as the
  // panels' adds do.
  const swapOne = useCallback(
    (out: EditorCard, incoming: EditorCard, quiet = false): string | undefined => {
      const mainZone = format?.zones.find((z) => !z.isLeaderZone);
      if (!format || !mainZone) return "Deck not loaded yet";
      const before = entriesRef.current;
      const index = before.findIndex((e) => e.zone === mainZone.id && e.cardId === out.id);
      // MAYBE-LIST: the incoming card leaves Maybe (a Maybe row's Swap in…, or any swap).
      const { entries: from, left } = leaveForDeck(format, before, mainZone.id, [incoming.id]);
      const result = swapCard(from, format, mainZone.id, out.id, incoming.id);
      if (result.error || index < 0) return result.error ?? "That card isn't in the deck anymore";
      const removed = before[index];
      const previousQty =
        before.find((e) => e.zone === mainZone.id && e.cardId === incoming.id)?.qty ?? 0;
      setCards((prev) => (prev.has(incoming.id) ? prev : new Map(prev).set(incoming.id, incoming)));
      const error = applyEdit(result);
      if (error) return error;
      if (quiet) setPreview(incoming);
      else showCard(incoming);
      notify(
        `Swapped ${out.name} → ${incoming.name}`,
        // The old row and the Maybe row, each back where it stood (restoreRows orders them).
        () =>
          applyUndo(setQty(entriesRef.current, format, mainZone.id, incoming.id, previousQty), [
            { entry: removed, index },
            ...left,
          ]),
        left.length > 0 ? MAYBE_COPY.leftMaybe : undefined,
      );
      return undefined;
    },
    [format, applyEdit, applyUndo, showCard, notify],
  );
  const handleSwap = useCallback(
    (out: EditorCard, wire: CardWire) => swapOne(out, toEditorCard(wire)),
    [swapOne],
  );

  // "Swap in…" (Y7b): the chosen card goes out and the sheet's card comes
  // in — the same swap, the same toast. A swap from search clears the box,
  // as an add does; the sheet closes and hands focus back.
  const handleSwapIn = useCallback(
    (outId: string): string | undefined => {
      if (!swapInTarget) return "Nothing to swap in";
      const out = cards.get(outId);
      if (!out) return "That card isn't in the deck anymore";
      const error = swapOne(out, swapInTarget.card, swapInTarget.from === "panel");
      if (error) return error;
      // From search: the box clears (and takes focus back), as an add does.
      if (swapInTarget.from === "search") searchRef.current?.reset();
      swapLanded(null);
      return undefined;
    },
    [swapInTarget, cards, swapOne, swapLanded],
  );

  const handleSetQty = useCallback(
    (zoneId: string, cardId: string, qty: number): string | undefined => {
      if (!format) return undefined;
      return applyEdit(setQty(entriesRef.current, format, zoneId, cardId, qty));
    },
    [format, applyEdit],
  );

  // The deck-list header's over-limit CTA (P3.4): flip to the Cut Coach tab
  // and bring it on screen — the Tools pane on a phone, the drawer on md; at
  // wide the strip is always in view (R4 retired the stacked page's
  // scrollIntoView with the stacked page).
  const openCuts = useCallback(() => {
    setRightTab("cuts");
    if (tier === "phone") setActivePane("tools");
    else if (tier === "md") setToolsOpen(true);
  }, [tier]);

  // One Undo for removals (Y2a, LATER row 60's cheap half): a plain
  // removal — the row's ✕, the leader's remove, a stepper reaching zero
  // (the pane routes that here) — toasts "Removed X" with an Undo that is a
  // REAL edit: restoreEntry puts the entry back (quantity, tags, printing,
  // position) through applyEdit, so the next autosave PUTs it. A zone filled
  // meanwhile refuses the Undo and says so. Steppers above zero, imports
  // and restores keep LATER row 60.
  const handleRemove = useCallback(
    (zoneId: string, cardId: string) => {
      if (!format) return;
      const before = entriesRef.current;
      const index = before.findIndex((e) => e.zone === zoneId && e.cardId === cardId);
      if (index < 0) return;
      const removed = before[index];
      applyEdit({ entries: removeCard(before, zoneId, cardId) });
      const name = cards.get(cardId)?.name ?? "the card";
      const title =
        maybeZoneOf(format)?.id === zoneId
          ? MAYBE_COPY.removed(name, removed.qty)
          : `Removed ${removed.qty > 1 ? `${removed.qty}× ` : ""}${name}`;
      notify(title, () => {
        const error = applyEdit(restoreEntry(entriesRef.current, format, removed, index));
        if (error) {
          toast.add({ title: `Couldn't undo: ${error}.`, type: "error", timeout: TOAST_MS });
        }
      });
    },
    [format, cards, applyEdit, notify],
  );

  // "Keep this deck" (Y2a): a seeded draft's explicit acceptance is a real
  // edit — markDirty, then flush now instead of waiting out the debounce.
  // save() runs ensureDeck (single-flight) and PUTs the seeded list; the
  // button leaves with the "saved" state, so a second click has nothing to
  // press: exactly one deck.
  const keepDeck = useCallback(() => {
    markDirty();
    void flush();
  }, [markDirty, flush]);

  // The empty list's start doors (Y2b, WAVE4 D2). Paste a list opens the
  // Import dialog (focus falls back to Base UI's default on close — the
  // door is gone once a list lands); Surprise me rolls through the same
  // rollLeader as ?surprise=1, state only, and waits while a roll is in
  // flight. Start from a precon is a plain link (the pane's).
  const openImport = useCallback(() => {
    setDialogFromMenu(false);
    setDialog("import");
  }, []);
  const [rolling, setRolling] = useState(false);
  const surpriseDoor = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    void (async () => {
      // A removal still inside its debounce (LATER row 164) settles first —
      // a blank draft's flush mints nothing — so the roll lands state only
      // instead of riding that save into a row.
      if (isBlankDraft()) await flush();
      await rollLeader();
    })().finally(() => setRolling(false));
  }, [rolling, isBlankDraft, flush, rollLeader]);
  // The first approval's "Share this deck" (Y2b): the existing dialog,
  // opened from the deck pane rather than the More menu.
  const openShare = useCallback(() => {
    setDialogFromMenu(false);
    setShareAt(null);
    setDialog("share");
  }, []);
  // The bracket line's "Why?" (Y4a, WAVE4 D5): the Why sheet, opened from
  // the deck pane — so focus goes back to "Why?" on close (Base UI's
  // default), never to the More trigger.
  const openBracket = useCallback(() => {
    setDialogFromMenu(false);
    setSheetAt(null);
    setSheetFrom(null);
    setDialog("bracket");
  }, []);
  // The goals line's "Change" / "Set one" in Suggestions (Y6a, WAVE4 D7 —
  // LATER row 175's door): the same sheet, opened at Your target, so a
  // target can be set before the list has found anything. Focus lands on
  // the target's choice and goes back to "Change" on close.
  const openGoals = useCallback(() => {
    setDialogFromMenu(false);
    setSheetAt("target");
    setSheetFrom(null);
    setDialog("bracket");
  }, []);
  // The Share dialog's bracket line (DECK-PREVIEW-BRACKET): "Declare a
  // bracket" / "Change" open the same sheet at Your target, one dialog at a
  // time. Closing the sheet brings the Share dialog back with focus on that
  // action, so the owner reads what link previews now say and copies the
  // link; once the Share dialog closes, focus goes to the header's Share
  // (the dialog's own opener is gone by then), never to the page.
  const focusShareButton = useCallback(
    () => document.querySelector<HTMLElement>("[data-slot=primary-slot] button"),
    [],
  );
  const declareFromShare = useCallback(() => {
    closeFocusRef.current = focusShareButton;
    setDialogFromMenu(false);
    setSheetAt("target");
    setSheetFrom("share");
    setDialog("bracket");
  }, [focusShareButton]);
  const closeBracket = useCallback(() => {
    if (sheetFrom === "share") {
      setShareAt("bracket");
      setDialog("share");
    } else {
      setDialog(null);
    }
  }, [sheetFrom]);
  // The goals line's "Fit my budget" in Suggestions (Y8): the Fit sheet —
  // More's "Fit my budget…" opens the same one through openFromHeader (focus
  // back to More). From the line, focus goes back to the line once the sheet
  // closes: its first button — "Fit my budget" while still over, "Change"
  // once the deck fits (the door itself is gone then).
  const openFit = useCallback(() => {
    closeFocusRef.current = () =>
      [...document.querySelectorAll<HTMLElement>("[data-slot=goals-line]")]
        .find((line) => !line.closest("[hidden]"))
        ?.querySelector<HTMLElement>("button") ?? null;
    setDialogFromMenu(false);
    setDialog("fit");
  }, []);
  // PRECON-CHANGES: the deck pane's "See changes": the sheet with both lists.
  // Focus goes back to that control once the sheet closes, by name (a click
  // doesn't focus a button everywhere, so "what was focused" can't be trusted).
  const openPreconChanges = useCallback(() => {
    closeFocusRef.current = () =>
      document.querySelector<HTMLElement>("[data-slot=precon-changes-line] button");
    setDialogFromMenu(false);
    setDialog("precon-changes");
  }, []);
  // FIRST-LIST: the same, from the hand-built deck's line.
  const openFirstListChanges = useCallback(() => {
    closeFocusRef.current = () =>
      document.querySelector<HTMLElement>("[data-slot=first-list-line] button");
    setDialogFromMenu(false);
    setDialog("first-list-changes");
  }, []);
  // FIRST-LIST, the owner's call 2: "I've made these changes" — the list on
  // screen becomes the baseline. A setting like the goals (its own PATCH, the
  // next save), with a toast whose Undo puts the previous baseline back.
  // The sheet closes; the line then has no "See changes", so focus goes to
  // its words, which now say there is nothing to change.
  const handleResetBaseline = useCallback(() => {
    const fmt = formatRef.current;
    if (!fmt) return;
    const previous = baselineRef.current;
    const next = baselineOf(entriesRef.current, fmt, "owner", new Date().toISOString());
    baselineRef.current = next;
    baselineWaitsRef.current = false;
    setBaseline(next);
    markDirty();
    closeFocusRef.current = () =>
      document.querySelector<HTMLElement>("[data-slot=first-list-line] [tabindex='-1']");
    setDialog(null);
    notify(FIRST_LIST_COPY.resetToast, () => {
      baselineRef.current = previous;
      baselineWaitsRef.current = false;
      setBaseline(previous);
      markDirty();
    });
  }, [markDirty, notify]);

  // Whole-list swap with Undo (W9b): Import and Autofill both land here.
  // The previous list is captured for the toast's Undo, which restores it
  // through the same ref + state + markDirty path — a REAL edit the next
  // autosave PUTs (Import gains the Undo it never had). mergeEntries folds
  // duplicate (zone, card) rows — autofill picks on top of kept basics —
  // because the PUT route rejects duplicate keys.
  const applyListSwap = useCallback(
    (
      nextEntries: EditorEntry[],
      newCards: readonly CardWire[],
      title: string,
      /** The toast's second line (AUTOFILL-TARGET); the Undo is still the list's alone. */
      description?: string,
    ) => {
      const previous = entriesRef.current;
      setCards((prev) => {
        const next = new Map(prev);
        for (const card of newCards) if (!next.has(card.id)) next.set(card.id, toEditorCard(card));
        return next;
      });
      // MAYBE-LIST: every card the change brought into the deck leaves Maybe
      // (Import, Fit, Swap to fit, Upgrade toward, Autofill's Add); the Undo
      // restores the previous list whole, its Maybe rows with it.
      const folded = mergeEntries(nextEntries);
      const merged = format
        ? leaveMaybe(folded, format, enteredDeck(previous, folded, format)).entries
        : folded;
      entriesRef.current = merged;
      setEntries(merged);
      markDirty();
      notify(
        title,
        () => {
          entriesRef.current = previous;
          setEntries(previous);
          markDirty();
        },
        description,
      );
    },
    [format, markDirty, notify],
  );

  // Import applies as one whole-list swap: the pure applyImport already
  // merged/spilled per format rules, so the result is save-ready as-is.
  const handleImport = useCallback(
    (outcome: ImportOutcome) => {
      applyListSwap(outcome.entries, outcome.cards, "Import applied");
    },
    [applyListSwap],
  );

  // DECK-TOKENS: the Tokens section's add, into the format's token zone,
  // through handleAdd (its "Added X" toast and Undo, the Card tab showing
  // it). Tokens never count toward the size, so a full 100 never turns this
  // into Swap in….
  const handleAddTokens = useCallback(
    (token: EditorCard): string | undefined => {
      if (!format) return "Deck not loaded yet";
      const zone = tokenZoneOf(format);
      if (!zone) return "This deck has no token list";
      return handleAdd(token, zone.id, 1);
    },
    [format, handleAdd],
  );

  // MAYBE-LIST: a Suggestions row's Maybe, and a search row's (with the
  // box's quantity, by its button or Shift+Enter); since LATER 538 also a
  // Combos one-away row's and the phone card sheet's. The card is parked in the format's Maybe zone, which
  // counts toward no size, so it is offered at any size (the owner's
  // decision 1: beside "Swap in…" at the maximum). A card the deck plays, or
  // one already parked, is refused with its sentence; the toast's Undo takes
  // it out again.
  const handleMaybeAdd = useCallback(
    (card: EditorCard, qty = 1): string | undefined => {
      if (!format) return "Deck not loaded yet";
      const zone = maybeZoneOf(format);
      if (!zone) return "This deck has no Maybe list";
      const before = entriesRef.current;
      if (before.some((e) => e.cardId === card.id && isPlayableZone(format, e.zone))) {
        return MAYBE_COPY.alreadyInDeck;
      }
      if (before.some((e) => e.cardId === card.id && e.zone === zone.id)) {
        return MAYBE_COPY.alreadyInMaybe;
      }
      setCards((prev) => (prev.has(card.id) ? prev : new Map(prev).set(card.id, card)));
      setPreview(card);
      const error = applyEdit(addCard(before, format, zone.id, card.id, qty));
      if (error) return error;
      notify(MAYBE_COPY.added(card.name, qty), () =>
        applyEdit(setQty(entriesRef.current, format, zone.id, card.id, 0)),
      );
      return undefined;
    },
    [format, applyEdit, notify],
  );

  // MAYBE-LIST: a Maybe row's "Move to deck" (the section's row, the card
  // sheet). Below the deck's maximum the row's copies go to the main list,
  // with the printing the row chose when the deck had no row of the card,
  // and the row leaves Maybe: one toast, one Undo for both. At the maximum
  // it is "Swap in…" (Y7b's sheet), whose swap takes it out (swapOne).
  const handleMoveToDeck = useCallback(
    (cardId: string): string | undefined => {
      if (!format) return "Deck not loaded yet";
      const zone = maybeZoneOf(format);
      const mainZone = format.zones.find((z) => !z.isLeaderZone);
      const card = cards.get(cardId);
      const before = entriesRef.current;
      const row = zone && before.find((e) => e.zone === zone.id && e.cardId === cardId);
      if (!zone || !mainZone || !card || !row) return "That card isn't in Maybe anymore";
      if (swapInOn && atMax(before)) {
        openSwapIn(card, 1, "panel");
        return undefined;
      }
      const previousQty =
        before.find((e) => e.zone === mainZone.id && e.cardId === cardId)?.qty ?? 0;
      const { entries: from, left } = leaveMaybe(before, format, [cardId]);
      const added = addCard(from, format, mainZone.id, cardId, row.qty);
      if (added.error) return added.error;
      const next =
        previousQty === 0 && row.printingId
          ? setPrinting(added.entries, cardId, row.printingId)
          : added.entries;
      const error = applyEdit({ entries: next });
      if (error) return error;
      setPreview(card);
      notify(MAYBE_COPY.moved(card.name, row.qty), () =>
        applyUndo(setQty(entriesRef.current, format, mainZone.id, cardId, previousQty), left),
      );
      return undefined;
    },
    [format, cards, applyEdit, applyUndo, notify, swapInOn, atMax, openSwapIn],
  );

  // The empty deck state's autofill door (W9b): never from the More menu,
  // so focus falls back to Base UI's default on close (the button may be
  // gone once the shell applies). No combo pinned — and no argument: the
  // door hands this straight to onClick.
  const openAutofill = useCallback(() => {
    setAutofillPin(null);
    setAutofillStartOwned(false);
    setDialogFromMenu(false);
    setDialog("autofill");
  }, []);
  // The Combo Radar's "Suggest full list" (X3): the same sheet, built
  // around one combo — its pieces always kept, shown and never dropped.
  const openComboAutofill = useCallback((pin: ComboPin) => {
    setAutofillPin(pin);
    setAutofillStartOwned(false);
    setDialogFromMenu(false);
    setDialog("autofill");
  }, []);
  const closeAutofill = useCallback(() => {
    setDialog(null);
    setAutofillPin(null);
    // COLLECTION-PAGE: the link's tick belongs to the sheet it opened.
    setAutofillStartOwned(false);
  }, []);

  // ?autofill=1 (W9c): the hub CTA's latched sheet-open — ONCE, after any
  // pending draft seed settles (the sheet with no leader renders its honest
  // "set a commander first" sentence and fires nothing, so a failed seed or
  // a crafted bare ?autofill=1 both degrade there, POST-free). Behind the
  // same adapter gate as every door; never auto-applies — the sheet's one
  // open POST is the only thing a latched visit spends. A render-time latch
  // (the adjust-state-during-render pattern the chooser uses), not an
  // effect: it converges after one set and fires exactly once. The combo
  // door's pin (X3) is already in state by then — the seeder sets it in
  // the batch that settles the seed.
  const [autofillOpened, setAutofillOpened] = useState(false);
  const seedExpected = draftSeed !== null;
  if (
    initialDeckId === null &&
    draftAutofill &&
    !autofillOpened &&
    load.state === "ready" &&
    load.adapter.recommend?.autofill &&
    (!seedExpected || seedSettled)
  ) {
    setAutofillOpened(true);
    // COLLECTION-PAGE: `?owned=1` ticks this sheet's box, and no later one's.
    setAutofillStartOwned(Boolean(draftOwned));
    setDialogFromMenu(false);
    setDialog("autofill");
  }

  // ?import=1 (Y2b): the picker's Paste a list door — the same one-shot,
  // render-time latch, after any pending seed settles, for every game. A
  // crafted link that also carries ?autofill=1 gets the sheet above.
  const [importOpened, setImportOpened] = useState(false);
  if (
    initialDeckId === null &&
    draftImport &&
    !draftAutofill &&
    !importOpened &&
    load.state === "ready" &&
    (!seedExpected || seedSettled)
  ) {
    setImportOpened(true);
    setDialogFromMenu(false);
    setDialog("import");
  }

  // Visibility PATCHes immediately (not via autosave): it's a deliberate,
  // rare action and the Share dialog wants the result before it re-renders.
  // Unreachable in a pre-create draft (the Share button needs `share`, which
  // ensureDeck sets) — the guard is belt-and-suspenders.
  const setVisibility = useCallback(async (visibility: DeckVisibility) => {
    const deckId = deckIdRef.current;
    if (!deckId) return;
    const res = await fetch(`/api/decks/${deckId}`, {
      method: "PATCH",
      headers: writeHeaders(deckId),
      body: JSON.stringify({ visibility }),
    });
    if (!res.ok) throw new Error(`Visibility change failed (${res.status})`);
    setShare((prev) => (prev ? { ...prev, visibility } : prev));
  }, []);

  const handleDetailsChange = useCallback(
    (next: DeckDetails) => {
      setDetails(next);
      metaRef.current = { ...metaRef.current, ...next };
      markDirty();
    },
    [markDirty],
  );

  // Goals (Y4b): a target, an answer or the exceptions line from the Why
  // sheet — an edit like the name's, through the same autosave burst. The
  // read follows at once; the combo facts don't ask again (same card set).
  const handleGoalsChange = useCallback(
    (next: DeckGoals | null) => {
      goalsRef.current = next;
      setGoals(next);
      markDirty();
    },
    [markDirty],
  );

  // Hidden tokens (TOKEN-FILL): Hide on a derived row, or a chip's Show —
  // a setting like the goals, through the same autosave burst, its own PATCH.
  const handleHideToken = useCallback(
    (key: string) => {
      const next = normalizeHiddenTokens([...(hiddenRef.current ?? []), key]);
      hiddenRef.current = next;
      setHiddenTokens(next);
      markDirty();
    },
    [markDirty],
  );
  const handleShowTokens = useCallback(
    (keys: string[]) => {
      const gone = new Set(keys);
      const next = normalizeHiddenTokens((hiddenRef.current ?? []).filter((k) => !gone.has(k)));
      hiddenRef.current = next;
      setHiddenTokens(next);
      markDirty();
    },
    [markDirty],
  );

  // "Do you own this precon?" (PRECON-OWNED): Yes or No — a setting like the
  // goals, through the same autosave burst, its own PATCH; on a draft, the
  // edit that mints the row. The same answer again is no edit.
  const handleAnswerPrecon = useCallback(
    (owns: boolean) => {
      const current = preconRef.current;
      if (!current || current.owns === owns) return;
      const next = { ...current, owns };
      preconRef.current = next;
      setPrecon(next);
      markDirty();
    },
    [markDirty],
  );

  // The Fit sheet (Y8, D9): the reviewed swaps as ONE whole-list swap — one
  // toast, one Undo for the batch — and the total they fit to, saved in the
  // same burst (the Undo restores the list; the total stays). Saving the
  // total alone ("Save $150 as this deck's total", or removing it) is the
  // same goals edit.
  const handleSaveTotal = useCallback(
    (totalUsd: number | null) => handleGoalsChange(withTotal(goalsRef.current, totalUsd)),
    [handleGoalsChange],
  );
  const handleFitApply = useCallback(
    ({ entries: next, cards: wires, swapped, totalUsd }: FitApply) => {
      applyListSwap(next, wires, FIT_COPY.toast(swapped));
      if (goalsRef.current?.budget?.totalUsd !== totalUsd) handleSaveTotal(totalUsd);
      setDialog(null);
    },
    [applyListSwap, handleSaveTotal],
  );
  // BRACKET-FIT: the reviewed swaps as ONE whole-list swap (Fit's toast and
  // its one Undo); the door named "Why?" for the focus when the sheet closes.
  // BRACKET-UP's "Upgrade toward" sheet applies through it too.
  const handleTargetFitApply = useCallback(
    ({ entries: next, cards: wires, swapped }: TargetFitApply) => {
      applyListSwap(next, wires, FIT_COPY.toast(swapped));
      setDialog(null);
    },
    [applyListSwap],
  );
  // AUTOFILL-TARGET: the Autofill sheet's Add. The picks as ONE whole-list
  // swap ("Added N cards", one Undo), and the sheet's choice of Your target
  // stored as the deck's when it differs, in the same burst: a draft's
  // create carries it, a saved deck sends its goals PATCH beside the PUT.
  // The toast says both, and that the Undo restores the list and leaves the
  // target (the Fit sheet's total, the owner's call 4 of 2026-11-15).
  // AUTOFILL-TOTAL (the owner's decision 16): the sheet's Deck total is
  // saved the same way, in the same goals edit, so a target and a total
  // moved together are still ONE create or ONE PATCH; the toast names what
  // was saved, and that the Undo leaves it.
  const handleAutofillApply = useCallback(
    ({
      entries: next,
      cards: wires,
      added,
      target,
      total,
      owned: fromCollection,
    }: AutofillApply) => {
      const brackets = adapter?.brackets;
      const from = goalsRef.current?.targetLevel ?? null;
      const moved = brackets !== undefined && target !== undefined && target !== from;
      const fromTotal = goalsRef.current?.budget?.totalUsd ?? null;
      const totalMoved = total !== undefined && total !== fromTotal;
      // AUTOFILL-OWNED: picks the route built from the player's collection
      // are owned by construction, so they are marked in the render the list
      // lands in. The owned lookup still asks about every new card (the
      // assumed basics among them), as after any whole-list change.
      if (fromCollection && fromCollection.length > 0) {
        setOwned((prev) => {
          const marked = new Set(prev);
          for (const id of fromCollection) marked.add(id);
          return marked;
        });
      }
      applyListSwap(
        next,
        wires,
        `Added ${added} card${added === 1 ? "" : "s"}`,
        autofillSavedToast(
          moved ? autofillTargetTitle(brackets, from, target) : null,
          totalMoved ? autofillTotalTitle(fromTotal, total) : null,
        ) ?? undefined,
      );
      if (moved || totalMoved) {
        let saved = goalsRef.current;
        if (moved) saved = withTarget(saved, target);
        if (totalMoved) saved = withTotal(saved, total);
        handleGoalsChange(saved);
      }
      closeAutofill();
    },
    [adapter, applyListSwap, handleGoalsChange, closeAutofill],
  );

  // Deck deletion (P2.8 follow-up): the dialog owns the confirm; this owns
  // the call and the exit. Guest decks (this browser holds a token) land on
  // home, account decks on /account. A debounced autosave may still fire
  // against the dead id during navigation — a harmless 404. Deleting a draft
  // whose deck was never created is just leaving.
  const handleDeleteDeck = useCallback(async (): Promise<string | null> => {
    const deckId = deckIdRef.current;
    if (!deckId) {
      router.replace("/");
      return null;
    }
    const token = getDeckToken(deckId);
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "DELETE",
        headers: token ? { [DECK_TOKEN_HEADER]: token } : {},
      });
      if (!res.ok && res.status !== 204) return `Couldn't delete the deck (${res.status}).`;
    } catch {
      return "Couldn't delete. Check your connection and try again.";
    }
    removeDeckToken(deckId);
    router.replace(token !== null ? "/" : "/account");
    router.refresh();
    return null;
  }, [router]);

  // Version restore (P3.6): flush what's on screen first so the safety
  // snapshot is the list the user sees, then re-hydrate from the server
  // after the swap. The preview card may now be out of the deck — harmless.
  const beforeRestore = useCallback(async () => {
    await autosave.flush();
  }, [autosave]);
  const afterRestore = useCallback(async () => {
    const deckId = deckIdRef.current;
    if (deckId) await hydrate(deckId);
  }, [hydrate]);

  // The game journal (Y9a): flush first, so the list the game keeps is the
  // list on screen — true once nothing unsaved is left. A save that fails
  // leaves the deck dirty, and the dialog logs nothing.
  const beforeLog = useCallback(async () => {
    await flush();
    return !isDirty();
  }, [flush, isDirty]);
  // A game logged: the dialog closes so the toast's Undo is reachable (a
  // modal blocks it), and that Undo is the games route's DELETE — the game
  // and, when no other game was played with it, the snapshot it minted
  // (the shared toast, logged-toast.ts — Y9b's doors raise the same one).
  const handleLogged = useCallback((logged: LogResult) => {
    setDialog(null);
    const deckId = deckIdRef.current;
    if (deckId) showLoggedToast(deckId, logged);
  }, []);

  // The copies the DECK holds (MAYBE-LIST: a Maybe card is not in the deck):
  // the search row's ×N, Suggestions' "In deck ✓" and the Combo Radar's
  // missing pieces all read it — a piece parked in Maybe is still missing.
  const inDeckQty = useMemo(
    () => (format ? playableQty(entries, format) : new Map<string, number>()),
    [entries, format],
  );
  // The cards parked in Maybe: the "In Maybe" of Suggestions and Combos, and the search row's mark.
  const inMaybe = useMemo(
    () => (format ? maybeCardIds(entries, format) : new Set<string>()),
    [entries, format],
  );

  // Tag editing (P2.7): the detail pane edits the previewed card's entry.
  // Prefer a non-leader entry — tags group the main list — but the leader
  // entry is still taggable when it's all there is. MAYBE-LIST: never a
  // Maybe entry — a card that sits in Maybe alone gets no tag editor.
  const tagging = useMemo(() => {
    if (!preview || !format) return null;
    const leaderZones = new Set(format.zones.filter((z) => z.isLeaderZone).map((z) => z.id));
    const maybeId = maybeZoneOf(format)?.id;
    const tagged = entries.filter((e) => e.zone !== maybeId);
    const entry =
      tagged.find((e) => e.cardId === preview.id && !leaderZones.has(e.zone)) ??
      tagged.find((e) => e.cardId === preview.id);
    if (!entry) return null;
    return {
      tags: entry.tags,
      onSetTags: (tags: string[]) =>
        applyEdit({ entries: setTags(entriesRef.current, entry.zone, entry.cardId, tags) }),
    };
  }, [preview, format, entries, applyEdit]);

  // A chosen printing must show everywhere at once (W6): the per-card image
  // map feeds the list, the grid, the leader zone and the sample hand — a
  // reload would otherwise be the first place the choice renders. The
  // preview is a detached copy and follows separately. The back flag goes
  // with the image (CARD-FLIP-EDITOR): it is the shown printing's, so a
  // chosen two-sided printing of a single-faced card can turn, and a chosen
  // single-faced one of a double-faced card cannot, as after a reload.
  const setCardImage = useCallback((cardId: string, image: string | null, hasBack: boolean) => {
    const shown = (card: EditorCard): EditorCard => {
      const next: EditorCard = { ...card, image };
      if (hasBack) next.hasBack = true;
      else delete next.hasBack;
      return next;
    };
    setCards((prev) => {
      const existing = prev.get(cardId);
      if (!existing || (existing.image === image && (existing.hasBack ?? false) === hasBack)) {
        return prev;
      }
      return new Map(prev).set(cardId, shown(existing));
    });
    setPreview((prev) => (prev && prev.id === cardId ? shown(prev) : prev));
  }, []);

  // Choosing a printing is a REAL edit (W6, D5): setPrinting → applyEdit →
  // the autosave PUTs printingId, and the toast's Undo re-applies the
  // previous choice the same way — never a client-only rollback. The
  // commander's ambient art follows on its own: leaderArtTarget reads the
  // entry's printingId, and useLeaderArt refetches when it changes.
  const handleSetPrinting = useCallback(
    (card: EditorCard, row: GalleryPrinting) => {
      const before = entriesRef.current;
      const entry = before.find((e) => e.cardId === card.id);
      if (!entry) return;
      const previousId = entry.printingId ?? null;
      if (previousId === row.id) return;
      const previous = cards.get(card.id) ?? card;
      applyEdit({ entries: setPrinting(before, card.id, row.id) });
      setCardImage(card.id, embeddablePrintingImageUrl(row, "normal"), row.hasBack);
      notify(`${card.name} now uses ${row.setCode.toUpperCase()} ${row.collectorNumber}`, () => {
        applyEdit({ entries: setPrinting(entriesRef.current, card.id, previousId) });
        setCardImage(card.id, previous.image, previous.hasBack ?? false);
      });
    },
    [cards, applyEdit, setCardImage, notify],
  );

  // The pane's printing selection (W6) plumbs the way `tagging` does:
  // present only when the previewed card is in the deck. The CARD is the
  // unit, not one (zone, card) entry — see setPrinting's docblock.
  const printingEditing = useMemo<PrintingEditing | null>(() => {
    if (!preview) return null;
    const previewed = preview;
    const entry = entries.find((e) => e.cardId === previewed.id);
    if (!entry) return null;
    return {
      printingId: entry.printingId ?? null,
      onSetPrinting: (row: GalleryPrinting) => handleSetPrinting(previewed, row),
    };
  }, [preview, entries, handleSetPrinting]);

  // Swap Lab (Y7a): the Card tab's Alternatives for a main-list card the
  // adapter offers them for (Magic: not a land; One Piece: never). The body
  // is the draft Suggestions snapshot plus the card — drafts and saved decks
  // ask the same way — and null until a leader gives the deck its colors.
  const swapEditing = useMemo<SwapEditing | null>(() => {
    const swapMeta = adapter?.recommend?.swap;
    const mainZone = format?.zones.find((z) => !z.isLeaderZone);
    if (!preview || !adapter || !format || !swapMeta || !mainZone) return null;
    const previewed = preview;
    if (!entries.some((e) => e.zone === mainZone.id && e.cardId === previewed.id)) return null;
    if (!swapMeta.offers(previewed)) return null;
    const snapshot = hasLeader(entries, format)
      ? snapshotBody(adapter.id, format, entries, undefined, suggestionGoals(goals))
      : null;
    return {
      body: snapshot ? { ...snapshot, cardId: previewed.id } : null,
      onSwap: (wire: CardWire) => handleSwap(previewed, wire),
    };
  }, [preview, adapter, format, entries, goals, handleSwap]);

  // The swap sheet's ask (Y7b): the same body for the sheet's card; a pick
  // swaps, then closes the sheet.
  const sheetSwap = useMemo<SwapEditing | null>(() => {
    if (!swapTarget || !adapter || !format) return null;
    const out = swapTarget.card;
    const snapshot = hasLeader(entries, format)
      ? snapshotBody(adapter.id, format, entries, undefined, suggestionGoals(goals))
      : null;
    return {
      body: snapshot ? { ...snapshot, cardId: out.id } : null,
      onSwap: (wire: CardWire) => {
        const error = handleSwap(out, wire);
        if (error) return error;
        // A row's: the new card's own row "Swap…"; the callout's: as opened.
        swapLanded(
          swapTarget.from === "row"
            ? () => document.querySelector<HTMLElement>(`[data-swap-row="${wire.id}"]`)
            : null,
        );
        return undefined;
      },
    };
  }, [swapTarget, adapter, format, entries, goals, handleSwap, swapLanded]);

  // Which cards get "Swap…" (Y7b): a main-list card the adapter offers
  // alternatives for — never a commander, a land, or anything in One Piece.
  const swapMeta = adapter?.recommend?.swap;
  const mainZoneId = format?.zones.find((z) => !z.isLeaderZone)?.id ?? null;
  const canSwapRow = useCallback(
    (entry: EditorEntry, card: EditorCard) =>
      entry.zone === mainZoneId && (swapMeta?.offers(card) ?? false),
    [mainZoneId, swapMeta],
  );
  const canSwapId = useCallback(
    (cardId: string) => {
      const card = cards.get(cardId);
      if (!card || !entries.some((e) => e.zone === mainZoneId && e.cardId === cardId)) return false;
      return swapMeta?.offers(card) ?? false;
    },
    [cards, entries, mainZoneId, swapMeta],
  );
  const swapFromCallout = useCallback(
    (cardId: string) => {
      const card = cards.get(cardId);
      if (card) openSwap(card, "callout");
    },
    [cards, openSwap],
  );

  // Live validation (P1.4) and analytics (P1.5): the adapter's pure functions
  // on every edit, over one shared snapshot. validate is the same code the PUT
  // route re-runs server-side on save; analyze feeds the middle pane's blocks.
  const snapshot = useMemo(
    () => (load.state === "ready" ? toDeckSnapshot(load.adapter.id, load.format, entries) : null),
    [load, entries],
  );
  const issues = useMemo<ValidationIssue[]>(
    () => (load.state === "ready" && snapshot ? load.adapter.validate(snapshot, cards) : []),
    [load, snapshot, cards],
  );
  const analytics = useMemo<AnalyticsBlock[]>(
    () => (load.state === "ready" && snapshot ? load.adapter.analyze(snapshot, cards) : []),
    [load, snapshot, cards],
  );
  // The bracket read (Y4a, WAVE4 D5): the adapter's pure assess beside
  // validate, over the same snapshot and card wires (they carry the flags),
  // plus the combo facts — one GET per settled id set while a commander is
  // present, drafts included (useBracketFacts). A game without `brackets`
  // asks nothing and shows nothing.
  // The playable list's ids (DECK-TOKENS): a token completes no combo, and
  // a long token list must not push the set past FACTS_MAX_IDS.
  const bracketIds = useMemo(
    () => factsIds(format ? playableEntries(entries, format) : entries),
    [entries, format],
  );
  const bracketsOn =
    adapter?.brackets !== undefined && format !== null && hasLeader(entries, format);
  const bracketFacts = useBracketFacts({
    game: adapter?.id ?? "mtg",
    enabled: bracketsOn,
    ids: bracketIds,
  });
  const bracketRead = useMemo(
    () =>
      bracketsOn && adapter?.brackets && snapshot
        ? adapter.brackets.assess({
            deck: snapshot,
            cards,
            combos: bracketFacts.combos,
            freshness: bracketFacts.freshness,
            // Y4b: the target only names the findings above it; answers only raise.
            targetLevel: goals?.targetLevel ?? null,
            answers: goals?.answers ?? null,
          })
        : null,
    [bracketsOn, adapter, snapshot, cards, bracketFacts.combos, bracketFacts.freshness, goals],
  );
  // BRACKET-FIT: the callout's door, wherever the adapter declares fixes and
  // Swap Lab and the read has a conflict (even one no card can fix).
  const fitDoorOpen = useMemo(
    () =>
      bracketRead !== null && adapter !== null && format !== null
        ? targetFitDoor({
            adapter,
            format,
            entries,
            cards,
            read: bracketRead,
            combos: bracketFacts.combos,
            freshness: bracketFacts.freshness,
            goals,
          })
        : false,
    [
      bracketRead,
      adapter,
      format,
      entries,
      cards,
      bracketFacts.combos,
      bracketFacts.freshness,
      goals,
    ],
  );
  // BRACKET-SPEED: how fast the list looks, from the same card wires (they
  // carry every card's roles) — the sheet's block and its owner nudge. Never
  // an input to the read above.
  const bracketSpeed = useMemo(
    () =>
      bracketsOn && adapter?.brackets?.speed && snapshot
        ? adapter.brackets.speed.facts(snapshot, cards)
        : null,
    [bracketsOn, adapter, snapshot, cards],
  );
  const bracketCtx = useMemo(
    () =>
      snapshot && format
        ? {
            deck: snapshot,
            cards,
            progress: addMorePhrase(deckProgress(entries, format).toGo),
            targetLevel: goals?.targetLevel ?? null,
          }
        : null,
    [snapshot, format, cards, entries, goals],
  );
  // "Share this deck" (Y2b): offered at the first approval, on a deck row,
  // once per deck per browser. Null until the deck is loaded — a loaded
  // legal deck is no approval to celebrate.
  const offerShare = useFirstApproval(
    load.state === "ready" ? issues.length === 0 : null,
    liveDeckId,
  );
  // PRECON-OWNED: what a Yes owns, the precon's own copies (null otherwise),
  // and the ONE identity-level owned set every price sheet takes: the
  // collection's identities (with a collection) ∪ the owned precon's.
  const preconCopies = useMemo(() => ownedPreconCopies(precon), [precon]);
  const ownedSetForPricing = useMemo(
    () => ownedForPricing(hasCollection ? owned : null, preconCopies),
    [hasCollection, owned, preconCopies],
  );
  // AUTOFILL-OWNED: what the Autofill sheet's "Only cards I own" box is told.
  // A saved deck knows from its GET. A draft is checking until its session
  // has answered and, for a signed-in player, its one collection read has
  // too, so the box never shows a guest's hint to a collector for a moment.
  const collectionState: CollectionState = hasCollection
    ? "available"
    : initialDeckId !== null
      ? "unavailable"
      : session.isPending || (draftPlayerId !== null && draftCollection === "unknown")
        ? "checking"
        : draftCollection === "failed" || (draftPlayerId === null && Boolean(session.error))
          ? "failed"
          : "unavailable";
  // PRECON-CHANGES: what the list on screen changed from the precon's own
  // list, derived on every render and never stored: the deck pane's second
  // line, the sheet's two lists and the rows' marks. Null without a lineage.
  const preconList = precon?.cards ?? null;
  const preconDiff = useMemo(
    () => (preconList && format ? preconChanges(preconList, entries, format) : null),
    [preconList, entries, format],
  );
  // FIRST-LIST: the same difference for a deck with no precon lineage, from
  // its baseline; a full list with none yet has nothing changed (the save
  // sets it). Null = no line.
  const firstListDiff = useMemo((): PreconChanges | null => {
    if (precon || !format) return null;
    if (baseline) return preconChanges(baseline.cards, entries, format);
    return listComplete(entries, format) ? { out: [], in: [], outQty: 0, inQty: 0 } : null;
  }, [precon, format, baseline, entries]);
  // The baseline's words: "your first full list", or "your list of Nov 26".
  const firstListWords = useMemo(() => {
    const source = baseline?.source ?? "complete";
    const when = baseline ? baselineDate(baseline.setAt) : "";
    return {
      changed: (out: number, added: number) => FIRST_LIST_COPY.changed(source, when, out, added),
      none: FIRST_LIST_COPY.noChanges(source, when),
      title: FIRST_LIST_COPY.title(source, when),
      lead: FIRST_LIST_COPY.lead(source, when),
      mark: (beyond: number, qty: number) => FIRST_LIST_COPY.rowMark(source, when, beyond, qty),
    };
  }, [baseline]);
  // The rows' marks, from whichever baseline the deck has.
  const preconBeyond = useMemo(() => {
    const diff = preconDiff ?? firstListDiff;
    return diff ? (beyondPrecon(diff) ?? undefined) : undefined;
  }, [preconDiff, firstListDiff]);
  // "You own N/100 · missing ≈ $Y" (P3.7): pure math over the same entries,
  // card prices and owned set; null (nothing rendered) without a collection
  // or an owned precon, whose copies count up to its own quantities. And
  // null for a list with no counted card (AUTOFILL-OWNED): a draft knows its
  // player's collection now, so a collector's new, empty deck would open on
  // "You own 0/0". With nothing to own there is nothing to say.
  const ownership = useMemo(() => {
    if (!(hasCollection || preconCopies !== null) || load.state !== "ready") return null;
    const summary = deckOwnership(entries, cards, owned, load.format, preconCopies ?? undefined);
    return summary.totalQty > 0 ? summary : null;
  }, [hasCollection, preconCopies, load, entries, cards, owned]);
  // The deck's cost at its cheapest printings (Y8): every goals line's
  // "est. $212 of your $150", and the Fit sheet's starting point. Owned
  // copies count $0 only with a collection, and an owned precon's copies
  // up to its quantities.
  const estimate = useMemo(
    () =>
      load.state === "ready"
        ? deckEstimate(
            entries,
            cards,
            hasCollection ? owned : null,
            load.format,
            preconCopies ?? undefined,
          )
        : null,
    [load, entries, cards, hasCollection, owned, preconCopies],
  );

  // Ambient art (R2): the FIRST leader entry drives the one request — the
  // preview card is never an input, and main-deck edits leave the key
  // unchanged. Off (or an adapter without `ambientArt`) means no request;
  // the reader's preference is unknown until hydration, and nothing paints
  // before then.
  const appearance = useAppearance();
  const artTarget = format ? leaderArtTarget(entries, format) : null;
  const leaderArt = useLeaderArt({
    enabled:
      adapter?.capabilities.ambientArt?.kind === "art_crop" && appearance?.backgroundArt === true,
    cardId: artTarget?.cardId ?? null,
    printingId: artTarget?.printingId ?? null,
  });
  // The gradient fallback (G7) from the leaders' combined identity — the
  // same OR `leaderDenorm` writes to decks.ci_mask on save.
  const swatches = useMemo(() => {
    if (!format || !adapter?.display.colorSwatches) return null;
    const ciByCard = new Map<string, number>();
    for (const e of entries) {
      const card = cards.get(e.cardId);
      if (card) ciByCard.set(e.cardId, card.ciMask);
    }
    const { leaderIds, ciMask } = leaderDenorm(entries, format, ciByCard);
    return leaderIds.length > 0 ? adapter.display.colorSwatches(ciMask) : null;
  }, [format, adapter, entries, cards]);

  if (load.state !== "ready") {
    return (
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        {load.state === "loading" ? (
          <p className="text-muted-foreground">Loading deck…</p>
        ) : (
          <>
            <p className="max-w-md text-center">{load.message}</p>
            <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
              Back to Deckwarden
            </Button>
          </>
        )}
      </main>
    );
  }

  const mainZone = load.format.zones.find((z) => !z.isLeaderZone);
  const leaderZone = load.format.zones.find((z) => z.isLeaderZone);
  const tabbed = Boolean(load.adapter.recommend || load.adapter.capabilities.combos);
  // Y7b: at the maximum, every single-card add is "Swap in…".
  const deckFull = swapInOn && atMax(entries);
  // The empty list's start doors (Y2b): Paste a list for any deck; the
  // precon and Surprise doors only while no row exists. The leader zone's
  // Browse link is the Pick door. None while a URL seed is still landing —
  // the plain empty state shows meanwhile, so no door races a seed.
  const doors =
    draftSeed !== null && !seedSettled
      ? []
      : startDoors(load.adapter, load.format).filter(
          (door) =>
            door.kind === "paste" ||
            (liveDeckId === null && (door.kind === "precon" || door.kind === "surprise")),
        );

  // The card sheet's actions (U4b, WAVE5 D5's peek), each only where it
  // applies to the inspected card. Add is the search pane's main-list add
  // (the "Added" toast and its Undo; "Swap in…" at the deck's maximum, Y7b)
  // for a card the deck doesn't hold yet: a second copy stays the row's
  // stepper, where the format's copy rule is the validator's to judge.
  // Remove is the row's remove (its Undo) for a card with an entry, a
  // non-leader entry first, as tagging picks it, the leader's included;
  // Swap… is the row's Swap Lab sheet. The two sheets close the card sheet
  // first, so neither opens over a card that is about to leave. The sheet
  // itself stays layout: only these are edits.
  // MAYBE-LIST: a Maybe entry is never the sheet's entry. A card that sits
  // in Maybe alone gets "Move to deck" ("Swap in…" at the maximum) where
  // Add would be, and "Remove from Maybe"; a card in neither list gets
  // "Maybe" after its Add (LATER 538).
  const maybeZone = maybeZoneOf(load.format);
  const sheetEntry = preview
    ? (entries.find(
        (e) => e.cardId === preview.id && e.zone !== leaderZone?.id && e.zone !== maybeZone?.id,
      ) ?? entries.find((e) => e.cardId === preview.id && e.zone !== maybeZone?.id))
    : undefined;
  const sheetMaybe =
    preview && !sheetEntry && maybeZone
      ? entries.find((e) => e.cardId === preview.id && e.zone === maybeZone.id)
      : undefined;
  const sheetActions: SheetActions = {};
  if (preview) {
    const card = preview;
    if (mainZone && !sheetEntry && sheetMaybe) {
      sheetActions.add = {
        label: deckFull ? "Swap in…" : MAYBE_COPY.move,
        onClick: () => {
          if (deckFull) setSheetOpen(false);
          const error = handleMoveToDeck(card.id);
          if (error) toast.add({ title: error, type: "error", timeout: TOAST_MS });
        },
      };
    } else if (mainZone && !sheetEntry) {
      sheetActions.add = {
        label: deckFull ? "Swap in…" : "Add",
        onClick: () => {
          if (deckFull) {
            setSheetOpen(false);
            openSwapIn(card, 1, "panel");
            return;
          }
          const error = handleAdd(card, mainZone.id, 1);
          if (error) toast.add({ title: error, type: "error", timeout: TOAST_MS });
        },
      };
    }
    // LATER 538: a card in neither list can be parked from the sheet too, at
    // any deck size; the sheet stays open and turns to the Maybe card's actions.
    if (maybeZone && !sheetEntry && !sheetMaybe) {
      sheetActions.onMaybe = () => {
        const error = handleMaybeAdd(card);
        if (error) toast.add({ title: error, type: "error", timeout: TOAST_MS });
      };
    }
    if (sheetEntry) {
      const { zone, cardId } = sheetEntry;
      sheetActions.onRemove = () => handleRemove(zone, cardId);
    } else if (sheetMaybe) {
      const { zone, cardId } = sheetMaybe;
      sheetActions.onRemove = () => handleRemove(zone, cardId);
      sheetActions.removeLabel = MAYBE_COPY.remove;
    }
    if (canSwapId(card.id)) {
      sheetActions.onSwap = () => {
        setSheetOpen(false);
        openSwap(card, "row");
      };
    }
  }

  // The tools content (R4): one tree, mounted wherever the tier puts it —
  // the third pane at wide, the drawer at md, the Tools tab on phones. On a
  // phone it is ONE strip (U4b, WAVE5 D5): Card first, the panels the
  // adapter declares, then Analytics and the sample hand as tabs of their
  // own, no longer collapsibles stacked above the strip (One Piece: Card ·
  // Analytics · Hand). From md the analytics and the hand stay below the
  // deck list (the deck pane's `extras`), where they sit beside what they
  // describe, and the strip keeps its four panels; so a 768 px crossing
  // remounts both and a dealt hand resets. The compact attribution ends the
  // content at every tier — the site footer no longer renders on the
  // editor routes.
  const phone = tier === "phone";
  // A strip that lost its tab across a tier flip (Analytics or Hand from md
  // up) shows the Card tab, the strip's first.
  const shownTab = !phone && (rightTab === "analytics" || rightTab === "hand") ? "card" : rightTab;
  const phoneTab = phone ? PHONE_TAB_CLASS : undefined;
  const toolsContent = (
    <>
      {tabbed || phone ? (
        // Base UI Tabs (F11): controlled by rightTab so showCard / openCuts
        // still drive it; every panel keepMounted so results survive a
        // switch — each panel's `active` prop gates its fetching.
        <Tabs
          value={shownTab}
          onValueChange={(value) => setRightTab(value as RightTab)}
          className="gap-0"
        >
          {/* Coarse pointers (R4): a 56 px row with a 48 px list and no list
              padding, so each trigger (list height − 1px) clears 44 px. */}
          <div
            className={cn(
              "flex h-10 shrink-0 items-center border-b px-2 pointer-coarse:h-14",
              phone && "px-1",
            )}
          >
            <TabsList
              variant="indicator"
              aria-label="Right pane view"
              className={cn(
                "pointer-coarse:p-0 pointer-coarse:group-data-horizontal/tabs:h-12",
                phone && PHONE_STRIP_CLASS,
              )}
            >
              <TabsIndicator />
              <TabsTrigger value="card" className={phoneTab}>
                Card
              </TabsTrigger>
              {load.adapter.recommend && (
                <TabsTrigger value="suggest" className={phoneTab}>
                  Suggestions
                </TabsTrigger>
              )}
              {load.adapter.capabilities.combos && (
                <TabsTrigger value="combos" className={phoneTab}>
                  Combos
                </TabsTrigger>
              )}
              {/* Always-on when declared (P3.4): no layout shift at the
                  limit — the under-limit state says nothing needs cutting. */}
              {load.adapter.recommend?.cuts && (
                <TabsTrigger value="cuts" className={phoneTab}>
                  Cuts
                </TabsTrigger>
              )}
              {phone && (
                <>
                  <TabsTrigger value="analytics" className={phoneTab}>
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="hand" className={phoneTab}>
                    Hand
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
          <TabsContent value="card" keepMounted>
            <CardDetailPane
              adapter={load.adapter}
              card={preview}
              tagging={tagging}
              printing={printingEditing}
              swap={swapEditing}
            />
          </TabsContent>
          {load.adapter.recommend && (
            <TabsContent value="suggest" keepMounted>
              <RecommendationsPanel
                adapter={load.adapter}
                format={load.format}
                deckId={liveDeckId}
                entries={entries}
                inDeckQty={inDeckQty}
                inMaybe={inMaybe}
                saveStatus={autosave.status}
                active={rightTab === "suggest"}
                onAdd={handleUndoableAdd}
                onMaybe={maybeZoneOf(load.format) ? handleMaybeAdd : undefined}
                ownedAvailable={hasCollection}
                goals={goals}
                estimate={estimate}
                onGoalsChange={handleGoalsChange}
                onChangeGoals={load.adapter.brackets ? openGoals : undefined}
                onFit={swapMeta ? openFit : undefined}
                swapIn={deckFull}
              />
            </TabsContent>
          )}
          {load.adapter.capabilities.combos && (
            <TabsContent value="combos" keepMounted>
              <ComboRadarPanel
                adapter={load.adapter}
                format={load.format}
                deckId={liveDeckId}
                entries={entries}
                cards={cards}
                inDeckQty={inDeckQty}
                inMaybe={inMaybe}
                saveStatus={autosave.status}
                active={rightTab === "combos"}
                onAdd={handleUndoableAdd}
                onAddPieces={handleComboPiecesAdd}
                onMaybe={maybeZone ? handleMaybeAdd : undefined}
                goals={goals}
                onOpenAutofill={load.adapter.recommend?.autofill ? openComboAutofill : undefined}
                swapIn={deckFull}
              />
            </TabsContent>
          )}
          {load.adapter.recommend?.cuts && (
            <TabsContent value="cuts" keepMounted>
              <CutCoachPanel
                adapter={load.adapter}
                format={load.format}
                deckId={liveDeckId}
                entries={entries}
                cards={cards}
                saveStatus={autosave.status}
                active={rightTab === "cuts"}
                onSetQty={handleSetQty}
              />
            </TabsContent>
          )}
          {phone && (
            <>
              <TabsContent value="analytics" keepMounted>
                <div className="px-3 pt-3">
                  <AnalyticsBlocks blocks={analytics} />
                </div>
              </TabsContent>
              <TabsContent value="hand" keepMounted>
                <div className="px-3 pt-3">
                  <SampleHand
                    entries={entries}
                    cards={cards}
                    format={load.format}
                    onPreview={inspectInPlace}
                    bare
                  />
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      ) : (
        // One Piece declares neither recommend nor combos: a single panel
        // under a plain "Card" heading at the tablist's row height, so both
        // games' panes align (R3 builder fix).
        <>
          <div className="flex h-10 shrink-0 items-center border-b px-3 pointer-coarse:h-14">
            <h2 className="text-sm font-medium">Card</h2>
          </div>
          <CardDetailPane
            adapter={load.adapter}
            card={preview}
            tagging={tagging}
            printing={printingEditing}
            swap={swapEditing}
          />
        </>
      )}
      <EditorAttribution adapter={load.adapter} />
    </>
  );

  return (
    <EditorLayout
      tier={tier}
      gameId={load.adapter.id}
      activePane={activePane}
      onActivePaneChange={setActivePane}
      toolsOpen={toolsOpen}
      onToolsOpenChange={setToolsOpen}
      sheetOpen={sheetOpen}
      onSheetOpenChange={setSheetOpen}
      deckCount={deckSizeCount(entries, load.format)}
      header={
        <>
          {/* One Toaster per surface (F3). The viewport is portaled outside this
              root, so it carries data-game itself (the Undo button's focus ring
              takes the game accent) and its own bottom inset (above the phone's
              tab bar, R4). */}
          <Toaster
            timeout={TOAST_MS}
            viewportProps={{ "data-game": load.adapter.id, className: EDITOR_TOAST_VIEWPORT_CLASS }}
          />
          <EditorHeader
            adapter={load.adapter}
            format={load.format}
            deckName={deckName}
            onNameChange={handleNameChange}
            forkedFrom={forkedFrom}
            saveStatus={autosave.status}
            onRetry={() => void autosave.flush()}
            canShare={share !== null}
            canHistory={liveDeckId !== null}
            onOpen={openFromHeader}
            moreRef={moreRef}
            onOpenTools={() => setToolsOpen(true)}
            draft={liveDeckId === null}
            // A draft holding cards it never edited holds a seed's — the
            // URL's, once settled, or the Surprise me door's (Y2b): any
            // edit would have marked it dirty and minted the row.
            onKeep={
              (draftSeed === null || seedSettled) &&
              liveDeckId === null &&
              entries.length > 0 &&
              autosave.status === "saved"
                ? keepDeck
                : undefined
            }
          />
        </>
      }
      dialogs={
        <ModalFinalFocus.Provider value={dialogFromMenu ? moreRef : undefined}>
          {dialog === "details" && (
            <DetailsDialog
              details={details}
              deckName={deckName}
              onChange={handleDetailsChange}
              onDelete={handleDeleteDeck}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "import" && (
            <ImportDialog
              adapter={load.adapter}
              format={load.format}
              entries={entries}
              onApply={handleImport}
              onClose={() => setDialog(null)}
            />
          )}
          {/* W9b: the review sheet — gated on the adapter's autofill
              declaration (One Piece renders no door and no sheet). */}
          {dialog === "autofill" && load.adapter.recommend?.autofill && (
            <AutofillSheet
              adapter={load.adapter}
              format={load.format}
              entries={entries}
              cards={cards}
              phone={tier === "phone"}
              pinned={autofillPin ?? undefined}
              goals={goals}
              // AUTOFILL-TARGET: the Why sheet's own rule for where a target
              // shows, and whether Upgrade toward is a door here.
              linkPreviews={share?.visibility !== "private"}
              upgradeDoor={swapInOn}
              // AUTOFILL-OWNED: what the "Only cards I own" box is told.
              collection={collectionState}
              // COLLECTION-PAGE: the box's first value, for the latched open alone.
              startOwned={autofillStartOwned}
              onApply={handleAutofillApply}
              onClose={closeAutofill}
            />
          )}
          {dialog === "export" && snapshot && (
            <ExportDialog
              text={load.adapter.serializeDecklist(snapshot, cards)}
              onClose={() => setDialog(null)}
            />
          )}
          {/* W7: whole-deck buy links. No `owned` here — the editor's lazily
              grown set can't tell "no collection" from "owns nothing"; the
              honest "Only cards I'm missing" lives on the share page, whose
              server computes ownership for the whole deck. */}
          {dialog === "buy" && load.adapter.capabilities.buy && (
            <BuyDeckDialog
              buy={load.adapter.capabilities.buy}
              entries={countedEntries(entries, load.format)}
              cards={cards}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "history" && liveDeckId && (
            <HistoryDialog
              deckId={liveDeckId}
              format={load.format}
              entries={entries}
              cards={cards}
              forkedFrom={forkedFrom}
              onBeforeRestore={beforeRestore}
              onRestored={afterRestore}
              onClose={() => setDialog(null)}
            />
          )}
          {/* Y9a: the Games dialog — live decks whose game declares a journal. */}
          {dialog === "games" && liveDeckId && share && load.adapter.journal && (
            <GamesDialog
              deckId={liveDeckId}
              adapter={load.adapter}
              accountDeck={share.accountDeck}
              phone={tier === "phone"}
              finalFocus={moreRef}
              onBeforeLog={beforeLog}
              onLogged={handleLogged}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "share" && share && (
            <ShareDialog
              publicId={share.publicId}
              visibility={share.visibility}
              accountDeck={share.accountDeck}
              onSetVisibility={setVisibility}
              // DECK-PREVIEW-BRACKET: what link previews say about the bracket,
              // whenever the Why sheet below can open (One Piece never can).
              bracket={
                bracketRead && bracketCtx && load.adapter.brackets
                  ? {
                      brackets: load.adapter.brackets,
                      targetLevel: goals?.targetLevel ?? null,
                      onDeclare: declareFromShare,
                    }
                  : undefined
              }
              openAt={shareAt}
              finalFocus={sheetFinalFocus}
              onClose={() => setDialog(null)}
            />
          )}
          {/* Y4a: the Why sheet, opened only by the bracket line's "Why?". */}
          {dialog === "bracket" && bracketRead && bracketCtx && load.adapter.brackets && (
            <BracketSheet
              adapter={load.adapter}
              read={bracketRead}
              line={load.adapter.brackets.line(bracketRead, bracketCtx)}
              combos={bracketFacts.combos}
              cards={cards}
              phone={tier === "phone"}
              goals={goals}
              estimate={estimate}
              onGoalsChange={handleGoalsChange}
              openAt={sheetAt}
              onSwapCard={swapMeta ? swapFromCallout : undefined}
              canSwap={canSwapId}
              onFitTarget={fitDoorOpen ? openTargetFit : undefined}
              onUpgradeTarget={swapInOn ? openTargetUp : undefined}
              speed={bracketSpeed}
              // LATER row 306: a private deck's link preview is the generic
              // image; a draft has no row yet and mints unlisted.
              linkPreviews={share?.visibility !== "private"}
              onClose={closeBracket}
            />
          )}
          {/* Y7b: the swap sheets — a card's alternatives, and "Swap in…". */}
          {dialog === "swap" && swapTarget && (
            <SwapSheet
              adapter={load.adapter}
              card={swapTarget.card}
              swap={sheetSwap}
              phone={tier === "phone"}
              finalFocus={sheetFinalFocus}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === "swap-in" && swapInTarget && (
            <SwapInSheet
              adapter={load.adapter}
              format={load.format}
              incoming={swapInTarget.card}
              qty={swapInTarget.qty}
              entries={entries}
              cards={cards}
              combos={bracketFacts.combos}
              factsState={bracketFacts.state}
              phone={tier === "phone"}
              onSwap={handleSwapIn}
              finalFocus={sheetFinalFocus}
              onClose={() => setDialog(null)}
            />
          )}
          {/* BRACKET-FIT: the "Swap to fit" sheet, opened only by the conflict callout's door. */}
          {dialog === "target-fit" && swapMeta && bracketRead && (
            <TargetFitSheet
              adapter={load.adapter}
              format={load.format}
              entries={entries}
              cards={cards}
              goals={goals}
              read={bracketRead}
              combos={bracketFacts.combos}
              freshness={bracketFacts.freshness}
              owned={ownedSetForPricing}
              phone={tier === "phone"}
              finalFocus={sheetFinalFocus}
              onApply={handleTargetFitApply}
              onClose={() => setDialog(null)}
            />
          )}
          {/* BRACKET-UP: the "Upgrade toward" sheet, opened only by Below your target's door. */}
          {dialog === "target-up" && swapInOn && bracketRead && (
            <TargetUpSheet
              adapter={load.adapter}
              format={load.format}
              entries={entries}
              cards={cards}
              goals={goals}
              combos={bracketFacts.combos}
              freshness={bracketFacts.freshness}
              factsState={bracketFacts.state}
              owned={ownedSetForPricing}
              phone={tier === "phone"}
              finalFocus={sheetFinalFocus}
              onApply={handleTargetFitApply}
              onClose={() => setDialog(null)}
            />
          )}
          {/* Y8: the Fit sheet — only for games that declare a swap (One Piece: none). */}
          {dialog === "fit" && swapMeta && estimate && (
            <FitSheet
              adapter={load.adapter}
              format={load.format}
              entries={entries}
              cards={cards}
              goals={goals}
              estimate={estimate}
              owned={ownedSetForPricing}
              combos={bracketFacts.combos}
              factsState={bracketFacts.state}
              phone={tier === "phone"}
              finalFocus={dialogFromMenu ? undefined : sheetFinalFocus}
              onApply={handleFitApply}
              onSaveTotal={handleSaveTotal}
              onClose={() => setDialog(null)}
            />
          )}
          {/* PRECON-CHANGES: the "Changes from <precon>" sheet, opened only by the deck pane's "See changes". */}
          {dialog === "precon-changes" && precon && preconDiff && (
            <PreconChangesSheet
              adapter={load.adapter}
              precon={precon}
              changes={preconDiff}
              cards={cards}
              // The collection's set alone, the ownership line's: the precon's copies are not in the Add list.
              owned={hasCollection ? owned : null}
              phone={tier === "phone"}
              finalFocus={sheetFinalFocus}
              onClose={() => setDialog(null)}
            />
          )}
          {/* FIRST-LIST: the same sheet from a hand-built deck's line, counted from its baseline. */}
          {dialog === "first-list-changes" && firstListDiff && (
            <ChangesSheet
              adapter={load.adapter}
              baseline="first-list"
              title={firstListWords.title}
              lead={firstListWords.lead}
              changes={firstListDiff}
              cards={cards}
              owned={hasCollection ? owned : null}
              phone={tier === "phone"}
              finalFocus={sheetFinalFocus}
              onClose={() => setDialog(null)}
              onReset={handleResetBaseline}
            />
          )}
          {dialog === "shortcuts" && (
            <ShortcutsSheet
              mainZoneLabel={mainZone?.label ?? "the deck"}
              leaderNoun={leaderZone ? load.adapter.display.leaderNoun : undefined}
              maybe={maybeZone !== undefined}
              onClose={() => setDialog(null)}
            />
          )}
        </ModalFinalFocus.Provider>
      }
      search={
        <SearchPane
          ref={searchRef}
          adapter={load.adapter}
          format={load.format}
          inDeckQty={inDeckQty}
          inMaybe={inMaybe}
          onAdd={handleAdd}
          onMaybe={maybeZoneOf(load.format) ? handleMaybeAdd : undefined}
          onPreview={showCard}
          onInspect={inspectCard}
          swapIn={deckFull}
          onSwapIn={(card, qty) => openSwapIn(card, qty, "search")}
        />
      }
      deck={
        <DeckListPane
          adapter={load.adapter}
          format={load.format}
          entries={entries}
          cards={cards}
          issues={issues}
          analytics={analytics}
          onSetQty={handleSetQty}
          onRemove={handleRemove}
          onPreview={inspectCard}
          onSwap={swapMeta ? (card) => openSwap(card, "row") : undefined}
          canSwap={canSwapRow}
          onOpenCuts={load.adapter.recommend?.cuts ? openCuts : undefined}
          onChooseLeader={focusSearch}
          onBrowseLeader={handleBrowseLeader}
          onAddCards={focusSearch}
          onAutofill={load.adapter.recommend?.autofill ? openAutofill : undefined}
          doors={doors}
          onPasteList={openImport}
          onSurprise={surpriseDoor}
          rolling={rolling}
          onShare={offerShare && share ? openShare : undefined}
          bracket={
            bracketCtx && (
              <BracketLine
                adapter={load.adapter}
                read={bracketRead}
                ctx={bracketCtx}
                facts={bracketFacts.state}
                onRetry={bracketFacts.retry}
                onWhy={openBracket}
              />
            )
          }
          extras={tier !== "phone"}
          // U4a: on phones Group and Sort fold into one popover beside View.
          phone={tier === "phone"}
          // U3a: the seed lands in a reserved leader box (the doors above wait the same way).
          seeding={draftSeed !== null && !seedSettled}
          owned={hasCollection ? owned : undefined}
          ownership={ownership}
          precon={precon}
          onAnswerPrecon={handleAnswerPrecon}
          preconChanges={preconDiff}
          onSeePreconChanges={openPreconChanges}
          beyondPrecon={preconBeyond}
          firstList={firstListDiff ? { changes: firstListDiff, words: firstListWords } : null}
          onSeeFirstListChanges={openFirstListChanges}
          beyondLabel={preconDiff ? undefined : firstListWords.mark}
          onAddTokens={tokenZoneOf(load.format) ? handleAddTokens : undefined}
          hiddenTokens={hiddenTokens}
          onHideToken={handleHideToken}
          onShowTokens={handleShowTokens}
          onMoveToDeck={handleMoveToDeck}
          deckFull={deckFull}
        />
      }
      tools={toolsContent}
      sheet={({ point, close }) => (
        <CardDetailPane
          adapter={load.adapter}
          card={preview}
          tagging={tagging}
          printing={printingEditing}
          swap={swapEditing}
          sheet={{ point, close, actions: sheetActions }}
        />
      )}
      sheetTitle={preview?.name ?? null}
      sheetKey={preview?.id ?? null}
      ambient={
        // Last child of the layout on purpose: the credit chip's sticky row sits at the surface's end (R2).
        <AmbientArt
          art={leaderArt}
          swatches={swatches}
          appearance={appearance}
          creditInset={EDITOR_CREDIT_INSET}
        />
      }
    />
  );
}
