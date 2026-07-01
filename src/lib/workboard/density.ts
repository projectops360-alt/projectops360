// ============================================================================
// ProjectOps360° — Workboard density (UX-013, pure, client-safe, testable)
// ============================================================================
// Compact density lets more workflow columns fit on screen so a PM never has to
// reduce browser zoom to move a task across the board. Pure functions so the
// behavior is unit-tested without a DOM; the preferences hook + board import
// from here (one source of truth). See 32-product-ux-contracts.md → UX-013.
// ============================================================================

export type WorkboardDensity = "comfortable" | "compact";

/** Default column widths (px). Compact is narrow enough to fit more columns. */
export const COMFORTABLE_COLUMN_WIDTH = 280;
export const COMPACT_COLUMN_WIDTH = 212;

export function isValidDensity(value: unknown): value is WorkboardDensity {
  return value === "comfortable" || value === "compact";
}

/** Toggle between the two densities. */
export function nextDensity(density: WorkboardDensity): WorkboardDensity {
  return density === "compact" ? "comfortable" : "compact";
}

/** The density-aware default column width when the user has not set a custom one. */
export function defaultColumnWidth(density: WorkboardDensity): number {
  return density === "compact" ? COMPACT_COLUMN_WIDTH : COMFORTABLE_COLUMN_WIDTH;
}

/**
 * Resolve a column's width: a user-set custom width always wins; otherwise the
 * density default applies. This is the rule the board renders (UX-013).
 */
export function resolveColumnWidth(density: WorkboardDensity, customWidth?: number | null): number {
  return customWidth != null ? customWidth : defaultColumnWidth(density);
}
