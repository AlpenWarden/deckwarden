/**
 * The collection page's card rows (COLLECTION-PAGE): one row per card the
 * player owns, with its copies added up over every printing and finish.
 * Text rows (the owner's decision 10), read-only: no image, no edit, no add
 * button. A server component with plain links.
 *
 * A row is one link to the card's page, as a row of the leader index is:
 * nothing else in it can be pressed, so the whole row is the target (44 px
 * at least on a coarse pointer) and its name reads the row out.
 *
 * One row, two layouts, no script. On a phone the name and the copies share
 * the first line and the type, the colors and the rank sit under them. From
 * `sm` the same five pieces are five columns, so the eye runs down a
 * column. The middle three are one wrapper that turns into the grid's own
 * cells at `sm` (`contents`); the copies are placed by hand on the phone
 * (first line, right) and fall back into the flow as the last column. A
 * long name wraps inside its cell; it is never cut.
 *
 * The rank's words are the game's (the page asks the adapter and hands the
 * finished phrase in); a card without a rank shows a dash.
 */
import Link from "next/link";

import { ColorChipList, type ChipGame } from "@/components/color-chip";

export interface CardListItem {
  id: string;
  name: string;
  primaryType: string | null;
  ciMask: number;
  /** The rank in the game's words ("EDHREC rank #7"), or null without one. */
  rank: string | null;
  copies: number;
}

const DASH = "—";

export function OwnedCardList({ cards, game }: { cards: readonly CardListItem[]; game: ChipGame }) {
  return (
    <ul data-slot="collection-cards" className="divide-y rounded-lg border">
      {cards.map((card) => (
        <li key={card.id}>
          <Link
            href={`/cards/${card.id}`}
            className="group grid grid-cols-[minmax(0,1fr)_auto] content-center items-baseline gap-x-3 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_8rem_5rem_11rem_3rem] pointer-coarse:min-h-11"
          >
            <span className="min-w-0 text-sm font-medium break-words group-hover:underline">
              {card.name}
            </span>
            <span className="text-muted-foreground col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs sm:contents">
              <span className="truncate">{card.primaryType ?? DASH}</span>
              <span>
                <ColorChipList game={game} mask={card.ciMask} />
              </span>
              <span className="tabular-nums">{card.rank ?? DASH}</span>
            </span>
            <span className="col-start-2 row-start-1 text-right text-sm tabular-nums sm:col-start-auto sm:row-start-auto">
              <span aria-hidden>×</span>
              {card.copies.toLocaleString("en-US")}
              <span className="sr-only">{card.copies === 1 ? " copy" : " copies"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
