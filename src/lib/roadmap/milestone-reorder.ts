// ============================================================================
// ProjectOps360° — Milestone reordering (pure)
// ============================================================================
// The Living Graph / Project Execution Map draws milestones as a single
// sequential flow line ordered by `order_index` (aggregateByMilestone). Users
// must be able to reorder that sequence WITHOUT editing the database — this pure
// helper computes the minimal order_index swap for a "move up / move down"
// action so the change is deterministic and unit-testable. No side effects.
// ============================================================================

export interface MilestoneOrderRow {
  id: string;
  order_index: number;
}

export type MilestoneMoveDirection = "up" | "down";

/**
 * Compute the order_index swap needed to move `milestoneId` one position up
 * (earlier) or down (later) within its project's milestone sequence. Returns the
 * two rows' NEW order_index values, or `null` when the move is a no-op (target
 * not found, or already at the boundary). "up" = earlier in the flow (lower
 * order_index); "down" = later.
 */
export function computeMilestoneReorder(
  rows: readonly MilestoneOrderRow[],
  milestoneId: string,
  direction: MilestoneMoveDirection,
): { updates: MilestoneOrderRow[] } | null {
  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  const i = sorted.findIndex((m) => m.id === milestoneId);
  if (i === -1) return null;

  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sorted.length) return null; // already at the boundary

  const a = sorted[i];
  const b = sorted[j];
  // Swap their positions in the sequence.
  return {
    updates: [
      { id: a.id, order_index: b.order_index },
      { id: b.id, order_index: a.order_index },
    ],
  };
}

/** True when the milestone can move in the given direction (UI enable/disable). */
export function canMoveMilestone(
  rows: readonly MilestoneOrderRow[],
  milestoneId: string,
  direction: MilestoneMoveDirection,
): boolean {
  return computeMilestoneReorder(rows, milestoneId, direction) !== null;
}
