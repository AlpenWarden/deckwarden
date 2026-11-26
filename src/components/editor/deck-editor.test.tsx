/**
 * DeckEditor in draft mode across the tiers (R4 "done when", REDESIGN.md §5
 * and §7): on a phone the editor opens on Deck; "Add cards" switches to
 * Search and focuses the box; typing previews SILENTLY into the Card panel
 * (no sheet); a row tap opens the card sheet, Escape closes it; tab changes
 * keep the search input's element and value; a tier flip (phone → wide,
 * through matchMedia's change event) keeps the query, the results and the
 * preview and remounts only the tools; and NONE of it — tab changes, the
 * sheet, the md drawer, an appearance change, the flip — calls
 * `POST /api/decks` or leaves the save slot anything but "Saved". The
 * first Enter creates exactly ONE deck, swaps the URL in place, and the
 * autosave PUTs the list once.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { massEntryUrl } from "@/lib/buy/links";
import type { CardWire } from "@/lib/decks/editor-state";
import { card } from "@/lib/games/mtg/test-fixtures";
import { saveAppearance } from "@/lib/theme/appearance";
import { MD_QUERY, WIDE_QUERY } from "./use-tier";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
// AUTOFILL-OWNED: a draft's editor reads the client's session to learn whether
// its player has a collection. A guest unless a test signs someone in, so it
// asks nothing about one and no test depends on the auth client's own request
// (the precedent is src/components/site-header.test.tsx).
const session = vi.hoisted(() => ({
  current: null as { user: { id: string } } | null,
  pending: false,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session.current, isPending: session.pending, error: null }),
  },
}));

import { DeckEditor } from "./deck-editor";

const sol: CardWire = {
  ...card({
    name: "Sol Ring",
    primaryType: "Artifact",
    costValue: 1,
    attrs: { type_line: "Artifact", oracle_text: "", mana_cost: "{1}" },
  }),
  image: "https://cards.scryfall.io/normal/front/8/3/83f43730-1c1f-4150-8771-d901c54bedc4.jpg",
};
const signet: CardWire = {
  ...card({
    name: "Arcane Signet",
    primaryType: "Artifact",
    costValue: 2,
    attrs: { type_line: "Artifact", oracle_text: "", mana_cost: "{2}" },
  }),
  image: null,
};

/** W6: two slim printings rows for Sol Ring (W5's API shape), default first on the wire or not — the pane hoists it. */
const solDefaultPrinting = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  setCode: "cmm",
  setName: "Commander Masters",
  collectorNumber: "410",
  rarity: "uncommon",
  year: 2023,
  isDefault: true,
  hasBack: false,
  usd: "2.89",
  usdFoil: null,
};
const solAltPrinting = {
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  setCode: "sld",
  setName: "Secret Lair Drop",
  collectorNumber: "2783",
  rarity: "rare",
  year: 2024,
  isDefault: false,
  hasBack: false,
  usd: null,
  usdFoil: "12.00",
};

type Listener = () => void;
function stubViewport(width: number) {
  const listeners: { query: string; fn: Listener }[] = [];
  let current = width;
  const matches = (query: string) =>
    query === WIDE_QUERY ? current >= 1200 : query === MD_QUERY ? current >= 768 : false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return matches(query);
      },
      media: query,
      addEventListener: (_: "change", fn: Listener) => {
        listeners.push({ query, fn });
      },
      removeEventListener: (_: "change", fn: Listener) => {
        const i = listeners.findIndex((l) => l.query === query && l.fn === fn);
        if (i >= 0) listeners.splice(i, 1);
      },
      addListener() {},
      removeListener() {},
    })),
  );
  return {
    resize(next: number) {
      current = next;
      for (const { fn } of [...listeners]) fn();
    },
  };
}

const fetchMock = vi.fn();
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Y4a's facts GET: every feed fresh (the route's freshness, as the adapter judges it). */
const FRESH_FACTS = {
  readAt: "2026-10-05T07:00:00.000Z",
  feeds: Object.fromEntries(
    ["gameChangers", "landDenial", "extraTurns", "combos"].map((feed) => [
      feed,
      { state: "ok", asOf: "2026-10-04T15:29:34.768Z" },
    ]),
  ),
};
const factsGets = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/combos/complete?"));

/** The API surface the draft touches: search, the create, the card PUT, the panels. */
function route(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const method = init?.method ?? "GET";
  if (url.startsWith("/api/cards/search")) return ok({ results: [sol, signet] });
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
  if (url === `/api/cards/${sol.id}/printings`) {
    // Newest first like the real route — the pane hoists the default itself.
    return ok({ printings: [solAltPrinting, solDefaultPrinting], total: 2, truncated: false });
  }
  if (url === `/api/cards/${signet.id}/printings`) {
    // The N=1 case: the pane stays honest with a single row.
    return ok({
      printings: [{ ...solDefaultPrinting, id: "aaaaaaaa-0000-4000-8000-000000000003" }],
      total: 1,
      truncated: false,
    });
  }
  return ok({});
}

const posts = () =>
  fetchMock.mock.calls.filter(([url, init]) => url === "/api/decks" && init?.method === "POST")
    .length;
const puts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
    .length;
const printingsFetches = (cardId: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url) === `/api/cards/${cardId}/printings`).length;
const lastPutEntries = (): { cardId: string; printingId?: string }[] => {
  const putCalls = fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
  );
  const body = (putCalls.at(-1)?.[1] as RequestInit).body as string;
  return (JSON.parse(body) as { cards: { cardId: string; printingId?: string }[] }).cards;
};
const saveStatus = () =>
  document.querySelector("[data-slot=save-slot]")?.getAttribute("data-status");
const slot = () => document.querySelector<HTMLElement>("[data-slot=save-slot]")!;
const sheetPopup = () => document.querySelector("[data-slot=drawer-popup]");
const section = (label: string) =>
  document.querySelector<HTMLElement>(`section[aria-label="${label}"]`)!;

/** Run the 200 ms search debounce and let the mocked fetch settle. */
async function settle(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Poll until `query` returns something. RTL's findBy and waitFor hang under
 * this file's faked setTimeout (their poll interval rides it, unadvanced), so
 * each round moves both clocks the editor waits on: 50 ms of fake time (the
 * debounces), then one real animation frame inside act. Base UI opens a menu
 * on the frame after its mousedown and moves a popup's focus on a frame, and
 * jsdom runs frames on a real 60 Hz interval. The bound is real time: 40 bare
 * event-loop turns (89035ab) last ~25 ms on an idle runner, short enough to
 * give up a frame before the menu or the focus lands (CI on 786520b).
 */
async function pollFor<T>(query: () => T | null): Promise<T> {
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

/** A gate a mocked request waits on until the test opens it. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  // Only the two the debounces need: RTL's findBy* and Base UI's frames stay real.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
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
  window.history.replaceState(null, "", "/decks/new?game=mtg");
  // Signed out (AUTOFILL-OWNED): a test that needs a player signs one in.
  session.current = null;
  session.pending = false;
});

afterEach(() => {
  // Unmount while fetch is still the mock: an editor left dirty on a live
  // deck sends its keepalive PUT on unmount (LATER row 161's fix), and
  // setup.ts's cleanup only runs after this hook has unstubbed fetch.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("DeckEditor (draft) across the tiers", () => {
  it("phone → Add cards → silent preview → sheet on tap → tab changes → wide: zero deck creates until the first Enter, then exactly one", async () => {
    const viewport = stubViewport(375);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);

    // Opens on Deck, nothing created, nothing dirty.
    expect(screen.getByRole("tab", { name: /^Deck/ }).getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector("[data-tier]")?.getAttribute("data-tier")).toBe("phone");
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    // Add cards (the summary row's, phone-only) → Search active, the box focused.
    fireEvent.click(screen.getAllByRole("button", { name: "Add cards" })[0]);
    expect(screen.getByRole("tab", { name: "Search" }).getAttribute("aria-selected")).toBe("true");
    const input = screen.getByRole("combobox", { name: "Card search" });
    expect(document.activeElement).toBe(input);

    // Typing previews into the Card panel silently — no sheet.
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    const tools = section("Card detail and suggestions");
    expect(within(tools).getByRole("heading", { name: "Sol Ring" })).toBeTruthy();
    expect(sheetPopup()).toBeNull();
    expect(document.activeElement).toBe(input);

    // A row tap is an explicit inspection: the sheet opens with the card; Escape closes it.
    fireEvent.click(screen.getByRole("option", { name: /Arcane Signet/ }));
    await act(async () => {});
    const sheet = screen.getByRole("dialog", { name: "Arcane Signet" });
    // Two headings by design: the sr-only DrawerTitle and the body's own name.
    expect(within(sheet).getAllByRole("heading", { name: "Arcane Signet" })).toHaveLength(2);
    // U4b: it opens at the half: the actions (a search result: Add) and the
    // card; the text, the tags and the footer's links wait for the full point.
    expect(document.querySelector("[data-slot=sheet-body]")?.getAttribute("data-point")).toBe(
      "half",
    );
    expect(within(sheet).getByRole("button", { name: "Add" })).toBeTruthy();
    expect(within(sheet).queryByRole("link", { name: /Card page/ })).toBeNull();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await act(async () => {});
    expect(sheetPopup()).toBeNull();

    // Tab changes keep the pane mounted, the query, the results.
    fireEvent.click(screen.getByRole("tab", { name: /^Deck/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    expect(screen.getByRole("combobox", { name: "Card search" })).toBe(input);
    expect((input as HTMLInputElement).value).toBe("sol");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    // An appearance change is the reader's, not the deck's.
    act(() => saveAppearance({ backgroundArt: false }));
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    // The tier flip: phone → wide through matchMedia's change event (a live
    // resize, no reload). The input element, its value, the results and the
    // preview survive; the tools mount inline; still nothing created.
    act(() => viewport.resize(1440));
    expect(document.querySelector("[data-tier]")?.getAttribute("data-tier")).toBe("wide");
    expect(screen.getByRole("combobox", { name: "Card search" })).toBe(input);
    expect((input as HTMLInputElement).value).toBe("sol");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(
      within(section("Card detail and suggestions")).getByRole("heading", {
        name: "Arcane Signet",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Suggestions" })).toBeTruthy();
    expect(sheetPopup()).toBeNull();
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    // The first real edit: Enter adds the selected row; the debounce fires
    // ONE create, then the PUT; the URL swaps in place; the box keeps focus.
    // The row tap left Arcane Signet (index 1) selected; ArrowDown wraps to Sol Ring.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("search-result-0");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(saveStatus()).toBe("dirty");
    expect(within(section("Deck list")).getByText("Sol Ring")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^Deck/ }).textContent).toBe("Deck · 1");
    expect(document.activeElement).toBe(input);
    expect(posts()).toBe(0);
    await settle(1100);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(saveStatus()).toBe("saved");
    expect(window.location.pathname).toBe("/decks/deck-1/edit");
    expect(window.localStorage.getItem("deckwarden:deck-token:deck-1")).toBe("token-1");

    // And afterwards: a flip back to the phone, more tab changes, a sheet —
    // still that one create.
    act(() => viewport.resize(375));
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    fireEvent.click(screen.getByRole("tab", { name: /^Deck/ }));
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Sol Ring" }));
    await act(async () => {});
    expect(screen.getByRole("dialog", { name: "Sol Ring" })).toBeTruthy();
    await settle(1100);
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(saveStatus()).toBe("saved");
  });

  it("md: the Tools button and an explicit inspection open the drawer; opening it creates nothing", async () => {
    stubViewport(1024);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    expect(document.querySelector("[data-tier]")?.getAttribute("data-tier")).toBe("md");
    expect(section("Card detail and suggestions").textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    await act(async () => {});
    const drawer = screen.getByRole("dialog", { name: "Tools" });
    expect(within(drawer).getByRole("tab", { name: "Card" })).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close tools" }));
    await act(async () => {});
    expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull();
    // A search-row click reopens it on the Card tab with that card.
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /Arcane Signet/ }));
    await act(async () => {});
    const reopened = screen.getByRole("dialog", { name: "Tools" });
    expect(within(reopened).getByRole("heading", { name: "Arcane Signet" })).toBeTruthy();
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");
  });
});

describe("DeckEditor (a loaded deck) — openCuts by tier", () => {
  /** A 101-card Commander deck: the over-limit action shows, and no leader means no panel fetches. */
  function overLimitDeck() {
    const cards = Array.from({ length: 101 }, (_, i) => {
      const wire: CardWire = {
        ...card({ name: `Filler ${i + 1}`, primaryType: "Artifact", costValue: 2 }),
        image: null,
      };
      return { cardId: wire.id, zone: "main", qty: 1, tags: [], printingId: null, card: wire };
    });
    return {
      deck: {
        id: "deck-9",
        publicId: "zzzzzzzz9999",
        game: "mtg",
        format: "commander",
        name: "Over",
        description: null,
        notes: null,
        visibility: "unlisted",
        isOwner: true,
        forkedFrom: null,
        leaderIds: [],
      },
      cards,
      owned: [],
      hasCollection: false,
    };
  }

  async function renderLoaded(width: number) {
    const viewport = stubViewport(width);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/deck-9" && (init?.method ?? "GET") === "GET") {
        return ok(overLimitDeck());
      }
      return route(input, init);
    });
    render(<DeckEditor deckId="deck-9" />);
    await act(async () => {});
    await act(async () => {});
    return viewport;
  }

  it("phone: 'Over by 1: rank cuts' switches to the Tools pane on the Cuts tab, no sheet, no create", async () => {
    await renderLoaded(375);
    fireEvent.click(screen.getByRole("button", { name: "Over by 1: rank cuts" }));
    expect(screen.getByRole("tab", { name: "Tools" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Cuts" }).getAttribute("aria-selected")).toBe("true");
    expect(sheetPopup()).toBeNull();
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");
  });

  it("md: it opens the tools drawer on the Cuts tab", async () => {
    await renderLoaded(1024);
    expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Over by 1: rank cuts" }));
    await act(async () => {});
    const drawer = screen.getByRole("dialog", { name: "Tools" });
    expect(within(drawer).getByRole("tab", { name: "Cuts" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(posts()).toBe(0);
  });

  it("wide: it flips the inline tab and opens nothing", async () => {
    await renderLoaded(1440);
    fireEvent.click(screen.getByRole("button", { name: "Over by 1: rank cuts" }));
    expect(screen.getByRole("tab", { name: "Cuts" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(posts()).toBe(0);
  });
});

describe("DeckEditor — the phone card sheet (U4b)", () => {
  /** A saved Commander deck, no commander: Sol Ring and Arcane Signet in the main list. */
  function smallDeck() {
    const entry = (wire: CardWire) => ({
      cardId: wire.id,
      zone: "main",
      qty: 1,
      tags: [],
      printingId: null,
      card: wire,
    });
    return {
      deck: {
        id: "deck-7",
        publicId: "yyyyyyyy7777",
        game: "mtg",
        format: "commander",
        name: "Small",
        description: null,
        notes: null,
        visibility: "unlisted",
        isOwner: true,
        forkedFrom: null,
        leaderIds: [],
      },
      cards: [entry(sol), entry(signet)],
      owned: [],
      hasCollection: false,
    };
  }

  async function renderSmall(width = 375) {
    const viewport = stubViewport(width);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/deck-7" && (init?.method ?? "GET") === "GET") {
        return ok(smallDeck());
      }
      return route(input, init);
    });
    render(<DeckEditor deckId="deck-7" />);
    await act(async () => {});
    await act(async () => {});
    return viewport;
  }
  const rowName = (name: string) => within(section("Deck list")).getByRole("button", { name });
  const sheetBody = () => document.querySelector("[data-slot=sheet-body]");
  const writes = () =>
    fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method).length;

  it("a row tap opens it at the half, non-modal; another row's tap while it stays open re-targets it in the same frame; Escape closes it; nothing written", async () => {
    await renderSmall();
    fireEvent.click(rowName("Sol Ring"));
    await act(async () => {});
    const sheet = screen.getByRole("dialog", { name: "Sol Ring" });
    const frame = sheetPopup();
    expect(sheetBody()?.getAttribute("data-point")).toBe("half");
    expect(sheetBody()?.hasAttribute("data-swapped")).toBe(false);
    expect(document.querySelector("[data-slot=drawer-viewport]")?.getAttribute("data-modal")).toBe(
      "false",
    );
    // A card the deck holds: Remove, and Swap… (an artifact Swap Lab offers
    // alternatives for); Add is for a card the deck doesn't hold.
    expect(within(sheet).getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Swap…" })).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: "Add" })).toBeNull();
    // The half shows the card, not its text yet.
    expect(within(sheet).getByRole("img", { name: "Sol Ring" })).toBeTruthy();
    expect(within(sheet).queryByRole("link", { name: /Card page/ })).toBeNull();
    // The deck behind stays live: the next row re-targets the same frame.
    fireEvent.click(rowName("Arcane Signet"));
    await act(async () => {});
    const retargeted = screen.getByRole("dialog", { name: "Arcane Signet" });
    expect(sheetPopup()).toBe(frame);
    expect(sheetBody()?.hasAttribute("data-swapped")).toBe(true);
    expect(sheetBody()?.getAttribute("data-point")).toBe("half");
    fireEvent.keyDown(retargeted, { key: "Escape" });
    await act(async () => {});
    expect(sheetPopup()).toBeNull();
    // Layout, not edits: opening, re-targeting and closing wrote nothing.
    await settle(1500);
    expect(writes()).toBe(0);
    expect(saveStatus()).toBe("saved");
  });

  it("Remove is the row's remove (its toast); the sheet stays on the card and offers Add, the search pane's add; a saved deck PUTs, nothing is created", async () => {
    await renderSmall();
    fireEvent.click(rowName("Sol Ring"));
    await act(async () => {});
    const sheet = screen.getByRole("dialog", { name: "Sol Ring" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Removed Sol Ring")).toBeTruthy();
    expect(within(section("Deck list")).queryByRole("button", { name: "Sol Ring" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Remove" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Swap…" })).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(screen.getByText("Added Sol Ring")).toBeTruthy();
    expect(rowName("Sol Ring")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Sol Ring" })).toBe(sheet);
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(0);
    expect(puts()).toBeGreaterThan(0);
  });

  it("Swap… closes the card sheet and opens Swap Lab's sheet for the card", async () => {
    await renderSmall();
    fireEvent.click(rowName("Sol Ring"));
    await act(async () => {});
    const sheet = screen.getByRole("dialog", { name: "Sol Ring" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Swap…" }));
    await act(async () => {});
    expect(screen.queryByRole("dialog", { name: "Sol Ring" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Swap Sol Ring" })).toBeTruthy();
    expect(posts()).toBe(0);
  });

  it("the phone's Tools pane is one strip, Card first, Analytics and Hand among its tabs; a dealt card opens the sheet and the strip stays on Hand; from wide the strip keeps its four", async () => {
    const viewport = await renderSmall();
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    const strip = screen.getByRole("tablist", { name: "Right pane view" });
    expect(
      within(strip)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Card", "Suggestions", "Combos", "Cuts", "Analytics", "Hand"]);
    // One navigation: no collapsibles stacked above the strip any more.
    const tools = section("Card detail and suggestions");
    expect(within(tools).queryByRole("button", { name: /^Analytics/ })).toBeNull();
    expect(within(tools).queryByRole("button", { name: /Sample hand/ })).toBeNull();
    // The hand: its Draw button lives in the tab; a dealt card is an inspection that keeps the tab.
    const handTab = within(strip).getByRole("tab", { name: "Hand" });
    fireEvent.click(handTab);
    const handPanel = document.getElementById(handTab.getAttribute("aria-controls")!)!;
    fireEvent.click(within(handPanel).getByRole("button", { name: "Draw sample hand" }));
    const dealt = within(handPanel).getAllByRole("button", { name: /Sol Ring|Arcane Signet/ });
    expect(dealt.length).toBeGreaterThan(0);
    fireEvent.click(dealt[0]);
    await act(async () => {});
    expect(sheetPopup()).toBeTruthy();
    expect(handTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(sheetPopup()!, { key: "Escape" });
    await act(async () => {});
    // Analytics as a tab, then a flip to wide: four tabs, Card shown.
    fireEvent.click(within(strip).getByRole("tab", { name: "Analytics" }));
    act(() => viewport.resize(1440));
    const wide = screen.getByRole("tablist", { name: "Right pane view" });
    expect(
      within(wide)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Card", "Suggestions", "Combos", "Cuts"]);
    expect(within(wide).getByRole("tab", { name: "Card" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    // From md the analytics and the hand sit under the deck list again.
    expect(within(section("Deck list")).getByText("Sample hand")).toBeTruthy();
    expect(posts()).toBe(0);
  });

  it("the phone strip starts at its left edge and fades the edge with more tabs past it; the wide list keeps neither (LATER row 244)", () => {
    const viewport = stubViewport(375);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    const strip = screen.getByRole("tablist", { name: "Right pane view" });
    // The list's own justify-center would split an overflow and put half of
    // Card out of reach of the scroll (at 320 px it started at x = -12).
    expect(strip.className).toContain(
      "w-full justify-start gap-0 overflow-x-auto [scrollbar-width:none] scroll-cue-x",
    );
    expect(strip.className).not.toContain("justify-center");
    act(() => viewport.resize(1440));
    const wide = screen.getByRole("tablist", { name: "Right pane view" });
    expect(wide.className).toContain("justify-center");
    expect(wide.className).not.toContain("scroll-cue-x");
  });

  it("globals.css: the scroll cue follows the row's own scroll, 1.5rem a side, only where scroll-driven animations exist (LATER row 244)", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = css.slice(css.indexOf("@supports (animation-timeline: scroll())"));
    expect(rule).toMatch(/^@supports \(animation-timeline: scroll\(\)\) \{\s+\.scroll-cue-x \{/);
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("#000 var(--scroll-cue-start),");
    expect(body).toContain("#000 calc(100% - var(--scroll-cue-end)),");
    // Each declaration at the start of its own line (a renamed property is not the property).
    expect(body).toMatch(
      /\n\s+animation:\s+scroll-cue-start linear both,\s+scroll-cue-end linear both;/,
    );
    expect(body).toMatch(/\n\s+animation-timeline: scroll\(self inline\), scroll\(self inline\);/);
    expect(body).toMatch(/\n\s+animation-range:\s+0 1\.5rem,\s+calc\(100% - 1\.5rem\) 100%;/);
    // The shorthand resets the timeline, so the timeline and the ranges come after it.
    const shorthand = body.search(/\n\s+animation:/);
    expect(body.search(/\n\s+animation-timeline:/)).toBeGreaterThan(shorthand);
    expect(body.search(/\n\s+animation-range:/)).toBeGreaterThan(shorthand);
    // Unregistered or inherited widths would not interpolate, or would leak into the tabs.
    expect(css).toMatch(
      /@property --scroll-cue-start \{\s+syntax: "<length>";\s+inherits: false;\s+initial-value: 0px;\s+\}/,
    );
    expect(css).toMatch(
      /@property --scroll-cue-end \{\s+syntax: "<length>";\s+inherits: false;\s+initial-value: 0px;\s+\}/,
    );
  });

  it("One Piece's phone strip is Card · Analytics · Hand; from wide its single Card panel and heading stay", () => {
    const viewport = stubViewport(375);
    render(<DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" />);
    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    const strip = screen.getByRole("tablist", { name: "Right pane view" });
    expect(
      within(strip)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Card", "Analytics", "Hand"]);
    // An empty deck's Hand tab says what it needs.
    fireEvent.click(within(strip).getByRole("tab", { name: "Hand" }));
    expect(screen.getByText("Add cards to draw a sample hand.")).toBeTruthy();
    act(() => viewport.resize(1440));
    expect(screen.queryByRole("tablist", { name: "Right pane view" })).toBeNull();
    expect(
      within(section("Card detail and suggestions")).getByRole("heading", { name: "Card" }),
    ).toBeTruthy();
  });
});

describe("DeckEditor — a commander add returns the phone to the Deck pane (P2.8b)", () => {
  /** Draft editor with "sol" typed and both results on screen. */
  async function withResults(width: number) {
    stubViewport(width);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    if (width < 768) fireEvent.click(screen.getAllByRole("button", { name: "Add cards" })[0]);
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  }

  it("phone: the row's Commander button adds and switches to the Deck pane · one create", async () => {
    await withResults(375);
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring as Commander" }));
    expect(screen.getByRole("tab", { name: /^Deck/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Search" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: /^Deck/ }).textContent).toBe("Deck · 1");
    expect(screen.getByText("Added Sol Ring as Commander")).toBeTruthy();
    expect(sheetPopup()).toBeNull();
    await settle(1100);
    await act(async () => {});
    expect(posts()).toBe(1);
  });

  it("phone: a plain Add stays on Search so repeated adds keep working", async () => {
    await withResults(375);
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Main deck" }));
    expect(screen.getByRole("tab", { name: "Search" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /^Deck/ }).getAttribute("aria-selected")).toBe("false");
    await settle(1100);
    await act(async () => {});
    expect(posts()).toBe(1);
  });

  it("md: a commander add opens no drawer — the deck is already on screen", async () => {
    await withResults(1024);
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring as Commander" }));
    await act(async () => {});
    expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull();
    expect(within(section("Deck list")).getByText("Sol Ring")).toBeTruthy();
  });

  it("wide: a commander add changes nothing but the deck", async () => {
    await withResults(1440);
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring as Commander" }));
    // The success toast is the one legitimate popup; no Tools drawer, no sheet.
    expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull();
    expect(sheetPopup()).toBeNull();
    expect(within(section("Deck list")).getByText("Sol Ring")).toBeTruthy();
  });
});

describe("DeckEditor — the pane's Printings collapsible (W6, D5)", () => {
  const tools = () => section("Card detail and suggestions");

  /** Wide draft with Sol Ring added (the one create), earlier toasts expired. */
  async function withSolInDeck() {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Main deck" }));
    // Flush the create + PUT and expire the add toast, so the only Undo
    // later on screen is the printing toast's.
    await settle(5500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    return input;
  }

  it("fetches on FIRST open only; row clicks preview without editing; 'Use this printing' is a real autosaved edit with a real Undo", async () => {
    await withSolInDeck();

    // Closed by default, nothing fetched, no count yet.
    const trigger = within(tools()).getByRole("button", { name: /^Printings/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(printingsFetches(sol.id)).toBe(0);

    // First open → ONE request; rows render default-first; the count lands.
    fireEvent.click(trigger);
    await act(async () => {});
    expect(printingsFetches(sol.id)).toBe(1);
    expect(within(tools()).getByRole("button", { name: /Printings · 2/ })).toBeTruthy();
    const rows = within(tools()).getAllByRole("button", { pressed: false });
    const rowNames = rows.map((r) => r.textContent);
    expect(rowNames.some((t) => t?.includes("Commander Masters"))).toBe(true);
    // The default row is marked as what the deck uses (no explicit choice yet).
    expect(
      within(tools()).getByRole("button", { name: /Commander Masters/ }).textContent,
    ).toContain("In deck");
    expect(within(tools()).getByText(/In deck: default printing · CMM #410/)).toBeTruthy();

    // Selecting a row previews it in the pane image — no edit, no save, and
    // the apply button arms only now (the selection differs from the deck).
    const useButton = () =>
      within(tools()).getByRole("button", { name: "Use this printing in deck" });
    expect(useButton()).toHaveProperty("disabled", true);
    fireEvent.click(within(tools()).getByRole("button", { name: /Secret Lair Drop/ }));
    const paneImage = within(tools()).getByRole("img", { name: "Sol Ring" });
    expect(paneImage.getAttribute("src")).toContain(solAltPrinting.id);
    expect(useButton()).toHaveProperty("disabled", false);
    await settle(1100);
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(saveStatus()).toBe("saved");

    // Close and reopen → the per-card cache answers, no second request.
    fireEvent.click(within(tools()).getByRole("button", { name: /Printings · 2/ }));
    await act(async () => {});
    fireEvent.click(within(tools()).getByRole("button", { name: /Printings · 2/ }));
    await act(async () => {});
    expect(printingsFetches(sol.id)).toBe(1);

    // The real edit: dirty → autosave PUTs printingId; toast per D5.
    fireEvent.click(useButton());
    expect(saveStatus()).toBe("dirty");
    const choiceToast = screen
      .getByText("Sol Ring now uses SLD 2783")
      .closest('[data-slot="toast"]');
    expect(choiceToast).toBeTruthy();
    await settle(1100);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toEqual([
      { cardId: sol.id, zone: "main", qty: 1, tags: [], printingId: solAltPrinting.id },
    ]);
    // The pane now marks the chosen row and disables the (unchanged) selection.
    expect(within(tools()).getByText(/In deck: SLD #2783/)).toBeTruthy();
    expect(within(tools()).getByRole("button", { name: /Secret Lair Drop/ }).textContent).toContain(
      "In deck",
    );
    expect(useButton()).toHaveProperty("disabled", true);

    // Undo is a REAL edit: the previous (default) choice re-applies and the
    // next autosave PUTs a list without printingId — never a client rollback.
    fireEvent.click(within(choiceToast as HTMLElement).getByRole("button", { name: "Undo" }));
    expect(saveStatus()).toBe("dirty");
    await settle(1100);
    await act(async () => {});
    expect(puts()).toBe(3);
    expect(lastPutEntries()).toEqual([{ cardId: sol.id, zone: "main", qty: 1, tags: [] }]);
    expect(within(tools()).getByText(/In deck: default printing/)).toBeTruthy();
    expect(posts()).toBe(1);
  });

  it("a previewed card NOT in the deck browses printings honestly at N=1; switching cards and returning reuses the cache", async () => {
    const input = await withSolInDeck();

    // Open Sol Ring's printings once (the deck add left it previewed).
    fireEvent.click(within(tools()).getByRole("button", { name: /^Printings/ }));
    await act(async () => {});
    expect(printingsFetches(sol.id)).toBe(1);

    // Preview Arcane Signet without adding it. Its collapsible is closed
    // (the open state is per card), and opening it is viewer-only.
    fireEvent.change(input, { target: { value: "arcane" } });
    await settle();
    fireEvent.click(screen.getByRole("option", { name: /Arcane Signet/ }));
    await act(async () => {});
    expect(within(tools()).getByRole("heading", { name: "Arcane Signet" })).toBeTruthy();
    const signetTrigger = within(tools()).getByRole("button", { name: /^Printings/ });
    expect(signetTrigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(signetTrigger);
    await act(async () => {});
    expect(printingsFetches(signet.id)).toBe(1);
    expect(within(tools()).getByRole("button", { name: /Printings · 1/ })).toBeTruthy();
    // Viewer only: rows render, but no deck controls and nothing marked.
    expect(within(tools()).queryByText(/In deck/)).toBeNull();
    expect(within(tools()).queryByRole("button", { name: "Use this printing in deck" })).toBeNull();
    // Browsing minted nothing.
    await settle(1100);
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(saveStatus()).toBe("saved");

    // Back on Sol Ring: closed again, and reopening hits the cache — the one
    // request from the top of the test stands (the verify list's item 2).
    fireEvent.change(input, { target: { value: "sol ring" } });
    await settle();
    fireEvent.click(screen.getByRole("option", { name: /Sol Ring/ }));
    await act(async () => {});
    fireEvent.click(within(tools()).getByRole("button", { name: /^Printings/ }));
    await act(async () => {});
    expect(within(tools()).getByText(/In deck: default printing/)).toBeTruthy();
    expect(printingsFetches(sol.id)).toBe(1);
  });

  it("the back goes with the chosen printing: a two-sided printing of Sol Ring brings Flip to the Card tab, and its Undo takes it away (CARD-FLIP-EDITOR)", async () => {
    // Sol Ring's own printing has one face; this Secret Lair one has two.
    const twoSided = { ...solAltPrinting, collectorNumber: "1512", hasBack: true };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === `/api/cards/${sol.id}/printings`
        ? ok({ printings: [twoSided, solDefaultPrinting], total: 2, truncated: false })
        : route(input, init),
    );
    const input = await withSolInDeck();
    const flip = () => within(tools()).queryByRole("button", { name: "Flip" });
    const paneImage = () => within(tools()).getByRole("img", { name: "Sol Ring" });
    expect(flip()).toBeNull();

    // Choose the two-sided printing for the deck.
    fireEvent.click(within(tools()).getByRole("button", { name: /^Printings/ }));
    await act(async () => {});
    fireEvent.click(within(tools()).getByRole("button", { name: /Secret Lair Drop/ }));
    fireEvent.click(within(tools()).getByRole("button", { name: "Use this printing in deck" }));
    const choiceToast = screen
      .getByText("Sol Ring now uses SLD 1512")
      .closest('[data-slot="toast"]');
    await settle(1100);
    await act(async () => {});

    // Leave the row's own preview behind: select Arcane Signet's printing,
    // then come back to Sol Ring from the deck list, so what the pane shows
    // is the card as the editor holds it.
    fireEvent.change(input, { target: { value: "arcane" } });
    await settle();
    fireEvent.click(screen.getByRole("option", { name: /Arcane Signet/ }));
    await act(async () => {});
    expect(flip()).toBeNull();
    fireEvent.click(within(tools()).getByRole("button", { name: /^Printings/ }));
    await act(async () => {});
    fireEvent.click(within(tools()).getByRole("button", { name: /Commander Masters/ }));
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Sol Ring" }));
    await act(async () => {});
    expect(paneImage().getAttribute("src")).toBe(
      `https://cards.scryfall.io/normal/front/a/a/${twoSided.id}.jpg`,
    );
    // The card itself now says it has a back: Flip is there, on the front.
    expect(flip()?.getAttribute("aria-pressed")).toBe("false");

    // Undo re-applies the default printing: the image and the flag go back together.
    fireEvent.click(within(choiceToast as HTMLElement).getByRole("button", { name: "Undo" }));
    await act(async () => {});
    expect(paneImage().getAttribute("src")).toBe(sol.image);
    expect(flip()).toBeNull();
  });
});

describe("DeckEditor — Buy this deck (W7, D6)", () => {
  /** Base UI menu triggers open on the pointer sequence, not a bare click. */
  function openMenu(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
  }

  it("the pane footer gets Buy ↗ and More → Buy this deck… opens the link dialog without writing", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Main deck" }));
    await settle(5500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);

    // The pane footer's Buy ↗ (between the price and the card-page link):
    // the single-card name-search URL, new tab, plain rel while env-dark.
    const pane = section("Card detail and suggestions");
    const buyLink = within(pane).getByRole("link", { name: "Buy" });
    expect(buyLink.getAttribute("href")).toBe(
      "https://www.tcgplayer.com/search/magic/product?q=Sol%20Ring",
    );
    expect(buyLink.getAttribute("target")).toBe("_blank");
    expect(buyLink.getAttribute("rel")).toBe("noopener");

    // More → Buy this deck… → the dialog lists real Mass Entry links.
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Buy this deck…" }));
    const dialog = await pollFor(() => screen.queryByRole("dialog", { name: "Buy this deck" }));
    // Button render={<a/>} keeps role button (W4 gotcha) — real hrefs still.
    const whole = within(dialog).getByRole("button", { name: /Whole deck/ });
    expect(whole.tagName).toBe("A");
    expect(whole.getAttribute("href")).toBe(massEntryUrl("Magic", ["1 Sol Ring"]));
    expect(whole.getAttribute("target")).toBe("_blank");
    expect(within(dialog).getByRole("button", { name: /Without basic lands/ })).toBeTruthy();
    expect(dialog.textContent).toContain(
      "Opens TCGplayer Mass Entry in a new tab · prices via Scryfall, updated daily.",
    );
    // Looking at buy links is never an edit: still one create, one PUT.
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
  });
});

describe("DeckEditor — Start from this precon (W8b)", () => {
  const SEED_PRINTING = "bbbbbbbb-0000-4000-8000-000000000001";
  const commander = card({
    name: "Atraxa, Praetors' Voice",
    primaryType: "Creature",
    isLeaderCandidate: true,
  });
  const preconFiller = Array.from({ length: 99 }, (_, i) =>
    card({ name: `Precon Card ${i + 1}`, primaryType: "Artifact", costValue: 2 }),
  );
  const preconCards = [
    {
      cardId: commander.id,
      zone: "commander",
      qty: 1,
      tags: [],
      printingId: SEED_PRINTING,
      card: { ...commander, image: null },
    },
    ...preconFiller.map((c, i) => ({
      cardId: c.id,
      zone: "main",
      qty: 1,
      tags: [],
      printingId: i === 0 ? "bbbbbbbb-0000-4000-8000-000000000002" : null,
      card: { ...c, image: null },
    })),
  ];
  const preconResponse = {
    precon: {
      slug: "breed_lethality_c16",
      code: "BreedLethality_C16",
      setCode: "C16",
      setName: "Commander 2016",
      releaseDate: "2016-11-11",
      productName: "Breed Lethality",
    },
    deck: {
      publicId: "p_breed_lethality_c16",
      name: "Breed Lethality",
      description: null,
      game: "mtg",
      format: "commander",
      leaderIds: [commander.id],
      ciMask: 23,
    },
    cards: preconCards,
  };

  function preconRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url === "/api/precons/breed_lethality_c16") return ok(preconResponse);
    if (url.startsWith("/api/precons/")) return { ok: false, status: 404, json: async () => ({}) };
    return route(input, init);
  }

  const patches = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) => String(url).startsWith("/api/decks/") && init?.method === "PATCH",
    ).length;

  it("seeds 100 cards WITH the precon's printings and the product name, fires no POST; the first edit = exactly one POST (carrying the name) + one PUT, no PATCH", async () => {
    fetchMock.mockImplementation(preconRoute);
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftFromSlug="breed_lethality_c16"
      />,
    );
    // The seeded commander shows in several places (leader zone, card pane) —
    // any one of them proves the seed landed.
    await pollFor(() => screen.queryAllByText("Atraxa, Praetors' Voice")[0] ?? null);

    // The whole list is on screen, the name is the product's, nothing saved.
    expect(within(section("Deck list")).getByText("Precon Card 1")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Deck name" }) as HTMLInputElement).value).toBe(
      "Breed Lethality",
    );
    await settle(1500);
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    // First real edit: one create carrying the seeded name, one full PUT
    // with the precon's own printingIds intact, and NO meta PATCH. The list
    // is at 100, so search's add is "Swap in…" (Y7b): one card in, one out —
    // opening the sheet is no edit.
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Swap in Sol Ring…" }));
    const swapIn = await pollFor(() => screen.queryByRole("dialog", { name: "Swap in Sol Ring" }));
    await settle(1500);
    expect(posts()).toBe(0);
    fireEvent.click(
      within(swapIn).getByRole("button", { name: "Swap Precon Card 99 for Sol Ring" }),
    );
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(patches()).toBe(0);
    const createBody = JSON.parse(
      fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )![1]!.body as string,
    ) as { name?: string };
    expect(createBody.name).toBe("Breed Lethality");
    const saved = lastPutEntries();
    expect(saved).toHaveLength(100);
    expect(saved.find((e) => e.cardId === commander.id)?.printingId).toBe(SEED_PRINTING);
    expect(saved.filter((e) => e.printingId !== undefined)).toHaveLength(2);
  });

  it("while the precon is on its way the leader zone holds the card's box, the bracket slot is held and the extras wait; the seed fills them (U3a)", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/precons/breed_lethality_c16") await gate;
      return preconRoute(input, init);
    });
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftFromSlug="breed_lethality_c16"
      />,
    );
    const deck = section("Deck list");
    await pollFor(() => deck.querySelector<HTMLElement>("[data-slot=leader-pending]"));
    expect(within(deck).queryByText("No commander yet")).toBeNull();
    expect(within(deck).queryByText("Sample hand")).toBeNull();
    expect(
      deck
        .querySelector("[data-slot=status-slot] [data-slot=bracket-line]")
        ?.getAttribute("data-status"),
    ).toBe("empty");

    release();
    await pollFor(() => within(deck).queryAllByText("Atraxa, Praetors' Voice")[0] ?? null);
    expect(deck.querySelector("[data-slot=leader-pending]")).toBeNull();
    expect(within(deck).getByText("Sample hand")).toBeTruthy();
    await settle(1500);
    expect(posts()).toBe(0);
  });

  it("an unknown from= seeds nothing and SAYS so", async () => {
    fetchMock.mockImplementation(preconRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="nope" />,
    );
    await pollFor(() =>
      screen.queryByText("Couldn't find that precon. Starting an empty deck instead."),
    );
    await settle(1500);
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    expect(screen.queryByText("Precon Card 1")).toBeNull();
  });

  it("a game/format mismatch is treated exactly like an unknown slug", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/precons/breed_lethality_c16") {
        return ok({
          ...preconResponse,
          deck: { ...preconResponse.deck, game: "optcg", format: "standard" },
        });
      }
      return route(input, init);
    });
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftFromSlug="breed_lethality_c16"
      />,
    );
    await pollFor(() =>
      screen.queryByText("Couldn't find that precon. Starting an empty deck instead."),
    );
    expect(screen.queryByText("Atraxa, Praetors' Voice")).toBeNull();
    expect(posts()).toBe(0);
  });
});

describe("DeckEditor — Build around this combo (X3)", () => {
  const kiki = card({
    name: "Kiki-Jiki, Mirror Breaker",
    primaryType: "Creature",
    costValue: 5,
    isLeaderCandidate: true,
    ciMask: 8,
    externalKey: "a34b7416-cfe3-4a1e-a8c1-a3056b747519",
  });
  const conscripts = card({
    name: "Zealous Conscripts",
    primaryType: "Creature",
    costValue: 5,
    ciMask: 8,
    cheapestUsd: 0.35,
    externalKey: "1dae6f39-2cbd-485c-b190-017a26401fd4",
  });
  const tower = card({ name: "Command Tower", primaryType: "Land", costValue: null });
  const comboResponse = {
    combo: {
      id: 106877,
      externalKey: "618-1537",
      results: ["Infinite creature tokens with haste"],
      templates: [],
      popularity: 28185,
      pieces: [
        { id: kiki.id, name: kiki.name, externalKey: kiki.externalKey },
        { id: conscripts.id, name: conscripts.name, externalKey: conscripts.externalKey },
      ],
    },
    cards: [
      { ...kiki, image: null },
      { ...conscripts, image: null },
    ],
  };
  const shellResponse = {
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
            source: "land-template",
            why: "Fills the land template",
            with: [],
            howOften: null,
            confidence: "medium",
          },
        ],
      },
    ],
    groups: [{ id: "base", label: "Lands", picks: 1 }],
    notes: [],
    totals: { picks: 1, estUsd: 0.23, unpriced: 0 },
    issues: [],
    cards: [
      { ...kiki, image: null },
      { ...conscripts, image: null },
      { ...tower, image: null },
    ],
  };

  /** The pair as loadCompleteCombos stores it — complete in any id set holding both pieces. */
  const kikiFacts = {
    key: "618-1537",
    cardPieces: [kiki.id, conscripts.id].sort(),
    templates: [],
    tag: "C",
    relevant: true,
    results: ["Infinite creature tokens with haste"],
    popularity: 28185,
  };
  /** The X3 seed GET (/api/combos/<key>) — never Y4a's facts GET (/api/combos/complete). */
  const comboSeedGets = () =>
    fetchMock.mock.calls.filter(([url]) => /^\/api\/combos\/[0-9]/.test(String(url)));

  function comboRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url === "/api/combos/618-1537") return ok(comboResponse);
    if (url.startsWith("/api/combos/complete?")) {
      const ids = new URL(url, "http://localhost").searchParams.get("ids")!.split(",");
      const held = kikiFacts.cardPieces.every((id) => ids.includes(id));
      return ok({ combos: held ? [kikiFacts] : [], freshness: FRESH_FACTS });
    }
    if (url.startsWith("/api/combos/")) {
      return { ok: false, status: 404, json: async () => ({ error: "Unknown combo" }) };
    }
    if (url === "/api/cards/resolve") {
      return ok({ results: [{ match: { ...kiki, image: null } }] });
    }
    if (url === "/api/decks/autofill") return { ...ok(shellResponse), headers: new Headers() };
    return route(input, init);
  }

  const autofillBodies = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => String(url) === "/api/decks/autofill" && init?.method === "POST")
      .map(
        ([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>,
      );

  it("?leader=&combo=&autofill=1: ONE combo GET seeds the commander and the pieces, and the sheet opens only after they land — its first POST keeps the pieces, never the commander; zero creates", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftLeaderKey={kiki.externalKey}
        draftComboKey="618-1537"
        draftAutofill
      />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 1 card" }));
    const [first, ...rest] = autofillBodies();
    expect(rest).toHaveLength(0);
    expect(first.leaderIds).toEqual([kiki.id]);
    expect(first.keep).toEqual([{ cardId: conscripts.id, zone: "main", qty: 1 }]);
    // One seeder: the combo GET, never the leader seeder's resolve POST.
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === "/api/combos/618-1537"),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === "/api/cards/resolve"),
    ).toHaveLength(0);
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    // The sheet is built around the combo: its title, its lead, the piece pinned first.
    expect(screen.getByRole("dialog", { name: "Build around this combo" })).toBeTruthy();
    expect(
      screen.getByText(
        "Kiki-Jiki, Mirror Breaker + Zealous Conscripts. The rest comes from real decklists and tournament results. Every pick shows why.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Combo pieces · 1")).toBeTruthy();
    // The draft holds the commander in the command zone and the piece in the deck.
    expect(within(section("Deck list")).getAllByText("Zealous Conscripts").length).toBeGreaterThan(
      0,
    );
  });

  const comboDraft = (over: Partial<Parameters<typeof DeckEditor>[0]> = {}) => (
    <DeckEditor
      deckId={null}
      draftGame="mtg"
      draftFormat="commander"
      draftLeaderKey={kiki.externalKey}
      draftComboKey="618-1537"
      {...over}
    />
  );

  it("Apply is ONE edit: one create + one PUT with the commander, the piece and the picks; Undo restores the seeded pair", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(comboDraft({ draftAutofill: true }));
    const apply = await pollFor(() => screen.queryByRole("button", { name: "Add 1 card" }));
    fireEvent.click(apply);
    await pollFor(() => screen.queryByText("Added 1 card"));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(lastPutEntries().map((e) => e.cardId)).toEqual(
      expect.arrayContaining([kiki.id, conscripts.id, tower.id]),
    );
    expect(lastPutEntries()).toHaveLength(3);
    // The sheet is gone (the toast is Base UI's other role="dialog").
    expect(screen.queryByRole("dialog", { name: "Build around this combo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(
      lastPutEntries()
        .map((e) => e.cardId)
        .sort(),
    ).toEqual([kiki.id, conscripts.id].sort());
    expect(posts()).toBe(1);
  });

  it("without ?autofill=1 (a reload keeps `combo`, the chooser strips `autofill`): the pair seeds state-only, no sheet, no POST at all", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(comboDraft());
    await pollFor(
      () => within(section("Deck list")).queryAllByText("Zealous Conscripts")[0] ?? null,
    );
    await settle(1500);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toHaveLength(0);
    expect(saveStatus()).toBe("saved");
  });

  it("no latch, no pin: More → Autofill… on a combo-seeded draft opens the PLAIN sheet — the piece is an ordinary keep there", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(comboDraft());
    await pollFor(
      () => within(section("Deck list")).queryAllByText("Zealous Conscripts")[0] ?? null,
    );
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Autofill…" }));
    await pollFor(() => screen.queryByRole("button", { name: "Add 1 card" }));
    expect(screen.getByRole("dialog", { name: "Autofill a starter shell" })).toBeTruthy();
    expect(screen.queryByText(/Combo pieces/)).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Keep my 1 card" })).toBeTruthy();
    expect(posts()).toBe(0);
  });

  it("an unknown (or since-deleted) key seeds nothing and SAYS so; with ?autofill=1 the sheet degrades to its no-commander sentence, POST-free", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(comboDraft({ draftComboKey: "999-999", draftAutofill: true }));
    await pollFor(() =>
      screen.queryByText("Couldn't find that combo. Starting an empty deck instead."),
    );
    await pollFor(() => screen.queryByText(/Set a commander first/));
    expect(autofillBodies()).toHaveLength(0);
    expect(posts()).toBe(0);
    expect(screen.queryByText("Kiki-Jiki, Mirror Breaker")).toBeNull();
  });

  it("a combo link with no leader seeds nothing and says so — without even asking for the combo", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(comboDraft({ draftLeaderKey: undefined }));
    await pollFor(() =>
      screen.queryByText("That combo link names no commander. Starting an empty deck instead."),
    );
    expect(comboSeedGets()).toHaveLength(0);
    expect(posts()).toBe(0);
  });

  it("a leader that is not one of the combo's pieces — or not a commander — seeds nothing and says so", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    // Zealous Conscripts IS a piece, but it cannot be the commander.
    render(comboDraft({ draftLeaderKey: conscripts.externalKey }));
    await pollFor(() =>
      screen.queryByText(
        "That combo doesn't include that commander. Starting an empty deck instead.",
      ),
    );
    expect(within(section("Deck list")).queryByText("Zealous Conscripts")).toBeNull();
    expect(posts()).toBe(0);
  });

  it("one seeder: a precon (`from`) or a random roll (`surprise`) beats a combo — the combo is never fetched", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/leaders/random")) {
        return ok({ leader: { ...kiki, name: "Rolled Commander", image: null } });
      }
      if (url.startsWith("/api/precons/"))
        return { ok: false, status: 404, json: async () => ({}) };
      return comboRoute(input, init);
    });
    stubViewport(1440);
    const { unmount } = render(comboDraft({ draftFromSlug: "nope" }));
    await pollFor(() =>
      screen.queryByText("Couldn't find that precon. Starting an empty deck instead."),
    );
    unmount();
    render(comboDraft({ draftSurprise: true }));
    await pollFor(() => screen.queryAllByText("Rolled Commander")[0] ?? null);
    expect(comboSeedGets()).toHaveLength(0);
    expect(posts()).toBe(0);
  });

  it("One Piece declares no combos: `combo` is ignored — the leader seeds as if it were absent, no toast", async () => {
    fetchMock.mockImplementation(comboRoute);
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="optcg"
        draftFormat="standard"
        draftLeaderKey="OP15-058"
        draftComboKey="618-1537"
      />,
    );
    // The resolve mock answers Kiki's wire; the point is which seeder ran.
    await pollFor(() => screen.queryAllByText("Kiki-Jiki, Mirror Breaker")[0] ?? null);
    expect(comboSeedGets()).toHaveLength(0);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === "/api/cards/resolve"),
    ).toHaveLength(1);
    expect(screen.queryByText(/combo/i)).toBeNull();
  });

  // ----------------------------------------------------------------- Y4a
  describe("the bracket line (Y4a)", () => {
    const bracketLine = () => document.querySelector<HTMLElement>("[data-slot=bracket-line]");

    it("a combo-seeded draft shows its combo before any save: ONE facts GET keyed by the sorted ids — a GET, zero POSTs — and Why? opens the sheet with it", async () => {
      fetchMock.mockImplementation(comboRoute);
      stubViewport(1440);
      render(comboDraft());
      await pollFor(() =>
        bracketLine()?.textContent === "Bracket: add 98 more cards · 1 combo so far Why?"
          ? bracketLine()
          : null,
      );
      expect(factsGets().map(([url]) => String(url))).toEqual([
        `/api/combos/complete?game=mtg&ids=${[kiki.id, conscripts.id].sort().join(",")}`,
      ]);
      expect((factsGets()[0][1] as RequestInit | undefined)?.method).toBeUndefined();
      expect(
        fetchMock.mock.calls.filter(
          ([, init]) => (init as RequestInit | undefined)?.method === "POST",
        ),
      ).toHaveLength(0);
      expect(saveStatus()).toBe("saved");

      fireEvent.click(screen.getByRole("button", { name: "Why?" }));
      const sheet = await pollFor(() =>
        screen.queryByRole("dialog", { name: "Why this bracket?" }),
      );
      expect(
        within(sheet).getByText(
          "Two-card combo with your commander: Kiki-Jiki, Mirror Breaker + Zealous Conscripts. Brackets 1 and 2 expect none.",
        ),
      ).toBeTruthy();
      expect(
        within(sheet)
          .getByRole("link", { name: /How it works/ })
          .getAttribute("href"),
      ).toBe("https://commanderspellbook.com/combo/618-1537/");
      expect(posts()).toBe(0);
    });

    it("One Piece declares no read: no line and no facts GET, whatever its leader", async () => {
      fetchMock.mockImplementation(comboRoute);
      stubViewport(1440);
      render(
        <DeckEditor
          deckId={null}
          draftGame="optcg"
          draftFormat="standard"
          draftLeaderKey="OP15-058"
        />,
      );
      await pollFor(() => screen.queryAllByText("Kiki-Jiki, Mirror Breaker")[0] ?? null);
      await settle(1500);
      expect(bracketLine()).toBeNull();
      expect(factsGets()).toHaveLength(0);
    });
  });
});

describe("DeckEditor — Autofill review sheet + doors (W9b/W9c)", () => {
  const commander = card({
    name: "Atraxa, Praetors' Voice",
    primaryType: "Creature",
    isLeaderCandidate: true,
    ciMask: 23,
  });
  const tower = card({ name: "Command Tower", primaryType: "Land", costValue: null });
  const wastes = card({ name: "Wastes", primaryType: "Land", costValue: null });
  const templateEvidence = {
    source: "land-template",
    why: "Fills the land template",
    with: [],
    howOften: null,
    confidence: "medium",
  };
  const shellResponse = {
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
        evidence: [templateEvidence],
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
        evidence: [templateEvidence],
      },
    ],
    groups: [{ id: "base", label: "Lands", picks: 12 }],
    notes: [],
    totals: { picks: 12, estUsd: 1.33, unpriced: 0 },
    issues: [],
    cards: [
      { ...commander, image: null },
      { ...tower, image: null },
      { ...wastes, image: null },
    ],
  };

  const autofillPosts = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) => String(url) === "/api/decks/autofill" && init?.method === "POST",
    ).length;

  function autofillRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url === "/api/cards/resolve") {
      return ok({ results: [{ match: { ...commander, image: null } }] });
    }
    if (url === "/api/decks/autofill") {
      return { ...ok(shellResponse), headers: new Headers() };
    }
    return route(input, init);
  }

  it("the EmptyState door needs a commander; Apply = ONE create + ONE PUT on the next autosave; the toast's Undo restores the prior list and autosaves", async () => {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    // The seeded commander arrives state-only; the door renders with it.
    const door = await pollFor(() =>
      screen.queryByRole("button", { name: "Autofill a starter shell" }),
    );
    expect(posts()).toBe(0);

    fireEvent.click(door);
    const apply = await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillPosts()).toBe(1);
    // Loading a shell dirties nothing and mints nothing.
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    fireEvent.click(apply);
    await pollFor(() => screen.queryByText("Added 12 cards"));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    const saved = lastPutEntries();
    expect(saved).toHaveLength(3); // commander + Command Tower + Wastes ×11
    expect(saved.find((e) => e.cardId === commander.id)).toBeTruthy();

    // Undo is a REAL edit: the previous (leader-only) list autosaves back.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toHaveLength(1);
    expect(posts()).toBe(1);
  });

  it("Reroll re-POSTs the shell but never touches the deck — no create, no dirty; closing without applying changes nothing", async () => {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    const door = await pollFor(() =>
      screen.queryByRole("button", { name: "Autofill a starter shell" }),
    );
    fireEvent.click(door);
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));

    fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillPosts()).toBe(2);
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle(1500);
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    expect(within(section("Deck list")).queryByText("Command Tower")).toBeNull();
  });

  // ------------------------------------------------------------ AUTOFILL-TARGET
  const autofillBodies = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => String(url) === "/api/decks/autofill" && init?.method === "POST")
      .map(([, init]) => JSON.parse((init as RequestInit).body as string) as { goals?: unknown });
  const goalsPatches = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/decks/deck-1" && init?.method === "PATCH",
    ).length;
  const autofillDialog = () => screen.queryByRole("dialog", { name: "Autofill a starter shell" });
  const targetChoice = () =>
    within(within(autofillDialog()!).getByRole("group", { name: "Your target" }));
  const pressedTarget = () =>
    targetChoice()
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  /** The draft with its commander, the sheet open on its first shell. */
  async function openDraftSheet() {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
  }
  /** A pick of Your target in the sheet, and the shell it asks for. */
  async function pickTarget(label: string, asks: number) {
    fireEvent.click(targetChoice().getByRole("button", { name: label }));
    await pollFor(() =>
      autofillPosts() === asks ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
  }

  it("AUTOFILL-TARGET: a pick then Add on a draft is ONE create that carries the target and ONE PUT; the toast says both; Undo takes the cards back and leaves the target", async () => {
    await openDraftSheet();
    expect(pressedTarget()).toEqual(["Not set"]);
    await pickTarget("3", 2);
    expect(autofillBodies().map((b) => b.goals)).toEqual([undefined, { v: 1, targetLevel: 3 }]);
    // A pick is the sheet's own: nothing dirtied, nothing minted.
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    fireEvent.click(screen.getByRole("button", { name: "Add 12 cards" }));
    const toastEl = (await pollFor(() => screen.queryByText("Added 12 cards"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent).toBe(
      "Target set: Bracket 3 (Upgraded). Undo takes the cards back, not the target.",
    );
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    const create = JSON.parse(
      fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )![1]!.body as string,
    ) as { goals?: unknown };
    expect(create.goals).toEqual({ v: 1, targetLevel: 3 });
    expect(puts()).toBe(1);
    expect(lastPutEntries()).toHaveLength(3);
    // The create carried the target: no goals PATCH follows it.
    expect(goalsPatches()).toBe(0);

    // Undo is the list's alone: the leader-only list saves back, the target stays.
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toHaveLength(1);
    expect(posts()).toBe(1);
    expect(goalsPatches()).toBe(0);
    // Still the deck's target: the sheet opens on it, with nothing to announce.
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(pressedTarget()).toEqual(["3"]);
    expect(document.querySelector("[data-slot=autofill-target-note]")).toBeNull();
    expect(autofillBodies().at(-1)?.goals).toEqual({ v: 1, targetLevel: 3 });
  });

  it("AUTOFILL-TARGET: opening, picking, rerolling and Cancel write nothing, and the pick is not kept", async () => {
    await openDraftSheet();
    await pickTarget("2", 2);
    expect(document.querySelector("[data-slot=autofill-target-note]")?.textContent).toBe(
      "Adding these cards sets this deck's target to Bracket 2 (Core). A target shows on your share page, in link previews and where the deck is listed.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
    await pollFor(() =>
      autofillPosts() === 3 ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);
    expect(goalsPatches()).toBe(0);
    expect(saveStatus()).toBe("saved");
    // Every write the page made is none: the asks were the shell's POSTs and GETs.
    expect(
      fetchMock.mock.calls
        .map(([url, init]) => [(init as RequestInit | undefined)?.method ?? "GET", String(url)])
        .filter(([method, url]) => method !== "GET" && url !== "/api/decks/autofill")
        .map(([method, url]) => `${method} ${url}`),
    ).toEqual(["POST /api/cards/resolve"]);

    // The sheet forgot the pick: it opens on the deck's target, which is still none.
    fireEvent.click(screen.getByRole("button", { name: "Autofill a starter shell" }));
    await pollFor(() =>
      autofillPosts() === 4 ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
    expect(pressedTarget()).toEqual(["Not set"]);
    expect(autofillBodies().at(-1)?.goals).toBeUndefined();
  });

  it("AUTOFILL-TARGET: Add with no pick on a deck with no target is W9b's Add, word for word: no goals in the create, no second line in the toast", async () => {
    await openDraftSheet();
    fireEvent.click(screen.getByRole("button", { name: "Add 12 cards" }));
    const toastEl = (await pollFor(() => screen.queryByText("Added 12 cards"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent ?? "").toBe("");
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    const create = JSON.parse(
      fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )![1]!.body as string,
    ) as Record<string, unknown>;
    expect("goals" in create).toBe(false);
    expect(goalsPatches()).toBe(0);
  });

  // -------------------------------------------------- AUTOFILL-TOTAL (draft) --
  const totalForm = () =>
    autofillDialog()!.querySelector<HTMLFormElement>("[data-slot=deck-total]")!;
  const pressedTotal = () =>
    within(totalForm())
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);
  const totalsAsked = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => String(url) === "/api/decks/autofill" && init?.method === "POST")
      .map(
        ([, init]) =>
          (JSON.parse((init as RequestInit).body as string) as { totalUsd?: number }).totalUsd,
      );
  /** A preset of Deck total in the sheet, and the list it asks for. */
  async function pickTotal(label: string, asks: number) {
    fireEvent.click(within(totalForm()).getByRole("button", { name: label }));
    await pollFor(() =>
      autofillPosts() === asks ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
  }
  const createGoals = () =>
    (
      JSON.parse(
        fetchMock.mock.calls.find(
          ([url, init]) => url === "/api/decks" && init?.method === "POST",
        )![1]!.body as string,
      ) as { goals?: unknown }
    ).goals;

  it("AUTOFILL-TOTAL: a total then Add on a draft is ONE create that carries the total and ONE PUT; the toast says so; Undo takes the cards back and leaves the total", async () => {
    await openDraftSheet();
    expect(pressedTotal()).toEqual(["Not set"]);
    await pickTotal("$100", 2);
    // The total rides its own field; the goals are as they were (none).
    expect(totalsAsked()).toEqual([undefined, 100]);
    expect(autofillBodies().map((b) => b.goals)).toEqual([undefined, undefined]);
    expect(document.querySelector("[data-slot=autofill-total-note]")?.textContent).toBe(
      "Adding these cards saves $100 as this deck's total. Only you see a deck's total.",
    );
    // A total is the sheet's own until Add: nothing dirtied, nothing minted.
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    fireEvent.click(screen.getByRole("button", { name: "Add 12 cards" }));
    const toastEl = (await pollFor(() => screen.queryByText("Added 12 cards"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent).toBe(
      "Deck total set: $100. Undo takes the cards back, not the total.",
    );
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(createGoals()).toEqual({ v: 1, budget: { totalUsd: 100 } });
    expect(puts()).toBe(1);
    expect(lastPutEntries()).toHaveLength(3);
    // The create carried the total: no goals PATCH follows it.
    expect(goalsPatches()).toBe(0);

    // Undo is the list's alone: the leader-only list saves back, the total stays.
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toHaveLength(1);
    expect(posts()).toBe(1);
    expect(goalsPatches()).toBe(0);
    // Still the deck's total: the sheet opens on it, asks with it, and has nothing to announce.
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(pressedTotal()).toEqual(["$100"]);
    expect(totalsAsked().at(-1)).toBe(100);
    expect(document.querySelector("[data-slot=autofill-total-note]")).toBeNull();
  });

  it("AUTOFILL-TOTAL: a target and a total picked together are ONE goals edit, and the toast names both and what Undo leaves", async () => {
    await openDraftSheet();
    await pickTarget("3", 2);
    await pickTotal("$150", 3);
    expect(autofillBodies().at(-1)?.goals).toEqual({ v: 1, targetLevel: 3 });
    expect(totalsAsked().at(-1)).toBe(150);

    fireEvent.click(screen.getByRole("button", { name: "Add 12 cards" }));
    const toastEl = (await pollFor(() => screen.queryByText("Added 12 cards"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent).toBe(
      "Target set: Bracket 3 (Upgraded). Deck total set: $150. Undo takes the cards back, not the target or the total.",
    );
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(createGoals()).toEqual({ v: 1, targetLevel: 3, budget: { totalUsd: 150 } });
    expect(puts()).toBe(1);
    expect(goalsPatches()).toBe(0);
  });

  it("AUTOFILL-TOTAL: a total set and cleared again, then Cancel, writes nothing and is not kept", async () => {
    await openDraftSheet();
    await pickTotal("$50", 2);
    await pickTotal("Not set", 3);
    expect(totalsAsked()).toEqual([undefined, 50, undefined]);
    await pickTotal("$250", 4);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);
    expect(goalsPatches()).toBe(0);
    expect(saveStatus()).toBe("saved");
    // The sheet forgot it: it opens on the deck's total, which is still none.
    fireEvent.click(screen.getByRole("button", { name: "Autofill a starter shell" }));
    await pollFor(() =>
      autofillPosts() === 5 ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
    expect(pressedTotal()).toEqual(["Not set"]);
    expect(totalsAsked().at(-1)).toBeUndefined();
  });
  // ---------------------------------------------- end AUTOFILL-TOTAL (draft) --

  it("One Piece: no autofill door — the empty state keeps only Add cards (adapter-gated)", async () => {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="optcg"
        draftFormat="standard"
        draftLeaderKey="OP15-058"
      />,
    );
    await pollFor(() => screen.queryAllByText("Atraxa, Praetors' Voice")[0] ?? null);
    expect(screen.queryByRole("button", { name: "Autofill a starter shell" })).toBeNull();
    expect(
      within(section("Deck list")).getAllByRole("button", { name: "Add cards" }).length,
    ).toBeGreaterThan(0);
  });

  it("MTG without a commander: the door waits — Add cards only", async () => {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    await pollFor(() => within(section("Deck list")).queryByText("No cards yet"));
    expect(screen.queryByRole("button", { name: "Autofill a starter shell" })).toBeNull();
  });

  // ------------------------------------------------------------------- W9c
  const anyPosts = () =>
    fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
      .length;

  function surpriseRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url.startsWith("/api/leaders/random")) {
      return ok({ leader: { ...commander, image: null } });
    }
    return autofillRoute(input, init);
  }

  it("Surprise me: the random leader seeds state-only off the GET — literally zero POSTs, no deck row, no sheet", async () => {
    fetchMock.mockImplementation(surpriseRoute);
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftSurprise />);
    await pollFor(() => screen.queryAllByText("Atraxa, Praetors' Voice")[0] ?? null);
    expect(anyPosts()).toBe(0); // the wire rides the GET — no resolve spent
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    expect(screen.queryByRole("dialog")).toBeNull();
    // The seeded commander arms the EmptyState door (the sheet is one click away).
    expect(screen.getByRole("button", { name: "Autofill a starter shell" })).toBeTruthy();
  });

  it("Surprise me on One Piece: a random leader into a normal draft — no sheet, no door, no apology copy", async () => {
    fetchMock.mockImplementation(surpriseRoute);
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" draftSurprise />);
    await pollFor(() => screen.queryAllByText("Atraxa, Praetors' Voice")[0] ?? null);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Autofill a starter shell" })).toBeNull();
    expect(posts()).toBe(0);
  });

  it("?autofill=1 with a leader seed: the sheet opens by itself AFTER the seed lands · one autofill POST, no create, never an auto-apply", async () => {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftLeaderKey="atraxa"
        draftAutofill
      />,
    );
    // No door click anywhere — the latch opens the sheet once the seed settles.
    const apply = await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(apply).toBeTruthy();
    expect(autofillPosts()).toBe(1);
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    // The sheet request was built around the seeded commander.
    expect(screen.getAllByText(/Atraxa, Praetors' Voice/).length).toBeGreaterThan(0);
  });

  it("a crafted bare ?autofill=1 (no leader, no seed): the sheet's honest no-leader sentence, zero autofill POSTs", async () => {
    fetchMock.mockImplementation(autofillRoute);
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftAutofill />);
    await pollFor(() => screen.queryByText(/Set a commander first/));
    expect(autofillPosts()).toBe(0);
    expect(posts()).toBe(0);
  });

  // ------------------------------------------------------------ AUTOFILL-OWNED
  const collectionAsks = () =>
    fetchMock.mock.calls
      .map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url)}`)
      .filter((ask) => ask.includes("/api/collection"));
  const ownedLookups = () =>
    fetchMock.mock.calls
      .filter(([url]) => String(url) === "/api/collection/owned")
      .map(
        ([, init]) => (JSON.parse((init as RequestInit).body as string) as { ids: string[] }).ids,
      );
  const ownedBox = () =>
    within(autofillDialog()!).getByRole("checkbox", {
      name: "Only cards I own",
    }) as HTMLButtonElement;
  const ownedNote = () => document.querySelector<HTMLElement>("[data-slot=autofill-owned-note]");
  const ownershipText = () => screen.queryByTestId("ownership-line")?.textContent ?? null;
  const ownedMarks = () =>
    within(section("Deck list")).queryAllByRole("img", { name: "In your collection" });
  const suggestionsToggle = () => screen.getByTestId("only-owned-toggle") as HTMLButtonElement;
  const BASICS_NOTE = "Basic lands are added as needed and aren't checked against your collection.";
  /** The route's answer to an owned ask: the same picks, its note, and that the filter applied. */
  const ownedShellResponse = { ...shellResponse, notes: [BASICS_NOTE], owned: { applied: true } };
  /**
   * A signed-in player's routes. `collection` answers the editor's one read
   * (a response, or a promise of one); the collection holds Command Tower
   * and nothing else the tests add.
   */
  function collectorRoute(collection: () => unknown) {
    return (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/collection") return collection();
      if (url === "/api/collection/owned") {
        const { ids } = JSON.parse(init!.body as string) as { ids: string[] };
        return ok({ owned: ids.filter((id) => id === tower.id) });
      }
      if (url === "/api/decks/autofill") {
        const body = JSON.parse(init!.body as string) as { ownedOnly?: boolean };
        return {
          ...ok(body.ownedOnly ? ownedShellResponse : shellResponse),
          headers: new Headers(),
        };
      }
      return autofillRoute(input, init);
    };
  }
  const summary = (rows: number) =>
    ok({ summary: { rows, printings: rows, identities: rows, updatedAt: null } });

  it("AUTOFILL-OWNED, a guest's draft: nothing is asked about a collection, the box is disabled with its hint, and Add is W9b's", async () => {
    await openDraftSheet();
    expect(ownedBox().disabled).toBe(true);
    expect(ownedNote()?.textContent).toBe(
      "Sign in and import a collection on your Account page to filter by cards you own",
    );
    expect(autofillBodies()).toEqual([
      { game: "mtg", format: "commander", leaderIds: [commander.id], keep: [] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Add 12 cards" }));
    await pollFor(() => screen.queryByText("Added 12 cards"));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    // No ownership line, no marks, and no request that names a collection or a session.
    expect(ownershipText()).toBeNull();
    expect(ownedMarks()).toHaveLength(0);
    expect(collectionAsks()).toEqual([]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/auth"))).toEqual([]);
  });

  it("AUTOFILL-OWNED, a signed-in collector's draft: ONE collection read; the box waits for it, then ticks; after Add the ownership line and the owned marks show with the list, with no reload", async () => {
    session.current = { user: { id: "user-1" } };
    const gate = deferred();
    fetchMock.mockImplementation(collectorRoute(() => gate.promise.then(() => summary(2400))));
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    // Still checking: disabled, and no hint that would send a collector to import one.
    expect(collectionAsks()).toEqual(["GET /api/collection"]);
    expect(ownedBox().disabled).toBe(true);
    expect(ownedNote()).toBeNull();
    expect(ownershipText()).toBeNull();

    gate.resolve();
    await pollFor(() => (ownedBox().disabled ? null : ownedBox()));
    expect(ownedNote()).toBeNull();
    // The draft knows its player now, before any save: its line shows, for the seeded commander.
    await pollFor(() => (ownedLookups().length === 1 ? true : null));
    expect(ownedLookups()).toEqual([[commander.id]]);
    expect(ownershipText()).toBe("You own 0/1 · missing 1 (no price data) ·");
    // Suggestions' own toggle stays off on a draft and says when it starts (decision 8).
    expect(suggestionsToggle().disabled).toBe(true);
    expect(
      screen.getByText("Filtering by your collection starts once the deck is saved."),
    ).toBeTruthy();

    fireEvent.click(ownedBox());
    await pollFor(() =>
      autofillPosts() === 2 ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
    expect(autofillBodies()).toEqual([
      { game: "mtg", format: "commander", leaderIds: [commander.id], keep: [] },
      { game: "mtg", format: "commander", leaderIds: [commander.id], keep: [], ownedOnly: true },
    ]);
    expect(within(autofillDialog()!).getByText(BASICS_NOTE)).toBeTruthy();
    expect(
      within(autofillDialog()!).getByText("1 of these 12 cards are from your collection."),
    ).toBeTruthy();
    // Ticking and reloading the list wrote nothing.
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    fireEvent.click(screen.getByRole("button", { name: "Add 12 cards" }));
    // In the render the list lands in, before the lookup for the new cards is even sent:
    // Command Tower came from the collection; the commander and the eleven basics are missing.
    expect(ownedLookups()).toHaveLength(1);
    expect(ownershipText()).toBe("You own 1/13 · missing 2 (no price data) ·");
    expect(ownedMarks()).toHaveLength(1);
    await pollFor(() => screen.queryByText("Added 12 cards"));

    await settle(1500);
    await act(async () => {});
    // The deck saved in place (one create, one PUT, the URL swapped), and nothing reloaded.
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(window.location.pathname).toBe("/decks/deck-1/edit");
    // The lookup asked about the new cards once, and agrees.
    expect(ownedLookups()).toHaveLength(2);
    expect(new Set(ownedLookups()[1])).toEqual(new Set([tower.id, wastes.id]));
    expect(ownershipText()).toBe("You own 1/13 · missing 2 (no price data) ·");
    expect(ownedMarks()).toHaveLength(1);
    // One collection read for the whole session of this editor, and the row's toggle is live.
    expect(collectionAsks().filter((ask) => ask === "GET /api/collection")).toHaveLength(1);
    expect(suggestionsToggle().disabled).toBe(false);
  });

  it("AUTOFILL-OWNED, a collector's empty draft: the collection is read once, and no ownership line shows until the list holds a card", async () => {
    session.current = { user: { id: "user-1" } };
    fetchMock.mockImplementation(collectorRoute(() => summary(2400)));
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    await pollFor(() => within(section("Deck list")).queryByText("No cards yet"));
    await settle(1500);
    await act(async () => {});
    expect(collectionAsks()).toEqual(["GET /api/collection"]);
    // Nothing to own yet, so nothing is said (never "You own 0/0") and nothing is looked up.
    expect(ownershipText()).toBeNull();
    expect(ownedLookups()).toHaveLength(0);
    expect(posts()).toBe(0);

    // The first card brings the line with it.
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(ownershipText()).toBe("You own 0/1 · missing 1 (no price data) ·");
  });

  it("AUTOFILL-OWNED, under StrictMode's double mount the collection is still read once, and the draft learns it", async () => {
    session.current = { user: { id: "user-1" } };
    fetchMock.mockImplementation(collectorRoute(() => summary(2400)));
    stubViewport(1440);
    render(
      <StrictMode>
        <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />
      </StrictMode>,
    );
    await pollFor(() => screen.queryByTestId("ownership-line"));
    await settle(1500);
    await act(async () => {});
    expect(collectionAsks().filter((ask) => ask === "GET /api/collection")).toHaveLength(1);
    expect(ownershipText()).toBe("You own 0/1 · missing 1 (no price data) ·");
  });

  it("AUTOFILL-OWNED, a signed-in player with no collection: one read, then the box is disabled with the hint, and nothing else is asked about it", async () => {
    session.current = { user: { id: "user-2" } };
    fetchMock.mockImplementation(collectorRoute(() => summary(0)));
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    await pollFor(() => ownedNote());
    expect(ownedBox().disabled).toBe(true);
    expect(within(ownedNote()!).getByRole("link", { name: "import a collection" })).toBeTruthy();
    await settle(1500);
    expect(collectionAsks()).toEqual(["GET /api/collection"]);
    expect(ownershipText()).toBeNull();
  });

  it("AUTOFILL-OWNED, a collection read that fails: the box is disabled and says it could not check; a session still pending asks nothing yet", async () => {
    session.current = { user: { id: "user-3" } };
    fetchMock.mockImplementation(
      collectorRoute(() => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    stubViewport(1440);
    const first = render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    await pollFor(() => ownedNote());
    expect(ownedBox().disabled).toBe(true);
    expect(ownedNote()?.textContent).toBe("Couldn't check your collection.");
    expect(collectionAsks()).toEqual(["GET /api/collection"]);
    first.unmount();

    // The session has not answered yet: checking, and no collection read until it names a player.
    fetchMock.mockClear();
    session.current = null;
    session.pending = true;
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftLeaderKey="atraxa" />,
    );
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(ownedBox().disabled).toBe(true);
    expect(ownedNote()).toBeNull();
    expect(collectionAsks()).toEqual([]);
  });

  // ----------------------------------------------------------- COLLECTION-PAGE
  // "Build from my collection" on /collection is the new-deck link with
  // ?autofill=1 and ?owned=1 (`draftAutofill` + `draftOwned`): the latched
  // sheet opens with "Only cards I own" ticked, and its ONE opening request
  // waits for the editor's collection read so it already carries the flag.
  const boxTicked = () => ownedBox().getAttribute("aria-checked") === "true";
  const PLAIN_ASK = { game: "mtg", format: "commander", leaderIds: [commander.id], keep: [] };
  function buildFromCollection() {
    stubViewport(1440);
    return render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftLeaderKey="atraxa"
        draftAutofill
        draftOwned
      />,
    );
  }

  it("COLLECTION-PAGE, a collector's Build from my collection: the sheet opens ticked and asks nothing until the collection read answers, then ONE autofill POST carrying the flag; no deck is created", async () => {
    session.current = { user: { id: "user-1" } };
    const gate = deferred();
    fetchMock.mockImplementation(collectorRoute(() => gate.promise.then(() => summary(2400))));
    buildFromCollection();

    // The latch opens the sheet once the commander has seeded: no door was pressed.
    await pollFor(() => autofillDialog());
    await settle(400);
    expect(collectionAsks()).toEqual(["GET /api/collection"]);
    // Still checking: ticked, not yet pressable, and not one Autofill request.
    expect(boxTicked()).toBe(true);
    expect(ownedBox().disabled).toBe(true);
    expect(autofillPosts()).toBe(0);
    expect(within(autofillDialog()!).getByLabelText("Building the shell…")).toBeTruthy();

    gate.resolve();
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([{ ...PLAIN_ASK, ownedOnly: true }]);
    expect(boxTicked()).toBe(true);
    expect(ownedBox().disabled).toBe(false);
    expect(within(autofillDialog()!).getByText(BASICS_NOTE)).toBeTruthy();
    expect(
      within(autofillDialog()!).getByText("1 of these 12 cards are from your collection."),
    ).toBeTruthy();

    await settle(400);
    // One request for the whole open, and opening wrote nothing.
    expect(autofillPosts()).toBe(1);
    expect(posts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    expect(collectionAsks().filter((ask) => ask === "GET /api/collection")).toHaveLength(1);
  });

  it("COLLECTION-PAGE, the collection already known when the sheet opens: ONE autofill POST, with the flag", async () => {
    session.current = { user: { id: "user-1" } };
    // The commander's seed is slower than the collection read.
    const seed = deferred();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === "/api/cards/resolve"
        ? seed.promise.then(() => collectorRoute(() => summary(2400))(input, init))
        : collectorRoute(() => summary(2400))(input, init),
    );
    buildFromCollection();
    await pollFor(() => (collectionAsks().length === 1 ? true : null));
    await settle(300);
    expect(autofillDialog()).toBeNull();
    seed.resolve();

    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([{ ...PLAIN_ASK, ownedOnly: true }]);
    expect(boxTicked()).toBe(true);
    await settle(400);
    expect(autofillPosts()).toBe(1);
  });

  it("COLLECTION-PAGE, the tick belongs to the sheet the link opened: after Cancel the door opens a plain sheet, unticked, with a plain ask", async () => {
    session.current = { user: { id: "user-1" } };
    fetchMock.mockImplementation(collectorRoute(() => summary(2400)));
    buildFromCollection();
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([{ ...PLAIN_ASK, ownedOnly: true }]);

    fireEvent.click(within(autofillDialog()!).getByRole("button", { name: "Cancel" }));
    await pollFor(() => (autofillDialog() ? null : true));
    fireEvent.click(
      await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" })),
    );
    await pollFor(() =>
      autofillPosts() === 2 ? screen.queryByRole("button", { name: "Add 12 cards" }) : null,
    );
    expect(autofillBodies()[1]).toEqual(PLAIN_ASK);
    expect(boxTicked()).toBe(false);
    expect(ownedBox().disabled).toBe(false);
    // Nothing reopened by itself, and nothing was saved.
    await settle(400);
    expect(autofillPosts()).toBe(2);
    expect(posts()).toBe(0);
  });

  it("COLLECTION-PAGE, the same link opened by a guest: the sheet opens with the box unticked and its hint, ONE plain POST, nothing asked about a collection and nothing refused", async () => {
    // A route that would refuse an owned ask, as the real one refuses a guest's.
    const statuses: number[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/autofill") {
        const body = JSON.parse(init!.body as string) as { ownedOnly?: boolean };
        statuses.push(body.ownedOnly ? 401 : 200);
        if (body.ownedOnly) {
          return { ok: false, status: 401, headers: new Headers(), json: async () => ({}) };
        }
      }
      return autofillRoute(input, init);
    });
    buildFromCollection();
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([PLAIN_ASK]);
    expect(statuses).toEqual([200]);
    expect(boxTicked()).toBe(false);
    expect(ownedBox().disabled).toBe(true);
    expect(ownedNote()?.textContent).toBe(
      "Sign in and import a collection on your Account page to filter by cards you own",
    );
    // No error, no Retry: the full list, as any guest's sheet shows it.
    expect(within(autofillDialog()!).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(autofillDialog()!.querySelector(".text-destructive")).toBeNull();
    await settle(400);
    expect(autofillPosts()).toBe(1);
    expect(collectionAsks()).toEqual([]);
    expect(posts()).toBe(0);
  });

  it("COLLECTION-PAGE, the link followed by a signed-in player with no collection: one collection read, then ONE plain POST; unticked with the hint", async () => {
    session.current = { user: { id: "user-2" } };
    const gate = deferred();
    fetchMock.mockImplementation(collectorRoute(() => gate.promise.then(() => summary(0))));
    buildFromCollection();
    await pollFor(() => autofillDialog());
    await settle(400);
    // Waiting for the answer, like a collector's.
    expect(autofillPosts()).toBe(0);

    gate.resolve();
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([PLAIN_ASK]);
    expect(boxTicked()).toBe(false);
    expect(ownedBox().disabled).toBe(true);
    expect(within(ownedNote()!).getByRole("link", { name: "import a collection" })).toBeTruthy();
    expect(autofillDialog()!.querySelector(".text-destructive")).toBeNull();
    await settle(400);
    expect(autofillPosts()).toBe(1);
    expect(collectionAsks()).toEqual(["GET /api/collection"]);
  });

  it("COLLECTION-PAGE, a collection read that fails under the link: ONE plain POST, and the box says it could not check", async () => {
    session.current = { user: { id: "user-3" } };
    fetchMock.mockImplementation(
      collectorRoute(() => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    buildFromCollection();
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([PLAIN_ASK]);
    expect(boxTicked()).toBe(false);
    expect(ownedNote()?.textContent).toBe("Couldn't check your collection.");
    await settle(400);
    expect(autofillPosts()).toBe(1);
  });

  it("COLLECTION-PAGE, a collector on a plain starter-shell link (?autofill=1 alone, the hubs'): the latched sheet opens unticked, with a plain ask", async () => {
    session.current = { user: { id: "user-1" } };
    fetchMock.mockImplementation(collectorRoute(() => summary(2400)));
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftLeaderKey="atraxa"
        draftAutofill
      />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    await pollFor(() => (ownedBox().disabled ? null : ownedBox()));
    expect(autofillBodies()).toEqual([PLAIN_ASK]);
    expect(boxTicked()).toBe(false);
    await settle(400);
    expect(autofillPosts()).toBe(1);
  });

  it("COLLECTION-PAGE, ?owned=1 without ?autofill=1 opens nothing: the commander seeds, no sheet, no Autofill request", async () => {
    session.current = { user: { id: "user-1" } };
    fetchMock.mockImplementation(collectorRoute(() => summary(2400)));
    stubViewport(1440);
    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftLeaderKey="atraxa"
        draftOwned
      />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Autofill a starter shell" }));
    await settle(400);
    expect(autofillDialog()).toBeNull();
    expect(autofillPosts()).toBe(0);
    // The door still opens the plain sheet, unticked.
    fireEvent.click(screen.getByRole("button", { name: "Autofill a starter shell" }));
    await pollFor(() => screen.queryByRole("button", { name: "Add 12 cards" }));
    expect(autofillBodies()).toEqual([PLAIN_ASK]);
    expect(boxTicked()).toBe(false);
  });
});

// ------------------------------------------------------------------- Y2a
describe("DeckEditor — an honest first screen (Y2a)", () => {
  const atraxa = card({
    name: "Atraxa, Praetors' Voice",
    primaryType: "Creature",
    isLeaderCandidate: true,
  });
  const extras = Array.from({ length: 3 }, (_, i) =>
    card({ name: `Seed Card ${i + 1}`, primaryType: "Artifact", costValue: 2 }),
  );
  const seedResponse = {
    deck: { name: "Tiny Precon", game: "mtg", format: "commander", leaderIds: [atraxa.id] },
    cards: [
      {
        cardId: atraxa.id,
        zone: "commander",
        qty: 1,
        tags: [],
        printingId: null,
        card: { ...atraxa, image: null },
      },
      ...extras.map((c) => ({
        cardId: c.id,
        zone: "main",
        qty: 1,
        tags: [],
        printingId: null,
        card: { ...c, image: null },
      })),
    ],
  };
  function seedRoute(input: RequestInfo | URL, init?: RequestInit) {
    if (String(input) === "/api/precons/tiny") return ok(seedResponse);
    return route(input, init);
  }
  const progressLine = () =>
    section("Deck list").querySelector<HTMLElement>('[data-slot="progress-line"]');

  it("a fresh Magic draft: Draft (no check, data-draft), the progress line, no View / Group / Sort, one Add cards; the first edit ends the draft with one create", async () => {
    stubViewport(375);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    expect(saveStatus()).toBe("saved");
    expect(slot().dataset.draft).toBe("true");
    expect(slot().textContent).toBe("Draft");
    expect(slot().getAttribute("title")).toBe("Saves on your first change");
    expect(slot().querySelector("svg")).toBeNull();
    expect(progressLine()?.textContent).toBe("Choose a commander · 100 to go");
    // U4a: the count is its own span inside the label; the label's words are unchanged.
    expect(section("Deck list").querySelector("[data-slot=deck-size]")?.textContent).toBe(
      "0 / 100 · 100 to go",
    );
    // Progress is not a problem: no red count, and never the approval line.
    expect(within(section("Deck list")).queryByRole("button", { name: /problem/ })).toBeNull();
    expect(screen.queryByText(/The Warden approves/)).toBeNull();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sort" })).toBeNull();
    expect(within(section("Deck list")).getAllByRole("button", { name: "Add cards" })).toHaveLength(
      1,
    );
    // An unseeded draft has nothing to keep.
    expect(screen.queryByRole("button", { name: "Keep this deck" })).toBeNull();

    // The first real edit: Unsaved…, then one create, and the draft is over.
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Add cards" }));
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(slot().textContent).toBe("Unsaved…");
    await settle(1100);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(saveStatus()).toBe("saved");
    expect(slot().hasAttribute("data-draft")).toBe(false);
    expect(slot().textContent).toBe("Saved");
    expect(slot().querySelector("svg")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^Deck/ }));
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(progressLine()?.textContent).toBe("Choose a commander · 99 to go");
  });

  it("One Piece says its own progress through its adapter", () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" />);
    expect(slot().textContent).toBe("Draft");
    expect(progressLine()?.textContent).toBe("Choose a leader · 50 to go");
    expect(section("Deck list").querySelector("[data-slot=deck-size]")?.textContent).toBe(
      "0 / 50 · 50 to go",
    );
  });

  it("a precon draft offers Keep this deck: one click = exactly one create + one PUT, then Share", async () => {
    fetchMock.mockImplementation(seedRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="tiny" />,
    );
    const keep = await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    expect(slot().textContent).toBe("Draft");
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    expect(progressLine()?.textContent).toBe("96 to go");
    await settle(1500);
    expect(posts()).toBe(0);

    fireEvent.click(keep);
    // Gone at once — the slot leaves "saved", so a second click has nothing to press.
    expect(screen.queryByRole("button", { name: "Keep this deck" })).toBeNull();
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(lastPutEntries()).toHaveLength(4);
    expect(window.location.pathname).toBe("/decks/deck-1/edit");
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keep this deck" })).toBeNull();
    expect(slot().hasAttribute("data-draft")).toBe(false);
  });

  it("on a phone Group · Sort folds the controls (U4a); a flip to wide brings the inline row back, nothing created; Appearance is nowhere in the editor at either tier — the site header's is the one (2026-10-17)", async () => {
    fetchMock.mockImplementation(seedRoute);
    const viewport = stubViewport(375);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="tiny" />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    // The bar: no Appearance button on the phone, and More carries no group either
    // (U4a's phone group left with the site header's arrival above the editor).
    expect(screen.queryByRole("button", { name: "Appearance" })).toBeNull();
    const more = screen.getByRole("button", { name: "More" });
    fireEvent.pointerDown(more, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(more, { button: 0 });
    fireEvent.click(more, { button: 0 });
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    expect(within(menu).queryByRole("group", { name: "Appearance" })).toBeNull();
    expect(within(menu).queryByRole("menuitemradio")).toBeNull();
    fireEvent.keyDown(menu, { key: "Escape" });
    await pollFor(() => (screen.queryByRole("menu") ? null : document.body));
    // The deck pane: View, then the Group · Sort trigger; Group and Sort wait inside it.
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Group · Sort" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Group" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sort" })).toBeNull();

    // The tier flip: the inline row comes back; still no Appearance control in the editor.
    act(() => viewport.resize(1440));
    expect(screen.queryByRole("button", { name: "Appearance" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Group · Sort" })).toBeNull();
    expect(screen.getByRole("group", { name: "Group" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sort" })).toBeTruthy();
    expect(posts()).toBe(0);
  });

  it("removing a card toasts Removed X · Undo; Undo restores it (quantity, position) and autosaves", async () => {
    fetchMock.mockImplementation(seedRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="tiny" />,
    );
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" })));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    await settle(5500); // the slate is clean: no earlier toast on screen

    const list = section("Deck list");
    fireEvent.click(within(list).getByRole("button", { name: "One more Seed Card 2" }));
    fireEvent.click(within(list).getByRole("button", { name: "Remove Seed Card 2" }));
    expect(within(list).queryByText("Seed Card 2")).toBeNull();
    // Two edits inside the debounce send nothing yet — before LATER row 161's
    // fix, a per-render keepalive flush PUT each one at once.
    expect(puts()).toBe(1);
    const toastEl = (await pollFor(() => screen.queryByText("Removed 2× Seed Card 2"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    await settle(1500);
    await act(async () => {});
    expect(saveStatus()).toBe("saved");
    expect(puts()).toBe(2);
    expect(lastPutEntries().some((e) => e.cardId === extras[1].id)).toBe(false);

    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    expect(within(list).getByText("Seed Card 2")).toBeTruthy();
    expect(saveStatus()).toBe("dirty");
    await settle(1500);
    await act(async () => {});
    expect(saveStatus()).toBe("saved");
    expect(posts()).toBe(1);
    expect(puts()).toBe(3);
    const restored = lastPutEntries() as { cardId: string; qty?: number }[];
    expect(restored.map((e) => e.cardId)).toEqual([atraxa.id, ...extras.map((c) => c.id)]);
    expect(restored[2].qty).toBe(2);
  });

  it("a stepper reaching zero is a removal with the same Undo", async () => {
    fetchMock.mockImplementation(seedRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="tiny" />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    const list = section("Deck list");
    fireEvent.click(within(list).getByRole("button", { name: "One fewer Seed Card 3" }));
    expect(within(list).queryByText("Seed Card 3")).toBeNull();
    const toastEl = (await pollFor(() => screen.queryByText("Removed Seed Card 3"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    expect(within(list).getByText("Seed Card 3")).toBeTruthy();
  });
});

describe("DeckEditor — autosave on a saved deck (LATER row 161)", () => {
  /** A hydrated two-card deck: no leader, so no panel fetches. */
  async function renderSaved() {
    stubViewport(1440);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
        return ok({
          deck: {
            id: "deck-1",
            publicId: "abcdefgh1234",
            game: "mtg",
            format: "commander",
            name: "Saved",
            description: null,
            notes: null,
            visibility: "unlisted",
            isOwner: true,
            forkedFrom: null,
            leaderIds: [],
          },
          cards: [sol, signet].map((c) => ({
            cardId: c.id,
            zone: "main",
            qty: 1,
            tags: [],
            printingId: null,
            card: c,
          })),
          owned: [],
          hasCollection: false,
        });
      }
      return route(input, init);
    });
    const view = render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    return view;
  }
  const list = () => section("Deck list");
  const writes = (method: "PUT" | "PATCH") =>
    fetchMock.mock.calls
      .map(([, init]) => init as RequestInit | undefined)
      .filter((init) => init?.method === method) as RequestInit[];

  it("two quick edits are ONE PUT, a full debounce after the last — never one per edit", async () => {
    await renderSaved();
    fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
    await settle(500);
    fireEvent.click(within(list()).getByRole("button", { name: "One more Arcane Signet" }));
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("dirty");
    await settle(999);
    expect(puts()).toBe(0);
    await settle(1);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(writes("PUT")[0].keepalive).toBeUndefined();
    expect(
      (lastPutEntries() as { cardId: string; qty: number }[]).map((e) => [e.cardId, e.qty]),
    ).toEqual([
      [sol.id, 2],
      [signet.id, 2],
    ]);
    expect(saveStatus()).toBe("saved");
  });

  it("typing a name is ONE PATCH after the debounce, never one per keystroke", async () => {
    await renderSaved();
    const name = screen.getByRole("textbox", { name: "Deck name" });
    for (const value of ["Saved!", "Saved!!", "Saved!!!"]) {
      fireEvent.change(name, { target: { value } });
    }
    expect(writes("PATCH")).toHaveLength(0);
    await settle(1100);
    await act(async () => {});
    expect(writes("PATCH")).toHaveLength(1);
    expect(JSON.parse(writes("PATCH")[0].body as string)).toMatchObject({ name: "Saved!!!" });
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("saved");
  });

  it("closing the tab mid-debounce flushes ONE keepalive PUT; the debounce then has nothing left to send", async () => {
    await renderSaved();
    fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
    expect(puts()).toBe(0);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(puts()).toBe(1);
    expect(writes("PUT")[0].keepalive).toBe(true);
    await settle(1100);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(saveStatus()).toBe("saved");
  });

  it("leaving the editor mid-debounce (an unmount) flushes ONE keepalive PUT", async () => {
    const view = await renderSaved();
    fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
    expect(puts()).toBe(0);
    view.unmount();
    expect(puts()).toBe(1);
    expect(writes("PUT")[0].keepalive).toBe(true);
    await settle(1100);
    expect(puts()).toBe(1);
  });

  // ---------------------------------------------------- LATER row 163
  describe("a page that dies without pagehide, a save in flight, a failed copy (LATER row 163)", () => {
    afterEach(() => {
      Reflect.deleteProperty(document, "visibilityState");
    });
    /** The Page Lifecycle's last reliable event on a phone: the tab goes hidden. */
    function setVisibility(state: "hidden" | "visible") {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    /** renderSaved's routes, with the PUTs answered by `put` instead. */
    async function renderWithPuts(put: (init: RequestInit) => unknown) {
      const view = await renderSaved();
      const base = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT" ? put(init) : base(input, init),
      );
      return view;
    }
    const solQty = (i: number) =>
      (
        JSON.parse(writes("PUT")[i].body as string) as { cards: { cardId: string; qty: number }[] }
      ).cards.find((e) => e.cardId === sol.id)?.qty;
    const failed = { ok: false, status: 503, json: async () => ({}) };

    it("hiding the tab mid-debounce sends ONE keepalive PUT; the debounce then has nothing left to send", async () => {
      await renderSaved();
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      expect(puts()).toBe(0);
      setVisibility("hidden");
      // Before the fix: nothing — a phone OS discarding the hidden tab lost it.
      expect(puts()).toBe(1);
      expect(writes("PUT")[0].keepalive).toBe(true);
      expect(solQty(0)).toBe(2);
      setVisibility("visible");
      await settle(1100);
      await act(async () => {});
      expect(puts()).toBe(1);
      expect(saveStatus()).toBe("saved");
    });

    it("hiding or showing an untouched deck sends nothing", async () => {
      await renderSaved();
      const reads = fetchMock.mock.calls.length;
      setVisibility("hidden");
      setVisibility("visible");
      setVisibility("hidden");
      await settle(1100);
      expect(fetchMock.mock.calls.length).toBe(reads);
      expect(saveStatus()).toBe("saved");
    });

    it("a tab closed while the debounced PUT is in flight sends a keepalive copy of that list", async () => {
      const inFlight = deferred();
      await renderWithPuts((init) =>
        init.keepalive ? ok({}) : inFlight.promise.then(() => ok({})),
      );
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      await settle(1100);
      expect(puts()).toBe(1);
      expect(saveStatus()).toBe("saving");
      act(() => {
        window.dispatchEvent(new Event("pagehide"));
      });
      // Before the fix: flush had cleared the dirty flag, so the request in
      // flight was the only copy.
      expect(puts()).toBe(2);
      expect(writes("PUT")[1].keepalive).toBe(true);
      expect(writes("PUT")[1].body).toBe(writes("PUT")[0].body);
      await act(async () => {
        inFlight.resolve();
      });
      await settle(1100);
      expect(puts()).toBe(2);
      expect(saveStatus()).toBe("saved");
    });

    it("a failed pagehide copy is not silent: back from the back/forward cache, the debounce sends the list again", async () => {
      await renderWithPuts((init) => (init.keepalive ? failed : ok({})));
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      act(() => {
        window.dispatchEvent(new Event("pagehide"));
      });
      expect(puts()).toBe(1);
      await act(async () => {});
      // The page comes back (pageshow, persisted) and its timers run on.
      await settle(1100);
      await act(async () => {});
      // Before the fix: the baseline had moved before the 503, so the
      // debounce saw nothing to send and the slot said "Saved".
      expect(puts()).toBe(2);
      expect(writes("PUT")[1].keepalive).toBeUndefined();
      expect(solQty(1)).toBe(2);
      expect(saveStatus()).toBe("saved");
    });

    it("a hidden copy lost to the network leaves its diff for the next save", async () => {
      await renderWithPuts((init) =>
        init.keepalive ? Promise.reject(new TypeError("Failed to fetch")) : ok({}),
      );
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      setVisibility("hidden");
      expect(puts()).toBe(1);
      setVisibility("visible");
      await settle(1100);
      await act(async () => {});
      expect(puts()).toBe(2);
      expect(writes("PUT")[1].keepalive).toBeUndefined();
      expect(saveStatus()).toBe("saved");
    });

    it("a save after a hidden copy waits for its answer, so a newer list never races an older copy", async () => {
      const kept = deferred();
      await renderWithPuts((init) => (init.keepalive ? kept.promise.then(() => ok({})) : ok({})));
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      setVisibility("hidden");
      setVisibility("visible");
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      await settle(1100);
      await act(async () => {});
      expect(puts()).toBe(1); // the debounce fired, and waits on the copy
      expect(saveStatus()).toBe("saving");
      await act(async () => {
        kept.resolve();
      });
      await act(async () => {});
      expect(puts()).toBe(2);
      expect(writes("PUT")[1].keepalive).toBeUndefined();
      expect([solQty(0), solQty(1)]).toEqual([2, 3]);
      expect(saveStatus()).toBe("saved");
    });

    it("…but never forever: a copy that never answers holds the next save 10 s at most", async () => {
      await renderWithPuts((init) => (init.keepalive ? new Promise(() => {}) : ok({})));
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      setVisibility("hidden");
      setVisibility("visible");
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      await settle(1000); // the debounce fires; its save starts to wait
      expect(saveStatus()).toBe("saving");
      await settle(9900);
      expect(puts()).toBe(1);
      await settle(100);
      await act(async () => {});
      expect(puts()).toBe(2);
      expect(writes("PUT")[1].keepalive).toBeUndefined();
      expect(solQty(1)).toBe(3);
      expect(saveStatus()).toBe("saved");
      // Waited out once: the next edit saves a plain debounce later.
      fireEvent.click(within(list()).getByRole("button", { name: "One more Sol Ring" }));
      await settle(1000);
      await act(async () => {});
      expect(puts()).toBe(3);
      expect(solQty(2)).toBe(4);
    });
  });
});

// ------------------------------------------------------------------- Y2b
describe("DeckEditor — start doors, draft Suggestions, the first approval (Y2b)", () => {
  const kozilek: CardWire = {
    ...card({
      name: "Kozilek, the Great Distortion",
      primaryType: "Creature",
      costValue: 10,
      isLeaderCandidate: true,
      attrs: { type_line: "Legendary Creature — Eldrazi", oracle_text: "" },
    }),
    image: null,
  };
  const wastes: CardWire = {
    ...card({
      name: "Wastes",
      primaryType: "Land",
      costValue: null,
      attrs: { type_line: "Basic Land — Wastes", oracle_text: "" },
    }),
    image: null,
  };
  /** A legal colorless Commander list: Kozilek + `n` Wastes. */
  const cardsOf = (n: number) => [
    { cardId: kozilek.id, zone: "commander", qty: 1, tags: [], printingId: null, card: kozilek },
    { cardId: wastes.id, zone: "main", qty: n, tags: [], printingId: null, card: wastes },
  ];
  const savedDeck = (n: number) => ({
    deck: {
      id: "deck-1",
      publicId: "abcdefgh1234",
      game: "mtg",
      format: "commander",
      name: "Kozilek",
      description: null,
      notes: null,
      visibility: "unlisted",
      isOwner: true,
      forkedFrom: null,
      leaderIds: [kozilek.id],
    },
    cards: cardsOf(n),
    owned: [],
    hasCollection: false,
  });

  let savedSize = 99;
  function y2bRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.startsWith("/api/leaders/random")) return ok({ leader: kozilek });
    if (url === "/api/recommendations") return ok({ count: 0, recommendations: [] });
    if (url === "/api/precons/missing") return { ok: false, status: 404, json: async () => ({}) };
    if (url === "/api/precons/kozilek") {
      return ok({
        deck: { name: "Colorless", game: "mtg", format: "commander", leaderIds: [kozilek.id] },
        cards: cardsOf(99),
      });
    }
    if (url === "/api/cards/resolve") {
      return ok({ results: [{ input: "Sol Ring", match: sol, suggestions: [] }] });
    }
    if (url === "/api/decks/deck-1" && method === "GET") return ok(savedDeck(savedSize));
    return route(input, init);
  }

  beforeEach(() => {
    savedSize = 99;
    fetchMock.mockImplementation(y2bRoute);
  });

  const anyPosts = () =>
    fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
      .length;
  const snapshotPosts = () =>
    fetchMock.mock.calls.filter(([url]) => String(url) === "/api/recommendations");
  const list = () => within(section("Deck list"));
  /** The empty list's action row, in order: what each control is and says. */
  const emptyActions = () => {
    const title = list().getByText("No cards yet");
    const row = title.parentElement!.lastElementChild!.firstElementChild as HTMLElement;
    return [...row.children].map((el) =>
      el.tagName === "A" ? `${el.textContent} → ${el.getAttribute("href")}` : el.textContent,
    );
  };

  it("a fresh Magic draft: after Add cards, Paste a list · Start from a precon · Surprise me — and none of them creates a thing", () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    expect(emptyActions()).toEqual([
      "Add cards",
      "Paste a list",
      "Start from a precon → /precons",
      "Surprise me",
    ]);
    // The Pick door is the leader zone's own Browse link — never repeated.
    expect(list().getAllByRole("link", { name: /Browse commanders/ })).toHaveLength(1);
    expect(list().queryByRole("link", { name: "Pick a commander" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("One Piece: Paste a list only — no precon, no Surprise me; Browse leaders stays in the leader zone", () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" />);
    expect(emptyActions()).toEqual(["Add cards", "Paste a list"]);
    expect(list().getByRole("link", { name: /Browse leaders/ })).toBeTruthy();
  });

  it("Paste a list opens the Import dialog, which creates nothing until Apply — then exactly one deck", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    fireEvent.click(list().getByRole("button", { name: "Paste a list" }));
    const dialog = screen.getByRole("dialog", { name: "Import decklist" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Decklist text" }), {
      target: { value: "1 Sol Ring" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    const add = await pollFor(() => screen.queryByRole("button", { name: "Add to deck" }));
    await settle(1500);
    expect(posts()).toBe(0); // the lookup is the only POST so far
    expect(anyPosts()).toBe(1);

    fireEvent.click(add);
    await settle(1100);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(lastPutEntries().map((e) => e.cardId)).toEqual([sol.id]);
  });

  it("?import=1 (the picker's door) opens the Import dialog by itself, once — and a seeded draft waits for its seed", async () => {
    stubViewport(1440);
    const view = render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftImport />,
    );
    expect(screen.getByRole("dialog", { name: "Import decklist" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    view.unmount();

    render(
      <DeckEditor
        deckId={null}
        draftGame="mtg"
        draftFormat="commander"
        draftFromSlug="kozilek"
        draftImport
      />,
    );
    expect(screen.queryByRole("dialog", { name: "Import decklist" })).toBeNull();
    await pollFor(() => screen.queryByRole("dialog", { name: "Import decklist" }));
    expect(list().getAllByText("Kozilek, the Great Distortion").length).toBeGreaterThan(0);
    expect(posts()).toBe(0);
  });

  it("Surprise me rolls a commander in place, state only — zero POSTs — then offers Keep this deck; the from-nothing doors step aside", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    fireEvent.click(list().getByRole("button", { name: "Surprise me" }));
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    expect(list().getAllByText("Kozilek, the Great Distortion").length).toBeGreaterThan(0);
    expect(anyPosts()).toBe(0);
    expect(saveStatus()).toBe("saved");
    expect(emptyActions()).toEqual(["Autofill a starter shell", "Add cards", "Paste a list"]);
  });

  it("no door while a seed lands; a seed that fails shows them, and Surprise me still rolls into a keepable draft", async () => {
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="missing" />,
    );
    expect(list().queryByRole("button", { name: "Paste a list" })).toBeNull();
    const surprise = await pollFor(() => list().queryByRole("button", { name: "Surprise me" }));
    fireEvent.click(surprise);
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    expect(posts()).toBe(0);
  });

  it("a seeded draft's Suggestions answer from POST /api/recommendations — only once its tab opens, never twice for the same draft, zero deck creates", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftSurprise />);
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    expect(snapshotPosts()).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: "Suggestions" }));
    await pollFor(() => screen.queryByText("No suggestions right now."));
    expect(snapshotPosts()).toHaveLength(1);
    expect(JSON.parse((snapshotPosts()[0][1] as RequestInit).body as string)).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [kozilek.id],
      entries: [],
    });
    fireEvent.click(screen.getByRole("tab", { name: "Card" }));
    fireEvent.click(screen.getByRole("tab", { name: "Suggestions" }));
    await settle(500);
    expect(snapshotPosts()).toHaveLength(1);
    expect(posts()).toBe(0);
  });

  it("the first approval offers Share this deck under the Warden line → the Share dialog; after a reload that deck is never offered again", async () => {
    savedSize = 98; // Kozilek + 98 Wastes: one card short
    stubViewport(1440);
    const view = render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    expect(screen.queryByText(/The Warden approves/)).toBeNull();

    fireEvent.click(list().getByRole("button", { name: "One more Wastes" }));
    const share = list().getByRole("button", { name: "Share this deck" });
    const line = list().getByRole("status");
    expect(line.textContent).toBe("The Warden approves this deck ✓");
    expect(line.contains(share)).toBe(false);
    fireEvent.click(share);
    expect(screen.getByRole("dialog", { name: "Share deck" })).toBeTruthy();
    await settle(1100);
    await act(async () => {});
    view.unmount();

    // A reload: the deck loads legal (no transition), then dips and comes back.
    savedSize = 99;
    render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    expect(list().queryByRole("button", { name: "Share this deck" })).toBeNull();
    fireEvent.click(list().getByRole("button", { name: "One fewer Wastes" }));
    expect(list().queryByRole("status")).toBeNull();
    fireEvent.click(list().getByRole("button", { name: "One more Wastes" }));
    expect(list().getByRole("status").textContent).toBe("The Warden approves this deck ✓");
    expect(list().queryByRole("button", { name: "Share this deck" })).toBeNull();
  });

  it("a loaded legal deck is never offered Share — opening it is no approval", async () => {
    savedSize = 99; // Kozilek + 99 Wastes: legal as it loads
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    expect(list().getByRole("status").textContent).toBe("The Warden approves this deck ✓");
    expect(list().queryByRole("button", { name: "Share this deck" })).toBeNull();
  });

  it("a draft that approves before its row offers nothing — Keep this deck mints it, and then the link appears", async () => {
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="kozilek" />,
    );
    const keep = await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    expect(list().getByRole("status").textContent).toBe("The Warden approves this deck ✓");
    expect(list().queryByRole("button", { name: "Share this deck" })).toBeNull();

    fireEvent.click(keep);
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(list().getByRole("button", { name: "Share this deck" })).toBeTruthy();
  });

  // ------------------------------------------------------ LATER row 164
  describe("an edit undone back to nothing mints no row (LATER row 164)", () => {
    const removeKozilek = () =>
      fireEvent.click(list().getByRole("button", { name: "Remove Kozilek, the Great Distortion" }));

    it("removing a rolled commander: zero creates past the debounce, the slot back to Draft, the doors back — and the next roll keeps with one create + one PUT", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftSurprise />);
      await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));

      removeKozilek();
      expect(saveStatus()).toBe("dirty");
      await settle(1100);
      await act(async () => {});
      expect(posts()).toBe(0);
      expect(saveStatus()).toBe("saved");
      expect(slot().dataset.draft).toBe("true");
      expect(slot().textContent).toBe("Draft");
      expect(window.location.pathname).toBe("/decks/new");
      expect(emptyActions()).toEqual([
        "Add cards",
        "Paste a list",
        "Start from a precon → /precons",
        "Surprise me",
      ]);

      fireEvent.click(list().getByRole("button", { name: "Surprise me" }));
      fireEvent.click(
        await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" })),
      );
      await settle(1500);
      await act(async () => {});
      expect(posts()).toBe(1);
      expect(puts()).toBe(1);
      expect(lastPutEntries().map((e) => e.cardId)).toEqual([kozilek.id]);
    });

    it("Surprise me inside the removal's debounce settles that save first: the new roll stays state only and keepable — zero creates", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftSurprise />);
      await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));

      removeKozilek();
      fireEvent.click(list().getByRole("button", { name: "Surprise me" }));
      await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
      await settle(1500);
      await act(async () => {});
      expect(posts()).toBe(0);
      expect(saveStatus()).toBe("saved");
      expect(slot().textContent).toBe("Draft");
      expect(screen.getByRole("button", { name: "Keep this deck" })).toBeTruthy();
    });

    it("a typed name is something to say · one create carrying it; a name typed and erased inside the debounce is not", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
      const name = screen.getByRole("textbox", { name: "Deck name" });
      fireEvent.change(name, { target: { value: "Eldrazi" } });
      fireEvent.change(name, { target: { value: "" } });
      await settle(1100);
      await act(async () => {});
      expect(posts()).toBe(0);
      expect(slot().textContent).toBe("Draft");

      fireEvent.change(name, { target: { value: "Eldrazi" } });
      await settle(1100);
      await act(async () => {});
      expect(posts()).toBe(1);
      const create = fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )!;
      expect(JSON.parse((create[1] as RequestInit).body as string)).toMatchObject({
        name: "Eldrazi",
      });
      expect(slot().hasAttribute("data-draft")).toBe(false);
    });
  });

  // ------------------------------------------------------ LATER row 167
  describe("a roll that lands on a deck row is an edit (LATER row 167)", () => {
    /**
     * A typed name's create in flight with Surprise me clicked: the door
     * stays until the create answers, so the roll and the create race. The
     * create's POST and the roll's GET answer when the test says so.
     */
    function renderRace() {
      const create = deferred();
      const roll = deferred();
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/decks" && init?.method === "POST") {
          return create.promise.then(() => y2bRoute(input, init));
        }
        if (url.startsWith("/api/leaders/random")) {
          return roll.promise.then(() => y2bRoute(input, init));
        }
        return y2bRoute(input, init);
      });
      stubViewport(1440);
      render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
      return { create, roll };
    }
    async function nameThenSurprise() {
      fireEvent.change(screen.getByRole("textbox", { name: "Deck name" }), {
        target: { value: "Eldrazi" },
      });
      await settle(1100);
      expect(posts()).toBe(1); // the name's create is in flight
      fireEvent.click(list().getByRole("button", { name: "Surprise me" }));
    }
    const answer = async (d: { resolve: () => void }) => {
      await act(async () => {
        d.resolve();
      });
      await act(async () => {});
    };
    const deckWrites = () =>
      fetchMock.mock.calls
        .filter(([, init]) => ["POST", "PUT", "PATCH"].includes(init?.method ?? "GET"))
        .map(([url, init]) => `${(init as RequestInit).method} ${String(url)}`);

    it("the create answers first: the roll lands dirty on the row, and ONE PUT a debounce later carries the commander", async () => {
      const { create, roll } = renderRace();
      await nameThenSurprise();
      await answer(create);
      expect(window.location.pathname).toBe("/decks/deck-1/edit");
      await answer(roll);
      expect(list().getAllByText("Kozilek, the Great Distortion").length).toBeGreaterThan(0);
      // Before the fix: "saved", and no PUT ever (the probe's calls were the
      // create, the roll's GET and the name's PATCH).
      expect(saveStatus()).toBe("dirty");
      await settle(1100);
      await act(async () => {});
      expect(deckWrites()).toEqual([
        "POST /api/decks",
        "PATCH /api/decks/deck-1",
        "PUT /api/decks/deck-1/cards",
      ]);
      expect(lastPutEntries().map((e) => e.cardId)).toEqual([kozilek.id]);
      expect(saveStatus()).toBe("saved");
    });

    it("the roll lands first: it rides the save in flight — one create, one PUT, nothing more", async () => {
      const { create, roll } = renderRace();
      await nameThenSurprise();
      await answer(roll);
      expect(saveStatus()).toBe("saving");
      await answer(create);
      await settle(1100);
      await act(async () => {});
      expect(deckWrites()).toEqual([
        "POST /api/decks",
        "PUT /api/decks/deck-1/cards",
        "PATCH /api/decks/deck-1",
      ]);
      expect(lastPutEntries().map((e) => e.cardId)).toEqual([kozilek.id]);
      expect(saveStatus()).toBe("saved");
    });
  });
});

// ------------------------------------------------------------------- Y4a
describe("DeckEditor — the bracket line and its Why sheet (Y4a)", () => {
  const kozilek: CardWire = {
    ...card({
      name: "Kozilek, the Great Distortion",
      primaryType: "Creature",
      costValue: 10,
      isLeaderCandidate: true,
      attrs: { type_line: "Legendary Creature — Eldrazi", oracle_text: "" },
    }),
    image: null,
  };
  const wastes: CardWire = {
    ...card({
      name: "Wastes",
      primaryType: "Land",
      costValue: null,
      attrs: { type_line: "Basic Land — Wastes", oracle_text: "" },
    }),
    image: null,
  };
  /** A legal colorless Commander list, saved: Kozilek + 99 Wastes. */
  const savedDeck = {
    deck: {
      id: "deck-1",
      publicId: "abcdefgh1234",
      game: "mtg",
      format: "commander",
      name: "Kozilek",
      description: null,
      notes: null,
      visibility: "unlisted",
      isOwner: true,
      forkedFrom: null,
      leaderIds: [kozilek.id],
    },
    cards: [
      { cardId: kozilek.id, zone: "commander", qty: 1, tags: [], printingId: null, card: kozilek },
      { cardId: wastes.id, zone: "main", qty: 99, tags: [], printingId: null, card: wastes },
    ],
    owned: [],
    hasCollection: false,
  };
  function y4aRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") return ok(savedDeck);
    return route(input, init);
  }
  const line = () => document.querySelector<HTMLElement>("[data-slot=bracket-line]");
  const NOTHING = "Bracket 1 to 2 · nothing here goes past Core Why?";

  beforeEach(() => {
    fetchMock.mockImplementation(y4aRoute);
  });

  it("a saved deck: the line follows the Warden line; a quantity never asks again, a new card asks once after the debounce", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => (line()?.textContent === NOTHING ? line() : null));
    // On the legality line: directly after the Warden's.
    const warden = screen.getByText(/The Warden approves this deck/).closest("p")!;
    expect(warden.nextElementSibling).toBe(line());
    expect(factsGets().map(([url]) => String(url))).toEqual([
      `/api/combos/complete?game=mtg&ids=${[kozilek.id, wastes.id].sort().join(",")}`,
    ]);

    // Wastes 99 → 98: the same id set — a draft line at once, no new ask.
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "One fewer Wastes" }));
    expect(line()!.textContent).toBe("Bracket: add 1 more card");
    await settle(2000);
    await act(async () => {});
    expect(factsGets()).toHaveLength(1);

    // A new card changes the set: "Checking combos…" until the debounce asks.
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(within(section("Deck list")).getByText("Sol Ring")).toBeTruthy();
    expect(line()!.textContent).toBe("Checking combos…");
    await settle(450);
    expect(factsGets()).toHaveLength(1);
    await settle(100);
    await act(async () => {});
    expect(factsGets()).toHaveLength(2);
    expect(String(factsGets()[1][0])).toBe(
      `/api/combos/complete?game=mtg&ids=${[kozilek.id, sol.id, wastes.id].sort().join(",")}`,
    );
    expect(line()!.textContent).toBe(NOTHING);
    // Only GETs ever asked; the edits PUT as always.
    expect(posts()).toBe(0);
  });

  it("Why? opens from the keyboard (the hotkeys stand down) and Escape hands focus back to it", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    const why = await pollFor(() => screen.queryByRole("button", { name: "Why?" }));
    why.focus();
    expect(document.activeElement).toBe(why);
    fireEvent.click(why); // Enter or Space on a native button
    const sheet = await pollFor(() => screen.queryByRole("dialog", { name: "Why this bracket?" }));
    expect(within(sheet).getByText("Bracket 1 to 2 · nothing here goes past Core")).toBeTruthy();
    expect(within(sheet).getByRole("region", { name: "What the cards show" })).toBeTruthy();
    expect(within(sheet).getByRole("region", { name: "What this read assumes" })).toBeTruthy();
    // "/" focuses the search box only while no dialog is open.
    fireEvent.keyDown(window, { key: "/" });
    const search = document.querySelector<HTMLElement>('[aria-label="Card search"]');
    expect(search).toBeTruthy();
    expect(document.activeElement).not.toBe(search);

    fireEvent.keyDown(sheet, { key: "Escape" });
    await pollFor(() =>
      screen.queryByRole("dialog", { name: "Why this bracket?" }) ? null : document.body,
    );
    await pollFor(() => (document.activeElement === why ? why : null));
  });

  it("on a phone Why? opens the bottom Drawer", async () => {
    stubViewport(375);
    render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Why?" })));
    const sheet = await pollFor(() => screen.queryByRole("dialog", { name: "Why this bracket?" }));
    expect(
      sheet.closest("[data-slot=drawer-popup]") ??
        sheet.querySelector("[data-slot=drawer-content]"),
    ).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("a facts failure says so with Retry, and Retry asks again", async () => {
    let fail = true;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (fail && String(input).startsWith("/api/combos/complete?")) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return y4aRoute(input, init);
    });
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => (line()?.textContent === "Couldn't check combos Retry" ? line() : null));
    await settle(2000);
    expect(factsGets()).toHaveLength(1);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await pollFor(() => (line()?.textContent === NOTHING ? line() : null));
    expect(factsGets()).toHaveLength(2);
  });

  it("no commander yet: the line's slot is held empty (U3a) and no facts GET — the progress line already says what to do", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
        return ok({
          ...savedDeck,
          cards: savedDeck.cards.slice(1),
          deck: { ...savedDeck.deck, leaderIds: [] },
        });
      }
      return y4aRoute(input, init);
    });
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => screen.queryByText("Choose a commander · 1 to go"));
    await settle(2000);
    await act(async () => {});
    // U3a: present and empty, never an invented sentence — hidden from
    // assistive tech, nothing to press, nothing to focus.
    expect(line()?.dataset.status).toBe("empty");
    expect(line()?.getAttribute("aria-hidden")).toBe("true");
    expect(line()?.textContent?.trim()).toBe("");
    expect(line()?.querySelector("button")).toBeNull();
    expect(line()?.hasAttribute("tabindex")).toBe(false);
    expect(factsGets()).toHaveLength(0);
  });
});

describe("DeckEditor — your target and the answers (Y4b)", () => {
  const kozilek: CardWire = {
    ...card({
      name: "Kozilek, the Great Distortion",
      primaryType: "Creature",
      costValue: 10,
      isLeaderCandidate: true,
      attrs: { type_line: "Legendary Creature — Eldrazi", oracle_text: "" },
    }),
    image: null,
  };
  const vault: CardWire = {
    ...card({
      name: "Mana Vault",
      primaryType: "Artifact",
      costValue: 1,
      attrs: { type_line: "Artifact", oracle_text: "", game_changer: true },
    }),
    image: null,
  };
  const edge: CardWire = {
    ...card({
      name: "Tectonic Edge",
      primaryType: "Land",
      costValue: null,
      attrs: { type_line: "Land", oracle_text: "", mld: "edge" },
    }),
    image: null,
  };
  const wastes: CardWire = {
    ...card({
      name: "Wastes",
      primaryType: "Land",
      costValue: null,
      attrs: { type_line: "Basic Land — Wastes", oracle_text: "" },
    }),
    image: null,
  };
  /** A commander that is itself a Game Changer — a one-card draft with something to explain. */
  const urza: CardWire = {
    ...card({
      name: "Urza, Lord High Artificer",
      primaryType: "Creature",
      costValue: 4,
      isLeaderCandidate: true,
      attrs: {
        type_line: "Legendary Creature — Human Artificer",
        oracle_text: "",
        game_changer: true,
      },
    }),
    image: null,
  };
  const EDGE_CALL = `land-denial:${edge.externalKey}`;
  const listCards = [
    { cardId: kozilek.id, zone: "commander", qty: 1, tags: [], printingId: null, card: kozilek },
    { cardId: vault.id, zone: "main", qty: 1, tags: [], printingId: null, card: vault },
    { cardId: edge.id, zone: "main", qty: 1, tags: [], printingId: null, card: edge },
    { cardId: wastes.id, zone: "main", qty: 97, tags: [], printingId: null, card: wastes },
  ];
  /** Kozilek, a Game Changer, an edge land-denial card and 97 Wastes: at least 3, a call to 4. */
  function savedDeck(goals: unknown = null) {
    return {
      deck: {
        id: "deck-1",
        publicId: "abcdefgh1234",
        game: "mtg",
        format: "commander",
        name: "Kozilek",
        description: null,
        notes: null,
        visibility: "unlisted",
        isOwner: true,
        forkedFrom: null,
        leaderIds: [kozilek.id],
        goals,
      },
      cards: listCards,
      owned: [],
      hasCollection: false,
    };
  }
  let deckGoals: unknown = null;
  function y4bRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/decks/deck-1" && method === "GET") return ok(savedDeck(deckGoals));
    if (url.startsWith("/api/leaders/random")) return ok({ leader: urza });
    if (url === "/api/precons/kozilek_c99") {
      return ok({
        precon: {
          slug: "kozilek_c99",
          code: "Kozilek_C99",
          setCode: "C99",
          setName: "Commander 2099",
          releaseDate: "2099-01-01",
          productName: "Eldrazi Unbound",
        },
        deck: {
          publicId: "p_kozilek_c99",
          name: "Eldrazi Unbound",
          description: null,
          game: "mtg",
          format: "commander",
          leaderIds: [kozilek.id],
          ciMask: 0,
        },
        cards: listCards,
      });
    }
    return route(input, init);
  }
  const line = () => document.querySelector<HTMLElement>("[data-slot=bracket-line]");
  const patchBodies = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => url === "/api/decks/deck-1" && init?.method === "PATCH")
      .map(([, init]) => JSON.parse((init as RequestInit).body as string) as unknown);
  const createBody = () =>
    JSON.parse(
      fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )![1]!.body as string,
    ) as { goals?: unknown; name?: string };
  const sheet = () => screen.queryByRole("dialog", { name: "Why this bracket?" });

  const lineIs = (text: string) => pollFor(() => (line()?.textContent === text ? line() : null));
  async function openSheet() {
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Why?" })));
    return pollFor(sheet);
  }
  const targetButton = (dialog: HTMLElement, label: string) =>
    within(within(dialog).getByRole("group", { name: "Your target" })).getByRole("button", {
      name: label,
    });

  beforeEach(() => {
    deckGoals = null;
    fetchMock.mockImplementation(y4bRoute);
  });

  it("a saved deck: a target is ONE PATCH {goals} after the debounce — no PUT, no meta PATCH, no second facts GET; the line and the callout follow at once", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await lineIs("Bracket 3 or 4 · one card is your call Why?");
    const dialog = await openSheet();
    fireEvent.click(targetButton(dialog, "2"));

    expect(line()!.textContent).toBe(
      "Your target: Bracket 2 · the cards say 3 or 4, one card is your call Why?",
    );
    const callout = dialog.querySelector<HTMLElement>("[data-slot=bracket-conflicts]")!;
    expect(
      [...callout.querySelectorAll<HTMLElement>("[data-conflict]")].map((r) => r.dataset.conflict),
    ).toEqual(["game-changers"]);
    expect(callout.textContent).toContain("Remove Mana Vault to fit Bracket 2.");

    expect(patchBodies()).toEqual([]);
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ goals: { v: 1, targetLevel: 2 } }]);
    expect(puts()).toBe(0);
    expect(posts()).toBe(0);
    expect(factsGets()).toHaveLength(1);
    expect(saveStatus()).toBe("saved");
  });

  it("answers and the target survive a reload: the deck GET's goals feed the read, the line and the sheet — loading is no edit", async () => {
    deckGoals = {
      v: 1,
      targetLevel: 2,
      exceptions: "One thematic Game Changer — ask me",
      answers: { rulesetVersion: 1, play: { quality: "yes" }, calls: { [EDGE_CALL]: "yes" } },
    };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await lineIs("Your target: Bracket 2 · the cards and your answers say 4 Why?");
    const dialog = await openSheet();
    const pressed = (group: HTMLElement) =>
      within(group)
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true")
        .map((b) => b.textContent);
    expect(pressed(within(dialog).getByRole("group", { name: "Your target" }))).toEqual(["2"]);
    const call = dialog.querySelector<HTMLElement>(`[data-question='${EDGE_CALL}']`)!;
    expect(pressed(within(call).getByRole("group"))).toEqual(["Yes"]);
    expect(
      (within(dialog).getByRole("textbox", { name: "Table exceptions" }) as HTMLInputElement).value,
    ).toBe("One thematic Game Changer — ask me");
    expect(within(dialog).getByRole("button", { name: /How it plays/ }).textContent).toContain(
      "1 answered",
    );
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([]);
    expect(saveStatus()).toBe("saved");
  });

  it("an answer recorded under rulesetVersion 0 reads stale and still applies; Keep my answers PATCHes the restamp", async () => {
    deckGoals = { v: 1, answers: { rulesetVersion: 0, calls: { [EDGE_CALL]: "yes" } } };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await lineIs(
      "Bracket 4 (Optimized) · from the cards and your answers. Rules changed since you answered Why?",
    );
    const dialog = await openSheet();
    const notice = dialog.querySelector<HTMLElement>("[data-slot=bracket-stale]")!;
    expect(within(notice).getByText("Rules changed since you answered")).toBeTruthy();
    fireEvent.click(within(notice).getByRole("button", { name: "Keep my answers" }));
    expect(line()!.textContent).toBe(
      "Bracket 4 (Optimized) · from the cards and your answers Why?",
    );
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([
      { goals: { v: 1, answers: { rulesetVersion: 1, calls: { [EDGE_CALL]: "yes" } } } },
    ]);
  });

  it("answering a call is a goals PATCH too — and a burst of answers is one PATCH", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await lineIs("Bracket 3 or 4 · one card is your call Why?");
    const dialog = await openSheet();
    const call = dialog.querySelector<HTMLElement>(`[data-question='${EDGE_CALL}']`)!;
    fireEvent.click(within(call).getByRole("button", { name: "Yes" }));
    fireEvent.click(within(call).getByRole("button", { name: "No" }));
    expect(line()!.textContent).toBe("Bracket 3 (Upgraded) · from the cards and your answers Why?");
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([
      { goals: { v: 1, answers: { rulesetVersion: 1, calls: { [EDGE_CALL]: "no" } } } },
    ]);
    expect(factsGets()).toHaveLength(1);
  });

  it("closing the tab inside the debounce sends the goals as ONE keepalive PATCH", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await lineIs("Bracket 3 or 4 · one card is your call Why?");
    const dialog = await openSheet();
    fireEvent.click(targetButton(dialog, "4"));
    window.dispatchEvent(new Event("pagehide"));
    const keepalive = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/decks/deck-1" && (init as RequestInit).keepalive === true,
    );
    expect(keepalive).toHaveLength(1);
    expect(JSON.parse((keepalive[0][1] as RequestInit).body as string)).toEqual({
      goals: { v: 1, targetLevel: 4 },
    });
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toHaveLength(1);
  });

  describe("in a draft — a target or an answer is a real edit (D5)", () => {
    function renderDraft() {
      stubViewport(1440);
      window.history.replaceState(null, "", "/decks/new?game=mtg&from=kozilek_c99");
      render(
        <DeckEditor
          deckId={null}
          draftGame="mtg"
          draftFormat="commander"
          draftFromSlug="kozilek_c99"
        />,
      );
    }

    it("a target set in a precon draft creates exactly ONE deck with the goals in its create · one POST + one PUT, no PATCH", async () => {
      renderDraft();
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await settle(1500);
      expect(posts()).toBe(0);
      expect(slot().hasAttribute("data-draft")).toBe(true);

      const dialog = await openSheet();
      // LATER row 306: a draft has no row yet and mints unlisted, so its link previews will draw the target.
      expect(within(dialog).getByRole("region", { name: "Your target" }).textContent).toContain(
        "Your target also shows in link previews and where the deck is listed.",
      );
      fireEvent.click(targetButton(dialog, "3"));
      await settle(1500);
      await act(async () => {});
      expect(posts()).toBe(1);
      expect(createBody()).toMatchObject({
        name: "Eldrazi Unbound",
        goals: { v: 1, targetLevel: 3 },
      });
      expect(puts()).toBe(1);
      expect(patchBodies()).toEqual([]);
      expect(slot().hasAttribute("data-draft")).toBe(false);
      expect(saveStatus()).toBe("saved");
    });

    it("an answer is something to say too: one create carrying it", async () => {
      renderDraft();
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      const dialog = await openSheet();
      fireEvent.click(within(dialog).getByRole("button", { name: "How it plays" }));
      fireEvent.click(
        within(within(dialog).getByRole("group", { name: "Theme first, over power?" })).getByRole(
          "button",
          { name: "No" },
        ),
      );
      await settle(1500);
      await act(async () => {});
      expect(posts()).toBe(1);
      expect(createBody().goals).toEqual({
        v: 1,
        answers: { rulesetVersion: 1, play: { theme: "no" } },
      });
      expect(puts()).toBe(1);
      expect(patchBodies()).toEqual([]);
    });

    describe("the target alone is something to say (isBlankDraft, LATER row 164's guard)", () => {
      /** A rolled Game Changer commander, the sheet open, then the commander cut inside the debounce. */
      async function targetThenCut(...targets: string[]) {
        stubViewport(1440);
        render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftSurprise />);
        await lineIs("Bracket: add 99 more cards · 1 Game Changer so far Why?");
        const dialog = await openSheet();
        for (const t of targets) fireEvent.click(targetButton(dialog, t));
        // The list sits under the open modal: no settle between, so the debounce never fires first.
        fireEvent.click(
          within(section("Deck list")).getByRole("button", {
            name: "Remove Urza, Lord High Artificer",
            hidden: true,
          }),
        );
        await settle(1500);
        await act(async () => {});
      }

      it("set a target, cut the commander: the list is empty again but the target still mints ONE deck carrying it — no PUT, no PATCH", async () => {
        await targetThenCut("2");
        expect(posts()).toBe(1);
        expect(createBody().goals).toEqual({ v: 1, targetLevel: 2 });
        expect(puts()).toBe(0);
        expect(patchBodies()).toEqual([]);
      });

      it("set and cleared inside the debounce, then the commander cut: nothing to say — no row", async () => {
        await targetThenCut("2", "Not set");
        expect(posts()).toBe(0);
        expect(slot().hasAttribute("data-draft")).toBe(true);
      });
    });
  });

  describe("goals in Suggestions (Y6a)", () => {
    const solRec = {
      cardId: sol.id,
      name: sol.name,
      primaryType: "Artifact",
      costValue: 1,
      ciMask: 0,
      cheapestUsd: "1.20",
      popularity: 1,
      score: 0.9,
      confidence: "high",
      evidence: [
        {
          source: "edhrec_rank",
          why: "A Commander staple in EDHREC decklists",
          with: [],
          howOften: "EDHREC rank #1",
          confidence: "high",
        },
      ],
      conflicts: [],
    };
    function y6aRoute(input: RequestInfo | URL, init?: RequestInit) {
      const url = String(input);
      if (url.startsWith("/api/decks/deck-1/recommendations") || url === "/api/recommendations") {
        return ok({ count: 1, recommendations: [solRec], hidden: [], combosTruncated: false });
      }
      if (url === "/api/cards/resolve") {
        return ok({ results: [{ input: sol.name, match: sol, suggestions: [] }] });
      }
      return y4bRoute(input, init);
    }
    const suggestions = () => {
      fireEvent.click(screen.getByRole("tab", { name: "Suggestions" }));
      return pollFor(() => screen.queryByText("A Commander staple in EDHREC decklists"));
    };
    const goalsLine = () => document.querySelector<HTMLElement>("[data-slot=goals-line]");

    beforeEach(() => {
      fetchMock.mockImplementation(y6aRoute);
    });

    it("an add from Suggestions toasts Added X · Undo; Undo is a real edit — the card leaves and the deck saves again", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      // Below the maximum an add is an add (at 100 it's "Swap in…", Y7b): one Wastes out first.
      fireEvent.click(screen.getByRole("button", { name: "One fewer Wastes" }));
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      await suggestions();
      fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to the deck" }));
      const toastEl = (await pollFor(() => screen.queryByText("Added Sol Ring"))).closest(
        '[data-slot="toast"]',
      ) as HTMLElement;
      // The panel's live line says nothing: the toast already did.
      expect(screen.getAllByText("Added Sol Ring")).toHaveLength(1);
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(2);
      expect(lastPutEntries().some((e) => e.cardId === sol.id)).toBe(true);

      fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
      expect(saveStatus()).toBe("dirty");
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(3);
      expect(lastPutEntries().some((e) => e.cardId === sol.id)).toBe(false);
    });

    it("Y7b: at 100 / 100 the Suggestions Add reads Swap in… — the card comes in, a card of its mana value goes out, the tab stays put", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await suggestions();
      const button = screen.getByRole("button", { name: "Swap in Sol Ring…" });
      expect(button.textContent).toBe("Swap in…");
      fireEvent.click(button);
      const sheetEl = await pollFor(() =>
        screen.queryByRole("dialog", { name: "Swap in Sol Ring" }),
      );
      // Mana Vault is the only other mana value 1 card, and it carries no signal data: no named partner.
      expect(
        within(sheetEl).getByText("No suggested cut at mana value 1. Choose the card to cut."),
      ).toBeTruthy();
      expect(
        within(sheetEl).getByRole("region", { name: "Also at mana value 1" }).textContent,
      ).toContain("No signal data");
      expect(puts()).toBe(0);
      fireEvent.click(
        within(sheetEl).getByRole("button", { name: "Swap Mana Vault for Sol Ring" }),
      );
      await pollFor(() => screen.queryByText("Swapped Mana Vault → Sol Ring"));
      expect(screen.queryByRole("dialog", { name: "Swap in Sol Ring" })).toBeNull();
      expect(screen.getByRole("tab", { name: "Suggestions" }).getAttribute("aria-selected")).toBe(
        "true",
      );
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      const saved = lastPutEntries() as unknown as { cardId: string; qty: number }[];
      expect(saved.reduce((n, e) => n + e.qty, 0)).toBe(100);
      expect(saved.map((e) => e.cardId)).toEqual([kozilek.id, sol.id, edge.id, wastes.id]);
    });

    it("“Save as this deck's budget” is ONE goals PATCH — no PUT; the goals line says it, and the panel asks with it", async () => {
      deckGoals = { v: 1, targetLevel: 3 };
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Your target: Bracket 3 · the cards say 3 or 4, one card is your call Why?");
      await suggestions();
      expect(goalsLine()!.textContent).toBe("Your goals: Bracket 3 (Upgraded) Change");
      fireEvent.click(screen.getByRole("button", { name: "≤ $5 a card" }));
      fireEvent.click(screen.getByRole("button", { name: "Save as this deck's budget" }));
      expect(goalsLine()!.textContent).toBe("Your goals: Bracket 3 (Upgraded), ≤ $5 a card Change");
      await settle(1500);
      await act(async () => {});
      expect(patchBodies()).toEqual([
        { goals: { budget: { perCardUsd: 5 }, targetLevel: 3, v: 1 } },
      ]);
      expect(puts()).toBe(0);
      expect(posts()).toBe(0);
      // Once saved, the panel asks with the deck's new budget (the GET reads the goals off the row).
      await pollFor(() =>
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith("/api/decks/deck-1/recommendations?budget=5"),
        )
          ? true
          : null,
      );
    });

    it("in a precon draft, saving a budget is a real edit like a target: ONE create carrying the goals, one PUT, no PATCH", async () => {
      stubViewport(1440);
      window.history.replaceState(null, "", "/decks/new?game=mtg&from=kozilek_c99");
      render(
        <DeckEditor
          deckId={null}
          draftGame="mtg"
          draftFormat="commander"
          draftFromSlug="kozilek_c99"
        />,
      );
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await suggestions();
      expect(posts()).toBe(0);
      fireEvent.click(screen.getByRole("button", { name: "≤ $1 a card" }));
      await settle(300);
      // The draft's own request carries the pick (no row yet).
      const draftAsks = fetchMock.mock.calls.filter(([url]) => url === "/api/recommendations");
      expect(JSON.parse((draftAsks.at(-1)![1] as RequestInit).body as string).budget).toBe(1);
      expect(posts()).toBe(0);

      fireEvent.click(screen.getByRole("button", { name: "Save as this deck's budget" }));
      await settle(1500);
      await act(async () => {});
      expect(posts()).toBe(1);
      expect(createBody()).toMatchObject({ goals: { v: 1, budget: { perCardUsd: 1 } } });
      expect(puts()).toBe(1);
      expect(patchBodies()).toEqual([]);
    });

    it("the goals line's “Set one” opens the Why sheet with focus on Your target — before the list has found anything (LATER row 175)", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await suggestions();
      expect(goalsLine()!.textContent).toBe("No bracket target yet Set one");
      fireEvent.click(screen.getByRole("button", { name: "Set one" }));
      const dialog = await pollFor(sheet);
      await pollFor(() =>
        document.activeElement === targetButton(dialog, "Not set") ? true : null,
      );
      fireEvent.click(targetButton(dialog, "2"));
      expect(line()!.textContent).toBe(
        "Your target: Bracket 2 · the cards say 3 or 4, one card is your call Why?",
      );
      // Atop the sheet, the owner's goals line now reads the target too.
      expect(
        within(dialog).getByText("Your goals: Bracket 2 (Core)", { exact: false }),
      ).toBeTruthy();
    });

    it("LATER row 175: a commander alone has found nothing, so the line offers no Why? — the goals line is the door, and a target set there mints ONE deck carrying it", async () => {
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).startsWith("/api/leaders/random")
          ? ok({ leader: kozilek })
          : y6aRoute(input, init),
      );
      stubViewport(1440);
      render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftSurprise />);
      await lineIs("Bracket: add 99 more cards");
      expect(screen.queryByRole("button", { name: "Why?" })).toBeNull();
      await suggestions();
      expect(goalsLine()!.textContent).toBe("No bracket target yet Set one");
      fireEvent.click(screen.getByRole("button", { name: "Set one" }));
      const dialog = await pollFor(sheet);
      fireEvent.click(targetButton(dialog, "2"));
      await settle(1500);
      await act(async () => {});
      expect(posts()).toBe(1);
      expect(createBody().goals).toEqual({ v: 1, targetLevel: 2 });
      expect(goalsLine()!.textContent).toBe("Your goals: Bracket 2 (Core) Change");
    });

    it("on a phone the same door opens the Drawer with focus on Your target; the sheet's own Change brings it back", async () => {
      deckGoals = { v: 1, targetLevel: 3, budget: { perCardUsd: 5 } };
      stubViewport(375);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Your target: Bracket 3 · the cards say 3 or 4, one card is your call Why?");
      fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
      await suggestions();
      fireEvent.click(screen.getByRole("button", { name: "Change" }));
      const dialog = await pollFor(sheet);
      expect(dialog.getAttribute("data-slot")).toBe("drawer-popup");
      await pollFor(() => (document.activeElement === targetButton(dialog, "3") ? true : null));
      const sheetLine = dialog.querySelector<HTMLElement>("[data-slot=goals-line]")!;
      expect(sheetLine.textContent).toBe("Your goals: Bracket 3 (Upgraded), ≤ $5 a card Change");
      within(dialog).getByRole("button", { name: "Close" }).focus();
      fireEvent.click(within(sheetLine).getByRole("button", { name: "Change" }));
      expect(document.activeElement).toBe(targetButton(dialog, "3"));
    });
  });

  describe("goals in Autofill and the Combo Radar (Y6b)", () => {
    const ref = (c: CardWire) => ({ id: c.id, name: c.name, externalKey: c.externalKey });
    /** One card away: Sol Ring with the kept Mana Vault — a two-card combo rated R. */
    const oneAway = {
      id: 601,
      externalKey: "kz-2",
      results: ["Infinite colorless mana"],
      templates: [],
      popularity: 200,
      tag: "R",
      relevant: true,
      inDeckPieces: [ref(vault)],
      missingPieces: [ref(sol)],
    };
    /** Kozilek's own combo: two pieces to add. */
    const leaderCombos = {
      total: 1,
      combos: [
        {
          id: 501,
          externalKey: "kz-1",
          results: ["Infinite mana"],
          templates: [],
          popularity: 300,
          pieces: [kozilek, sol, signet].map(ref),
        },
      ],
    };
    const emptyShell = {
      game: "mtg",
      format: "commander",
      seed: 1,
      picks: [],
      groups: [],
      notes: ["Skipped 1 Game Changer. Your Bracket 2 target allows none (Wizards' list)"],
      totals: { picks: 0, estUsd: null, unpriced: 0 },
      issues: [],
      cards: [],
    };
    function y6bRoute(input: RequestInfo | URL, init?: RequestInit) {
      const url = String(input);
      if (url === "/api/decks/deck-1/combos") {
        return ok({ deckId: "deck-1", inDeck: [], oneAway: [oneAway], truncated: false });
      }
      if (url.startsWith(`/api/cards/${kozilek.id}/combos`)) return ok(leaderCombos);
      if (url === "/api/cards/resolve") {
        const { names } = JSON.parse(init!.body as string) as { names: string[] };
        const known = [sol, signet];
        return ok({
          results: names.map((n) => ({
            input: n,
            match: known.find((c) => c.externalKey === n || c.name === n) ?? null,
            suggestions: [],
          })),
        });
      }
      if (url === "/api/decks/autofill") return { ...ok(emptyShell), headers: new Headers() };
      return y4bRoute(input, init);
    }
    const combosTab = () => {
      fireEvent.click(screen.getByRole("tab", { name: "Combos" }));
      return pollFor(() => screen.queryByRole("heading", { name: "One card away" }));
    };
    const toastOf = async (title: string) =>
      (await pollFor(() => screen.queryByText(title))).closest(
        '[data-slot="toast"]',
      ) as HTMLElement;

    beforeEach(() => {
      fetchMock.mockImplementation(y6bRoute);
    });

    it("LATER row 179: a Radar add toasts Added X · Undo — the live line stays quiet — and Undo is a real edit", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      // Below the maximum an add is an add (at 100 it's "Swap in…", Y7b): one Wastes out first.
      fireEvent.click(screen.getByRole("button", { name: "One fewer Wastes" }));
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      await combosTab();
      fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to the deck" }));
      const toastEl = await toastOf("Added Sol Ring");
      expect(screen.getAllByText("Added Sol Ring")).toHaveLength(1);
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(2);
      expect(lastPutEntries().some((e) => e.cardId === sol.id)).toBe(true);

      fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(3);
      expect(lastPutEntries().some((e) => e.cardId === sol.id)).toBe(false);
    });

    it("Y7b: at 100 / 100 the Radar's one-card Add reads Swap in… and opens the sheet; a combo's pieces keep their add", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await combosTab();
      expect(screen.getByRole("button", { name: "Add 2 pieces" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Swap in Sol Ring…" }));
      await pollFor(() => screen.queryByRole("dialog", { name: "Swap in Sol Ring" }));
      await settle(1500);
      expect(puts()).toBe(0);
    });

    it("LATER row 179: a combo's pieces toast ONCE — Added 2 combo pieces — and ONE Undo takes both back", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await combosTab();
      fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Add 2 pieces" })));
      const toastEl = await toastOf("Added 2 combo pieces");
      expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      const added = lastPutEntries().map((e) => e.cardId);
      expect(added).toEqual(expect.arrayContaining([sol.id, signet.id]));

      fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(2);
      const after = lastPutEntries().map((e) => e.cardId);
      expect(after).not.toContain(sol.id);
      expect(after).not.toContain(signet.id);
      expect(after).toContain(vault.id);
    });

    it("MAYBE-LIST: a piece parked in Maybe is still a missing piece — Add 2 pieces adds it and takes it out of Maybe; ONE Undo puts both back", async () => {
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
          const deck = savedDeck(deckGoals);
          const parked = {
            cardId: signet.id,
            zone: "maybeboard",
            qty: 1,
            tags: [],
            printingId: null,
          };
          return ok({ ...deck, cards: [...deck.cards, { ...parked, card: signet }] });
        }
        return y6bRoute(input, init);
      });
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      await combosTab();
      fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Add 2 pieces" })));
      const toastEl = await toastOf("Added 2 combo pieces");
      expect(within(toastEl).getByText("Taken out of Maybe.")).toBeTruthy();
      await settle(1500);
      await act(async () => {});
      const zoneOf = (id: string) =>
        (lastPutEntries() as unknown as { cardId: string; zone: string }[])
          .filter((e) => e.cardId === id)
          .map((e) => e.zone);
      expect(zoneOf(signet.id)).toEqual(["main"]);
      expect(zoneOf(sol.id)).toEqual(["main"]);

      fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
      await settle(1500);
      await act(async () => {});
      expect(zoneOf(signet.id)).toEqual(["maybeboard"]);
      expect(zoneOf(sol.id)).toEqual([]);
    });

    it("the Radar's rows read the deck's target: the R combo one card away is above a target of 2", async () => {
      deckGoals = { v: 1, targetLevel: 2 };
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Your target: Bracket 2 · the cards say 3 or 4, one card is your call Why?");
      await combosTab();
      const badge = await pollFor(() =>
        document.querySelector<HTMLElement>("[data-slot=combo-badge]"),
      );
      expect(badge.textContent).toBe(
        "A two-card combo alone makes a deck at least Bracket 4 (Commander Spellbook) · above your target",
      );
    });

    it("More → Autofill… sends the deck's goals and starts from its budget; the goals line and the notes read in the sheet", async () => {
      deckGoals = { v: 1, targetLevel: 2, budget: { perCardUsd: 5 }, exceptions: "ask me" };
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Your target: Bracket 2 · the cards say 3 or 4, one card is your call Why?");
      const trigger = screen.getByRole("button", { name: "More" });
      fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });
      fireEvent.click(trigger, { button: 0 });
      const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Autofill…" }));
      const dialog = await pollFor(() =>
        screen.queryByRole("dialog", { name: "Autofill a starter shell" }),
      );
      await pollFor(() =>
        within(dialog).queryByText(
          "Skipped 1 Game Changer. Your Bracket 2 target allows none (Wizards' list)",
        ),
      );
      const [, init] = fetchMock.mock.calls.find(
        ([url, i]) => String(url) === "/api/decks/autofill" && i?.method === "POST",
      )!;
      const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;
      expect(body.budgetUsd).toBe(5);
      expect(body.goals).toEqual({ v: 1, targetLevel: 2, budget: { perCardUsd: 5 } });
      // AUTOFILL-TARGET: the target is the sheet's choice now, so the line keeps the budget alone.
      expect(dialog.querySelector("[data-slot=goals-line]")?.textContent).toBe(
        "Your goals: ≤ $5 a card",
      );
      expect(
        within(within(dialog).getByRole("group", { name: "Your target" }))
          .getAllByRole("button")
          .filter((b) => b.getAttribute("aria-pressed") === "true")
          .map((b) => b.textContent),
      ).toEqual(["2"]);
    });

    // ---------------------------------------------------------- AUTOFILL-TARGET
    /** One pick, so Add has something to add (the saved list is already full). */
    const oneShell = {
      ...emptyShell,
      picks: [
        {
          cardId: sol.id,
          name: "Sol Ring",
          zone: "main",
          qty: 1,
          group: "curve-1",
          tier: "sampled",
          score: 0.9,
          cheapestUsd: "1.00",
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
      groups: [{ id: "curve-1", label: "Mana value 1", picks: 1 }],
      notes: [],
      totals: { picks: 1, estUsd: 1, unpriced: 0 },
      cards: [sol],
    };
    const shellPosts = () =>
      fetchMock.mock.calls.filter(
        ([url, i]) => String(url) === "/api/decks/autofill" && i?.method === "POST",
      ).length;
    /** The goals PATCHes alone: a list Autofill fills also stores its first full list (FIRST-LIST). */
    const goalsBodies = () => patchBodies().filter((b) => "goals" in (b as object));
    async function openSavedSheet() {
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/decks/autofill"
          ? { ...ok(oneShell), headers: new Headers() }
          : y6bRoute(input, init),
      );
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await pollFor(() => (line()?.textContent?.endsWith("Why?") ? line() : null));
      const trigger = screen.getByRole("button", { name: "More" });
      fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
      fireEvent.mouseDown(trigger, { button: 0 });
      fireEvent.click(trigger, { button: 0 });
      const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Autofill…" }));
      const dialog = await pollFor(() =>
        screen.queryByRole("dialog", { name: "Autofill a starter shell" }),
      );
      await pollFor(() => within(dialog).queryByRole("button", { name: "Add 1 card" }));
      return dialog;
    }

    it("AUTOFILL-TARGET on a saved deck: Add is ONE PUT and ONE goals PATCH with the picked target, and the bracket line carries it", async () => {
      const dialog = await openSavedSheet();
      const choice = within(within(dialog).getByRole("group", { name: "Your target" }));
      fireEvent.click(choice.getByRole("button", { name: "4" }));
      await pollFor(() =>
        shellPosts() === 2 ? within(dialog).queryByRole("button", { name: "Add 1 card" }) : null,
      );
      // Picking is no edit.
      await settle(1500);
      await act(async () => {});
      expect(patchBodies()).toEqual([]);
      expect(puts()).toBe(0);

      fireEvent.click(within(dialog).getByRole("button", { name: "Add 1 card" }));
      const toastEl = await toastOf("Added 1 card");
      expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent).toBe(
        "Target set: Bracket 4 (Optimized). Undo takes the cards back, not the target.",
      );
      await lineIs("Your target: Bracket 4 · the cards say 3 or 4, one card is your call Why?");
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      // The PUT's rows carry their zone and copies too (lastPutEntries types the two it reads).
      const filled = lastPutEntries() as { cardId: string; zone: string; qty: number }[];
      expect(filled.some((e) => e.cardId === sol.id)).toBe(true);
      // FIRST-LIST (the owner's call 4): the deck loaded full with no
      // baseline, so its first list edit stores the list it loaded (the Add's
      // card left out) as its first full list, in the same save.
      const firstFull = {
        baseline: {
          source: "complete",
          setAt: expect.any(String),
          cards: filled
            .filter((e) => (e.zone === "commander" || e.zone === "main") && e.cardId !== sol.id)
            .map((e) => ({ cardId: e.cardId, qty: e.qty }))
            .sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0)),
        },
      };
      expect(patchBodies()).toEqual([{ goals: { v: 1, targetLevel: 4 } }, firstFull]);
      expect(posts()).toBe(0);

      // Undo: the list goes back in one PUT; the target stays, so no second
      // goals PATCH, and the first full list stays too.
      fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(2);
      expect(lastPutEntries().some((e) => e.cardId === sol.id)).toBe(false);
      expect(patchBodies()).toEqual([{ goals: { v: 1, targetLevel: 4 } }, firstFull]);
      await lineIs("Your target: Bracket 4 · the cards say 3 or 4, one card is your call Why?");
    });

    it("AUTOFILL-TARGET on a saved deck: a pick that is the deck's own target sends no goals PATCH, and the toast keeps one line", async () => {
      deckGoals = { v: 1, targetLevel: 4, exceptions: "ask me" };
      const dialog = await openSavedSheet();
      fireEvent.click(within(dialog).getByRole("button", { name: "Add 1 card" }));
      const toastEl = await toastOf("Added 1 card");
      expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent ?? "").toBe("");
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      expect(goalsBodies()).toEqual([]);
    });

    it("AUTOFILL-TARGET on a saved deck: Not set on a deck with a target clears it on Add, the exceptions kept", async () => {
      deckGoals = { v: 1, targetLevel: 4, exceptions: "ask me" };
      const dialog = await openSavedSheet();
      const choice = within(within(dialog).getByRole("group", { name: "Your target" }));
      fireEvent.click(choice.getByRole("button", { name: "Not set" }));
      await pollFor(() =>
        shellPosts() === 2 ? within(dialog).queryByRole("button", { name: "Add 1 card" }) : null,
      );
      expect(dialog.querySelector("[data-slot=autofill-target-note]")?.textContent).toBe(
        "Adding these cards clears this deck's target.",
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Add 1 card" }));
      const toastEl = await toastOf("Added 1 card");
      expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent).toBe(
        "Target cleared. Undo takes the cards back, not the target.",
      );
      await settle(1500);
      await act(async () => {});
      expect(goalsBodies()).toEqual([{ goals: { v: 1, exceptions: "ask me" } }]);
    });
  });

  describe("the conflict callout's Swap… (Y7b)", () => {
    const mindStone: CardWire = {
      ...card({
        name: "Mind Stone",
        primaryType: "Artifact",
        costValue: 2,
        attrs: { type_line: "Artifact", oracle_text: "", roles: ["mana-rock", "ramp"] },
      }),
      image: null,
    };
    const altCalls = () =>
      fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/alternatives" && init?.method === "POST",
      );
    function calloutRoute(input: RequestInfo | URL, init?: RequestInit) {
      if (String(input) === "/api/alternatives" && init?.method === "POST") {
        return ok({
          cardId: vault.id,
          roles: ["mana-rock", "ramp"],
          alternatives: [
            {
              cardId: mindStone.id,
              name: "Mind Stone",
              costValue: 2,
              cheapestUsd: null,
              evidence: [
                {
                  source: "scryfall_tagger",
                  why: "Both: ramp, mana rock. Community-tagged on Scryfall Tagger",
                  with: [],
                  howOften: null,
                  confidence: "medium",
                },
              ],
              conflicts: [],
              shared: ["ramp", "mana-rock"],
              card: { ...mindStone, legality: [] },
            },
          ],
          hidden: [],
          combosTruncated: false,
          tradeoff: null,
        });
      }
      return y4bRoute(input, init);
    }

    it("target 2: Swap Mana Vault… closes the sheet, asks under the goals, swaps in place — the conflict is gone and focus is back on the bracket line", async () => {
      deckGoals = { v: 1, targetLevel: 2 };
      fetchMock.mockImplementation(calloutRoute);
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      const dialogEl = await openSheet();
      const callout = dialogEl.querySelector<HTMLElement>("[data-slot=bracket-conflicts]")!;
      expect(callout.querySelector('[data-conflict="game-changers"]')).toBeTruthy();
      // Tectonic Edge is a land: named, never offered.
      expect(within(callout).queryByRole("button", { name: /Tectonic Edge/ })).toBeNull();
      fireEvent.click(within(callout).getByRole("button", { name: "Swap Mana Vault…" }));
      const swapEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap Mana Vault" }));
      expect(sheet()).toBeNull();
      expect(altCalls()).toHaveLength(1);
      expect(JSON.parse(altCalls()[0][1].body as string)).toMatchObject({
        cardId: vault.id,
        goals: { targetLevel: 2 },
      });
      expect(puts()).toBe(0);

      fireEvent.click(
        await pollFor(() =>
          within(swapEl).queryByRole("button", { name: "Swap Mana Vault for Mind Stone" }),
        ),
      );
      await pollFor(() => screen.queryByText("Swapped Mana Vault → Mind Stone"));
      expect(screen.queryByRole("dialog", { name: "Swap Mana Vault" })).toBeNull();
      // Focus comes back to the bracket line — its facts are being checked for
      // the new list, so "Why?" is a Tab away once they land.
      expect(document.activeElement).toBe(line());
      expect(line()?.getAttribute("data-facts")).toBe("checking");
      await settle(1500);
      await act(async () => {});
      expect(puts()).toBe(1);
      const saved = lastPutEntries() as unknown as { cardId: string; qty: number }[];
      expect(saved.map((e) => e.cardId)).toEqual([kozilek.id, mindStone.id, edge.id, wastes.id]);
      expect(saved.reduce((n, e) => n + e.qty, 0)).toBe(100);

      // The read follows the list: no Game Changer left above the target.
      const again = await openSheet();
      expect(again.querySelector('[data-conflict="game-changers"]')).toBeNull();
    });

    it("a Game Changer commander is named in the callout but never offered a swap", async () => {
      deckGoals = { v: 1, targetLevel: 2 };
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
          const saved = savedDeck(deckGoals);
          return ok({
            ...saved,
            deck: { ...saved.deck, leaderIds: [urza.id] },
            cards: [
              {
                cardId: urza.id,
                zone: "commander",
                qty: 1,
                tags: [],
                printingId: null,
                card: urza,
              },
              ...listCards.slice(1),
            ],
          });
        }
        return calloutRoute(input, init);
      });
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      const dialogEl = await openSheet();
      const gc = dialogEl.querySelector<HTMLElement>(
        '[data-slot=bracket-conflicts] [data-conflict="game-changers"]',
      )!;
      expect(gc.textContent).toContain("Urza, Lord High Artificer");
      expect(
        within(gc)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["Swap Mana Vault…"]);
    });
  });

  // ------------------------------------------------- DECK-PREVIEW-BRACKET
  describe("the Share dialog's bracket line (DECK-PREVIEW-BRACKET)", () => {
    const shareDialog = () => screen.queryByRole("dialog", { name: "Share deck" });
    const previewLine = () => document.querySelector<HTMLElement>("[data-slot=share-bracket]");
    const headerShare = () => screen.getByRole("button", { name: "Share" });
    async function openShare() {
      fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Share" })));
      return pollFor(shareDialog);
    }

    it("wide: Declare a bracket swaps the Share dialog for the sheet, focus on Your target; the sheet's close brings it back saying what previews now show, focus on Change; ONE goals PATCH; Escape hands focus to the header's Share", async () => {
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      const share = await openShare();
      expect(previewLine()!.textContent).toBe("Link previews show no bracket. Declare a bracket");

      fireEvent.click(within(share).getByRole("button", { name: "Declare a bracket" }));
      const dialog = await pollFor(sheet);
      expect(shareDialog()).toBeNull();
      await pollFor(() =>
        document.activeElement === targetButton(dialog, "Not set") ? true : null,
      );
      fireEvent.click(targetButton(dialog, "3"));
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

      const back = await pollFor(shareDialog);
      expect(sheet()).toBeNull();
      expect(previewLine()!.textContent).toBe("Link previews show Bracket 3 (declared). Change");
      const change = within(back).getByRole("button", { name: "Change" });
      await pollFor(() => (document.activeElement === change ? true : null));
      expect(line()!.textContent).toBe(
        "Your target: Bracket 3 · the cards say 3 or 4, one card is your call Why?",
      );

      await settle(1500);
      await act(async () => {});
      expect(patchBodies()).toEqual([{ goals: { v: 1, targetLevel: 3 } }]);
      expect(puts()).toBe(0);
      expect(posts()).toBe(0);

      fireEvent.keyDown(back, { key: "Escape" });
      await pollFor(() => (shareDialog() ? null : document.body));
      await pollFor(() => (document.activeElement === headerShare() ? true : null));
    });

    it("on a phone: a declared target reads Bracket 3 (declared); Change opens the Drawer on 3; Not set and its close bring the Share dialog back with no bracket, focus on Declare a bracket", async () => {
      deckGoals = { v: 1, targetLevel: 3 };
      stubViewport(375);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Your target: Bracket 3 · the cards say 3 or 4, one card is your call Why?");
      const share = await openShare();
      expect(previewLine()!.textContent).toBe("Link previews show Bracket 3 (declared). Change");

      fireEvent.click(within(share).getByRole("button", { name: "Change" }));
      const dialog = await pollFor(sheet);
      expect(dialog.getAttribute("data-slot")).toBe("drawer-popup");
      await pollFor(() => (document.activeElement === targetButton(dialog, "3") ? true : null));
      fireEvent.click(targetButton(dialog, "Not set"));
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

      const back = await pollFor(shareDialog);
      expect(previewLine()!.textContent).toBe("Link previews show no bracket. Declare a bracket");
      const declare = within(back).getByRole("button", { name: "Declare a bracket" });
      await pollFor(() => (document.activeElement === declare ? true : null));
      await settle(1500);
      await act(async () => {});
      expect(patchBodies()).toEqual([{ goals: null }]);
    });

    it("a Swap… from that sheet goes the swap sheet's way (focus back on the bracket line), and the next Why? closes to the deck, never to the Share dialog", async () => {
      deckGoals = { v: 1, targetLevel: 2 };
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/alternatives" && init?.method === "POST"
          ? ok({
              cardId: vault.id,
              roles: [],
              alternatives: [],
              hidden: [],
              combosTruncated: false,
              tradeoff: null,
            })
          : y4bRoute(input, init),
      );
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Your target: Bracket 2 · the cards say 3 or 4, one card is your call Why?");
      const share = await openShare();
      fireEvent.click(within(share).getByRole("button", { name: "Change" }));
      const dialog = await pollFor(sheet);
      fireEvent.click(within(dialog).getByRole("button", { name: "Swap Mana Vault…" }));
      const swapEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap Mana Vault" }));
      expect(shareDialog()).toBeNull();
      fireEvent.keyDown(swapEl, { key: "Escape" });
      await pollFor(() =>
        screen.queryByRole("dialog", { name: "Swap Mana Vault" }) ? null : document.body,
      );
      expect(shareDialog()).toBeNull();
      await pollFor(() => (line()!.contains(document.activeElement) ? true : null));

      const again = await openSheet();
      fireEvent.keyDown(again, { key: "Escape" });
      await pollFor(() => (sheet() ? null : document.body));
      expect(shareDialog()).toBeNull();
    });

    it("LATER row 306: Your target's note names link previews while the deck is unlisted, and drops them once the Share dialog makes it private", async () => {
      const note = (dialog: HTMLElement) =>
        within(dialog).getByRole("region", { name: "Your target" }).lastElementChild!.textContent;
      stubViewport(1440);
      render(<DeckEditor deckId="deck-1" />);
      await lineIs("Bracket 3 or 4 · one card is your call Why?");
      const first = await openSheet();
      expect(note(first)).toBe(
        "Shown on your share page. Your target also shows in link previews and where the deck is listed.",
      );
      fireEvent.keyDown(first, { key: "Escape" });
      await pollFor(() => (sheet() ? null : document.body));

      const share = await openShare();
      fireEvent.click(within(share).getByRole("radio", { name: /^Private/ }));
      await pollFor(() => (previewLine() ? null : document.body));
      expect(patchBodies()).toEqual([{ visibility: "private" }]);
      fireEvent.keyDown(share, { key: "Escape" });
      await pollFor(() => (shareDialog() ? null : document.body));

      const again = await openSheet();
      expect(note(again)).toBe(
        "Shown on your share page. Your target also shows where the deck is listed.",
      );
    });

    it("no line where the sheet can't open: a Magic list with no commander, and One Piece", async () => {
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
          const saved = savedDeck(null);
          return ok({
            ...saved,
            deck: { ...saved.deck, leaderIds: [] },
            cards: listCards.slice(1),
          });
        }
        return y4bRoute(input, init);
      });
      stubViewport(1440);
      const view = render(<DeckEditor deckId="deck-1" />);
      await openShare();
      expect(previewLine()).toBeNull();
      expect(shareDialog()!.textContent).not.toContain("Link previews");
      view.unmount();

      const nami: CardWire = {
        ...card({ name: "Nami", primaryType: "Leader", isLeaderCandidate: true, costValue: 5 }),
        image: null,
      };
      const usopp: CardWire = {
        ...card({ name: "Usopp", primaryType: "Character", costValue: 2 }),
        image: null,
      };
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
          const saved = savedDeck(null);
          return ok({
            ...saved,
            deck: { ...saved.deck, game: "optcg", format: "standard", leaderIds: [nami.id] },
            cards: [
              { cardId: nami.id, zone: "leader", qty: 1, tags: [], printingId: null, card: nami },
              { cardId: usopp.id, zone: "main", qty: 50, tags: [], printingId: null, card: usopp },
            ],
          });
        }
        return y4bRoute(input, init);
      });
      render(<DeckEditor deckId="deck-1" />);
      await openShare();
      expect(previewLine()).toBeNull();
      expect(shareDialog()!.textContent).not.toContain("Link previews");
    });
  });
});

// ------------------------------------------------------------------- Y7a
describe("DeckEditor — the Card tab's Alternatives (Y7a, WAVE4 D8)", () => {
  const tools = () => section("Card detail and suggestions");
  const odric = card({
    name: "Odric, Lunarch Marshal",
    primaryType: "Creature",
    isLeaderCandidate: true,
    ciMask: 1,
  });
  const wastes = card({ name: "Wastes", primaryType: "Land", costValue: null });
  const mindStone: CardWire = {
    ...card({
      name: "Mind Stone",
      primaryType: "Artifact",
      costValue: 2,
      cheapestUsd: 1.29,
      attrs: { type_line: "Artifact", oracle_text: "", mana_cost: "{2}", roles: [] },
    }),
    image: null,
  };
  const seedResponse = {
    deck: { name: "Swap Lab", game: "mtg", format: "commander", leaderIds: [odric.id] },
    // Sol Ring priced at $1.00, so the price chip has something to stand beside.
    cards: [odric, { ...sol, cheapestUsd: 1 }, wastes].map((c, i) => ({
      cardId: c.id,
      zone: i === 0 ? "commander" : "main",
      qty: c === wastes ? 30 : 1,
      tags: c.id === sol.id ? ["Ramp"] : [],
      printingId: null,
      card: { ...c, image: null },
    })),
  };
  const ROW = {
    cardId: mindStone.id,
    name: "Mind Stone",
    costValue: 2,
    cheapestUsd: "1.29",
    evidence: [
      {
        source: "scryfall_tagger",
        why: "Both: ramp, mana rock. Community-tagged on Scryfall Tagger",
        with: [],
        howOften: null,
        confidence: "medium",
      },
      {
        source: "edhrec_rank",
        why: "A Commander staple in EDHREC decklists",
        with: [],
        howOften: "rank 40",
        confidence: "high",
      },
    ],
    conflicts: [],
    shared: ["ramp", "mana-rock"],
    card: { ...mindStone, legality: [] },
  };
  const ANSWER = {
    cardId: sol.id,
    roles: ["ramp", "mana-rock"],
    alternatives: [ROW],
    hidden: [],
    combosTruncated: false,
    tradeoff: [
      {
        source: "edhrec_rank",
        why: "A Commander staple in EDHREC decklists. Cutting it gives up a proven card",
        with: [],
        howOften: "rank 1",
        confidence: "high",
        side: "keep",
      },
    ],
  };
  const altCalls = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/alternatives" && init?.method === "POST",
    );
  function swapRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    if (url === "/api/precons/swaplab") return ok(seedResponse);
    if (url === "/api/alternatives" && init?.method === "POST") return ok(ANSWER);
    return route(input, init);
  }
  /** The seeded draft, Sol Ring shown in the Card tab — nothing created yet. */
  async function showSolInSeededDraft() {
    fetchMock.mockImplementation(swapRoute);
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="swaplab" />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Sol Ring" }));
    await act(async () => {});
    expect(within(tools()).getByRole("heading", { name: "Sol Ring" })).toBeTruthy();
  }

  it("asks on FIRST open only, with the snapshot and the card; the swap is the draft's first edit — exactly one create; Swapped A → B · Undo restores per card", async () => {
    // React only logs a duplicate key (the pane's TagEditor and this section
    // once shared `card.id`): fail on the log.
    const consoleError = vi.spyOn(console, "error");
    await showSolInSeededDraft();
    const trigger = within(tools()).getByRole("button", { name: /^Alternatives/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(altCalls()).toHaveLength(0);

    fireEvent.click(trigger);
    await act(async () => {});
    expect(altCalls()).toHaveLength(1);
    expect(JSON.parse(altCalls()[0][1].body as string)).toEqual({
      game: "mtg",
      format: "commander",
      leaderIds: [odric.id],
      entries: [
        { cardId: sol.id, qty: 1 },
        { cardId: wastes.id, qty: 30 },
      ],
      cardId: sol.id,
    });
    const list = within(tools()).getByRole("list", { name: "Alternatives to Sol Ring" });
    expect(list.textContent).toContain("Mind Stone");
    expect(list.textContent).toContain(
      "Both: ramp, mana rock. Community-tagged on Scryfall Tagger",
    );
    // The adapter's chips, then the price beside Sol Ring's ($1.00 → $1.29).
    expect(list.textContent).toContain("Mana value 2, $0.29 more");
    expect(
      within(list)
        .getByRole("link", { name: /mana rock/ })
        .getAttribute("href"),
    ).toBe("https://tagger.scryfall.com/tags/card/mana-rock");
    expect(within(tools()).getByText(/If you cut Sol Ring/)).toBeTruthy();
    expect(within(tools()).getByRole("button", { name: /Alternatives · 1/ })).toBeTruthy();

    // Close and reopen: the answer is kept, nothing asked again; nothing minted by browsing.
    fireEvent.click(within(tools()).getByRole("button", { name: /Alternatives · 1/ }));
    await act(async () => {});
    fireEvent.click(within(tools()).getByRole("button", { name: /Alternatives · 1/ }));
    await act(async () => {});
    expect(altCalls()).toHaveLength(1);
    await settle(1500);
    expect(posts()).toBe(0);

    // The swap: one copy out, one in, in place — the deck's first real edit.
    fireEvent.click(within(tools()).getByRole("button", { name: "Swap Sol Ring for Mind Stone" }));
    const swapToast = (
      await pollFor(() => screen.queryByText("Swapped Sol Ring → Mind Stone"))
    ).closest('[data-slot="toast"]') as HTMLElement;
    expect(swapToast).toBeTruthy();
    expect(within(tools()).getByRole("heading", { name: "Mind Stone" })).toBeTruthy();
    expect(within(section("Deck list")).queryByText("Sol Ring")).toBeNull();
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
    expect(lastPutEntries()).toEqual([
      { cardId: odric.id, zone: "commander", qty: 1, tags: [] },
      { cardId: mindStone.id, zone: "main", qty: 1, tags: [] },
      { cardId: wastes.id, zone: "main", qty: 30, tags: [] },
    ]);

    // Undo is a REAL edit per card: Sol Ring back in its place with its tag, Mind Stone gone.
    fireEvent.click(within(swapToast).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toEqual([
      { cardId: odric.id, zone: "commander", qty: 1, tags: [] },
      { cardId: sol.id, zone: "main", qty: 1, tags: ["Ramp"] },
      { cardId: wastes.id, zone: "main", qty: 30, tags: [] },
    ]);
    expect(posts()).toBe(1);
    expect(consoleError.mock.calls.filter((c) => String(c[0]).includes("same key"))).toEqual([]);
    consoleError.mockRestore();
  });

  it("the deck's goals ride the request; a land and the commander get no section", async () => {
    await showSolInSeededDraft();
    fireEvent.click(within(tools()).getByRole("button", { name: /^Alternatives/ }));
    await act(async () => {});
    expect(JSON.parse(altCalls()[0][1].body as string)).not.toHaveProperty("goals");

    // The row's name button holds a problem marker too (30 fixture Wastes aren't basics).
    fireEvent.click(within(section("Deck list")).getByText("Wastes").closest("button")!);
    await act(async () => {});
    expect(within(tools()).getByRole("heading", { name: "Wastes" })).toBeTruthy();
    expect(within(tools()).queryByRole("button", { name: /^Alternatives/ })).toBeNull();
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: `Show ${odric.name}` }),
    );
    await act(async () => {});
    expect(within(tools()).queryByRole("button", { name: /^Alternatives/ })).toBeNull();
    expect(altCalls()).toHaveLength(1);
  });

  it("no commander yet: the section says so and asks nothing", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Main deck" }));
    await act(async () => {});
    fireEvent.click(within(tools()).getByRole("button", { name: /^Alternatives/ }));
    await act(async () => {});
    expect(
      within(tools()).getByText("Add a Commander first. Alternatives follow its color identity."),
    ).toBeTruthy();
    expect(altCalls()).toHaveLength(0);
  });

  it("Y7b: a draft row's Swap… opens the sheet — opening and closing mint nothing; the swap is the draft's first edit, exactly one create", async () => {
    await showSolInSeededDraft();
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Swap Sol Ring…" }));
    await pollFor(() => screen.queryByRole("dialog", { name: "Swap Sol Ring" }));
    expect(altCalls()).toHaveLength(1);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await pollFor(() =>
      screen.queryByRole("dialog", { name: "Swap Sol Ring" }) === null ? document.body : null,
    );
    await settle(1500);
    expect(posts()).toBe(0);
    // Cancelled: focus goes back to the row's own Swap….
    expect(document.activeElement).toBe(
      within(section("Deck list")).getByRole("button", { name: "Swap Sol Ring…" }),
    );

    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Swap Sol Ring…" }));
    const sheetEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap Sol Ring" }));
    fireEvent.click(
      await pollFor(() =>
        within(sheetEl).queryByRole("button", { name: "Swap Sol Ring for Mind Stone" }),
      ),
    );
    await pollFor(() => screen.queryByText("Swapped Sol Ring → Mind Stone"));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
  });

  it("One Piece declares no swap: no section, no request", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" />);
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Deck" }));
    await act(async () => {});
    // The add shows the card in the pane — in the deck, and still no section.
    expect(within(section("Deck list")).getByText("Sol Ring")).toBeTruthy();
    expect(within(tools()).getByRole("heading", { name: "Sol Ring" })).toBeTruthy();
    expect(within(tools()).queryByRole("button", { name: /^Alternatives/ })).toBeNull();
    expect(altCalls()).toHaveLength(0);
  });
});

// ------------------------------------------------------------------- Y7b
describe("DeckEditor — swap in place (Y7b, WAVE4 D8)", () => {
  const kozilek: CardWire = {
    ...card({
      name: "Kozilek, the Great Distortion",
      primaryType: "Creature",
      costValue: 10,
      isLeaderCandidate: true,
      attrs: { type_line: "Legendary Creature — Eldrazi", oracle_text: "" },
    }),
    image: null,
  };
  const wire = (
    name: string,
    costValue: number,
    {
      popularity = null,
      gameChanger = false,
    }: { popularity?: number | null; gameChanger?: boolean } = {},
  ): CardWire => ({
    ...card({
      name,
      primaryType: "Artifact",
      costValue,
      popularity,
      attrs: {
        type_line: "Artifact",
        oracle_text: "",
        ...(gameChanger ? { game_changer: true } : {}),
      },
    }),
    image: null,
  });
  const vault = wire("Mana Vault", 1, { gameChanger: true });
  // Fringe (a cut-side popularity line) and a staple (a keep line), both at mana value 2.
  const fellwar = wire("Fellwar Stone", 2, { popularity: 30_000 });
  const talisman = wire("Talisman of Dominance", 2, { popularity: 500 });
  const mindStone = wire("Mind Stone", 2);
  const wastes: CardWire = {
    ...card({
      name: "Wastes",
      primaryType: "Land",
      costValue: null,
      attrs: { type_line: "Basic Land — Wastes", oracle_text: "" },
    }),
    image: null,
  };
  const SOL_PRINTING = "cccccccc-0000-4000-8000-000000000001";
  const FELLWAR_PRINTING = "cccccccc-0000-4000-8000-000000000002";
  const row = (
    c: CardWire,
    zone: string,
    qty: number,
    tags: string[] = [],
    printingId: string | null = null,
  ) => ({
    cardId: c.id,
    zone,
    qty,
    tags,
    printingId,
    card: c,
  });
  /** Kozilek + Sol Ring (tagged, a printing) + Mana Vault + two 2-drops + 95 Wastes = 100. */
  const fullDeck = {
    deck: {
      id: "deck-1",
      publicId: "abcdefgh1234",
      game: "mtg",
      format: "commander",
      name: "Full",
      description: null,
      notes: null,
      visibility: "unlisted",
      isOwner: true,
      forkedFrom: null,
      leaderIds: [kozilek.id],
    },
    cards: [
      row(kozilek, "commander", 1),
      row(sol, "main", 1, ["Ramp"], SOL_PRINTING),
      row(vault, "main", 1),
      row(fellwar, "main", 1, ["Ramp"], FELLWAR_PRINTING),
      row(talisman, "main", 1),
      row(wastes, "main", 95),
    ],
    owned: [],
    hasCollection: false,
  };
  const ANSWER = {
    cardId: sol.id,
    roles: ["mana-rock", "ramp"],
    alternatives: [
      {
        cardId: mindStone.id,
        name: "Mind Stone",
        costValue: 2,
        cheapestUsd: null,
        evidence: [
          {
            source: "scryfall_tagger",
            why: "Both: ramp, mana rock. Community-tagged on Scryfall Tagger",
            with: [],
            howOften: null,
            confidence: "medium",
          },
        ],
        conflicts: [],
        shared: ["ramp", "mana-rock"],
        card: { ...mindStone, legality: [] },
      },
    ],
    hidden: [],
    combosTruncated: false,
    tradeoff: null,
  };
  const altCalls = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/alternatives" && init?.method === "POST",
    );
  function fullRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/decks/deck-1" && method === "GET") return ok(fullDeck);
    if (url === "/api/alternatives" && method === "POST") return ok(ANSWER);
    return route(input, init);
  }
  const deckList = () => section("Deck list");
  const total = (entries: { qty: number }[]) => entries.reduce((n, e) => n + e.qty, 0);
  /** Base UI moves a dialog's initial focus on an animation frame — real, unlike this file's timers. */
  async function focusSettles(done: () => boolean) {
    for (let i = 0; i < 20 && !done(); i++) {
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      });
    }
    expect(done()).toBe(true);
  }
  const savedRows = () =>
    lastPutEntries() as unknown as {
      cardId: string;
      zone: string;
      qty: number;
      tags: string[];
      printingId?: string;
    }[];
  async function renderFull(width = 1440) {
    fetchMock.mockImplementation(fullRoute);
    stubViewport(width);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => (factsGets().length > 0 ? true : null));
    await settle(50);
  }
  async function searchFor(query: string) {
    const input = screen.getByRole("combobox", { name: "Card search" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: query } });
    await settle();
    return input;
  }

  it("a row's Swap…: only main-list nonland cards offer it; the sheet asks once, swaps in place at 100, focus lands on the new row; one Undo restores both", async () => {
    const consoleError = vi.spyOn(console, "error");
    await renderFull();
    expect(within(deckList()).getByRole("button", { name: "Swap Sol Ring…" })).toBeTruthy();
    expect(within(deckList()).getByRole("button", { name: "Swap Mana Vault…" })).toBeTruthy();
    expect(within(deckList()).queryByRole("button", { name: "Swap Wastes…" })).toBeNull();
    expect(within(deckList()).queryByRole("button", { name: /^Swap Kozilek/ })).toBeNull();
    expect(altCalls()).toHaveLength(0);

    fireEvent.click(within(deckList()).getByRole("button", { name: "Swap Sol Ring…" }));
    const sheetEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap Sol Ring" }));
    expect(altCalls()).toHaveLength(1);
    expect(JSON.parse(altCalls()[0][1].body as string)).toMatchObject({ cardId: sol.id });
    const list = await pollFor(() =>
      within(sheetEl).queryByRole("list", { name: "Alternatives to Sol Ring" }),
    );
    expect(list.textContent).toContain(
      "Both: ramp, mana rock. Community-tagged on Scryfall Tagger",
    );
    expect(puts()).toBe(0);

    fireEvent.click(within(sheetEl).getByRole("button", { name: "Swap Sol Ring for Mind Stone" }));
    const toastEl = (
      await pollFor(() => screen.queryByText("Swapped Sol Ring → Mind Stone"))
    ).closest('[data-slot="toast"]') as HTMLElement;
    expect(screen.queryByRole("dialog", { name: "Swap Sol Ring" })).toBeNull();
    expect(document.activeElement).toBe(
      within(deckList()).getByRole("button", { name: "Swap Mind Stone…" }),
    );
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(total(savedRows())).toBe(100);
    // In place: Mind Stone takes Sol Ring's row — without its tag or printing.
    expect(savedRows()[1]).toEqual({ cardId: mindStone.id, zone: "main", qty: 1, tags: [] });

    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(total(savedRows())).toBe(100);
    expect(savedRows()[1]).toEqual({
      cardId: sol.id,
      zone: "main",
      qty: 1,
      tags: ["Ramp"],
      printingId: SOL_PRINTING,
    });
    expect(savedRows().some((e) => e.cardId === mindStone.id)).toBe(false);
    expect(posts()).toBe(0);
    expect(consoleError.mock.calls.filter((c) => String(c[0]).includes("same key"))).toEqual([]);
    consoleError.mockRestore();
  });

  it("Swap in… from search at 100 / 100: the Cut Coach's cheapest 2-drop named with its tradeoff; the swap keeps 100, clears the box and focuses it; one Undo restores both", async () => {
    await renderFull();
    const input = await searchFor("sig");
    expect(screen.getByText(/swap in/).closest("[data-slot=search-hints]")).toBeTruthy();
    // The commander's add stays an add.
    expect(screen.getByRole("button", { name: "Add Arcane Signet as Commander" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Swap in Arcane Signet…" }));
    const sheetEl = await pollFor(() =>
      screen.queryByRole("dialog", { name: "Swap in Arcane Signet" }),
    );
    expect(sheetEl.textContent).toContain(
      "Arcane Signet comes in and one card goes out, so the deck stays at 100.",
    );
    // The combo facts are in, so no combo note.
    expect(sheetEl.textContent).not.toMatch(/combos/i);
    const partner = within(sheetEl).getByRole("region", { name: "Suggested cut" });
    expect(partner.textContent).toContain("Fellwar Stone");
    expect(partner.textContent).toContain("Outside the widely-played tier of Commander cards");
    const swap = within(partner).getByRole("button", {
      name: "Swap Fellwar Stone for Arcane Signet",
    });
    // The sheet opens on the partner's Swap — Enter, Enter from the search box.
    await focusSettles(() => document.activeElement === swap);

    // Choose another: the staple at the same mana value, then everything else on request.
    fireEvent.click(within(sheetEl).getByRole("button", { name: "Choose another card" }));
    await act(async () => {});
    const same = within(sheetEl).getByRole("region", { name: "Also at mana value 2" });
    expect(same.textContent).toContain("Talisman of Dominance");
    fireEvent.click(within(sheetEl).getByRole("button", { name: "Show the other 3 cards" }));
    expect(
      within(within(sheetEl).getByRole("list", { name: "Other cards" }))
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Swap Mana Vault for Arcane Signet",
      "Swap Sol Ring for Arcane Signet",
      "Swap Wastes for Arcane Signet",
    ]);
    expect(puts()).toBe(0);

    fireEvent.click(swap);
    const toastEl = (
      await pollFor(() => screen.queryByText("Swapped Fellwar Stone → Arcane Signet"))
    ).closest('[data-slot="toast"]') as HTMLElement;
    expect(screen.queryByRole("dialog", { name: "Swap in Arcane Signet" })).toBeNull();
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(total(savedRows())).toBe(100);
    expect(savedRows()[3]).toEqual({ cardId: signet.id, zone: "main", qty: 1, tags: [] });

    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(total(savedRows())).toBe(100);
    expect(savedRows()[3]).toEqual({
      cardId: fellwar.id,
      zone: "main",
      qty: 1,
      tags: ["Ramp"],
      printingId: FELLWAR_PRINTING,
    });
    expect(savedRows().some((e) => e.cardId === signet.id)).toBe(false);
  });

  it("Enter at 100 / 100 opens the sheet, never an add; Escape changes nothing and hands focus back to the box", async () => {
    await renderFull();
    const input = await searchFor("sig");
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    const sheetEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap in Sol Ring" }));
    await focusSettles(() => sheetEl.contains(document.activeElement));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await pollFor(() =>
      screen.queryByRole("dialog", { name: "Swap in Sol Ring" }) === null ? true : null,
    );
    await act(async () => {});
    expect(input.value).toBe("sig");
    expect(document.activeElement).toBe(input);
    await settle(1500);
    expect(puts()).toBe(0);
    expect(document.querySelector('[data-slot="toast"]')).toBeNull();
  });

  it("a land coming in names no partner and says why; every card stays choosable", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/cards/search")) return ok({ results: [wastes] });
      return fullRoute(input, init);
    });
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => (factsGets().length > 0 ? true : null));
    await searchFor("wastes");
    fireEvent.click(screen.getByRole("button", { name: "Swap in Wastes…" }));
    const sheetEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap in Wastes" }));
    expect(within(sheetEl).queryByRole("region", { name: "Suggested cut" })).toBeNull();
    expect(sheetEl.textContent).toContain(
      "A land gets no suggested partner. Which land to cut depends on its colors. Choose the card to cut.",
    );
    // Wastes itself is never its own partner.
    expect(
      within(within(sheetEl).getByRole("list", { name: "Every card" }))
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Swap Fellwar Stone for Wastes",
      "Swap Talisman of Dominance for Wastes",
      "Swap Mana Vault for Wastes",
      "Swap Sol Ring for Wastes",
    ]);
  });

  it("on a phone the swap-in sheet is the bottom Drawer, opened on the partner's Swap (not its Close)", async () => {
    await renderFull(375);
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    await searchFor("sig");
    fireEvent.click(screen.getByRole("button", { name: "Swap in Arcane Signet…" }));
    const sheetEl = await pollFor(() =>
      screen.queryByRole("dialog", { name: "Swap in Arcane Signet" }),
    );
    expect(sheetPopup()).toBeTruthy();
    const swap = within(sheetEl).getByRole("button", {
      name: "Swap Fellwar Stone for Arcane Signet",
    });
    await focusSettles(() => document.activeElement === swap);
  });

  it("One Piece declares no swap: a full deck's add stays an add, and no row has Swap…", async () => {
    const leader = {
      ...card({ name: "Nami", primaryType: "Leader", isLeaderCandidate: true, costValue: 5 }),
      image: null,
    };
    const filler = {
      ...card({ name: "Usopp", primaryType: "Character", costValue: 2 }),
      image: null,
    };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/deck-1" && (init?.method ?? "GET") === "GET") {
        return ok({
          ...fullDeck,
          deck: { ...fullDeck.deck, game: "optcg", format: "standard", leaderIds: [leader.id] },
          cards: [row(leader, "leader", 1), row(filler, "main", 50)],
        });
      }
      return route(input, init);
    });
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => (deckList() ? within(deckList()).queryByText("Usopp") : null));
    expect(within(deckList()).queryByRole("button", { name: /^Swap/ })).toBeNull();
    await searchFor("sol");
    expect(screen.getByRole("button", { name: "Add Sol Ring to Deck" }).textContent).toBe("Add");
    expect(screen.queryByRole("button", { name: /Swap in/ })).toBeNull();
  });
});

// -------------------------------------------------------------------- Y8
describe("DeckEditor — Fit my budget (Y8, WAVE4 D9)", () => {
  /** Base UI menu triggers open on the pointer sequence, not a bare click. */
  function openMenu(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
  }
  const wire = (over: Parameters<typeof card>[0]): CardWire => ({ ...card(over), image: null });
  const odric = wire({
    name: "Odric, Lunarch Marshal",
    primaryType: "Creature",
    isLeaderCandidate: true,
    ciMask: 1,
    cheapestUsd: 20,
  });
  const rock = (name: string, usd: number) =>
    wire({
      name,
      primaryType: "Artifact",
      costValue: 2,
      cheapestUsd: usd,
      attrs: { type_line: "Artifact", oracle_text: "", mana_cost: "{2}", roles: ["ramp"] },
    });
  // $20 + $40 + $30 + $25 + 30 × $0.10 = est. $118.
  const PRICEY = [rock("Pricey Rock A", 40), rock("Pricey Rock B", 30), rock("Pricey Rock C", 25)];
  const wastes = wire({ name: "Wastes", primaryType: "Land", costValue: null, cheapestUsd: 0.1 });
  const LIST = [odric, ...PRICEY, wastes].map((c, i) => ({
    cardId: c.id,
    zone: i === 0 ? "commander" : "main",
    qty: c === wastes ? 30 : 1,
    tags: [],
    printingId: null,
    card: c,
  }));
  /** Each pricey rock's alternatives: the best-ranked at $1.00, a cheaper one after it. */
  const ALTS = new Map(
    PRICEY.map((c, i) => {
      const alts = [1, 0.5].map((usd, j) =>
        rock(`Budget Rock ${String.fromCharCode(65 + i)}${j + 1}`, usd),
      );
      return [c.id, alts];
    }),
  );
  const altRow = (c: CardWire) => ({
    cardId: c.id,
    name: c.name,
    costValue: 2,
    cheapestUsd: c.cheapestUsd!.toFixed(2),
    evidence: [],
    conflicts: [],
    shared: ["ramp"],
    card: { ...c, legality: [] },
  });
  let deckGoals: unknown = null;
  function fitRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/precons/fitlab") {
      return ok({
        deck: { name: "Fit Lab", game: "mtg", format: "commander", leaderIds: [odric.id] },
        cards: LIST,
      });
    }
    if (url === "/api/decks/deck-1" && method === "GET") {
      return ok({
        deck: {
          id: "deck-1",
          publicId: "abcdefgh1234",
          game: "mtg",
          format: "commander",
          name: "Fit Lab",
          description: null,
          notes: null,
          visibility: "unlisted",
          isOwner: true,
          forkedFrom: null,
          leaderIds: [odric.id],
          goals: deckGoals,
        },
        cards: LIST,
        owned: [],
        hasCollection: false,
      });
    }
    if (url === "/api/alternatives" && method === "POST") {
      const { cardId } = JSON.parse(init!.body as string);
      return ok({
        cardId,
        roles: ["ramp"],
        alternatives: (ALTS.get(cardId) ?? []).map(altRow),
        hidden: [],
        combosTruncated: false,
        tradeoff: null,
      });
    }
    return route(input, init);
  }
  const altCalls = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/alternatives" && init?.method === "POST",
    );
  const patchBodies = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => url === "/api/decks/deck-1" && init?.method === "PATCH")
      .map(([, init]) => JSON.parse((init as RequestInit).body as string) as unknown);
  const fitSheet = () => screen.queryByRole("dialog", { name: "Fit my budget" });
  const ORIGINAL = LIST.map(({ cardId, zone, qty }) => ({ cardId, zone, qty, tags: [] }));

  beforeEach(() => {
    deckGoals = null;
    fetchMock.mockImplementation(fitRoute);
  });

  it("a seeded draft: opening, setting a total and reviewing mint nothing; Apply is ONE create carrying the total + ONE PUT; the toast's one Undo restores the whole list", async () => {
    stubViewport(1440);
    render(
      <DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" draftFromSlug="fitlab" />,
    );
    await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" }));
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Fit my budget…" }));
    const sheetEl = await pollFor(fitSheet);
    expect(sheetEl.textContent).toContain("est. $118 now (cheapest printings)");
    expect(altCalls()).toHaveLength(0);

    fireEvent.change(within(sheetEl).getByRole("textbox", { name: "Deck total" }), {
      target: { value: "60" },
    });
    fireEvent.click(within(sheetEl).getByRole("button", { name: "Fit" }));
    const apply = await pollFor(() => {
      const b = within(sheetEl).queryByRole("button", { name: "Swap 2 cards" });
      return b && !(b as HTMLButtonElement).disabled ? b : null;
    });
    // The three priciest asked together; 118 − 39 − 29 = 50 fits after two.
    expect(altCalls()).toHaveLength(3);
    expect(sheetEl.querySelector("[data-slot=fit-after]")!.textContent).toBe(
      "est. $50 of your $60",
    );
    await settle(1500);
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);

    fireEvent.click(apply);
    const toastEl = (await pollFor(() => screen.queryByText("Swapped 2 cards"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    expect(fitSheet()).toBeNull();
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    const create = JSON.parse(
      fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )![1].body as string,
    );
    expect(create.goals).toEqual({ v: 1, budget: { totalUsd: 60 } });
    expect(puts()).toBe(1);
    const [a1, b1] = [ALTS.get(PRICEY[0].id)![0], ALTS.get(PRICEY[1].id)![0]];
    expect(lastPutEntries()).toEqual([
      ORIGINAL[0],
      { cardId: a1.id, zone: "main", qty: 1, tags: [] },
      { cardId: b1.id, zone: "main", qty: 1, tags: [] },
      ORIGINAL[3],
      ORIGINAL[4],
    ]);
    expect(within(section("Deck list")).getByText("Budget Rock A1")).toBeTruthy();

    // One Undo for the batch: the whole list back exactly; the total stays (a goal, not the list).
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toEqual(ORIGINAL);
    expect(posts()).toBe(1);
    expect(patchBodies()).toEqual([]);
  });

  it("a saved deck's total survives the reload: the goals line reads est. $118 of your $60 Fit my budget, which opens the sheet at once — loading is no edit", async () => {
    deckGoals = { v: 1, budget: { totalUsd: 60 } };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("tab", { name: "Suggestions" })));
    const goalsLine = await pollFor(() =>
      document.querySelector<HTMLElement>("[data-slot=goals-line]"),
    );
    expect(goalsLine.textContent).toBe("Your goals: est. $118 of your $60 Fit my budget Change");
    fireEvent.click(within(goalsLine).getByRole("button", { name: "Fit my budget" }));
    const sheetEl = await pollFor(fitSheet);
    // A saved total: the plan starts without asking for one.
    expect(sheetEl.textContent).toContain("Deck total $60");
    await pollFor(() => within(sheetEl).queryByRole("button", { name: "Swap 2 cards" }));
    expect(altCalls()).toHaveLength(3);
    // The asks carry no total: no route reads it.
    expect(JSON.parse(altCalls()[0][1].body as string)).not.toHaveProperty("goals");
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([]);
    expect(puts()).toBe(0);

    // Removing the total is ONE goals PATCH — no PUT.
    fireEvent.click(within(sheetEl).getByRole("button", { name: "Remove this deck's total" }));
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ goals: null }]);
    expect(puts()).toBe(0);
  });

  it("from the goals line, focus comes back to the line: its Fit my budget on a cancel, its Change once the deck fits", async () => {
    deckGoals = { v: 1, budget: { totalUsd: 60 } };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("tab", { name: "Suggestions" })));
    const line = () =>
      [...document.querySelectorAll<HTMLElement>("[data-slot=goals-line]")].find(
        (l) => !l.closest("[hidden]"),
      ) ?? null;
    const door = await pollFor(() =>
      line() ? within(line()!).queryByRole("button", { name: "Fit my budget" }) : null,
    );
    fireEvent.click(door);
    await pollFor(fitSheet);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await pollFor(() => (fitSheet() === null ? document.body : null));
    await pollFor(() =>
      document.activeElement?.textContent === "Fit my budget" ? document.activeElement : null,
    );
    expect(line()!.contains(document.activeElement)).toBe(true);

    fireEvent.click(within(line()!).getByRole("button", { name: "Fit my budget" }));
    const sheetEl = await pollFor(fitSheet);
    fireEvent.click(
      await pollFor(() => {
        const b = within(sheetEl).queryByRole("button", { name: "Swap 2 cards" });
        return b && !(b as HTMLButtonElement).disabled ? b : null;
      }),
    );
    await pollFor(() => screen.queryByText("Swapped 2 cards"));
    // Under the total now: the door is gone and focus lands on the line's Change.
    expect(line()!.textContent).toBe("Your goals: est. $50 of your $60 Change");
    await pollFor(() =>
      document.activeElement?.textContent === "Change" ? document.activeElement : null,
    );
    expect(line()!.contains(document.activeElement)).toBe(true);
  });

  it("under the total the line has no door; a total saved alone is ONE goals PATCH", async () => {
    deckGoals = { v: 1, budget: { totalUsd: 200 } };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("tab", { name: "Suggestions" })));
    const goalsLine = await pollFor(() =>
      document.querySelector<HTMLElement>("[data-slot=goals-line]"),
    );
    expect(goalsLine.textContent).toBe("Your goals: est. $118 of your $200 Change");
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Fit my budget…" }));
    const sheetEl = await pollFor(fitSheet);
    expect(sheetEl.textContent).toContain("Already within your budget: est. $118 of your $200.");
    fireEvent.click(within(sheetEl).getByRole("button", { name: "Change" }));
    fireEvent.click(within(sheetEl).getByRole("button", { name: "$150" }));
    fireEvent.click(
      within(sheetEl).getByRole("button", { name: "Save $150 as this deck's total" }),
    );
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ goals: { budget: { totalUsd: 150 }, v: 1 } }]);
    expect(puts()).toBe(0);
    expect(altCalls()).toHaveLength(0);
  });

  // -------------------------------------------------- AUTOFILL-TOTAL (saved) --
  it("AUTOFILL-TOTAL: on a saved deck the sheet opens on the deck's total; Add with another saves it in ONE goals PATCH beside the ONE PUT; Undo leaves it; after a reload the goals line reads against it and Fit my budget opens on it", async () => {
    const pebble = rock("Pebble", 1);
    const shell = {
      game: "mtg",
      format: "commander",
      seed: 7,
      picks: [
        {
          cardId: pebble.id,
          name: "Pebble",
          zone: "main",
          qty: 1,
          group: "curve-2",
          tier: "fit",
          score: 0.5,
          cheapestUsd: "1.00",
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
      groups: [{ id: "curve-2", label: "Mana value 2", picks: 1 }],
      notes: [],
      totals: { picks: 1, estUsd: 1, unpriced: 0 },
      issues: [],
      cards: [...LIST.map((row) => row.card), pebble],
    };
    const asked: { totalUsd?: number; goals?: unknown }[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/decks/autofill") {
        const body = JSON.parse(init!.body as string) as { totalUsd?: number; goals?: unknown };
        asked.push(body);
        return {
          ...ok(
            body.totalUsd === undefined
              ? shell
              : {
                  ...shell,
                  // The list as it stands, $118, as the route would price it.
                  deck: {
                    totalUsd: body.totalUsd,
                    estUsd: 119,
                    unpriced: 0,
                    keptUsd: 118,
                    keptUnpriced: 0,
                  },
                },
          ),
          headers: new Headers(),
        };
      }
      return fitRoute(input, init);
    });
    deckGoals = { v: 1, budget: { totalUsd: 200 } };
    stubViewport(1440);
    const first = render(<DeckEditor deckId="deck-1" />);
    openMenu(await pollFor(() => screen.queryByRole("button", { name: "More" })));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Autofill…" }));
    const sheetEl = await pollFor(() =>
      screen.queryByRole("dialog", { name: "Autofill a starter shell" }),
    );
    await pollFor(() => within(sheetEl).queryByRole("button", { name: "Add 1 card" }));
    // The ONE opening ask carries the deck's total, apart from its goals.
    expect(asked).toHaveLength(1);
    expect(asked[0].totalUsd).toBe(200);
    expect(asked[0].goals).toBeUndefined();
    const form = sheetEl.querySelector<HTMLFormElement>("[data-slot=deck-total]")!;
    expect((within(form).getByLabelText("Deck total") as HTMLInputElement).value).toBe("200");
    expect(sheetEl.querySelector("[data-slot=autofill-estimate]")?.textContent).toBe(
      "Deck total: est. $119 of your $200",
    );
    expect(sheetEl.querySelector("[data-slot=autofill-total-note]")).toBeNull();

    fireEvent.click(within(form).getByRole("button", { name: "$150" }));
    await pollFor(() =>
      asked.length === 2 ? within(sheetEl).queryByRole("button", { name: "Add 1 card" }) : null,
    );
    expect(sheetEl.querySelector("[data-slot=autofill-total-note]")?.textContent).toBe(
      "Adding these cards changes this deck's total from $200 to $150. Only you see a deck's total.",
    );
    // Opening and picking wrote nothing.
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(0);
    expect(patchBodies()).toEqual([]);

    fireEvent.click(within(sheetEl).getByRole("button", { name: "Add 1 card" }));
    const toastEl = (await pollFor(() => screen.queryByText("Added 1 card"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    expect(toastEl.querySelector("[data-slot=toast-description]")?.textContent).toBe(
      "Deck total changed from $200 to $150. Undo takes the cards back, not the total.",
    );
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(1);
    expect(lastPutEntries()).toHaveLength(ORIGINAL.length + 1);
    expect(patchBodies()).toEqual([{ goals: { budget: { totalUsd: 150 }, v: 1 } }]);

    // Undo takes the cards back: one more PUT, the list as it was, and no second PATCH.
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await settle(1500);
    await act(async () => {});
    expect(puts()).toBe(2);
    expect(lastPutEntries()).toEqual(ORIGINAL);
    expect(patchBodies()).toHaveLength(1);

    // The reload: the deck as that PATCH saved it.
    deckGoals = (patchBodies()[0] as { goals: unknown }).goals;
    first.unmount();
    render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("tab", { name: "Suggestions" })));
    const goalsLine = await pollFor(() =>
      document.querySelector<HTMLElement>("[data-slot=goals-line]"),
    );
    expect(goalsLine.textContent).toBe("Your goals: est. $118 of your $150 Change");
    openMenu(screen.getByRole("button", { name: "More" }));
    const again = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(again).getByRole("menuitem", { name: "Fit my budget…" }));
    const fitEl = await pollFor(fitSheet);
    expect(fitEl.textContent).toContain("Deck total $150");
    expect(fitEl.textContent).toContain("Already within your budget: est. $118 of your $150.");
  });
  // ---------------------------------------------- end AUTOFILL-TOTAL (saved) --

  it("One Piece declares no swap: no Fit my budget in More", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" />);
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    expect(within(menu).queryByRole("menuitem", { name: "Fit my budget…" })).toBeNull();
  });
});

// ------------------------------------------------------------------- Y9a
describe("DeckEditor — Games… (Y9a, WAVE4 D10)", () => {
  /** Base UI menu triggers open on the pointer sequence, not a bare click. */
  function openMenu(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
  }
  const logged = (over: Record<string, unknown> = {}) => ({
    game: {
      id: 42,
      version: 8,
      playedOn: "2026-10-10",
      podSize: 4,
      result: "win",
      endTurn: null,
      tableLevel: null,
      seat: null,
      opponents: null,
      notes: null,
      createdAt: "2026-10-10T20:00:00.000Z",
    },
    version: 8,
    minted: true,
    capped: false,
    ...over,
  });
  let logAnswer = logged();
  function gamesRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/decks/deck-1" && method === "GET") {
      return ok({
        deck: {
          id: "deck-1",
          publicId: "abcdefgh1234",
          game: "mtg",
          format: "commander",
          name: "Saved",
          description: null,
          notes: null,
          visibility: "unlisted",
          isOwner: true,
          forkedFrom: null,
          leaderIds: [],
        },
        cards: [sol, signet].map((c) => ({
          cardId: c.id,
          zone: "main",
          qty: 1,
          tags: [],
          printingId: null,
          card: c,
        })),
        owned: [],
        hasCollection: false,
      });
    }
    if (url === "/api/decks/deck-1/games" && method === "GET") {
      return ok({
        games: [],
        total: 0,
        playedSnapshots: 0,
        playedAllowance: 100,
        record: [],
        lists: [],
        names: {},
      });
    }
    if (url === "/api/decks/deck-1/games" && method === "POST") {
      return { ok: true, status: 201, json: async () => logAnswer };
    }
    if (url === "/api/decks/deck-1/games/42" && method === "DELETE") {
      return ok({ deleted: true, snapshotRemoved: true });
    }
    return route(input, init);
  }
  /** Every request after the hydrate, in order: "METHOD url". */
  const traffic = () =>
    fetchMock.mock.calls.map(
      ([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url)}`,
    );
  const gamesDialog = () => screen.queryByRole("dialog", { name: "Games" });

  beforeEach(() => {
    logAnswer = logged();
    fetchMock.mockImplementation(gamesRoute);
  });

  async function openGames() {
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Games…" }));
    return pollFor(gamesDialog);
  }

  it("an unsaved edit is saved BEFORE the log; the dialog closes for the toast, whose Undo deletes the game", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "One more Sol Ring" }),
    );
    expect(saveStatus()).toBe("dirty");
    const dialog = await openGames();
    fireEvent.click(within(dialog).getByRole("button", { name: "Won" }));
    const toastEl = (await pollFor(() => screen.queryByText("Logged a win"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    const sent = traffic();
    const put = sent.indexOf("PUT /api/decks/deck-1/cards");
    const log = sent.indexOf("POST /api/decks/deck-1/games");
    expect(put).toBeGreaterThan(-1);
    expect(log).toBeGreaterThan(put);
    expect(saveStatus()).toBe("saved");
    expect(gamesDialog()).toBeNull();

    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await act(async () => {});
    expect(traffic()).toContain("DELETE /api/decks/deck-1/games/42");
  });

  it("a save that fails logs nothing — the dialog stays and says so", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === "/api/decks/deck-1/cards" && init?.method === "PUT"
        ? { ok: false, status: 500, json: async () => ({}) }
        : gamesRoute(input, init),
    );
    fireEvent.click(
      within(section("Deck list")).getByRole("button", { name: "One more Sol Ring" }),
    );
    const dialog = await openGames();
    fireEvent.click(within(dialog).getByRole("button", { name: "Won" }));
    await pollFor(() =>
      dialog.textContent?.includes("Your latest changes didn't save") ? dialog : null,
    );
    expect(traffic()).not.toContain("POST /api/decks/deck-1/games");
    expect(gamesDialog()).not.toBeNull();
  });

  it("at the played allowance the toast says the game keeps no list of its own", async () => {
    logAnswer = logged({ version: null, minted: false, capped: true });
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    const dialog = await openGames();
    fireEvent.click(within(dialog).getByRole("button", { name: "Won" }));
    await pollFor(() =>
      screen.queryByText(
        "This deck already keeps 100 played lists, so this game keeps no list of its own.",
      ),
    );
  });

  it("a guest deck (its key in this browser) reads the sign-in sentence and asks nothing", async () => {
    window.localStorage.setItem("deckwarden:deck-token:deck-1", "token-1");
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await act(async () => {});
    await act(async () => {});
    const dialog = await openGames();
    expect(
      within(dialog).getByRole("link", { name: "Sign in to keep a game journal" }),
    ).toBeTruthy();
    expect(traffic().some((t) => t.includes("/games"))).toBe(false);
  });

  it("a draft has no Games… (a game logs against a saved list)", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    expect(within(menu).queryByRole("menuitem", { name: "Games…" })).toBeNull();
  });
});

describe("the Tokens section's Hide (TOKEN-FILL)", () => {
  const TREASURE = "aaaaaaaa-0000-4000-8000-00000000f001";
  const brago: CardWire = {
    ...card({
      name: "Brago, King Eternal",
      primaryType: "Creature",
      costValue: 4,
      isLeaderCandidate: true,
      attrs: { type_line: "Legendary Creature — Spirit", oracle_text: "" },
    }),
    image: null,
  };
  const tithe: CardWire = {
    ...card({
      name: "Smothering Tithe",
      primaryType: "Enchantment",
      costValue: 4,
      attrs: { type_line: "Enchantment", oracle_text: "", tokens: [TREASURE] },
    }),
    image: null,
  };
  const treasure: CardWire = {
    ...card({
      name: "Treasure",
      externalKey: TREASURE,
      primaryType: "Artifact",
      costValue: 0,
      attrs: { type_line: "Token Artifact — Treasure", oracle_text: "", is_token: true },
    }),
    image: null,
  };
  let hiddenTokens: string[] | null = null;
  const deckJson = () => ({
    deck: {
      id: "deck-1",
      publicId: "abcdefgh1234",
      game: "mtg",
      format: "commander",
      name: "Brago",
      description: null,
      notes: null,
      visibility: "unlisted",
      isOwner: true,
      forkedFrom: null,
      leaderIds: [brago.id],
      goals: null,
      hiddenTokens,
    },
    cards: [
      { cardId: brago.id, zone: "commander", qty: 1, tags: [], printingId: null, card: brago },
      { cardId: tithe.id, zone: "main", qty: 1, tags: [], printingId: null, card: tithe },
    ],
    owned: [],
    hasCollection: false,
  });
  function fillRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/decks/deck-1" && method === "GET") return ok(deckJson());
    if (url === "/api/cards/resolve") {
      const { names } = JSON.parse(String(init?.body)) as { names: string[] };
      return ok({ results: names.map((k) => ({ match: k === TREASURE ? treasure : null })) });
    }
    return route(input, init);
  }
  const patchBodies = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => url === "/api/decks/deck-1" && init?.method === "PATCH")
      .map(([, init]) => JSON.parse((init as RequestInit).body as string) as unknown);

  beforeEach(() => {
    hiddenTokens = null;
    fetchMock.mockImplementation(fillRoute);
    window.localStorage.setItem("deckwarden:deck-view", JSON.stringify({ tokensOpen: true }));
  });

  it("Hide on a derived row is ONE PATCH {hiddenTokens} after the debounce — no PUT, no meta PATCH; the chip's Show PATCHes null", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    const hide = await pollFor(() => screen.queryByRole("button", { name: "Hide Treasure" }));
    fireEvent.click(hide);
    // The row goes at once; the chip stands in — no request for that.
    expect(screen.queryByRole("button", { name: "Hide Treasure" })).toBeNull();
    await pollFor(() => screen.queryByRole("button", { name: "Show Treasure" }));
    expect(patchBodies()).toEqual([]);
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ hiddenTokens: [TREASURE] }]);
    expect(puts()).toBe(0);
    expect(posts()).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Show Treasure" }));
    await pollFor(() => screen.queryByRole("button", { name: "Hide Treasure" }));
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ hiddenTokens: [TREASURE] }, { hiddenTokens: null }]);
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("saved");
  });

  it("a hidden key survives a reload: the deck GET's keys show the chip, and loading is no edit", async () => {
    hiddenTokens = [TREASURE];
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => screen.queryByRole("button", { name: "Show Treasure" }));
    expect(screen.queryByRole("button", { name: "Hide Treasure" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Tokens/ }).textContent).toBe("Tokens0");
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([]);
    expect(puts()).toBe(0);
  });
});

// ------------------------------------------------------------ PRECON-OWNED
describe("DeckEditor — Do you own this precon? (PRECON-OWNED)", () => {
  /** Base UI menu triggers open on the pointer sequence, not a bare click. */
  function openMenu(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
  }
  const wire = (over: Parameters<typeof card>[0]): CardWire => ({ ...card(over), image: null });
  const atraxa = wire({
    name: "Atraxa, Praetors' Voice",
    primaryType: "Creature",
    isLeaderCandidate: true,
    ciMask: 15,
    cheapestUsd: 5,
  });
  const forest = wire({
    name: "Forest",
    primaryType: "Land",
    costValue: null,
    cheapestUsd: 2.5,
    attrs: { type_line: "Basic Land — Forest", oracle_text: "" },
  });
  const rock = (name: string, usd: number) =>
    wire({
      name,
      primaryType: "Artifact",
      costValue: 2,
      cheapestUsd: usd,
      attrs: { type_line: "Artifact", oracle_text: "", mana_cost: "{2}", roles: ["ramp"] },
    });
  const ring = rock("Arcane Ring", 1.5);
  const ROCKS = Array.from({ length: 86 }, (_, i) => rock(`Precon Rock ${i + 1}`, 1));
  const row = (c: CardWire, zone: string, qty = 1) => ({
    cardId: c.id,
    zone,
    qty,
    tags: [],
    printingId: null,
    card: c,
  });
  // 100 cards, $122.50 at cheapest printings: $5 + 12 × $2.50 + $1.50 + 86 × $1.
  const PRECON_LIST = [
    row(atraxa, "commander"),
    row(forest, "main", 12),
    row(ring, "main"),
    ...ROCKS.map((c) => row(c, "main")),
  ];
  const PRECON_CARDS = PRECON_LIST.map(({ cardId, qty }) => ({ cardId, qty }));
  const preconSeed = {
    precon: {
      slug: "breed_lethality_c16",
      code: "BreedLethality_C16",
      setCode: "C16",
      setName: "Commander 2016",
      releaseDate: "2016-11-11",
      productName: "Breed Lethality",
    },
    deck: {
      publicId: "p_breed_lethality_c16",
      name: "Breed Lethality",
      description: null,
      game: "mtg",
      format: "commander",
      leaderIds: [atraxa.id],
      ciMask: 15,
    },
    cards: PRECON_LIST,
  };
  let saved: { precon: unknown; cards: unknown[]; goals: unknown } = {
    precon: null,
    cards: PRECON_LIST,
    goals: null,
  };
  function preconRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/precons/breed_lethality_c16") return ok(preconSeed);
    if (url === "/api/decks/deck-1" && method === "GET") {
      return ok({
        deck: {
          id: "deck-1",
          publicId: "abcdefgh1234",
          game: "mtg",
          format: "commander",
          name: "Breed Lethality",
          description: null,
          notes: null,
          visibility: "unlisted",
          isOwner: true,
          forkedFrom: null,
          leaderIds: [atraxa.id],
          goals: saved.goals,
          precon: saved.precon,
        },
        cards: saved.cards,
        owned: [],
        hasCollection: false,
      });
    }
    return route(input, init);
  }
  const line = () => document.querySelector<HTMLElement>("[data-slot=precon-line]");
  const ownershipEl = () => screen.queryByTestId("ownership-line");
  const patchBodies = () =>
    fetchMock.mock.calls
      .filter(([url, init]) => url === "/api/decks/deck-1" && init?.method === "PATCH")
      .map(([, init]) => JSON.parse((init as RequestInit).body as string) as unknown);
  const createBody = () =>
    JSON.parse(
      fetchMock.mock.calls.find(
        ([url, init]) => url === "/api/decks" && init?.method === "POST",
      )![1]!.body as string,
    ) as Record<string, unknown>;
  const draft = () => (
    <DeckEditor
      deckId={null}
      draftGame="mtg"
      draftFormat="commander"
      draftFromSlug="breed_lethality_c16"
    />
  );

  beforeEach(() => {
    saved = { precon: null, cards: PRECON_LIST, goals: null };
    fetchMock.mockImplementation(preconRoute);
  });

  it("a precon draft asks with its list and writes nothing; Yes mints ONE row carrying fromPrecon and the answer, one PUT, no PATCH", async () => {
    stubViewport(1440);
    render(draft());
    const asked = await pollFor(line);
    // The line came with the list, in the seed's own commit.
    expect(within(section("Deck list")).getByText("Precon Rock 1")).toBeTruthy();
    expect(asked.textContent).toBe("Started from Breed Lethality, a precon. Do you own it? Yes No");
    expect(asked.getAttribute("data-state")).toBe("asking");
    // Unanswered, with no collection: no ownership line yet.
    expect(ownershipEl()).toBeNull();
    await settle(1500);
    expect(posts()).toBe(0);
    expect(puts()).toBe(0);
    expect(saveStatus()).toBe("saved");

    fireEvent.click(within(asked).getByRole("button", { name: "Yes" }));
    expect(line()!.textContent).toBe("Started from Breed Lethality, a precon you own. Change");
    expect(document.activeElement).toBe(within(line()!).getByRole("button", { name: "Change" }));
    // Without a collection, the precon alone: the unchanged list is all owned.
    expect(ownershipEl()!.textContent).toBe("You own 100/100 · nothing missing ·");
    expect(ownershipEl()!.getAttribute("title")).toBe(
      "Cards from the precon you own count as owned, up to the precon's own quantities. Missing cost = cheapest listed printing per card; cards without a price are excluded and counted.",
    );
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(createBody()).toMatchObject({
      game: "mtg",
      format: "commander",
      name: "Breed Lethality",
      fromPrecon: "breed_lethality_c16",
      ownsPrecon: true,
    });
    expect(puts()).toBe(1);
    expect(patchBodies()).toEqual([]);
    // No localStorage holds the answer: the row does.
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/ownsPrecon|owns_precon/);
  });

  it("Change asks again and is no edit; No after it is ONE PATCH {ownsPrecon: false}, and the line and the ownership line follow", async () => {
    stubViewport(1440);
    render(draft());
    fireEvent.click(within(await pollFor(line)).getByRole("button", { name: "Yes" }));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);

    fireEvent.click(within(line()!).getByRole("button", { name: "Change" }));
    expect(line()!.textContent).toBe(
      "Started from Breed Lethality, a precon. Do you own it? Yes No",
    );
    expect(document.activeElement).toBe(within(line()!).getByRole("button", { name: "Yes" }));
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([]);
    // The saved answer stands until a pick: the price still counts the precon.
    expect(ownershipEl()!.textContent).toBe("You own 100/100 · nothing missing ·");

    fireEvent.click(within(line()!).getByRole("button", { name: "No" }));
    expect(line()!.textContent).toBe(
      "Started from Breed Lethality, a precon you don't own. Change",
    );
    expect(line()!.getAttribute("data-state")).toBe("not-owned");
    expect(ownershipEl()).toBeNull();
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ ownsPrecon: false }]);
    expect(posts()).toBe(1);
    expect(puts()).toBe(1);
  });

  it("whatever edit mints a precon draft, its create carries fromPrecon: Keep this deck sends no answer, and a later Yes is ONE PATCH", async () => {
    stubViewport(1440);
    render(draft());
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Keep this deck" })));
    await settle(1500);
    await act(async () => {});
    expect(posts()).toBe(1);
    expect(createBody().fromPrecon).toBe("breed_lethality_c16");
    expect(createBody()).not.toHaveProperty("ownsPrecon");
    expect(patchBodies()).toEqual([]);

    fireEvent.click(within(line()!).getByRole("button", { name: "Yes" }));
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([{ ownsPrecon: true }]);
    expect(posts()).toBe(1);
  });

  it("a saved deck: the GET's precon reads as asked, and loading is no edit; a deck from no precon shows no line", async () => {
    saved = {
      ...saved,
      precon: {
        slug: "breed_lethality_c16",
        name: "Breed Lethality",
        owns: null,
        cards: PRECON_CARDS,
      },
    };
    stubViewport(1440);
    const { unmount } = render(<DeckEditor deckId="deck-1" />);
    expect((await pollFor(line)).textContent).toBe(
      "Started from Breed Lethality, a precon. Do you own it? Yes No",
    );
    await settle(1500);
    await act(async () => {});
    expect(patchBodies()).toEqual([]);
    expect(puts()).toBe(0);
    unmount();

    saved = { ...saved, precon: null };
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(() => {
      const list = document.querySelector<HTMLElement>('section[aria-label="Deck list"]');
      return list ? within(list).queryByText("Precon Rock 1") : null;
    });
    expect(line()).toBeNull();
    expect(ownershipEl()).toBeNull();
  });

  it("the quantities are the precon's: 14 Forests from its 12 and two of its cards cut read You own 98/100 · missing ≈ $5", async () => {
    saved = {
      ...saved,
      precon: {
        slug: "breed_lethality_c16",
        name: "Breed Lethality",
        owns: true,
        cards: PRECON_CARDS,
      },
      cards: [
        row(atraxa, "commander"),
        row(forest, "main", 14),
        row(ring, "main"),
        ...ROCKS.slice(2).map((c) => row(c, "main")),
      ],
    };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    expect((await pollFor(line)).textContent).toBe(
      "Started from Breed Lethality, a precon you own. Change",
    );
    expect(ownershipEl()!.textContent).toBe("You own 98/100 · missing ≈ $5 ·");
  });

  it("a card cut and added back is owned again (the box still holds it)", async () => {
    saved = {
      ...saved,
      precon: {
        slug: "breed_lethality_c16",
        name: "Breed Lethality",
        owns: true,
        cards: PRECON_CARDS,
      },
    };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await pollFor(line);
    expect(ownershipEl()!.textContent).toBe("You own 100/100 · nothing missing ·");
    const list = section("Deck list");
    fireEvent.click(within(list).getByRole("button", { name: "Remove Arcane Ring" }));
    expect(ownershipEl()!.textContent).toBe("You own 99/99 · nothing missing ·");
    const toastEl = (await pollFor(() => screen.queryByText("Removed Arcane Ring"))).closest(
      '[data-slot="toast"]',
    ) as HTMLElement;
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    expect(within(list).getByText("Arcane Ring")).toBeTruthy();
    expect(ownershipEl()!.textContent).toBe("You own 100/100 · nothing missing ·");
  });

  it("every price reads the owned precon: the goals line's total and the Fit sheet, which takes the one owned set", async () => {
    saved = {
      precon: {
        slug: "breed_lethality_c16",
        name: "Breed Lethality",
        owns: true,
        cards: PRECON_CARDS,
      },
      cards: PRECON_LIST,
      goals: { v: 1, budget: { totalUsd: 60 } },
    };
    stubViewport(1440);
    const { unmount } = render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("tab", { name: "Suggestions" })));
    const goalsLine = await pollFor(() =>
      document.querySelector<HTMLElement>("[data-slot=goals-line]"),
    );
    expect(goalsLine.textContent).toBe("Your goals: est. $0 of your $60 Change");
    openMenu(screen.getByRole("button", { name: "More" }));
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Fit my budget…" }));
    const sheetEl = await pollFor(() => screen.queryByRole("dialog", { name: "Fit my budget" }));
    expect(sheetEl.textContent).toContain("est. $0 now (cheapest printings)");
    expect(sheetEl.textContent).toContain("Cards you own count as $0 and stay.");
    unmount();

    // Answered No: the whole list at its cheapest printings, $122.50.
    saved = { ...saved, precon: { ...(saved.precon as object), owns: false } };
    render(<DeckEditor deckId="deck-1" />);
    fireEvent.click(await pollFor(() => screen.queryByRole("tab", { name: "Suggestions" })));
    const noLine = await pollFor(() =>
      document.querySelector<HTMLElement>("[data-slot=goals-line]"),
    );
    expect(noLine.textContent).toBe("Your goals: est. $123 of your $60 Fit my budget Change");
  });

  it("at 375 px the line sits in the Deck tab with its 44 px-on-touch controls, and answering mints nothing else", async () => {
    stubViewport(375);
    render(draft());
    const asked = await pollFor(line);
    const yes = within(asked).getByRole("button", { name: "Yes" });
    expect(yes.className).toContain("pointer-coarse:min-h-11");
    expect(yes.className).toContain("pointer-coarse:min-w-11");
    expect(yes.className).toContain("underline");
    // It names what it answers about.
    expect(yes.getAttribute("aria-describedby")).toBe(asked.querySelector("span")!.id);
    await settle(1500);
    expect(posts()).toBe(0);
  });
});

describe("DeckEditor — Maybe (MAYBE-LIST)", () => {
  const kozilek: CardWire = {
    ...card({
      name: "Kozilek, the Great Distortion",
      primaryType: "Creature",
      costValue: 10,
      isLeaderCandidate: true,
      attrs: { type_line: "Legendary Creature — Eldrazi", oracle_text: "" },
    }),
    image: null,
  };
  const vault: CardWire = {
    ...card({
      name: "Mana Vault",
      primaryType: "Artifact",
      costValue: 1,
      attrs: { type_line: "Artifact", oracle_text: "", game_changer: true },
    }),
    image: null,
  };
  const wastes: CardWire = {
    ...card({
      name: "Wastes",
      primaryType: "Land",
      costValue: null,
      attrs: { type_line: "Basic Land — Wastes", oracle_text: "" },
    }),
    image: null,
  };
  /** Banned in Commander and off Kozilek's (colorless) identity: a wrong deck if it ever counted. */
  const bolt: CardWire = {
    ...card({
      name: "Lightning Bolt",
      primaryType: "Instant",
      costValue: 1,
      colorsMask: 8,
      ciMask: 8,
      legality: [{ status: "banned" }],
      attrs: { type_line: "Instant", oracle_text: "", mana_cost: "{R}" },
    }),
    image: null,
  };
  const row = (wire: CardWire, zone: string, qty = 1) => ({
    cardId: wire.id,
    zone,
    qty,
    tags: [],
    printingId: null,
    card: wire,
  });
  /** Kozilek, Mana Vault and `wastes` Wastes (98 = 100 / 100), plus the Maybe rows and their printings. */
  let state: { wastes: number; maybe: CardWire[]; printing?: Record<string, string> } = {
    wastes: 98,
    maybe: [],
  };
  function maybeDeck() {
    return {
      deck: {
        id: "deck-1",
        publicId: "abcdefgh1234",
        game: "mtg",
        format: "commander",
        name: "Kozilek",
        description: null,
        notes: null,
        visibility: "unlisted",
        isOwner: true,
        forkedFrom: null,
        leaderIds: [kozilek.id],
        goals: null,
      },
      cards: [
        row(kozilek, "commander"),
        row(vault, "main"),
        row(wastes, "main", state.wastes),
        ...state.maybe.map((w) => ({
          ...row(w, "maybeboard"),
          printingId: state.printing?.[w.id] ?? null,
        })),
      ],
      owned: [],
      hasCollection: false,
    };
  }
  const solRec = {
    cardId: sol.id,
    name: sol.name,
    primaryType: "Artifact",
    costValue: 1,
    ciMask: 0,
    cheapestUsd: "1.20",
    popularity: 1,
    score: 0.9,
    confidence: "high",
    evidence: [
      {
        source: "edhrec_rank",
        why: "A Commander staple in EDHREC decklists",
        with: [],
        howOften: "EDHREC rank #1",
        confidence: "high",
      },
    ],
    conflicts: [],
  };
  const byName = new Map([sol, signet, bolt].map((c) => [c.name, c]));
  function maybeRoute(input: RequestInfo | URL, init?: RequestInit) {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/decks/deck-1" && method === "GET") return ok(maybeDeck());
    if (url.startsWith("/api/decks/deck-1/recommendations")) {
      return ok({ count: 1, recommendations: [solRec], hidden: [], combosTruncated: false });
    }
    if (url === "/api/cards/resolve") {
      const { names } = JSON.parse(String(init?.body)) as { names: string[] };
      return ok({
        results: names.map((n) => ({ input: n, match: byName.get(n) ?? null, suggestions: [] })),
      });
    }
    return route(input, init);
  }
  beforeEach(() => {
    state = { wastes: 98, maybe: [] };
    fetchMock.mockImplementation(maybeRoute);
  });

  const deckSize = () => document.querySelector("[data-slot=deck-size]")?.textContent;
  const maybeSection = () => document.querySelector<HTMLElement>("[data-slot=maybe-section]");
  /** The section's disclosure: its label beside its count ("Maybe1"). */
  const maybeTrigger = () => within(maybeSection()!).getByRole("button", { name: /^Maybe\d+$/ });
  async function openMaybe() {
    fireEvent.click(maybeTrigger());
    await act(async () => {});
    return maybeSection()!;
  }
  /** The last PUT's rows as "zone:card name ×qty". */
  const names = new Map([kozilek, vault, wastes, sol, signet, bolt].map((c) => [c.id, c.name]));
  const lastPut = () =>
    (lastPutEntries() as unknown as { cardId: string; zone: string; qty: number }[]).map(
      (e) => `${e.zone}:${names.get(e.cardId)} ×${e.qty}`,
    );
  async function save() {
    await settle(1500);
    await act(async () => {});
  }
  const toastOf = async (text: string) =>
    (await pollFor(() => screen.queryByText(text))).closest('[data-slot="toast"]') as HTMLElement;
  async function suggestions() {
    fireEvent.click(screen.getByRole("tab", { name: "Suggestions" }));
    await pollFor(() => screen.queryByText("A Commander staple in EDHREC decklists"));
  }
  async function loaded() {
    await pollFor(() => (deckSize() ? true : null));
  }

  it("at 100 / 100 a Suggestions row offers Swap in… and Maybe; Maybe parks the card: still 100 / 100, ONE PUT with the Maybe row, and its Undo takes it out", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    expect(deckSize()).toBe("100 / 100 cards");
    await suggestions();
    // The owner's decision 1: Maybe beside Swap in…, at any size.
    expect(screen.getByRole("button", { name: "Swap in Sol Ring…" }).textContent).toBe("Swap in…");
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Maybe" }));
    const toastEl = await toastOf("Added Sol Ring to Maybe");
    expect(deckSize()).toBe("100 / 100 cards");
    // The row says so, and its first line still swaps the card in.
    expect(screen.getByText("In Maybe")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Sol Ring to Maybe" })).toBeNull();
    expect(screen.getByRole("button", { name: "Swap in Sol Ring…" })).toBeTruthy();
    expect(maybeTrigger().textContent).toBe("Maybe1");
    await save();
    expect(puts()).toBe(1);
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×98",
      "maybeboard:Sol Ring ×1",
    ]);
    // Suggestions never asked again: a Maybe edit is not a change to the list it reads.
    const recs = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith("/api/decks/deck-1/recommendations"),
      ).length;
    expect(recs()).toBe(1);

    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(puts()).toBe(2);
    expect(lastPut()).not.toContain("maybeboard:Sol Ring ×1");
    expect(deckSize()).toBe("100 / 100 cards");
  });

  it("a reload with a banned, off-color card in Maybe: 100 / 100, a closed Maybe heading, no legality mark and no issue for it", async () => {
    state.maybe = [bolt];
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    expect(deckSize()).toBe("100 / 100 cards");
    expect(maybeTrigger().getAttribute("aria-expanded")).toBe("false");
    expect(maybeTrigger().textContent).toBe("Maybe1");
    const opened = await openMaybe();
    expect(within(opened).getByRole("button", { name: "Lightning Bolt" })).toBeTruthy();
    expect(within(opened).queryByLabelText("Has a problem")).toBeNull();
    expect(within(opened).queryByLabelText("Warning")).toBeNull();
    // The Warden line knows nothing of it.
    expect(
      screen.queryByText(/Lightning Bolt/, { selector: "[data-slot=status-slot] *" }),
    ).toBeNull();
    expect(screen.queryAllByLabelText("Has a problem")).toHaveLength(0);
    // Loading is no edit.
    await save();
    expect(puts()).toBe(0);
  });

  it("Move to deck below the maximum: the card joins the main list with the Maybe row's printing and leaves Maybe — one toast, one PUT; Undo restores both", async () => {
    state = { wastes: 97, maybe: [sol], printing: { [sol.id]: solAltPrinting.id } };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    expect(deckSize()).toBe("99 / 100 · 1 to go");
    const opened = await openMaybe();
    fireEvent.click(within(opened).getByRole("button", { name: "Move Sol Ring to the deck" }));
    const toastEl = await toastOf("Moved Sol Ring to the deck");
    expect(deckSize()).toBe("100 / 100 cards");
    expect(maybeTrigger().textContent).toBe("Maybe0");
    await save();
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×97",
      "main:Sol Ring ×1",
    ]);
    // The printing the Maybe row chose comes with it.
    expect(lastPutEntries().find((e) => e.cardId === sol.id)?.printingId).toBe(solAltPrinting.id);
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×97",
      "maybeboard:Sol Ring ×1",
    ]);
    expect(deckSize()).toBe("99 / 100 · 1 to go");
  });

  it("at the maximum a Maybe row's move is Swap in…: the swap takes the card out of Maybe, and one Undo puts the cut card and the Maybe row back", async () => {
    state.maybe = [sol];
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const opened = await openMaybe();
    expect(within(opened).queryByRole("button", { name: "Move Sol Ring to the deck" })).toBeNull();
    fireEvent.click(within(opened).getByRole("button", { name: "Swap in Sol Ring…" }));
    const sheetEl = await pollFor(() => screen.queryByRole("dialog", { name: "Swap in Sol Ring" }));
    fireEvent.click(within(sheetEl).getByRole("button", { name: "Swap Mana Vault for Sol Ring" }));
    const toastEl = await toastOf("Swapped Mana Vault → Sol Ring");
    expect(within(toastEl).getByText("Taken out of Maybe.")).toBeTruthy();
    expect(deckSize()).toBe("100 / 100 cards");
    await save();
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Sol Ring ×1",
      "main:Wastes ×98",
    ]);
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×98",
      "maybeboard:Sol Ring ×1",
    ]);
  });

  it("a search add of a parked card takes it out of Maybe and says so; Undo puts it back in Maybe", async () => {
    state = { wastes: 97, maybe: [sol] };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const input = screen.getByRole("combobox", { name: "Card search" });
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    // The row says the card is parked; the deck's ×N reads the deck alone.
    const option = screen.getByRole("option", { name: /Sol Ring/ });
    expect(within(option).getByText("In Maybe")).toBeTruthy();
    expect(within(option).queryByText(/×\d/)).toBeNull();
    fireEvent.click(within(option).getByRole("button", { name: "Add Sol Ring to Main deck" }));
    const toastEl = await toastOf("Added Sol Ring");
    expect(within(toastEl).getByText("Taken out of Maybe.")).toBeTruthy();
    await save();
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×97",
      "main:Sol Ring ×1",
    ]);
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×97",
      "maybeboard:Sol Ring ×1",
    ]);
  });

  it("search (the owner's follow-up): at 100 / 100 a row offers Swap in…, Maybe and Commander; Maybe parks the box's quantity — still 100 / 100, ONE PUT, the box cleared; the next search says In Maybe, and a deck card's row offers none", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith("/api/cards/search")
        ? ok({ results: [vault, sol] })
        : maybeRoute(input, init),
    );
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    expect(deckSize()).toBe("100 / 100 cards");
    const input = screen.getByRole("combobox", { name: "Card search" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2 sol" } });
    await settle();
    const actionsOf = (name: RegExp) =>
      [
        ...screen.getByRole("option", { name }).querySelector("[data-slot=search-actions]")!
          .children,
      ].map((b) => b.textContent);
    // Mana Vault is in the deck: its row says ×1 and parks nothing.
    expect(actionsOf(/Mana Vault/)).toEqual(["Swap in…", "Commander"]);
    expect(actionsOf(/Sol Ring/)).toEqual(["Swap in…", "Maybe", "Commander"]);
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to Maybe" }));
    await toastOf("Added 2× Sol Ring to Maybe");
    expect(deckSize()).toBe("100 / 100 cards");
    expect(maybeTrigger().textContent).toBe("Maybe2");
    expect(input.value).toBe("");
    // Parking is no swap: the sheet never opened.
    expect(screen.queryByRole("dialog", { name: "Swap in Sol Ring" })).toBeNull();
    await save();
    expect(puts()).toBe(1);
    expect(lastPut()).toEqual([
      "commander:Kozilek, the Great Distortion ×1",
      "main:Mana Vault ×1",
      "main:Wastes ×98",
      "maybeboard:Sol Ring ×2",
    ]);
    fireEvent.change(input, { target: { value: "sol" } });
    await settle();
    expect(
      within(screen.getByRole("option", { name: /Sol Ring/ })).getByText("In Maybe"),
    ).toBeTruthy();
    expect(actionsOf(/Sol Ring/)).toEqual(["Swap in…", "Commander"]);
  });

  it("a format with no Maybe list (One Piece) offers no Maybe on its search rows; a Magic draft does", async () => {
    stubViewport(1440);
    const { unmount } = render(
      <DeckEditor deckId={null} draftGame="optcg" draftFormat="standard" />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Card search" }), {
      target: { value: "sol" },
    });
    await settle();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add Sol Ring to Deck" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /to Maybe$/ })).toBeNull();
    unmount();
    render(<DeckEditor deckId={null} draftGame="mtg" draftFormat="commander" />);
    fireEvent.change(screen.getByRole("combobox", { name: "Card search" }), {
      target: { value: "sol" },
    });
    await settle();
    expect(screen.getByRole("button", { name: "Add Sol Ring to Maybe" })).toBeTruthy();
  });

  it("a Suggestions Add of a parked card moves it into the deck, and its Undo puts it back in Maybe", async () => {
    state = { wastes: 97, maybe: [sol] };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    await suggestions();
    expect(screen.getByText("In Maybe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add Sol Ring to the deck" }));
    const toastEl = await toastOf("Added Sol Ring");
    expect(within(toastEl).getByText("Taken out of Maybe.")).toBeTruthy();
    expect(screen.getByText("In deck ✓")).toBeTruthy();
    await save();
    expect(lastPut()).toContain("main:Sol Ring ×1");
    expect(lastPut()).not.toContain("maybeboard:Sol Ring ×1");
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(lastPut()).toContain("maybeboard:Sol Ring ×1");
    expect(lastPut()).not.toContain("main:Sol Ring ×1");
  });

  it("Remove from Maybe toasts Removed X from Maybe · Undo, which puts it back", async () => {
    state.maybe = [sol, signet];
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const opened = await openMaybe();
    fireEvent.click(within(opened).getByRole("button", { name: "Remove Sol Ring from Maybe" }));
    const toastEl = await toastOf("Removed Sol Ring from Maybe");
    expect(maybeTrigger().textContent).toBe("Maybe1");
    await save();
    expect(lastPut().filter((e) => e.startsWith("maybeboard:"))).toEqual([
      "maybeboard:Arcane Signet ×1",
    ]);
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    expect(maybeTrigger().textContent).toBe("Maybe2");
    await save();
    // Back where it stood: first of the two.
    expect(lastPut().filter((e) => e.startsWith("maybeboard:"))).toEqual([
      "maybeboard:Sol Ring ×1",
      "maybeboard:Arcane Signet ×1",
    ]);
  });

  it("phone: a Maybe card's sheet offers Move to deck and Remove from Maybe, never the deck's Add or Remove, and no tag editor", async () => {
    state = { wastes: 97, maybe: [sol] };
    stubViewport(375);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const opened = await openMaybe();
    fireEvent.click(within(opened).getByRole("button", { name: "Sol Ring" }));
    await act(async () => {});
    const sheet = screen.getByRole("dialog", { name: "Sol Ring" });
    expect(within(sheet).getByRole("button", { name: "Move to deck" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Remove from Maybe" })).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: "Add" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Remove" })).toBeNull();
    expect(within(sheet).queryByRole("textbox", { name: "Add tag" })).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Move to deck" }));
    await toastOf("Moved Sol Ring to the deck");
    expect(deckSize()).toContain("100 / 100");
  });

  it("the Card tab gives a deck card the tag editor and a Maybe card none", async () => {
    state.maybe = [sol];
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    fireEvent.click(within(section("Deck list")).getByRole("button", { name: "Mana Vault" }));
    await act(async () => {});
    expect(screen.getByRole("textbox", { name: "Add tag" })).toBeTruthy();
    const opened = await openMaybe();
    fireEvent.click(within(opened).getByRole("button", { name: "Sol Ring" }));
    await act(async () => {});
    const tools = section("Card detail and suggestions");
    expect(within(tools).getByRole("heading", { name: "Sol Ring" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Add tag" })).toBeNull();
  });

  it("Import: a pasted Maybeboard lands in Maybe beside the 100, and the export leaves it out", async () => {
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Import" }));
    const dialog = await pollFor(() => screen.queryByRole("dialog", { name: "Import decklist" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Decklist text" }), {
      target: { value: "Maybeboard\n1 Sol Ring\n1 Lightning Bolt" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Add to deck" })));
    await toastOf("Import applied");
    expect(deckSize()).toBe("100 / 100 cards");
    expect(maybeTrigger().textContent).toBe("Maybe2");
    await save();
    expect(lastPut().filter((e) => e.startsWith("maybeboard:"))).toEqual([
      "maybeboard:Sol Ring ×1",
      "maybeboard:Lightning Bolt ×1",
    ]);
    // Export carries the deck alone (the owner's decision 3).
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
    const again = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(again).getByRole("menuitem", { name: "Export" }));
    const exported = await pollFor(() =>
      screen.queryByRole("textbox", { name: "Exported decklist" }),
    );
    const text = (exported as HTMLTextAreaElement).value;
    expect(text).toContain("98 Wastes");
    expect(text).not.toContain("Sol Ring");
    expect(text).not.toContain("Lightning Bolt");
  });

  it("a whole-list change that brings a parked card in (Autofill's Add) takes it out of Maybe; its Undo restores the old list whole", async () => {
    state = { wastes: 97, maybe: [sol] };
    const evidence = {
      source: "edhrec_rank",
      why: "A Commander staple in EDHREC decklists",
      with: [],
      howOften: null,
      confidence: "high",
    };
    const shell = {
      game: "mtg",
      format: "commander",
      seed: 7,
      picks: [
        {
          cardId: sol.id,
          name: "Sol Ring",
          zone: "main",
          qty: 1,
          group: "curve",
          tier: "locked",
          score: 0.9,
          cheapestUsd: "1.20",
          evidence: [evidence],
        },
      ],
      groups: [{ id: "curve", label: "Mana value 1", picks: 1 }],
      notes: [],
      totals: { picks: 1, estUsd: 1.2, unpriced: 0 },
      issues: [],
      cards: [kozilek, sol],
    };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === "/api/decks/autofill"
        ? { ...ok(shell), headers: new Headers() }
        : maybeRoute(input, init),
    );
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Autofill…" }));
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Add 1 card" })));
    const toastEl = await toastOf("Added 1 card");
    expect(deckSize()).toBe("100 / 100 cards");
    expect(maybeTrigger().textContent).toBe("Maybe0");
    await save();
    expect(lastPut()).toContain("main:Sol Ring ×1");
    expect(lastPut()).not.toContain("maybeboard:Sol Ring ×1");
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(lastPut()).toContain("maybeboard:Sol Ring ×1");
    expect(lastPut()).not.toContain("main:Sol Ring ×1");
  });

  it("an import that puts a parked card in the deck takes it out of Maybe; the toast's Undo restores the old list whole", async () => {
    state = { wastes: 97, maybe: [sol] };
    stubViewport(1440);
    render(<DeckEditor deckId="deck-1" />);
    await loaded();
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
    const menu = await pollFor(() => screen.queryByRole("menu", { name: "More" }));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Import" }));
    const dialog = await pollFor(() => screen.queryByRole("dialog", { name: "Import decklist" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Decklist text" }), {
      target: { value: "1 Sol Ring" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    fireEvent.click(await pollFor(() => screen.queryByRole("button", { name: "Add to deck" })));
    const toastEl = await toastOf("Import applied");
    expect(deckSize()).toBe("100 / 100 cards");
    expect(maybeTrigger().textContent).toBe("Maybe0");
    await save();
    expect(lastPut()).toContain("main:Sol Ring ×1");
    expect(lastPut()).not.toContain("maybeboard:Sol Ring ×1");
    fireEvent.click(within(toastEl).getByRole("button", { name: "Undo" }));
    await save();
    expect(lastPut()).toContain("maybeboard:Sol Ring ×1");
    expect(lastPut()).not.toContain("main:Sol Ring ×1");
  });
});
