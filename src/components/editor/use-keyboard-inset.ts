"use client";

import { useEffect } from "react";

/**
 * `--keyboard-inset` on the root (LATER 551): how much of the layout
 * viewport's bottom an on-screen keyboard hides, so the editor's toasts can
 * stand above it. On an iPhone the search box takes focus back after an add
 * (R4's repeated adds), Safari raises the keyboard, and the keyboard used to
 * cover the toast and its Undo: iOS ignores the viewport's
 * `interactive-widget: resizes-content`, keeps the layout viewport, and only
 * shrinks the visual one. Chrome on Android honors it (the layout viewport
 * shrinks with the visual one), so the inset there stays 0 and nothing is
 * counted twice.
 *
 * The inset is the layout viewport's height less the visible part's bottom
 * edge (`visualViewport.offsetTop + height`), 0 while the reader is zoomed
 * in (pinch zoom shrinks the visual viewport too, and a toast that followed
 * it would jump around). Written to the root's style, not React state, so a
 * viewport event re-renders nothing; removed on unmount.
 */
export const KEYBOARD_INSET_VAR = "--keyboard-inset";

export function keyboardInset(
  innerHeight: number,
  viewport: Pick<VisualViewport, "height" | "offsetTop" | "scale">,
): number {
  if (viewport.scale > 1.01) return 0;
  return Math.max(0, Math.round(innerHeight - viewport.offsetTop - viewport.height));
}

export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let last: number | null = null;
    const update = () => {
      const inset = keyboardInset(window.innerHeight, viewport);
      if (inset === last) return;
      last = inset;
      root.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty(KEYBOARD_INSET_VAR);
    };
  }, []);
}
