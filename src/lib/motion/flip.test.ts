/**
 * CARD-FLIP (2026-11-14): the state (two slots and a flag) and the
 * stylesheet's half (the back-to-back construction). The browser's half
 * (the frozen frames of the turn, the facing image under the pointer, the
 * requests, real Safari) is read on a local production build and recorded
 * in REDESIGN.md's CARD-FLIP addendum; tokens.test.ts pins the transition's
 * duration, curve and media query.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { facing, flipOf, show, turn } from "./flip";

const FRONT = "https://cards.scryfall.io/normal/front/a/a/a.jpg";
const BACK = "https://cards.scryfall.io/normal/back/a/a/a.jpg";
const OTHER_FRONT = "https://cards.scryfall.io/normal/front/b/b/b.jpg";
const OTHER_BACK = "https://cards.scryfall.io/normal/back/b/b/b.jpg";

const whole = (src: string | null) => ({ src, under: null, fade: false });

describe("the flip's state", () => {
  it("starts with the first picture whole in the near slot and nothing behind it", () => {
    const start = flipOf(FRONT);
    expect(start).toEqual({ near: whole(FRONT), far: null, turned: false });
    expect(facing(start)).toBe(start.near);
    // No picture at all is the fallback box, in the same slot.
    expect(flipOf(null)).toEqual({ near: whole(null), far: null, turned: false });
  });

  it("a turn puts the picture whole in the hidden slot and flips the flag", () => {
    const start = flipOf(FRONT);
    const turned = turn(start, BACK);
    expect(turned).toEqual({ near: whole(FRONT), far: whole(BACK), turned: true });
    // The slot that was facing is the same object: nothing about it redraws.
    expect(turned.near).toBe(start.near);
    expect(facing(turned)).toBe(turned.far);
  });

  it("a turn and a turn back reuse both slots", () => {
    const start = flipOf(FRONT);
    const turned = turn(start, BACK);
    const back = turn(turned, FRONT);
    expect(back.turned).toBe(false);
    expect(back.near).toBe(start.near);
    expect(back.far).toBe(turned.far);
    const again = turn(back, BACK);
    expect(again.turned).toBe(true);
    expect(again.near).toBe(start.near);
    expect(again.far).toBe(turned.far);
  });

  it("a second turn asked mid-turn only flips the flag back: the hidden slot already holds the picture", () => {
    // The state has no clock, so "mid-turn" is the state right after the
    // first turn: the second press asks for the front, which is still in the
    // near slot, and nothing but the flag changes.
    const turned = turn(flipOf(FRONT), BACK);
    const reversed = turn(turned, FRONT);
    expect(reversed).toEqual({ ...turned, turned: false });
    expect(reversed.near).toBe(turned.near);
    expect(reversed.far).toBe(turned.far);
  });

  it("a printing change shows in the slot facing the reader, over the picture it replaces", () => {
    const start = flipOf(FRONT);
    const shown = show(start, OTHER_FRONT);
    expect(shown).toEqual({
      near: { src: OTHER_FRONT, under: FRONT, fade: true },
      far: null,
      turned: false,
    });
  });

  it("a printing change while turned leaves the flag alone: slots are not faces", () => {
    const turned = turn(flipOf(FRONT), BACK);
    const changed = show(turned, OTHER_FRONT);
    expect(changed.turned).toBe(true);
    // The new front fades in over the old back, in the far slot.
    expect(changed.far).toEqual({ src: OTHER_FRONT, under: BACK, fade: true });
    expect(changed.near).toBe(turned.near);
    expect(facing(changed)).toBe(changed.far);
    // The next turn replaces the hidden slot's stale front with the new back, whole.
    const next = turn(changed, OTHER_BACK);
    expect(next).toEqual({ near: whole(OTHER_BACK), far: changed.far, turned: false });
  });

  it("a picture that already faces the reader is left as it is", () => {
    const start = flipOf(FRONT);
    expect(show(start, FRONT)).toBe(start);
    const turned = turn(start, BACK);
    expect(show(turned, BACK)).toBe(turned);
  });

  it("a picture that failed to decode is a null address: it turns and shows like any other", () => {
    const failed = turn(flipOf(FRONT), null);
    expect(failed).toEqual({ near: whole(FRONT), far: whole(null), turned: true });
    // Turning back keeps the fallback where it is; a later try replaces it.
    const back = turn(failed, FRONT);
    expect(back.far).toBe(failed.far);
    expect(turn(back, BACK).far).toEqual(whole(BACK));
    // Two failures in a row in the facing slot: the fallback stays put.
    const blank = show(flipOf(FRONT), null);
    expect(blank.near).toEqual({ src: null, under: FRONT, fade: true });
    expect(show(blank, null)).toBe(blank);
  });
});

describe("the stylesheet's half (globals.css)", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const layer =
    [...code.matchAll(/@layer components \{([\s\S]*?)\n\}/g)].find((m) =>
      m[1].includes('[data-flip="box"]'),
    )?.[1] ?? "";
  /** The rule a selector has to itself (not a line of a selector list). */
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return layer.match(new RegExp(`(?<!,)\\n  ${escaped} \\{([^}]*)\\}`))?.[1] ?? "";
  };
  const declarations = (body: string) =>
    [...body.matchAll(/([a-z-]+):\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()}`);

  it("the box brings the perspective and nothing else", () => {
    const box = declarations(rule('[data-flip="box"]'));
    expect(box).toHaveLength(1);
    expect(box[0]).toMatch(/^perspective: \d+px$/);
  });

  it("one element turns, half way round, keeping its children in 3D; on its own it transitions nothing", () => {
    // `transition: none` is what reduced motion is left with: the backstop's
    // 0.01 ms on the default `all` would otherwise still start a transition.
    expect(declarations(rule('[data-flip="turn"]'))).toEqual([
      "position: relative",
      "transform-style: preserve-3d",
      "transition: none",
    ]);
    expect(declarations(rule('[data-flip="turn"][data-turned]'))).toEqual([
      "transform: rotateY(180deg)",
    ]);
  });

  it("two faces back to back: each hides its back, the near one in flow, the far one over it half a turn round", () => {
    expect(layer).toMatch(
      /\[data-flip="near"\],\s*\[data-flip="far"\] \{\s*backface-visibility: hidden;\s*\}/,
    );
    expect(declarations(rule('[data-flip="near"]'))).toEqual(["position: relative"]);
    expect(declarations(rule('[data-flip="far"]'))).toEqual([
      "position: absolute",
      "inset: 0",
      "transform: rotateY(180deg)",
    ]);
  });

  it("nothing in the recipe flattens the turn", () => {
    // Any of these on the turning element or a face draws the faces in one
    // plane: the front shows mirrored where the back should be.
    expect(layer).not.toMatch(
      /(?:^|[\s;{])(?:opacity|overflow[a-z-]*|filter|backdrop-filter|mask[a-z-]*|clip|clip-path|isolation|mix-blend-mode|contain|will-change):/,
    );
  });
});
