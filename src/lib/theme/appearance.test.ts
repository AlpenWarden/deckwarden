/**
 * The appearance store (R2): validation field by field (a corrupt or
 * foreign value is On), what a save stores under `deckwarden:appearance`
 * and how it reads back, and the hook — a client snapshot that follows
 * same-tab saves and the cross-tab `storage` event.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APPEARANCE_KEY, parseAppearance, saveAppearance, useAppearance } from "./appearance";

/** The stored value as the store reads it. */
const stored = () => parseAppearance(window.localStorage.getItem(APPEARANCE_KEY));

afterEach(() => {
  window.localStorage.clear();
});

describe("parseAppearance", () => {
  it("defaults to Background art On for nothing, junk, wrong types and non-objects", () => {
    expect(parseAppearance(null)).toEqual({ backgroundArt: true });
    expect(parseAppearance("")).toEqual({ backgroundArt: true });
    expect(parseAppearance("nope")).toEqual({ backgroundArt: true });
    expect(parseAppearance("42")).toEqual({ backgroundArt: true });
    expect(parseAppearance('{"backgroundArt":"off"}')).toEqual({ backgroundArt: true });
    expect(parseAppearance('{"other":1}')).toEqual({ backgroundArt: true });
  });

  it("reads a stored Off", () => {
    expect(parseAppearance('{"backgroundArt":false}')).toEqual({ backgroundArt: false });
  });
});

describe("saveAppearance", () => {
  it("round-trips under the key", () => {
    expect(stored()).toEqual({ backgroundArt: true });
    saveAppearance({ backgroundArt: false });
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe('{"backgroundArt":false}');
    expect(stored()).toEqual({ backgroundArt: false });
  });
});

describe("useAppearance", () => {
  it("reads the stored value, follows saves in the same tab and storage events from others", () => {
    window.localStorage.setItem(APPEARANCE_KEY, '{"backgroundArt":false}');
    const { result } = renderHook(() => useAppearance());
    expect(result.current).toEqual({ backgroundArt: false });

    act(() => saveAppearance({ backgroundArt: true }));
    expect(result.current).toEqual({ backgroundArt: true });

    act(() => {
      window.localStorage.setItem(APPEARANCE_KEY, '{"backgroundArt":false}');
      window.dispatchEvent(new StorageEvent("storage", { key: APPEARANCE_KEY }));
    });
    expect(result.current).toEqual({ backgroundArt: false });
  });

  it("a corrupt stored value reads as On", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "{not json");
    const { result } = renderHook(() => useAppearance());
    expect(result.current).toEqual({ backgroundArt: true });
  });
});
