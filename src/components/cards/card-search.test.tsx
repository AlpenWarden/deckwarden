/**
 * CardSearch (R6, REDESIGN.md §2 "Card search"): the filters in labelled
 * groups, the selected filters as removable chips with Clear all, the
 * skeleton grid while the first page is in flight (the same columns and
 * card aspect), the URL params landing preset from hub links, and Load
 * more keeping its own loading label. Fetch is stubbed; timers are fake
 * for the 250 ms debounce. X2: the Name box is the predictive island — a
 * `combobox` with the same accessible name — and a typed name sends
 * `sort=best`; the island's own behavior is name-suggest.test.tsx's.
 * X4a: the Set group (Magic only), its list fetched once — on the picker's
 * first press, or at mount for a preset `?set=` — and a chosen set's
 * requests, chip, header, "Most popular" strip and `?printing=` tile links;
 * the picker's own behavior is set-picker.test.tsx's. SEARCH-EXAMPLES: the
 * Try line's sentence of /cards links, and when it leaves for good.
 * COMMANDER-DOOR: the grid's request carries `format=<code>` last (the ten
 * exact pins of the grid's address above gained it; the strip's two did
 * not), and a tile whose card can lead a deck and is legal gets a build
 * link under its image. The new cases have a row builder of their own
 * (`wire`): the shared `results()` emits no leader candidate, and the cases
 * that count links rely on that.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONDITIONAL_BAN, LEADER_BUILD_CASES } from "@/lib/decks/leader-build-fixtures";
import { writePickIntent } from "@/lib/decks/leader-pick-intent";
import type { ReleasedSet } from "@/lib/sets/lines";

import { CardSearch, MOST_PLAYED, SKELETON_CARDS, TileBuildLink } from "./card-search";

type Deferred = { resolve: (body: unknown) => void };
let requests: { url: string; deferred: Deferred }[] = [];

function stubFetch() {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      return new Promise<Response>((resolve, reject) => {
        const deferred: Deferred = {
          resolve: (body) => resolve(new Response(JSON.stringify(body), { status: 200 })),
        };
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
        requests.push({ url, deferred });
      });
    }),
  );
}

const results = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(from + i).padStart(12, "0")}`,
    name: `Card ${from + i}`,
    image: null,
  }));

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  stubFetch();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CardSearch — groups, chips, skeleton", () => {
  it("renders labelled filter groups and a skeleton grid until the first page lands", async () => {
    render(<CardSearch game="mtg" />);
    expect(screen.getByRole("group", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Type" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Color identity" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Set" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Set" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Traits" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Card name" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Card type" })).toBeTruthy();

    const skeleton = document.querySelector<HTMLElement>("[data-slot=results-skeleton]")!;
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.className).toContain("lg:grid-cols-5");
    const boxes = skeleton.querySelectorAll<HTMLElement>("[data-slot=skeleton]");
    expect(boxes).toHaveLength(SKELETON_CARDS);
    expect(boxes[0].style.aspectRatio).toBe("488 / 680");
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(document.querySelector("[data-slot=active-filters]")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("/api/cards/search?game=mtg&limit=60&format=commander");
    requests[0].deferred.resolve({ results: results(2), total: 2 });
    await flush();
    expect(document.querySelector("[data-slot=results-skeleton]")).toBeNull();
    expect(screen.getByText("2 cards")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("preset filters land as chips; removing one and Clear all re-search", async () => {
    render(
      <CardSearch
        game="optcg"
        initialName="luffy"
        initialType="Character"
        initialColors="within:RG"
        distinctField="traits"
        initialDistinct="Straw Hat Crew"
      />,
    );
    expect(screen.getByRole("group", { name: "Traits" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Set" })).toBeNull(); // One Piece declares no set field
    const row = screen.getByRole("list", { name: "Active filters" });
    const chips = within(row).getAllByRole("button");
    expect(chips.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Remove filter: Name luffy",
      "Remove filter: Type Character",
      "Remove filter: Color Red",
      "Remove filter: Color Green",
      "Remove filter: Trait Straw Hat Crew",
    ]);
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    // X2 (REC-2): a typed name asks for the dropdown's order.
    expect(requests.at(-1)!.url).toBe(
      "/api/cards/search?game=optcg&limit=60&name=luffy&type=Character&color=within%3ARG&traits=Straw+Hat+Crew&sort=best&format=standard",
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Color Red" }));
    expect(screen.queryByRole("button", { name: "Remove filter: Color Red" })).toBeNull();
    expect(screen.getByRole("button", { name: "Green" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Red" }).getAttribute("aria-pressed")).toBe("false");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(requests.at(-1)!.url).toContain("color=within%3AG");

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(document.querySelector("[data-slot=active-filters]")).toBeNull();
    expect((screen.getByRole("combobox", { name: "Card name" }) as HTMLInputElement).value).toBe(
      "",
    );
    act(() => {
      vi.advanceTimersByTime(250);
    });
    // One Piece without a name falls back to the honest name sort (P4.4).
    expect(requests.at(-1)!.url).toBe(
      "/api/cards/search?game=optcg&limit=60&sort=name&format=standard",
    );
  });

  it("Load more keeps its own loading label and appends; a re-search keeps the results, not the skeleton", async () => {
    render(<CardSearch game="mtg" />);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    requests[0].deferred.resolve({ results: results(60), total: 61 });
    await flush();
    const more = screen.getByRole("button", { name: "Load more" });
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Loading…" })).toBeTruthy();
    expect(document.querySelector("[data-slot=results-skeleton]")).toBeNull();
    expect(requests.at(-1)!.url).toContain("offset=60");
    requests.at(-1)!.deferred.resolve({ results: results(1, 60), total: 61 });
    await flush();
    expect(screen.getAllByRole("link")).toHaveLength(61);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Card name" }), {
      target: { value: "sol" },
    });
    expect(screen.getByRole("button", { name: "Remove filter: Name sol" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(document.querySelector("[data-slot=results-skeleton]")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(61);
  });
});

const SETS: ReleasedSet[] = [
  {
    code: "blb",
    name: "Bloomburrow",
    releasedAt: "2024-08-02",
    setType: "expansion",
    group: "main",
    cards: 279,
    ordinal: 102,
  },
  {
    code: "pblb",
    name: "Bloomburrow Promos",
    releasedAt: "2024-08-02",
    setType: "promo",
    group: "other",
    cards: 40,
    ordinal: null,
  },
  {
    code: "emn",
    name: "Eldritch Moon",
    releasedAt: "2016-07-22",
    setType: "expansion",
    group: "main",
    cards: 208,
    ordinal: 71,
  },
];

/** Scoped rows: each carries its in-set printing (and a rank when given). */
const scopedResults = (n: number, ranks: (number | null)[] = []) =>
  results(n).map((card, i) => ({
    ...card,
    printingId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
    popularity: ranks[i] ?? null,
  }));

const pending = (prefix: string) => requests.filter((r) => r.url.startsWith(prefix));
const lastUrl = (prefix: string) => pending(prefix).at(-1)?.url;

async function answer(prefix: string, body: unknown) {
  const request = pending(prefix).at(-1)!;
  request.deferred.resolve(body);
  await flush();
}

function debounce() {
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

const setChip = () =>
  screen.queryByRole("button", { name: /^Remove filter: Set / })?.getAttribute("aria-label") ??
  null;

describe("CardSearch — the Set group (X4a)", () => {
  it("a preset ?set= fetches the list at mount, names the chip and the header, and asks for the grid in collector order and the strip by play", async () => {
    render(<CardSearch game="mtg" initialSet=" BLB " />);
    // The list goes out at mount (the chip and the header need the name)…
    expect(requests.map((r) => r.url)).toEqual(["/api/sets?game=mtg"]);
    expect(setChip()).toBe("Remove filter: Set BLB");
    debounce();
    // …then the grid and the strip, together, after the debounce.
    expect(requests.map((r) => r.url)).toEqual([
      "/api/sets?game=mtg",
      "/api/cards/search?game=mtg&limit=60&set=blb&sort=number&format=commander",
      `/api/cards/search?game=mtg&limit=${MOST_PLAYED}&set=blb&sort=pop`,
    ]);
    await answer("/api/sets", { sets: SETS });
    expect(setChip()).toBe("Remove filter: Set Bloomburrow (BLB)");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Bloomburrow (the 102nd expansion set)",
    );
    // On the type ladder (LATER row 220): the section step, no tracking of its own.
    expect(screen.getByRole("heading", { level: 2 }).className).toBe("type-section");
    expect(document.querySelector("[data-slot=set-header] p")!.textContent).toBe(
      "BLB · Released Aug 2, 2024",
    );
    expect((screen.getByRole("combobox", { name: "Set" }) as HTMLInputElement).value).toBe(
      "Bloomburrow",
    );

    await answer("/api/cards/search?game=mtg&limit=60", { results: scopedResults(3), total: 279 });
    await answer(`/api/cards/search?game=mtg&limit=${MOST_PLAYED}`, {
      results: scopedResults(3, [46, 177, null]),
      total: 279,
    });
    const strip = screen.getByRole("region", { name: "Most popular in Bloomburrow" });
    // Unranked cards are dropped: "most popular" needs a rank to say so.
    const stripLinks = within(strip).getAllByRole("link");
    expect(stripLinks).toHaveLength(2);
    expect(stripLinks[0].getAttribute("href")).toBe(
      "/cards/00000000-0000-4000-8000-000000000000?printing=11111111-1111-4111-8111-000000000000",
    );
    expect(
      within(strip).getByText("Ranked by EDHREC decklist popularity via Scryfall."),
    ).toBeTruthy();
    expect(screen.getByText("All 279 cards, in collector-number order")).toBeTruthy();
    const gridLinks = screen
      .getAllByRole("link")
      .filter((a) => !strip.contains(a))
      .map((a) => a.getAttribute("href"));
    expect(gridLinks).toHaveLength(3);
    expect(gridLinks.every((href) => /\?printing=11111111-/.test(href!))).toBe(true);
  });

  it("the picker's first press fetches the list once; a pick re-runs the grid at once; × and Clear all clear it", async () => {
    render(<CardSearch game="mtg" />);
    debounce();
    expect(requests.map((r) => r.url)).toEqual([
      "/api/cards/search?game=mtg&limit=60&format=commander",
    ]);
    await answer("/api/cards/search", { results: results(2), total: 2 });

    const setBox = screen.getByRole("combobox", { name: "Set" }) as HTMLInputElement;
    fireEvent.mouseDown(setBox, { button: 0 });
    await flush();
    expect(pending("/api/sets").map((r) => r.url)).toEqual(["/api/sets?game=mtg"]);
    await answer("/api/sets", { sets: SETS });
    fireEvent.input(setBox, { target: { value: "blo" }, inputType: "insertText" });
    const rows = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(rows.map((o) => o.querySelector("span span")!.textContent)).toEqual([
      "Bloomburrow",
      "Bloomburrow Promos",
    ]);
    fireEvent.click(rows[0]);
    expect(setChip()).toBe("Remove filter: Set Bloomburrow (BLB)");
    expect(setBox.value).toBe("Bloomburrow");
    debounce();
    expect(lastUrl("/api/cards/search?game=mtg&limit=60")).toBe(
      "/api/cards/search?game=mtg&limit=60&set=blb&sort=number&format=commander",
    );
    expect(lastUrl(`/api/cards/search?game=mtg&limit=${MOST_PLAYED}`)).toBe(
      `/api/cards/search?game=mtg&limit=${MOST_PLAYED}&set=blb&sort=pop`,
    );
    // Opening the picker again costs nothing: the list is fetched once.
    fireEvent.mouseDown(setBox, { button: 0 });
    await flush();
    expect(pending("/api/sets")).toHaveLength(1);
    fireEvent.keyDown(setBox, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Set Bloomburrow (BLB)" }));
    expect(setChip()).toBeNull();
    expect(setBox.value).toBe("");
    expect(document.querySelector("[data-slot=set-header]")).toBeNull();
    debounce();
    expect(requests.at(-1)!.url).toBe("/api/cards/search?game=mtg&limit=60&format=commander");

    fireEvent.mouseDown(setBox, { button: 0 });
    fireEvent.input(setBox, { target: { value: "eld" }, inputType: "insertText" });
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);
    expect(setChip()).toBe("Remove filter: Set Eldritch Moon (EMN)");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(setChip()).toBeNull();
    debounce();
    expect(requests.at(-1)!.url).toBe("/api/cards/search?game=mtg&limit=60&format=commander");
  });

  it("a set and a name: the dropdown's order inside the set, and no strip", async () => {
    render(<CardSearch game="mtg" initialSet="blb" initialName="for" />);
    debounce();
    expect(pending("/api/cards/search").map((r) => r.url)).toEqual([
      "/api/cards/search?game=mtg&limit=60&name=for&set=blb&sort=best&format=commander",
    ]);
    await answer("/api/sets", { sets: SETS });
    await answer("/api/cards/search", { results: scopedResults(2), total: 2 });
    expect(screen.queryByRole("region", { name: /Most popular/ })).toBeNull();
    expect(screen.getByText("2 cards")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Bloomburrow (the 102nd expansion set)",
    );
  });

  it(`no strip when the whole list fits in ${MOST_PLAYED}, or when nothing in it is ranked`, async () => {
    render(<CardSearch game="mtg" initialSet="blb" initialType="Land" />);
    debounce();
    await answer("/api/sets", { sets: SETS });
    await answer("/api/cards/search?game=mtg&limit=60", { results: scopedResults(5), total: 5 });
    await answer(`/api/cards/search?game=mtg&limit=${MOST_PLAYED}`, {
      results: scopedResults(5, [1, 2, 3, 4, 5]),
      total: 5,
    });
    expect(screen.queryByRole("region", { name: /Most popular/ })).toBeNull();
    // With another filter the count is not "All".
    expect(screen.getByText("5 cards, in collector-number order")).toBeTruthy();
  });

  it("an unknown or unreleased preset code: the chip keeps the code, and the header says no released set has it", async () => {
    render(<CardSearch game="mtg" initialSet="zzz" />);
    debounce();
    await answer("/api/sets", { sets: SETS });
    await answer("/api/cards/search?game=mtg&limit=60", { results: [], total: 0 });
    expect(setChip()).toBe("Remove filter: Set ZZZ");
    expect(document.querySelector("[data-slot=set-header]")!.textContent).toBe(
      "No released set has the code “ZZZ”.",
    );
    expect(screen.getByText("0 cards")).toBeTruthy();
  });

  it("One Piece ignores a preset set: no group, no chip, no list, the request unchanged", async () => {
    render(<CardSearch game="optcg" initialSet="op01" />);
    debounce();
    expect(requests.map((r) => r.url)).toEqual([
      "/api/cards/search?game=optcg&limit=60&sort=name&format=standard",
    ]);
    expect(setChip()).toBeNull();
  });
});

const EXAMPLES = [
  { text: "Atraxa", game: "mtg" as const, href: "/cards?q=Atraxa" },
  { text: "Edgar Markov", game: "mtg" as const, href: "/cards?q=Edgar+Markov" },
  { text: "Sol Ring", game: "mtg" as const, href: "/cards?q=Sol+Ring" },
];
const tryLine = () => document.querySelector<HTMLElement>("[data-slot=search-examples]");

describe("CardSearch — the Try line (SEARCH-EXAMPLES)", () => {
  it("one sentence of links under the filters, each a /cards search", () => {
    render(<CardSearch game="mtg" examples={EXAMPLES} />);
    const line = tryLine()!;
    expect(line.tagName).toBe("P");
    expect(line.textContent).toBe("Try Atraxa, Edgar Markov or Sol Ring.");
    expect(line.classList.contains("type-meta")).toBe(true);
    const links = within(line).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Atraxa", "/cards?q=Atraxa"],
      ["Edgar Markov", "/cards?q=Edgar+Markov"],
      ["Sol Ring", "/cards?q=Sol+Ring"],
    ]);
    // Named for what they do, the visible words inside: a tile named
    // "Sol Ring" opens the card, this link runs the search.
    expect(within(line).getByRole("link", { name: "Search for Sol Ring" })).toBe(links[2]);
    // Under the filter groups, before the chips row and the count.
    const groups = document.querySelector("[data-slot=filter-groups]")!;
    expect(groups.nextElementSibling).toBe(line);
  });

  it("One Piece's one example reads as a sentence too", () => {
    render(
      <CardSearch
        game="optcg"
        distinctField="traits"
        examples={[{ text: "OP01-001", game: "optcg", href: "/cards?game=optcg&q=OP01-001" }]}
      />,
    );
    expect(tryLine()!.textContent).toBe("Try OP01-001.");
    expect(within(tryLine()!).getByRole("link").getAttribute("href")).toBe(
      "/cards?game=optcg&q=OP01-001",
    );
  });

  it("no examples, no line", () => {
    render(<CardSearch game="mtg" />);
    expect(tryLine()).toBeNull();
  });

  it("leaves at the first typed character and never comes back, even once the box is cleared", () => {
    render(<CardSearch game="mtg" examples={EXAMPLES} />);
    const box = screen.getByRole("combobox", { name: "Card name" });
    fireEvent.change(box, { target: { value: "   " } });
    expect(tryLine()).not.toBeNull(); // spaces are not a name
    fireEvent.change(box, { target: { value: "a" } });
    expect(tryLine()).toBeNull();
    fireEvent.change(box, { target: { value: "" } });
    expect(tryLine()).toBeNull();
  });

  it("a page that lands with a name or a set starts without it", () => {
    const { unmount } = render(<CardSearch game="mtg" initialName="Atraxa" examples={EXAMPLES} />);
    expect(tryLine()).toBeNull();
    unmount();
    render(<CardSearch game="mtg" initialSet="blb" examples={EXAMPLES} />);
    expect(tryLine()).toBeNull();
  });

  it("a chosen set takes it away for good", async () => {
    render(<CardSearch game="mtg" examples={EXAMPLES} />);
    const setBox = screen.getByRole("combobox", { name: "Set" }) as HTMLInputElement;
    fireEvent.mouseDown(setBox, { button: 0 });
    await flush();
    await answer("/api/sets", { sets: SETS });
    fireEvent.input(setBox, { target: { value: "blo" }, inputType: "insertText" });
    expect(tryLine()).not.toBeNull(); // typing in the Set box is not a name
    fireEvent.click(within(screen.getByRole("listbox")).getAllByRole("option")[0]);
    expect(setChip()).toBe("Remove filter: Set Bloomburrow (BLB)");
    expect(tryLine()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Set Bloomburrow (BLB)" }));
    expect(tryLine()).toBeNull();
  });
});

/** A results row as the search route sends it with `format=`: the card and its rulings there. */
function wire(name: string, extra: Record<string, unknown> = {}) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `id-${slug}`,
    name,
    externalKey: `key-${slug}`,
    primaryType: "Creature",
    costValue: 4,
    colorsMask: 0,
    ciMask: 0,
    cheapestUsd: null,
    popularity: null as number | null,
    isLeaderCandidate: false,
    isPreview: false,
    attrs: {},
    legality: [] as unknown[],
    image: null,
    ...extra,
  };
}
const leaderRow = (name: string, extra: Record<string, unknown> = {}) =>
  wire(name, { isLeaderCandidate: true, ...extra });

describe("CardSearch — build links under commander tiles (COMMANDER-DOOR)", () => {
  const GRID = "/api/cards/search?game=mtg&limit=60";
  const OP_GRID = "/api/cards/search?game=optcg&limit=60";

  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    window.sessionStorage.clear();
  });

  const buildLinks = () => [
    ...document.querySelectorAll<HTMLAnchorElement>('a[data-slot="tile-build"]'),
  ];
  /** Each build link as [its accessible name, its address]. */
  const built = () =>
    screen
      .queryAllByRole("link", { name: /^Build with / })
      .map((a) => [a.textContent, a.getAttribute("href")]);
  /** The words a link shows: its text without what is kept for screen readers. */
  function visibleWords(link: HTMLElement): string {
    const copy = link.cloneNode(true) as HTMLElement;
    for (const hidden of copy.querySelectorAll(".sr-only")) hidden.remove();
    return copy.textContent ?? "";
  }

  async function grid(rows: unknown[], game: "mtg" | "optcg" = "mtg", name = "") {
    render(<CardSearch game={game} initialName={name} />);
    debounce();
    await answer(game === "mtg" ? GRID : OP_GRID, { results: rows, total: rows.length });
  }

  it("each legal commander's tile has its build link under its image, in the same item, and no other tile has one", async () => {
    await grid(
      [
        leaderRow("Atraxa, Praetors' Voice"),
        wire("Atraxa's Fall"),
        leaderRow("Atraxa, Grand Unifier"),
        leaderRow("Golos, Tireless Pilgrim", { legality: [{ status: "banned" }] }),
      ],
      "mtg",
      "atraxa",
    );
    expect(lastUrl(GRID)).toBe(`${GRID}&name=atraxa&sort=best&format=commander`);
    expect(built()).toEqual([
      [
        "Build with Atraxa, Praetors' Voice",
        "/decks/new?game=mtg&leader=key-atraxa-praetors-voice",
      ],
      ["Build with Atraxa, Grand Unifier", "/decks/new?game=mtg&leader=key-atraxa-grand-unifier"],
    ]);
    expect(buildLinks()).toHaveLength(2);

    const items = [...document.querySelectorAll("ul.grid > li")];
    expect(items.map((li) => within(li as HTMLElement).getAllByRole("link").length)).toEqual([
      2, 1, 2, 1,
    ]);
    // In the tile's own item: the image's link to the card page first, then the build link.
    const [image, build] = within(items[0] as HTMLElement).getAllByRole("link");
    expect(image.getAttribute("href")).toBe("/cards/id-atraxa-praetors-voice");
    expect(image.textContent).toBe("Atraxa, Praetors' Voice"); // the tile, here its no-image stand-in
    expect(build).toBe(buildLinks()[0]);
    expect(image.contains(build)).toBe(false);
    // The grid draws the plan's form: every word shows.
    expect(visibleWords(build)).toBe("Build with Atraxa, Praetors' Voice");
  });

  it.each(LEADER_BUILD_CASES)("the rule, $label: link = $builds", async (c) => {
    await grid([wire("Card", { isLeaderCandidate: c.isLeaderCandidate, legality: c.legality })]);
    expect(buildLinks()).toHaveLength(c.builds ? 1 : 0);
    expect(screen.getAllByRole("link")).toHaveLength(c.builds ? 2 : 1);
  });

  it("a ban that carries a condition does not block; beside it, an unconditional ban does", async () => {
    await grid([
      leaderRow("Pair Banned", { legality: CONDITIONAL_BAN }),
      leaderRow("Banned Outright", { legality: [...CONDITIONAL_BAN, { status: "banned" }] }),
    ]);
    expect(built().map(([words]) => words)).toEqual(["Build with Pair Banned"]);
  });

  it("One Piece: the card number is in the words and is the key; OP03-040 has no link, OP11-040 with a pair ban only has one", async () => {
    await grid(
      [
        leaderRow("Monkey.D.Luffy", { id: "l1", externalKey: "OP01-003" }),
        leaderRow("Nami", { id: "n", externalKey: "OP03-040", legality: [{ status: "banned" }] }),
        leaderRow("Monkey.D.Luffy", {
          id: "l2",
          externalKey: "OP11-040",
          legality: CONDITIONAL_BAN,
        }),
        wire("Monkey.D.Luffy", { id: "c", externalKey: "OP01-024" }),
      ],
      "optcg",
    );
    expect(lastUrl(OP_GRID)).toBe(`${OP_GRID}&sort=name&format=standard`);
    expect(built()).toEqual([
      ["Build with Monkey.D.Luffy (OP01-003)", "/decks/new?game=optcg&leader=OP01-003"],
      ["Build with Monkey.D.Luffy (OP11-040)", "/decks/new?game=optcg&leader=OP11-040"],
    ]);
  });

  it("no two build links on a results page share a name, on a Magic search and on a One Piece one", async () => {
    await grid([leaderRow("Atraxa, Praetors' Voice"), leaderRow("Atraxa, Grand Unifier")]);
    let names = built().map(([words]) => words);
    expect(new Set(names).size).toBe(names.length);
    cleanup();

    stubFetch();
    await grid(
      ["OP01-003", "OP05-060", "ST01-001"].map((key) =>
        leaderRow("Monkey.D.Luffy", { id: key, externalKey: key }),
      ),
      "optcg",
    );
    names = built().map(([words]) => words);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
  });

  it("while a commander pick is pending for the grid's game there are no build links; a pick for the other game changes nothing", async () => {
    writePickIntent({ deckId: "deck-1", deckName: "Krenko Mob Rule", game: "mtg" });
    await grid([leaderRow("Atraxa, Praetors' Voice"), wire("Sol Ring")]);
    expect(buildLinks()).toHaveLength(0);
    expect(screen.getAllByRole("link")).toHaveLength(2); // the tiles keep their card links
    cleanup();

    window.sessionStorage.clear();
    writePickIntent({ deckId: "deck-2", deckName: "Luffy", game: "optcg" });
    stubFetch();
    await grid([leaderRow("Atraxa, Praetors' Voice"), wire("Sol Ring")]);
    expect(built().map(([words]) => words)).toEqual(["Build with Atraxa, Praetors' Voice"]);
  });

  it("the set strip asks what it asked before, and its tiles get no build links though they are commanders", async () => {
    const scoped = (name: string, i: number, rank: number | null) =>
      leaderRow(name, {
        printingId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
        popularity: rank,
      });
    render(<CardSearch game="mtg" initialSet="blb" />);
    debounce();
    expect(lastUrl(`/api/cards/search?game=mtg&limit=${MOST_PLAYED}`)).toBe(
      `/api/cards/search?game=mtg&limit=${MOST_PLAYED}&set=blb&sort=pop`,
    );
    expect(lastUrl(GRID)).toBe(`${GRID}&set=blb&sort=number&format=commander`);
    await answer("/api/sets", { sets: SETS });
    await answer(GRID, { results: [scoped("Baylen, the Haymaker", 0, 46)], total: 279 });
    await answer(`/api/cards/search?game=mtg&limit=${MOST_PLAYED}`, {
      results: [
        scoped("Baylen, the Haymaker", 0, 46),
        scoped("Bello, Bard of the Brambles", 1, 90),
      ],
      total: 279,
    });
    const strip = screen.getByRole("region", { name: "Most popular in Bloomburrow" });
    const stripLinks = within(strip).getAllByRole("link");
    expect(stripLinks).toHaveLength(2);
    expect(stripLinks.every((a) => a.getAttribute("href")!.startsWith("/cards/"))).toBe(true);
    expect(strip.querySelector('[data-slot="tile-build"]')).toBeNull();
    // The grid's own tile for the same card has one; its image keeps the set's printing.
    const build = buildLinks();
    expect(build).toHaveLength(1);
    expect(build[0].getAttribute("href")).toBe(
      "/decks/new?game=mtg&leader=key-baylen-the-haymaker",
    );
    const tile = build[0].closest("li")!;
    expect(within(tile).getAllByRole("link")[0].getAttribute("href")).toMatch(/\?printing=1111/);
  });

  it("Load more pages get them too, and ask with the format after the offset", async () => {
    const first = [leaderRow("Atraxa, Praetors' Voice"), ...results(59, 1)];
    render(<CardSearch game="mtg" />);
    debounce();
    await answer(GRID, { results: first, total: 61 });
    expect(buildLinks()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(requests.at(-1)!.url).toBe(`${GRID}&offset=60&format=commander`);
    await answer(GRID, { results: [leaderRow("Kenrith, the Returned King")], total: 61 });
    expect(built().map(([words]) => words)).toEqual([
      "Build with Atraxa, Praetors' Voice",
      "Build with Kenrith, the Returned King",
    ]);
  });

  it("the link is a block under the image: a 44 px target on touch with no negative margin, its words in a span that wraps", async () => {
    await grid([leaderRow("Asmoranomardicadaistinaculdacar")]);
    const [link] = buildLinks();
    const classes = link.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "block",
        "pointer-coarse:flex",
        "pointer-coarse:min-h-11",
        "pointer-coarse:items-center",
      ]),
    );
    expect(classes.some((c) => /(^|:)-m[trblxy]?-/.test(c))).toBe(false);
    const words = link.firstElementChild as HTMLElement;
    expect(words.tagName).toBe("SPAN");
    expect(words.className).toBe("min-w-0 wrap-break-word");
    expect(words.textContent).toBe("Build with Asmoranomardicadaistinaculdacar");
  });

  it.each(["full", "short"] as const)(
    "the %s form: the link's name is the whole sentence and begins with its visible words, word for word",
    (form) => {
      const WORDS = "Build with Esika, God of the Tree // The Prismatic Bridge";
      render(<TileBuildLink href="/decks/new?game=mtg&leader=k" words={WORDS} form={form} />);
      const link = screen.getByRole("link", { name: WORDS });
      const visible = visibleWords(link);
      expect(visible.trim()).toBe(form === "full" ? WORDS : "Build");
      // Word for word: the name starts with what shows, up to a word's end.
      expect(WORDS.startsWith(visible)).toBe(true);
      expect(WORDS === visible || visible.endsWith(" ")).toBe(true);
      // The rest is there for screen readers only, after the space (never with it inside).
      const hidden = link.querySelector(".sr-only");
      if (form === "short") expect(hidden?.textContent).toBe(WORDS.slice("Build ".length));
      else expect(hidden).toBeNull();
    },
  );

  it("the short form keeps a One Piece card number in the name", () => {
    render(
      <TileBuildLink
        href="/decks/new?game=optcg&leader=OP01-003"
        words="Build with Monkey.D.Luffy (OP01-003)"
        form="short"
      />,
    );
    const link = screen.getByRole("link", { name: "Build with Monkey.D.Luffy (OP01-003)" });
    expect(visibleWords(link).trim()).toBe("Build");
  });
});
