/**
 * PRECON-CHANGES in the editor: what a deck started from a precon changed
 * from the box is derived from the precon's own list and the list on
 * screen, never stored. A precon draft opens with zero POSTs and "No
 * changes from the precon yet."; an edit moves the line, the rows' marks
 * and the sheet in the same render, and its Undo takes them back; the sheet
 * on a draft asks nothing (the seed holds every card); after a reload it
 * asks ONE GET /api/precons/<slug> for the cut cards' names; the sheet's
 * cost is the ownership line's missing when the precon is owned; closing
 * hands focus back to "See changes"; and a deck with no lineage shows none
 * of it.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardWire } from "@/lib/decks/editor-state";
import { card } from "@/lib/games/mtg/test-fixtures";
import { MD_QUERY, WIDE_QUERY } from "./use-tier";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
// AUTOFILL-OWNED: a draft's editor reads the client's session to learn whether
// its player has a collection. A guest here, so it asks nothing about one and
// no test depends on the auth client's own request (the precedent is
// src/components/site-header.test.tsx).
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
/** The product's own list: 100 cards. */
const BOX = [
  entryOf(kozilek, "commander"),
  entryOf(mindStone, "main"),
  entryOf(divination, "main"),
  entryOf(hedron, "main"),
  entryOf(wastes, "main", 96),
];
/** The owner's wire of the same list: one row per identity, sorted by id. */
const PRECON_CARDS = BOX.map((e) => ({ cardId: e.cardId, qty: e.qty })).sort((a, b) =>
  a.cardId < b.cardId ? -1 : 1,
);
/** A saved deck that swapped Divination for Rhystic Study and runs two more Wastes for Hedron Archive. */
const UPGRADED = [
  entryOf(kozilek, "commander"),
  entryOf(mindStone, "main"),
  entryOf(study, "main"),
  entryOf(wastes, "main", 97),
];

const PRECON_RESPONSE = {
  precon: { slug: "kozilek_lab", productName: "Kozilek Lab" },
  deck: { name: "Kozilek Lab", game: "mtg", format: "commander", leaderIds: [kozilek.id] },
  cards: BOX,
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
/** The saved deck's cards and what its GET says about its precon (a test may swap either). */
let deckCards = UPGRADED;
let deckPrecon: unknown = null;
let preconStatus = 200;
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
      },
      cards: deckCards,
      owned: [],
      hasCollection: false,
    });
  }
  if (url === "/api/precons/kozilek_lab") {
    return preconStatus === 200
      ? ok(PRECON_RESPONSE)
      : Promise.resolve({ ok: false, status: preconStatus, json: async () => ({}) });
  }
  if (url.startsWith("/api/cards/search")) return ok({ results: [study] });
  if (url === "/api/decks" && method === "POST") {
    return ok({
      deck: { id: "deck-1", publicId: "abcdefgh1234", visibility: "unlisted" },
      claimToken: "token-1",
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
const creates = () => calls((u, m) => u === "/api/decks" && m === "POST");
const puts = () => calls((_u, m) => m === "PUT").length;
const preconGets = () => calls((u) => u.startsWith("/api/precons/")).length;

/** Run the debounces and let the mocked fetch settle. */
async function settle(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
/** deck-editor.test.tsx's pollFor: 50 ms of fake time and one real frame a round, 2 s of real time. */
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

const line = () => document.querySelector<HTMLElement>("[data-slot=precon-changes-line]");
const lineText = () => line()?.querySelector("span")?.textContent ?? null;
const see = () => within(line()!).queryByRole("button", { name: "See changes" });
const marks = () =>
  [...document.querySelectorAll("[data-slot=precon-mark]")].map((m) => ({
    row: m.closest("button")?.querySelector("span")?.textContent,
    name: m.getAttribute("aria-label"),
  }));
const sheet = () => screen.queryByRole("dialog", { name: "Changes from Kozilek Lab" });
const rows = (dialog: HTMLElement, side: "out" | "in") =>
  [...dialog.querySelectorAll<HTMLElement>(`[data-list=${side}] [data-change-row]`)].map((li) =>
    li.textContent!.replace(/\s+/g, " ").trim(),
  );
const section = (label: string) =>
  document.querySelector<HTMLElement>(`section[aria-label="${label}"]`)!;
const undo = () => screen.getAllByRole("button", { name: "Undo" }).at(-1)!;

function draft() {
  return render(
    <DeckEditor
      deckId={null}
      draftGame="mtg"
      draftFormat="commander"
      draftFromSlug="kozilek_lab"
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  deckCards = UPGRADED;
  deckPrecon = { slug: "kozilek_lab", name: "Kozilek Lab", owns: null, cards: PRECON_CARDS };
  preconStatus = 200;
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
  window.history.replaceState(null, "", "/decks/new");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("DeckEditor — changes from the precon on a draft (PRECON-CHANGES)", () => {
  it("a precon draft opens with no POST and no changes: the line under the precon line, no row marked", async () => {
    stubViewport(1440);
    draft();
    await pollFor(line);
    await settle(1500);
    expect(lineText()).toBe("No changes from the precon yet.");
    expect(see()).toBeNull();
    expect(line()!.previousElementSibling?.getAttribute("data-slot")).toBe("precon-line");
    expect(marks()).toEqual([]);
    // The seed's one GET is the only request about the precon, and nothing was written.
    expect(preconGets()).toBe(1);
    expect(writes()).toBe(0);
  });

  it("an edit moves the line and the marks in the same render, and its Undo takes them back", async () => {
    stubViewport(1440);
    draft();
    await pollFor(line);

    // A cut: one copy out, nothing in.
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Divination" }),
    );
    expect(lineText()).toBe("Changed from the precon: 1 out, 0 in.");
    expect(see()).not.toBeNull();
    expect(marks()).toEqual([]);
    // Undo: the list is the precon's again, in the render the Undo lands in.
    fireEvent.click(undo());
    expect(lineText()).toBe("No changes from the precon yet.");
    expect(see()).toBeNull();

    // One more copy of a card the precon holds: only some of the row's copies are beyond it.
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Hedron Archive" }),
    );
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "One more Wastes" }));
    expect(lineText()).toBe("Changed from the precon: 1 out, 1 in.");
    expect(marks()).toEqual([{ row: "Wastes", name: "1 not in the precon" }]);
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "One fewer Wastes" }));
    expect(lineText()).toBe("Changed from the precon: 1 out, 0 in.");
    expect(marks()).toEqual([]);
  });

  it("a swap at 100 cards: one out, one in, the new row marked; the Undo of the swap takes both back", async () => {
    stubViewport(1440);
    draft();
    await pollFor(line);
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "rhystic" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Swap in Rhystic Study…" }));
    const swapIn = await pollFor(() =>
      screen.queryByRole("dialog", { name: "Swap in Rhystic Study" }),
    );
    // Reviewing a swap changes nothing.
    expect(lineText()).toBe("No changes from the precon yet.");
    fireEvent.click(
      within(swapIn).getByRole("button", { name: "Swap Divination for Rhystic Study" }),
    );
    await pollFor(() => (lineText() === "Changed from the precon: 1 out, 1 in." ? true : null));
    expect(marks()).toEqual([{ row: "Rhystic Study", name: "Not in the precon" }]);

    fireEvent.click(undo());
    expect(lineText()).toBe("No changes from the precon yet.");
    expect(marks()).toEqual([]);
  });

  it("the sheet on a draft: both lists from the seed's own cards, with no request, and focus back on See changes", async () => {
    stubViewport(1440);
    draft();
    await pollFor(line);
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Divination" }),
    );
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "One more Wastes" }));
    expect(lineText()).toBe("Changed from the precon: 1 out, 1 in.");
    const before = fetchMock.mock.calls.length;

    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    expect(
      dialog.querySelector("[data-slot=precon-changes-sheet]")!.getAttribute("data-out-state"),
    ).toBe("ready");
    expect(rows(dialog, "out")).toEqual(["Divination"]);
    expect(rows(dialog, "in")).toEqual(["Wastes $0.10"]);
    expect(dialog.querySelector("[data-slot=precon-changes-cost]")!.textContent).toBe(
      "The card to add costs $0.10.",
    );
    // Opening asked nothing: the seed's GET is still the only one about the precon.
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(preconGets()).toBe(1);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await pollFor(() => (sheet() === null ? true : null));
    await pollFor(() => (document.activeElement === see() ? true : null));
  });

  it("the edit that mints the row carries the precon, and no request names the changes", async () => {
    stubViewport(1440);
    draft();
    await pollFor(line);
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "Remove Divination" }),
    );
    await settle(1500);
    await act(async () => {});
    expect(creates()).toHaveLength(1);
    expect(JSON.parse(creates()[0][1].body as string)).toEqual({
      game: "mtg",
      format: "commander",
      name: "Kozilek Lab",
      fromPrecon: "kozilek_lab",
      website: "",
    });
    expect(puts()).toBe(1);
    // Derived, never stored: one create and one PUT, the list alone.
    expect(writes()).toBe(2);
    const put = JSON.parse(calls((_u, m) => m === "PUT")[0][1].body as string) as {
      cards: Record<string, unknown>[];
    };
    expect(Object.keys(put)).toEqual(["cards"]);
    expect(lineText()).toBe("Changed from the precon: 1 out, 0 in.");
  });
});

describe("DeckEditor — changes from the precon on a saved deck (PRECON-CHANGES)", () => {
  function saved() {
    window.history.replaceState(null, "", "/decks/deck-1/edit");
    return render(<DeckEditor deckId="deck-1" />);
  }

  it("after a reload the line and the marks are there with the list, from the deck's own GET", async () => {
    stubViewport(1440);
    saved();
    await pollFor(line);
    // Divination and Hedron Archive out; Rhystic Study and one more Wastes in.
    expect(lineText()).toBe("Changed from the precon: 2 out, 2 in.");
    expect(marks()).toEqual([
      { row: "Rhystic Study", name: "Not in the precon" },
      { row: "Wastes", name: "1 not in the precon" },
    ]);
    await settle(1500);
    expect(preconGets()).toBe(0);
    expect(writes()).toBe(0);
  });

  it("See changes asks ONE GET for the cut cards' names, and opening writes nothing", async () => {
    stubViewport(1440);
    saved();
    await pollFor(line);
    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    await pollFor(() => (rows(dialog, "out").length === 2 ? true : null));
    expect(rows(dialog, "out")).toEqual(["Divination", "Hedron Archive"]);
    expect(rows(dialog, "in")).toEqual(["Rhystic Study $66.76", "Wastes $0.10"]);
    expect(preconGets()).toBe(1);
    expect(calls((u) => u.startsWith("/api/precons/"))[0][0]).toBe("/api/precons/kozilek_lab");
    await settle(1500);
    expect(writes()).toBe(0);
    // The line under the sheet did not move.
    expect(lineText()).toBe("Changed from the precon: 2 out, 2 in.");
  });

  it("a failed GET says so with Try again, which asks once more", async () => {
    stubViewport(1440);
    preconStatus = 500;
    saved();
    await pollFor(line);
    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    const failed = await pollFor(() =>
      dialog.querySelector<HTMLElement>("[data-slot=precon-changes-failed]"),
    );
    expect(failed.textContent).toBe("Couldn't load the precon's cards. Try again");
    // The Add list needs no request.
    expect(rows(dialog, "in")).toEqual(["Rhystic Study $66.76", "Wastes $0.10"]);
    preconStatus = 200;
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    await pollFor(() => (rows(dialog, "out").length === 2 ? true : null));
    expect(preconGets()).toBe(2);
  });

  it("one number: with the precon owned, the sheet's cost is the ownership line's missing", async () => {
    stubViewport(1440);
    deckPrecon = { slug: "kozilek_lab", name: "Kozilek Lab", owns: true, cards: PRECON_CARDS };
    saved();
    await pollFor(line);
    // 66.76 + 0.10 = 66.86, which the line rounds to whole dollars.
    expect(screen.getByTestId("ownership-line").textContent).toBe(
      "You own 98/100 · missing ≈ $67 ·",
    );
    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    expect(dialog.querySelector("[data-slot=precon-changes-cost]")!.textContent).toBe(
      "The cards to add cost $66.86.",
    );
  });

  it("on a phone the sheet is the Drawer, and the line is on the Deck tab", async () => {
    stubViewport(390);
    saved();
    await pollFor(line);
    fireEvent.click(see()!);
    const dialog = await pollFor(sheet);
    expect(dialog.getAttribute("data-slot")).toBe("drawer-popup");
  });

  it("a deck with no precon lineage shows no line, no mark and no sheet", async () => {
    stubViewport(1440);
    deckPrecon = null;
    saved();
    await pollFor(() => screen.queryAllByText("Rhystic Study")[0]);
    await settle(1500);
    expect(line()).toBeNull();
    expect(document.querySelector("[data-slot=precon-line]")).toBeNull();
    expect(marks()).toEqual([]);
    expect(preconGets()).toBe(0);
  });
});
