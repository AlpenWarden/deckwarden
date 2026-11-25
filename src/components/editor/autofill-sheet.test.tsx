/**
 * The autofill review sheet (W9b, D8): one POST per open with the editor's
 * leaders + keeps, skeleton → groups → rows with evidence and the REQUIRED
 * source credit, live counts over the checkboxes (one row per pick entry —
 * a filler renders once as "Wastes × 11"), notes verbatim, validate issues
 * above the footer, Apply's list semantics (keep checked = on top of the
 * current list; unchecked = leaders + picks REPLACE the rest), reroll and
 * control changes re-POST without ever sending a seed, and the 429
 * sentence with its disabled Retry. The no-leader open fires nothing.
 * X3: with a pinned combo the sheet is "Build around this combo" — the
 * pieces render first as "Combo pieces · N" (always kept, no checkbox),
 * ride every POST's `keep` and every Apply, the commander never among
 * them, and "Keep my N cards" governs only the other cards.
 * AUTOFILL-TARGET: the choice of Your target (the Why sheet's options,
 * starting at the deck's), a pick's request body and its equality with the
 * body a deck at that target sends, the note under the choice, the
 * after-line's cases over mocked facts, what Add hands over, and that
 * nothing but the route's POST and the facts GET is ever asked.
 * AUTOFILL-OWNED: the "Only cards I own" box in each state the editor can
 * hand it (available, unavailable, checking, failed), one more ask per tick
 * with the flag and without the per-card budget, Budget switched off with
 * its reason, the footer's count in the estimate's place, the route's two
 * refusals, and what Add hands over.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardWire, EditorCard, EditorEntry } from "@/lib/decks/editor-state";
import { toEditorCard } from "@/lib/decks/editor-state";
import type { DeckGoals } from "@/lib/decks/goals";
import { COMMANDER } from "@/lib/games/mtg/formats";
import { atraxa, card } from "@/lib/games/mtg/test-fixtures";
import { getAdapter } from "@/lib/games/registry";
import type { CompleteCombo } from "@/lib/games/types";
import {
  AutofillSheet,
  collectionCountLine,
  OWNED_COPY,
  type AutofillApply,
} from "./autofill-sheet";

const mtg = getAdapter("mtg");

const tower: CardWire = {
  ...card({ name: "Command Tower", primaryType: "Land", costValue: null, cheapestUsd: 0.23 }),
  image: "https://cards.scryfall.io/normal/front/0/0/tower.jpg",
};
const wastes: CardWire = {
  ...card({ name: "Wastes", primaryType: "Land", costValue: null, cheapestUsd: 0.1 }),
  image: null,
};
const signet: CardWire = {
  ...card({ name: "Arcane Signet", primaryType: "Artifact", costValue: 2, cheapestUsd: 0.43 }),
  image: null,
};
const leaderWire: CardWire = { ...atraxa, image: null };

/** The W9a response shape, small: 1 locked land + an 11× filler + 1 sampled two-drop. */
const shell = {
  game: "mtg",
  format: "commander",
  seed: 42,
  picks: [
    {
      cardId: tower.id,
      name: "Command Tower",
      zone: "main",
      qty: 1,
      group: "base",
      tier: "locked",
      score: 0.9,
      cheapestUsd: "0.23",
      evidence: [
        {
          source: "topdeck-top16",
          why: "Played in 62% of competitive top-16 lists with Atraxa",
          with: [],
          howOften: "62% of 100 lists",
          confidence: "high",
        },
        {
          source: "edhrec_rank",
          why: "A Commander staple in EDHREC decklists",
          with: [],
          howOften: null,
          confidence: "medium",
        },
      ],
    },
    {
      cardId: wastes.id,
      name: "Wastes",
      zone: "main",
      qty: 11,
      group: "base",
      tier: "filler",
      score: 0,
      cheapestUsd: "0.10",
      evidence: [
        {
          source: "land-template",
          why: "Fills the land template",
          with: [],
          howOften: null,
          confidence: "medium",
        },
      ],
    },
    {
      cardId: signet.id,
      name: "Arcane Signet",
      zone: "main",
      qty: 1,
      group: "curve-2",
      tier: "sampled",
      score: 0.7,
      cheapestUsd: "0.43",
      evidence: [
        {
          source: "edhrec_rank",
          why: "A Commander staple in EDHREC decklists",
          with: [],
          howOften: null,
          confidence: "medium",
        },
      ],
    },
  ],
  groups: [
    { id: "base", label: "Lands", picks: 12 },
    { id: "curve-2", label: "Mana value 2", picks: 1 },
  ],
  notes: ["Filled 13 of 99. Too few candidates in Mana value 5."],
  totals: { picks: 13, estUsd: 1.76, unpriced: 0 },
  issues: [{ code: "DECK_SIZE", severity: "warning", message: "Deck has 14 of 100 cards." }],
  cards: [leaderWire, tower, wastes, signet],
};

const fetchMock = vi.fn();
const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => body,
});

const leaderEntry: EditorEntry = { cardId: atraxa.id, zone: "commander", qty: 1, tags: [] };
const keptEntry: EditorEntry = { cardId: signet.id, zone: "main", qty: 1, tags: ["ramp"] };
/** X3's pinned piece: a combo partner of the commander, already in the deck. */
const piece: CardWire = {
  ...card({ name: "Zealous Conscripts", costValue: 5, cheapestUsd: 0.35 }),
  image: null,
};
const pieceEntry: EditorEntry = { cardId: piece.id, zone: "main", qty: 1, tags: [] };
const cardsMap = new Map<string, EditorCard>([
  [atraxa.id, toEditorCard(leaderWire)],
  [signet.id, toEditorCard({ ...signet })],
  [piece.id, toEditorCard(piece)],
]);
/** The combo, as comboPin builds it: every piece — the commander too — in name order. */
const pinned = {
  label: "Atraxa, Praetors' Voice + Zealous Conscripts",
  pieceIds: [atraxa.id, piece.id],
  templates: [],
};

function sheet(over: Partial<React.ComponentProps<typeof AutofillSheet>> = {}) {
  return (
    <AutofillSheet
      adapter={mtg}
      format={COMMANDER}
      entries={[leaderEntry]}
      cards={cardsMap}
      phone={false}
      onApply={() => {}}
      onClose={() => {}}
      {...over}
    />
  );
}

/** The route's POST bodies as sent: the bytes, for the equality pins. */
const rawBodies = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url) === "/api/decks/autofill")
    .map(([, init]) => (init as RequestInit).body as string);
const bodies = () => rawBodies().map((body) => JSON.parse(body) as Record<string, unknown>);

/** The facts GET's freshness: every feed fresh, as production's nightly keeps them. */
const FRESH = {
  readAt: "2026-11-16T07:00:00.000Z",
  feeds: Object.fromEntries(
    ["gameChangers", "landDenial", "extraTurns", "combos"].map((feed) => [
      feed,
      { state: "ok", asOf: "2026-11-15T15:29:34.768Z" },
    ]),
  ),
};
/** What the mocked routes answer; a test swaps either. */
let shellAnswer: unknown = shell;
let factsCombos: (ids: string[]) => CompleteCombo[] = () => [];
const factsCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/combos/complete?"));
const idsOf = (call: unknown[]) =>
  new URL(String(call[0]), "http://local").searchParams.get("ids")!.split(",");

/** The two routes the sheet asks: the shell's POST and the after-line's facts GET. */
function routes(input: RequestInfo | URL) {
  const url = String(input);
  if (url.startsWith("/api/combos/complete?")) {
    const ids = new URL(url, "http://local").searchParams.get("ids")!.split(",");
    return ok({ combos: factsCombos(ids), freshness: FRESH });
  }
  return ok(shellAnswer);
}

beforeEach(() => {
  shellAnswer = shell;
  factsCombos = () => [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(routes);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AutofillSheet", () => {
  it("no leader → the sentence, and NO POST is spent", () => {
    render(sheet({ entries: [] }));
    expect(screen.getByText(/Set a commander first/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("one POST on open (leaders + keeps, no seed), skeleton first, then groups, rows, notes verbatim, issues and the live Apply count", async () => {
    render(sheet({ entries: [leaderEntry, keptEntry] }));
    // Skeleton while the POST is in flight.
    expect(screen.getByLabelText("Building the shell…")).toBeTruthy();

    expect(await screen.findByText("Lands · 12")).toBeTruthy();
    expect(screen.getByText("Mana value 2 · 1")).toBeTruthy();
    const [body] = bodies();
    expect(body).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [atraxa.id],
      keep: [{ cardId: signet.id, zone: "main", qty: 1 }],
    });
    expect("seed" in body).toBe(false);

    // One row per pick entry: the filler rides its quantity (D8 pin).
    expect(screen.getByRole("link", { name: "Wastes × 11" })).toBeTruthy();
    // Note + issue verbatim; evidence sentence with the REQUIRED source credit.
    expect(screen.getByText("Filled 13 of 99. Too few candidates in Mana value 5.")).toBeTruthy();
    expect(screen.getByText("Deck has 14 of 100 cards.")).toBeTruthy();
    const credit = screen.getByRole("link", { name: "Topdeck.gg" });
    expect(credit.getAttribute("href")).toBe("https://topdeck.gg");
    expect(screen.getByText(/Est\. total \$2/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add 13 cards" })).toBeTruthy();
  });

  it("unchecking rows updates the count; the group checkbox clears its rows; '+1 more' expands the evidence", async () => {
    render(sheet());
    await screen.findByText("Lands · 12");

    fireEvent.click(screen.getByRole("checkbox", { name: "Include Wastes × 11" }));
    expect(screen.getByRole("button", { name: "Add 2 cards" })).toBeTruthy();
    expect(screen.getByText("Lands · 1")).toBeTruthy();

    // Indeterminate group checkbox: first click checks all, the next clears all.
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Lands" }));
    expect(screen.getByRole("button", { name: "Add 13 cards" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Lands" }));
    expect(screen.getByRole("button", { name: "Add 1 card" })).toBeTruthy();

    // Collapsed, the staple sentence shows once (Signet's own top evidence);
    // expanding Command Tower's "+1 more" reveals its second entry too.
    expect(screen.getAllByText(/A Commander staple in EDHREC decklists/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "+1 more" }));
    expect(screen.getAllByText(/A Commander staple in EDHREC decklists/)).toHaveLength(2);
  });

  it("Apply with keep CHECKED hands back the current list plus the checked picks", async () => {
    const onApply = vi.fn();
    render(sheet({ entries: [leaderEntry, keptEntry], onApply }));
    await screen.findByText("Lands · 12");
    fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
    const apply = onApply.mock.calls[0][0] as AutofillApply;
    expect(apply.added).toBe(13);
    expect(apply.entries.slice(0, 2)).toEqual([leaderEntry, keptEntry]);
    expect(apply.entries).toHaveLength(5);
    expect(apply.cards.map((c) => c.name)).toContain("Command Tower");
  });

  it("keep UNCHECKED re-POSTs with keep: [] and Apply REPLACES the non-leader list (pinned)", async () => {
    const onApply = vi.fn();
    render(sheet({ entries: [leaderEntry, keptEntry], onApply }));
    await screen.findByText("Lands · 12");

    fireEvent.click(screen.getByRole("checkbox", { name: "Keep my 1 card" }));
    await screen.findByText("Lands · 12");
    expect(bodies().at(-1)?.keep).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
    const apply = onApply.mock.calls[0][0] as AutofillApply;
    // Leaders + picks only — the kept main-deck card is replaced by the plan.
    expect(apply.entries[0]).toEqual(leaderEntry);
    expect(apply.entries).toHaveLength(4);
  });

  it("tokens are neither kept, counted nor sent, and Apply carries them through either way (DECK-TOKENS)", async () => {
    const tokenEntry: EditorEntry = { cardId: "treasure-token", zone: "tokens", qty: 4, tags: [] };
    const onApply = vi.fn();
    render(sheet({ entries: [leaderEntry, keptEntry, tokenEntry], onApply }));
    await screen.findByText("Lands · 12");
    // "Keep my 1 card": the Signet, not the four Treasures.
    expect(screen.getByRole("checkbox", { name: "Keep my 1 card" })).toBeTruthy();
    expect(bodies()[0].keep).toEqual([{ cardId: signet.id, zone: "main", qty: 1 }]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Keep my 1 card" }));
    await screen.findByText("Lands · 12");
    expect(bodies().at(-1)?.keep).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
    const apply = onApply.mock.calls[0][0] as AutofillApply;
    // The plan replaces the 100's non-leader cards, never the Tokens zone.
    expect(apply.entries.slice(0, 2)).toEqual([leaderEntry, tokenEntry]);
    // W9b's replace (the unchecked test above: leader + 3 picks) plus the tokens, the kept row gone.
    expect(apply.entries).toHaveLength(5);
    expect(apply.entries).not.toContainEqual(keptEntry);
  });

  it("budget chips re-POST with budgetUsd (absent / 5 / 1) and still no seed; Reroll re-POSTs the same body", async () => {
    render(sheet());
    await screen.findByText("Lands · 12");

    fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
    await screen.findByText("Lands · 12");
    let last = bodies().at(-1)!;
    expect(last.budgetUsd).toBe(1);
    expect("seed" in last).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
    await screen.findByText("Lands · 12");
    last = bodies().at(-1)!;
    expect(bodies()).toHaveLength(3);
    expect(last.budgetUsd).toBe(1);
    expect("seed" in last).toBe(false);
  });

  it("a 429 renders its sentence with Retry disabled for the advertised window — never an auto-retry", async () => {
    fetchMock.mockImplementation(() => ({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "7" }),
      json: async () => ({ error: "rate limited" }),
    }));
    render(sheet());
    expect(
      await screen.findByText("Too many autofill requests. Try again in 7 seconds."),
    ).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Retry" });
    // Disabled with a reason (U1): focusable and hoverable, so the title shows.
    expect(retry.getAttribute("aria-disabled")).toBe("true");
    expect(retry.hasAttribute("disabled")).toBe(false);
    expect(retry.getAttribute("title")).toBe(
      "Too many requests. Retry works again after the wait.",
    );
    fireEvent.click(retry);
    expect(bodies()).toHaveLength(1);
  });

  it("a failed POST renders the sentence + an enabled Retry that re-POSTs", async () => {
    fetchMock.mockImplementationOnce(() => ({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({}),
    }));
    render(sheet());
    expect(await screen.findByText(/Couldn't build the shell/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Lands · 12")).toBeTruthy();
    expect(bodies()).toHaveLength(2);
  });

  it("phone renders the full-height Drawer with the same content", async () => {
    render(sheet({ phone: true }));
    expect(await screen.findByText("Lands · 12")).toBeTruthy();
    const popup = document.querySelector("[data-slot=drawer-popup]")!;
    expect(within(popup as HTMLElement).getByText("Autofill a starter shell")).toBeTruthy();
  });

  // ------------------------------------------------------------------- X3
  it("pinned: the combo's title and lead, 'Combo pieces · 1' first — always kept, labeled, no checkbox — and 'Keep my N' counts the other cards only", async () => {
    render(sheet({ entries: [leaderEntry, pieceEntry, keptEntry], pinned }));
    expect(screen.getByRole("dialog", { name: "Build around this combo" })).toBeTruthy();
    expect(
      screen.getByText(
        "Atraxa, Praetors' Voice + Zealous Conscripts. The rest comes from real decklists and tournament results. Every pick shows why.",
      ),
    ).toBeTruthy();
    await screen.findByText("Lands · 12");

    const group = screen.getByRole("region", { name: "Combo pieces" });
    expect(within(group).getByText("Combo pieces · 1")).toBeTruthy(); // the commander is not counted
    expect(within(group).getByText("always kept")).toBeTruthy();
    expect(within(group).getByRole("link", { name: "Zealous Conscripts" })).toBeTruthy();
    expect(within(group).getByText("Combo piece")).toBeTruthy();
    expect(within(group).getByText("$0.35")).toBeTruthy();
    expect(within(group).queryByRole("checkbox")).toBeNull();
    // First in the list, before the server's groups.
    expect(
      group.compareDocumentPosition(screen.getByText("Lands · 12")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // The Signet is the only "other" card; the piece and the commander are not counted.
    expect(screen.getByRole("checkbox", { name: "Keep my 1 card" })).toBeTruthy();
    const [body] = bodies();
    expect(body.leaderIds).toEqual([atraxa.id]);
    expect(body.keep).toEqual([
      { cardId: piece.id, zone: "main", qty: 1 },
      { cardId: signet.id, zone: "main", qty: 1 },
    ]);
  });

  it("pinned: unticking 'Keep my N cards' re-POSTs WITH the pieces (never keep: []), and Apply keeps them — leaders + pieces + picks", async () => {
    const onApply = vi.fn();
    render(sheet({ entries: [leaderEntry, pieceEntry, keptEntry], pinned, onApply }));
    await screen.findByText("Lands · 12");

    fireEvent.click(screen.getByRole("checkbox", { name: "Keep my 1 card" }));
    await screen.findByText("Lands · 12");
    expect(bodies().at(-1)?.keep).toEqual([{ cardId: piece.id, zone: "main", qty: 1 }]);

    fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
    const apply = onApply.mock.calls[0][0] as AutofillApply;
    // The kept Signet (its "ramp" tag) is replaced by the plan — the shell
    // picks its own Signet — while the combo piece never is.
    expect(apply.entries.slice(0, 2)).toEqual([leaderEntry, pieceEntry]);
    expect(apply.entries).not.toContainEqual(keptEntry);
    expect(apply.entries).toHaveLength(5);
  });

  it("pinned with only the pieces in the deck: no 'Keep my N' box, the pieces still ride keep; a template shows as 'Also needs'", async () => {
    render(
      sheet({
        entries: [leaderEntry, pieceEntry],
        pinned: { ...pinned, templates: ["A sacrifice outlet"] },
      }),
    );
    await screen.findByText("Lands · 12");
    expect(screen.queryByRole("checkbox", { name: /Keep my/ })).toBeNull();
    expect(bodies()[0].keep).toEqual([{ cardId: piece.id, zone: "main", qty: 1 }]);
    expect(screen.getByText("Also needs A sacrifice outlet")).toBeTruthy();
  });

  it("pinned on a phone: the Drawer carries the combo title", async () => {
    render(sheet({ entries: [leaderEntry, pieceEntry], pinned, phone: true }));
    expect(await screen.findByText("Lands · 12")).toBeTruthy();
    const popup = document.querySelector("[data-slot=drawer-popup]")!;
    expect(within(popup as HTMLElement).getByText("Build around this combo")).toBeTruthy();
    expect(within(popup as HTMLElement).getByText("Combo pieces · 1")).toBeTruthy();
  });

  it("no pin: the title, lead and keep semantics are W9b's, unchanged", async () => {
    render(sheet({ entries: [leaderEntry, pieceEntry, keptEntry] }));
    expect(screen.getByRole("dialog", { name: "Autofill a starter shell" })).toBeTruthy();
    await screen.findByText("Lands · 12");
    expect(screen.queryByRole("region", { name: "Combo pieces" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Keep my 2 cards" })).toBeTruthy();
    expect(screen.queryByText(/Also needs/)).toBeNull();
  });
});

describe("AutofillSheet — the deck's goals (Y6b)", () => {
  const goalsLine = () => document.querySelector<HTMLElement>("[data-slot=goals-line]");

  it("the goals ride the body as Suggestions' draft POST sends them; the budget starts from the goal", async () => {
    render(
      sheet({
        goals: {
          v: 1,
          targetLevel: 2,
          budget: { perCardUsd: 5 },
          exceptions: "one thematic Game Changer",
        },
      }),
    );
    await screen.findByText("Lands · 12");
    expect(bodies()[0]).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [atraxa.id],
      keep: [],
      budgetUsd: 5,
      // suggestionGoals: the target, the budget, the answers — never the exceptions line.
      goals: { v: 1, targetLevel: 2, budget: { perCardUsd: 5 } },
    });
    expect(screen.getByRole("button", { name: "≤ $5 a card" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    // A pick of the sheet's own wins; the goals still ride.
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await screen.findByText("Lands · 12");
    const last = bodies().at(-1)!;
    expect("budgetUsd" in last).toBe(false);
    expect(last.goals).toEqual({ v: 1, targetLevel: 2, budget: { perCardUsd: 5 } });
    expect("seed" in last).toBe(false);
  });

  it("the goals line reads above the controls — no Change (the Why sheet is another dialog), no Save — and no longer names the target (AUTOFILL-TARGET: the choice does)", async () => {
    render(sheet({ goals: { v: 1, targetLevel: 2, budget: { perCardUsd: 5 } } }));
    await screen.findByText("Lands · 12");
    expect(goalsLine()?.textContent).toBe("Your goals: ≤ $5 a card");
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save as this deck's budget" })).toBeNull();
  });

  it("a target alone leaves no goals line: the choice says it", async () => {
    render(sheet({ goals: { v: 1, targetLevel: 2 } }));
    await screen.findByText("Lands · 12");
    expect(goalsLine()).toBeNull();
  });

  it("Y8: a total reads its running estimate on the line, and never rides the body", async () => {
    render(
      sheet({
        goals: { v: 1, budget: { totalUsd: 150 } },
        estimate: { usd: 212.4, unpriced: 0 },
      }),
    );
    await screen.findByText("Lands · 12");
    expect(goalsLine()?.textContent).toBe("Your goals: est. $212 of your $150");
    expect("goals" in bodies()[0]).toBe(false);
  });

  it("goals with neither a target nor a budget: no line, and nothing in the body changes", async () => {
    render(sheet({ goals: { v: 1, exceptions: "ask me" } }));
    await screen.findByText("Lands · 12");
    expect(goalsLine()).toBeNull();
    expect(bodies()[0]).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [atraxa.id],
      keep: [],
    });
  });

  it("the target's notes render verbatim beside the planner's", async () => {
    fetchMock.mockImplementation(() =>
      ok({
        ...shell,
        notes: [
          ...shell.notes,
          "Skipped 4 Game Changers. Your Bracket 2 target allows none (Wizards' list)",
        ],
      }),
    );
    render(sheet({ goals: { v: 1, targetLevel: 2 } }));
    expect(
      await screen.findByText(
        "Skipped 4 Game Changers. Your Bracket 2 target allows none (Wizards' list)",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Filled 13 of 99. Too few candidates in Mana value 5.")).toBeTruthy();
  });
});

// ------------------------------------------------------------- AUTOFILL-TARGET
describe("AutofillSheet — Your target (AUTOFILL-TARGET)", () => {
  const changer = (name: string): CardWire => ({
    ...card({ name, attrs: { type_line: "Sorcery", oracle_text: "", game_changer: true } }),
    image: null,
  });
  const changers = [1, 2, 3, 4].map((i) => changer(`Changer ${i}`));
  const evidence = [
    {
      source: "edhrec_rank",
      why: "A Commander staple in EDHREC decklists",
      with: [],
      howOften: null,
      confidence: "medium",
    },
  ];
  /**
   * A shell that fills the list to the format's size: `n` Game Changers and
   * Wastes for the rest (`picks` cards in all, 99 beside one commander).
   */
  function fullShell(n: number, picks = 99) {
    const held = changers.slice(0, n);
    return {
      ...shell,
      picks: [
        ...held.map((c) => ({
          cardId: c.id,
          name: c.name,
          zone: "main",
          qty: 1,
          group: "curve-2",
          tier: "sampled",
          score: 0.8,
          cheapestUsd: "1.00",
          evidence,
        })),
        {
          cardId: wastes.id,
          name: "Wastes",
          zone: "main",
          qty: picks - n,
          group: "base",
          tier: "filler",
          score: 0,
          cheapestUsd: "0.10",
          evidence,
        },
      ],
      groups: [
        { id: "base", label: "Lands", picks: picks - n },
        ...(n > 0 ? [{ id: "curve-2", label: "Mana value 2", picks: n }] : []),
      ],
      notes: [],
      totals: { picks, estUsd: 10, unpriced: 0 },
      issues: [],
      cards: [leaderWire, wastes, ...held],
    };
  }

  const dialog = () => screen.getByRole("dialog");
  const choice = () => within(dialog()).getByRole("group", { name: "Your target" });
  const pressed = () =>
    within(choice())
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  const pick = (label: string) =>
    fireEvent.click(within(choice()).getByRole("button", { name: label }));
  const note = () => document.querySelector<HTMLElement>("[data-slot=autofill-target-note]");
  const afterLine = () => document.querySelector<HTMLElement>("[data-slot=autofill-after]");
  const status = () =>
    document.querySelector<HTMLElement>("[data-slot=autofill-after-status]")?.textContent;
  /** The after-line once it reads `kind` (a later id set waits out the facts hook's debounce). */
  async function verdict(kind: string) {
    await waitFor(() => expect(afterLine()?.dataset.after).toBe(kind), { timeout: 3000 });
    return afterLine()!;
  }
  const posts = () => bodies().length;
  async function asked(n: number) {
    await waitFor(() => expect(posts()).toBe(n));
    await screen.findByRole("button", { name: /^Add \d+ cards?$/ });
  }

  describe("the choice", () => {
    it("the Why sheet's own options, in a group named Your target, starting at the deck's target", async () => {
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      await screen.findByText("Lands · 12");
      expect(
        within(choice())
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["1", "2", "3", "4", "5", "Not set"]);
      expect(pressed()).toEqual(["3"]);
      // The visible label names it too.
      expect(within(dialog()).getByText("Your target")).toBeTruthy();
      // The deck's own target is nothing to announce.
      expect(note()).toBeNull();
    });

    it("the sheet opens with focus on the pressed segment, so the first keypress picks nothing", async () => {
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      await screen.findByText("Lands · 12");
      const three = within(choice()).getByRole("button", { name: "3" });
      await waitFor(() => expect(document.activeElement).toBe(three));
      // Pressing the pressed level asks nothing.
      fireEvent.click(three);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(posts()).toBe(1);
    });

    it("no target on the deck: Not set, and no note", async () => {
      render(sheet());
      await screen.findByText("Lands · 12");
      expect(pressed()).toEqual(["Not set"]);
      expect(note()).toBeNull();
    });

    it("a game without brackets: no choice, no after-line, no facts GET, and Add hands no target", async () => {
      const onApply = vi.fn();
      render(
        sheet({
          adapter: { ...mtg, brackets: undefined },
          goals: { v: 1, budget: { perCardUsd: 5 } },
          onApply,
        }),
      );
      await screen.findByText("Lands · 12");
      expect(screen.queryByRole("group", { name: "Your target" })).toBeNull();
      expect(afterLine()).toBeNull();
      expect(factsCalls()).toHaveLength(0);
      expect(bodies()[0].goals).toEqual({ v: 1, budget: { perCardUsd: 5 } });
      fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
      expect("target" in (onApply.mock.calls[0][0] as AutofillApply)).toBe(false);
    });

    it("on a phone the choice sits in the Drawer with the rest", async () => {
      render(sheet({ phone: true }));
      await screen.findByText("Lands · 12");
      const popup = document.querySelector<HTMLElement>("[data-slot=drawer-popup]")!;
      expect(within(popup).getByRole("group", { name: "Your target" })).toBeTruthy();
    });
  });

  describe("the request", () => {
    it("a pick asks ONCE with the picked target and nothing else moved; the same pick again asks nothing; Not set sends today's body", async () => {
      render(sheet({ entries: [leaderEntry, keptEntry] }));
      await asked(1);
      pick("2");
      await asked(2);
      expect(bodies()[1]).toEqual({
        game: "mtg",
        format: "commander",
        leaderIds: [atraxa.id],
        keep: [{ cardId: signet.id, zone: "main", qty: 1 }],
        goals: { v: 1, targetLevel: 2 },
      });
      expect("seed" in bodies()[1]).toBe(false);
      expect(pressed()).toEqual(["2"]);

      pick("2");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(posts()).toBe(2);

      pick("Not set");
      await asked(3);
      expect(rawBodies()[2]).toBe(rawBodies()[0]);
      expect("goals" in bodies()[2]).toBe(false);
    });

    it("bytes: no goals and no pick send today's body; a pick of N sends what a deck whose target is N sends", async () => {
      const today = JSON.stringify({
        game: "mtg",
        format: "commander",
        leaderIds: [atraxa.id],
        keep: [],
      });
      const first = render(sheet());
      await asked(1);
      expect(rawBodies()[0]).toBe(today);
      pick("3");
      await asked(2);
      const picked = rawBodies()[1];
      first.unmount();

      fetchMock.mockClear();
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      await asked(1);
      expect(rawBodies()[0]).toBe(picked);
    });

    it("bytes, with a budget and answers on the deck: the pick lands where a stored target does", async () => {
      const rest: DeckGoals = {
        v: 1,
        budget: { perCardUsd: 5, totalUsd: 150 },
        answers: { rulesetVersion: 1, play: { theme: "no" } },
        exceptions: "ask me",
      };
      const first = render(sheet({ goals: rest }));
      await asked(1);
      pick("2");
      await asked(2);
      const picked = rawBodies()[1];
      expect(JSON.parse(picked).goals).toEqual({
        v: 1,
        targetLevel: 2,
        budget: { perCardUsd: 5 },
        answers: { rulesetVersion: 1, play: { theme: "no" } },
      });
      first.unmount();

      fetchMock.mockClear();
      render(sheet({ goals: { ...rest, targetLevel: 2 } }));
      await asked(1);
      expect(rawBodies()[0]).toBe(picked);
    });

    it("the budget and Reroll keep the pick; neither sends a seed", async () => {
      render(sheet());
      await asked(1);
      pick("4");
      await asked(2);
      fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
      await asked(3);
      fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
      await asked(4);
      for (const body of bodies().slice(2)) {
        expect(body.goals).toEqual({ v: 1, targetLevel: 4 });
        expect(body.budgetUsd).toBe(1);
        expect("seed" in body).toBe(false);
      }
    });

    it("a superseded ask never lands: the first pick's request is aborted when the second is made", async () => {
      render(sheet());
      await asked(1);
      // From here the shell's answers wait on the test, and an aborted ask rejects as fetch does.
      const pending: { signal: AbortSignal; body: Record<string, unknown>; answer: () => void }[] =
        [];
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) !== "/api/decks/autofill") return routes(input);
        return new Promise((resolve, reject) => {
          const signal = init!.signal!;
          const body = JSON.parse(init!.body as string) as Record<string, unknown>;
          signal.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
          pending.push({
            signal,
            body,
            answer: () =>
              resolve(
                ok({
                  ...shell,
                  notes: [`Built for target ${(body.goals as DeckGoals).targetLevel}`],
                }),
              ),
          });
        });
      });
      pick("2");
      await waitFor(() => expect(pending).toHaveLength(1));
      pick("3");
      await waitFor(() => expect(pending).toHaveLength(2));
      expect(pending[0].signal.aborted).toBe(true);
      expect(pending[1].signal.aborted).toBe(false);
      pending[1].answer();
      expect(await screen.findByText("Built for target 3")).toBeTruthy();
      pending[0].answer();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByText("Built for target 2")).toBeNull();
      expect(screen.getByText("Built for target 3")).toBeTruthy();
    });
  });

  describe("the note under the choice", () => {
    it("only when Add would move the deck's target: set, then gone when the pick goes back", async () => {
      render(sheet());
      await asked(1);
      pick("2");
      expect(note()?.textContent).toBe(
        "Adding these cards sets this deck's target to Bracket 2 (Core). A target shows on your share page, in link previews and where the deck is listed.",
      );
      pick("Not set");
      expect(note()).toBeNull();
    });

    it("a deck with a target: changed, cleared, and nothing at its own level", async () => {
      render(sheet({ goals: { v: 1, targetLevel: 2 } }));
      await asked(1);
      pick("3");
      expect(note()?.textContent).toBe(
        "Adding these cards changes this deck's target from Bracket 2 to Bracket 3. A target shows on your share page, in link previews and where the deck is listed.",
      );
      pick("Not set");
      expect(note()?.textContent).toBe("Adding these cards clears this deck's target.");
      pick("2");
      expect(note()).toBeNull();
    });

    it("a private deck: link previews are left out, as the Why sheet's note leaves them", async () => {
      render(sheet({ linkPreviews: false }));
      await asked(1);
      pick("4");
      expect(note()?.textContent).toBe(
        "Adding these cards sets this deck's target to Bracket 4 (Optimized). A target shows on your share page and where the deck is listed.",
      );
    });
  });

  describe("the after-line", () => {
    it("no target: what the cards show, said politely once, from ONE facts GET over the list Add would build", async () => {
      shellAnswer = fullShell(4);
      render(sheet());
      const line = await verdict("open");
      expect(line.textContent).toBe(
        "With these added, the cards show at least Bracket 4 (Optimized).",
      );
      expect(status()).toBe("With these added, the cards show at least Bracket 4 (Optimized).");
      expect(factsCalls()).toHaveLength(1);
      expect(idsOf(factsCalls()[0])).toEqual(
        [atraxa.id, wastes.id, ...changers.map((c) => c.id)].sort(),
      );
      // It sits in the footer, above Add.
      const add = screen.getByRole("button", { name: "Add 99 cards" });
      expect(line.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("reached: the level's words and That's your target.", async () => {
      shellAnswer = fullShell(3);
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      const line = await verdict("reached");
      expect(line.textContent).toBe(
        "With these added, the cards show at least Bracket 3 (Upgraded). That's your target.",
      );
      expect(status()).toBe(line.textContent);
    });

    it("a list nothing flags under a target of 2: nothing goes past it, and it is never said to be shown", async () => {
      shellAnswer = fullShell(0);
      render(sheet({ goals: { v: 1, targetLevel: 2 } }));
      const line = await verdict("within");
      expect(line.textContent).toBe(
        "With these added, nothing in the list goes past Bracket 2 (Core).",
      );
      expect(line.textContent).not.toContain("That's your target.");
    });

    it("short of the target: what the cards show, that Autofill ran out, and the door when the editor has one", async () => {
      shellAnswer = fullShell(3);
      const first = render(sheet({ goals: { v: 1, targetLevel: 4 }, upgradeDoor: true }));
      const line = await verdict("below");
      expect(line.querySelector("p")?.textContent).toBe(
        "With these added, the cards show at least Bracket 3 (Upgraded).",
      );
      expect(line.textContent).not.toContain("That's your target.");
      expect(line.textContent).toContain(
        "Autofill had no more Game Changers to bring in. Once these are in, Why? offers Upgrade toward Bracket 4.",
      );
      // The status says the verdict alone.
      expect(status()).toBe("With these added, the cards show at least Bracket 3 (Upgraded).");
      first.unmount();

      render(sheet({ goals: { v: 1, targetLevel: 4 } }));
      const plain = await verdict("below");
      expect(plain.textContent).toContain("Autofill had no more Game Changers to bring in.");
      expect(plain.textContent).not.toContain("Upgrade toward");
    });

    it("at Bracket 5 the cards never reach it: the floor, and How it plays for the rest", async () => {
      shellAnswer = fullShell(4);
      render(sheet({ goals: { v: 1, targetLevel: 5 } }));
      const line = await verdict("below");
      expect(line.querySelector("p")?.textContent).toBe(
        "With these added, the cards show at least Bracket 4 (Optimized).",
      );
      expect(line.textContent).toContain(
        "Cards can only show a floor. Once these are in, Why? has How it plays, where you can say the deck plays at Bracket 5 (cEDH).",
      );
    });

    it("a pick moves the verdict with the shell: the same list read against the new choice", async () => {
      shellAnswer = fullShell(3);
      render(sheet());
      await verdict("open");
      pick("3");
      await verdict("reached");
      pick("4");
      await verdict("below");
      pick("2");
      const line = await verdict("above");
      expect(line.querySelector("p")?.textContent).toBe(
        "With these added, these put the deck above Bracket 2:",
      );
    });

    it("a kept card above the choice is named in the read's own sentence, and Add stays the player's call", async () => {
      const kept = changer("Kept Changer");
      const keptEntryGc: EditorEntry = { cardId: kept.id, zone: "main", qty: 1, tags: [] };
      shellAnswer = fullShell(0, 98);
      render(
        sheet({
          entries: [leaderEntry, keptEntryGc],
          cards: new Map([...cardsMap, [kept.id, toEditorCard(kept)]]),
          goals: { v: 1, targetLevel: 2 },
        }),
      );
      const line = await verdict("above");
      expect(
        [...line.querySelectorAll<HTMLElement>("[data-after-conflict]")].map((li) => [
          li.dataset.afterConflict,
          li.textContent,
        ]),
      ).toEqual([["game-changers", "1 Game Changer: Kept Changer. Brackets 1 and 2 allow none."]]);
      expect(status()).toBe("With these added, 1 thing puts the deck above Bracket 2.");
      // Add is still the player's to press.
      expect(screen.getByRole("button", { name: "Add 98 cards" })).toHaveProperty(
        "disabled",
        false,
      );
    });

    it("the pinned combo's sheet takes the same choice, and a combo above it is named, not hidden", async () => {
      shellAnswer = fullShell(0, 98);
      factsCombos = (ids) =>
        ids.includes(atraxa.id) && ids.includes(piece.id)
          ? [
              {
                key: "pin-1",
                cardPieces: [atraxa.id, piece.id].sort(),
                templates: [],
                tag: "R",
                relevant: true,
                results: ["Infinite combat damage"],
                popularity: 40,
              },
            ]
          : [];
      render(
        sheet({ entries: [leaderEntry, pieceEntry], pinned, goals: { v: 1, targetLevel: 3 } }),
      );
      expect(screen.getByRole("dialog", { name: "Build around this combo" })).toBeTruthy();
      expect(pressed()).toEqual(["3"]);
      const line = await verdict("above");
      expect(line.querySelector("p")?.textContent).toBe(
        "With these added, these put the deck above Bracket 3:",
      );
      expect(line.querySelector("[data-after-conflict]")?.textContent).toContain(
        "Two-card combo with your commander: Atraxa, Praetors' Voice + Zealous Conscripts.",
      );
      // At a choice the combo fits, it is what shows the level.
      pick("4");
      const fits = await verdict("reached");
      expect(fits.textContent).toBe(
        "With these added, the cards show at least Bracket 4 (Optimized). That's your target.",
      );
    });

    it("answers that say a level past the choice: what they say, and never That's your target.", async () => {
      shellAnswer = fullShell(3);
      render(
        sheet({
          goals: { v: 1, targetLevel: 3, answers: { rulesetVersion: 1, play: { cedh: "yes" } } },
        }),
      );
      const line = await verdict("over");
      expect(line.textContent).toBe(
        "With these added, the cards and your answers say Bracket 5 (cEDH).",
      );
      // At the level the answers say, it is the target.
      pick("5");
      const top = await verdict("reached");
      expect(top.textContent).toBe(
        "With these added, the cards and your answers say Bracket 5 (cEDH). That's your target.",
      );
    });

    it("a call that is the player's (a kept card the read asks about): the deck's own line says it, and no verdict is given", async () => {
      const edge: CardWire = {
        ...card({
          name: "Tectonic Edge",
          primaryType: "Land",
          costValue: null,
          attrs: { type_line: "Land", oracle_text: "", mld: "edge" },
        }),
        image: null,
      };
      shellAnswer = fullShell(3, 98);
      render(
        sheet({
          entries: [leaderEntry, { cardId: edge.id, zone: "main", qty: 1, tags: [] }],
          cards: new Map([...cardsMap, [edge.id, toEditorCard(edge)]]),
          goals: { v: 1, targetLevel: 3 },
        }),
      );
      const line = await verdict("line");
      expect(line.textContent).toBe(
        "With these added, the deck's bracket line says:Your target: Bracket 3 · the cards say 3 or 4, one card is your call",
      );
      expect(line.textContent).not.toContain("That's your target.");
    });

    it("a short list (picks unchecked, or a shortfall): the deck's own line, quoted, and it follows the checks", async () => {
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      const line = await verdict("line");
      expect(line.textContent).toBe(
        "With these added, the deck's bracket line says:Bracket: add 86 more cards",
      );
      expect(status()).toBe(
        "With these added, the deck's bracket line says: Bracket: add 86 more cards",
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Include Wastes × 11" }));
      await waitFor(
        () =>
          expect(afterLine()?.textContent).toBe(
            "With these added, the deck's bracket line says:Bracket: add 97 more cards",
          ),
        { timeout: 3000 },
      );
      // The second id set was asked once more, and only once.
      expect(factsCalls()).toHaveLength(2);
    });

    it("nothing checked: no line, no status, nothing asked", async () => {
      render(sheet());
      await verdict("line");
      fireEvent.click(screen.getByRole("checkbox", { name: "Include Lands" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Include Mana value 2" }));
      expect(screen.getByRole("button", { name: "Add 0 cards" })).toHaveProperty("disabled", true);
      expect(afterLine()).toBeNull();
      expect(status()).toBe("");
    });

    it("checking: said in the line, never in the status, and Add doesn't wait for it", async () => {
      shellAnswer = fullShell(3);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        if (String(input).startsWith("/api/combos/complete?")) await gate;
        return routes(input);
      });
      const onApply = vi.fn();
      render(sheet({ goals: { v: 1, targetLevel: 3 }, onApply }));
      const line = await verdict("checking");
      expect(line.textContent).toBe("Checking the list with these added…");
      expect(status()).toBe("");
      const add = screen.getByRole("button", { name: "Add 99 cards" });
      expect(add).toHaveProperty("disabled", false);
      release();
      await verdict("reached");
      fireEvent.click(add);
      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it("a facts failure is said plainly, with Retry", async () => {
      shellAnswer = fullShell(3);
      let fail = true;
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        if (fail && String(input).startsWith("/api/combos/complete?")) {
          return { ok: false, status: 500, headers: new Headers(), json: async () => ({}) };
        }
        return routes(input);
      });
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      const line = await verdict("failed");
      expect(line.textContent).toBe("Couldn't check combos for the list with these added. Retry");
      expect(status()).toBe("");
      fail = false;
      fireEvent.click(within(line).getByRole("button", { name: "Retry" }));
      await verdict("reached");
    });

    it("a feed that couldn't be checked: the deck's own line says so, and the target is never claimed", async () => {
      shellAnswer = fullShell(3);
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        if (String(input).startsWith("/api/combos/complete?")) {
          return ok({
            combos: [],
            freshness: {
              readAt: "2026-11-30T00:00:00.000Z",
              feeds: Object.fromEntries(
                Object.keys(FRESH.feeds).map((feed) => [
                  feed,
                  { state: "stale", asOf: "2026-11-15T15:29:34.768Z" },
                ]),
              ),
            },
          });
        }
        return routes(input);
      });
      render(sheet({ goals: { v: 1, targetLevel: 3 } }));
      const line = await verdict("line");
      expect(line.textContent).toBe(
        "With these added, the deck's bracket line says:Your target: Bracket 3 · the cards say at least 3. Couldn't check Game Changers, mass land denial, extra turns and combos",
      );
      expect(line.textContent).not.toContain("That's your target.");
    });
  });

  describe("the layout", () => {
    const picks = () => document.querySelector<HTMLElement>("[data-slot=autofill-picks]")!;
    const footer = () => document.querySelector<HTMLElement>("[data-slot=autofill-footer]")!;

    it("from md the picks scroll inside the Modal and never shrink under 10 rem; the footer stays in flow", async () => {
      render(sheet());
      await screen.findByText("Lands · 12");
      expect(picks().className).toContain("overflow-y-auto");
      expect(picks().className).toContain("min-h-40");
      expect(footer().className).not.toContain("sticky");
      // The after-line and Add share the footer.
      expect(within(footer()).getByRole("button", { name: "Add 13 cards" })).toBeTruthy();
      expect(footer().querySelector("[data-slot=autofill-after]")).toBeTruthy();
    });

    it("on a phone the sheet scrolls as one: the picks keep their height, and the footer is pinned on the Drawer's surface", async () => {
      render(sheet({ phone: true }));
      await screen.findByText("Lands · 12");
      expect(picks().className).not.toContain("overflow-y-auto");
      expect(footer().className).toContain("sticky");
      expect(footer().className).toContain("bottom-0");
      expect(footer().className).toContain("bg-popover");
      // The footer is the scroller's last child, so nothing scrolls under Add but the list.
      expect(footer().parentElement!.className).toContain("overflow-y-auto");
      expect(footer().parentElement!.lastElementChild).toBe(footer());
      expect(within(footer()).getByRole("button", { name: "Add 13 cards" })).toBeTruthy();
    });
  });

  describe("Add and Cancel", () => {
    it("Add hands the pick over with the list it read: the picked level, or null for Not set", async () => {
      shellAnswer = fullShell(3);
      const onApply = vi.fn();
      const first = render(sheet({ onApply }));
      await verdict("open");
      pick("3");
      await verdict("reached");
      fireEvent.click(screen.getByRole("button", { name: "Add 99 cards" }));
      const apply = onApply.mock.calls[0][0] as AutofillApply;
      expect(apply.target).toBe(3);
      expect(apply.added).toBe(99);
      // The list the after-line read: the leader and every checked pick.
      expect(apply.entries.map((e) => e.cardId).sort()).toEqual(idsOf(factsCalls().at(-1)!).sort());
      first.unmount();

      onApply.mockClear();
      render(sheet({ goals: { v: 1, targetLevel: 2 }, onApply }));
      await verdict("above");
      pick("Not set");
      await verdict("open");
      fireEvent.click(screen.getByRole("button", { name: "Add 99 cards" }));
      expect((onApply.mock.calls[0][0] as AutofillApply).target).toBeNull();
    });

    it("opening, picking, rerolling and Cancel write nothing: only the shell's POST and the facts GET are ever asked, and nothing is handed over", async () => {
      shellAnswer = fullShell(3);
      const onApply = vi.fn();
      const onClose = vi.fn();
      render(sheet({ onApply, onClose }));
      await verdict("open");
      pick("3");
      await verdict("reached");
      fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
      await asked(3);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onApply).not.toHaveBeenCalled();
      const asks = fetchMock.mock.calls.map(([url, init]) => [
        (init as RequestInit | undefined)?.method ?? "GET",
        String(url).split("?")[0],
      ]);
      expect(new Set(asks.map((a) => a.join(" ")))).toEqual(
        new Set(["POST /api/decks/autofill", "GET /api/combos/complete"]),
      );
    });
  });
});

describe("AutofillSheet — only cards I own (AUTOFILL-OWNED)", () => {
  const BASICS_NOTE = "Basic lands are added as needed and aren't checked against your collection.";
  const SHORT_NOTE =
    "Filled 13 of 99. Your collection ran out of cards that fit, leaving 86 slots open in Mana value 5.";
  /** What the route answers an owned ask: the same picks, its notes, and that the filter applied. */
  const ownedShell = { ...shell, notes: [BASICS_NOTE, SHORT_NOTE], owned: { applied: true } };
  /** A status the route answers an owned ask with instead of a list; null = the list. */
  let refuse: 401 | 409 | null = null;
  function ownedRoutes(input: RequestInfo | URL, init?: RequestInit) {
    if (String(input) === "/api/decks/autofill") {
      const body = JSON.parse(init!.body as string) as { ownedOnly?: boolean };
      if (body.ownedOnly && refuse !== null) {
        return {
          ok: false,
          status: refuse,
          headers: new Headers(),
          json: async () => ({ error: "refused" }),
        };
      }
      return ok(body.ownedOnly ? ownedShell : shell);
    }
    return routes(input);
  }

  const box = () => screen.getByRole("checkbox", { name: "Only cards I own" }) as HTMLButtonElement;
  const ticked = () => box().getAttribute("aria-checked") === "true";
  const ownedNote = () => document.querySelector<HTMLElement>("[data-slot=autofill-owned-note]");
  const budget = () => screen.getByRole("group", { name: "Budget" });
  const budgetItems = () => within(budget()).getAllByRole("button") as HTMLButtonElement[];
  const footer = () => document.querySelector<HTMLElement>("[data-slot=autofill-footer]")!;
  async function asked(n: number) {
    await waitFor(() => expect(bodies()).toHaveLength(n));
    await screen.findByText("Lands · 12");
  }
  /** Long enough for an effect that would ask again to have asked. */
  const idle = () => new Promise((resolve) => setTimeout(resolve, 60));

  beforeEach(() => {
    refuse = null;
    fetchMock.mockImplementation(ownedRoutes);
  });

  it("ticking the box asks ONCE more, with the flag and nothing else moved; the opening ask carries none; unticking sends the opening body again, byte for byte", async () => {
    render(sheet({ entries: [leaderEntry, keptEntry], collection: "available" }));
    await asked(1);
    expect("ownedOnly" in bodies()[0]).toBe(false);
    expect(box().disabled).toBe(false);
    expect(ticked()).toBe(false);
    // Nothing explains a box that can be ticked.
    expect(ownedNote()).toBeNull();

    fireEvent.click(box());
    await asked(2);
    expect(ticked()).toBe(true);
    expect(bodies()[1]).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [atraxa.id],
      keep: [{ cardId: signet.id, zone: "main", qty: 1 }],
      ownedOnly: true,
    });
    expect("seed" in bodies()[1]).toBe(false);
    await idle();
    expect(bodies()).toHaveLength(2);

    fireEvent.click(box());
    await asked(3);
    expect(rawBodies()[2]).toBe(rawBodies()[0]);
  });

  it("ticked, Budget is switched off and says why: the body carries no budgetUsd, the pick stays in view and comes back with the untick", async () => {
    render(sheet({ collection: "available" }));
    await asked(1);
    fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
    await asked(2);
    expect(bodies()[1].budgetUsd).toBe(1);

    fireEvent.click(box());
    await asked(3);
    expect("budgetUsd" in bodies()[2]).toBe(false);
    expect(bodies()[2].ownedOnly).toBe(true);
    // Off: every item disabled, the pick still pressed.
    expect(budgetItems().map((b) => b.disabled)).toEqual([true, true, true]);
    expect(screen.getByRole("button", { name: "≤ $1 a card" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    // The line under the controls says why, and both controls point at it.
    expect(ownedNote()?.textContent).toBe(
      "Budget is off. Price limits don't apply to cards you own.",
    );
    expect(ownedNote()?.textContent).toBe(OWNED_COPY.budgetOff);
    expect(budget().getAttribute("aria-describedby")).toBe(ownedNote()!.id);
    expect(box().getAttribute("aria-describedby")).toContain(ownedNote()!.id);
    // A press on the switched-off Budget asks nothing.
    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    await idle();
    expect(bodies()).toHaveLength(3);

    fireEvent.click(box());
    await asked(4);
    expect(bodies()[3].budgetUsd).toBe(1);
    expect("ownedOnly" in bodies()[3]).toBe(false);
    expect(budgetItems().map((b) => b.disabled)).toEqual([false, false, false]);
    expect(budget().hasAttribute("aria-describedby")).toBe(false);
    expect(ownedNote()).toBeNull();
  });

  it("a deck whose goal is a per-card budget: ticked, the goals still ride and the budget does not", async () => {
    const goals: DeckGoals = { v: 1, targetLevel: 3, budget: { perCardUsd: 5 } };
    render(sheet({ goals, collection: "available" }));
    await asked(1);
    expect(bodies()[0].budgetUsd).toBe(5);
    fireEvent.click(box());
    await asked(2);
    expect(bodies()[1]).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [atraxa.id],
      keep: [],
      goals: bodies()[0].goals,
      ownedOnly: true,
    });
  });

  it("a target pick and Reroll keep the tick: each asks once, still with the flag", async () => {
    render(sheet({ collection: "available" }));
    await asked(1);
    fireEvent.click(box());
    await asked(2);
    fireEvent.click(
      within(screen.getByRole("group", { name: "Your target" })).getByRole("button", { name: "2" }),
    );
    await asked(3);
    fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
    await asked(4);
    expect(bodies().map((b) => b.ownedOnly)).toEqual([undefined, true, true, true]);
    expect(ticked()).toBe(true);
  });

  it("the route's notes read verbatim, the footer counts the picks from the collection in the estimate's place and follows the checks, and Add adds exactly the cards shown", async () => {
    const onApply = vi.fn();
    render(sheet({ collection: "available", onApply }));
    await asked(1);
    expect(within(footer()).getByText(/Est\. total \$2/)).toBeTruthy();

    fireEvent.click(box());
    await asked(2);
    expect(screen.getByText(BASICS_NOTE)).toBeTruthy();
    expect(screen.getByText(SHORT_NOTE)).toBeTruthy();
    // Command Tower and Arcane Signet came from the collection; the eleven Wastes are the fillers.
    expect(
      within(footer()).getByText("2 of these 13 cards are from your collection."),
    ).toBeTruthy();
    expect(within(footer()).queryByText(/Est\. total|unpriced|No price data/)).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Include Wastes × 11" }));
    expect(within(footer()).getByText("2 of these 2 cards are from your collection.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Arcane Signet" }));
    expect(within(footer()).getByText("This card is from your collection.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Command Tower" }));
    expect(within(footer()).queryByText(/from your collection/)).toBeNull();
    for (const name of ["Include Lands", "Include Arcane Signet"]) {
      fireEvent.click(screen.getByRole("checkbox", { name }));
    }

    // Add: the commander and the thirteen picks on screen, and nothing else.
    fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
    const apply = onApply.mock.calls[0][0] as AutofillApply;
    expect(apply.added).toBe(13);
    expect(apply.entries).toEqual([
      leaderEntry,
      { cardId: tower.id, zone: "main", qty: 1, tags: [] },
      { cardId: wastes.id, zone: "main", qty: 11, tags: [] },
      { cardId: signet.id, zone: "main", qty: 1, tags: [] },
    ]);
    // The picks from the collection, for the editor's owned marks: never the fillers.
    expect(apply.owned).toEqual([tower.id, signet.id]);
    // Still nothing asked but the shell and the after-line's facts.
    const asks = fetchMock.mock.calls.map(([url, init]) => [
      (init as RequestInit | undefined)?.method ?? "GET",
      String(url).split("?")[0],
    ]);
    expect(new Set(asks.map((a) => a.join(" ")))).toEqual(
      new Set(["POST /api/decks/autofill", "GET /api/combos/complete"]),
    );
  });

  it("the footer follows the route's word, not the box: an unticked list keeps its estimate, and its Add hands over no owned cards", async () => {
    const onApply = vi.fn();
    render(sheet({ collection: "available", onApply }));
    await asked(1);
    expect(within(footer()).getByText(/Est\. total \$2/)).toBeTruthy();
    expect(within(footer()).queryByText(/from your collection/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add 13 cards" }));
    expect("owned" in (onApply.mock.calls[0][0] as AutofillApply)).toBe(false);
  });

  it("a guest, or an account with no collection (what the editor says when it says nothing): disabled, with Suggestions' hint and its Account link, and Autofill is as it was", async () => {
    for (const props of [{}, { collection: "unavailable" as const }]) {
      const view = render(sheet(props));
      await asked(1);
      expect(box().disabled).toBe(true);
      expect(ticked()).toBe(false);
      expect(ownedNote()?.textContent).toBe(
        "Sign in and import a collection on your Account page to filter by cards you own",
      );
      expect(
        within(ownedNote()!)
          .getByRole("link", { name: "import a collection" })
          .getAttribute("href"),
      ).toBe("/account");
      expect(box().getAttribute("aria-describedby")).toContain(ownedNote()!.id);
      // It cannot be ticked, so nothing more is asked, and Budget is its own control still.
      fireEvent.click(box());
      await idle();
      expect(bodies()).toHaveLength(1);
      expect(bodies()[0]).toEqual({
        game: "mtg",
        format: "commander",
        leaderIds: [atraxa.id],
        keep: [],
      });
      expect(budgetItems().map((b) => b.disabled)).toEqual([false, false, false]);
      view.unmount();
      fetchMock.mockClear();
    }
  });

  it("while the editor is still checking: disabled with no line; a failed check says so; an answer enables the box and asks nothing", async () => {
    const view = render(sheet({ collection: "checking" }));
    await asked(1);
    expect(box().disabled).toBe(true);
    expect(ownedNote()).toBeNull();
    expect(box().hasAttribute("aria-describedby")).toBe(false);

    view.rerender(sheet({ collection: "failed" }));
    expect(box().disabled).toBe(true);
    expect(ownedNote()?.textContent).toBe("Couldn't check your collection.");

    view.rerender(sheet({ collection: "available" }));
    expect(box().disabled).toBe(false);
    expect(ownedNote()).toBeNull();
    await idle();
    expect(bodies()).toHaveLength(1);
  });

  it("the flag is sent only while the editor says there is a collection: if that stops being true under a ticked box, the next ask carries none", async () => {
    const view = render(sheet({ collection: "available" }));
    await asked(1);
    fireEvent.click(box());
    await asked(2);
    expect(bodies()[1].ownedOnly).toBe(true);

    // The editor's answer changes (a restore re-read the deck: the collection is gone).
    view.rerender(sheet({ collection: "unavailable" }));
    await asked(3);
    expect("ownedOnly" in bodies()[2]).toBe(false);
    expect(rawBodies()[2]).toBe(rawBodies()[0]);
    expect(box().disabled).toBe(true);
    expect(ticked()).toBe(false);
    // The list on screen is the full one again, with its estimate, and Budget is back.
    expect(within(footer()).getByText(/Est\. total \$2/)).toBeTruthy();
    expect(budgetItems().map((b) => b.disabled)).toEqual([false, false, false]);
    expect(ownedNote()?.textContent).toBe(
      "Sign in and import a collection on your Account page to filter by cards you own",
    );
  });

  it("a 401 while the sheet is open: its sentence and no list, the box still ticked, and nothing asked again until Retry", async () => {
    refuse = 401;
    render(sheet({ collection: "available" }));
    await asked(1);
    fireEvent.click(box());
    expect(
      await screen.findByText(
        "Sign in to build from your collection, or untick “Only cards I own” for the full list.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Lands · 12")).toBeNull();
    await idle();
    // The opening ask and the refused one: no retry by itself, and no unfiltered ask in its place.
    expect(bodies()).toHaveLength(2);
    expect(ticked()).toBe(true);

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry.getAttribute("aria-disabled")).not.toBe("true");
    expect(retry.hasAttribute("title")).toBe(false);
    fireEvent.click(retry);
    await waitFor(() => expect(bodies()).toHaveLength(3));
    expect(bodies()[2].ownedOnly).toBe(true);
    await idle();
    expect(bodies()).toHaveLength(3);
  });

  it("a 409 while the sheet is open: its sentence, nothing asked again by itself, and unticking brings the full list back", async () => {
    refuse = 409;
    render(sheet({ collection: "available" }));
    await asked(1);
    fireEvent.click(box());
    expect(
      await screen.findByText(
        "No collection found on this account. Untick “Only cards I own” for the full list.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Lands · 12")).toBeNull();
    await idle();
    expect(bodies()).toHaveLength(2);
    expect(ticked()).toBe(true);

    fireEvent.click(box());
    await asked(3);
    expect("ownedOnly" in bodies()[2]).toBe(false);
    expect(within(footer()).getByText(/Est\. total \$2/)).toBeTruthy();
  });

  it("on a phone the box sits in the Drawer's controls, with the touch target the other checkboxes have", async () => {
    render(sheet({ phone: true, collection: "available" }));
    await asked(1);
    const popup = document.querySelector<HTMLElement>("[data-slot=drawer-popup]")!;
    const inDrawer = within(popup).getByRole("checkbox", { name: "Only cards I own" });
    expect(inDrawer.closest("[data-slot=autofill-controls]")).toBeTruthy();
    // The Checkbox's own 44 px hit area on a coarse pointer (16 px box, 14 px each side).
    expect(inDrawer.className).toContain("pointer-coarse:after:-inset-3.5");
  });

  it("the sheet's own sentences: the count's three forms, and U9's marks", () => {
    expect(collectionCountLine(70, 91)).toBe("70 of these 91 cards are from your collection.");
    expect(collectionCountLine(0, 37)).toBe("0 of these 37 cards are from your collection.");
    expect(collectionCountLine(1, 1)).toBe("This card is from your collection.");
    expect(collectionCountLine(0, 1)).toBe("This card isn't from your collection.");
    const every = [
      ...Object.values(OWNED_COPY),
      collectionCountLine(70, 91),
      collectionCountLine(1, 1),
      collectionCountLine(0, 1),
    ];
    expect(every.filter((s) => /[—–·]/.test(s))).toEqual([]);
    expect(every.filter((s) => !s.endsWith("."))).toEqual([]);
  });
});
