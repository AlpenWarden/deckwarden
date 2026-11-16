/**
 * /commanders' filter rows (COLOR-INCLUDES), the real page with its one
 * loader mocked: the color chips and All, the two mode chips in their named
 * group, the line under them, the name form's hidden inputs, Previous and
 * Next, and the two empty states' links. Exactly is the default and builds
 * the links the page built before the mode; including rides on every link;
 * the mode first and a color second works; Colorless is always exact and
 * the page says so; and the loader is handed the mask and the reader's
 * choice (what it runs for them is `src/lib/hub/queries.test.ts`'s). The
 * filter rows are in the server's markup as plain links.
 */
import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadLeaderIndex: vi.fn() }));

vi.mock("@/lib/hub/queries", () => ({
  LEADERS_PAGE_SIZE: 60,
  loadLeaderIndex: mocks.loadLeaderIndex,
}));
/** The app router (VIEW-TRANSITIONS): the grid asks it for a hub's payload on intent. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ prefetch: vi.fn() }) }));
vi.mock("next/link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/link")>()),
  useLinkStatus: () => ({ pending: false }),
}));

import CommandersPage from "./page";

type Query = Record<string, string | string[] | undefined>;

function leaderRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    name: `Commander ${i + 1}`,
    slug: `commander-${i + 1}`,
    ciMask: 4,
    costValue: 3,
    popularity: i + 1,
    cheapestUsd: null,
    printingId: null,
    imageOverride: null,
  }));
}

async function page(query: Query) {
  return CommandersPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(query),
  });
}

async function renderPage(query: Query) {
  return render(await page(query));
}

/** The filter's landmark and what is in it. */
function filterNav() {
  const nav = screen.getByRole("navigation", { name: "Color identity filter" });
  const group = within(nav).getByRole("group", { name: "Color match" });
  const link = (name: string) => within(nav).getByRole("link", { name });
  const href = (name: string) => link(name).getAttribute("href");
  const current = (name: string) => link(name).getAttribute("aria-current");
  return { nav, group, link, href, current };
}

const COLORS = ["White", "Blue", "Black", "Red", "Green", "Colorless"];

/** The name form's hidden inputs, as `name=value`. */
function hiddenInputs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('form[action="/commanders"] input[type="hidden"]')].map(
    (el) => `${el.getAttribute("name")}=${el.getAttribute("value")}`,
  );
}

beforeEach(() => {
  mocks.loadLeaderIndex.mockReset().mockResolvedValue(leaderRows(60));
});

describe("/commanders — exactly, the default", () => {
  it("asks for the exact identity and builds the links the page built before the mode", async () => {
    const { container } = await renderPage({ colors: "b" });
    expect(mocks.loadLeaderIndex).toHaveBeenCalledWith({
      ciMask: 4,
      ciMatch: "exactly",
      page: 1,
      q: "",
    });

    const f = filterNav();
    expect(["All", ...COLORS].map(f.href)).toEqual([
      "/commanders",
      "/commanders?colors=bw",
      "/commanders?colors=bu",
      "/commanders",
      "/commanders?colors=br",
      "/commanders?colors=bg",
      "/commanders?colors=c",
    ]);
    expect(f.current("Black")).toBe("page");
    expect(f.current("All")).toBeNull();
    expect(hiddenInputs(container)).toEqual(["colors=b"]);
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
      "/commanders?colors=b&page=2",
    );
    // No link and no input names the mode.
    expect(
      [...container.querySelectorAll("a")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.includes("match=")),
    ).toEqual(["/commanders?colors=b&match=including"]);
  });

  it("draws the two mode chips under the colors, Exactly current, with no line", async () => {
    await renderPage({ colors: "b" });
    const f = filterNav();
    const modes = within(f.group).getAllByRole("link");
    expect(modes.map((a) => a.textContent)).toEqual([
      "Exactly these colors",
      "Including these colors",
    ]);
    expect(f.href("Exactly these colors")).toBe("/commanders?colors=b");
    expect(f.href("Including these colors")).toBe("/commanders?colors=b&match=including");
    expect(f.current("Exactly these colors")).toBe("page");
    expect(f.current("Including these colors")).toBeNull();
    expect(f.link("Exactly these colors").className).toContain("ring-accent-game");
    expect(f.link("Including these colors").className).not.toContain("ring-accent-game");
    // The group follows the color row inside the one landmark.
    expect(f.nav.lastElementChild).toBe(f.group);
    expect(f.group.getAttribute("aria-describedby")).toBeNull();
    expect(f.nav.querySelector("p")).toBeNull();
  });

  it("any other value of match is exactly: the same request and the same links", async () => {
    const hrefs = (container: HTMLElement) =>
      [...container.querySelectorAll("main a")].map((a) => a.getAttribute("href"));
    const plain = await renderPage({ colors: "wu", page: "2" });
    const want = hrefs(plain.container);
    plain.unmount();
    for (const match of ["exactly", "within", "", "1"]) {
      const { container, unmount } = await renderPage({ colors: "wu", page: "2", match });
      expect([match, hrefs(container)]).toEqual([match, want]);
      unmount();
    }
    expect(mocks.loadLeaderIndex.mock.calls.map(([opts]) => opts)).toEqual(
      Array.from({ length: 5 }, () => ({ ciMask: 3, ciMatch: "exactly", page: 2, q: "" })),
    );
  });
});

describe("/commanders — including", () => {
  it("asks for every identity that holds the colors, and every link carries the mode", async () => {
    const { container } = await renderPage({
      colors: "b",
      match: "including",
      page: "2",
      q: "sy",
    });
    expect(mocks.loadLeaderIndex).toHaveBeenCalledWith({
      ciMask: 4,
      ciMatch: "including",
      page: 2,
      q: "sy",
    });

    const f = filterNav();
    expect(["All", ...COLORS].map(f.href)).toEqual([
      "/commanders?match=including&q=sy",
      "/commanders?colors=bw&match=including&q=sy",
      "/commanders?colors=bu&match=including&q=sy",
      "/commanders?match=including&q=sy",
      "/commanders?colors=br&match=including&q=sy",
      "/commanders?colors=bg&match=including&q=sy",
      "/commanders?colors=c&match=including&q=sy",
    ]);
    expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
      "/commanders?colors=b&match=including&q=sy",
    );
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
      "/commanders?colors=b&match=including&page=3&q=sy",
    );
    // The name form sends the colors and the mode with the name.
    expect(hiddenInputs(container)).toEqual(["colors=b", "match=including"]);
    // Only one link on the page leaves the mode: the Exactly chip.
    const filterLinks = [...container.querySelectorAll('main a[href^="/commanders?"]')].map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(filterLinks.filter((href) => !href.includes("match=including"))).toEqual([
      "/commanders?colors=b&q=sy",
    ]);
  });

  it("marks Including, restarts both chips at page 1, and states the rule under them", async () => {
    const { container } = await renderPage({ colors: "bg", match: "including", page: "2" });
    const f = filterNav();
    expect(f.current("Including these colors")).toBe("page");
    expect(f.current("Exactly these colors")).toBeNull();
    expect(f.href("Exactly these colors")).toBe("/commanders?colors=bg");
    expect(f.href("Including these colors")).toBe("/commanders?colors=bg&match=including");
    // Both picked colors stay marked.
    expect(COLORS.filter((name) => f.current(name) === "page")).toEqual(["Black", "Green"]);

    const note = f.nav.querySelector("p") as HTMLElement;
    expect(note.textContent).toBe(
      "Commanders whose colors include Black and Green, alone or with others.",
    );
    expect(f.group.getAttribute("aria-describedby")).toBe(note.id);
    // The rank is still a position in the list shown: page 2 opens at 61.
    const tiles = [...container.querySelectorAll('a[href^="/c/"]')];
    expect(tiles).toHaveLength(60);
    expect(tiles[0].getAttribute("href")).toBe("/c/commander-1");
    const rank = (tile: Element) => tile.querySelector(".absolute")?.textContent;
    expect([rank(tiles[0]), rank(tiles[59])]).toEqual(["61", "120"]);
  });

  it("the mode first and a color second: All keeps the mode and every color chip carries it", async () => {
    const { container } = await renderPage({ match: "including" });
    // No mask: the loader adds no color condition in either reading (queries.test.ts).
    expect(mocks.loadLeaderIndex).toHaveBeenCalledWith({
      ciMask: null,
      ciMatch: "including",
      page: 1,
      q: "",
    });
    const f = filterNav();
    expect(f.current("All")).toBe("page");
    expect(f.current("Including these colors")).toBe("page");
    expect(["All", ...COLORS].map(f.href)).toEqual([
      "/commanders?match=including",
      "/commanders?colors=w&match=including",
      "/commanders?colors=u&match=including",
      "/commanders?colors=b&match=including",
      "/commanders?colors=r&match=including",
      "/commanders?colors=g&match=including",
      "/commanders?colors=c&match=including",
    ]);
    expect(f.nav.querySelector("p")?.textContent).toBe(
      "Pick a color to see every commander whose colors include it.",
    );
    expect(hiddenInputs(container)).toEqual(["match=including"]);
  });

  it("Colorless is always exact, and the page says so in words", async () => {
    await renderPage({ colors: "c", match: "including" });
    // The page hands over the mask and the reader's choice; the loader runs
    // a mask of 0 exactly whatever the choice (queries.test.ts pins the SQL).
    expect(mocks.loadLeaderIndex).toHaveBeenCalledWith({
      ciMask: 0,
      ciMatch: "including",
      page: 1,
      q: "",
    });
    const f = filterNav();
    expect(f.current("Colorless")).toBe("page");
    // The reader's mode stays marked and stays on the links.
    expect(f.current("Including these colors")).toBe("page");
    expect(f.href("Black")).toBe("/commanders?colors=b&match=including");
    const note = f.nav.querySelector("p") as HTMLElement;
    expect(note.textContent).toBe(
      "Colorless is always exact: these commanders have no colors to include.",
    );
    // Visible text, not a title: a phone has no hover.
    expect(note.className).not.toContain("sr-only");
    expect(f.nav.querySelector("[title]")).toBeNull();
  });
});

describe("/commanders — the empty states", () => {
  beforeEach(() => {
    mocks.loadLeaderIndex.mockReset().mockResolvedValue([]);
  });

  it("an exact search past its end keeps the sentence it always had", async () => {
    await renderPage({ colors: "w", page: "40" });
    const back = screen.getByRole("link", { name: "Back to page 1" });
    expect(back.parentElement?.textContent).toBe(
      "No commanders match that exact color identity on this page. Back to page 1",
    );
    expect(back.getAttribute("href")).toBe("/commanders?colors=w");
  });

  it("an including search past its end never says exact, and its way back keeps the mode", async () => {
    await renderPage({ colors: "w", match: "including", page: "40" });
    const back = screen.getByRole("link", { name: "Back to page 1" });
    expect(back.parentElement?.textContent).toBe(
      "No commanders include that color on this page. Back to page 1",
    );
    expect(back.getAttribute("href")).toBe("/commanders?colors=w&match=including");
  });

  it("no color picked names no color search", async () => {
    await renderPage({ page: "90" });
    expect(screen.getByRole("link", { name: "Back to page 1" }).parentElement?.textContent).toBe(
      "No commanders on this page. Back to page 1",
    );
  });

  it("a name with no match: Clear filter keeps the colors and the mode", async () => {
    await renderPage({ colors: "ub", match: "including", q: "zzzz" });
    expect(screen.getByText("No commanders match “zzzz”")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Clear filter" }).getAttribute("href")).toBe(
      "/commanders?colors=ub&match=including",
    );
  });
});

describe("/commanders — the server's markup", () => {
  it("the mode chips and the hidden inputs are plain HTML: links with href and aria-current", async () => {
    const html = renderToString(await page({ colors: "b", match: "including" }));
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*href="\/commanders\?colors=b&amp;match=including"[^>]*>Including these colors<\/a>/,
    );
    expect(html).toMatch(/<a[^>]*href="\/commanders\?colors=b"[^>]*>Exactly these colors<\/a>/);
    expect(html).toContain('<input type="hidden" name="match" value="including"/>');
    expect(html).toContain("Commanders whose colors include Black, alone or with others.");
  });
});
