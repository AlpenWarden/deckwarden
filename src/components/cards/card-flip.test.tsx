import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { flipOf, show, turn, type FlipPicture } from "@/lib/motion/flip";

import { CardFlip } from "./card-flip";

const picture = (shown: FlipPicture) => <span data-picture>{shown.src}</span>;
const part = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-flip="${name}"]`)!;

describe("CardFlip (CARD-FLIP)", () => {
  it("is a box, one turning element and two faces; the caller's class sizes the box and nothing else is classed", () => {
    const { container } = render(
      <CardFlip state={flipOf("front")} className="w-72">
        {picture}
      </CardFlip>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box).toBe(part(container, "box"));
    expect(box.className).toBe("w-72");
    const turning = part(container, "turn");
    expect(turning.parentElement).toBe(box);
    expect([...turning.children]).toEqual([part(container, "near"), part(container, "far")]);
    // No class and no style on the turning element or the faces: nothing a
    // caller passes can flatten the turn.
    for (const el of [turning, part(container, "near"), part(container, "far")]) {
      expect(el.hasAttribute("class")).toBe(false);
      expect(el.hasAttribute("style")).toBe(false);
    }
  });

  it("at rest the near face holds the picture, and the empty far face is out of the accessibility tree", () => {
    const { container } = render(<CardFlip state={flipOf("front")}>{picture}</CardFlip>);
    expect(part(container, "turn").hasAttribute("data-turned")).toBe(false);
    expect(part(container, "near").textContent).toBe("front");
    expect(part(container, "near").hasAttribute("aria-hidden")).toBe(false);
    expect(part(container, "far").childElementCount).toBe(0);
    expect(part(container, "far").getAttribute("aria-hidden")).toBe("true");
  });

  it("turned: the flag is on the turning element, the far face is the one a reader hears, and no picture remounts", () => {
    const start = flipOf("front");
    const { container, rerender } = render(<CardFlip state={start}>{picture}</CardFlip>);
    const front = container.querySelector("[data-picture]");
    const turned = turn(start, "back");
    rerender(<CardFlip state={turned}>{picture}</CardFlip>);
    expect(part(container, "turn").getAttribute("data-turned")).toBe("");
    expect(part(container, "near").getAttribute("aria-hidden")).toBe("true");
    expect(part(container, "far").hasAttribute("aria-hidden")).toBe(false);
    expect(part(container, "far").textContent).toBe("back");
    expect(container.querySelector("[data-picture]")).toBe(front);
    const back = part(container, "far").querySelector("[data-picture]");
    // A turn back moves the flag only.
    rerender(<CardFlip state={turn(turned, "front")}>{picture}</CardFlip>);
    expect(part(container, "turn").hasAttribute("data-turned")).toBe(false);
    expect(part(container, "near").querySelector("[data-picture]")).toBe(front);
    expect(part(container, "far").querySelector("[data-picture]")).toBe(back);
    expect(part(container, "far").getAttribute("aria-hidden")).toBe("true");
  });

  it("a picture shown while turned is drawn in the far face, the one facing the reader", () => {
    const state = show(turn(flipOf("front"), "back"), "other front");
    const { container } = render(<CardFlip state={state}>{picture}</CardFlip>);
    expect(part(container, "turn").getAttribute("data-turned")).toBe("");
    expect(part(container, "far").textContent).toBe("other front");
    expect(part(container, "near").textContent).toBe("front");
  });
});
