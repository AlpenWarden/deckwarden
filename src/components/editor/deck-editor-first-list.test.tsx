/**
 * FIRST-LIST in the editor: a deck built by hand counts its changes from its
 * first full list, the owner's four calls of 2026-11-26. A deck loaded full
 * with no baseline says "No changes from your first full list yet." and
 * writes nothing until its list changes, when that save stores the list it
 * loaded (call 4); a deck that reaches 100 in the editor shows the line with
 * the 100th card and stores that list in the same save (call 1); a stored
 * baseline brings the line, the rows' marks and the sheet, whose Take out
 * names the cut cards from the GET with no request of its own; "I've made
 * these changes" makes the list on screen the baseline, ONE PATCH, a toast
 * whose Undo puts the old one back (call 2); and a deck with a precon
 * lineage shows none of it and never sends one.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardWire } from "@/lib/decks/editor-state";
import { baselineDate } from "@/lib/decks/first-list";
import { card } from "@/lib/games/mtg/test-fixtures";
import { MD_QUERY, WIDE_QUERY } from "./use-tier";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false, error: null }) },
}));

import { DeckEditor } from "./deck-editor";

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WIDE_QUERY ? width >= 1200 : query === MD_QUERY ? width >= 768 : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })),
  );
}

const wire = (over: Parameters<typeof card>[0]): CardWire => ({ ...card(over), image: null });
const kozilek = wire({
  name: "Kozilek, the Great Distortion",
  primaryType: "Creature",
  costValue: 10,
  isLeaderCandidate: true,
  cheapestUsd: 9,
  attrs: { type_line: "Legendary Creature — Eldrazi", oracle_text: "" },
});
const spell = (name: string, usd: number, primaryType = "Artifact") =>
  wire({
    name,
    primaryType,
    costValue: 2,
    cheapestUsd: usd,
    attrs: { type_line: primaryType, oracle_text: "" },
  });
const mindStone = spell("Mind Stone", 0.35);
const divination = spell("Divination", 0.05, "Sorcery");
const hedron = spell("Hedron Archive", 0.4);
const wastes = wire({
  name: "Wastes",
  primaryType: "Land",
  costValue: null,
  cheapestUsd: 0.1,
  attrs: { type_line: "Basic Land — Wastes", oracle_text: "" },
});
const study = spell("Rhystic Study", 66.76, "Enchantment");

const entryOf = (c: CardWire, zone: string, qty = 1) => ({
  cardId: c.id,
  zone,
  qty,
  tags: [] as string[],
  printingId: null,
  card: c,
});
/** The first full list: 100 cards. */
const FIRST = [
  entryOf(kozilek, "commander"),
  entryOf(mindStone, "main"),
  entryOf(divination, "main"),
  entryOf(hedron, "main"),
  entryOf(wastes, "main", 96),
];
/** One short of it: 99 cards. */
const SHORT = [
  entryOf(kozilek, "commander"),
  entryOf(mindStone, "main"),
  entryOf(divination, "main"),
  entryOf(hedron, "main"),
  entryOf(wastes, "main", 95),
];
/** Divination out for Rhystic Study, Hedron Archive out for one more Wastes. */
const UPGRADED = [
  entryOf(kozilek, "commander"),
  entryOf(mindStone, "main"),
  entryOf(study, "main"),
  entryOf(wastes, "main", 97),
];
/** A list as a baseline stores it: one row per identity, sorted by id. */
const baselineCards = (list: readonly { cardId: string; zone: string; qty: number }[]) => {
  const copies = new Map<string, number>();
  for (const e of list) copies.set(e.cardId, (copies.get(e.cardId) ?? 0) + e.qty);
  return [...copies]
    .map(([cardId, qty]) => ({ cardId, qty }))
    .sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));
};
const FIRST_BASELINE = {
  source: "complete",
  setAt: "2026-11-20T12:00:00.000Z",
  cards: baselineCards(FIRST),
};

const FRESH_FACTS = {
  readAt: "2026-10-05T07:00:00.000Z",
  feeds: Object.fromEntries(
    ["gameChangers", "landDenial", "extraTurns", "combos"].map((feed) => [
      feed,
      { state: "ok", asOf: "2026-10-04T15:29:34.768Z" },
    ]),
  ),
};

const fetchMock = vi.fn();
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });
/** What the saved deck's GET says (a test may swap any of them). */
let deckCards = FIRST;
let deckBaseline: unknown = null;
let deckBaselineCards: CardWire[] = [];
let deckPrecon: unknown = null;
function route(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const method = init?.method ?? "GET";
  if (url === "/api/decks/deck-1" && method === "GET") {
    return ok({
      deck: {
        id: "deck-1",
        publicId: "abcdefgh1234",
        game: "mtg",
        format: "commander",
        name: "Kozilek Lab",
        description: null,
        notes: null,
        visibility: "unlisted",
        isOwner: true,
        forkedFrom: null,
        leaderIds: [kozilek.id],
        goals: null,
        precon: deckPrecon,
        baseline: deckBaseline,
      },
      cards: deckCards,
      owned: [],
      hasCollection: false,
      baselineCards: deckBaselineCards,
    });
  }
  if (url === "/api/decks/deck-1/cards" && method === "PUT") return ok({});
  if (url === "/api/decks/deck-1" && method === "PATCH") return ok({});
  if (url.startsWith("/api/decks/deck-1/recommendations")) return ok({ recommendations: [] });
  if (url.startsWith("/api/decks/deck-1/combos")) return ok({ combos: [], inDeck: [] });
  if (url.startsWith("/api/combos/complete?")) return ok({ combos: [], freshness: FRESH_FACTS });
  return ok({});
}

const calls = (pred: (url: string, method: string) => boolean) =>
  fetchMock.mock.calls.filter(([url, init]) =>
    pred(String(url), (init as RequestInit | undefined)?.method ?? "GET"),
  );
const writes = () => calls((_u, m) => m !== "GET").length;
const puts = () => calls((_u, m) => m === "PUT").length;
const patchBodies = () =>
  calls((u, m) => u === "/api/decks/deck-1" && m === "PATCH").map(
    ([, init]) => JSON.parse((init as RequestInit).body as string) as unknown,
  );

async function settle(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function pollFor<T>(query: () => T | null | undefined): Promise<T> {
  const deadline = performance.now() + 2000;
  for (;;) {
    const found = query();
    if (found) return found;
    if (performance.now() > deadline) throw new Error("pollFor: never appeared within 2 s");
    await settle(50);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
  }
}

const line = () => document.querySelector<HTMLElement>("[data-slot=first-list-line]");
const lineText = () => line()?.querySelector("span")?.textContent ?? null;
const see = () => within(line()!).queryByRole("button", { name: "See changes" });
const marks = () =>
  [...document.querySelectorAll("[data-slot=precon-mark]")].map((m) => ({
    row: m.closest("button")?.querySelector("span")?.textContent,
    name: m.getAttribute("aria-label"),
  }));
const sheet = () => screen.queryByRole("dialog", { name: "Changes from your first full list" });
const rows = (dialog: HTMLElement, side: "out" | "in") =>
  [...dialog.querySelectorAll<HTMLElement>(`[data-list=${side}] [data-change-row]`)].map((li) =>
    li.textContent!.replace(/\s+/g, " ").trim(),
  );
const section = (label: string) =>
  document.querySelector<HTMLElement>(`section[aria-label="${label}"]`)!;

function saved() {
  window.history.replaceState(null, "", "/decks/deck-1/edit");
  return render(<DeckEditor deckId="deck-1" />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  deckCards = FIRST;
  deckBaseline = null;
  deckBaselineCards = [];
  deckPrecon = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(route);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("DeckEditor — the first full list (FIRST-LIST)", () => {
  it("a deck loaded full with no baseline: no changes yet, no mark, and the load writes nothing", async () => {
    stubViewport(1440);
    saved();
    await pollFor(line);
    expect(lineText()).toBe("No changes from your first full list yet.");
    expect(see()).toBeNull();
    expect(marks()).toEqual([]);
    await settle(1500);
    await act(async () => {});
    expect(writes()).toBe(0);
    // A hidden tab with nothing to send sends nothing either.
    window.dispatchEvent(new Event("pagehide"));
    expect(writes()).toBe(0);
  });

  it("its first list edit stores the list it loaded, in the same save (the owner's call 4)", async () => {
    stubViewport(1440);
    saved();
    await pollFor(line);
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Divination" }),
    );
    expect(lineText()).toBe("Changed from your first full list: 1 out, 0 in.");
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(patchBodies()).toEqual([
      { baseline: { source: "complete", setAt: expect.any(String), cards: baselineCards(FIRST) } },
    ]);
    // The next edit moves the line only: the baseline is stored.
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "One more Wastes" }));
    expect(lineText()).toBe("Changed from your first full list: 1 out, 1 in.");
    expect(marks()).toEqual([{ row: "Wastes", name: "1 not in your first full list" }]);
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(patchBodies()).toHaveLength(1);
  });

  it("closing the tab on that first edit sends the list and its baseline as keepalive copies", async () => {
    stubViewport(1440);
    saved();
    await pollFor(line);
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Divination" }),
    );
    window.dispatchEvent(new Event("pagehide"));
    const keepalive = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.keepalive === true,
    );
    expect(keepalive.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      ["/api/decks/deck-1/cards", "PUT"],
      ["/api/decks/deck-1", "PATCH"],
    ]);
    expect(JSON.parse((keepalive[1][1] as RequestInit).body as string)).toEqual({
      baseline: { source: "complete", setAt: expect.any(String), cards: baselineCards(FIRST) },
    });
  });

  it("a deck that reaches 100 here: the line comes with the 100th card, and that save stores the list (the owner's call 1)", async () => {
    stubViewport(1440);
    deckCards = SHORT;
    saved();
    await pollFor(() => screen.queryAllByText("Divination")[0]);
    await settle(1500);
    expect(line()).toBeNull();
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "One more Wastes" }));
    expect(lineText()).toBe("No changes from your first full list yet.");
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(patchBodies()).toEqual([
      { baseline: { source: "complete", setAt: expect.any(String), cards: baselineCards(FIRST) } },
    ]);
    // Below full again, the line stays: the deck has its baseline now.
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Hedron Archive" }),
    );
    expect(lineText()).toBe("Changed from your first full list: 1 out, 0 in.");
  });

  it("a stored baseline: the line and marks from the GET, and See changes names the cut cards with no request", async () => {
    stubViewport(1440);
    deckCards = UPGRADED;
    deckBaseline = FIRST_BASELINE;
    deckBaselineCards = [divination, hedron];
    saved();
    await pollFor(line);
    expect(lineText()).toBe("Changed from your first full list: 2 out, 2 in.");
    expect(marks()).toEqual([
      { row: "Rhystic Study", name: "Not in your first full list" },
      { row: "Wastes", name: "1 not in your first full list" },
    ]);
    const before = fetchMock.mock.calls.length;
    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    const body = dialog.querySelector("[data-slot=precon-changes-sheet]")!;
    expect(body.getAttribute("data-baseline")).toBe("first-list");
    expect(body.getAttribute("data-out-state")).toBe("ready");
    expect(within(dialog).getByText(/^What to take out of your first full list/).textContent).toBe(
      "What to take out of your first full list and what to add to build this one.",
    );
    expect(rows(dialog, "out")).toEqual(["Divination", "Hedron Archive"]);
    expect(rows(dialog, "in")).toEqual(["Rhystic Study $66.76", "Wastes $0.10"]);
    expect(dialog.querySelector("[data-slot=precon-changes-cost]")!.textContent).toBe(
      "The cards to add cost $66.86.",
    );
    expect(fetchMock.mock.calls.length).toBe(before);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await pollFor(() => (sheet() === null ? true : null));
    await pollFor(() => (document.activeElement === see() ? true : null));
    await settle(1500);
    expect(writes()).toBe(0);
  });

  it("I've made these changes: the list on screen is the baseline, ONE PATCH, and the toast's Undo puts the old one back (the owner's call 2)", async () => {
    stubViewport(1440);
    deckCards = UPGRADED;
    deckBaseline = FIRST_BASELINE;
    deckBaselineCards = [divination, hedron];
    saved();
    await pollFor(line);
    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    fireEvent.click(within(dialog).getByRole("button", { name: "I've made these changes" }));
    await pollFor(() => (sheet() === null ? true : null));
    const today = baselineDate(new Date().toISOString());
    expect(lineText()).toBe(`No changes since your list of ${today}.`);
    expect(see()).toBeNull();
    expect(marks()).toEqual([]);
    // Focus lands on the line's words, which say what the button did.
    await pollFor(() => (document.activeElement === line()!.querySelector("span") ? true : null));
    const toastEl = (
      await pollFor(() => screen.queryByText("Changes now count from this list"))
    ).closest('[data-slot="toast"]') as HTMLElement;
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(0);
    expect(patchBodies()).toEqual([
      { baseline: { source: "owner", setAt: expect.any(String), cards: baselineCards(UPGRADED) } },
    ]);

    // An edit now counts from the new baseline, in its own words.
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Mind Stone" }),
    );
    expect(lineText()).toBe(`Changed since your list of ${today}: 1 out, 0 in.`);
    const removedToast = (await pollFor(() => screen.queryByText("Removed Mind Stone"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    fireEvent.click(within(removedToast).getByRole("button", { name: "Undo" }));
    expect(lineText()).toBe(`No changes since your list of ${today}.`);

    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    expect(lineText()).toBe("Changed from your first full list: 2 out, 2 in.");
    await settle(1500);
    await act(async () => {});
    expect(patchBodies().at(-1)).toEqual({ baseline: FIRST_BASELINE });
  });

  it("an owner's baseline says its day", async () => {
    stubViewport(1440);
    deckCards = UPGRADED;
    deckBaseline = { ...FIRST_BASELINE, source: "owner" };
    deckBaselineCards = [divination, hedron];
    saved();
    await pollFor(line);
    const day = baselineDate(FIRST_BASELINE.setAt);
    expect(lineText()).toBe(`Changed since your list of ${day}: 2 out, 2 in.`);
    fireEvent.click(see()!);
    expect(
      await pollFor(() =>
        screen.queryByRole("dialog", { name: `Changes since your list of ${day}` }),
      ),
    ).not.toBeNull();
  });

  it("a deck with a precon lineage: no first-list line, and no baseline is ever sent", async () => {
    stubViewport(1440);
    deckCards = UPGRADED;
    deckPrecon = {
      slug: "kozilek_lab",
      name: "Kozilek Lab",
      owns: null,
      cards: baselineCards(FIRST),
    };
    saved();
    await pollFor(() => document.querySelector("[data-slot=precon-changes-line]"));
    expect(line()).toBeNull();
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Mind Stone" }),
    );
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(patchBodies()).toEqual([]);
  });
});
