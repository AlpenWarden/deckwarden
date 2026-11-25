/**
 * The card page's build action (COMMANDER-DOOR, the owner's idea 4 of
 * 2026-11-24): the real page with its two loaders mocked (`./card`'s
 * `getCard` and the combos read). A card that can lead a deck and is legal
 * in the format a new deck opens in gets the hub's button in a row of its
 * own under the Legality chips; Sol Ring, a banned or removed commander and
 * a card whose game has no such format get none; and the page never checks
 * who is signed in.
 *
 * Two renders of the same awaited page. `renderToString` is the server's
 * HTML, where the pick intent reads its null server snapshot, so "Use for"
 * can never be in it. `render` (React Testing Library, jsdom) is the page
 * after hydration, where a pending pick for the same game adds "Use for
 * “<deck>”". The rule's cases are the shared table
 * (src/lib/decks/leader-build-fixtures.ts), which the helper's and the
 * grid's tests read too.
 */
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORMAT_ID, GAME_ID } from "@/db/seed-data";
import { LEADER_BUILD_CASES } from "@/lib/decks/leader-build-fixtures";
import { writePickIntent } from "@/lib/decks/leader-pick-intent";

const mocks = vi.hoisted(() => {
  const refuse = (what: string) => () => {
    throw new Error(`the card page must not read ${what}`);
  };
  return {
    getCard: vi.fn(),
    loadCombosForCard: vi.fn(),
    // Acceptance 7: anything that could tell one visitor from another throws.
    session: vi.fn(refuse("the session")),
    headers: vi.fn(refuse("the request's headers")),
    cookies: vi.fn(refuse("the request's cookies")),
  };
});

vi.mock("./card", () => ({ getCard: mocks.getCard }));
vi.mock("@/lib/combos/queries", () => ({
  COMBOS_SHOWN: 10,
  loadCombosForCard: mocks.loadCombosForCard,
}));
vi.mock("@/lib/auth", () => ({
  getSessionUserId: mocks.session,
  auth: { api: { getSession: mocks.session } },
}));
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: mocks.cookies }));

import CardPage from "./page";

const ATRAXA_KEY = "7e6b9b59-cd68-4e3c-827b-38833c92d6eb";

/** A `formats` row, as `getCard` loads it. */
interface FormatRow {
  id: number;
  gameId: number;
  code: string;
  name: string;
  defaultLegality: string;
}

const COMMANDER_FORMAT: FormatRow = {
  id: FORMAT_ID.commander,
  gameId: GAME_ID.mtg,
  code: "commander",
  name: "Commander",
  defaultLegality: "legal",
};
const STANDARD_FORMAT: FormatRow = {
  id: FORMAT_ID.optcgStandard,
  gameId: GAME_ID.optcg,
  code: "standard",
  name: "Standard",
  defaultLegality: "legal",
};

function identity(extra: Record<string, unknown> = {}) {
  return {
    id: "54125e08-12ec-435c-b147-91768ee5007d",
    gameId: GAME_ID.mtg as number,
    name: "Atraxa, Praetors' Voice",
    slug: "atraxa-praetors-voice",
    externalKey: ATRAXA_KEY,
    primaryType: "Creature",
    costValue: 4,
    colorsMask: 23,
    ciMask: 23,
    isLeaderCandidate: true,
    isPreview: false,
    isRemoved: false,
    cheapestUsd: "24.00",
    popularity: 2360,
    attrs: {
      type_line: "Legendary Creature — Phyrexian Angel Horror",
      oracle_text: "Flying, vigilance, deathtouch, lifelink",
      mana_cost: "{G}{W}{U}{B}",
      power: "4",
      toughness: "4",
    },
    ...extra,
  };
}

const SOL_RING = identity({
  id: "459562ce-8045-4d49-98d6-943034aa44af",
  name: "Sol Ring",
  slug: null,
  externalKey: "6ad8011d-3471-4369-9d68-b264cc027487",
  primaryType: "Artifact",
  costValue: 1,
  colorsMask: 0,
  ciMask: 0,
  isLeaderCandidate: false,
  popularity: 1,
  attrs: { type_line: "Artifact", oracle_text: "{T}: Add {C}{C}.", mana_cost: "{1}" },
});

function optcgLeader(externalKey: string, name: string) {
  return identity({
    id: "a5bef351-9984-450f-bd15-2fa2cf32bea7",
    gameId: GAME_ID.optcg,
    name,
    slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${externalKey.toLowerCase()}`,
    externalKey,
    primaryType: "Leader",
    costValue: 5,
    colorsMask: 1,
    ciMask: 0,
    cheapestUsd: null,
    popularity: null,
    attrs: {
      category: "leader",
      traits: ["Straw Hat Crew"],
      oracle_text: "[Activate: Main] [Once Per Turn] Give this Leader up to 1 rested DON!! card.",
      power_num: 5000,
      life: 5,
    },
  });
}

const PRINTING = {
  id: "d0d33d52-3d28-4635-b985-51e126289259",
  setCode: "c16",
  setName: "Commander 2016",
  collectorNumber: "28",
  rarity: "mythic",
  releasedAt: "2016-11-11",
  isDefault: true,
  hasBack: false,
  prices: { usd: "24.00" },
  imageOverride: null,
};

type Status = "legal" | "banned" | "restricted" | "not_legal";

/** What `getCard` answers: the card, its game's formats, and its current unconditional rows. */
function card(
  id: ReturnType<typeof identity>,
  opts: {
    formatRows?: FormatRow[];
    /** The card's status in the format a new deck opens in; none = no legality row. */
    status?: Status;
  } = {},
) {
  const formatRows = opts.formatRows ?? [
    id.gameId === GAME_ID.optcg ? STANDARD_FORMAT : COMMANDER_FORMAT,
  ];
  return {
    identity: id,
    printings: [PRINTING],
    formatRows,
    legalityRows: opts.status ? [{ formatId: formatRows[0].id, status: opts.status }] : [],
  };
}

async function page() {
  return CardPage({
    params: Promise.resolve({ id: "54125e08-12ec-435c-b147-91768ee5007d" }),
    searchParams: Promise.resolve({}),
  });
}

/** The server's HTML for the card `getCard` answers, parsed. */
async function serverDoc(data: ReturnType<typeof card>) {
  mocks.getCard.mockResolvedValue(data);
  const html = renderToString(await page());
  return { html, doc: new DOMParser().parseFromString(html, "text/html") };
}

const buildAnchors = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLAnchorElement>("a")].filter((a) =>
    (a.getAttribute("href") ?? "").startsWith("/decks/"),
  );

/** The Legality chips' list, and its chips' words. */
function chips(doc: Document) {
  const heading = [...doc.querySelectorAll("h2")].find((h) => h.textContent === "Legality")!;
  const list = heading.nextElementSibling as HTMLElement;
  expect(list.tagName).toBe("UL");
  return { list, words: [...list.querySelectorAll("li")].map((li) => li.textContent) };
}

beforeEach(() => {
  window.sessionStorage.clear();
  for (const fn of Object.values(mocks)) fn.mockClear();
  mocks.loadCombosForCard.mockResolvedValue({ total: 0, combos: [] });
});

describe("the card page's build button (COMMANDER-DOOR)", () => {
  it("Atraxa: one button, in a row of its own under the Legality chips and above the printings", async () => {
    const { html, doc } = await serverDoc(card(identity()));
    const { list, words } = chips(doc);
    expect(words).toEqual(["Commander: legal"]);

    const anchors = buildAnchors(doc);
    expect(anchors).toHaveLength(1);
    const [anchor] = anchors;
    expect(anchor.getAttribute("href")).toBe(`/decks/new?game=mtg&leader=${ATRAXA_KEY}`);
    expect(anchor.textContent).toBe("Build with this commander");

    // Directly after the chips' list, never inside it, and before the printings.
    const row = list.nextElementSibling as HTMLElement;
    expect(row.getAttribute("data-slot")).toBe("card-build");
    expect(row.contains(anchor)).toBe(true);
    expect(row.children).toHaveLength(1);
    expect(list.contains(anchor)).toBe(false);
    expect(row.className).toContain("flex flex-wrap items-center gap-3");
    expect(row.nextElementSibling?.textContent).toContain("Printings · 1");

    // One button: the starter shell stays on the hub.
    expect(html).not.toContain("Start with a starter shell");
    expect(html).not.toContain("autofill=1");
  });

  it("Sol Ring: no build button, although Commander: legal shows", async () => {
    const { html, doc } = await serverDoc(card(SOL_RING));
    expect(chips(doc).words).toEqual(["Commander: legal"]);
    expect(buildAnchors(doc)).toHaveLength(0);
    expect(doc.querySelector('[data-slot="card-build"]')).toBeNull();
    expect(html).not.toContain("Build with");
  });

  it.each(LEADER_BUILD_CASES)("the rule, $label: button = $builds", async (c) => {
    const { doc } = await serverDoc(
      card(identity({ isLeaderCandidate: c.isLeaderCandidate }), { status: c.status }),
    );
    expect(buildAnchors(doc)).toHaveLength(c.builds ? 1 : 0);
    // The chip is the card's status whether or not it can lead a deck.
    expect(chips(doc).words).toEqual([`Commander: ${(c.status ?? "legal").replace("_", " ")}`]);
  });

  it("a removed commander has no button, though it has no ruling against it", async () => {
    const { doc } = await serverDoc(card(identity({ isRemoved: true })));
    expect(chips(doc).words).toEqual(["Commander: legal"]);
    expect(buildAnchors(doc)).toHaveLength(0);
  });

  it("a card whose game has no row for the new-deck format has no button", async () => {
    const none = await serverDoc(card(identity(), { formatRows: [] }));
    expect(buildAnchors(none.doc)).toHaveLength(0);

    // Another format's row is not the one a new deck opens in, and its status is not read.
    const other = { ...COMMANDER_FORMAT, id: 99, code: "brawl", name: "Brawl" };
    const elsewhere = await serverDoc(card(identity(), { formatRows: [other] }));
    expect(chips(elsewhere.doc).words).toEqual(["Brawl: legal"]);
    expect(buildAnchors(elsewhere.doc)).toHaveLength(0);
  });

  it("a ruling in another format does not block: the status read is the new-deck format's own", async () => {
    const other = { ...COMMANDER_FORMAT, id: 99, code: "brawl", name: "Brawl" };
    mocks.getCard.mockResolvedValue({
      ...card(identity(), { formatRows: [COMMANDER_FORMAT, other] }),
      legalityRows: [{ formatId: 99, status: "banned" }],
    });
    const doc = new DOMParser().parseFromString(renderToString(await page()), "text/html");
    expect(chips(doc).words).toEqual(["Commander: legal", "Brawl: banned"]);
    expect(buildAnchors(doc)).toHaveLength(1);
  });

  it("a preview commander has the button, under the page's preview sentence", async () => {
    const { html, doc } = await serverDoc(card(identity({ isPreview: true })));
    expect(html).toContain("Preview card: not legal until release");
    expect(buildAnchors(doc).map((a) => a.textContent)).toEqual(["Build with this commander"]);
  });

  it("a One Piece leader: Build with this leader, by its card number", async () => {
    const { doc } = await serverDoc(card(optcgLeader("OP01-003", "Monkey.D.Luffy")));
    expect(doc.querySelector("main")?.getAttribute("data-game")).toBe("optcg");
    const anchors = buildAnchors(doc);
    expect(anchors.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Build with this leader", "/decks/new?game=optcg&leader=OP01-003"],
    ]);
  });

  it("OP03-040, banned outright, has no button; OP11-040, with a pair ban only, has one", async () => {
    const banned = await serverDoc(card(optcgLeader("OP03-040", "Nami"), { status: "banned" }));
    expect(chips(banned.doc).words).toEqual(["Standard: banned"]);
    expect(buildAnchors(banned.doc)).toHaveLength(0);

    // A pair ban is a conditional row, and `getCard` drops those in SQL: the page sees no row.
    const paired = await serverDoc(card(optcgLeader("OP11-040", "Monkey.D.Luffy")));
    expect(chips(paired.doc).words).toEqual(["Standard: legal"]);
    expect(buildAnchors(paired.doc).map((a) => a.getAttribute("href"))).toEqual([
      "/decks/new?game=optcg&leader=OP11-040",
    ]);
  });
});

describe("the card page is the same for everyone (acceptance 7)", () => {
  it("renders a commander's page and Sol Ring's without reading the session, the headers or the cookies", async () => {
    // A pending pick is in this browser's storage; the server's HTML cannot know it.
    writePickIntent({ deckId: "deck-1", deckName: "Krenko Mob Rule", game: "mtg" });
    const commander = await serverDoc(card(identity()));
    const solRing = await serverDoc(card(SOL_RING));
    expect(commander.html).toContain("Build with this commander");
    expect(commander.html).not.toContain("Use for");
    expect(solRing.html).not.toContain("Use for");
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.headers).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
});

describe("a pending commander pick (acceptance 8)", () => {
  // Base UI's Button puts role="button" on the anchor it renders.
  const buttons = () => {
    const row = document.querySelector<HTMLElement>('[data-slot="card-build"]');
    return row
      ? within(row)
          .getAllByRole("button")
          .map((a) => [a.tagName, a.textContent, a.getAttribute("href")])
      : [];
  };

  it("nobody else sees Use for: without a pick the hydrated page has the one button", async () => {
    mocks.getCard.mockResolvedValue(card(identity()));
    render(await page());
    expect(buttons()).toEqual([
      ["A", "Build with this commander", `/decks/new?game=mtg&leader=${ATRAXA_KEY}`],
    ]);
  });

  it("a player who came from a saved deck's Browse commanders also sees Use for, linking that deck's editor", async () => {
    writePickIntent({ deckId: "deck-1", deckName: "Krenko Mob Rule", game: "mtg" });
    mocks.getCard.mockResolvedValue(card(identity()));
    render(await page());
    expect(buttons()).toEqual([
      ["A", "Use for “Krenko Mob Rule”", `/decks/deck-1/edit?leader=${ATRAXA_KEY}`],
      ["A", "Build with this commander", `/decks/new?game=mtg&leader=${ATRAXA_KEY}`],
    ]);
  });

  it("a pick for the other game adds nothing, on either game's card", async () => {
    writePickIntent({ deckId: "deck-2", deckName: "Luffy", game: "optcg" });
    mocks.getCard.mockResolvedValue(card(identity()));
    const magic = render(await page());
    expect(buttons().map(([, words]) => words)).toEqual(["Build with this commander"]);
    magic.unmount();

    window.sessionStorage.clear();
    writePickIntent({ deckId: "deck-1", deckName: "Krenko Mob Rule", game: "mtg" });
    mocks.getCard.mockResolvedValue(card(optcgLeader("OP01-003", "Monkey.D.Luffy")));
    render(await page());
    expect(buttons().map(([, words]) => words)).toEqual(["Build with this leader"]);
  });

  it("a One Piece pick on a One Piece leader's page: Use for, by the card number", async () => {
    writePickIntent({ deckId: "deck-2", deckName: "Luffy", game: "optcg" });
    mocks.getCard.mockResolvedValue(card(optcgLeader("OP01-003", "Monkey.D.Luffy")));
    render(await page());
    expect(buttons().map(([, words, href]) => [words, href])).toEqual([
      ["Use for “Luffy”", "/decks/deck-2/edit?leader=OP01-003"],
      ["Build with this leader", "/decks/new?game=optcg&leader=OP01-003"],
    ]);
  });

  it("a card with no build button shows no Use for either", async () => {
    writePickIntent({ deckId: "deck-1", deckName: "Krenko Mob Rule", game: "mtg" });
    mocks.getCard.mockResolvedValue(card(SOL_RING));
    render(await page());
    expect(buttons()).toEqual([]);
    expect(screen.queryByText(/Use for/)).toBeNull();
  });
});
