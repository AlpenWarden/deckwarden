/**
 * "Only cards I own": the words the two controls that filter by the player's
 * collection share, so they cannot drift apart. Suggestions' toggle (P3.7)
 * had them first; the Autofill sheet's checkbox (AUTOFILL-OWNED, the owner's
 * ask of 2026-11-24) takes "the Suggestions toggle's own words".
 *
 * A collection is account-only (schema.ts), so one hint covers both a guest
 * and a player who has imported nothing: neither can tick the box, and the
 * way to change that is the same link.
 */
import Link from "next/link";

/** The control's label, on both surfaces. */
export const ONLY_OWNED_LABEL = "Only cards I own";

/** The hint as plain text, for a `title`. */
export const IMPORT_COLLECTION_HINT =
  "Sign in and import a collection on your Account page to filter by cards you own";

/**
 * Suggestions' toggle on a deck that has no row yet, for a player who has a
 * collection (the owner's decision 8 of 2026-11-24): the draft's route takes
 * no owned flag, so the filter waits for the first save, which any Add makes.
 */
export const OWNED_DRAFT_HINT = "Filtering by your collection starts once the deck is saved.";

/** The hint with the Account link inside the sentence (U10a, D1: the reason is visible text). */
export function ImportCollectionHint() {
  return (
    <>
      Sign in and{" "}
      <Link href="/account" className="underline">
        import a collection
      </Link>{" "}
      on your Account page to filter by cards you own
    </>
  );
}
