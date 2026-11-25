/**
 * NameSuggest (X2, WAVE3.md D0 + D2): the predictive name box. Fetch is
 * stubbed per request (so a test decides when and how each answers, and can
 * see its AbortSignal); timers are fake for the 150 ms debounce. Typing is a
 * real `input` event with an `inputType` — Base UI treats a change without
 * one as autofill and does not open. jsdom has no implicit form submission,
 * so "Enter with no highlight submits the form" is pinned as its contract:
 * the keydown is NOT default-prevented (the browser then submits) and the
 * popup closes; the footer row's submit is a real `submit` event.
 *
 * COMMANDER-DOOR: the opt-in build entry under a top row that can lead a new
 * deck, in its own describe at the end. The cases above it run without the
 * prop, with rows that are leaders, and are unedited: no entry there is the
 * proof that the five other boxes did not change.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SuggestRow } from "@/lib/search/suggest";

import { NameSuggest, SUGGEST_DEBOUNCE_MS, type NameSuggestProps } from "./name-suggest";

interface Pending {
  url: URL;
  signal: AbortSignal;
  answer: (rows: SuggestRow[]) => void;
  fail: () => void;
}
let pending: Pending[] = [];

beforeEach(() => {
  pending = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
        pending.push({
          url,
          signal: init!.signal!,
          answer: (rows) =>
            resolve(
              new Response(JSON.stringify({ q: url.searchParams.get("q"), results: rows }), {
                status: 200,
              }),
            ),
          fail: () => resolve(new Response("{}", { status: 500 })),
        });
      });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function row(name: string, extra: Partial<SuggestRow> = {}): SuggestRow {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `id-${slug}`,
    name,
    slug,
    isLeader: true,
    typeLine: "Legendary Creature",
    colorsMask: 0,
    ciMask: 23,
    externalKey: `key-${slug}`,
    image: null,
    ...extra,
  };
}

const ATRAXA = row("Atraxa, Praetors' Voice", {
  image: "https://cards.scryfall.io/small/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg",
});
const GRAND = row("Atraxa, Grand Unifier");

const COMMANDERS: NameSuggestProps = {
  game: "mtg",
  scope: "leaders",
  rowHref: { prefix: "/c/", key: "slug" },
  detail: "colors",
  name: "q",
  id: "commanders-q",
  placeholder: "Filter by name…",
  footerNoun: "commander",
};

function renderInForm(props: Partial<NameSuggestProps> = {}) {
  const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return new FormData(e.currentTarget).get("q");
  });
  render(
    <form action="/commanders" method="get" role="search" onSubmit={onSubmit}>
      <label htmlFor="commanders-q">Filter by name</label>
      <NameSuggest {...COMMANDERS} {...props} />
      <input type="hidden" name="colors" value="wubg" />
    </form>,
  );
  const input = screen.getByRole("combobox", { name: "Filter by name" }) as HTMLInputElement;
  return { input, onSubmit };
}

function typeText(input: HTMLElement, value: string) {
  fireEvent.input(input, { target: { value }, inputType: "insertText" });
}

/** Past the debounce: the request goes out. */
async function debounce() {
  await act(async () => {
    vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS);
  });
}

async function answer(rows: SuggestRow[], which = pending.at(-1)!) {
  await act(async () => {
    which.answer(rows);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const listbox = () => screen.queryByRole("listbox");
const options = () => within(screen.getByRole("listbox")).getAllByRole("option");

describe("NameSuggest", () => {
  it("one letter sends nothing and opens nothing; two letters ask, and the popup opens with the answer", async () => {
    const { input } = renderInForm();
    typeText(input, "a");
    await debounce();
    expect(pending).toHaveLength(0);
    expect(listbox()).toBeNull();

    typeText(input, "at");
    expect(pending).toHaveLength(0); // still inside the debounce
    await debounce();
    expect(pending).toHaveLength(1);
    const { searchParams } = pending[0].url;
    expect(pending[0].url.pathname).toBe("/api/cards/suggest");
    expect(Object.fromEntries(searchParams)).toEqual({ game: "mtg", scope: "leaders", q: "at" });
    expect(listbox()).toBeNull(); // no rows to show until the answer lands
    await answer([ATRAXA, GRAND]);
    expect(options().map((o) => o.textContent)).toEqual([
      expect.stringContaining("Atraxa, Praetors' Voice"),
      expect.stringContaining("Atraxa, Grand Unifier"),
      "Show every commander matching “at”↵",
    ]);
    expect(screen.getByRole("status").textContent).toBe("2 suggestions");
  });

  it("one request key: Sol, sol and `sol ` are one request — the client sends the normalized text", async () => {
    const { input } = renderInForm();
    typeText(input, "Sol");
    await debounce();
    typeText(input, "sol");
    await debounce();
    typeText(input, "sol ");
    await debounce();
    typeText(input, " SOL");
    await debounce();
    expect(pending).toHaveLength(1);
    expect(pending[0].url.searchParams.get("q")).toBe("sol");
  });

  it("a stale request is aborted when the text moves on, and its late answer is dropped", async () => {
    const { input } = renderInForm();
    typeText(input, "at");
    await debounce();
    const first = pending[0];
    typeText(input, "atr");
    expect(first.signal.aborted).toBe(true);
    await debounce();
    expect(pending).toHaveLength(2);
    expect(pending[1].url.searchParams.get("q")).toBe("atr");
    await answer([ATRAXA], pending[1]);
    expect(options()[0].textContent).toContain("Atraxa, Praetors' Voice");
  });

  it("rows link to their hub, show a thumbnail or a same-width spacer, and a color detail", async () => {
    const { input } = renderInForm();
    typeText(input, "atr");
    await debounce();
    await answer([ATRAXA, GRAND]);
    const [first, second] = options();
    expect(first.tagName).toBe("A");
    expect(first.getAttribute("href")).toBe("/c/atraxa-praetors-voice");
    expect(second.getAttribute("href")).toBe("/c/atraxa-grand-unifier");
    const thumbs = document.querySelectorAll('[data-slot="thumb"]');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].querySelector("img")?.getAttribute("src")).toBe(ATRAXA.image);
    expect(thumbs[1].querySelector("img")).toBeNull();
    expect(within(first).getByText("White")).toBeTruthy(); // ciMask 23 = W U B G, sr-only names
  });

  it("nothing is highlighted until an arrow key; hovering a row does not arm Enter", async () => {
    const { input } = renderInForm();
    typeText(input, "atr");
    await debounce();
    await answer([ATRAXA, GRAND]);
    expect(options().some((o) => o.hasAttribute("data-highlighted"))).toBe(false);
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.pointerMove(options()[1], { pointerType: "mouse" });
    fireEvent.mouseMove(options()[1]);
    expect(options().some((o) => o.hasAttribute("data-highlighted"))).toBe(false);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()[0].hasAttribute("data-highlighted")).toBe(true);
    expect(input.getAttribute("aria-activedescendant")).toBe(options()[0].id);
  });

  it("Enter with nothing highlighted closes the popup and leaves the keydown to the browser (the form submits)", async () => {
    const { input } = renderInForm();
    typeText(input, "atr");
    await debounce();
    await answer([ATRAXA]);
    const notPrevented = fireEvent.keyDown(input, { key: "Enter" });
    expect(notPrevented).toBe(true);
    expect(listbox()).toBeNull();
    expect(input.value).toBe("atr");
    expect(input.getAttribute("name")).toBe("q");
    expect(input.form?.getAttribute("action")).toBe("/commanders");
  });

  it("a pick navigates: Enter on a highlighted row follows its link and never rewrites the text", async () => {
    const followed: string[] = [];
    const follow = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (a) {
        followed.push(a.getAttribute("href")!);
        e.preventDefault(); // jsdom cannot navigate
      }
    };
    document.addEventListener("click", follow);
    try {
      const onValueChange = vi.fn();
      const { input } = renderInForm({ onValueChange });
      typeText(input, "atr");
      onValueChange.mockClear();
      await debounce();
      await answer([ATRAXA, GRAND]);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const notPrevented = fireEvent.keyDown(input, { key: "Enter" });
      expect(notPrevented).toBe(false); // a pick is not a form submit
      expect(followed).toEqual(["/c/atraxa-grand-unifier"]);
      expect(input.value).toBe("atr");
      expect(onValueChange).not.toHaveBeenCalled();
      expect(listbox()).toBeNull();

      typeText(input, "atra");
      await debounce();
      await answer([ATRAXA]);
      fireEvent.click(options()[0]);
      expect(followed).toEqual(["/c/atraxa-grand-unifier", "/c/atraxa-praetors-voice"]);
      expect(input.value).toBe("atra");
    } finally {
      document.removeEventListener("click", follow);
    }
  });

  it("pick mode (X5): rows are plain options; click or Enter hands the row over and closes the popup", async () => {
    const onPick = vi.fn();
    render(
      <NameSuggest
        game="mtg"
        scope="cards"
        detail="type"
        type="text"
        aria-label="Search a Magic card"
        onPick={onPick}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Search a Magic card" }) as HTMLInputElement;
    typeText(input, "atr");
    await debounce();
    expect(Object.fromEntries(pending[0].url.searchParams)).toEqual({
      game: "mtg",
      scope: "cards",
      q: "atr",
    });
    await answer([ATRAXA, GRAND]);
    expect(options().map((o) => o.tagName)).toEqual(["DIV", "DIV"]);
    expect(options().some((o) => o.hasAttribute("href"))).toBe(false);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenLastCalledWith(GRAND);
    expect(listbox()).toBeNull();

    typeText(input, "atra");
    await debounce();
    await answer([ATRAXA]);
    fireEvent.click(options()[0]);
    expect(onPick).toHaveBeenLastCalledWith(ATRAXA);
    expect(listbox()).toBeNull();
  });

  it("Esc closes the popup and keeps the text", async () => {
    const { input } = renderInForm();
    typeText(input, "atr");
    await debounce();
    await answer([ATRAXA]);
    expect(listbox()).toBeTruthy();
    const notPrevented = fireEvent.keyDown(input, { key: "Escape" });
    expect(notPrevented).toBe(false); // so a search input's native Esc-clear does not run
    expect(listbox()).toBeNull();
    expect(input.value).toBe("atr");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("the footer row submits the owning form with the typed text, by click or by Enter", async () => {
    const { input, onSubmit } = renderInForm();
    typeText(input, "Atr");
    await debounce();
    await answer([ATRAXA]);
    const footer = options().at(-1)!;
    expect(footer.textContent).toBe("Show every commander matching “Atr”↵");
    expect(footer.tagName).not.toBe("A");
    fireEvent.click(footer);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.results[0].value).toBe("Atr");
    expect(input.value).toBe("Atr");

    typeText(input, "Atra");
    await debounce();
    await answer([ATRAXA]);
    fireEvent.keyDown(input, { key: "ArrowUp" }); // from the input, ArrowUp reaches the last row
    expect(options().at(-1)!.hasAttribute("data-highlighted")).toBe(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.results[1].value).toBe("Atra");
  });

  it("nothing matched: one quiet 'No matches' line, and the footer still offers the full list", async () => {
    const { input } = renderInForm();
    typeText(input, "iki");
    await debounce();
    await answer([]);
    const popup = document.querySelector<HTMLElement>('[data-slot="name-suggest-popup"]')!;
    expect(within(popup).getByText("No matches").tagName).toBe("P");
    expect(options().map((o) => o.textContent)).toEqual(["Show every commander matching “iki”↵"]);
    expect(screen.getByRole("status").textContent).toBe("No matches");
  });

  it("a failed request closes the popup quietly; the box keeps working and the next answer reopens it", async () => {
    const { input } = renderInForm();
    typeText(input, "atr");
    await debounce();
    await act(async () => {
      pending[0].fail();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(listbox()).toBeNull();
    expect(input.value).toBe("atr");
    typeText(input, "atra");
    await debounce();
    await answer([ATRAXA]);
    expect(options()[0].textContent).toContain("Atraxa");
  });

  it("controlled (/cards): the text is the parent's, rows open card pages, and there is no footer", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <NameSuggest
        game="mtg"
        scope="cards"
        rowHref={{ prefix: "/cards/", key: "id" }}
        detail="type"
        value=""
        onValueChange={onValueChange}
        aria-label="Card name"
        inputClassName="field-class"
      />,
    );
    const input = screen.getByRole("combobox", { name: "Card name" }) as HTMLInputElement;
    expect(input.className).toBe("field-class");
    expect(input.getAttribute("name")).toBeNull();
    expect(document.querySelector('button[type="submit"]')).toBeNull(); // no form, no button
    typeText(input, "sol");
    expect(onValueChange).toHaveBeenLastCalledWith("sol");
    rerender(
      <NameSuggest
        game="mtg"
        scope="cards"
        rowHref={{ prefix: "/cards/", key: "id" }}
        detail="type"
        value="sol"
        onValueChange={onValueChange}
        aria-label="Card name"
        inputClassName="field-class"
      />,
    );
    await debounce();
    expect(Object.fromEntries(pending[0].url.searchParams)).toEqual({
      game: "mtg",
      scope: "cards",
      q: "sol",
    });
    await answer([row("Sol Ring", { id: "id-sol", slug: null, typeLine: "Artifact" })]);
    const [first] = options();
    expect(first.getAttribute("href")).toBe("/cards/id-sol");
    expect(within(first).getByText("Artifact")).toBeTruthy();
    expect(options()).toHaveLength(1);
  });

  it("leaving the box before the answer lands: the late answer does not pop the list up", async () => {
    const { input } = renderInForm();
    typeText(input, "atr");
    await debounce();
    fireEvent.blur(input);
    await answer([ATRAXA]);
    expect(listbox()).toBeNull();
    typeText(input, "atra"); // back in the box: typing asks again
    await debounce();
    await answer([ATRAXA]);
    expect(listbox()).toBeTruthy();
  });

  it("a page that lands with ?q= makes no request until the reader types", async () => {
    renderInForm({ defaultValue: "atraxa praetors" });
    await debounce();
    expect(pending).toHaveLength(0);
  });

  it('server render: the same <input name="q"> with the typed value, so the GET form works without JavaScript', () => {
    const html = renderToString(
      <form action="/commanders" method="get" role="search">
        <NameSuggest {...COMMANDERS} defaultValue="atraxa praetors" />
      </form>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const named = doc.querySelectorAll("form input[name]");
    expect(named).toHaveLength(1);
    const input = named[0] as HTMLInputElement;
    expect(input.getAttribute("name")).toBe("q");
    expect(input.getAttribute("value")).toBe("atraxa praetors");
    expect(input.getAttribute("id")).toBe("commanders-q");
    expect(input.getAttribute("type")).toBe("search");
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(doc.querySelector('[role="listbox"]')).toBeNull();
    // Enter submits a script-less form only through a default button: Base
    // UI's unnamed mirror input is a second text field (see the next test).
    expect(doc.querySelectorAll('form button[type="submit"]')).toHaveLength(1);
  });

  it("keeps Enter-to-submit: a named box brings its form a default button, because Base UI adds a second text field", () => {
    // HTML implicit submission refuses a form with two text-like fields and
    // no submit button — measured in the pane: Enter submitted nothing until
    // this button existed. jsdom has no implicit submission, so the pin is
    // the form's shape: two blocking fields, one default button.
    const { input } = renderInForm();
    const form = input.form!;
    const blocking = [...form.querySelectorAll("input")].filter((i) =>
      ["text", "search"].includes(i.type),
    );
    expect(blocking).toHaveLength(2);
    const buttons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].tabIndex).toBe(-1);
    expect(buttons[0].getAttribute("aria-hidden")).toBe("true");
    expect(buttons[0].hidden).toBe(false); // rendered: WebKit skips a box-less default button
  });
});

describe("NameSuggest: the examples (SEARCH-EXAMPLES)", () => {
  const EXAMPLES = [
    { text: "Atraxa", href: "/cards?q=Atraxa", detail: "Magic" },
    { text: "OP01-001", href: "/cards?game=optcg&q=OP01-001", detail: "One Piece" },
  ];
  const tryLine = () => document.querySelector('[data-slot="name-suggest-try"]');

  it("without examples (every box but the header's) a focus opens nothing and asks nothing", async () => {
    const { input } = renderInForm();
    act(() => input.focus());
    await debounce();
    expect(listbox()).toBeNull();
    expect(pending).toHaveLength(0);
  });

  it("a focus with under two characters offers them under Try: links to their searches, a detail each, announced as a count", async () => {
    const { input } = renderInForm({ examples: EXAMPLES });
    act(() => input.focus());
    expect(tryLine()?.textContent).toBe("Try");
    expect(options().map((o) => [o.tagName, o.getAttribute("href"), o.textContent])).toEqual([
      ["A", "/cards?q=Atraxa", "AtraxaMagic"],
      ["A", "/cards?game=optcg&q=OP01-001", "OP01-001One Piece"],
    ]);
    expect(options()[0].querySelector('[data-slot="example-icon"] svg')).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("2 examples");
    typeText(input, "a");
    expect(options().map((o) => o.getAttribute("href"))).toEqual([
      "/cards?q=Atraxa",
      "/cards?game=optcg&q=OP01-001",
    ]);
    await debounce();
    expect(pending).toHaveLength(0); // one letter still asks nothing
  });

  it("nothing is highlighted until an arrow key; Enter on an example follows its link and leaves the text alone", async () => {
    const followed: string[] = [];
    const follow = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (a) {
        followed.push(a.getAttribute("href")!);
        e.preventDefault(); // jsdom cannot navigate
      }
    };
    document.addEventListener("click", follow);
    try {
      const { input } = renderInForm({ examples: EXAMPLES });
      act(() => input.focus());
      expect(options().some((o) => o.hasAttribute("data-highlighted"))).toBe(false);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const notPrevented = fireEvent.keyDown(input, { key: "Enter" });
      expect(notPrevented).toBe(false); // a pick, not a form submit
      expect(followed).toEqual(["/cards?game=optcg&q=OP01-001"]);
      expect(input.value).toBe("");
      expect(listbox()).toBeNull();
    } finally {
      document.removeEventListener("click", follow);
    }
  });

  it("two letters: the examples stand while the ask is in flight, the answer's rows take their place, and under two letters they come back", async () => {
    const { input } = renderInForm({ examples: EXAMPLES });
    act(() => input.focus());
    typeText(input, "at");
    await debounce();
    expect(pending).toHaveLength(1);
    expect(options().map((o) => o.getAttribute("href"))).toEqual([
      "/cards?q=Atraxa",
      "/cards?game=optcg&q=OP01-001",
    ]);
    await answer([ATRAXA]);
    expect(tryLine()).toBeNull();
    expect(options().map((o) => o.getAttribute("href"))).toEqual([
      "/c/atraxa-praetors-voice",
      null, // the footer
    ]);
    expect(screen.getByRole("status").textContent).toBe("1 suggestion");
    typeText(input, "a");
    expect(tryLine()?.textContent).toBe("Try");
    expect(screen.getByRole("status").textContent).toBe("2 examples");
    // Emptied: Base UI asks to shut ("input-clear"), and the examples stay.
    typeText(input, "");
    expect(tryLine()?.textContent).toBe("Try");
    expect(options()).toHaveLength(2);
  });

  it("without examples, emptying the box shuts the popup as before", async () => {
    const { input } = renderInForm();
    typeText(input, "at");
    await debounce();
    await answer([ATRAXA]);
    expect(listbox()).not.toBeNull();
    typeText(input, "");
    expect(listbox()).toBeNull();
  });

  it("a focus on a box that already holds a name changes nothing until a key is typed", async () => {
    const { input } = renderInForm({ examples: EXAMPLES, defaultValue: "atraxa" });
    act(() => input.focus());
    await debounce();
    expect(listbox()).toBeNull();
    expect(pending).toHaveLength(0);
  });
});

describe("NameSuggest: the build entry (COMMANDER-DOOR)", () => {
  /** The header's box: every card, rows to card pages, the footer, and the opt-in prop. */
  const HEADER: Partial<NameSuggestProps> = {
    scope: "cards",
    rowHref: { prefix: "/cards/", key: "id" },
    detail: "type",
    footerNoun: "card",
    buildEntry: { mtg: { withKey: false }, optcg: { withKey: true } },
  };
  const SOL_RING = row("Sol Ring", { isLeader: false, slug: null, typeLine: "Artifact" });
  const GOLOS = row("Golos, Tireless Pilgrim", { buildBlocked: true });
  const LUFFY = row("Monkey.D.Luffy", { externalKey: "OP01-003", typeLine: "Leader" });
  const ATRAXA_BUILD = "Build with Atraxa, Praetors' Voice";
  const ATRAXA_HREF = "/decks/new?game=mtg&leader=key-atraxa-praetors-voice";

  /** Each option as its tag, its address and its words. */
  const listed = () => options().map((o) => [o.tagName, o.getAttribute("href"), o.textContent]);
  const buildOptions = () =>
    options().filter((o) => (o.getAttribute("href") ?? "").startsWith("/decks/new"));

  /** Record followed links instead of navigating (jsdom cannot). */
  function recordFollows() {
    const followed: string[] = [];
    const follow = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (a) {
        followed.push(a.getAttribute("href")!);
        e.preventDefault();
      }
    };
    document.addEventListener("click", follow);
    return { followed, stop: () => document.removeEventListener("click", follow) };
  }

  async function typed(input: HTMLElement, text: string, rows: SuggestRow[]) {
    typeText(input, text);
    await debounce();
    await answer(rows);
  }

  it("a top row that is a legal leader gets one entry directly under it: an option that is a link, named by its words", async () => {
    // The entry's key is its own: sharing the row's would make React report a duplicate.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { input } = renderInForm(HEADER);
    await typed(input, "atraxa", [ATRAXA, GRAND]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect(listed()).toEqual([
      ["A", "/cards/id-atraxa-praetors-voice", expect.stringContaining("Atraxa, Praetors' Voice")],
      ["A", ATRAXA_HREF, ATRAXA_BUILD],
      ["A", "/cards/id-atraxa-grand-unifier", expect.stringContaining("Atraxa, Grand Unifier")],
      ["DIV", null, "Show every card matching “atraxa”↵"],
    ]);
    // An option of the listbox whose accessible name is its words.
    const entry = screen.getByRole("option", { name: ATRAXA_BUILD });
    expect(entry).toBe(options()[1]);
    // A hammer in the thumbnail's column, hidden from the name; no thumbnail of its own.
    const icon = entry.querySelector('[data-slot="build-icon"]')!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.querySelector("svg")).not.toBeNull();
    expect(entry.querySelector('[data-slot="thumb"]')).toBeNull();
    // The whole name stays readable: the words wrap and are never cut off.
    const words = entry.querySelector("span:not([data-slot])")!;
    expect(words.textContent).toBe(ATRAXA_BUILD);
    expect(words.className).toContain("min-w-0");
    expect(words.className).toContain("wrap-break-word");
    expect(words.className).not.toContain("truncate");
    // The status line counts the rows, not the entry (nor the footer).
    expect(screen.getByRole("status").textContent).toBe("2 suggestions");
  });

  it("only the top row: a leader in second place gets none, and neither does a top row that is no leader", async () => {
    const { input } = renderInForm(HEADER);
    await typed(input, "sol", [SOL_RING, ATRAXA]);
    expect(buildOptions()).toHaveLength(0);
    expect(options()).toHaveLength(3);
    await typed(input, "sol ring", [SOL_RING]);
    expect(buildOptions()).toHaveLength(0);
  });

  it("a top row that carries buildBlocked (a banned commander) gets none, though the next row could lead", async () => {
    const { input } = renderInForm(HEADER);
    await typed(input, "golos", [GOLOS, ATRAXA]);
    expect(buildOptions()).toHaveLength(0);
    expect(listed().map(([, href]) => href)).toEqual([
      "/cards/id-golos-tireless-pilgrim",
      "/cards/id-atraxa-praetors-voice",
      null,
    ]);
  });

  it("without the prop, a top row that is a legal leader adds no entry (the five other boxes)", async () => {
    const { input } = renderInForm({ ...HEADER, buildEntry: undefined });
    await typed(input, "atraxa", [ATRAXA, GRAND]);
    expect(buildOptions()).toHaveLength(0);
    expect(options()).toHaveLength(3);
  });

  it("a game the prop leaves out gets none", async () => {
    const { input } = renderInForm({ ...HEADER, buildEntry: { optcg: { withKey: true } } });
    await typed(input, "atraxa", [ATRAXA]);
    expect(buildOptions()).toHaveLength(0);
  });

  it("with the prop and onPick (pick mode), none either, even where the rows have somewhere to go", async () => {
    const onPick = vi.fn();
    render(
      <NameSuggest
        game="mtg"
        scope="cards"
        detail="type"
        aria-label="Search a Magic card"
        onPick={onPick}
        rowHref={HEADER.rowHref}
        buildEntry={HEADER.buildEntry}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Search a Magic card" });
    await typed(input, "atraxa", [ATRAXA, GRAND]);
    expect(options().map((o) => o.tagName)).toEqual(["DIV", "DIV"]);
    expect(buildOptions()).toHaveLength(0);
  });

  it("with the key, the words carry the row's printed id, and the link is the row's game", async () => {
    const { input } = renderInForm({ ...HEADER, game: "optcg" });
    await typed(input, "luffy", [LUFFY]);
    const entry = screen.getByRole("option", { name: "Build with Monkey.D.Luffy (OP01-003)" });
    expect(entry.getAttribute("href")).toBe("/decks/new?game=optcg&leader=OP01-003");
    // Magic, on the same prop, names the card alone.
    cleanup();
    const magic = renderInForm(HEADER);
    await typed(magic.input, "atraxa", [ATRAXA]);
    expect(buildOptions().map((o) => o.textContent)).toEqual([ATRAXA_BUILD]);
  });

  it("arrow down twice and Enter follows the entry, and the box keeps its text while the entry is highlighted", async () => {
    const { followed, stop } = recordFollows();
    try {
      const onValueChange = vi.fn();
      const { input } = renderInForm({ ...HEADER, onValueChange });
      await typed(input, "atraxa", [ATRAXA, GRAND]);
      onValueChange.mockClear();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(options()[0].hasAttribute("data-highlighted")).toBe(true);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      const entry = options()[1];
      expect(entry.hasAttribute("data-highlighted")).toBe(true);
      expect(input.getAttribute("aria-activedescendant")).toBe(entry.id);
      expect(input.value).toBe("atraxa");
      const notPrevented = fireEvent.keyDown(input, { key: "Enter" });
      expect(notPrevented).toBe(false); // a pick, not a form submit
      expect(followed).toEqual([ATRAXA_HREF]);
      expect(input.value).toBe("atraxa");
      expect(onValueChange).not.toHaveBeenCalled();
      expect(listbox()).toBeNull();
    } finally {
      stop();
    }
  });

  it("a plain click on the entry follows it and closes the popup; a new-tab click keeps it open", async () => {
    const { followed, stop } = recordFollows();
    try {
      const { input } = renderInForm(HEADER);
      await typed(input, "atraxa", [ATRAXA]);
      fireEvent.click(buildOptions()[0], { metaKey: true });
      expect(listbox()).not.toBeNull();
      fireEvent.click(buildOptions()[0]);
      expect(followed).toEqual([ATRAXA_HREF, ATRAXA_HREF]);
      expect(listbox()).toBeNull();
      expect(input.value).toBe("atraxa");
    } finally {
      stop();
    }
  });

  it("Enter with nothing highlighted is still left to the browser, entry or no entry", async () => {
    const { input } = renderInForm(HEADER);
    await typed(input, "atraxa", [ATRAXA]);
    expect(buildOptions()).toHaveLength(1);
    expect(options().some((o) => o.hasAttribute("data-highlighted"))).toBe(false);
    const notPrevented = fireEvent.keyDown(input, { key: "Enter" });
    expect(notPrevented).toBe(true); // the form submits the typed text
    expect(listbox()).toBeNull();
    expect(input.value).toBe("atraxa");
  });

  it("never among the examples: they stand alone until the first answer lands", async () => {
    const EXAMPLES = [{ text: "Atraxa", href: "/cards?q=Atraxa", detail: "Magic" }];
    const { input } = renderInForm({ ...HEADER, examples: EXAMPLES });
    act(() => input.focus());
    expect(listed()).toEqual([["A", "/cards?q=Atraxa", "AtraxaMagic"]]);
    typeText(input, "atraxa");
    await debounce();
    expect(listed()).toEqual([["A", "/cards?q=Atraxa", "AtraxaMagic"]]); // the ask is in flight
    await answer([ATRAXA]);
    expect(buildOptions().map((o) => o.textContent)).toEqual([ATRAXA_BUILD]);
  });

  it("the same top row under a longer text keeps its entry; a new top row moves it", async () => {
    const { input } = renderInForm(HEADER);
    await typed(input, "atr", [ATRAXA, GRAND]);
    expect(buildOptions().map((o) => o.textContent)).toEqual([ATRAXA_BUILD]);
    await typed(input, "atraxa g", [GRAND, ATRAXA]);
    expect(listed().map(([, , words]) => words)).toEqual([
      expect.stringContaining("Atraxa, Grand Unifier"),
      "Build with Atraxa, Grand Unifier",
      expect.stringContaining("Atraxa, Praetors' Voice"),
      "Show every card matching “atraxa g”↵",
    ]);
  });

  it("an answer that lands under a highlight keeps the highlight's position: on the second position that is the entry (pinned as it is, LATER.md)", async () => {
    // Typing clears the highlight; an answer landing does not, and Base UI gives no way
    // to clear it from outside. So: rows shown, a longer text typed, the arrow keys
    // pressed while its answer is in flight, and then the answer lands.
    const { followed, stop } = recordFollows();
    try {
      const { input } = renderInForm(HEADER);
      await typed(input, "so", [SOL_RING, row("Solemn Simulacrum", { isLeader: false })]);
      typeText(input, "atraxa");
      expect(options().some((o) => o.hasAttribute("data-highlighted"))).toBe(false);
      await debounce(); // the ask is out; the old rows still show
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(options()[1].textContent).toContain("Solemn Simulacrum");
      expect(options()[1].hasAttribute("data-highlighted")).toBe(true);

      await answer([ATRAXA, GRAND]);
      const highlighted = options().filter((o) => o.hasAttribute("data-highlighted"));
      expect(highlighted.map((o) => o.textContent)).toEqual([ATRAXA_BUILD]);
      fireEvent.keyDown(input, { key: "Enter" });
      expect(followed).toEqual([ATRAXA_HREF]);
    } finally {
      stop();
    }
  });
});
