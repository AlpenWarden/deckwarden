/**
 * /commanders' filters (COLOR-INCLUDES), the real page with its one loader
 * mocked: the color chips and All, the one toggle chip after them in its
 * named group, the line under the filter row, the name form's hidden
 * inputs, Previous and Next, and the two empty states' links. Exactly is the
 * default and builds the links the page built before the mode; including
 * rides on every link; the mode first and a color second works; Colorless is
 * always exact and the page says so; and the loader is handed the mask and
 * the reader's choice (what it runs for them is
 * `src/lib/hub/queries.test.ts`'s). The filters are in the server's markup
 * as plain links.
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

/** The toggle chip's words. */
const TOGGLE = "Include other colors";
const COLORS = ["White", "Blue", "Black", "Red", "Green", "Colorless"];

/** The filter's landmark and what is in it. */
function filterNav() {
  const nav = screen.getByRole("navigation", { name: "Color identity filter" });
  const group = within(nav).getByRole("group", { name: "Color match" });
  const link = (name: string) => within(nav).getByRole("link", { name });
  const href = (name: string) => link(name).getAttribute("href");
  const current = (name: string) => link(name).getAttribute("aria-current");
  return { nav, group, link, href, current };
}

/** The line under the filter row, when the page draws one. */
const noteLine = () => document.getElementById("commanders-match-note");

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
    // One link names the mode, the toggle that would turn it on, and no input does.
    expect(
      [...container.querySelectorAll("a")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.includes("match=")),
    ).toEqual(["/commanders?colors=b&match=including"]);
  });

  it("draws one toggle after the colors: a link, unpressed, in its own named group, with no line", async () => {
    await renderPage({ colors: "b" });
    const f = filterNav();
    const toggles = within(f.group).getAllByRole("link");
    expect(toggles.map((a) => a.textContent)).toEqual([TOGGLE]);
    expect(f.href(TOGGLE)).toBe("/commanders?colors=b&match=including");
    expect(f.current(TOGGLE)).toBeNull();
    expect(f.link(TOGGLE).className).not.toContain("ring-accent-game");
    expect(f.link(TOGGLE).getAttribute("aria-describedby")).toBeNull();

    // It follows the colors in the chips' own row: the group draws no box.
    expect(f.nav.lastElementChild).toBe(f.group);
    expect(f.group.className).toBe("contents");
    expect(within(f.nav).getAllByRole("link")).toHaveLength(8);
    expect(within(f.nav).getAllByRole("link").at(-1)).toBe(f.link(TOGGLE));
    // The last color alone keeps the air that sets the toggle apart, and with
    // a mouse only: on touch the row has no pixel to give (REDESIGN.md).
    expect(COLORS.filter((name) => f.link(name).className.includes("pointer-fine:mr-1.5"))).toEqual(
      ["Colorless"],
    );
    for (const name of ["All", ...COLORS, TOGGLE]) {
      expect([
        name,
        f
          .link(name)
          .className.split(" ")
          .filter((c) => /^m[lrx]-/.test(c)),
      ]).toEqual([name, []]);
    }

    // The exact page pays no height for a line.
    expect(noteLine()).toBeNull();
    expect(f.nav.querySelector("p")).toBeNull();
  });

  it("the toggle's label reserves its pressed width, so pressing it never moves it", async () => {
    // A pressed chip is medium weight and its words 3.4 px wider; where the
    // row is that full the toggle would drop a row on its own press. The
    // label holds the same words in medium weight as generated content with
    // no height, never drawn and never read out, in both states.
    const labelOf = () => filterNav().link(TOGGLE).firstElementChild as HTMLElement;
    const off = await renderPage({ colors: "b" });
    const classes = labelOf().className;
    expect(labelOf().tagName).toBe("SPAN");
    expect(labelOf().getAttribute("data-label")).toBe(TOGGLE);
    expect(labelOf().textContent).toBe(TOGGLE);
    expect(classes.split(" ")).toEqual(
      expect.arrayContaining([
        "inline-flex",
        "flex-col",
        "after:invisible",
        "after:h-0",
        "after:font-medium",
        "after:content-[attr(data-label)_/_'']",
      ]),
    );
    off.unmount();
    await renderPage({ colors: "b", match: "including" });
    expect(labelOf().className).toBe(classes);
    expect(labelOf().getAttribute("data-label")).toBe(TOGGLE);
    // The link is still named by its words alone.
    expect(filterNav().link(TOGGLE).textContent).toBe(TOGGLE);
  });

  it("the filter row is top-aligned, and the chips carry a mouse pointer's 4 px with it", async () => {
    // jsdom lays nothing out: the pixels are the harness's (REDESIGN.md). This
    // pins the pair that makes them. The row no longer centers or shares a
    // baseline, so a second row of chips cannot move the name box; from `sm`
    // the chips take the rest of the box's row and wrap there; and a 24 px
    // chip is centered on the 32 px box by 4 px, with a mouse only (on touch
    // both are 44 px).
    await renderPage({ colors: "b" });
    const f = filterNav();
    const row = f.nav.parentElement as HTMLElement;
    expect(row.className).toContain("items-start");
    expect(row.className).not.toMatch(/items-(center|baseline)/);
    expect(f.nav.className.split(" ")).toEqual(
      expect.arrayContaining(["flex", "flex-wrap", "sm:flex-1", "sm:pointer-fine:pt-1"]),
    );
    expect(row.querySelector("form")?.className).toBe("w-full sm:w-56");
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
    // Only one link on the page leaves the mode: the toggle, which turns it off.
    const filterLinks = [...container.querySelectorAll('main a[href^="/commanders?"]')].map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(filterLinks.filter((href) => !href.includes("match=including"))).toEqual([
      "/commanders?colors=b&q=sy",
    ]);
    expect(f.href(TOGGLE)).toBe("/commanders?colors=b&q=sy");
  });

  it("presses the toggle, links it back to the exact page 1, and states the rule under the filter row", async () => {
    const { container } = await renderPage({ colors: "bg", match: "including", page: "2" });
    const f = filterNav();
    expect(f.current(TOGGLE)).toBe("page");
    expect(f.link(TOGGLE).className).toContain("ring-accent-game");
    expect(f.href(TOGGLE)).toBe("/commanders?colors=bg");
    // Both picked colors stay marked beside it.
    expect(COLORS.filter((name) => f.current(name) === "page")).toEqual(["Black", "Green"]);

    // The line is the filter row's next sibling, outside the landmark, and
    // describes the toggle.
    const note = noteLine() as HTMLElement;
    expect(note.textContent).toBe(
      "Commanders whose colors include Black and Green, alone or with others.",
    );
    expect(note.tagName).toBe("P");
    expect(f.nav.contains(note)).toBe(false);
    expect(f.nav.parentElement?.nextElementSibling).toBe(note);
    expect(f.link(TOGGLE).getAttribute("aria-describedby")).toBe(note.id);

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
    expect(f.current(TOGGLE)).toBe("page");
    expect(f.href(TOGGLE)).toBe("/commanders");
    expect(["All", ...COLORS].map(f.href)).toEqual([
      "/commanders?match=including",
      "/commanders?colors=w&match=including",
      "/commanders?colors=u&match=including",
      "/commanders?colors=b&match=including",
      "/commanders?colors=r&match=including",
      "/commanders?colors=g&match=including",
      "/commanders?colors=c&match=including",
    ]);
    expect(noteLine()?.textContent).toBe(
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
    // The reader's mode stays pressed and stays on the links.
    expect(f.current(TOGGLE)).toBe("page");
    expect(f.href("Black")).toBe("/commanders?colors=b&match=including");
    const note = noteLine() as HTMLElement;
    expect(note.textContent).toBe(
      "Colorless is always exact: these commanders have no colors to include.",
    );
    // Visible text, not a title: a phone has no hover.
    expect(note.className).not.toContain("sr-only");
    expect(f.nav.querySelector("[title]")).toBeNull();
    expect(note.hasAttribute("title")).toBe(false);
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
  /** The toggle's opening tag, as the server wrote it. */
  const toggleTag = (html: string) =>
    html.match(/<a\b[^>]*>(?=<span[^>]*>Include other colors<\/span><\/a>)/)?.[0] ?? "";
  /** How often the words are text in the document (the label's attribute aside). */
  const written = (html: string) => html.match(/>Include other colors</g)?.length ?? 0;

  it("under including the toggle is a plain link back to the exact page, marked current, and the line and the hidden input are HTML", async () => {
    const html = renderToString(await page({ colors: "b", match: "including" }));
    expect(written(html)).toBe(1);
    const tag = toggleTag(html);
    expect(tag).toContain('href="/commanders?colors=b"');
    expect(tag).toContain('aria-current="page"');
    expect(tag).toContain('aria-describedby="commanders-match-note"');
    expect(html).toContain('<input type="hidden" name="match" value="including"/>');
    expect(html).toMatch(
      /<p id="commanders-match-note"[^>]*>Commanders whose colors include Black, alone or with others\.<\/p>/,
    );
  });

  it("by default the toggle is a plain link to the including page, unmarked, and no line is written", async () => {
    const html = renderToString(await page({ colors: "b" }));
    expect(written(html)).toBe(1);
    const tag = toggleTag(html);
    expect(tag).toContain('href="/commanders?colors=b&amp;match=including"');
    expect(tag).not.toContain("aria-current");
    expect(tag).not.toContain("aria-describedby");
    expect(html).not.toContain("commanders-match-note");
    expect(html).not.toContain('name="match"');
  });
});
