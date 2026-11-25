/**
 * The collection page's leader rows (COLLECTION-PAGE): the name, the color
 * identity, the count of owned cards that fit inside it, and the page's one
 * action, "Build from my collection". Text rows on purpose (the owner's
 * decision 10): no card image is asked for, so a page of sixty costs sixty
 * links and nothing from Scryfall's CDN.
 *
 * A server component: plain links, no state. Every word that belongs to a
 * game comes in as a prop from the page, which read it off the adapter; the
 * count's sentence and the button's label are shared words.
 *
 * The action goes to the new-deck page (`buildFromCollectionHref`), so it is
 * a link drawn as a button, never Button-as-Link: Base UI's Button would put
 * `role="button"` on the anchor (the header's "Sign in" has the same note).
 * Sixty of them share one visible label, so each is also named for its
 * leader, with the visible words first (speech control still finds it).
 */
import Link from "next/link";

import { ColorChipList, type ChipGame } from "@/components/color-chip";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The action's words: the plan's and the smoke's pin. */
export const BUILD_FROM_COLLECTION = "Build from my collection";

export interface LeaderListItem {
  id: string;
  name: string;
  ciMask: number;
  /** Other owned cards inside its colors. */
  fits: number;
  /** The new-deck link, or null where no starter list can be built (no action is drawn). */
  buildHref: string | null;
}

/** "412 of your cards are in its colors", and its two small cases. */
export function fitsLine(fits: number): string {
  if (fits === 0) return "None of your other cards are in its colors";
  if (fits === 1) return "1 of your cards is in its colors";
  return `${fits.toLocaleString("en-US")} of your cards are in its colors`;
}

export function OwnedLeaderList({
  leaders,
  game,
}: {
  leaders: readonly LeaderListItem[];
  game: ChipGame;
}) {
  return (
    <ul data-slot="collection-leaders" className="divide-y rounded-lg border">
      {leaders.map((leader) => (
        <li
          key={leader.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-3 py-2"
        >
          <div className="min-w-0 flex-1 basis-60">
            {/* The name wraps, never cut: a double-faced leader's is two names long. */}
            <p className="flex flex-wrap items-center gap-x-2">
              <Link
                href={`/cards/${leader.id}`}
                className="min-w-0 text-sm font-medium break-words hover:underline"
              >
                {leader.name}
              </Link>
              <ColorChipList game={game} mask={leader.ciMask} className="text-xs" />
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">{fitsLine(leader.fits)}</p>
          </div>
          {leader.buildHref && (
            <Link
              href={leader.buildHref}
              aria-label={`${BUILD_FROM_COLLECTION}: ${leader.name}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              {BUILD_FROM_COLLECTION}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
