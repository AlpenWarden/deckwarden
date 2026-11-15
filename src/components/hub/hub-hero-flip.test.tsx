/**
 * HubHeroFlip (CARD-FLIP-HUB, 2026-11-15): the commander hub's hero for a
 * default printing with a back. jsdom has no layout and no 3D, so this pins
 * the state and the attributes: the server's markup (the front `priority` in
 * the near face, nothing about the back), the decode on intent and never
 * before it, the turn's slots, flag, pressed state and hidden face, the turn
 * back that moves the flag alone, presses that coalesce while the back
 * decodes, a back that cannot load, and the tilt landing on the box. The
 * browser's half (the frozen frames, the tilt's matrices and the shadow's
 * pixels on both slots, the morph) is read in headless Chrome and recorded
 * in REDESIGN.md's CARD-FLIP-HUB addendum; the boundary itself is pinned in
 * source by view-transitions.test.ts, since React renders no DOM for it.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TiltSurface } from "@/components/cards/tilt-surface";
import { HERO_CARD_SHADOW } from "@/components/surface-header";

import { HubHeroFlip } from "./hub-hero-flip";

const ID = "3e97c609-3932-4428-96d4-1c97e61f0abb";
const FRONT = `https://cards.scryfall.io/normal/front/3/e/${ID}.jpg`;
const BACK = `https://cards.scryfall.io/normal/back/3/e/${ID}.jpg`;
const NAME = "Etali, Primal Conqueror // Etali, Primal Sickness";

const hero = (
  <HubHeroFlip
    name="hub-card-etali-primal-conqueror"
    printing={{ id: ID, imageOverride: null }}
    alt={NAME}
  />
);

/** Every address asked to decode off screen, in order; `fails` makes an address reject. */
function stubDecodes(fails: (src: string) => boolean = () => false) {
  const asked: string[] = [];
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        asked.push(this.src);
        return fails(this.src) ? Promise.reject(new Error("decode failed")) : Promise.resolve();
      }
    },
  );
  return asked;
}

const part = (name: string) => document.querySelector<HTMLElement>(`[data-flip="${name}"]`)!;
const image = (slot: "near" | "far") => part(slot).querySelector("img");
const flipButton = () => screen.getByRole("button", { name: /Flip/ });
const settle = () => act(async () => {});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HubHeroFlip (CARD-FLIP-HUB)", () => {
  it("the server's markup: the front `priority` in the near face of the box, an empty far face, Flip unpressed, and nothing about the back", () => {
    const html = renderToString(hero);
    // React's preload hint for the one high-priority image leads, as it does
    // for the plain hero. Then the box, sized like the card and carrying the
    // tilt's 120 ms transform transition, one turning element and two faces,
    // none of them classed.
    expect(html).toMatch(
      new RegExp(
        `^<link rel="preload" as="image" href="${FRONT}" fetchPriority="high"/>` +
          '<div data-flip="box" class="w-72 motion-safe:\\[transition:transform_120ms_var\\(--ease-settle-120\\)\\]"[^>]*>' +
          '<div data-flip="turn"><div data-flip="near"><img ',
      ),
    );
    expect(html.match(/<link /g)).toHaveLength(1);
    expect(html).toContain('<div data-flip="far" aria-hidden="true"></div>');
    // The hub hero's image, attribute for attribute: eager, high priority, no load fade.
    const img = html.match(/<img [^>]*>/g) ?? [];
    expect(img).toHaveLength(1);
    expect(img[0]).toContain(`src="${FRONT}"`);
    expect(img[0]).toContain(`alt="${NAME}"`);
    expect(img[0]).toContain('width="488" height="680" loading="eager" decoding="auto"');
    expect(img[0]).toMatch(/fetchPriority="high"/i);
    expect(img[0]).toContain(`w-72 rounded-2xl ${HERO_CARD_SHADOW}"`);
    expect(img[0]).not.toContain("opacity-0");
    expect(html).toMatch(/<button [^>]*aria-pressed="false"[^>]*>.*Flip<\/button>/);
    expect(html).not.toContain("/back/");
    expect(html).not.toContain("data-turned");
  });

  it("asks for the back when the pointer, focus or a touch reaches Flip, once, and never before; nothing on screen changes", async () => {
    const asked = stubDecodes();
    render(hero);
    const front = image("near");
    expect(asked).toEqual([]);
    fireEvent.pointerEnter(flipButton());
    expect(asked).toEqual([BACK]);
    fireEvent.focus(flipButton());
    fireEvent.touchStart(flipButton());
    await settle();
    expect(asked).toEqual([BACK]);
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(part("far").childElementCount).toBe(0);
    expect(image("near")).toBe(front);
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
  });

  it("a press turns: the back whole in the far slot, the flag, the pressed state and the hidden face; the front stays the element it was", async () => {
    const asked = stubDecodes();
    render(hero);
    const front = image("near");
    fireEvent.pointerEnter(flipButton());
    fireEvent.click(flipButton());
    await settle();
    // The press shared the decode the pointer started.
    expect(asked).toEqual([BACK]);
    expect(part("turn").getAttribute("data-turned")).toBe("");
    const back = image("far")!;
    expect(back.getAttribute("src")).toBe(BACK);
    expect(back.getAttribute("alt")).toBe(NAME);
    // Whole as it comes round: `priority`, so no load fade, and the hero's class.
    expect(back.getAttribute("loading")).toBe("eager");
    expect(back.getAttribute("fetchpriority")).toBe("high");
    expect(back.className).not.toMatch(/opacity-0|animate-dw-in/);
    expect(back.className).toContain(`w-72 rounded-2xl ${HERO_CARD_SHADOW}`);
    expect(image("near")).toBe(front);
    expect(front!.getAttribute("fetchpriority")).toBe("high");
    expect(part("near").getAttribute("aria-hidden")).toBe("true");
    expect(part("far").hasAttribute("aria-hidden")).toBe(false);
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("a turn back moves the flag alone: both images stay and nothing is decoded; the next turn finds the back in its slot", async () => {
    const asked = stubDecodes();
    render(hero);
    const front = image("near");
    fireEvent.click(flipButton());
    await settle();
    const back = image("far");
    fireEvent.click(flipButton());
    // No decode to wait for: the flag is back in the same task.
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
    expect(part("far").getAttribute("aria-hidden")).toBe("true");
    expect(part("near").hasAttribute("aria-hidden")).toBe(false);
    fireEvent.click(flipButton());
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect([image("near"), image("far")]).toEqual([front, back]);
    expect(asked).toEqual([BACK]);
  });

  it("presses while the back is still decoding are one turn", async () => {
    let finish = () => {};
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode() {
          return new Promise<void>((resolve) => {
            finish = resolve;
          });
        }
      },
    );
    render(hero);
    fireEvent.click(flipButton());
    fireEvent.click(flipButton());
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    await act(async () => finish());
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
    expect(image("far")!.getAttribute("src")).toBe(BACK);
  });

  it("a back that cannot load turns to the fallback box, and the next turn to it asks again", async () => {
    let failing = true;
    const asked = stubDecodes(() => failing);
    render(hero);
    fireEvent.click(flipButton());
    await settle();
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(image("far")).toBeNull();
    expect(part("far").textContent).toBe("No image");
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
    // Back to the front, which never left its slot.
    fireEvent.click(flipButton());
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(image("near")!.getAttribute("src")).toBe(FRONT);
    failing = false;
    fireEvent.click(flipButton());
    await settle();
    expect(asked).toEqual([BACK, BACK]);
    expect(image("far")!.getAttribute("src")).toBe(BACK);
    expect(part("turn").getAttribute("data-turned")).toBe("");
  });

  it("a printing whose back has no address still turns, to the fallback box, and asks for nothing", async () => {
    const asked = stubDecodes();
    render(
      <HubHeroFlip
        name="hub-card-x"
        printing={{ id: ID, imageOverride: { front: FRONT, back: "https://example.com/back.jpg" } }}
        alt={NAME}
      />,
    );
    fireEvent.pointerEnter(flipButton());
    fireEvent.click(flipButton());
    await settle();
    expect(asked).toEqual([]);
    expect(part("far").textContent).toBe("No image");
  });

  it("in the tilt surface the box is the card: the tilt lands on it and on no image, and Flip is in the surface and outside the box", () => {
    vi.stubGlobal("matchMedia", (query: string) =>
      Object.assign(new EventTarget(), { matches: query === "(pointer: fine)" }),
    );
    const { container } = render(
      <TiltSurface maxDeg={6} className="relative -mt-24 shrink-0 md:-mt-28">
        {hero}
      </TiltSurface>,
    );
    const surface = container.firstElementChild as HTMLElement;
    const box = part("box");
    expect(surface.firstElementChild).toBe(box);
    expect(box.hasAttribute("data-tilt")).toBe(true);
    expect(container.querySelectorAll("[data-tilt]")).toHaveLength(1);
    expect(surface.contains(flipButton())).toBe(true);
    expect(box.contains(flipButton())).toBe(false);
    expect(box.className).toBe(
      "w-72 motion-safe:[transition:transform_120ms_var(--ease-settle-120)]",
    );
    // The surface is the box's offset parent and taller than it: Flip's row is under the card.
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 288, height: 453 }),
    );
    Object.defineProperties(box, {
      offsetParent: { get: () => surface },
      offsetLeft: { get: () => 0 },
      offsetTop: { get: () => 0 },
      offsetWidth: { get: () => 288 },
      offsetHeight: { get: () => 401 },
    });
    fireEvent.pointerMove(surface, { clientX: 288, clientY: 401 });
    expect(box.getAttribute("style")).toBe(
      "--tilt-x: -6deg; --tilt-y: 6deg; --tilt-dx: -4px; --tilt-dy: -4px;",
    );
    // The turning element and the faces stay unstyled: the tilt is the box's alone.
    for (const name of ["turn", "near", "far"])
      expect(part(name).hasAttribute("style")).toBe(false);
    // On its way to Flip the pointer has left the card: the tilt rests, so the turn starts square.
    fireEvent.pointerMove(surface, { clientX: 30, clientY: 439 });
    expect(box.style.length).toBe(0);
  });
});
