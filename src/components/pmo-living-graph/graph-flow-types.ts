// ============================================================================
// PMO Portfolio Living Graph — canvas types & visual encoding (CAP-048)
// ============================================================================
// The presentation vocabulary, kept apart from the data contracts so nothing in
// `src/lib/pmo-living-graph` ever has to know React Flow exists.
//
// The split that matters here is between STRUCTURE (which nodes exist, their
// content, their layout position) and INTERACTION (hover, dim, highlight).
// See `graph-node-sync.ts` for why.
// ============================================================================

import type { Node, Edge } from "@xyflow/react";
import type {
  GraphEdge,
  GraphHealth,
  GraphNode,
  GraphNodeKind,
} from "@/lib/pmo-living-graph/contracts";

/** Everything a rendered node needs, split into structure and interaction. */
export interface GraphFlowNodeData extends Record<string, unknown> {
  // ── structural ──────────────────────────────────────────────────────────
  node: GraphNode;
  /**
   * Whether double-clicking this node opens a deeper level. Leaves (subtasks,
   * risks, budget items…) do not, so they must not advertise an affordance that
   * would do nothing.
   */
  drillable: boolean;
  /** The node the current level is centred on. */
  isAnchor: boolean;
  locale: "en" | "es";
  onDrillDown: (nodeId: string) => void;

  // ── interaction (patched in place, never rebuilt) ────────────────────────
  hovered: boolean;
  dimmed: boolean;
  /** On the shortest path between the two nodes picked in Find Path. */
  onPath: boolean;
  /** Inside the current blast radius; the number is the hop distance. */
  blastHop: number | null;
  /**
   * How the active lens treats this node (CAP-048 Phase 2, M4).
   *
   * A lens REPROJECTS the canvas — it never removes nodes. Emphasis is
   * therefore a presentation channel alongside hover and path, not a filter:
   * "none" means the lens has no opinion, and the node renders normally.
   */
  lensEmphasis: "highlighted" | "muted" | "none";
}

export interface GraphFlowEdgeData extends Record<string, unknown> {
  edge: GraphEdge;
  hovered: boolean;
  dimmed: boolean;
  onPath: boolean;
  /** Edge counterpart of the node lens emphasis. */
  lensEmphasis: "highlighted" | "none";
}

export type GraphFlowNode = Node<GraphFlowNodeData, "graphNode">;
export type GraphFlowEdge = Edge<GraphFlowEdgeData, "graphEdge">;

// ---------------------------------------------------------------------------
// Visual encoding
// ---------------------------------------------------------------------------
// Three independent channels, so they can be read simultaneously:
//   shape → what kind of thing it is
//   size  → how central it is (criticality)
//   colour + halo → how healthy it is / how critical it is
// Health is never encoded by shape and kind is never encoded by colour; mixing
// them makes the canvas unreadable at portfolio scale.

/** Health → the border/accent colour, as raw hex for React Flow inline styling. */
export const HEALTH_COLOR: Record<GraphHealth, string> = {
  healthy: "#059669", // emerald-600 — the corporate green, reserved for "fine"
  at_risk: "#d97706", // amber-600
  critical: "#e11d48", // rose-600
  // Deliberately grey: unknown health must not look like good health.
  unknown: "#94a3b8", // slate-400
};

/** Health → Tailwind classes for the node chrome. */
export const HEALTH_CLASS: Record<GraphHealth, { border: string; text: string; dot: string }> = {
  healthy: { border: "border-emerald-500", text: "text-emerald-700", dot: "bg-emerald-500" },
  at_risk: { border: "border-amber-500", text: "text-amber-700", dot: "bg-amber-500" },
  critical: { border: "border-rose-500", text: "text-rose-700", dot: "bg-rose-500" },
  unknown: { border: "border-slate-300", text: "text-slate-500", dot: "bg-slate-400" },
};

/**
 * Shape per kind. React Flow nodes are boxes, so "shape" is expressed through
 * border radius and aspect — a rounded pill reads differently from a hard
 * rectangle even at low zoom, which is the point.
 */
export type GraphNodeShape = "hexagon" | "rounded" | "square" | "pill" | "diamond" | "circle";

export const KIND_SHAPE: Record<GraphNodeKind, GraphNodeShape> = {
  organization: "hexagon",
  project: "rounded",
  milestone: "diamond",
  task: "square",
  subtask: "square",
  risk: "diamond",
  decision: "hexagon",
  resource: "circle",
  team_member: "circle",
  stakeholder: "circle",
  kpi: "pill",
  budget_item: "pill",
};

/** Base footprint per kind, before criticality scaling. Feeds dagre too. */
export const KIND_SIZE: Record<GraphNodeKind, { width: number; height: number }> = {
  organization: { width: 220, height: 84 },
  project: { width: 240, height: 96 },
  milestone: { width: 200, height: 76 },
  task: { width: 180, height: 64 },
  subtask: { width: 170, height: 60 },
  risk: { width: 190, height: 72 },
  decision: { width: 190, height: 72 },
  resource: { width: 170, height: 68 },
  team_member: { width: 170, height: 64 },
  stakeholder: { width: 170, height: 64 },
  kpi: { width: 180, height: 64 },
  budget_item: { width: 180, height: 64 },
};

/**
 * Criticality (0–1) → a size multiplier in a deliberately narrow band.
 *
 * 1.0–1.35 keeps the most central node noticeably bigger without letting it
 * dominate the canvas; a wider band turns the portfolio view into one giant hub
 * surrounded by illegible specks.
 */
export function criticalityScale(criticality: number): number {
  const clamped = Math.max(0, Math.min(1, criticality));
  return 1 + clamped * 0.35;
}

export function nodeFootprint(node: GraphNode): { width: number; height: number } {
  const base = KIND_SIZE[node.kind];
  const scale = criticalityScale(node.criticality);
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}

/** Halo strength for criticality. Below the threshold there is no halo at all. */
export function criticalityHalo(criticality: number): string {
  if (criticality >= 0.75) return "ring-4 ring-offset-1";
  if (criticality >= 0.5) return "ring-2 ring-offset-1";
  return "";
}

/** Edge stroke per relationship type. Cross-project sharing gets the loud one. */
export const EDGE_COLOR: Record<string, string> = {
  contains: "#cbd5e1", // slate-300 — structure should recede
  belongs_to: "#cbd5e1",
  depends_on: "#0284c7", // sky-600
  blocks: "#e11d48",
  assigned_to: "#94a3b8",
  owned_by: "#94a3b8",
  impacts: "#f43f5e", // rose-500
  mitigates: "#059669",
  approves: "#7c3aed",
  contributes_to: "#94a3b8",
  consumes_budget: "#a16207", // yellow-700
  triggered_by: "#7c3aed",
  shares_resource_with: "#d97706", // amber-600 — the cross-project signal
};

export function edgeColor(type: string): string {
  return EDGE_COLOR[type] ?? "#94a3b8";
}

/** Inferred relationships are dashed. Observed facts are solid. Always. */
export function edgeDashArray(provenance: string): string | undefined {
  return provenance === "INFERRED" || provenance === "STALE" ? "6 4" : undefined;
}
