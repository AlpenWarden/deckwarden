/**
 * The commander index's color filter (COLOR-INCLUDES): `colors` reads as it
 * did before the mode, checked against the page's own code from before it
 * (kept here as the reference); `match` is including or it is exactly;
 * Colorless is always exact; every link's query string, with the exact
 * ones the bytes the page built before; the chips' toggling, and the one
 * toggle chip's link to the other reading; the line under the filters and
 * the empty sentence; and the copy guard (the PRECON_COPY guard's pattern)
 * over every string the table can produce.
 */
import { describe, expect, it } from "vitest";

import { COLOR_ORDER, lettersToMask, maskToLetters } from "@/lib/games/colors";
import {
  appliedMatch,
  COLOR_FILTER_COPY,
  COLOR_MATCHES,
  colorFilterEmpty,
  colorFilterLetters,
  colorFilterNote,
  colorFilterQuery,
  MATCH_PARAM,
  otherMatch,
  parseColorFilter,
  toggleColorLetter,
  type ColorFilter,
} from "./color-filter";

// --- The page before the mode (`948ceb3`), as the reference -------------------------------

/** `/commanders`' reading of `?colors=`: the mask and the active letters. */
function oldRead(rawColors: string): { ciMask: number | null; activeLetters: string } {
  const wantsColorless = /c/i.test(rawColors);
  const colorMask = lettersToMask(rawColors.replace(/c/gi, ""));
  const ciMask = wantsColorless && colorMask === 0 ? 0 : colorMask > 0 ? colorMask : null;
  const activeLetters = ciMask === null ? "" : ciMask === 0 ? "C" : maskToLetters(ciMask).join("");
  return { ciMask, activeLetters };
}

/** `/commanders`' `filterHref`. */
function oldFilterHref(letters: string, page = 1, q = ""): string {
  const params = new URLSearchParams();
  if (letters) params.set("colors", letters.toLowerCase());
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/commanders?${qs}` : "/commanders";
}

/** A color chip's next letters, as the page computed them inline. */
function oldToggle(activeLetters: string, c: string): string {
  return c === "C"
    ? activeLetters === "C"
      ? ""
      : "C"
    : activeLetters.includes(c)
      ? activeLetters.replace(c, "").replace("C", "")
      : activeLetters.replace("C", "") + c;
}

/** Every selection the page can hold: none, Colorless, and the 31 color sets. */
const SELECTIONS: string[] = [
  "",
  "C",
  ...Array.from({ length: 31 }, (_, i) => maskToLetters(i + 1).join("")),
];

const NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};
const namesOf = (mask: number) => maskToLetters(mask).map((l) => NAMES[l]);

describe("parseColorFilter — `colors` reads as before", () => {
  it("agrees with the page's old reading on every spelling: case, order, noise, a c beside colors", () => {
    const spellings = [
      "",
      "w",
      "W",
      "wu",
      "uw",
      "UW",
      "wubrg",
      "grbuw",
      "c",
      "C",
      "cc",
      "cw",
      "wc",
      "x",
      "xyz",
      "w,u b",
      "w-u",
      "wwww",
      "1",
      " ",
      ...SELECTIONS.map((s) => s.toLowerCase()),
    ];
    for (const raw of spellings) {
      const filter = parseColorFilter(raw, undefined);
      const old = oldRead(raw);
      expect([raw, filter.mask]).toEqual([raw, old.ciMask]);
      expect([raw, colorFilterLetters(filter)]).toEqual([raw, old.activeLetters]);
    }
  });

  it("names the three cases: no color, Colorless, a color set", () => {
    expect(parseColorFilter(undefined, undefined)).toEqual({ mask: null, match: "exactly" });
    expect(parseColorFilter("c", undefined)).toEqual({ mask: 0, match: "exactly" });
    expect(parseColorFilter("bg", undefined)).toEqual({ mask: 4 | 16, match: "exactly" });
    // A color beside a "c" wins, as it always has.
    expect(parseColorFilter("cb", undefined).mask).toBe(4);
  });

  it("a repeated key (an array) or a non-string is no filter and no mode", () => {
    expect(parseColorFilter(["w", "u"], ["including"])).toEqual({ mask: null, match: "exactly" });
    expect(parseColorFilter(7, true)).toEqual({ mask: null, match: "exactly" });
  });
});

describe("parseColorFilter — `match`", () => {
  it("is including for that word in any case, with stray spaces", () => {
    for (const value of ["including", "Including", "INCLUDING", " including "]) {
      expect([value, parseColorFilter("b", value).match]).toEqual([value, "including"]);
    }
  });

  it("is exactly when absent and for any other value, the card search's other words included", () => {
    for (const value of [undefined, "", "exactly", "exact", "within", "include", "1", "true"]) {
      expect([value, parseColorFilter("b", value).match]).toEqual([value, "exactly"]);
    }
  });

  it("is kept with no color picked and with Colorless: the links carry the reader's choice", () => {
    expect(parseColorFilter(undefined, "including")).toEqual({ mask: null, match: "including" });
    expect(parseColorFilter("c", "including")).toEqual({ mask: 0, match: "including" });
  });
});

describe("appliedMatch — what the query runs", () => {
  it("is including only with a color to include", () => {
    for (let mask = 1; mask <= 31; mask++) {
      expect(appliedMatch({ mask, match: "including" })).toBe("including");
      expect(appliedMatch({ mask, match: "exactly" })).toBe("exactly");
    }
  });

  it("Colorless is always exact, and so is an empty selection", () => {
    expect(appliedMatch({ mask: 0, match: "including" })).toBe("exactly");
    expect(appliedMatch({ mask: 0, match: "exactly" })).toBe("exactly");
    expect(appliedMatch({ mask: null, match: "including" })).toBe("exactly");
  });
});

describe("toggleColorLetter — the chips", () => {
  it("is the page's old rule on every selection and every chip", () => {
    for (const active of SELECTIONS) {
      for (const letter of COLOR_ORDER) {
        expect([active, letter, toggleColorLetter(active, letter)]).toEqual([
          active,
          letter,
          oldToggle(active, letter),
        ]);
      }
    }
  });

  it("toggles a color, and Colorless stands alone", () => {
    expect(toggleColorLetter("", "B")).toBe("B");
    expect(toggleColorLetter("B", "G")).toBe("BG");
    expect(toggleColorLetter("BG", "B")).toBe("G");
    expect(toggleColorLetter("B", "B")).toBe("");
    expect(toggleColorLetter("BG", "C")).toBe("C");
    expect(toggleColorLetter("C", "B")).toBe("B");
    expect(toggleColorLetter("C", "C")).toBe("");
  });

  it("a toggled selection parses back to the set it names, in both readings", () => {
    for (const active of SELECTIONS) {
      for (const letter of COLOR_ORDER) {
        const next = toggleColorLetter(active, letter);
        const want = next === "" ? null : next === "C" ? 0 : lettersToMask(next.replace("C", ""));
        for (const match of COLOR_MATCHES) {
          const query = new URLSearchParams(colorFilterQuery({ letters: next, match }));
          const back = parseColorFilter(
            query.get("colors") ?? undefined,
            query.get(MATCH_PARAM) ?? undefined,
          );
          expect([active, letter, back]).toEqual([active, letter, { mask: want, match }]);
        }
      }
    }
  });
});

describe("colorFilterQuery — every link's query string", () => {
  const PAGES = [undefined, 1, 2, 23, 100];
  const QS = [undefined, "", "kiki jiki", "atraxa, praetors' voice", "a&b=c", "  "];

  it("exactly builds the page's old links, byte for byte", () => {
    for (const letters of SELECTIONS) {
      for (const page of PAGES) {
        for (const q of QS) {
          expect(`/commanders${colorFilterQuery({ letters, match: "exactly", page, q })}`).toBe(
            oldFilterHref(letters, page, q),
          );
        }
      }
    }
  });

  it("including adds match=including after colors and changes nothing else", () => {
    for (const letters of SELECTIONS) {
      for (const page of PAGES) {
        for (const q of QS) {
          const exact = new URLSearchParams(
            colorFilterQuery({ letters, match: "exactly", page, q }),
          );
          const including = new URLSearchParams(
            colorFilterQuery({ letters, match: "including", page, q }),
          );
          expect(including.get(MATCH_PARAM)).toBe("including");
          expect(exact.has(MATCH_PARAM)).toBe(false);
          including.delete(MATCH_PARAM);
          expect(including.toString()).toBe(exact.toString());
        }
      }
    }
  });

  it("the links the page builds, spelled out", () => {
    // The color chips and All (page 1, the name filter kept).
    expect(colorFilterQuery({ letters: "B", match: "including" })).toBe(
      "?colors=b&match=including",
    );
    expect(colorFilterQuery({ letters: "BG", match: "including", q: "kiki jiki" })).toBe(
      "?colors=bg&match=including&q=kiki+jiki",
    );
    // All keeps the mode: the mode first and a color second works.
    expect(colorFilterQuery({ letters: "", match: "including" })).toBe("?match=including");
    expect(colorFilterQuery({ letters: "", match: "exactly" })).toBe("");
    // Colorless carries the reader's mode too.
    expect(colorFilterQuery({ letters: "C", match: "including" })).toBe(
      "?colors=c&match=including",
    );
    // Previous and Next.
    expect(colorFilterQuery({ letters: "B", match: "including", page: 2 })).toBe(
      "?colors=b&match=including&page=2",
    );
    expect(colorFilterQuery({ letters: "B", match: "including", page: 1 })).toBe(
      "?colors=b&match=including",
    );
    // The toggle chip links to the other reading: page 1, colors and name kept.
    expect(colorFilterQuery({ letters: "B", match: "exactly", q: "syr" })).toBe("?colors=b&q=syr");
    expect(colorFilterQuery({ letters: "B", match: "including", q: "syr" })).toBe(
      "?colors=b&match=including&q=syr",
    );
  });
});

describe("colorFilterNote — the line under the filters", () => {
  it("exactly says nothing, whatever is picked", () => {
    expect(colorFilterNote({ mask: null, match: "exactly" }, [])).toBeNull();
    expect(colorFilterNote({ mask: 0, match: "exactly" }, [])).toBeNull();
    expect(colorFilterNote({ mask: 4, match: "exactly" }, ["Black"])).toBeNull();
  });

  it("including states the rule for the picked colors", () => {
    expect(colorFilterNote({ mask: 4, match: "including" }, namesOf(4))).toBe(
      "Commanders whose colors include Black, alone or with others.",
    );
    expect(colorFilterNote({ mask: 4 | 16, match: "including" }, namesOf(4 | 16))).toBe(
      "Commanders whose colors include Black and Green, alone or with others.",
    );
    expect(colorFilterNote({ mask: 7, match: "including" }, namesOf(7))).toBe(
      "Commanders whose colors include White, Blue and Black, alone or with others.",
    );
    // All five: nothing is left to combine with.
    expect(colorFilterNote({ mask: 31, match: "including" }, namesOf(31))).toBe(
      "Commanders with all five colors.",
    );
  });

  it("including with no color says what a pick will do", () => {
    expect(colorFilterNote({ mask: null, match: "including" }, [])).toBe(
      "Pick a color to see every commander whose colors include it.",
    );
  });

  it("including with Colorless says Colorless is always exact, in words", () => {
    expect(colorFilterNote({ mask: 0, match: "including" }, [])).toBe(
      "Colorless is always exact: these commanders have no colors to include.",
    );
  });
});

describe("colorFilterEmpty — a page past the end", () => {
  it("an exact search keeps the sentence the page has always shown", () => {
    expect(colorFilterEmpty({ mask: 1, match: "exactly" }, 1)).toBe(
      "No commanders match that exact color identity.",
    );
    expect(colorFilterEmpty({ mask: 1, match: "exactly" }, 9)).toBe(
      "No commanders match that exact color identity on this page.",
    );
  });

  it("Colorless is an exact search in both readings", () => {
    expect(colorFilterEmpty({ mask: 0, match: "including" }, 3)).toBe(
      "No commanders match that exact color identity on this page.",
    );
  });

  it("an including search never says exact", () => {
    expect(colorFilterEmpty({ mask: 4, match: "including" }, 40)).toBe(
      "No commanders include that color on this page.",
    );
    expect(colorFilterEmpty({ mask: 4 | 16, match: "including" }, 40)).toBe(
      "No commanders include those colors on this page.",
    );
    expect(colorFilterEmpty({ mask: 4 | 16, match: "including" }, 1)).toBe(
      "No commanders include those colors.",
    );
  });

  it("no color picked names no color search, in either reading", () => {
    expect(colorFilterEmpty({ mask: null, match: "exactly" }, 90)).toBe(
      "No commanders on this page.",
    );
    expect(colorFilterEmpty({ mask: null, match: "including" }, 90)).toBe(
      "No commanders on this page.",
    );
  });
});

// --- The copy guard (U9) ------------------------------------------------------------------

/** The table's word-builders: the guard calls each one (a new one must join it here). */
const BUILDERS = ["includes", "emptyExactly", "emptyIncluding", "emptyAll"];

/** The toggle's label and its group's name: controls, not sentences. */
const CONTROLS: string[] = [COLOR_FILTER_COPY.matchLabel, COLOR_FILTER_COPY.includeOthers];

/** Every filter the URL can name: 33 selections in both readings. */
const FILTERS: ColorFilter[] = COLOR_MATCHES.flatMap((match) => [
  { mask: null, match },
  ...Array.from({ length: 32 }, (_, mask) => ({ mask, match })),
]);

function everyString(): string[] {
  const C = COLOR_FILTER_COPY;
  return [
    ...Object.values(C).flatMap((v) => (typeof v === "string" ? [v] : [])),
    ...Array.from({ length: 31 }, (_, i) => C.includes(namesOf(i + 1))),
    ...[1, 2].flatMap((page) => [
      C.emptyExactly(page),
      C.emptyIncluding(1, page),
      C.emptyIncluding(3, page),
      C.emptyAll(page),
    ]),
    ...FILTERS.flatMap((f) => {
      const note = colorFilterNote(f, f.mask ? namesOf(f.mask) : []);
      return [...(note ? [note] : []), colorFilterEmpty(f, 1), colorFilterEmpty(f, 2)];
    }),
  ];
}

describe("COLOR_FILTER_COPY — the toggle's words", () => {
  it("one toggle chip, named with the card search's word, in a group of its own", () => {
    expect(COLOR_FILTER_COPY.includeOthers).toBe("Include other colors");
    expect(COLOR_FILTER_COPY.matchLabel).toBe("Color match");
    // The two chips the build first drew are gone from the table.
    expect(Object.keys(COLOR_FILTER_COPY)).not.toContain("exactly");
    expect(Object.keys(COLOR_FILTER_COPY)).not.toContain("including");
  });

  it("the toggle links to the reading that is not on, and exactly is still the default", () => {
    expect([...COLOR_MATCHES]).toEqual(["exactly", "including"]);
    expect(otherMatch("exactly")).toBe("including");
    expect(otherMatch("including")).toBe("exactly");
    // Off: the link turns the mode on. On: the link is the exact page again.
    expect(colorFilterQuery({ letters: "B", match: otherMatch("exactly") })).toBe(
      "?colors=b&match=including",
    );
    expect(colorFilterQuery({ letters: "B", match: otherMatch("including") })).toBe("?colors=b");
  });
});

describe("copy guard (U9)", () => {
  it("reads every string the table has: each plain string and each builder", () => {
    const builders = Object.entries(COLOR_FILTER_COPY)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k);
    expect(builders.sort()).toEqual([...BUILDERS].sort());
    expect(everyString().length).toBeGreaterThan(Object.keys(COLOR_FILTER_COPY).length);
  });

  it("no em or en dash, no middle dot, never a multi-dot line", () => {
    const words = everyString();
    expect(words.filter((w) => /[–—]|\d-\d/.test(w))).toEqual([]);
    expect(words.filter((w) => w.includes("·"))).toEqual([]);
    expect(words.filter((w) => /\.\./.test(w))).toEqual([]);
  });

  it("plain words, never notation: no letters for colors, no '&', '+' or '='", () => {
    const words = everyString();
    expect(words.filter((w) => /[&+=]/.test(w))).toEqual([]);
    expect(words.filter((w) => /\b[WUBRG]{1,5}\b/.test(w))).toEqual([]);
  });

  it("every sentence ends with a period, the controls aside", () => {
    const sentences = everyString().filter((s) => !CONTROLS.includes(s));
    expect(sentences.filter((s) => !/\.$/.test(s))).toEqual([]);
  });

  it("only an exact search is called exact, and an including one says include", () => {
    for (const filter of FILTERS) {
      const names = filter.mask ? namesOf(filter.mask) : [];
      const said = [colorFilterNote(filter, names) ?? "", colorFilterEmpty(filter, 2)];
      const including = appliedMatch(filter) === "including";
      const exactSearch = filter.mask !== null && !including;
      expect([filter, /exact/i.test(said[1])]).toEqual([filter, exactSearch]);
      if (including) {
        // All five colors read "with all five colors": the one including line without the word.
        expect([filter, /\binclude\b/.test(said[1])]).toEqual([filter, true]);
        expect([filter, /\binclude\b|all five/.test(said[0])]).toEqual([filter, true]);
      }
    }
  });
});
