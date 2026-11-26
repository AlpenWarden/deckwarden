/**
 * DeckGridView (R6, status never color-only): a card's validation ring is
 * accompanied by sr-only severity text described onto the card button —
 * "Has a problem" / "Warning", the text view's words — while the button's
 * name stays "Show {name}"; a clean card has no description.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EditorCard, EditorEntry } from "@/lib/decks/editor-state";
import { COMMANDER } from "@/lib/games/mtg/formats";
import { card } from "@/lib/games/mtg/test-fixtures";
import type { DeckGroup } from "@/lib/decks/view-model";
import { DeckGridView } from "./deck-grid-view";

const mainZone = COMMANDER.zones.find((z) => !z.isLeaderZone)!.id;
const solRing: EditorCard = { ...card({ name: "Sol Ring", primaryType: "Artifact" }), image: null };
const bolt: EditorCard = {
  ...card({ name: "Lightning Bolt", primaryType: "Instant", costValue: 1 }),
  image: null,
};
const flash: EditorCard = { ...card({ name: "Flash", primaryType: "Instant" }), image: null };

function entry(c: EditorCard): EditorEntry {
  return { cardId: c.id, zone: mainZone, qty: 1, tags: [] };
}

const groups: DeckGroup<EditorEntry, EditorCard>[] = [
  {
    key: "all",
    label: "Cards",
    qty: 3,
    items: [solRing, bolt, flash].map((c) => ({ entry: entry(c), card: c })),
  },
];

describe("DeckGridView — severity as text", () => {
  it("describes problem and warning cards, leaves the clean one undescribed, keeps the names", () => {
    render(
      <DeckGridView
        groups={groups}
        severity={
          new Map([
            [bolt.id, "error" as const],
            [flash.id, "warning" as const],
          ])
        }
        onPreview={() => {}}
      />,
    );
    const clean = screen.getByRole("button", { name: "Show Sol Ring" });
    expect(clean.hasAttribute("aria-describedby")).toBe(false);
    expect(clean.className).not.toContain("ring-2");

    const problem = screen.getByRole("button", { name: "Show Lightning Bolt" });
    expect(problem.className).toContain("ring-destructive");
    expect(document.getElementById(problem.getAttribute("aria-describedby")!)!.textContent).toBe(
      "Has a problem",
    );

    const warning = screen.getByRole("button", { name: "Show Flash" });
    expect(warning.className).toContain("ring-amber-500");
    const desc = document.getElementById(warning.getAttribute("aria-describedby")!)!;
    expect(desc.textContent).toBe("Warning");
    expect(desc.className).toContain("sr-only");
    expect(document.querySelectorAll("[data-slot=severity]")).toHaveLength(2);
  });
});

describe("DeckGridView — the group heading (U3a)", () => {
  it("the text view's heading — label and count on space, sticky when asked; the share page's the same, unstuck (U6)", () => {
    const { container, unmount } = render(
      <DeckGridView groups={groups} severity={new Map()} onPreview={() => {}} stickyHeaders />,
    );
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.className).toContain("pt-5 pb-1.5");
    expect(heading.className).toContain("sticky top-0");
    expect(heading.querySelector("[data-slot=group-count]")?.textContent).toBe("3");
    expect(container.querySelector("section")?.className ?? "").not.toContain("mt-4");
    unmount();
    const share = render(
      <DeckGridView groups={groups} severity={new Map()} onPreview={() => {}} />,
    );
    const shared = screen.getByRole("heading", { level: 3 });
    expect(shared.className).toContain("pt-5 pb-1.5");
    expect(shared.className).not.toContain("border-b");
    expect(shared.className).not.toContain("sticky");
    expect(share.container.querySelector("section")?.hasAttribute("class")).toBe(false);
  });
});

describe("DeckGridView — the precon badge (PRECON-CHANGES)", () => {
  const badge = (name: string) =>
    screen
      .getByRole("button", { name: `Show ${name}` })
      .closest("li")!
      .querySelector<HTMLElement>("[data-slot=precon-mark]");

  it("a card the precon did not hold: a circled plus and Added, named Not in the precon, in the top-left corner", () => {
    render(
      <DeckGridView
        groups={groups}
        severity={new Map()}
        onPreview={() => {}}
        beyondPrecon={new Map([[bolt.id, 1]])}
      />,
    );
    const el = badge("Lightning Bolt")!;
    expect(el.textContent).toBe("Added");
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe("Not in the precon");
    expect(el.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    const classes = el.className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["absolute", "left-1", "top-1"]));
    expect(badge("Sol Ring")).toBeNull();
    // The button keeps its name.
    expect(screen.getByRole("button", { name: "Show Lightning Bolt" })).toBeTruthy();
  });

  it("under the owned badge when the card has one, which stays where it was", () => {
    render(
      <DeckGridView
        groups={groups}
        severity={new Map()}
        onPreview={() => {}}
        owned={new Set([bolt.id])}
        beyondPrecon={new Map([[bolt.id, 1]])}
      />,
    );
    const el = badge("Lightning Bolt")!;
    expect(el.className.split(" ")).toContain("top-7");
    const owned = screen.getByLabelText("In your collection");
    expect(owned.textContent).toBe("✓ Owned");
    expect(owned.parentElement!.className).toContain("top-1 left-1");
    expect(owned.parentElement!.contains(el)).toBe(false);
  });

  it("no map, no badge", () => {
    const { container } = render(
      <DeckGridView groups={groups} severity={new Map()} onPreview={() => {}} />,
    );
    expect(container.querySelector("[data-slot=precon-mark]")).toBeNull();
  });
});

describe("DeckGridView — a tile's footer and its count's name (MAYBE-LIST amended)", () => {
  it("tileFooter renders under each tile's image, in the tile's flow; countLabel names the ×N badge", () => {
    render(
      <DeckGridView
        groups={groups}
        severity={new Map()}
        onPreview={() => {}}
        countLabel={(qty) => `${qty} in Maybe`}
        tileFooter={(e, c) => (
          <div data-slot="footer" data-card={c.id} data-zone={e.zone}>
            {c.name}
          </div>
        )}
      />,
    );
    const footers = [...document.querySelectorAll<HTMLElement>("[data-slot=footer]")];
    expect(footers.map((f) => f.dataset.card)).toEqual([solRing.id, bolt.id, flash.id]);
    expect(footers.every((f) => f.dataset.zone === mainZone)).toBe(true);
    for (const footer of footers) {
      const tile = footer.closest("li")!;
      const image = tile.querySelector("button")!;
      expect(image.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // The tile's last child: after the badges, which sit over the image's top corners.
      expect(tile.lastElementChild).toBe(footer);
    }
    expect(screen.getAllByLabelText("1 in Maybe")).toHaveLength(3);
  });

  it("without them: no footer, and the badge says in deck", () => {
    render(<DeckGridView groups={groups} severity={new Map()} onPreview={() => {}} />);
    expect(document.querySelector("[data-slot=footer]")).toBeNull();
    expect(screen.getAllByLabelText("1 in deck")).toHaveLength(3);
    for (const tile of document.querySelectorAll("li")) {
      expect(tile.lastElementChild?.tagName).not.toBe("DIV");
    }
  });
});
