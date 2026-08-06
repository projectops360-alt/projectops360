// ============================================================================
// Living Graph — timeline layout must not stack cards on top of each other
// ============================================================================
// Guard: LIVING-GRAPH-TIMELINE-PACKING
//
// Opening "what happened between" on a 291-node project produced a pile of
// overlapping cards: unreadable at a glance, and only legible after dragging
// them apart by hand.
//
// The anti-overlap code could not have worked. It recorded
// `x + subRow * 1_000_000` and then measured `|recorded − x|` against it, so
// every row above the first read as astronomically far away; its row test
// compared `index / 1000` — an array position — against the row number, true
// only for row zero; and it gave up after five rows regardless.
//
// The property asserted here is the one that was actually broken: NO TWO CARDS
// MAY OVERLAP.
// ============================================================================

import { describe, it, expect } from "vitest";
import { timelineLayout, NODE_WIDTH, NODE_HEIGHT } from "../living-graph-layout";
import type { LivingGraphNode } from "@/types/living-graph";
import type { ProcessNodeType } from "@/types/database";

function node(
  id: string,
  startDate: string,
  nodeType: ProcessNodeType = "task_transition",
): LivingGraphNode {
  return { id, nodeType, startDate, occurredAt: startDate } as LivingGraphNode;
}

/** Cards overlap when their boxes intersect on both axes. */
function overlaps(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT;
}

function countOverlaps(positions: Map<string, { x: number; y: number }>): number {
  const all = [...positions.values()];
  let count = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (overlaps(all[i], all[j])) count++;
    }
  }
  return count;
}

describe("timelineLayout", () => {
  it("does not overlap cards that share a date", () => {
    // 30 activities on the very same day — the case that used to pile up.
    const nodes = Array.from({ length: 30 }, (_, i) => node(`n${i}`, "2026-03-02"));
    expect(countOverlaps(timelineLayout(nodes))).toBe(0);
  });

  it("does not overlap at the scale that was reported", () => {
    // 291 nodes clustered over a few weeks, like the imported SAP plan.
    const nodes = Array.from({ length: 291 }, (_, i) => {
      const day = String((i % 21) + 1).padStart(2, "0");
      return node(`n${i}`, `2026-03-${day}`);
    });
    expect(countOverlaps(timelineLayout(nodes))).toBe(0);
  });

  it("uses as many rows as it needs instead of giving up after five", () => {
    const nodes = Array.from({ length: 40 }, (_, i) => node(`n${i}`, "2026-03-02"));
    const ys = new Set([...timelineLayout(nodes).values()].map((p) => p.y));
    // 40 same-day cards cannot fit in six rows without overlapping.
    expect(ys.size).toBeGreaterThan(6);
  });

  it("keeps time reading left to right", () => {
    const positions = timelineLayout([
      node("early", "2026-01-01"),
      node("late", "2026-12-31"),
      node("middle", "2026-06-15"),
    ]);
    expect(positions.get("early")!.x).toBeLessThan(positions.get("middle")!.x);
    expect(positions.get("middle")!.x).toBeLessThan(positions.get("late")!.x);
  });

  it("keeps node types in separate lanes", () => {
    const positions = timelineLayout([
      node("gate", "2026-03-02", "milestone_gate"),
      node("task", "2026-03-02", "task_transition"),
    ]);
    expect(positions.get("gate")!.y).not.toBe(positions.get("task")!.y);
  });

  it("does not let a busy lane spill into the next one", () => {
    // A crowded first lane and one card in a later lane: they must not collide.
    const crowded = Array.from({ length: 25 }, (_, i) =>
      node(`gate${i}`, "2026-03-02", "milestone_gate"),
    );
    const positions = timelineLayout([...crowded, node("task", "2026-03-02", "task_transition")]);
    expect(countOverlaps(positions)).toBe(0);
  });

  it("places every node exactly once", () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(`n${i}`, "2026-03-02"));
    expect(timelineLayout(nodes).size).toBe(50);
  });

  it("is stable: the same input gives the same layout", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => node(`n${i}`, `2026-03-0${(i % 9) + 1}`));
    expect([...timelineLayout(nodes).entries()]).toEqual([...timelineLayout(nodes).entries()]);
  });

  it("handles an empty graph and a single node", () => {
    expect(timelineLayout([]).size).toBe(0);
    expect(timelineLayout([node("only", "2026-03-02")]).size).toBe(1);
  });
});
