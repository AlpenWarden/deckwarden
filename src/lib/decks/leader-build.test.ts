// @vitest-environment node
/**
 * The leader build rule (COMMANDER-DOOR): which cards get a build action,
 * the format the rule reads, and the action's address and words. The cases
 * are the shared table (./leader-build-fixtures.ts), which the card page's
 * and the grid's tests read too.
 */
import { describe, expect, it } from "vitest";

import { FORMAT_ID, FORMATS } from "@/db/seed-data";
import { listAdapters } from "@/lib/games/registry";

import { leaderBuildHref, leaderBuildWords } from "./leader-build-link";
import { CONDITIONAL_BAN, LEADER_BUILD_CASES } from "./leader-build-fixtures";
import { leaderCanBuild, leaderFormat, unconditionalStatus } from "./leader-build";

describe("leaderCanBuild (the rule)", () => {
  it.each(LEADER_BUILD_CASES)("$label: builds = $builds", (c) => {
    // As the card page calls it: the status of the unconditional row, or none.
    expect(leaderCanBuild(c.isLeaderCandidate, c.status)).toBe(c.builds);
    // As the grid calls it: the same status, picked out of the wire's entries.
    expect(leaderCanBuild(c.isLeaderCandidate, unconditionalStatus(c.legality))).toBe(c.builds);
  });

  it("the table holds every status the column allows, and both kinds of card", () => {
    expect(new Set(LEADER_BUILD_CASES.map((c) => c.status))).toEqual(
      new Set([undefined, "legal", "banned", "not_legal", "restricted"]),
    );
    expect(LEADER_BUILD_CASES.filter((c) => !c.isLeaderCandidate)).toHaveLength(1);
  });

  it("a card that is no leader candidate gets none, whatever its status", () => {
    for (const status of [undefined, "legal", "banned"] as const) {
      expect(leaderCanBuild(false, status)).toBe(false);
    }
  });
});

describe("unconditionalStatus", () => {
  it("no entries, or none at all, is no status", () => {
    expect(unconditionalStatus([])).toBeUndefined();
    expect(unconditionalStatus(undefined)).toBeUndefined();
  });

  it("a conditional ban is not the card's status, so it never blocks", () => {
    expect(unconditionalStatus(CONDITIONAL_BAN)).toBeUndefined();
    expect(leaderCanBuild(true, unconditionalStatus(CONDITIONAL_BAN))).toBe(true);
  });

  it("beside a conditional entry, the unconditional one decides", () => {
    expect(unconditionalStatus([...CONDITIONAL_BAN, { status: "banned" }])).toBe("banned");
    expect(unconditionalStatus([{ status: "not_legal" }, ...CONDITIONAL_BAN])).toBe("not_legal");
  });
});

describe("leaderFormat", () => {
  it("is the format each game's new deck opens in: the adapter's first, and it defaults to legal", () => {
    const adapters = listAdapters();
    expect(adapters.map((a) => a.id).sort()).toEqual(["mtg", "optcg"]);
    for (const adapter of adapters) {
      const format = leaderFormat(adapter.id);
      expect(format?.code).toBe(adapter.formats[0].code);
      // "No row" reads as legal on every surface: true only while this holds.
      expect(format?.defaultLegality).toBe("legal");
    }
  });

  it("names Commander for Magic and Standard for One Piece, by their fixed ids", () => {
    expect(leaderFormat("mtg")?.id).toBe(FORMAT_ID.commander);
    expect(leaderFormat("optcg")?.id).toBe(FORMAT_ID.optcgStandard);
    // The game ids are the same two numbers, so pin that the two formats differ.
    expect(leaderFormat("mtg")?.id).not.toBe(leaderFormat("optcg")?.id);
  });

  it("a game with no seeded format has none", () => {
    expect(leaderFormat("azuki")).toBeUndefined();
  });

  it("every seeded format defaults to legal (the rule reads no default)", () => {
    expect(FORMATS.map((f) => f.defaultLegality)).toEqual(FORMATS.map(() => "legal"));
  });
});

describe("the action's address and words", () => {
  it("opens a new deck of the game with the leader's key, the hub button's address", () => {
    expect(leaderBuildHref("mtg", "7e6b9b59-cd68-4e3c-827b-38833c92d6eb")).toBe(
      "/decks/new?game=mtg&leader=7e6b9b59-cd68-4e3c-827b-38833c92d6eb",
    );
    expect(leaderBuildHref("optcg", "OP01-003")).toBe("/decks/new?game=optcg&leader=OP01-003");
  });

  it("names the card, with its printed id in brackets when one is given", () => {
    expect(leaderBuildWords("Atraxa, Praetors' Voice")).toBe("Build with Atraxa, Praetors' Voice");
    expect(leaderBuildWords("Monkey.D.Luffy", "OP01-003")).toBe(
      "Build with Monkey.D.Luffy (OP01-003)",
    );
    expect(leaderBuildWords("Atraxa, Praetors' Voice", null)).toBe(
      "Build with Atraxa, Praetors' Voice",
    );
  });
});
