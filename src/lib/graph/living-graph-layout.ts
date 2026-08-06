// ============================================================================
// ProjectOps360° — Living Graph layout engine
// ============================================================================
// Three layout modes:
//   1. hierarchical — dagre (left→right dependency flow)
//   2. timeline     — x by occurred_at/start date, y by node-type lane
//   3. force        — small deterministic force simulation (no d3 dependency)
// All functions are pure: (nodes, edges) → Map<nodeId, {x, y}>.
// ============================================================================

import dagre from "@dagrejs/dagre";
import type { LivingGraphNode, LivingGraphEdge, LivingGraphLayoutMode } from "@/types/living-graph";
import type { ProcessNodeType } from "@/types/database";

export interface NodePosition {
  x: number;
  y: number;
}

export const NODE_WIDTH = 230;
export const NODE_HEIGHT = 72;

// ── 1. Hierarchical (dagre) ────────────────────────────────────────────────────
// Top→bottom activity flow, Celonis process-explorer style.

export function hierarchicalLayout(
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): Map<string, NodePosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 56, ranksep: 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)) {
      g.setEdge(edge.sourceNodeId, edge.targetNodeId);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, NodePosition>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      positions.set(node.id, {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      });
    }
  }
  return positions;
}

// ── Milestone flow (serpentine roadmap layout) ────────────────────────────────
// Mirrors the Execution Map "Flow" view: rich milestone cards laid out in a
// snake — left→right, drop a row, right→left — connected by a single line.

export const MILESTONE_NODE_WIDTH = 260;
export const MILESTONE_NODE_HEIGHT = 168;
/** Fallback when the canvas has not been measured yet (SSR, first paint). */
export const MILESTONES_PER_ROW = 3;

const SNAKE_GAP_X = 170;
const SNAKE_GAP_Y = 130;
const SNAKE_MARGIN_X = 40;

/** Never fewer than this, or the snake degenerates into a column. */
const MIN_PER_ROW = 2;
/** Never more than this: past it the eye loses the row it was following. */
const MAX_PER_ROW = 6;

/**
 * How many milestones to put across a row.
 *
 * NOT "how many fit at 1:1". React Flow zooms the canvas to fit, so what the
 * viewer perceives is the layout's SHAPE, not its pixel width: a roadmap laid
 * out three-wide and many-deep is scaled down until it is a narrow ribbon with
 * empty space either side — which is exactly what a wide screen showed while
 * the flow ran off the bottom.
 *
 * So the column count is chosen to make the layout's aspect ratio resemble the
 * viewport's. With `count` cards in `c` columns the block is roughly
 * `c · COLUMN_PITCH` wide by `(count / c) · ROW_PITCH` tall, and solving that
 * against the target ratio gives `c = √(ratio · count · ROW_PITCH / COLUMN_PITCH)`.
 *
 * The serpentine reading order is the contract (doc 12 §11c); the number of
 * columns is not.
 */
export function milestonesPerRow(
  canvasWidth: number,
  canvasHeight: number,
  milestoneCount: number,
): number {
  const fallback = MILESTONES_PER_ROW;
  if (
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    canvasWidth <= 0 ||
    canvasHeight <= 0 ||
    !Number.isFinite(milestoneCount) ||
    milestoneCount <= 0
  ) {
    return fallback;
  }

  const columnPitch = MILESTONE_NODE_WIDTH + SNAKE_GAP_X;
  const rowPitch = MILESTONE_NODE_HEIGHT + SNAKE_GAP_Y;
  const ratio = canvasWidth / canvasHeight;

  const ideal = Math.sqrt((ratio * milestoneCount * rowPitch) / columnPitch);
  const columns = Math.round(ideal);

  return Math.max(MIN_PER_ROW, Math.min(MAX_PER_ROW, Math.min(columns, milestoneCount)));
}

/**
 * Serpentine positions for milestone cards. `nodes` must already be in flow
 * order (aggregateByMilestone returns them ordered by earliest activity).
 */
export function milestoneFlowLayout(
  nodes: LivingGraphNode[],
  perRow: number = MILESTONES_PER_ROW,
): Map<string, NodePosition> {
  const columns = Math.max(1, Math.floor(perRow));
  const positions = new Map<string, NodePosition>();
  nodes.forEach((node, i) => {
    const row = Math.floor(i / columns);
    const colInRow = i % columns;
    // Odd rows read right→left, so the line never jumps back across the canvas.
    const col = row % 2 === 0 ? colInRow : columns - 1 - colInRow;
    positions.set(node.id, {
      x: SNAKE_MARGIN_X + col * (MILESTONE_NODE_WIDTH + SNAKE_GAP_X),
      y: 40 + row * (MILESTONE_NODE_HEIGHT + SNAKE_GAP_Y),
    });
  });
  return positions;
}

export type SnakeSide = "left" | "right" | "top" | "bottom";

/**
 * Handle sides for the i-th card in the snake: flows sideways within a row,
 * turns downward at row ends.
 */
export function snakeHandleSides(
  index: number,
  total: number,
  perRow = MILESTONES_PER_ROW,
): { source: SnakeSide; target: SnakeSide } {
  const row = Math.floor(index / perRow);
  const colInRow = index % perRow;
  const rightward = row % 2 === 0;
  const isRowEnd = colInRow === perRow - 1 || index === total - 1;
  const isRowStart = colInRow === 0;
  return {
    source: isRowEnd ? "bottom" : rightward ? "right" : "left",
    target: isRowStart && row > 0 ? "top" : rightward ? "left" : "right",
  };
}

// ── Geometry-driven edge routing ──────────────────────────────────────────────

export interface NodeBox {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Which sides a connector should leave and enter by, given where the two cards
 * actually are.
 *
 * The snake sides above are derived from a card's INDEX, which is correct only
 * while the cards sit where the layout put them. Drag one and the connector
 * kept leaving by its original side, so it looped back across the card instead
 * of running to its neighbour. Reading the real positions means the line
 * re-routes as the card moves, with no recalculation step of its own.
 *
 * The dominant axis wins: mostly-sideways neighbours connect side to side,
 * mostly-stacked ones connect bottom to top. Ties favour the horizontal, which
 * is the direction the roadmap reads in.
 */
export function edgeHandleSides(
  source: NodeBox,
  target: NodeBox,
): { source: SnakeSide; target: SnakeSide } {
  const sourceCenterX = source.x + (source.width ?? MILESTONE_NODE_WIDTH) / 2;
  const sourceCenterY = source.y + (source.height ?? MILESTONE_NODE_HEIGHT) / 2;
  const targetCenterX = target.x + (target.width ?? MILESTONE_NODE_WIDTH) / 2;
  const targetCenterY = target.y + (target.height ?? MILESTONE_NODE_HEIGHT) / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { source: "right", target: "left" }
      : { source: "left", target: "right" };
  }
  return dy >= 0
    ? { source: "bottom", target: "top" }
    : { source: "top", target: "bottom" };
}

// ── 2. Timeline ────────────────────────────────────────────────────────────────

const LANE_ORDER: ProcessNodeType[] = [
  "milestone_gate",
  "labor_risk",
  "task_transition",
  "decision_cascade",
  "communication_flow",
  "document_link",
  "blocker_event",
];

const LANE_HEIGHT = NODE_HEIGHT + 60;
const TIMELINE_WIDTH = 2400;

export function timelineLayout(
  nodes: LivingGraphNode[],
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  if (nodes.length === 0) return positions;

  const times = nodes.map((n) =>
    new Date(n.startDate ?? n.occurredAt).getTime(),
  );
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);

  // Track per-lane occupancy to avoid overlap when many events share a date
  const laneSlots = new Map<string, number[]>();

  nodes.forEach((node, i) => {
    const t = times[i];
    const laneIndex = Math.max(0, LANE_ORDER.indexOf(node.nodeType));
    const x = 40 + ((t - min) / span) * TIMELINE_WIDTH;

    const slotKey = `${laneIndex}`;
    const used = laneSlots.get(slotKey) ?? [];
    // Push down within the lane if another node is horizontally too close
    let subRow = 0;
    while (
      used.some(
        (ux, idx) =>
          Math.abs(ux - x) < NODE_WIDTH + 24 &&
          Math.floor(idx / 1000) === subRow,
      )
    ) {
      subRow++;
      if (subRow > 5) break;
    }
    used.push(x + subRow * 1_000_000); // encode subRow implicitly (cheap)
    laneSlots.set(slotKey, used);

    positions.set(node.id, {
      x,
      y: 40 + laneIndex * LANE_HEIGHT * 2 + subRow * (NODE_HEIGHT + 16),
    });
  });

  return positions;
}

// ── 3. Force (deterministic, dependency-free) ─────────────────────────────────

/** Mulberry32 — tiny seeded PRNG so the layout is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forceLayout(
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
  iterations = 180,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  if (nodes.length === 0) return positions;

  const rand = mulberry32(42);
  const n = nodes.length;
  const area = Math.max(800, Math.sqrt(n) * 420);
  const idealDist = Math.max(180, area / Math.sqrt(n));

  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);

  // Deterministic circular-ish seeding
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = area * 0.3 * (0.6 + rand() * 0.4);
    px[i] = Math.cos(angle) * r + (rand() - 0.5) * 50;
    py[i] = Math.sin(angle) * r + (rand() - 0.5) * 50;
  }

  const edgePairs: [number, number][] = [];
  for (const e of edges) {
    const a = idx.get(e.sourceNodeId);
    const b = idx.get(e.targetNodeId);
    if (a != null && b != null && a !== b) edgePairs.push([a, b]);
  }

  let temperature = area / 8;
  const cooling = temperature / (iterations + 1);

  for (let iter = 0; iter < iterations; iter++) {
    dx.fill(0);
    dy.fill(0);

    // Repulsion (O(n²) — acceptable for the few hundred nodes we target)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = px[i] - px[j];
        let vy = py[i] - py[j];
        let dist = Math.sqrt(vx * vx + vy * vy);
        if (dist < 0.01) {
          vx = rand() - 0.5;
          vy = rand() - 0.5;
          dist = 1;
        }
        const force = (idealDist * idealDist) / dist;
        const fx = (vx / dist) * force;
        const fy = (vy / dist) * force;
        dx[i] += fx;
        dy[i] += fy;
        dx[j] -= fx;
        dy[j] -= fy;
      }
    }

    // Attraction along edges
    for (const [a, b] of edgePairs) {
      const vx = px[a] - px[b];
      const vy = py[a] - py[b];
      const dist = Math.max(0.01, Math.sqrt(vx * vx + vy * vy));
      const force = (dist * dist) / idealDist;
      const fx = (vx / dist) * force;
      const fy = (vy / dist) * force;
      dx[a] -= fx;
      dy[a] -= fy;
      dx[b] += fx;
      dy[b] += fy;
    }

    // Apply with temperature clamp + mild centering gravity
    for (let i = 0; i < n; i++) {
      dx[i] -= px[i] * 0.02;
      dy[i] -= py[i] * 0.02;
      const disp = Math.max(0.01, Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]));
      const limited = Math.min(disp, temperature);
      px[i] += (dx[i] / disp) * limited;
      py[i] += (dy[i] / disp) * limited;
    }
    temperature = Math.max(1, temperature - cooling);
  }

  for (const node of nodes) {
    const i = idx.get(node.id)!;
    positions.set(node.id, { x: px[i], y: py[i] });
  }
  return positions;
}

// ── Dispatcher ─────────────────────────────────────────────────────────────────

export function computeLayout(
  mode: LivingGraphLayoutMode,
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): Map<string, NodePosition> {
  switch (mode) {
    case "timeline":
      return timelineLayout(nodes);
    case "force":
      return forceLayout(nodes, edges);
    case "hierarchical":
    default:
      return hierarchicalLayout(nodes, edges);
  }
}
