import { describe, expect, it } from "vitest";

import { parseViewPrefs } from "./view-prefs";

describe("parseViewPrefs", () => {
  it("accepts a fully valid stored preference", () => {
    expect(parseViewPrefs('{"view":"grid","groupBy":"costValue","sortBy":"price"}')).toEqual({
      view: "grid",
      groupBy: "costValue",
      sortBy: "price",
    });
  });

  it("drops unknown values field-by-field", () => {
    expect(parseViewPrefs('{"view":"grid","groupBy":"bogus","sortBy":42}')).toEqual({
      view: "grid",
    });
  });

  it("keeps the Tokens section's open state only as a boolean (DECK-TOKENS)", () => {
    expect(parseViewPrefs('{"view":"text","tokensOpen":true}')).toEqual({
      view: "text",
      tokensOpen: true,
    });
    expect(parseViewPrefs('{"tokensOpen":false}')).toEqual({ tokensOpen: false });
    expect(parseViewPrefs('{"tokensOpen":"yes"}')).toEqual({});
    // MAYBE-LIST: the Maybe section's open state, the same way.
    expect(parseViewPrefs('{"maybeOpen":true,"tokensOpen":false}')).toEqual({
      maybeOpen: true,
      tokensOpen: false,
    });
    expect(parseViewPrefs('{"maybeOpen":1}')).toEqual({});
  });

  it("returns empty prefs for null, junk JSON, and non-objects", () => {
    expect(parseViewPrefs(null)).toEqual({});
    expect(parseViewPrefs("not json")).toEqual({});
    expect(parseViewPrefs('"grid"')).toEqual({});
  });
});
