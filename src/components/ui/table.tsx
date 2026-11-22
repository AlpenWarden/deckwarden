/**
 * Table (U10a, WAVE5.md D10; the owner's F18): a hand copy of the v4
 * registry's `apps/v4/registry/bases/base/ui/table.tsx` at `c257f68`
 * (2026-09-04) — its parts and their slots — with the class strings
 * of `new-york-v4/ui/table.tsx` at the same commit, never `shadcn add`.
 *
 * On arrival, the house density the hub's staples and the analytics tables
 * already had: cells `py-1.5 pr-3` (the registry's `p-2`), a muted header
 * row, the last column flush. The registry's row hover tint and its
 * `transition-colors` are left out (these tables are read, not selected;
 * D0 puts no motion on page-like surfaces) and so is its `"use client"`
 * (a table holds no state and the hub's rows are ISR HTML). Cells don't
 * force `whitespace-nowrap`: a type line wraps inside the `min-w` a caller
 * sets. `<tr hidden>` passes through untouched — U7b's fold keeps every
 * staple in the markup.
 *
 * TRIM-T1 (2026-11-22): cut to what the site renders, on purpose. Six of
 * the registry's eight parts are here (no footer, no caption), and the row
 * and the cells no longer carry the registry's rules for a checkbox in a
 * cell, a selected row and an expanded row: no table on the site has any of
 * the three, and the rules were repeated on every row and cell of the hub's
 * staples. A later re-sync from the registry would bring all of it back.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b", className)} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground py-1.5 pr-3 text-left align-middle font-medium last:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("py-1.5 pr-3 align-middle last:pr-0", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
