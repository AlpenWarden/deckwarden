/**
 * GameCard (R5a; no box since U5, WAVE5 D6): the section keeps its
 * `aria-label` and `data-game` and takes the page's classes; the blurb; the
 * button row is one default and the rest ghosts, every href byte-identical
 * to R5a's and each label the link's whole content (seo-smoke matches the
 * Surprise me `<a>` exactly). Magic is the gallery form (FRESH-UI-HOME,
 * `headline`): its headline on the fluid step, the shelf before the button
 * row. One Piece is a field of the game accent at 8 % with the serif title
 * (`.type-section`) and the words left and the shelf right from `xl`.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameCard } from "./game-card";

const MAGIC_ACTIONS = {
  build: "/decks/new?game=mtg",
  browse: { href: "/commanders", label: "Browse commanders" },
  search: { href: "/cards", label: "Search cards" },
  surprise: { href: "/decks/new?game=mtg&surprise=1", label: "Surprise me" },
};

const OP_ACTIONS = {
  build: "/decks/new?game=optcg",
  browse: { href: "/leaders", label: "Browse leaders" },
  search: { href: "/cards?game=optcg", label: "Search cards" },
};

/** The row's anchors (Base UI's Button gives a rendered <a> the button role). */
const anchors = (region: HTMLElement) => [...region.querySelectorAll<HTMLAnchorElement>("a[href]")];
const linksOf = (region: HTMLElement) =>
  anchors(region).map((a) => [a.textContent, a.getAttribute("href")]);

describe("GameCard", () => {
  it("the gallery form (FRESH-UI-HOME): the headline on the fluid step, the shelf before the button row, the links unchanged", () => {
    render(
      <GameCard
        className="py-12"
        game="mtg"
        label="Magic: The Gathering · Commander"
        title="Magic: The Gathering"
        headline="Find your next commander."
        blurb="Commander. 100 cards, one legend, every legality rule checked as you build."
        actions={MAGIC_ACTIONS}
      >
        <p>the shelf</p>
      </GameCard>,
    );
    const region = screen.getByRole("region", { name: "Magic: The Gathering · Commander" });
    expect(region.getAttribute("data-game")).toBe("mtg");
    // The box is gone: home's hairline and rhythm come from the page.
    expect(region.className).toBe("min-w-0 py-12");
    expect(region.querySelector("[data-slot=game-field]")).toBeNull();
    expect(within(region).getByText(/^Commander\. 100 cards/).className).toContain(
      "text-muted-foreground",
    );
    const h2 = within(region).getByRole("heading", { level: 2 });
    expect(h2.textContent).toBe("Find your next commander.");
    expect(h2.className).toBe(
      "type-headline text-(--home-heading) max-md:max-w-[11em] text-balance",
    );
    expect(within(region).queryByText("Magic: The Gathering")).toBeNull();
    // The shelf comes right after the words; the doors wait under the cards.
    const shelf = within(region).getByText("the shelf");
    const build = anchors(region)[0];
    expect(shelf.compareDocumentPosition(build) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(linksOf(region)).toEqual([
      ["Build a deck", "/decks/new?game=mtg"],
      ["Browse commanders", "/commanders"],
      ["Search cards", "/cards"],
      ["Surprise me", "/decks/new?game=mtg&surprise=1"],
    ]);
    // One default and three ghosts.
    const rest = anchors(region).slice(1);
    expect(build.className).toContain("bg-primary");
    for (const ghost of rest) {
      expect(ghost.className).toContain("hover:bg-muted");
      expect(ghost.className).not.toContain("bg-primary");
      // No outline left (R5a's Browse was outline; D6 says three ghosts).
      expect(ghost.className).not.toContain("border-(--border-control)");
    }
    // seo-smoke: the Surprise me <a>'s inner HTML is exactly its label.
    expect(rest[2].innerHTML).toBe("Surprise me");
  });

  it("One Piece: the accent field, words and buttons left from xl, shelf and footer right", () => {
    render(
      <GameCard
        game="optcg"
        label="One Piece Card Game"
        title="One Piece Card Game"
        blurb="50-card leader decks validated against Bandai's banlist as you type."
        actions={OP_ACTIONS}
        footer={<p>the posture line</p>}
      >
        <p>the shelf</p>
      </GameCard>,
    );
    const region = screen.getByRole("region", { name: "One Piece Card Game" });
    expect(region.getAttribute("data-game")).toBe("optcg");
    const field = region.querySelector("[data-slot=game-field]") as HTMLElement;
    expect(field.className).toContain(
      "bg-[color-mix(in_oklab,var(--accent-game)_8%,var(--background))]",
    );
    expect(field.className).toContain("xl:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]");
    const [words, shelf] = [...field.children] as HTMLElement[];
    const h2 = within(words).getByRole("heading", { level: 2 });
    expect(h2.textContent).toBe("One Piece Card Game");
    expect(h2.className).toBe("type-section");
    expect(linksOf(words)).toEqual([
      ["Build a deck", "/decks/new?game=optcg"],
      ["Browse leaders", "/leaders"],
      ["Search cards", "/cards?game=optcg"],
    ]);
    expect(within(shelf).getByText("the shelf")).toBeTruthy();
    expect(within(shelf).getByText("the posture line")).toBeTruthy();
    // No Surprise door on One Piece (W9c names the Magic region only).
    expect(within(region).queryByText("Surprise me")).toBeNull();
  });
});
