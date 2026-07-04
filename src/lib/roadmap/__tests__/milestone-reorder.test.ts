// ============================================================================
// Guard — LIVING-GRAPH-MILESTONE-MANUAL-REORDER
// ============================================================================
// Users must be able to reshape the milestone flow sequence (which the Living
// Graph draws by order_index) from the UI, without editing the database. This
// protects the pure swap math behind the "Move up / Move down" milestone action:
// deterministic order_index swap, boundary no-ops, and unknown-id safety.
// ============================================================================

import { describe, it, expect } from "vitest";
import { computeMilestoneReorder, canMoveMilestone } from "@/lib/roadmap/milestone-reorder";

const rows = [
  { id: "a", order_index: 0 },
  { id: "b", order_index: 1 },
  { id: "c", order_index: 2 },
];

describe("computeMilestoneReorder", () => {
  it("moving down swaps order_index with the next milestone", () => {
    const res = computeMilestoneReorder(rows, "a", "down");
    expect(res).not.toBeNull();
    expect(res!.updates).toEqual([
      { id: "a", order_index: 1 },
      { id: "b", order_index: 0 },
    ]);
  });

  it("moving up swaps order_index with the previous milestone", () => {
    const res = computeMilestoneReorder(rows, "c", "up");
    expect(res!.updates).toEqual([
      { id: "c", order_index: 1 },
      { id: "b", order_index: 2 },
    ]);
  });

  it("is a no-op at the boundaries", () => {
    expect(computeMilestoneReorder(rows, "a", "up")).toBeNull();
    expect(computeMilestoneReorder(rows, "c", "down")).toBeNull();
  });

  it("returns null for an unknown milestone", () => {
    expect(computeMilestoneReorder(rows, "zzz", "up")).toBeNull();
  });

  it("respects the sorted sequence even when order_index has gaps", () => {
    const gappy = [
      { id: "x", order_index: 5 },
      { id: "y", order_index: 20 },
      { id: "z", order_index: 99 },
    ];
    const res = computeMilestoneReorder(gappy, "x", "down");
    // x takes y's slot and vice-versa — values swap, sequence preserved.
    expect(res!.updates).toEqual([
      { id: "x", order_index: 20 },
      { id: "y", order_index: 5 },
    ]);
  });
});

describe("canMoveMilestone", () => {
  it("reflects boundary availability", () => {
    expect(canMoveMilestone(rows, "a", "up")).toBe(false);
    expect(canMoveMilestone(rows, "a", "down")).toBe(true);
    expect(canMoveMilestone(rows, "c", "down")).toBe(false);
    expect(canMoveMilestone(rows, "b", "up")).toBe(true);
  });
});
