/**
 * One budget vocabulary site-wide (Y1, WAVE4 D1): the per-card tiers that
 * Suggestions, the Autofill sheet and the hub staples table all offer, with
 * one inclusive rule — "≤ $5 a card" keeps a card at exactly $5.00, as the
 * engine's SQL (`cheapest_usd <= max`, queries.ts) always has. Unpriced
 * cards never pass a tier: a budget is a claim about a known price.
 */
import { formatUsd } from "@/lib/collection/ownership";

export type BudgetTier = "all" | "5" | "1";

export const BUDGET_OPTIONS: { value: BudgetTier; label: string }[] = [
  { value: "all", label: "All" },
  { value: "5", label: "≤ $5 a card" },
  { value: "1", label: "≤ $1 a card" },
];

/**
 * The deck total's presets (Y8, WAVE4 D9) — whole dollars, beside the Fit
 * sheet's own number field. A total is the cheapest printings' sum, so it
 * is any whole number of dollars from 1 to TOTAL_MAX_USD (goals.ts' zod).
 *
 * The Autofill sheet shows the same four (AUTOFILL-TOTAL, the owner's word
 * of 2026-11-25). Its rule was that a preset stays only if at least half of
 * the measured starter lists land at or under it: of 285 lists (57
 * commander sets, five seeds), 255 do at $50, 280 at $100, and all 285 at
 * $150 and at $250.
 */
export const TOTAL_PRESETS_USD = [50, 100, 150, 250] as const;
export const TOTAL_MAX_USD = 100_000;

/**
 * An estimate read beside a total: whole dollars, as everywhere, except when
 * that would read as the total itself while the cents say otherwise ($150.40
 * of your $150 is over). The Fit sheet's lines and Autofill's note share it.
 */
export function usdBeside(usd: number, totalUsd: number): string {
  const whole = formatUsd(usd);
  const cents = (n: number) => Math.round(n * 100);
  return whole === formatUsd(totalUsd) && cents(usd) !== cents(totalUsd)
    ? `$${usd.toFixed(2)}`
    : whole;
}

/** A stored per-card budget as its tier (Y6a — goals.ts keeps 5 or 1): anything else is "all". */
export function tierOf(perCardUsd: number | undefined): BudgetTier {
  const tier = BUDGET_OPTIONS.find((o) => o.value !== "all" && Number(o.value) === perCardUsd);
  return tier ? tier.value : "all";
}

/** The tier as a per-card budget in USD; "all" is none (null). */
export function usdOf(tier: BudgetTier): number | null {
  return tier === "all" ? null : Number(tier);
}

/** True when a card's cheapest known price fits the tier (inclusive). */
export function withinBudget(usd: number | null, tier: BudgetTier): boolean {
  if (tier === "all") return true;
  if (usd === null || !Number.isFinite(usd)) return false;
  return usd <= Number(tier);
}
