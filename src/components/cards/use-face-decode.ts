"use client";

/**
 * A card's other face, decoded on intent (CARD-FLIP, 2026-11-14; shared by
 * the card page's Flip and the editor's since CARD-FLIP-EDITOR). A back is
 * about 100 to 125 KB and costs nothing until it is asked for: no back's
 * address is requested before the reader reaches the control.
 *
 * `prepare(src)` starts a picture's decode once per address: the control
 * calls it on `pointerenter`, `focus` and `touchstart`, so the press finds
 * the picture ready or already on its way. `decode(src)` is what the press
 * awaits; it shares a decode still in flight instead of asking a second
 * time, and resolves false for a picture that cannot load (the turn then
 * shows the caller's fallback box).
 */
import { useCallback, useRef } from "react";

/** Decode off-screen so the swap never paints a half-loaded picture (W5, WAVE2.md D4). */
export async function preloadImage(src: string): Promise<boolean> {
  if (typeof Image === "undefined") return true;
  const img = new Image();
  img.src = src;
  if (typeof img.decode !== "function") return true;
  try {
    await img.decode();
    return true;
  } catch {
    return false;
  }
}

export function useFaceDecode(): {
  decode: (src: string) => Promise<boolean>;
  prepare: (src: string | null) => void;
} {
  // Decodes in flight, by address: a press shares the decode its hover started.
  const decoding = useRef(new Map<string, Promise<boolean>>());
  const decode = useCallback((src: string): Promise<boolean> => {
    const running = decoding.current.get(src);
    if (running) return running;
    const started = preloadImage(src).finally(() => decoding.current.delete(src));
    decoding.current.set(src, started);
    return started;
  }, []);

  // Addresses already asked for on intent: once per picture.
  const prepared = useRef(new Set<string>());
  const prepare = useCallback(
    (src: string | null) => {
      if (!src || prepared.current.has(src)) return;
      prepared.current.add(src);
      void decode(src);
    },
    [decode],
  );

  return { decode, prepare };
}
