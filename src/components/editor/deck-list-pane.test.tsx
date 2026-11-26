/**
 * The deck pane's legality line (Y4a, WAVE4 D5): the bracket line renders
 * directly after the ValidationPanel — the Warden's line when approved, the
 * progress and problem lines otherwise — and before the leader zone; with
 * no `bracket` the pane renders as before. U4a: the phone Deck tab (one
 * count, the "Group · Sort" popover). ROLLING-NUMBERS: the total's digits.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toEditorCard, type EditorEntry } from "@/lib/decks/editor-state";
import { COMMANDER } from "@/lib/games/mtg/formats";
import { card } from "@/lib/games/mtg/test-fixtures";
import { startDoors } from "@/lib/decks/start-doors";
import { getAdapter } from "@/lib/games/registry";
import type { ValidationIssue } from "@/lib/games/types";

import { DeckListPane } from "./deck-list-pane";

const mtg = getAdapter("mtg");
const kozilek = toEditorCard({
  ...card({ name: "Kozilek, the Great Distortion", isLeaderCandidate: true }),
  image: null,
});
const entries: EditorEntry[] = [{ cardId: kozilek.id, zone: "commander", qty: 1, tags: [] }];
const cards = new Map([[kozilek.id, kozilek]]);

function pane(issues: ValidationIssue[], bracket?: React.ReactNode) {
  return render(
    <DeckListPane
      adapter={mtg}
      format={COMMANDER}
      entries={entries}
      cards={cards}
      issues={issues}
      analytics={[]}
      onSetQty={() => undefined}
      onRemove={() => {}}
      onPreview={() => {}}
      bracket={bracket}
      extras={false}
    />,
  );
}

const slot = <p data-testid="bracket">At least Bracket 3 (Upgraded) Why?</p>;

beforeEach(() => {
  window.localStorage.clear();
});

describe("DeckListPane — the bracket line's place", () => {
  it("approved: directly after the Warden's line", () => {
    pane([], slot);
    const warden = screen.getByRole("status");
    expect(warden.textContent).toContain("The Warden approves this deck");
    expect(warden.nextElementSibling).toBe(screen.getByTestId("bracket"));
  });

  it("not yet legal: directly after the progress and problem lines, before the leader zone", () => {
    const { container } = pane(
      [
        { code: "DECK_SIZE", severity: "error", message: "99 cards to go.", progress: true },
        { code: "BANNED", severity: "error", message: "1 card(s) are banned in Commander." },
      ],
      slot,
    );
    const validation = container.querySelector("[data-slot=progress-line]")!.parentElement!;
    expect(validation.textContent).toContain("1 problem");
    expect(validation.nextElementSibling).toBe(screen.getByTestId("bracket"));
    const zone = screen.getAllByText("Kozilek, the Great Distortion")[0];
    expect(
      screen.getByTestId("bracket").compareDocumentPosition(zone) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("no bracket, no line: the Warden's line is followed by what followed it before", () => {
    pane([]);
    expect(screen.queryByTestId("bracket")).toBeNull();
    expect(screen.getByRole("status").nextElementSibling?.getAttribute("data-testid")).not.toBe(
      "bracket",
    );
  });
});

describe("DeckListPane — the bones (U3a, WAVE5 D4)", () => {
  function full(over: Partial<React.ComponentProps<typeof DeckListPane>> = {}) {
    return render(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={entries}
        cards={cards}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        {...over}
      />,
    );
  }

  it("the Warden line and the bracket line share one status slot, siblings in order", () => {
    full({ bracket: slot });
    const status = document.querySelector<HTMLElement>("[data-slot=status-slot]")!;
    expect(status.contains(screen.getByRole("status"))).toBe(true);
    expect(status.contains(screen.getByTestId("bracket"))).toBe(true);
    expect(screen.getByRole("status").nextElementSibling).toBe(screen.getByTestId("bracket"));
  });

  it("the first line holds the Warden line's 20 px: the progress line takes leading-5, its dot in the 16 px gutter", () => {
    full({
      entries: [],
      issues: [
        { code: "DECK_SIZE", severity: "error", message: "100 cards to go.", progress: true },
      ],
    });
    const line = document.querySelector<HTMLElement>("[data-slot=progress-line]")!;
    expect(line.className).toContain("leading-5");
    expect(line.firstElementChild?.className).toContain("size-4");
  });

  it("View / Group / Sort: View is the group's name, not a visible label; Group and Sort keep theirs", () => {
    window.localStorage.clear();
    full({
      entries: [...entries, { cardId: "extra", zone: "main", qty: 1, tags: [] }],
      cards: new Map([
        ...cards,
        [
          "extra",
          toEditorCard({
            ...card({ name: "Sol Ring", primaryType: "Artifact" }),
            id: "extra",
            image: null,
          }),
        ],
      ]),
    });
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Group" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sort" })).toBeTruthy();
    expect(screen.queryByText("View")).toBeNull();
    expect(screen.getByText("Group")).toBeTruthy();
    expect(screen.getByText("Sort")).toBeTruthy();
  });

  it("the summary's right cluster never wraps from md; on a phone the row keeps the 44 px of Add cards", () => {
    full();
    const size = document.querySelector<HTMLElement>("[data-slot=deck-size]")!;
    expect(size.className).toContain("shrink-0");
    expect(size.className).toContain("whitespace-nowrap");
    expect(size.parentElement!.className).toContain("min-w-0");
    expect(size.parentElement!.className).toContain("md:flex-nowrap");
    const row = size.parentElement!.parentElement!;
    expect(row.className).toContain("max-md:pointer-coarse:min-h-11");
    expect((row.firstElementChild as HTMLElement).className).toContain("self-stretch");
  });

  it("while a seed lands the leader zone holds the card's box and the extras wait; then both are back", () => {
    const { rerender } = render(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={[]}
        cards={new Map()}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        onChooseLeader={() => {}}
        seeding
      />,
    );
    expect(document.querySelector("[data-slot=leader-pending]")).not.toBeNull();
    expect(screen.queryByText("No commander yet")).toBeNull();
    expect(screen.queryByText("Sample hand")).toBeNull();
    // The seed lands: the commander and one main-deck card (a library to draw from).
    const sol = toEditorCard({
      ...card({ name: "Sol Ring", primaryType: "Artifact" }),
      image: null,
    });
    rerender(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={[...entries, { cardId: sol.id, zone: "main", qty: 1, tags: [] }]}
        cards={new Map([...cards, [sol.id, sol]])}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        onChooseLeader={() => {}}
      />,
    );
    expect(document.querySelector("[data-slot=leader-pending]")).toBeNull();
    expect(screen.getAllByText("Kozilek, the Great Distortion").length).toBeGreaterThan(0);
    expect(screen.getByText("Sample hand")).toBeTruthy();
  });

  it("the leader image is the pane's LCP: priority", () => {
    full({
      cards: new Map([
        [kozilek.id, { ...kozilek, image: "https://cards.scryfall.io/normal/front/a/b/ab.jpg" }],
      ]),
    });
    const img = screen.getByRole("img", { name: "Kozilek, the Great Distortion" });
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });
});

describe("DeckListPane — the phone Deck tab (U4a, WAVE5 D5)", () => {
  const sol = toEditorCard({
    ...card({ name: "Sol Ring", primaryType: "Artifact" }),
    id: "sol",
    image: null,
  });
  const listedEntries: EditorEntry[] = [
    ...entries,
    { cardId: "sol", zone: "main", qty: 1, tags: [] },
  ];
  const listedCards = new Map([...cards, ["sol", sol]]);

  function pane(over: Partial<React.ComponentProps<typeof DeckListPane>> = {}) {
    return render(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={listedEntries}
        cards={listedCards}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        onAddCards={() => {}}
        extras={false}
        {...over}
      />,
    );
  }

  /** Base UI triggers open on the pointer sequence, not a bare click. */
  function press(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { pointerType: "mouse", button: 0 });
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger, { button: 0 });
  }

  it("one count: the heading sr-only below md (the tab is the title); the ring leads its count, the count in the foreground and its words muted; Add cards at the right", () => {
    pane({ phone: true });
    expect(screen.getByRole("heading", { level: 2, name: "Deck" }).className).toContain(
      "max-md:sr-only",
    );
    const size = document.querySelector<HTMLElement>("[data-slot=deck-size]")!;
    // The label's words are unchanged; the count is its own span.
    expect(size.textContent).toBe("2 / 100 · 98 to go");
    const count = size.firstElementChild as HTMLElement;
    expect(count.textContent).toBe("2 / 100");
    expect(count.className).toBe("max-md:text-foreground max-md:font-medium");
    expect(size.className).toContain("text-muted-foreground");
    const cluster = size.parentElement!;
    expect(cluster.className).toContain("max-md:justify-start max-md:gap-x-1.5");
    expect(cluster.querySelector("[data-slot=completion-ring]")?.getAttribute("class")).toContain(
      "max-md:order-first",
    );
    // "Add cards" rides the other group, which goes last on a phone.
    const add = screen.getByRole("button", { name: "Add cards" });
    expect(add.parentElement!.className).toContain("max-md:order-last");
    expect(add.parentElement!.className).toContain("self-stretch");
  });

  it("at the minimum the words read cards; over it the rank-cuts link is 44 px on a phone's touch", () => {
    pane({
      entries: [...entries, { cardId: "sol", zone: "main", qty: 100, tags: [] }],
      onOpenCuts: () => {},
    });
    expect(document.querySelector("[data-slot=deck-size]")?.textContent).toBe("101 / 100 cards");
    expect(screen.getByRole("button", { name: /^Over by 1/ }).className).toContain(
      "max-md:pointer-coarse:min-h-11",
    );
  });

  it("one controls row on a phone: View, then Group · Sort; its popover holds Group and Sort, stays open on a pick, and Escape returns focus to the trigger", async () => {
    pane({ phone: true });
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Group" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Sort" })).toBeNull();
    const trigger = screen.getByRole("button", { name: "Group · Sort" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.parentElement!.className).toBe("mt-4 flex items-center justify-between gap-3");

    press(trigger);
    const popover = await screen.findByRole("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popover.className).toContain("grid w-auto grid-cols-[auto_auto]");
    expect(popover.className).toContain("*:contents");
    const group = within(popover).getByRole("group", { name: "Group" });
    within(popover).getByRole("group", { name: "Sort" });
    expect(within(popover).getByText("Group")).toBeTruthy();
    expect(within(popover).getByText("Sort")).toBeTruthy();

    // A pick regroups the list and leaves the popover open for the other.
    fireEvent.click(within(group).getByRole("button", { name: "Cost" }));
    expect(within(group).getByRole("button", { name: "Cost" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("dialog")).toBe(popover);

    // Focus inside the popover (a finger on the pressed item), then Escape from there.
    const pressed = within(group).getByRole("button", { name: "Cost" });
    pressed.focus();
    expect(popover.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(pressed, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("from md the three Segmenteds sit inline (U3a's row) and there is no popover", () => {
    pane({ phone: false });
    expect(screen.getByRole("group", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Group" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sort" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Group · Sort" })).toBeNull();
  });
});

describe("DeckListPane — the type order (DECK-TOKENS)", () => {
  const typed = (primaryType: string, name: string) =>
    toEditorCard({
      ...card({ name, primaryType, attrs: { type_line: primaryType, oracle_text: "" } }),
      image: null,
    });
  const list = [
    typed("Land", "Command Tower"),
    typed("Enchantment", "Rhystic Study"),
    typed("Artifact", "Arcane Signet"),
    typed("Instant", "Swords to Plowshares"),
    typed("Sorcery", "Demonic Tutor"),
    typed("Creature", "Birds of Paradise"),
  ];
  const typedEntries: EditorEntry[] = [
    ...entries,
    ...list.map((c) => ({
      cardId: c.id,
      zone: "main",
      qty: c.primaryType === "Land" ? 37 : 1,
      tags: [],
    })),
  ];
  const typedCards = new Map([[kozilek.id, kozilek], ...list.map((c) => [c.id, c] as const)]);

  it.each(["text", "grid"] as const)(
    "the %s view reads the commander first, then Creatures, Sorceries, Instants, Artifacts, Enchantments, Lands",
    (view) => {
      window.localStorage.setItem(
        "deckwarden:deck-view",
        JSON.stringify({ view, groupBy: "primaryType", sortBy: "name" }),
      );
      render(
        <DeckListPane
          adapter={mtg}
          format={COMMANDER}
          entries={typedEntries}
          cards={typedCards}
          issues={[]}
          analytics={[]}
          onSetQty={() => undefined}
          onRemove={() => {}}
          onPreview={() => {}}
          extras={false}
        />,
      );
      // The commander's zone heads the list; then the owner's order, the 37 lands
      // last of the 100 — and the Tokens section after them, outside it, then
      // Maybe (MAYBE-LIST), outside it too.
      const sequence = [...document.querySelectorAll("h3")].map((h) => h.textContent);
      expect(sequence).toEqual([
        "Commander1",
        "Creature1",
        "Sorcery1",
        "Instant1",
        "Artifact1",
        "Enchantment1",
        "Land37",
        "Tokens0",
        "Maybe0",
      ]);
    },
  );
});

describe("DeckListPane — Do you own this precon? (PRECON-OWNED)", () => {
  const sol = toEditorCard({ ...card({ name: "Sol Ring", primaryType: "Artifact" }), image: null });
  const listed: EditorEntry[] = [...entries, { cardId: sol.id, zone: "main", qty: 1, tags: [] }];
  const listedCards = new Map([...cards, [sol.id, sol]]);
  const ownership = {
    ownedQty: 2,
    totalQty: 2,
    missingCards: 0,
    missingUsd: 0,
    unpricedMissing: 0,
  };
  function withPrecon(over: Partial<React.ComponentProps<typeof DeckListPane>> = {}) {
    return (
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={listed}
        cards={listedCards}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        extras={false}
        precon={{ name: "Breed Lethality", owns: null }}
        onAnswerPrecon={() => {}}
        {...over}
      />
    );
  }
  const line = () => document.querySelector<HTMLElement>("[data-slot=precon-line]");

  it("one line directly after the leader zone and before View / Group / Sort", () => {
    render(withPrecon());
    const el = line()!;
    expect(el.tagName).toBe("P");
    expect(el.previousElementSibling?.tagName).toBe("SECTION");
    expect(
      within(el.previousElementSibling as HTMLElement).getAllByText(/Kozilek/).length,
    ).toBeGreaterThan(0);
    expect(
      within(el.nextElementSibling as HTMLElement).getByRole("group", { name: "View" }),
    ).toBeTruthy();
  });

  it("its three states: asked with Yes and No, owned or not with Change; Change asks again, the answer is the editor's", () => {
    const answers: boolean[] = [];
    const { rerender } = render(withPrecon({ onAnswerPrecon: (owns) => answers.push(owns) }));
    expect(line()!.textContent).toBe(
      "Started from Breed Lethality, a precon. Do you own it? Yes No",
    );
    fireEvent.click(within(line()!).getByRole("button", { name: "Yes" }));
    expect(answers).toEqual([true]);

    rerender(withPrecon({ precon: { name: "Breed Lethality", owns: true } }));
    expect(line()!.textContent).toBe("Started from Breed Lethality, a precon you own. Change");
    expect(line()!.dataset.state).toBe("owned");
    rerender(
      withPrecon({
        precon: { name: "Breed Lethality", owns: false },
        onAnswerPrecon: (owns) => answers.push(owns),
      }),
    );
    expect(line()!.textContent).toBe(
      "Started from Breed Lethality, a precon you don't own. Change",
    );
    fireEvent.click(within(line()!).getByRole("button", { name: "Change" }));
    expect(line()!.textContent).toBe(
      "Started from Breed Lethality, a precon. Do you own it? Yes No",
    );
    // Change alone answers nothing; the pick does.
    expect(answers).toEqual([true]);
    fireEvent.click(within(line()!).getByRole("button", { name: "No" }));
    expect(answers).toEqual([true, false]);
  });

  it("no precon (or no handler), no line", () => {
    const { rerender } = render(withPrecon({ precon: null }));
    expect(line()).toBeNull();
    rerender(withPrecon({ onAnswerPrecon: undefined }));
    expect(line()).toBeNull();
  });

  it("while a seed lands there is no line; it comes with the list, and the empty state goes", () => {
    const { rerender } = render(
      withPrecon({ entries: [], cards: new Map(), precon: null, seeding: true }),
    );
    expect(line()).toBeNull();
    expect(screen.getByText("No cards yet")).toBeTruthy();
    rerender(withPrecon());
    expect(line()).not.toBeNull();
    expect(screen.queryByText("No cards yet")).toBeNull();
  });

  it("the ownership line's method: the precon's rule when it is owned; the collection's word for word otherwise", () => {
    const { rerender } = render(
      withPrecon({ precon: { name: "Breed Lethality", owns: true }, ownership }),
    );
    const title = () => screen.getByTestId("ownership-line").getAttribute("title");
    expect(title()).toBe(
      "Cards from the precon you own count as owned, up to the precon's own quantities. Missing cost = cheapest listed printing per card; cards without a price are excluded and counted.",
    );
    rerender(withPrecon({ precon: null, ownership, owned: new Set([sol.id]) }));
    expect(title()).toBe(
      "Owned = any printing of the card is in your imported collection (quantities not checked). Missing cost = cheapest listed printing per card; cards without a price are excluded and counted.",
    );
  });

  it("the ownership line wraps below md and truncates from md: its end is the price", () => {
    render(withPrecon({ precon: { name: "Breed Lethality", owns: true }, ownership }));
    const classes = screen.getByTestId("ownership-line").className.split(" ");
    expect(classes).toContain("md:truncate");
    expect(classes).not.toContain("truncate");
  });
});

describe("DeckListPane — Changed from the precon (PRECON-CHANGES)", () => {
  const sol = toEditorCard({ ...card({ name: "Sol Ring", primaryType: "Artifact" }), image: null });
  const forest = toEditorCard({
    ...card({ name: "Forest", primaryType: "Land", costValue: null }),
    image: null,
  });
  const listed: EditorEntry[] = [
    ...entries,
    { cardId: sol.id, zone: "main", qty: 1, tags: [] },
    { cardId: forest.id, zone: "main", qty: 14, tags: [] },
  ];
  const listedCards = new Map([...cards, [sol.id, sol], [forest.id, forest]]);
  function withChanges(over: Partial<React.ComponentProps<typeof DeckListPane>> = {}) {
    return (
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={listed}
        cards={listedCards}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        extras={false}
        precon={{ name: "Breed Lethality", owns: true }}
        onAnswerPrecon={() => {}}
        preconChanges={{ outQty: 0, inQty: 0 }}
        onSeePreconChanges={() => {}}
        {...over}
      />
    );
  }
  const line = () => document.querySelector<HTMLElement>("[data-slot=precon-changes-line]");

  it("the second line: directly after the precon line and before View / Group / Sort", () => {
    render(withChanges());
    const el = line()!;
    expect(el.tagName).toBe("P");
    expect(el.previousElementSibling?.getAttribute("data-slot")).toBe("precon-line");
    expect(
      within(el.nextElementSibling as HTMLElement).getByRole("group", { name: "View" }),
    ).toBeTruthy();
  });

  it("no changes: the sentence alone, with nothing to press", () => {
    render(withChanges());
    expect(line()!.textContent).toBe("No changes from the precon yet.");
    expect(line()!.dataset.state).toBe("none");
    expect(within(line()!).queryByRole("button")).toBeNull();
  });

  it("changed: the copies out and in, then See changes after a gap, which is the editor's", () => {
    const seen: number[] = [];
    render(
      withChanges({
        preconChanges: { outQty: 25, inQty: 27 },
        onSeePreconChanges: () => seen.push(1),
      }),
    );
    expect(line()!.textContent).toBe("Changed from the precon: 25 out, 27 in. See changes");
    expect(line()!.dataset.state).toBe("changed");
    const see = within(line()!).getByRole("button", { name: "See changes" });
    expect(see.getAttribute("aria-haspopup")).toBe("dialog");
    expect(document.getElementById(see.getAttribute("aria-describedby")!)!.textContent).toBe(
      "Changed from the precon: 25 out, 27 in.",
    );
    // After a gap, underlined, 44 px on touch (U9).
    expect(line()!.className).toContain("gap-x-1.5");
    expect(see.className).toContain("underline");
    expect(see.className).toContain("pointer-coarse:min-h-11");
    fireEvent.click(see);
    expect(seen).toEqual([1]);
  });

  it("the line keeps its box when the first change lands: the control's 44 px on touch either way", () => {
    const { rerender } = render(withChanges());
    const classes = () => line()!.className.split(" ");
    expect(classes()).toContain("pointer-coarse:min-h-11");
    rerender(withChanges({ preconChanges: { outQty: 1, inQty: 1 } }));
    expect(classes()).toContain("pointer-coarse:min-h-11");
    // The words wrap inside their own box beside the control, never under it.
    expect(classes()).toContain("flex");
    expect(line()!.querySelector("span")!.className).toContain("min-w-0");
    expect(within(line()!).getByRole("button").className).toContain("shrink-0");
  });

  it("no lineage, or no changes handed in: no line", () => {
    const { rerender } = render(withChanges({ precon: null }));
    expect(line()).toBeNull();
    rerender(withChanges({ preconChanges: null }));
    expect(line()).toBeNull();
    expect(document.querySelector("[data-slot=precon-line]")).not.toBeNull();
  });

  it("while a seed lands there is no line; it comes with the list and the precon line", () => {
    const { rerender } = render(
      withChanges({
        entries: [],
        cards: new Map(),
        precon: null,
        preconChanges: null,
        seeding: true,
      }),
    );
    expect(line()).toBeNull();
    rerender(withChanges());
    expect(line()!.textContent).toBe("No changes from the precon yet.");
  });

  it("the rows' marks, in both views: beside the owned mark, and none in the Tokens section", () => {
    render(
      withChanges({
        owned: new Set([sol.id]),
        beyondPrecon: new Map([
          [sol.id, 1],
          [forest.id, 2],
        ]),
      }),
    );
    const names = () =>
      [...document.querySelectorAll("[data-slot=precon-mark]")].map((m) =>
        m.getAttribute("aria-label"),
      );
    // Text view: the type groups run Artifact then Land.
    expect(names()).toEqual(["Not in the precon", "2 not in the precon"]);
    const row = screen.getByRole("button", { name: /^Sol Ring/ });
    expect(
      [...row.querySelectorAll("[role=img]")].map((m) => m.getAttribute("aria-label")),
    ).toEqual(["In your collection", "Not in the precon"]);

    fireEvent.click(within(screen.getByRole("group", { name: "View" })).getByText("Grid"));
    expect(names()).toEqual(["Not in the precon", "2 not in the precon"]);
    expect(
      [...document.querySelectorAll("[data-slot=precon-mark]")].map((m) => m.textContent),
    ).toEqual(["Added", "Added"]);
    expect(document.querySelector("[data-slot=tokens-section] [data-slot=precon-mark]")).toBeNull();
  });

  it("no map: no row is marked", () => {
    render(withChanges({ preconChanges: { outQty: 2, inQty: 0 } }));
    expect(document.querySelector("[data-slot=precon-mark]")).toBeNull();
  });
});

describe("DeckListPane — one primary door in the empty state (FRESH-UI-EDITOR)", () => {
  const doors = startDoors(mtg, COMMANDER);
  const PRIMARY = "bg-primary";
  const OUTLINE = "border-(--border-control)";
  const GHOST = "text-muted-foreground";
  function empty(over: Partial<React.ComponentProps<typeof DeckListPane>> = {}) {
    return render(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={[]}
        cards={new Map()}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        onAddCards={() => {}}
        doors={doors}
        onPasteList={() => {}}
        onSurprise={() => {}}
        extras={false}
        {...over}
      />,
    );
  }

  it("no leader: Add cards is the primary, Paste a list, Start from a precon and Surprise me are ghosts", () => {
    empty();
    const add = screen.getByRole("button", { name: "Add cards" });
    expect(add.className).toContain(PRIMARY);
    expect(add.className).not.toContain(OUTLINE);
    for (const name of ["Paste a list", "Surprise me"]) {
      const door = screen.getByRole("button", { name });
      expect(door.className).toContain(GHOST);
      expect(door.className).not.toContain(OUTLINE);
      expect(door.className).not.toContain(PRIMARY);
    }
    const precon = screen.getByRole("link", { name: "Start from a precon" });
    expect(precon.getAttribute("href")).toBe("/precons");
    expect(precon.className).toContain(GHOST);
    expect(precon.className).not.toContain(OUTLINE);
    // One primary in the row, and the Y2b order holds.
    const row = add.parentElement!;
    expect([...row.children].filter((el) => el.className.includes(PRIMARY))).toHaveLength(1);
    expect([...row.children].map((el) => el.textContent)).toEqual([
      "Add cards",
      "Paste a list",
      "Start from a precon",
      "Surprise me",
    ]);
  });

  it("a leader set: the Autofill door is the primary (W9b), Add cards the outline beside it, Paste a list a ghost; still one primary", () => {
    empty({ entries, cards, onAutofill: () => {} });
    const autofill = screen.getByRole("button", { name: "Autofill a starter shell" });
    expect(autofill.className).toContain(PRIMARY);
    const add = screen.getByRole("button", { name: "Add cards" });
    expect(add.className).toContain(OUTLINE);
    expect(add.className).not.toContain(PRIMARY);
    const paste = screen.getByRole("button", { name: "Paste a list" });
    expect(paste.className).toContain(GHOST);
    expect(screen.queryByRole("link", { name: "Start from a precon" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Surprise me" })).toBeNull();
    const row = autofill.parentElement!;
    expect([...row.children].filter((el) => el.className.includes(PRIMARY))).toHaveLength(1);
  });

  it("a leader set and no autofill door (One Piece's shape): Add cards is the primary again", () => {
    empty({ entries, cards });
    expect(screen.getByRole("button", { name: "Add cards" }).className).toContain(PRIMARY);
    expect(screen.getByRole("button", { name: "Paste a list" }).className).toContain(GHOST);
  });
});

describe("DeckListPane — the deck total rolls (ROLLING-NUMBERS)", () => {
  const sol = toEditorCard({
    ...card({ name: "Sol Ring", primaryType: "Artifact" }),
    id: "sol",
    image: null,
  });
  const solCards = new Map([...cards, ["sol", sol]]);
  const props = (qty: number): React.ComponentProps<typeof DeckListPane> => ({
    adapter: mtg,
    format: COMMANDER,
    entries: [...entries, { cardId: "sol", zone: "main", qty, tags: [] }],
    cards: solCards,
    issues: [],
    analytics: [],
    onSetQty: () => undefined,
    onRemove: () => {},
    onPreview: () => {},
    extras: false,
  });
  /** Each rolling number's columns, as `char<from` (moving) or `char` (standing), and its way. */
  const rolls = (root: ParentNode) =>
    Array.from(root.querySelectorAll("[data-slot=rolling-number]"), (n) => ({
      columns: Array.from(n.querySelectorAll<HTMLElement>("[data-c]"), (c) =>
        c.dataset.from === undefined ? c.dataset.c : `${c.dataset.c}<${c.dataset.from}`,
      ),
      dir: n.querySelector("[data-roll]")?.getAttribute("data-roll"),
    }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("an import rolls the count up and its words down, together; the label reads the same throughout", () => {
    const { rerender } = render(<DeckListPane {...props(1)} />);
    const size = document.querySelector<HTMLElement>("[data-slot=deck-size]")!;
    expect(size.innerHTML).toBe(
      '<span class="max-md:text-foreground max-md:font-medium">2 / 100</span> · 98 to go',
    );
    rerender(<DeckListPane {...props(39)} />);
    expect(size.textContent).toBe("40 / 100 · 60 to go");
    expect(rolls(size)).toEqual([
      { columns: ["4<", "0<2"], dir: "up" },
      { columns: ["6<9", "0<8"], dir: "down" },
    ]);
    // The count stays the foreground span the phone reads (U4a).
    expect(size.firstElementChild!.textContent).toBe("40 / 100");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(size.innerHTML).toBe(
      '<span class="max-md:text-foreground max-md:font-medium">40 / 100</span> · 60 to go',
    );
  });

  it("a URL seed's list lands still (a count never animates on page load); the next import rolls", () => {
    const { rerender } = render(<DeckListPane {...props(0)} entries={[]} seeding />);
    const size = document.querySelector<HTMLElement>("[data-slot=deck-size]")!;
    expect(size.textContent).toBe("0 / 100 · 100 to go");
    rerender(<DeckListPane {...props(98)} seeding={false} />);
    expect(rolls(size)).toEqual([]);
    expect(size.textContent).toBe("99 / 100 · 1 to go");
    rerender(<DeckListPane {...props(80)} />);
    expect(rolls(size)).toEqual([
      { columns: ["8<9", "1<9"], dir: "down" },
      { columns: ["1<", "9<1"], dir: "up" },
    ]);
  });

  it("a ±1 edit, and anything within five, lands at once (R3 F10's rule)", () => {
    const { rerender } = render(<DeckListPane {...props(39)} />);
    const size = document.querySelector<HTMLElement>("[data-slot=deck-size]")!;
    rerender(<DeckListPane {...props(40)} />);
    expect(rolls(size)).toEqual([]);
    expect(size.textContent).toBe("41 / 100 · 59 to go");
    rerender(<DeckListPane {...props(45)} />);
    expect(rolls(size)).toEqual([]);
    expect(size.textContent).toBe("46 / 100 · 54 to go");
  });
});

describe("DeckListPane — the Maybe section (MAYBE-LIST)", () => {
  const sol = toEditorCard({ ...card({ name: "Sol Ring", primaryType: "Artifact" }), image: null });
  const bolt = toEditorCard({
    ...card({ name: "Lightning Bolt", primaryType: "Instant", ciMask: 8 }),
    image: null,
  });
  const treasure = toEditorCard({
    ...card({
      name: "Treasure",
      primaryType: "Artifact",
      attrs: { type_line: "Token Artifact — Treasure", oracle_text: "", is_token: true },
    }),
    image: null,
  });
  // A token beside the Maybe card: each section takes its own zone's rows.
  const listed: EditorEntry[] = [
    ...entries,
    { cardId: sol.id, zone: "main", qty: 1, tags: [] },
    { cardId: treasure.id, zone: "tokens", qty: 2, tags: [] },
    { cardId: bolt.id, zone: "maybeboard", qty: 1, tags: [] },
  ];
  const listedCards = new Map([...cards, [sol.id, sol], [bolt.id, bolt], [treasure.id, treasure]]);
  // Bolt carries an issue (it would in the deck): a Maybe row never shows it.
  const boltIssue: ValidationIssue = {
    code: "COLOR_IDENTITY",
    severity: "error",
    message: "Lightning Bolt is outside the commander's color identity",
    cardIds: [bolt.id],
  };
  function maybePane(over: Partial<React.ComponentProps<typeof DeckListPane>> = {}) {
    return render(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={listed}
        cards={listedCards}
        issues={[boltIssue]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        extras={false}
        {...over}
      />,
    );
  }
  const maybe = () => document.querySelector<HTMLElement>("[data-slot=maybe-section]")!;
  const trigger = () => within(maybe()).getByRole("button", { name: /^Maybe\d+$/ });

  it("after Tokens, closed by default with its count; the count and the deck's size ignore it", () => {
    maybePane({ onMoveToDeck: () => undefined });
    const sections = [...document.querySelectorAll("section[data-slot]")].map((s) =>
      s.getAttribute("data-slot"),
    );
    expect(sections.slice(-2)).toEqual(["tokens-section", "maybe-section"]);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().textContent).toBe("Maybe1");
    expect(document.querySelector("[data-slot=deck-size]")?.textContent).toBe("2 / 100 · 98 to go");
    // Not part of the deck's groups: no group lists Bolt.
    expect(screen.queryByRole("button", { name: "Lightning Bolt" })).toBeNull();
  });

  it("opened: the note, the row with Move to deck and Remove from Maybe, and no legality mark even for a card with an issue", () => {
    const onMoveToDeck = vi.fn(() => undefined);
    const onRemove = vi.fn();
    maybePane({ onMoveToDeck, onRemove });
    fireEvent.click(trigger());
    const section = maybe();
    expect(
      within(section).getByText(
        "Cards you’re considering. They don’t count toward the deck and aren’t checked.",
      ),
    ).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Lightning Bolt" })).toBeTruthy();
    expect(within(section).queryByLabelText("Has a problem")).toBeNull();
    fireEvent.click(
      within(section).getByRole("button", { name: "Move Lightning Bolt to the deck" }),
    );
    expect(onMoveToDeck).toHaveBeenCalledWith(bolt.id);
    fireEvent.click(
      within(section).getByRole("button", { name: "Remove Lightning Bolt from Maybe" }),
    );
    expect(onRemove).toHaveBeenCalledWith("maybeboard", bolt.id);
    // An editable row: 44 px on touch like the deck's own rows; the token stays in Tokens.
    expect(within(section).getAllByRole("listitem")[0].className).toContain(
      "pointer-coarse:min-h-11",
    );
    expect(within(section).queryByRole("button", { name: "Treasure" })).toBeNull();
    // No steppers: a Maybe row's count is not edited there.
    expect(within(section).queryByRole("button", { name: "One more Lightning Bolt" })).toBeNull();
  });

  it("at the maximum the row's move is Swap in…; a refused move says why in the section", () => {
    const onMoveToDeck = vi.fn(
      () => "A deck can hold 500 lines at most, Maybe and Tokens included",
    );
    maybePane({ onMoveToDeck, deckFull: true });
    fireEvent.click(trigger());
    const swap = within(maybe()).getByRole("button", { name: "Swap in Lightning Bolt…" });
    // The swap's own icon (the deck rows' Swap…), and its words on hover.
    expect(swap.querySelector("svg.lucide-arrow-left-right")).toBeTruthy();
    expect(swap.getAttribute("title")).toBe("Swap in…");
    fireEvent.click(swap);
    expect(
      within(maybe()).getByText("A deck can hold 500 lines at most, Maybe and Tokens included"),
    ).toBeTruthy();
  });

  it("its open state is kept with the view preferences", () => {
    const view = maybePane({ onMoveToDeck: () => undefined });
    fireEvent.click(trigger());
    expect(JSON.parse(window.localStorage.getItem("deckwarden:deck-view")!).maybeOpen).toBe(true);
    view.unmount();
    maybePane({ onMoveToDeck: () => undefined });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("empty: the section waits for the first card, then opens on its empty line", () => {
    const view = render(
      <DeckListPane
        adapter={mtg}
        format={COMMANDER}
        entries={entries}
        cards={cards}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        extras={false}
        onMoveToDeck={() => undefined}
      />,
    );
    expect(document.querySelector("[data-slot=maybe-section]")).toBeNull();
    view.unmount();
    maybePane({
      entries: listed.filter((e) => e.zone !== "maybeboard"),
      onMoveToDeck: () => undefined,
    });
    fireEvent.click(trigger());
    expect(
      within(maybe()).getByText(
        "Nothing here yet. Search and Suggestions can park a card here with Maybe; it won’t count toward the deck.",
      ),
    ).toBeTruthy();
  });

  it("a deck with Maybe cards and none in the deck: No cards yet, and the hint names Maybe", () => {
    maybePane({
      entries: [...entries, { cardId: bolt.id, zone: "maybeboard", qty: 1, tags: [] }],
      issues: [],
      onMoveToDeck: () => undefined,
    });
    expect(screen.getByText("No cards yet")).toBeTruthy();
    expect(screen.getByText("Add them from Search, or move one in from Maybe.")).toBeTruthy();
    expect(trigger().textContent).toBe("Maybe1");
  });

  it("One Piece declares no Maybe zone: no section, whatever the rows say", () => {
    const op = getAdapter("optcg");
    render(
      <DeckListPane
        adapter={op}
        format={op.formats[0]}
        entries={[{ cardId: sol.id, zone: "main", qty: 1, tags: [] }]}
        cards={new Map([[sol.id, sol]])}
        issues={[]}
        analytics={[]}
        onSetQty={() => undefined}
        onRemove={() => {}}
        onPreview={() => {}}
        extras={false}
        onMoveToDeck={() => undefined}
      />,
    );
    expect(document.querySelector("[data-slot=maybe-section]")).toBeNull();
  });
});
