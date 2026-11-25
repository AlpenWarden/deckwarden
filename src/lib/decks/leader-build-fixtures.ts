/**
 * One table of cases for the leader build rule (./leader-build.ts), shared
 * by the tests of the helper and of the two surfaces that call it: the card
 * page and the /cards grid. Each case holds what each caller receives, so
 * the three cannot drift apart on what "legal" means.
 */
import type { LegalityEntry } from "@/lib/games/types";

type Status = LegalityEntry["status"];

export interface LeaderBuildCase {
  label: string;
  isLeaderCandidate: boolean;
  /** The card page's input: the status of the card's current unconditional row in the format, or none. */
  status: Status | undefined;
  /** The grid's input: the card's `legality` as the search route sends it for that format. */
  legality: LegalityEntry[];
  /** Whether the card gets a build action. */
  builds: boolean;
}

const leader = (label: string, status: Status | undefined, builds: boolean): LeaderBuildCase => ({
  label,
  isLeaderCandidate: true,
  status,
  legality: status ? [{ status }] : [],
  builds,
});

export const LEADER_BUILD_CASES: readonly LeaderBuildCase[] = [
  leader("a leader with no row", undefined, true),
  leader("a leader whose row says legal", "legal", true),
  leader("a banned leader", "banned", false),
  leader("a not-legal leader", "not_legal", false),
  leader("a restricted leader", "restricted", false),
  {
    label: "a card that is no leader candidate",
    isLeaderCandidate: false,
    status: undefined,
    legality: [],
    builds: false,
  },
];

/**
 * The grid alone: a ban that carries a condition (One Piece's pair bans)
 * never blocks a build action. The card page never sees one, because
 * `getCard` drops conditional rows in SQL.
 */
export const CONDITIONAL_BAN: LegalityEntry[] = [
  { status: "banned", condition: { type: "banned_with", cardIds: ["OP11-067", "OP08-069"] } },
];
