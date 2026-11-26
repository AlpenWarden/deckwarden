/**
 * LATER 551: the editor's toasts stand above an iPhone's keyboard. iOS keeps
 * the layout viewport when the keyboard rises and shrinks only the visual
 * one, so the hook writes the hidden band's height to `--keyboard-inset` on
 * the root, and the toast viewport's bottom takes the larger of it and the
 * tab bar's inset. jsdom has no visualViewport: these tests stand one in.
 */
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EDITOR_TOAST_VIEWPORT_CLASS } from "./editor-layout";
import { KEYBOARD_INSET_VAR, keyboardInset, useKeyboardInset } from "./use-keyboard-inset";

class FakeViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
}

function Probe() {
  useKeyboardInset();
  return null;
}

const inset = () => document.documentElement.style.getPropertyValue(KEYBOARD_INSET_VAR);

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR);
});

describe("keyboardInset", () => {
  it("is the layout viewport's height below the visible part's bottom edge", () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0, scale: 1 })).toBe(0);
    // An iPhone 15's keyboard with its bar: 844 → 508 visible.
    expect(keyboardInset(844, { height: 508, offsetTop: 0, scale: 1 })).toBe(336);
    // Safari scrolled the visual viewport down to keep the box in view.
    expect(keyboardInset(844, { height: 508, offsetTop: 40, scale: 1 })).toBe(296);
  });

  it("is 0 while zoomed in, and never negative", () => {
    expect(keyboardInset(844, { height: 300, offsetTop: 100, scale: 2 })).toBe(0);
    expect(keyboardInset(844, { height: 900, offsetTop: 0, scale: 1 })).toBe(0);
  });
});

describe("useKeyboardInset", () => {
  it("writes the inset on the root, follows the viewport's resize and scroll, and removes it on unmount", () => {
    const viewport = new FakeViewport();
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 844);
    const { unmount } = render(<Probe />);
    expect(inset()).toBe("0px");
    viewport.height = 508;
    viewport.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("336px");
    viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event("scroll"));
    expect(inset()).toBe("296px");
    viewport.height = 844;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("0px");
    unmount();
    expect(inset()).toBe("");
    // Unmounted: a later event writes nothing.
    viewport.height = 400;
    viewport.dispatchEvent(new Event("resize"));
    expect(inset()).toBe("");
  });

  it("does nothing where there is no visualViewport", () => {
    vi.stubGlobal("visualViewport", undefined);
    render(<Probe />);
    expect(inset()).toBe("");
  });

  it("the editor's toast viewport stands on the larger of the tab bar's inset and the keyboard's", () => {
    expect(EDITOR_TOAST_VIEWPORT_CLASS).toContain(
      "bottom-[calc(max(var(--editor-bottom-inset),var(--keyboard-inset,0px))_+_1rem)]",
    );
  });
});
