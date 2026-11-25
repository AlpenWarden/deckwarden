/**
 * /collection (COLLECTION-PAGE), the real page with its reads mocked: who
 * sees what, what each view asks of the database, the order and the counts
 * of the leaders, the one action, the card list's filter, order and pages,
 * and that every game word on it comes off the adapter.
 *
 * The session is `getSessionUserId`'s answer and the collection is what the
 * mocked loaders return, so nothing here needs a database. The arithmetic
 * (`rankOwnedLeaders`) and the address (`page-query.ts`) are the real ones;
 * their own tests pin the details. The real route, with a real session and
 * real rows, is `pnpm smoke:collection`'s.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OwnedCardsPage } from "@/lib/collection/browse";
import type { OwnedLeader } from "@/lib/collection/leaders";
import type { GameAdapter } from "@/lib/games/types";

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  /** A stand-in adapter for the tests that prove no game word is spelled here; null = the real one. */
  adapter: null as unknown,
  loadOwnedColorCounts: vi.fn(),
  loadOwnedLeaders: vi.fn(),
  loadOwnedCards: vi.fn(),
  hasCollection: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ getSessionUserId: async () => mocks.userId }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { social: mocks.signInSocial } } }));
vi.mock("@/lib/collection/leaders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/collection/leaders")>()),
  loadOwnedColorCounts: mocks.loadOwnedColorCounts,
  loadOwnedLeaders: mocks.loadOwnedLeaders,
}));
vi.mock("@/lib/collection/browse", () => ({ loadOwnedCards: mocks.loadOwnedCards }));
vi.mock("@/lib/collection/owned", () => ({ hasCollection: mocks.hasCollection }));
vi.mock("@/lib/games/registry", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/games/registry")>();
  return {
    ...real,
    getAdapter: (id: Parameters<typeof real.getAdapter>[0]) =>
      (mocks.adapter as GameAdapter | null) ?? real.getAdapter(id),
  };
});

import { getAdapter as realGetAdapter } from "@/lib/games/registry";

import CollectionPage, { dynamic, metadata } from "./page";

type Query = Record<string, string | string[] | undefined>;

async function renderPage(query: Query = {}) {
  return render(
    await CollectionPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }),
  );
}

const W = 1;
const U = 2;
const B = 4;
const R = 8;
const G = 16;

function leader(name: string, over: Partial<OwnedLeader> = {}): OwnedLeader {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `id-${slug}`,
    name,
    externalKey: `key-${slug}`,
    ciMask: 0,
    popularity: null,
    status: "legal",
    ...over,
  };
}

/**
 * The plan's collection: a five-color commander, two single-color ones, a
 * partner, a double-faced one and a banned one, among forty other cards.
 * 46 cards in all, counted by color identity with the six leaders in them.
 */
const FIVE = leader("Five-Color Queen", { ciMask: W | U | B | R | G, popularity: 900 });
const WHITE = leader("White Knight", { ciMask: W, popularity: 50 });
const BLUE = leader("Blue Mage", { ciMask: U, popularity: 10 });
const PARTNER = leader("Green Partner", { ciMask: G, popularity: 3 });
const TWO_FACED = leader("Front Face // Back Face", { ciMask: B | R, popularity: 7000 });
const BANNED = leader("Banned One", { ciMask: B, popularity: 1, status: "banned" });
const PLAN_LEADERS = [WHITE, BANNED, PARTNER, FIVE, BLUE, TWO_FACED];
const PLAN_COUNTS = new Map([
  [0, 10],
  [W, 8 + 1],
  [U, 6 + 1],
  [B, 5 + 1],
  [R, 4],
  [G, 3 + 1],
  [W | U, 2],
  [B | R, 2 + 1],
  [W | U | B | R | G, 1],
]);

function cardRows(n: number, total: number | null = n): OwnedCardsPage {
  return {
    rows: Array.from({ length: n }, (_, i) => ({
      id: `card-${i + 1}`,
      name: `Card ${i + 1}`,
      primaryType: i === 1 ? null : "Instant",
      ciMask: i % 2 === 0 ? R : 0,
      popularity: i === 1 ? null : (i + 1) * 7,
      copies: i === 0 ? 3 : 1,
    })),
    total,
  };
}

const leaderList = () => document.querySelector<HTMLElement>("[data-slot=collection-leaders]");
const cardList = () => document.querySelector<HTMLElement>("[data-slot=collection-cards]");
const notLegal = () => document.querySelector<HTMLElement>("[data-slot=collection-not-legal]");
const hrefOf = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("href");
/** Every address on the page that leads to Account's import. */
const importLinks = () =>
  [...document.querySelectorAll("a")].filter(
    (a) => a.getAttribute("href") === "/account#collection",
  );

beforeEach(() => {
  mocks.userId = "user-1";
  mocks.adapter = null;
  mocks.loadOwnedColorCounts.mockReset().mockResolvedValue(PLAN_COUNTS);
  mocks.loadOwnedLeaders.mockReset().mockResolvedValue(PLAN_LEADERS);
  mocks.loadOwnedCards.mockReset().mockResolvedValue(cardRows(3, 3));
  mocks.hasCollection.mockReset().mockResolvedValue(true);
  mocks.signInSocial.mockReset().mockResolvedValue({ error: null });
});

describe("/collection — the route", () => {
  it("is rendered for every request and kept out of search engines", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false });
    expect(metadata.title).toBe("Collection");
  });
});

describe("/collection — signed out", () => {
  beforeEach(() => {
    mocks.userId = null;
  });

  it("draws the sign-in buttons and reads nothing about any collection", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Your collection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Discord" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
    for (const read of [
      mocks.loadOwnedColorCounts,
      mocks.loadOwnedLeaders,
      mocks.loadOwnedCards,
      mocks.hasCollection,
    ]) {
      expect(read).not.toHaveBeenCalled();
    }
    // No card, no list, no view, no action.
    expect(leaderList()).toBeNull();
    expect(cardList()).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Collection views" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Five-Color Queen|Card 1|Build from/);
  });

  it("whatever the address asks for: a guest's ?view=cards&q= reads nothing either", async () => {
    await renderPage({ view: "cards", q: "bolt", page: "3" });
    expect(mocks.loadOwnedCards).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in with Discord" })).toBeTruthy();
  });

  it("the sign-in comes back here: the callback is /account carrying this page as `next`", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/account?next=%2Fcollection",
    });
  });
});

describe("/collection — signed in, nothing imported", () => {
  it("the leaders view says so and links to the import", async () => {
    mocks.loadOwnedColorCounts.mockResolvedValue(new Map());
    mocks.loadOwnedLeaders.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("No collection imported yet")).toBeTruthy();
    expect(hrefOf("Import a collection")).toBe("/account#collection");
    expect(importLinks()).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Collection views" })).toBeNull();
    expect(leaderList()).toBeNull();
  });

  it("the card list says the same: an empty page and no row in the collection at all", async () => {
    mocks.loadOwnedCards.mockResolvedValue({ rows: [], total: null });
    mocks.hasCollection.mockResolvedValue(false);
    await renderPage({ view: "cards" });
    expect(mocks.hasCollection).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("No collection imported yet")).toBeTruthy();
    expect(hrefOf("Import a collection")).toBe("/account#collection");
    expect(cardList()).toBeNull();
  });
});

describe("/collection — the leaders you own", () => {
  it("opens on this view, with the header, the two views and the way back to the import", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Collection" })).toBeTruthy();
    expect(screen.getByText(/Private: only you can see this page\./)).toBeTruthy();
    expect(hrefOf("Update or delete your collection")).toBe("/account#collection");
    expect(importLinks()).toHaveLength(1);

    const views = screen.getByRole("navigation", { name: "Collection views" });
    const links = within(views).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Commanders you own", "/collection"],
      ["Your cards", "/collection?view=cards"],
    ]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual(["page", null]);
    expect(screen.getByRole("heading", { level: 2, name: "Commanders you own" })).toBeTruthy();
  });

  it("asks for the player's own cards and leaders, in the game's format, and nothing else", async () => {
    await renderPage();
    // Magic is game 1 and Commander format 1 (seed-data); the session's id keys both reads.
    expect(mocks.loadOwnedColorCounts.mock.calls).toEqual([["user-1", 1]]);
    expect(mocks.loadOwnedLeaders.mock.calls).toEqual([["user-1", 1, 1]]);
    expect(mocks.loadOwnedCards).not.toHaveBeenCalled();
    expect(mocks.hasCollection).not.toHaveBeenCalled();
  });

  it("lists each legal leader once, most cards inside its colors first, with its count", async () => {
    await renderPage();
    const rows = within(leaderList()!).getAllByRole("listitem");
    expect(rows.map((li) => li.querySelector("a")!.textContent)).toEqual([
      "Five-Color Queen",
      "Front Face // Back Face",
      "White Knight",
      "Blue Mage",
      "Green Partner",
    ]);
    expect(rows.map((li) => li.querySelector("p + p")!.textContent)).toEqual([
      // The five-color leader's count is every other owned card: 46 less itself.
      "45 of your cards are in its colors",
      // Black and red: colorless 10, black 6, red 4, black-red 3, less itself.
      "22 of your cards are in its colors",
      "18 of your cards are in its colors",
      "16 of your cards are in its colors",
      // The partner, on its own color alone.
      "13 of your cards are in its colors",
    ]);
    // A name leads to its card page; the identity is said in words beside the swatches.
    expect(
      within(rows[0]).getByRole("link", { name: "Five-Color Queen" }).getAttribute("href"),
    ).toBe("/cards/id-five-color-queen");
    expect([...rows[1].querySelectorAll(".sr-only")].map((el) => el.textContent)).toEqual([
      "Black",
      "Red",
    ]);
  });

  it("says how the list is ordered, and how many leaders are in how many cards", async () => {
    await renderPage();
    expect(
      screen.getByText(
        "5 commanders among your 46 cards. Commanders with more colors come first, because more of your cards fit them: each count is every other card you own inside that commander's colors.",
      ),
    ).toBeTruthy();
  });

  it("each legal leader has the one action: the new-deck link with the sheet open and the owned box ticked", async () => {
    await renderPage();
    const builds = within(leaderList()!).getAllByRole("link", {
      name: /^Build from my collection/,
    });
    expect(builds.map((a) => [a.getAttribute("aria-label"), a.getAttribute("href")])).toEqual([
      [
        "Build from my collection: Five-Color Queen",
        "/decks/new?game=mtg&leader=key-five-color-queen&autofill=1&owned=1",
      ],
      [
        "Build from my collection: Front Face // Back Face",
        "/decks/new?game=mtg&leader=key-front-face-back-face&autofill=1&owned=1",
      ],
      [
        "Build from my collection: White Knight",
        "/decks/new?game=mtg&leader=key-white-knight&autofill=1&owned=1",
      ],
      [
        "Build from my collection: Blue Mage",
        "/decks/new?game=mtg&leader=key-blue-mage&autofill=1&owned=1",
      ],
      [
        "Build from my collection: Green Partner",
        "/decks/new?game=mtg&leader=key-green-partner&autofill=1&owned=1",
      ],
    ]);
    // The visible words are the same on every row.
    expect(new Set(builds.map((a) => a.textContent))).toEqual(
      new Set(["Build from my collection"]),
    );
  });

  it("a banned leader is named in one quiet line and cannot be built", async () => {
    await renderPage();
    expect(notLegal()!.textContent).toBe(
      "Also in your collection, with no build button because Commander does not allow them: Banned One (banned).",
    );
    expect(within(leaderList()!).queryByText("Banned One")).toBeNull();
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.includes("key-banned-one"))).toEqual([]);
    expect(hrefs.filter((href) => href.startsWith("/decks/new"))).toHaveLength(5);
  });

  it("several rulings read in one line, by name", async () => {
    mocks.loadOwnedLeaders.mockResolvedValue([
      ...PLAN_LEADERS,
      leader("Aaa Silver", { status: "not_legal" }),
    ]);
    await renderPage();
    expect(notLegal()!.textContent).toBe(
      "Also in your collection, with no build button because Commander does not allow them: Aaa Silver (not legal), Banned One (banned).",
    );
  });

  it("up to ten such leaders are one sentence; more fold behind their count, every name still there", async () => {
    const silver = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        leader(`Silver ${String(i + 1).padStart(2, "0")}`, { status: "not_legal" }),
      );
    mocks.loadOwnedLeaders.mockResolvedValue([...PLAN_LEADERS, ...silver(9)]);
    const ten = await renderPage();
    expect(notLegal()!.tagName).toBe("P");
    expect(notLegal()!.textContent).toMatch(
      /^Also in your collection, .*: Banned One \(banned\), Silver 01 \(not legal\), .*Silver 09 \(not legal\)\.$/,
    );
    ten.unmount();

    mocks.loadOwnedLeaders.mockResolvedValue([...PLAN_LEADERS, ...silver(10)]);
    await renderPage();
    expect(notLegal()!.tagName).toBe("DETAILS");
    expect(notLegal()!.querySelector("summary")!.textContent).toBe(
      "Also in your collection, with no build button because Commander does not allow them: 11 commanders",
    );
    const names = notLegal()!.querySelector("summary + p")!.textContent!;
    expect(names.startsWith("Banned One (banned), Silver 01 (not legal), ")).toBe(true);
    expect(names.endsWith("Silver 10 (not legal).")).toBe(true);
    // Still no build link for any of them.
    expect(document.querySelectorAll('a[href^="/decks/new"]')).toHaveLength(5);
  });

  it("no leader in the collection: it says so and points at the leader index", async () => {
    mocks.loadOwnedLeaders.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("No commanders to build with in your collection")).toBeTruthy();
    expect(screen.getByText("None of your 46 cards can lead a Commander deck.")).toBeTruthy();
    expect(hrefOf("Browse commanders")).toBe("/commanders");
    expect(leaderList()).toBeNull();
    expect(notLegal()).toBeNull();
    // Still the header's way to the import, and the other view.
    expect(importLinks()).toHaveLength(1);
    expect(hrefOf("Your cards")).toBe("/collection?view=cards");
  });

  it("only a banned leader: nothing to build with, and the line still names it", async () => {
    mocks.loadOwnedLeaders.mockResolvedValue([BANNED]);
    await renderPage();
    expect(screen.getByText("No commanders to build with in your collection")).toBeTruthy();
    expect(notLegal()!.textContent).toContain("Banned One (banned)");
    expect(document.querySelector('a[href^="/decks/new"]')).toBeNull();
  });

  describe("sixty a page", () => {
    const many = Array.from({ length: 130 }, (_, i) =>
      leader(`Leader ${String(i + 1).padStart(3, "0")}`, { popularity: i + 1 }),
    );
    beforeEach(() => {
      mocks.loadOwnedLeaders.mockResolvedValue(many);
      mocks.loadOwnedColorCounts.mockResolvedValue(new Map([[0, 500]]));
    });
    const pager = () => screen.queryByRole("navigation", { name: "Pages" });

    it("page 1: the first sixty in order, Next and no Previous", async () => {
      await renderPage();
      const names = within(leaderList()!)
        .getAllByRole("listitem")
        .map((li) => li.querySelector("a")!.textContent);
      expect(names).toHaveLength(60);
      expect(names[0]).toBe("Leader 001");
      expect(names[59]).toBe("Leader 060");
      expect(within(pager()!).getByText("Page 1 of 3")).toBeTruthy();
      expect(within(pager()!).getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
        "/collection?page=2",
      );
      expect(within(pager()!).queryByRole("link", { name: "Previous" })).toBeNull();
    });

    it("the last page: the remaining ten, Previous and no Next", async () => {
      await renderPage({ page: "3" });
      const names = within(leaderList()!)
        .getAllByRole("listitem")
        .map((li) => li.querySelector("a")!.textContent);
      expect(names).toEqual(many.slice(120).map((l) => l.name));
      expect(within(pager()!).getByText("Page 3 of 3")).toBeTruthy();
      expect(within(pager()!).getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
        "/collection?page=2",
      );
      expect(within(pager()!).queryByRole("link", { name: "Next" })).toBeNull();
    });

    it("a page past the end says so and leads back, with no pager", async () => {
      await renderPage({ page: "9" });
      expect(screen.getByText(/Nothing on page 9\./)).toBeTruthy();
      expect(hrefOf("Back to page 1")).toBe("/collection");
      expect(leaderList()).toBeNull();
      expect(pager()).toBeNull();
    });

    it("a list of one page draws no pager", async () => {
      mocks.loadOwnedLeaders.mockResolvedValue(many.slice(0, 60));
      await renderPage();
      expect(within(leaderList()!).getAllByRole("listitem")).toHaveLength(60);
      expect(pager()).toBeNull();
    });
  });
});

describe("/collection — your cards", () => {
  it("asks for one page of the player's cards and nothing about leaders", async () => {
    await renderPage({ view: "cards" });
    expect(mocks.loadOwnedCards.mock.calls).toEqual([
      [{ userId: "user-1", gameId: 1, page: 1, sort: "name", q: "" }],
    ]);
    expect(mocks.loadOwnedColorCounts).not.toHaveBeenCalled();
    expect(mocks.loadOwnedLeaders).not.toHaveBeenCalled();
    // A page with rows needs no second question.
    expect(mocks.hasCollection).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("navigation", { name: "Collection views" }))
        .getAllByRole("link")
        .map((a) => a.getAttribute("aria-current")),
    ).toEqual([null, "page"]);
    expect(importLinks()).toHaveLength(1);
  });

  it("one row per card: its name, type, colors, rank in the game's words, and its copies added up", async () => {
    await renderPage({ view: "cards" });
    const rows = within(cardList()!).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    // A row is one link to the card's page, named by everything the row says.
    expect(within(rows[0]).getAllByRole("link")).toHaveLength(1);
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe("/cards/card-1");
    expect(within(rows[0]).getByRole("link").textContent).toBe(rows[0].textContent);
    expect(rows[0].textContent).toContain("Instant");
    expect(rows[0].textContent).toContain("EDHREC rank #7");
    expect(rows[0].textContent).toContain("×3 copies");
    expect([...rows[0].querySelectorAll(".sr-only")].map((el) => el.textContent)).toEqual([
      "Red",
      " copies",
    ]);
    // A card with no type and no rank shows a dash for each (around its colorless
    // swatch and that swatch's name), and one copy reads as one.
    expect(rows[1].textContent).toBe("Card 2—CColorless—×1 copy");
    expect(
      screen.getByText("3 cards, one row each, with the copies of every printing added up."),
    ).toBeTruthy();
  });

  it("the order: A to Z, or by the game's rank; the choice rides the address and the loader", async () => {
    await renderPage({ view: "cards" });
    const order = () => screen.getByRole("navigation", { name: "Order" });
    expect(
      within(order())
        .getAllByRole("link")
        .map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("aria-current")]),
    ).toEqual([
      ["A to Z", "/collection?view=cards", "page"],
      ["EDHREC rank", "/collection?view=cards&sort=rank", null],
    ]);
  });

  it("by rank: the loader is told, the chip is current, and the form keeps the order", async () => {
    const { container } = await renderPage({ view: "cards", sort: "rank" });
    expect(mocks.loadOwnedCards.mock.calls[0][0]).toMatchObject({ sort: "rank", q: "", page: 1 });
    expect(
      within(screen.getByRole("navigation", { name: "Order" }))
        .getAllByRole("link")
        .map((a) => a.getAttribute("aria-current")),
    ).toEqual([null, "page"]);
    expect(
      [...container.querySelectorAll('form input[type="hidden"]')].map(
        (el) => `${el.getAttribute("name")}=${el.getAttribute("value")}`,
      ),
    ).toEqual(["view=cards", "sort=rank"]);
  });

  it("the name filter is a plain GET form on this page, with the typed name in its box", async () => {
    const { container } = await renderPage({ view: "cards", q: "dragon" });
    const form = screen.getByRole("search");
    expect(form.getAttribute("action")).toBe("/collection");
    expect(form.getAttribute("method")).toBe("get");
    const box = within(form).getByRole("searchbox", { name: "Filter your cards by name" });
    expect(box.getAttribute("name")).toBe("q");
    expect((box as HTMLInputElement).value).toBe("dragon");
    expect(within(form).getByRole("button", { name: "Filter" }).getAttribute("type")).toBe(
      "submit",
    );
    // The view rides along; no page input, so a new filter starts at page 1.
    expect(
      [...container.querySelectorAll('form input[type="hidden"]')].map(
        (el) => `${el.getAttribute("name")}=${el.getAttribute("value")}`,
      ),
    ).toEqual(["view=cards"]);
    expect(container.querySelector('form input[name="page"]')).toBeNull();
  });

  it("filtered: the loader gets the name, the line counts the matches, and Clear filter keeps the order", async () => {
    mocks.loadOwnedCards.mockResolvedValue(cardRows(2, 139));
    await renderPage({ view: "cards", q: " dragon ", sort: "rank" });
    expect(mocks.loadOwnedCards.mock.calls[0][0]).toMatchObject({ q: "dragon", sort: "rank" });
    expect(screen.getByText(/139 of your cards match “dragon”\./)).toBeTruthy();
    expect(hrefOf("Clear filter")).toBe("/collection?view=cards&sort=rank");
    // The order chips keep the name.
    expect(hrefOf("A to Z")).toBe("/collection?view=cards&q=dragon");
  });

  it("one match reads as one", async () => {
    mocks.loadOwnedCards.mockResolvedValue(cardRows(1, 1));
    await renderPage({ view: "cards", q: "sol ring" });
    expect(screen.getByText(/1 of your cards matches “sol ring”\./)).toBeTruthy();
  });

  it("pages: sixty rows of 13,239 on page 2, with the name and the order on both links", async () => {
    mocks.loadOwnedCards.mockResolvedValue(cardRows(60, 13_239));
    await renderPage({ view: "cards", page: "2", sort: "rank" });
    expect(mocks.loadOwnedCards.mock.calls[0][0]).toMatchObject({ page: 2 });
    const pager = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pager).getByText("Page 2 of 221")).toBeTruthy();
    expect(within(pager).getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
      "/collection?view=cards&sort=rank",
    );
    expect(within(pager).getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
      "/collection?view=cards&sort=rank&page=3",
    );
    expect(screen.getByText(/^13,239 cards, one row each/)).toBeTruthy();
  });

  it("the last page has no Next", async () => {
    mocks.loadOwnedCards.mockResolvedValue(cardRows(39, 13_239));
    await renderPage({ view: "cards", page: "221", q: "a" });
    const pager = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pager).getByText("Page 221 of 221")).toBeTruthy();
    expect(within(pager).queryByRole("link", { name: "Next" })).toBeNull();
    expect(within(pager).getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
      "/collection?view=cards&q=a&page=220",
    );
  });

  it("a name nothing matches: it says so, offers Clear filter, and the collection is still there", async () => {
    mocks.loadOwnedCards.mockResolvedValue({ rows: [], total: null });
    await renderPage({ view: "cards", q: "zzzz" });
    expect(mocks.hasCollection).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("No cards in your collection match “zzzz”")).toBeTruthy();
    expect(hrefOf("Clear filter")).toBe("/collection?view=cards");
    expect(screen.queryByText("No collection imported yet")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    expect(importLinks()).toHaveLength(1);
  });

  it("a page past the end: it says so and leads back to page 1 with the name and the order", async () => {
    mocks.loadOwnedCards.mockResolvedValue({ rows: [], total: null });
    await renderPage({ view: "cards", q: "dragon", sort: "rank", page: "400" });
    expect(screen.getByText(/Nothing on page 400\./)).toBeTruthy();
    expect(hrefOf("Back to page 1")).toBe("/collection?view=cards&q=dragon&sort=rank");
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });
});

describe("/collection — every game word comes off the adapter", () => {
  /** The real adapter with other words, a different format label and a rank of its own. */
  function otherWords(over: Partial<GameAdapter> = {}): GameAdapter {
    const real = realGetAdapter("mtg");
    return {
      ...real,
      formats: [{ ...real.formats[0], label: "Tabletop" }, ...real.formats.slice(1)],
      display: {
        ...real.display,
        leaderNoun: "Captain",
        leaderBrowse: { href: "/captains", label: "Browse captains" },
      },
      recommend: {
        ...real.recommend,
        popularity: {
          source: "zeta_rank",
          evidence: (rank: number) => ({ why: "", howOften: `Zeta place ${rank}` }),
        },
        sources: { zeta_rank: { label: "Zeta" } },
      },
      ...over,
    };
  }
  const MAGIC_WORDS = /Commander|EDHREC|mana|\bland/i;

  it("the leaders view prints the adapter's noun and format, and none of Magic's", async () => {
    mocks.adapter = otherWords();
    await renderPage();
    expect(screen.getByRole("heading", { level: 2, name: "Captains you own" })).toBeTruthy();
    expect(
      screen.getByText(/^5 captains among your 46 cards\. Captains with more colors/),
    ).toBeTruthy();
    expect(notLegal()!.textContent).toContain("because Tabletop does not allow them");
    expect(document.querySelector("main")!.textContent).not.toMatch(MAGIC_WORDS);
  });

  it("the card list prints the adapter's rank and its source's name", async () => {
    mocks.adapter = otherWords();
    await renderPage({ view: "cards" });
    expect(within(cardList()!).getAllByRole("listitem")[0].textContent).toContain("Zeta place 7");
    expect(hrefOf("Zeta rank")).toBe("/collection?view=cards&sort=rank");
    expect(document.querySelector("main")!.textContent).not.toMatch(MAGIC_WORDS);
  });

  it("no leader, another game's words: its own index is where the page points", async () => {
    mocks.adapter = otherWords();
    mocks.loadOwnedLeaders.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("No captains to build with in your collection")).toBeTruthy();
    expect(screen.getByText("None of your 46 cards can lead a Tabletop deck.")).toBeTruthy();
    expect(hrefOf("Browse captains")).toBe("/captains");
  });

  it("a game with no starter list: its leaders are listed with no build action", async () => {
    const real = otherWords();
    mocks.adapter = otherWords({ recommend: { ...real.recommend, autofill: undefined } });
    await renderPage();
    expect(within(leaderList()!).getAllByRole("listitem")).toHaveLength(5);
    expect(document.querySelector('a[href^="/decks/new"]')).toBeNull();
  });

  it("a game with no rank: one order, no choice, and `sort=rank` reads as by name", async () => {
    const real = otherWords();
    mocks.adapter = otherWords({ recommend: { ...real.recommend, popularity: undefined } });
    await renderPage({ view: "cards", sort: "rank" });
    expect(screen.queryByRole("navigation", { name: "Order" })).toBeNull();
    expect(mocks.loadOwnedCards.mock.calls[0][0]).toMatchObject({ sort: "name" });
    // No rank to print: a dash, like a card without one.
    expect(within(cardList()!).getAllByRole("listitem")[0].textContent).toBe(
      "Card 1InstantRRed—×3 copies",
    );
  });
});
