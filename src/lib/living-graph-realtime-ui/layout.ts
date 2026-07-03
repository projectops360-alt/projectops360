// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Layout (pure)
// ============================================================================
// Deterministic node positions for the realtime graph. Layout is PRESENTATION
// ONLY — it never changes task order, status, relationships, or any canonical
// data. Three modes: mind_map (radial by depth), hierarchical (top-down by
// hierarchy depth), left_to_right (execution flow). Pure + deterministic.
// ============================================================================

import type { RealtimeGraphNode } from "./view-model";

export type RealtimeLayoutMode = "mind_map" | "hierarchical" | "left_to_right";

export interface NodePosition {
  x: number;
  y: number;
}

const COL_W = 300;
const ROW_H = 130;

/** Depth of a node in the hierarchy: milestone 0, task 1, subtask 2, child 3. */
export function nodeDepth(node: RealtimeGraphNode): number {
  switch (node.nodeKind) {
    case "project":
    case "milestone":
    case "phase":
      return 0;
    case "task":
      return 1;
    case "subtask":
      return node.parentKind === "subtask" ? 3 : 2;
    default:
      return 2;
  }
}

/**
 * Compute positions for the visible nodes. Deterministic: nodes are grouped by
 * depth and ordered by id, so the same input always yields the same layout.
 */
export function computeRealtimeLayout(
  nodes: readonly RealtimeGraphNode[],
  mode: RealtimeLayoutMode,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const byDepth = new Map<number, RealtimeGraphNode[]>();
  for (const n of nodes) {
    const d = nodeDepth(n);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }
  for (const list of byDepth.values()) list.sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  if (mode === "mind_map") {
    // Root(s) centered; each deeper ring placed radially around the center.
    for (const depth of depths) {
      const list = byDepth.get(depth)!;
      if (depth === 0) {
        list.forEach((n, i) => positions.set(n.nodeId, { x: 0, y: i * ROW_H - ((list.length - 1) * ROW_H) / 2 }));
        continue;
      }
      const radius = depth * 360;
      const n = list.length;
      list.forEach((node, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
        positions.set(node.nodeId, { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) });
      });
    }
    return positions;
  }

  if (mode === "hierarchical") {
    // Top-down: each depth is a row; nodes spread across the row.
    for (const depth of depths) {
      const list = byDepth.get(depth)!;
      list.forEach((n, i) => {
        positions.set(n.nodeId, { x: i * COL_W - ((list.length - 1) * COL_W) / 2, y: depth * (ROW_H + 60) });
      });
    }
    return positions;
  }

  // left_to_right: each depth is a column; nodes stack vertically.
  for (const depth of depths) {
    const list = byDepth.get(depth)!;
    list.forEach((n, i) => {
      positions.set(n.nodeId, { x: depth * (COL_W + 40), y: i * ROW_H - ((list.length - 1) * ROW_H) / 2 });
    });
  }
  return positions;
}
