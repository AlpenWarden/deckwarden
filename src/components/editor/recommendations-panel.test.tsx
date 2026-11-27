/**
 * The Suggestions panel's fetch policy (P3.2), with Y2b's draft branch
 * (WAVE4 D2): a draft — no deck row — asks POST /api/recommendations with
 * its snapshot, under the same gate as a saved deck's GET (the tab open, a
 * leader in the zone, autosave at rest) and the same key, so an unchanged
 * draft never asks twice; once a row exists the GET takes over and the
 * snapshot route is never called again. The panel itself never creates a
 * deck — that is the editor's (deck-editor.test.tsx pins its zero-POST
 * seeds).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { card } from "@/lib/games/mtg/test-fixtures";
import { mtgAdapter } from "@/lib/games/mtg/adapter";
import type { Recommendation } from "@/lib/recommend/types";

import { RecommendationsPanel } from "./recommendations-panel";

const format = mtgAdapter.formats[0];
const leader = card({ name: "Tymna the Weaver", isLeaderCandidate: true, ciMask: 1 | 4 });
const sol = card({ name: "Sol Ring", primaryType: "Artifact", costValue: 1 });

const rec: Recommendation = {
  cardId: "55555555-5555-4555-8555-555555555555",
  name: "Arcane Signet",
  primaryType: "Artifact",
  costValue: 2,
  ciMask: 0,
  cheapestUsd: "0.40",
  popularity: 2,
  score: 0.9,
  confidence: "high",
  evidence: [
    {
      source: "edhrec_rank",
      why: "A Commander staple in EDHREC decklists",
      with: [],
      howOften: "EDHREC rank #2",
      confidence: "high",
    },
  ],
};

const fetchMock = vi.fn();
const snapshotCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/recommendations");
const deckGets = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/decks/"));

type Props = Parameters<typeof RecommendationsPanel>[0];
const baseEntries: Props["entries"] = [
  { cardId: leader.id, zone: "commander", qty: 1 },
  { cardId: sol.id, zone: "main", qty: 1 },
];

function props(over: Partial<Props> = {}): Props {
  return {
    adapter: mtgAdapter,
    format,
    deckId: null,
    entries: baseEntries,
    inDeckQty: new Map(),
    saveStatus: "saved",
    active: true,
    onAdd: () => undefined,
    ...over,
  };
}

/** Let the effect's fetch and its JSON settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ count: 1, recommendations: [rec] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RecommendationsPanel — a draft (Y2b)", () => {
  it("asks POST /api/recommendations with the snapshot — the leader apart, copies kept, no budget — and renders the evidence; never a deck GET", async () => {
    render(<RecommendationsPanel {...props()} />);
    await flush();
    expect(snapshotCalls()).toHaveLength(1);
    const [, init] = snapshotCalls()[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [leader.id],
      entries: [{ cardId: sol.id, qty: 1 }],
    });
    expect(deckGets()).toHaveLength(0);
    expect(await screen.findByText("Arcane Signet")).toBeTruthy();
    expect(screen.getByText("A Commander staple in EDHREC decklists")).toBeTruthy();
  });

  it("only while its tab is open: closed asks nothing; opening asks once; closing and reopening an unchanged draft never asks again", async () => {
    const view = render(<RecommendationsPanel {...props({ active: false })} />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();

    view.rerender(<RecommendationsPanel {...props({ active: true })} />);
    await flush();
    expect(snapshotCalls()).toHaveLength(1);

    view.rerender(<RecommendationsPanel {...props({ active: false })} />);
    view.rerender(<RecommendationsPanel {...props({ active: true })} />);
    await flush();
    expect(snapshotCalls()).toHaveLength(1);
  });

  it("the same snapshot in a new array (a tag or printing edit) never asks again; a budget pick does, in USD", async () => {
    const view = render(<RecommendationsPanel {...props()} />);
    await flush();
    const tagged = baseEntries.map((e) => ({ ...e, tags: ["ramp"] }));
    view.rerender(<RecommendationsPanel {...props({ entries: tagged })} />);
    await flush();
    expect(snapshotCalls()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    await flush();
    expect(snapshotCalls()).toHaveLength(2);
    const [, init] = snapshotCalls()[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string).budget).toBe(5);
  });

  it("no leader, nothing asked — the panel says what it needs", async () => {
    render(<RecommendationsPanel {...props({ entries: [baseEntries[1]] })} />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Add a Commander to get suggestions/)).toBeTruthy();
  });

  it("a pending first edit waits: nothing is asked until autosave is at rest", async () => {
    const view = render(<RecommendationsPanel {...props({ saveStatus: "dirty" })} />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Suggestions appear once the deck saves.")).toBeTruthy();
    view.rerender(<RecommendationsPanel {...props({ saveStatus: "saving" })} />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("once the row exists the GET takes over: minting the same snapshot asks nothing; the next settled edit GETs the deck, never the snapshot route", async () => {
    const view = render(<RecommendationsPanel {...props()} />);
    await flush();
    expect(snapshotCalls()).toHaveLength(1);

    // The first edit mints the row: dirty → saving → saved with a deck id.
    view.rerender(<RecommendationsPanel {...props({ saveStatus: "dirty" })} />);
    view.rerender(<RecommendationsPanel {...props({ deckId: "deck-1", saveStatus: "saving" })} />);
    view.rerender(<RecommendationsPanel {...props({ deckId: "deck-1" })} />);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const grown = [...baseEntries, { cardId: rec.cardId, zone: "main", qty: 1 }];
    view.rerender(<RecommendationsPanel {...props({ deckId: "deck-1", entries: grown })} />);
    await flush();
    expect(snapshotCalls()).toHaveLength(1);
    expect(deckGets().map(([url]) => String(url))).toEqual(["/api/decks/deck-1/recommendations"]);
  });

  it("a 429 says so in words, with a retry", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    render(<RecommendationsPanel {...props()} />);
    await flush();
    expect(
      screen.getByText("Suggestions are rate-limited for a moment. Try again shortly."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

// --- A saved deck (P3.2): what Y6a must keep while it grows the panel --------------

const combo: Recommendation = {
  cardId: "66666666-6666-4666-8666-666666666666",
  name: "Rings of Brighthearth",
  primaryType: "Artifact",
  costValue: 3,
  ciMask: 0,
  cheapestUsd: null,
  popularity: 900,
  score: 0.6,
  confidence: "high",
  evidence: [
    {
      source: "curve-template",
      why: "Fills a gap at mana value 3",
      with: [],
      howOften: null,
      confidence: "low",
    },
    {
      source: "spellbook",
      why: "Completes a combo with Basalt Monolith: infinite colorless mana",
      with: [{ cardId: sol.id, name: "Basalt Monolith" }],
      howOften: "In 4,210 EDHREC decks",
      confidence: "high",
    },
  ],
};

/** A resolve answer whose match is the shown card (the hook's id guard passes). */
const resolveWire = (r: Recommendation, id = r.cardId) => ({
  results: [
    {
      input: r.name,
      match: { ...card({ name: r.name, primaryType: r.primaryType }), id, image: null },
    },
  ],
});

describe("RecommendationsPanel — a saved deck (P3.2)", () => {
  const saved = (over: Partial<Props> = {}) => props({ deckId: "deck-1", ...over });

  beforeEach(() => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url) === "/api/cards/resolve") {
        return { ok: true, status: 200, json: async () => resolveWire(rec) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          deckId: "deck-1",
          count: 2,
          owned: { requested: false, applied: false },
          recommendations: [rec, combo],
        }),
      };
    });
  });

  it("GETs the deck once per settled key: a tag edit never asks again; the budget and Refresh do — the budget in USD; never the snapshot route", async () => {
    const view = render(<RecommendationsPanel {...saved()} />);
    await flush();
    expect(deckGets().map(([url]) => String(url))).toEqual(["/api/decks/deck-1/recommendations"]);

    const tagged = baseEntries.map((e) => ({ ...e, tags: ["ramp"] }));
    view.rerender(<RecommendationsPanel {...saved({ entries: tagged })} />);
    await flush();
    expect(deckGets()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
    await flush();
    expect(String(deckGets()[1][0])).toBe("/api/decks/deck-1/recommendations?budget=1");

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await flush();
    expect(deckGets()).toHaveLength(3);
    expect(snapshotCalls()).toHaveLength(0);
  });

  it("each row leads with its strongest evidence, names its sources and price; expanding shows every entry — the partners linked, how often, each confidence as reported", async () => {
    render(<RecommendationsPanel {...saved()} />);
    await flush();
    // The collapsed row: the high-confidence combo line leads, not the low curve one.
    expect(
      screen.getAllByText("Completes a combo with Basalt Monolith: infinite colorless mana"),
    ).toHaveLength(1);
    // Source names follow the same order (strongest first).
    expect(screen.getByText("Commander Spellbook, Curve template")).toBeTruthy();
    expect(screen.getByText("EDHREC · $0.40")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand evidence for Rings of Brighthearth" }),
    );
    expect(screen.getByText("Fills a gap at mana value 3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Basalt Monolith" }).getAttribute("href")).toBe(
      `/cards/${sol.id}`,
    );
    expect(screen.getByText("In 4,210 EDHREC decks")).toBeTruthy();
    expect(screen.getAllByText("low").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Collapse evidence for Rings of Brighthearth" }),
    ).toBeTruthy();
  });

  it("Add resolves the shown card (the id guard) and hands it to the editor's add — once; a card already in the deck reads In deck", async () => {
    const onAdd = vi.fn<Props["onAdd"]>(() => undefined);
    const view = render(<RecommendationsPanel {...saved({ onAdd })} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Add Arcane Signet to the deck" }));
    await flush();
    const resolves = fetchMock.mock.calls.filter(([url]) => url === "/api/cards/resolve");
    expect(resolves).toHaveLength(1);
    expect(JSON.parse((resolves[0][1] as RequestInit).body as string)).toEqual({
      game: "mtg",
      format: "commander",
      names: ["Arcane Signet"],
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ id: rec.cardId, name: "Arcane Signet" });

    view.rerender(
      <RecommendationsPanel {...saved({ onAdd, inDeckQty: new Map([[rec.cardId, 1]]) })} />,
    );
    expect(screen.getByText("In deck ✓")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Arcane Signet to the deck" })).toBeNull();
  });

  it("MAYBE-LIST: Maybe ends the sources line and parks the resolved card through the editor's onMaybe; a parked card reads In Maybe and keeps its Add", async () => {
    const onAdd = vi.fn<Props["onAdd"]>(() => undefined);
    const onMaybe = vi.fn<NonNullable<Props["onMaybe"]>>(() => undefined);
    const view = render(<RecommendationsPanel {...saved({ onAdd, onMaybe })} />);
    await flush();
    const button = screen.getByRole("button", { name: "Add Arcane Signet to Maybe" });
    expect(button.textContent).toBe("Maybe");
    // On the sources line, beside "EDHREC · $0.40" — never on the name's line.
    expect(button.parentElement?.textContent).toBe("EDHREC · $0.40Maybe");
    fireEvent.click(button);
    await flush();
    expect(onMaybe).toHaveBeenCalledTimes(1);
    expect(onMaybe.mock.calls[0][0]).toMatchObject({ id: rec.cardId, name: "Arcane Signet" });
    expect(onAdd).not.toHaveBeenCalled();
    // A second press of either action resolves nothing again (the shared cache).
    fireEvent.click(screen.getByRole("button", { name: "Add Arcane Signet to the deck" }));
    await flush();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/cards/resolve")).toHaveLength(1);

    view.rerender(
      <RecommendationsPanel {...saved({ onAdd, onMaybe, inMaybe: new Set([rec.cardId]) })} />,
    );
    expect(screen.getByText("In Maybe")).toBeTruthy();
    // The line keeps the button's 44 px on touch: nothing moves under the finger.
    expect(screen.getByText("In Maybe").className).toContain("pointer-coarse:min-h-11");
    expect(screen.queryByRole("button", { name: "Add Arcane Signet to Maybe" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Arcane Signet to the deck" })).toBeTruthy();
    // A card the deck holds offers neither.
    view.rerender(
      <RecommendationsPanel
        {...saved({ onAdd, onMaybe, inDeckQty: new Map([[rec.cardId, 1]]) })}
      />,
    );
    expect(screen.getByText("In deck ✓")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Arcane Signet to Maybe" })).toBeNull();
    expect(screen.queryByText("In Maybe")).toBeNull();
  });

  it("MAYBE-LIST: at the deck's maximum the row offers Swap in… and Maybe (the owner's decision 1); without onMaybe (One Piece) no row has a Maybe", async () => {
    const onMaybe = vi.fn<NonNullable<Props["onMaybe"]>>(() => undefined);
    const view = render(<RecommendationsPanel {...saved({ onMaybe, swapIn: true })} />);
    await flush();
    expect(screen.getByRole("button", { name: "Swap in Arcane Signet…" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Arcane Signet to Maybe" })).toBeTruthy();
    view.rerender(<RecommendationsPanel {...saved({ swapIn: true })} />);
    expect(screen.queryByRole("button", { name: /to Maybe$/ })).toBeNull();
  });

  it("MAYBE-LIST: a Maybe the editor refuses says why on the panel's line", async () => {
    const onMaybe = vi.fn<NonNullable<Props["onMaybe"]>>(() => "Already in the deck");
    render(<RecommendationsPanel {...saved({ onMaybe })} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Add Arcane Signet to Maybe" }));
    await flush();
    expect(screen.getByText("Already in the deck")).toBeTruthy();
  });

  it("a resolve that answers a different card adds nothing and says so", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url) === "/api/cards/resolve"
        ? { ok: true, status: 200, json: async () => resolveWire(rec, combo.cardId) }
        : { ok: true, status: 200, json: async () => ({ recommendations: [rec] }) },
    );
    const onAdd = vi.fn<Props["onAdd"]>(() => undefined);
    render(<RecommendationsPanel {...saved({ onAdd })} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Add Arcane Signet to the deck" }));
    await flush();
    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen.getByText("Couldn't load Arcane Signet. Try adding it from search."),
    ).toBeTruthy();
  });

  it("empty answers say why: nothing at All; nothing at a budget names the price and the way out", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ recommendations: [] }),
    }));
    render(<RecommendationsPanel {...saved()} />);
    await flush();
    expect(screen.getByText("No suggestions right now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    await flush();
    expect(
      screen.getByText("No suggestions with a known price of $5 or less. Try a wider budget."),
    ).toBeTruthy();
  });

  it("“Only cards I own” is disabled without a collection, with the honest hint; with one it asks ?owned=1", async () => {
    const view = render(<RecommendationsPanel {...saved()} />);
    await flush();
    const toggle = screen.getByTestId("only-owned-toggle") as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByRole("link", { name: "import a collection" })).toBeTruthy();

    view.rerender(<RecommendationsPanel {...saved({ ownedAvailable: true })} />);
    fireEvent.click(screen.getByTestId("only-owned-toggle"));
    await flush();
    expect(String(deckGets().at(-1)![0])).toBe("/api/decks/deck-1/recommendations?owned=1");
  });

  it("a collector's draft (AUTOFILL-OWNED): the toggle is off and says it starts once the deck is saved; the draft's ask never carries it; the first save enables it with no reload", async () => {
    const toggle = () => screen.getByTestId("only-owned-toggle") as HTMLButtonElement;
    const hint = () => document.querySelector<HTMLElement>("[data-slot=field-description]");
    // No row yet, and the editor knows the player has a collection.
    const view = render(<RecommendationsPanel {...props({ ownedAvailable: true })} />);
    await flush();
    expect(toggle().disabled).toBe(true);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(hint()?.textContent).toBe("Filtering by your collection starts once the deck is saved.");
    // Not the guest's hint: this player has a collection.
    expect(screen.queryByRole("link", { name: "import a collection" })).toBeNull();
    // It cannot be ticked, and the snapshot route was asked once, with no owned flag.
    fireEvent.click(toggle());
    await flush();
    expect(snapshotCalls()).toHaveLength(1);
    expect(JSON.parse((snapshotCalls()[0][1] as RequestInit).body as string)).not.toHaveProperty(
      "ownedOnly",
    );
    expect(deckGets()).toHaveLength(0);

    // The row mints (any Add saves the deck): enabled, the hint gone, and a tick filters.
    view.rerender(<RecommendationsPanel {...props({ ownedAvailable: true, deckId: "deck-1" })} />);
    expect(toggle().disabled).toBe(false);
    expect(hint()).toBeNull();
    fireEvent.click(toggle());
    await flush();
    expect(String(deckGets().at(-1)![0])).toBe("/api/decks/deck-1/recommendations?owned=1");
    expect(snapshotCalls()).toHaveLength(1);
  });

  it("a guest's draft keeps the hint it always had: sign in and import a collection", async () => {
    render(<RecommendationsPanel {...props()} />);
    await flush();
    expect((screen.getByTestId("only-owned-toggle") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "import a collection" }).getAttribute("href")).toBe(
      "/account",
    );
    expect(screen.queryByText(/starts once the deck is saved/)).toBeNull();
  });
});

// --- Goals (Y6a, WAVE4 D7) -------------------------------------------------------------------

const hiddenRec = (name: string, why: string): Recommendation & { conflicts: unknown[] } => ({
  ...rec,
  cardId: `9${rec.cardId.slice(1, -2)}${String(name.length).padStart(2, "0")}`,
  name,
  conflicts: [
    {
      rule: "game-changers",
      source: "Wizards' Game Changers list (via Scryfall)",
      why,
      severity: "hide",
    },
  ],
});

describe("RecommendationsPanel — goals (Y6a)", () => {
  const goals2 = { v: 1 as const, targetLevel: 2, budget: { perCardUsd: 5 } };
  let answer: Record<string, unknown>;
  const saved = (over: Partial<Props> = {}) => props({ deckId: "deck-1", ...over });

  beforeEach(() => {
    answer = { recommendations: [rec], hidden: [], combosTruncated: false };
    fetchMock.mockImplementation(async (url: string) =>
      String(url) === "/api/cards/resolve"
        ? { ok: true, status: 200, json: async () => resolveWire(rec) }
        : { ok: true, status: 200, json: async () => answer },
    );
  });

  it("one goals line on top — the target in its level's words and the budget — whose Change opens Your target", async () => {
    const onChangeGoals = vi.fn();
    render(<RecommendationsPanel {...saved({ goals: goals2, onChangeGoals })} />);
    await flush();
    const line = document.querySelector('[data-slot="goals-line"]')!;
    expect(line.textContent).toBe("Your goals: Bracket 2 (Core), ≤ $5 a card Change");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(onChangeGoals).toHaveBeenCalledTimes(1);
  });

  it("with no goals it is the door to a target (LATER row 175): No bracket target yet Set one", async () => {
    const onChangeGoals = vi.fn();
    const view = render(<RecommendationsPanel {...saved({ onChangeGoals })} />);
    await flush();
    expect(document.querySelector('[data-slot="goals-line"]')!.textContent).toBe(
      "No bracket target yet Set one",
    );
    fireEvent.click(screen.getByRole("button", { name: "Set one" }));
    expect(onChangeGoals).toHaveBeenCalledTimes(1);
    // Without the door the line only reads.
    view.rerender(<RecommendationsPanel {...saved()} />);
    expect(screen.queryByRole("button", { name: "Set one" })).toBeNull();
  });

  it("the budget starts from the deck's own: that tier pressed and asked for — the GET in USD, a draft's POST with its goals", async () => {
    const view = render(<RecommendationsPanel {...saved({ goals: goals2 })} />);
    await flush();
    expect(screen.getByRole("button", { name: "≤ $5 a card" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(String(deckGets()[0][0])).toBe("/api/decks/deck-1/recommendations?budget=5");
    view.unmount();

    render(
      <RecommendationsPanel
        {...props({ goals: { ...goals2, exceptions: "one Game Changer, ask me" } })}
      />,
    );
    await flush();
    const body = JSON.parse((snapshotCalls()[0][1] as RequestInit).body as string);
    expect(body.budget).toBe(5);
    // The goals the check reads — never the exceptions line.
    expect(body.goals).toEqual({ v: 1, targetLevel: 2, budget: { perCardUsd: 5 } });
  });

  it("another tier shows “Save as this deck's budget”, which saves the pick as the goal (a total stays); the deck's own tier hides it", async () => {
    const onGoalsChange = vi.fn();
    const withTotal = { ...goals2, budget: { perCardUsd: 5, totalUsd: 150 } };
    const view = render(<RecommendationsPanel {...saved({ goals: withTotal, onGoalsChange })} />);
    await flush();
    expect(screen.queryByRole("button", { name: "Save as this deck's budget" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
    await flush();
    expect(String(deckGets().at(-1)![0])).toBe("/api/decks/deck-1/recommendations?budget=1");
    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    expect(screen.queryByRole("button", { name: "Save as this deck's budget" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Save as this deck's budget" }));
    expect(onGoalsChange).toHaveBeenCalledWith({ v: 1, targetLevel: 2, budget: { totalUsd: 150 } });

    // Saved: the control follows the deck's goal again.
    view.rerender(
      <RecommendationsPanel
        {...saved({ goals: { v: 1, targetLevel: 2, budget: { totalUsd: 150 } }, onGoalsChange })}
      />,
    );
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Save as this deck's budget" })).toBeNull();
  });

  it("“N hidden by your goals · Show” — Show lists them with their reasons, Hide folds them; the list keeps its own rows", async () => {
    answer = {
      recommendations: [rec],
      hidden: [
        hiddenRec(
          "Rhystic Study",
          "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
        ),
        hiddenRec(
          "Cyclonic Rift",
          "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
        ),
      ],
      combosTruncated: false,
    };
    render(<RecommendationsPanel {...saved({ goals: goals2 })} />);
    await flush();
    const toggle = screen.getByRole("button", { name: "Show" });
    expect(toggle.closest("p")!.textContent).toBe("2 hidden by your goals · Show");
    expect(screen.queryByText("Rhystic Study")).toBeNull();

    fireEvent.click(toggle);
    const list = screen.getByRole("list", { name: "Hidden by your goals" });
    expect(list.querySelectorAll('li[data-goals="hidden"]')).toHaveLength(2);
    expect(list.textContent).toContain("Rhystic Study");
    expect(list.textContent).toContain(
      "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
    );
    expect(screen.getByRole("button", { name: "Hide" }).getAttribute("aria-expanded")).toBe("true");
    // A hidden card can still be added — it's the owner's deck.
    expect(screen.getByRole("button", { name: "Add Rhystic Study to the deck" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("list", { name: "Hidden by your goals" })).toBeNull();
    expect(screen.getByText("Arcane Signet")).toBeTruthy();
  });

  it("a row's flags ride beside its evidence, never in it; a combo scan cut at its cap says so", async () => {
    answer = {
      recommendations: [
        {
          ...rec,
          conflicts: [
            {
              rule: "game-changers",
              source: "Wizards' Game Changers list (via Scryfall)",
              why: "Would make this deck at least Bracket 3: a Game Changer (Wizards' list)",
              severity: "flag",
            },
            {
              rule: "budget",
              source: "Card price",
              why: "Costs $45.00, over your ≤ $5 a card budget",
              severity: "flag",
            },
          ],
        },
      ],
      hidden: [],
      combosTruncated: true,
    };
    render(<RecommendationsPanel {...saved()} />);
    await flush();
    const row = screen.getByText("Arcane Signet").closest("li")!;
    expect(row.getAttribute("data-goals")).toBe("flagged");
    expect([...row.querySelectorAll("[data-conflict]")].map((p) => p.textContent)).toEqual([
      "Would make this deck at least Bracket 3: a Game Changer (Wizards' list)",
      "Costs $45.00, over your ≤ $5 a card budget",
    ]);
    expect(screen.getByText(/Combo checks stopped at the most popular combos/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
  });

  it("the goals are in the key: a new target asks again once it has saved; an exceptions edit never does", async () => {
    const view = render(<RecommendationsPanel {...saved({ goals: goals2 })} />);
    await flush();
    expect(deckGets()).toHaveLength(1);
    view.rerender(
      <RecommendationsPanel {...saved({ goals: { ...goals2, exceptions: "ask me" } })} />,
    );
    await flush();
    expect(deckGets()).toHaveLength(1);

    const goals3 = { ...goals2, targetLevel: 3 };
    view.rerender(<RecommendationsPanel {...saved({ goals: goals3, saveStatus: "saving" })} />);
    await flush();
    expect(deckGets()).toHaveLength(1);
    view.rerender(<RecommendationsPanel {...saved({ goals: goals3 })} />);
    await flush();
    expect(deckGets()).toHaveLength(2);
  });

  it("an add says nothing on the live line (the editor toasts it with Undo); a failure still does", async () => {
    const onAdd = vi.fn<Props["onAdd"]>(() => undefined);
    const view = render(<RecommendationsPanel {...saved({ onAdd })} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Add Arcane Signet to the deck" }));
    await flush();
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Added Arcane Signet")).toBeNull();

    view.rerender(<RecommendationsPanel {...saved({ onAdd: () => "Main deck is full" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Arcane Signet to the deck" }));
    await flush();
    expect(screen.getByText("Main deck is full")).toBeTruthy();
  });

  it("every card hidden: the list says nothing else fits the goals", async () => {
    answer = {
      recommendations: [],
      hidden: [
        hiddenRec(
          "Rhystic Study",
          "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
        ),
      ],
      combosTruncated: false,
    };
    render(<RecommendationsPanel {...saved({ goals: goals2 })} />);
    await flush();
    expect(screen.getByText("Nothing else fits your goals right now.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show" })).toBeTruthy();
  });
});

// --- A deck total (SUGGEST-TOTAL, the owner's ask of 2026-11-26) ---------------------------

describe("RecommendationsPanel — a deck total (SUGGEST-TOTAL)", () => {
  let answer: Record<string, unknown>;
  const saved = (over: Partial<Props> = {}) => props({ deckId: "deck-1", ...over });
  /** The deck costs $62.38 at its cheapest printings: $37.62 left of a $100 total. */
  const at62 = { usd: 62.38, unpriced: 0 };
  const total100 = { v: 1 as const, budget: { totalUsd: 100 } };
  const totalLine = () => document.querySelector<HTMLElement>("[data-slot=suggest-total-line]");
  const gets = () => deckGets().map(([url]) => String(url));
  const field = () => screen.getByRole("textbox", { name: "Deck total" }) as HTMLInputElement;
  const BASE = "/api/decks/deck-1/recommendations";

  beforeEach(() => {
    answer = { recommendations: [rec], hidden: [], combosTruncated: false };
    fetchMock.mockImplementation(async (url: string) =>
      String(url) === "/api/cards/resolve"
        ? { ok: true, status: 200, json: async () => resolveWire(rec) }
        : { ok: true, status: 200, json: async () => answer },
    );
  });

  it("a saved total narrows the list to what's left of it: the field reads the total, the ask is for cards up to $37.62, the line says for how many cards", async () => {
    render(
      <RecommendationsPanel
        {...saved({ goals: total100, estimate: at62, onGoalsChange: vi.fn() })}
      />,
    );
    await flush();
    expect(gets()).toEqual([`${BASE}?budget=37.62`]);
    expect(field().value).toBe("100");
    expect(screen.getByRole("button", { name: "$100" }).getAttribute("aria-pressed")).toBe("true");
    // The commander and Sol Ring are in: 98 to go. The goals line above has the estimate.
    expect(totalLine()!.textContent).toBe("$37.62 left for 98 more cards");
    expect(field().getAttribute("aria-describedby")).toBe(totalLine()!.id);
    expect(document.querySelector("[data-slot=goals-line]")!.textContent).toBe(
      "Your goals: est. $62 of your $100",
    );
    // The deck holds this total already: nothing to save, even pressed again.
    expect(screen.queryByRole("button", { name: /as this deck's total$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "$100" }));
    await flush();
    expect(screen.queryByRole("button", { name: /as this deck's total$/ })).toBeNull();
    expect(gets()).toHaveLength(1);
    expect(screen.getByText("Arcane Signet")).toBeTruthy();
  });

  it("the tighter limit is the one asked for, and a pick that leaves it as it was asks nothing again", async () => {
    const view = render(<RecommendationsPanel {...saved({ goals: total100, estimate: at62 })} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await flush();
    expect(gets()).toEqual([`${BASE}?budget=37.62`, `${BASE}?budget=5`, `${BASE}?budget=37.62`]);
    // The line still says what's left; the tier is the tighter limit for as long as it is pressed.
    expect(totalLine()!.textContent).toBe("$37.62 left for 98 more cards");
    view.unmount();

    // $3.50 left: under every tier, so a tier pick moves nothing.
    fetchMock.mockClear();
    render(
      <RecommendationsPanel
        {...saved({ goals: total100, estimate: { usd: 96.5, unpriced: 0 } })}
      />,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
    await flush();
    expect(gets()).toEqual([`${BASE}?budget=3.5`, `${BASE}?budget=1`]);
  });

  it("a total typed in the panel narrows at once and offers its Save, a goals edit; once saved the field follows the deck's and nothing is asked again", async () => {
    const onGoalsChange = vi.fn();
    const goals = { v: 1 as const, targetLevel: 2 };
    const view = render(
      <RecommendationsPanel {...saved({ goals, estimate: at62, onGoalsChange })} />,
    );
    await flush();
    expect(gets()).toEqual([BASE]);
    expect(totalLine()).toBeNull();
    expect(screen.getByRole("button", { name: "Not set" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    // Anything but whole dollars is refused, and nothing is asked.
    fireEvent.change(field(), { target: { value: "12.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a whole number of dollars, at least $1.",
    );
    await flush();
    expect(gets()).toHaveLength(1);

    fireEvent.change(field(), { target: { value: "$100" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    await flush();
    expect(gets()).toEqual([BASE, `${BASE}?budget=37.62`]);
    expect(field().value).toBe("100");
    // A total of the panel's own leads with its own figure: the goals line names none.
    expect(totalLine()!.textContent).toBe("est. $62 of your $100 · $37.62 left for 98 more cards");
    expect(onGoalsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save $100 as this deck's total" }));
    expect(onGoalsChange).toHaveBeenCalledWith({ v: 1, targetLevel: 2, budget: { totalUsd: 100 } });
    view.rerender(
      <RecommendationsPanel
        {...saved({
          goals: { ...goals, budget: { totalUsd: 100 } },
          estimate: at62,
          onGoalsChange,
        })}
      />,
    );
    await flush();
    expect(screen.queryByRole("button", { name: "Save $100 as this deck's total" })).toBeNull();
    expect(totalLine()!.textContent).toBe("$37.62 left for 98 more cards");
    expect(gets()).toHaveLength(2);
  });

  it("Not set over a saved total asks with no limit and offers Remove; a preset asks with what's left of it", async () => {
    const onGoalsChange = vi.fn();
    const view = render(
      <RecommendationsPanel {...saved({ goals: total100, estimate: at62, onGoalsChange })} />,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Not set" }));
    await flush();
    expect(gets()).toEqual([`${BASE}?budget=37.62`, BASE]);
    expect(field().value).toBe("");
    expect(totalLine()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove this deck's total" }));
    expect(onGoalsChange).toHaveBeenLastCalledWith(null);
    view.rerender(
      <RecommendationsPanel {...saved({ goals: null, estimate: at62, onGoalsChange })} />,
    );
    await flush();
    expect(screen.queryByRole("button", { name: "Remove this deck's total" })).toBeNull();
    expect(gets()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "$150" }));
    await flush();
    expect(gets().at(-1)).toBe(`${BASE}?budget=87.62`);
    expect(screen.getByRole("button", { name: "Save $150 as this deck's total" })).toBeTruthy();
  });

  it("a saved total that moves from elsewhere (the Fit sheet, Autofill's Add) wins over the panel's pick", async () => {
    const onGoalsChange = vi.fn();
    const view = render(
      <RecommendationsPanel {...saved({ goals: total100, estimate: at62, onGoalsChange })} />,
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "$250" }));
    await flush();
    expect(field().value).toBe("250");
    view.rerender(
      <RecommendationsPanel
        {...saved({ goals: { v: 1, budget: { totalUsd: 150 } }, estimate: at62, onGoalsChange })}
      />,
    );
    await flush();
    expect(field().value).toBe("150");
    expect(screen.queryByRole("button", { name: /as this deck's total$/ })).toBeNull();
    expect(gets()).toEqual([
      `${BASE}?budget=37.62`,
      `${BASE}?budget=187.62`,
      `${BASE}?budget=87.62`,
    ]);
    expect(onGoalsChange).not.toHaveBeenCalled();
  });

  it("nothing fits: the last answer's “hidden by your goals” line and its combo note go with its rows", async () => {
    answer = {
      recommendations: [rec],
      hidden: [
        hiddenRec(
          "Rhystic Study",
          "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
        ),
      ],
      combosTruncated: true,
    };
    const goals = { v: 1 as const, targetLevel: 2 };
    render(<RecommendationsPanel {...saved({ goals, estimate: at62, onGoalsChange: vi.fn() })} />);
    await flush();
    expect(screen.getByRole("button", { name: "Show" }).closest("p")!.textContent).toBe(
      "1 hidden by your goals · Show",
    );
    expect(screen.getByText(/Combo checks stopped at the most popular combos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "$50" }));
    await flush();
    expect(gets()).toHaveLength(1);
    expect(screen.getByText(/^Nothing more fits under your \$50 total\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
    expect(screen.queryByText(/Combo checks stopped at the most popular combos/)).toBeNull();
    expect(screen.queryByText("Arcane Signet")).toBeNull();
  });

  it("at or over the total nothing is asked: the list's place says nothing more fits, Refresh is off, and Not set asks again", async () => {
    render(
      <RecommendationsPanel
        {...saved({ goals: total100, estimate: { usd: 104.2, unpriced: 0 } })}
      />,
    );
    await flush();
    expect(gets()).toEqual([]);
    expect(
      screen.getByText(
        "Nothing more fits under your $100 total. Raise it, or choose Not set to drop it.",
      ),
    ).toBeTruthy();
    // The goals line above reads the saved total against the deck; this line adds nothing.
    expect(document.querySelector("[data-slot=goals-line]")!.textContent).toBe(
      "Your goals: est. $104 of your $100",
    );
    expect(totalLine()).toBeNull();
    expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Not set" }));
    await flush();
    expect(gets()).toEqual([BASE]);
    expect(screen.getByText("Arcane Signet")).toBeTruthy();
    expect(screen.queryByText(/Nothing more fits/)).toBeNull();
  });

  it("an unsaved total the deck is already over: its own figure stays on the line, with its Save", async () => {
    render(<RecommendationsPanel {...saved({ estimate: at62, onGoalsChange: vi.fn() })} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "$50" }));
    await flush();
    expect(gets()).toEqual([BASE]);
    expect(totalLine()!.textContent).toBe("est. $62 of your $50");
    expect(screen.getByText(/^Nothing more fits under your \$50 total\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save $50 as this deck's total" })).toBeTruthy();
  });

  /** The next ask hangs until the panel cuts it short. */
  const hangNextAsk = () =>
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
  const refresh = () => screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement;

  it("an ask cut short by a total that leaves nothing leaves no “Updating…” behind, and coming back to the answered list asks nothing again", async () => {
    render(<RecommendationsPanel {...saved({ estimate: at62 })} />);
    await flush();
    expect(gets()).toEqual([BASE]);
    hangNextAsk();
    fireEvent.click(screen.getByRole("button", { name: "$250" }));
    await flush();
    expect(screen.getByText("Updating…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "$50" }));
    await flush();
    expect(screen.queryByText("Updating…")).toBeNull();
    // Back to no total: the list already answered, so nothing is asked again.
    fireEvent.click(screen.getByRole("button", { name: "Not set" }));
    await flush();
    expect(gets()).toEqual([BASE, `${BASE}?budget=187.62`]);
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(refresh().disabled).toBe(false);
    expect(screen.getByText("Arcane Signet")).toBeTruthy();
  });

  it("a key that comes straight back cuts its ask short with no “Updating…” left and Refresh on: a total, then a tier (older than this build)", async () => {
    render(<RecommendationsPanel {...saved({ goals: total100, estimate: at62 })} />);
    await flush();
    hangNextAsk();
    fireEvent.click(screen.getByRole("button", { name: "$150" }));
    await flush();
    expect(screen.getByText("Updating…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "$100" }));
    await flush();
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(refresh().disabled).toBe(false);
    expect(gets()).toEqual([`${BASE}?budget=37.62`, `${BASE}?budget=87.62`]);

    hangNextAsk();
    fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
    await flush();
    expect(screen.getByText("Updating…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await flush();
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(refresh().disabled).toBe(false);
    expect(gets()).toEqual([`${BASE}?budget=37.62`, `${BASE}?budget=87.62`, `${BASE}?budget=5`]);
    expect(screen.getByText("Arcane Signet")).toBeTruthy();
  });

  it("between an Add and the answer its save asks for, a row the deck can no longer afford leaves the list; the card added keeps its row", async () => {
    const priced = (name: string, usd: string, n: number): Recommendation => ({
      ...rec,
      cardId: `7777777${n}-7777-4777-8777-777777777777`,
      name,
      cheapestUsd: usd,
    });
    const eight = priced("Eight Dollar Card", "8.00", 1);
    const nine = priced("Nine Dollar Card", "9.00", 2);
    answer = {
      recommendations: [eight, nine, rec],
      hidden: [
        {
          ...hiddenRec(
            "Rhystic Study",
            "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
          ),
          cheapestUsd: "9.00",
        },
      ],
      combosTruncated: false,
    };
    const view = render(
      <RecommendationsPanel {...saved({ goals: total100, estimate: { usd: 90, unpriced: 0 } })} />,
    );
    await flush();
    expect(gets()).toEqual([`${BASE}?budget=10`]);
    expect(screen.getByText("Nine Dollar Card")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show" })).toBeTruthy();

    // The $8 card goes in: $2 left at once, its save still to settle.
    const grown = [...baseEntries, { cardId: eight.cardId, zone: "main", qty: 1 }];
    view.rerender(
      <RecommendationsPanel
        {...saved({
          goals: total100,
          estimate: { usd: 98, unpriced: 0 },
          entries: grown,
          inDeckQty: new Map([[eight.cardId, 1]]),
          saveStatus: "dirty",
        })}
      />,
    );
    await flush();
    expect(gets()).toHaveLength(1);
    expect(totalLine()!.textContent).toBe("$2 left for 97 more cards");
    expect(screen.queryByText("Nine Dollar Card")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
    expect(screen.getByText("Eight Dollar Card").closest("li")!.textContent).toContain("In deck ✓");
    expect(screen.getByRole("button", { name: "Add Arcane Signet to the deck" })).toBeTruthy();
  });

  it("a tick the server declined (signed out) filters nothing, so the total narrows the list again and the line says what's left", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        recommendations: [rec],
        hidden: [],
        combosTruncated: false,
        owned: String(url).includes("owned=1")
          ? { requested: true, applied: false, reason: "signed-out" }
          : { requested: false, applied: false },
      }),
    }));
    render(
      <RecommendationsPanel
        {...saved({ ownedAvailable: true, goals: total100, estimate: at62 })}
      />,
    );
    await flush();
    fireEvent.click(screen.getByTestId("only-owned-toggle"));
    await flush();
    await flush();
    expect(gets()).toEqual([
      `${BASE}?budget=37.62`,
      `${BASE}?owned=1`,
      `${BASE}?budget=37.62&owned=1`,
    ]);
    expect(totalLine()!.textContent).toBe("$37.62 left for 98 more cards");
    expect(
      screen.getByText("Sign in to filter by your collection. Showing all suggestions."),
    ).toBeTruthy();
  });

  it("a draft asks with what's left in its body, and its goals never carry the total", async () => {
    render(
      <RecommendationsPanel
        {...props({
          goals: { v: 1, targetLevel: 2, budget: { totalUsd: 100 } },
          estimate: { usd: 62.38, unpriced: 2 },
        })}
      />,
    );
    await flush();
    const body = JSON.parse((snapshotCalls()[0][1] as RequestInit).body as string);
    expect(body.budget).toBe(37.62);
    expect(body.goals).toEqual({ v: 1, targetLevel: 2 });
    expect(deckGets()).toHaveLength(0);
  });

  it("“Only cards I own” ticked: the total narrows nothing, its line says why, and the tier still asks", async () => {
    render(
      <RecommendationsPanel
        {...saved({
          ownedAvailable: true,
          goals: total100,
          estimate: { usd: 104.2, unpriced: 0 },
        })}
      />,
    );
    await flush();
    expect(gets()).toEqual([]);
    fireEvent.click(screen.getByTestId("only-owned-toggle"));
    await flush();
    expect(gets()).toEqual([`${BASE}?owned=1`]);
    expect(totalLine()!.textContent).toBe(
      "Cards you own cost nothing to add, so the total doesn't narrow this list.",
    );
    expect(screen.queryByText(/Nothing more fits/)).toBeNull();
    expect(screen.getByText("Arcane Signet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
    await flush();
    expect(gets().at(-1)).toBe(`${BASE}?budget=1&owned=1`);
  });

  it("an empty answer under what's left says so in the total's words", async () => {
    answer = { recommendations: [], hidden: [], combosTruncated: false };
    render(
      <RecommendationsPanel
        {...saved({ goals: total100, estimate: { usd: 96.5, unpriced: 0 } })}
      />,
    );
    await flush();
    expect(screen.getByText("No suggestions fit the $3.50 left of your $100 total.")).toBeTruthy();
  });

  it("an add that moves what's left asks once, after its save, with the new limit", async () => {
    const view = render(<RecommendationsPanel {...saved({ goals: total100, estimate: at62 })} />);
    await flush();
    const grown = [...baseEntries, { cardId: rec.cardId, zone: "main", qty: 1 }];
    const after = { usd: 62.78, unpriced: 0 };
    view.rerender(
      <RecommendationsPanel
        {...saved({ goals: total100, estimate: after, entries: grown, saveStatus: "dirty" })}
      />,
    );
    await flush();
    expect(gets()).toHaveLength(1);
    view.rerender(
      <RecommendationsPanel {...saved({ goals: total100, estimate: after, entries: grown })} />,
    );
    await flush();
    expect(gets()).toEqual([`${BASE}?budget=37.62`, `${BASE}?budget=37.22`]);
    expect(totalLine()!.textContent).toBe("$37.22 left for 97 more cards");
  });
});
