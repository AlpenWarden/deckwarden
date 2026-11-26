"use client";

/**
 * The panels' one add path (promoted from the Suggestions panel when the
 * Combo Radar became its second consumer — P3.3): hydrate a slim
 * {cardId, name} payload to a full editor card via /api/cards/resolve (which
 * also returns this format's legality, so an illegal add is flagged by live
 * validation immediately), then hand it to the editor's own add callback —
 * never a parallel write path.
 *
 * The id guard is the honesty check: the name came from our own card table,
 * so a resolve that returns a different id would silently add a different
 * card than shown — fail instead. Resolve is rate-limited 20/min per IP,
 * fine for click-paced adds; the per-card cache keeps retries and re-adds
 * free.
 *
 * `announce: false` (Y6a — Suggestions, whose adds the editor toasts as
 * "Added X · Undo"): a success says nothing here, so nothing announces
 * twice; a failure still lands on the panel's live line.
 *
 * MAYBE-LIST: `onMaybe` gives a second action over the same resolve and
 * cache — Suggestions' Maybe button, `maybe(target)` — with its own pending
 * card, so a row's Add and Maybe never both read "Adding…".
 */
import { useRef, useState } from "react";

import { toEditorCard, type CardWire, type EditorCard } from "@/lib/decks/editor-state";
import { MAYBE_COPY } from "@/lib/decks/maybe-copy";
import type { FormatDef, GameAdapter } from "@/lib/games/types";

export interface PanelNotice {
  text: string;
  tone: "ok" | "err";
}

export function useResolvedAdd(
  adapter: GameAdapter,
  format: FormatDef,
  onAdd: (card: EditorCard) => string | undefined,
  {
    announce = true,
    onMaybe,
  }: { announce?: boolean; onMaybe?: (card: EditorCard) => string | undefined } = {},
) {
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [pendingMaybe, setPendingMaybe] = useState<string | null>(null);
  const [notice, setNotice] = useState<PanelNotice | null>(null);
  const cacheRef = useRef(new Map<string, EditorCard>());

  const run = async (
    target: { cardId: string; name: string },
    act: (card: EditorCard) => string | undefined,
    setPending: (cardId: string | null) => void,
    done: string,
  ) => {
    setPending(target.cardId);
    setNotice(null);
    try {
      let card = cacheRef.current.get(target.cardId);
      if (!card) {
        const res = await fetch("/api/cards/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: adapter.id, format: format.code, names: [target.name] }),
        });
        if (!res.ok) throw new Error(`Couldn't load ${target.name} (${res.status}).`);
        const json: { results: { match: CardWire | null }[] } = await res.json();
        const match = json.results[0]?.match;
        if (!match || match.id !== target.cardId) {
          throw new Error(`Couldn't load ${target.name}. Try adding it from search.`);
        }
        card = toEditorCard(match);
        cacheRef.current.set(target.cardId, card);
      }
      const error = act(card);
      if (error) setNotice({ text: error, tone: "err" });
      else if (announce) setNotice({ text: done, tone: "ok" });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : "Add failed. Check your connection.",
        tone: "err",
      });
    } finally {
      setPending(null);
    }
  };

  const add = (target: { cardId: string; name: string }) =>
    run(target, onAdd, setPendingAdd, `Added ${target.name}`);
  const maybe = async (target: { cardId: string; name: string }) => {
    if (onMaybe) await run(target, onMaybe, setPendingMaybe, MAYBE_COPY.added(target.name));
  };

  return { pendingAdd, pendingMaybe, notice, add, maybe };
}
