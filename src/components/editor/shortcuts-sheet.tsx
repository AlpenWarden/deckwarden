"use client";

/**
 * The `?` shortcut sheet (R3, F7): the keyboard script, as keycaps, in a
 * Modal (a Base UI Dialog — focus trapped, Escape closes, focus returns to
 * whatever had it). The Sheet primitive was considered and passed over: a
 * seven-row reference (eight with a Maybe list's Shift+Enter, LATER 549)
 * reads better centred than docked to an edge, and the
 * Modal already carries the dialog contract every editor dialog shares.
 */
import { Fragment, type ReactNode } from "react";

import { Kbd } from "@/components/ui/kbd";
import { Modal } from "@/components/ui/modal";
import { MAYBE_COPY } from "@/lib/decks/maybe-copy";

export function ShortcutsSheet({
  mainZoneLabel,
  leaderNoun,
  maybe = false,
  onClose,
}: {
  mainZoneLabel: string;
  /** Absent when the format has no leader zone (none today). */
  leaderNoun?: string;
  /** The format has a Maybe list, so Shift+Enter parks a card (LATER 549). */
  maybe?: boolean;
  onClose: () => void;
}) {
  const rows: { keys: ReactNode; what: string }[] = [
    { keys: <Kbd>/</Kbd>, what: "Focus search" },
    {
      keys: (
        <>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </>
      ),
      what: "Move through results (wraps around)",
    },
    { keys: <Kbd>Enter</Kbd>, what: `Add the selected card to ${mainZoneLabel}` },
    ...(maybe
      ? [
          {
            keys: (
              <>
                <Kbd>Shift</Kbd>
                <span aria-hidden>+</span>
                <Kbd>Enter</Kbd>
              </>
            ),
            what: MAYBE_COPY.keyRow,
          },
        ]
      : []),
    ...(leaderNoun
      ? [
          {
            keys: (
              <>
                <Kbd>Ctrl</Kbd>
                <span aria-hidden>+</span>
                <Kbd>Enter</Kbd>
              </>
            ),
            what: `Add the selected card as ${leaderNoun}`,
          },
        ]
      : []),
    { keys: <Kbd>Esc</Kbd>, what: "Clear the search" },
    {
      keys: <span className="font-mono text-xs">4 Name</span>,
      what: "A number before the name sets the quantity",
    },
    { keys: <Kbd>?</Kbd>, what: "Open this sheet" },
  ];
  return (
    <Modal label="Keyboard shortcuts" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        {rows.map((row) => (
          <Fragment key={row.what}>
            <dt className="flex items-center justify-end gap-1">{row.keys}</dt>
            <dd>{row.what}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="text-muted-foreground text-xs">
        Ctrl is ⌘ on a Mac. Shortcuts pause while a dialog like this one is open.
      </p>
    </Modal>
  );
}
