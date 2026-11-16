/**
 * PRECON-CHANGES — the "Changes from <precon>" sheet on its own: two lists,
 * each with its count, grouped by type in the deck list's order and A to Z;
 * the quantity only when above one; Add rows with the cheapest price and the
 * collection's mark; one cost line, which is the ownership line's "missing"
 * when the precon is owned; Copy as text in the export's grammar; and the
 * names of cards this session has not seen from ONE GET /api/precons/<slug>,
 * asked only when a name is missing, with its failure and Try again.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deckOwnership, formatUsd } from "@/lib/collection/ownership";
import type { CardWire, EditorCard } from "@/lib/decks/editor-state";
import { preconChanges, type PreconChanges } from "@/lib/decks/precon-changes";
import { ownedPreconCopies, preconCards } from "@/lib/decks/precon-owned";
import { COMMANDER } from "@/lib/games/mtg/formats";
import { card } from "@/lib/games/mtg/test-fixtures";
import { getAdapter } from "@/lib/games/registry";

import { PreconChangesSheet } from "./precon-changes-sheet";

const mtg = getAdapter("mtg");
const make = (
  name: string,
  primaryType: string,
  cheapestUsd: number | null,
  over: Partial<EditorCard> = {},
): EditorCard => ({
  ...card({ name, primaryType, costValue: primaryType === "Land" ? null : 2, cheapestUsd }),
  image: null,
  ...over,
});

const atraxa = make("Atraxa, Praetors' Voice", "Creature", 12.34, { isLeaderCandidate: true });
// The box.
const falconer = make("Abzan Falconer", "Creature", 0.2);
const divination = make("Divination", "Sorcery", 0.05);
const mindStone = make("Mind Stone", "Artifact", 0.35);
const cultivate = make("Cultivate", "Sorcery", 0.6);
const forest = make("Forest", "Land", 0.1);
// What comes in.
const study = make("Rhystic Study", "Enchantment", 66.76);
const rift = make("Cyclonic Rift", "Instant", 29.57);
const tithe = make("Smothering Tithe", "Enchantment", 52.77);
const signet = make("Arcane Signet", "Artifact", 0.5);
const mystery = make("Mystery Card", "Artifact", null);

type Row = { cardId: string; zone: string; qty: number };
const row = (c: EditorCard, qty = 1, zone = "main"): Row => ({ cardId: c.id, zone, qty });
const BOX: Row[] = [
  row(atraxa, 1, "commander"),
  row(falconer),
  row(divination),
  row(mindStone),
  row(cultivate),
  row(forest, 12),
];
const PRECON = preconCards(BOX, COMMANDER);
/** Falconer, Divination, Mind Stone and Cultivate out; four cards and two Forests in. */
const LIST: Row[] = [
  row(atraxa, 1, "commander"),
  row(study),
  row(rift),
  row(tithe),
  row(signet),
  row(forest, 14),
];
const CHANGES = preconChanges(PRECON, LIST, COMMANDER);
const ALL = [
  atraxa,
  falconer,
  divination,
  mindStone,
  cultivate,
  forest,
  study,
  rift,
  tithe,
  signet,
  mystery,
];
const mapOf = (cards: EditorCard[]) => new Map(cards.map((c) => [c.id, c]));
const EVERY = mapOf(ALL);
/** After a reload the editor holds the current list's cards only. */
const LIVE_ONLY = mapOf([atraxa, study, rift, tithe, signet, forest]);

const fetchMock = vi.fn();
const writeText = vi.fn();
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });
const preconResponse = (cards: EditorCard[]) => ({
  precon: { slug: "breed_lethality_c16", productName: "Breed Lethality" },
  deck: { name: "Breed Lethality", game: "mtg", format: "commander", leaderIds: [atraxa.id] },
  cards: cards.map((c) => ({
    cardId: c.id,
    zone: "main",
    qty: 1,
    tags: [],
    printingId: null,
    card: c as CardWire,
  })),
});
const BOX_CARDS = [atraxa, falconer, divination, mindStone, cultivate, forest];

function sheet(
  over: Partial<React.ComponentProps<typeof PreconChangesSheet>> & {
    changes?: PreconChanges;
  } = {},
) {
  return (
    <PreconChangesSheet
      adapter={mtg}
      precon={{ slug: "breed_lethality_c16", name: "Breed Lethality" }}
      changes={CHANGES}
      cards={EVERY}
      owned={null}
      phone={false}
      onClose={() => {}}
      {...over}
    />
  );
}

const dialog = () => screen.getByRole("dialog", { name: "Changes from Breed Lethality" });
const list = (side: "out" | "in") => document.querySelector<HTMLElement>(`[data-list=${side}]`)!;
const rows = (side: "out" | "in") =>
  [...list(side).querySelectorAll<HTMLElement>("[data-change-row]")].map((li) =>
    li.textContent!.replace(/\s+/g, " ").trim(),
  );
const groups = (side: "out" | "in") =>
  [...list(side).querySelectorAll("h4")].map((h) => h.textContent);
const preconGets = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/precons/"));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => ok(preconResponse(BOX_CARDS)));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PreconChangesSheet — the two lists", () => {
  it("titled with the precon's name, with the lead and both headings beside their counts", () => {
    render(sheet());
    expect(
      within(dialog()).getByText(
        "What to take out of the precon and what to add to build this list.",
      ),
    ).toBeTruthy();
    const out = within(dialog()).getByRole("region", { name: /^Take out/ });
    const added = within(dialog()).getByRole("region", { name: /^Add/ });
    expect(out.querySelector("h3")!.textContent).toBe("Take out 4");
    expect(added.querySelector("h3")!.textContent).toBe("Add 6");
    expect(out.querySelector("[data-slot=list-count]")!.textContent).toBe("4");
    expect(added.querySelector("[data-slot=list-count]")!.textContent).toBe("6");
  });

  it("rows by type in the deck list's order, A to Z inside, the quantity only when above one", () => {
    render(sheet());
    expect(groups("out")).toEqual(["Creature 1", "Sorcery 2", "Artifact 1"]);
    expect(rows("out")).toEqual(["Abzan Falconer", "Cultivate", "Divination", "Mind Stone"]);
    expect(groups("in")).toEqual(["Instant 1", "Artifact 1", "Enchantment 2", "Land 2"]);
    expect(rows("in")).toEqual([
      "Cyclonic Rift $29.57",
      "Arcane Signet $0.50",
      "Rhystic Study $66.76",
      "Smothering Tithe $52.77",
      "2 Forest $0.10 each",
    ]);
    // Only the Forests say a quantity.
    expect(
      [...dialog().querySelectorAll("[data-slot=qty]")].map((q) =>
        q.closest("[data-change-row]")!.getAttribute("data-change-row"),
      ),
    ).toEqual([forest.id]);
  });

  it("Take out rows carry no price; an Add row with no known price says so", () => {
    render(
      sheet({
        changes: preconChanges(
          PRECON,
          [...BOX.slice(0, 5), row(mystery), row(forest, 12)],
          COMMANDER,
        ),
      }),
    );
    expect(list("out").querySelector("[data-slot=price]")).toBeNull();
    expect(rows("in")).toEqual(["Mystery Card no price yet"]);
  });

  it("the collection's mark on the Add rows it holds, and never on a Take out row", () => {
    render(sheet({ owned: new Set([study.id, forest.id, falconer.id]) }));
    const marked = [
      ...dialog().querySelectorAll("[role=img][aria-label='In your collection']"),
    ].map((m) => m.closest("[data-change-row]")!.getAttribute("data-change-row"));
    expect(marked).toEqual([study.id, forest.id]);
    expect(list("out").querySelector("[role=img]")).toBeNull();
  });

  it("under Add, one line says what the deck list's mark means; none when nothing is added", () => {
    const { unmount } = render(sheet());
    const note = list("in").querySelector("[data-slot=precon-changes-mark-note]")!;
    expect(note.textContent).toBe("A circled plus marks these cards in the deck list.");
    expect(note.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(note.previousElementSibling?.tagName).toBe("H3");
    expect(list("out").querySelector("[data-slot=precon-changes-mark-note]")).toBeNull();
    unmount();
    render(sheet({ changes: preconChanges(PRECON, BOX.slice(0, 5), COMMANDER) }));
    expect(document.querySelector("[data-slot=precon-changes-mark-note]")).toBeNull();
  });

  it("names wrap, never truncate: a list to pull cards by", () => {
    render(sheet());
    const name = within(list("in")).getByText("Smothering Tithe");
    expect(name.className).toContain("break-words");
    expect(name.className).not.toContain("truncate");
  });

  it("a side with nothing in it says so", () => {
    const { unmount } = render(
      sheet({ changes: preconChanges(PRECON, [...BOX, row(signet)], COMMANDER) }),
    );
    expect(within(list("out")).getByText("Nothing to take out.")).toBeTruthy();
    expect(rows("in")).toEqual(["Arcane Signet $0.50"]);
    unmount();
    render(sheet({ changes: preconChanges(PRECON, BOX.slice(0, 5), COMMANDER) }));
    expect(within(list("in")).getByText("Nothing to add.")).toBeTruthy();
    expect(rows("out")).toEqual(["12 Forest"]);
    // Nothing to add: no cost line, and no word about prices.
    expect(document.querySelector("[data-slot=precon-changes-cost]")).toBeNull();
    expect(screen.queryByText("Prices are each card's cheapest printing.")).toBeNull();
  });

  it("on a phone it is the full-height Drawer, with the same name: its top never moves as names land", () => {
    render(sheet({ phone: true }));
    expect(dialog().getAttribute("data-slot")).toBe("drawer-popup");
    expect(dialog().className).toContain("[--drawer-height:calc(100dvh-3rem)]");
    expect(rows("out")).toHaveLength(4);
  });

  it("from md it is the wide Modal: two lists side by side", () => {
    render(sheet());
    expect(dialog().className).toContain("sm:max-w-2xl");
    expect(list("out").parentElement!.className).toContain("md:grid-cols-2");
  });
});

describe("PreconChangesSheet — the cost of the cards to add", () => {
  const cost = () => document.querySelector("[data-slot=precon-changes-cost]")!.textContent;

  it("one line: the copies to add at their cheapest printings, to the cent", () => {
    render(sheet());
    // 66.76 + 29.57 + 52.77 + 0.50 + 2 × 0.10
    expect(cost()).toBe("The cards to add cost $149.80.");
    expect(screen.getByText("Prices are each card's cheapest printing.")).toBeTruthy();
  });

  it("the collection's cards are left out and counted, every copy of them", () => {
    render(sheet({ owned: new Set([study.id, forest.id]) }));
    expect(cost()).toBe("The cards to add cost $82.84, not counting the 3 you own.");
  });

  it("with the precon owned and no collection it is the ownership line's missing, to the cent", () => {
    render(sheet());
    const line = deckOwnership(
      LIST,
      EVERY,
      new Set(),
      COMMANDER,
      ownedPreconCopies({ owns: true, cards: PRECON })!,
    );
    expect(line.missingUsd).toBe(149.8);
    expect(cost()).toBe(`The cards to add cost $${line.missingUsd.toFixed(2)}.`);
    // The line itself rounds that same number to whole dollars.
    expect(formatUsd(line.missingUsd)).toBe("$150");
  });

  it("and with a collection too", () => {
    const collection = new Set([study.id, forest.id]);
    render(sheet({ owned: collection }));
    const line = deckOwnership(
      LIST,
      EVERY,
      collection,
      COMMANDER,
      ownedPreconCopies({ owns: true, cards: PRECON })!,
    );
    expect(cost()).toContain(`$${line.missingUsd.toFixed(2)}`);
  });
});

describe("PreconChangesSheet — names for cards this session has not seen", () => {
  it("every card known (a draft from its seed): no request at all", () => {
    render(sheet());
    expect(rows("out")).toHaveLength(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a cut card the editor never saw: ONE GET for the precon's own list; the Add list comes with the names, so nothing jumps", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async () => {
      await gate;
      return ok(preconResponse(BOX_CARDS));
    });
    render(sheet({ cards: LIVE_ONLY }));
    expect(within(list("out")).getByText("Loading the precon's cards…")).toBeTruthy();
    expect(rows("out")).toEqual([]);
    // The count is the list's own: it never waits. So is the cost, above both lists.
    expect(list("out").querySelector("[data-slot=list-count]")!.textContent).toBe("4");
    expect(document.querySelector("[data-slot=precon-changes-cost]")!.textContent).toBe(
      "The cards to add cost $149.80.",
    );
    // Nothing sits below the wait: the Add list is not on screen yet.
    expect(document.querySelector("[data-list=in]")).toBeNull();
    expect(list("out").nextElementSibling).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Copy as text" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      release();
    });
    await waitFor(() => expect(rows("out")).toHaveLength(4));
    expect(rows("out")).toEqual(["Abzan Falconer", "Cultivate", "Divination", "Mind Stone"]);
    expect(groups("out")).toEqual(["Creature 1", "Sorcery 2", "Artifact 1"]);
    expect(screen.queryByText("Loading the precon's cards…")).toBeNull();
    expect(rows("in")).toHaveLength(5);

    expect(preconGets()).toHaveLength(1);
    const [url, init] = preconGets()[0];
    expect(url).toBe("/api/precons/breed_lethality_c16");
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    expect((init as RequestInit).body).toBeUndefined();
    // Opening wrote nothing: that GET is the only request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("under StrictMode the aborted twin writes nothing and one answer lands", async () => {
    render(<StrictMode>{sheet({ cards: LIVE_ONLY })}</StrictMode>);
    await waitFor(() => expect(rows("out")).toHaveLength(4));
    const signals = preconGets().map(([, init]) => (init as RequestInit).signal!);
    // The first ask was aborted by the twin's cleanup; the second answered.
    expect(signals.map((s) => s.aborted)).toEqual([true, false]);
  });

  it("a failure says so with Try again, which asks once more", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) }),
    );
    render(sheet({ cards: LIVE_ONLY }));
    await waitFor(() =>
      expect(within(list("out")).getByText("Couldn't load the precon's cards.")).toBeTruthy(),
    );
    expect(document.querySelector("[data-slot=precon-changes-status]")!.textContent).toBe(
      "Couldn't load the precon's cards.",
    );
    expect(rows("in")).toHaveLength(5);
    expect(
      (screen.getByRole("button", { name: "Copy as text" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(within(list("out")).getByRole("button", { name: "Try again" }));
    // Asking again leaves the Add list where it is.
    expect(rows("in")).toHaveLength(5);
    await waitFor(() => expect(rows("out")).toHaveLength(4));
    expect(preconGets()).toHaveLength(2);
    expect(screen.queryByText("Couldn't load the precon's cards.")).toBeNull();
    expect(document.querySelector("[data-slot=precon-changes-status]")!.textContent).toBe("");
  });

  it("a network error is the same failure", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
    render(sheet({ cards: LIVE_ONLY }));
    await waitFor(() =>
      expect(within(list("out")).getByText("Couldn't load the precon's cards.")).toBeTruthy(),
    );
  });

  it("closing aborts the ask", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(sheet({ cards: LIVE_ONLY }));
    const signal = (preconGets()[0][1] as RequestInit).signal!;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("a card the precon's own list can't name is listed as Unknown card, and copied so", async () => {
    // The product was re-read: its list no longer holds Mind Stone.
    fetchMock.mockImplementation(() =>
      ok(preconResponse(BOX_CARDS.filter((c) => c.id !== mindStone.id))),
    );
    render(sheet({ cards: LIVE_ONLY }));
    await waitFor(() => expect(rows("out")).toHaveLength(4));
    expect(rows("out")).toEqual(["Abzan Falconer", "Cultivate", "Divination", "Unknown card"]);
    // No type to group it by: after the known types.
    expect(groups("out")).toEqual(["Creature 1", "Sorcery 2", "Other 1"]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    });
    expect(writeText.mock.calls[0][0]).toContain("1 Unknown card\n");
  });
});

describe("PreconChangesSheet — Copy as text", () => {
  it("two headed blocks of `1 Name` lines, A to Z, the export's grammar", async () => {
    render(sheet());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(
      [
        "Take out",
        "1 Abzan Falconer",
        "1 Cultivate",
        "1 Divination",
        "1 Mind Stone",
        "",
        "Add",
        "1 Arcane Signet",
        "1 Cyclonic Rift",
        "2 Forest",
        "1 Rhystic Study",
        "1 Smothering Tithe",
        "",
      ].join("\n"),
    );
    expect(document.querySelector("[data-slot=copy-status]")!.textContent).toBe("Copied");
    // The button keeps its name, and nothing else was asked.
    expect(screen.getByRole("button", { name: "Copy as text" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a refused clipboard says so", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(sheet());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    });
    expect(screen.getByText("Couldn't copy.")).toBeTruthy();
  });

  it("after the names load, the copied text holds them", async () => {
    render(sheet({ cards: LIVE_ONLY }));
    await waitFor(() => expect(rows("out")).toHaveLength(4));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    });
    expect(writeText.mock.calls[0][0]).toContain(
      "Take out\n1 Abzan Falconer\n1 Cultivate\n1 Divination\n1 Mind Stone\n\nAdd\n",
    );
  });
});
