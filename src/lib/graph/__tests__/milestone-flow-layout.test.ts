// ============================================================================
// Living Graph — milestone snake: responsive columns + geometry-routed edges
// ============================================================================
// Guard: LIVING-GRAPH-SNAKE-ROUTING
//
// Two reported problems, one root:
//
//   * the snake was hard-coded to 3 columns, so a wide canvas showed three
//     cards between two lawns of empty space while the roadmap ran off the
//     bottom;
//   * connector sides were derived from a card's INDEX, so dragging a card
//     left its line leaving by the old side — looping back across the card
//     instead of running to its neighbour.
//
// The serpentine reading order is the contract (doc 12 §11c): left→right, drop
// a row, right→left. The COLUMN COUNT is not, and neither is the assumption
// that cards never move.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  milestonesPerRow,
  milestoneFlowLayout,
  edgeHandleSides,
  MILESTONE_NODE_WIDTH,
  MILESTONES_PER_ROW,
} from "../living-graph-layout";
import type { LivingGraphNode } from "@/types/living-graph";

function nodes(count: number): LivingGraphNode[] {
  return Array.from({ length: count }, (_, i) => ({ id: `m${i}` }) as LivingGraphNode);
}

describe("milestonesPerRow", () => {
  // React Flow zooms to fit, so what matters is the SHAPE of the layout, not
  // how many cards fit at 1:1. A 16:9 screen wants a wide, shallow block.
  const WIDE = { w: 1600, h: 900 };

  it("spreads a roadmap across a wide screen instead of stacking it", () => {
    // The reported screen: 16 milestones showing three columns, two empty
    // lawns either side, and the flow running off the bottom.
    expect(milestonesPerRow(WIDE.w, WIDE.h, 16)).toBeGreaterThan(3);
  });

  it("keeps the block roughly as wide as the viewport is", () => {
    const columns = milestonesPerRow(WIDE.w, WIDE.h, 16);
    const rows = Math.ceil(16 / columns);
    const blockRatio = (columns * 430) / (rows * 298);
    const viewportRatio = WIDE.w / WIDE.h;
    // Within a factor of two of the screen's own proportions.
    expect(blockRatio).toBeGreaterThan(viewportRatio / 2);
    expect(blockRatio).toBeLessThan(viewportRatio * 2);
  });

  it("uses fewer columns on a tall screen", () => {
    const wide = milestonesPerRow(1600, 900, 16);
    const tall = milestonesPerRow(900, 1600, 16);
    expect(tall).toBeLessThan(wide);
  });

  it("never collapses the snake into a single column", () => {
    expect(milestonesPerRow(320, 900, 16)).toBeGreaterThanOrEqual(2);
    expect(milestonesPerRow(1, 1, 16)).toBeGreaterThanOrEqual(2);
  });

  it("caps the row so the eye can still follow it", () => {
    expect(milestonesPerRow(100_000, 100, 500)).toBeLessThanOrEqual(6);
  });

  it("never asks for more columns than there are milestones", () => {
    expect(milestonesPerRow(WIDE.w, WIDE.h, 2)).toBeLessThanOrEqual(2);
  });

  it("falls back to the fixed count before the canvas is measured", () => {
    expect(milestonesPerRow(0, 0, 16)).toBe(MILESTONES_PER_ROW);
    expect(milestonesPerRow(Number.NaN, 900, 16)).toBe(MILESTONES_PER_ROW);
    expect(milestonesPerRow(1600, 900, 0)).toBe(MILESTONES_PER_ROW);
  });

  it("widens as the roadmap grows", () => {
    const counts = [4, 12, 30].map((n) => milestonesPerRow(WIDE.w, WIDE.h, n));
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });
});

describe("milestoneFlowLayout", () => {
  it("keeps the serpentine: odd rows read right to left", () => {
    const positions = milestoneFlowLayout(nodes(8), 4);
    const x = (i: number) => positions.get(`m${i}`)!.x;

    // Row 0 flows left→right…
    expect(x(0)).toBeLessThan(x(1));
    expect(x(1)).toBeLessThan(x(2));
    // …row 1 flows right→left, so the line never jumps back across the canvas.
    expect(x(4)).toBeGreaterThan(x(5));
    expect(x(5)).toBeGreaterThan(x(6));
  });

  it("puts the row break directly below, not diagonally across", () => {
    const positions = milestoneFlowLayout(nodes(8), 4);
    // Last of row 0 and first of row 1 share a column.
    expect(positions.get("m3")!.x).toBe(positions.get("m4")!.x);
    expect(positions.get("m4")!.y).toBeGreaterThan(positions.get("m3")!.y);
  });

  it("honours the column count it is given", () => {
    const wide = milestoneFlowLayout(nodes(6), 6);
    // All six on one row: same y, six distinct x.
    const ys = new Set([...wide.values()].map((p) => p.y));
    expect(ys.size).toBe(1);
    expect(new Set([...wide.values()].map((p) => p.x)).size).toBe(6);
  });

  it("still lays out when asked for a nonsense column count", () => {
    expect(() => milestoneFlowLayout(nodes(3), 0)).not.toThrow();
    expect(milestoneFlowLayout(nodes(3), 0).size).toBe(3);
  });
});

describe("edgeHandleSides", () => {
  const W = MILESTONE_NODE_WIDTH;

  it("connects side to side for neighbours in a row", () => {
    expect(edgeHandleSides({ x: 0, y: 0 }, { x: W + 200, y: 0 })).toEqual({
      source: "right",
      target: "left",
    });
  });

  it("reverses on a right-to-left row", () => {
    expect(edgeHandleSides({ x: W + 200, y: 0 }, { x: 0, y: 0 })).toEqual({
      source: "left",
      target: "right",
    });
  });

  it("drops through the bottom when the next card is below", () => {
    expect(edgeHandleSides({ x: 0, y: 0 }, { x: 0, y: 400 })).toEqual({
      source: "bottom",
      target: "top",
    });
  });

  it("goes up when the card was dragged above its predecessor", () => {
    // This is the case that used to loop back across the card.
    expect(edgeHandleSides({ x: 0, y: 400 }, { x: 0, y: 0 })).toEqual({
      source: "top",
      target: "bottom",
    });
  });

  it("re-routes as a card is dragged past its neighbour", () => {
    const fixed = { x: 500, y: 0 };
    const before = edgeHandleSides({ x: 0, y: 0 }, fixed);
    const afterDragToTheRight = edgeHandleSides({ x: 1000, y: 0 }, fixed);
    expect(before.source).toBe("right");
    expect(afterDragToTheRight.source).toBe("left");
  });

  it("prefers the horizontal on a tie, the direction the roadmap reads in", () => {
    const d = 300;
    expect(edgeHandleSides({ x: 0, y: 0 }, { x: d, y: d }).source).toBe("right");
  });

  it("measures from centres, so card size does not skew the choice", () => {
    // Same centres, different declared sizes → same decision.
    const a = edgeHandleSides({ x: 0, y: 0 }, { x: 600, y: 0 });
    const b = edgeHandleSides(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 600, y: 0, width: 100, height: 100 },
    );
    expect(a).toEqual(b);
  });
});
