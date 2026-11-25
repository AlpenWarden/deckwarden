/**
 * Previous and Next under a collection list (COLLECTION-PAGE), as the
 * leader index draws them: two plain links and, between them, where the
 * reader is. Nothing is drawn for a list of one page. A server component;
 * the page builds the two addresses (`collectionHref`).
 */
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";

const LINK_CLASS =
  "underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center";

export function CollectionPager({
  page,
  pages,
  previousHref,
  nextHref,
}: {
  page: number;
  pages: number;
  /** Null on the first page. */
  previousHref: string | null;
  /** Null on the last page. */
  nextHref: string | null;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pages"
      className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm"
    >
      <span>
        {previousHref && (
          <Link href={previousHref} className={LINK_CLASS}>
            <ArrowLeftIcon aria-hidden className="mr-1 inline size-4 align-[-0.2em]" />
            Previous
          </Link>
        )}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        Page {page.toLocaleString("en-US")} of {pages.toLocaleString("en-US")}
      </span>
      <span className="text-right">
        {nextHref && (
          <Link href={nextHref} className={LINK_CLASS}>
            Next
            <ArrowRightIcon aria-hidden className="ml-1 inline size-4 align-[-0.2em]" />
          </Link>
        )}
      </span>
    </nav>
  );
}
