// ============================================================================
// PMO Portfolio Living Graph — data contracts (CAP-048)
// ============================================================================
// One typed vocabulary for the whole module. Every node and every edge traces
// back to a canonical row, and every edge states where it came from — a graph
// nobody can interrogate is decoration, not intelligence.
// ============================================================================

/**
 * Node kinds backed by a real table. Portfolio, Program, Phase, Deliverable,
 * Issue and Objective are deliberately absent: no table models them today, and
 * inventing them would put fiction on a PMO's screen. See CAP-048 §2.
 */
export const GRAPH_NODE_KINDS = [
  "organization",
  "project",
  "milestone",
  "task",
  "subtask",
  "risk",
  "decision",
  "resource",
  "team_member",
  "stakeholder",
  "kpi",
  "budget_item",
] as const;
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

/** Controlled relationship vocabulary. */
export const GRAPH_EDGE_TYPES = [
  "contains",
  "belongs_to",
  "depends_on",
  "blocks",
  "assigned_to",
  "owned_by",
  "impacts",
  "mitigates",
  "approves",
  "contributes_to",
  "consumes_budget",
  "triggered_by",
  "shares_resource_with",
] as const;
export type GraphEdgeType = (typeof GRAPH_EDGE_TYPES)[number];

/**
 * Where a fact came from. A computed relationship never masquerades as an
 * observed one — that distinction is what makes the graph auditable.
 */
export const GRAPH_PROVENANCE = [
  /** Read straight from operational data or the event log. */
  "OBSERVED",
  /** A person asserted it explicitly. */
  "DECLARED",
  /** Derived by a deterministic rule. Never by an LLM in Phase 1. */
  "INFERRED",
  /** Questioned by a reviewer. */
  "DISPUTED",
  /** Possibly outdated. */
  "STALE",
  /** Reviewed and accepted. */
  "CONFIRMED",
] as const;
export type GraphProvenance = (typeof GRAPH_PROVENANCE)[number];

export type GraphHealth = "healthy" | "at_risk" | "critical" | "unknown";
export type GraphEdgeDirection = "directed" | "undirected";

/**
 * A single piece of evidence behind a node or edge, pointing at the canonical
 * record that produced it. Never free prose: the UI must be able to link back.
 */
export interface GraphEvidenceRef {
  /** Canonical table the evidence lives in, e.g. "task_dependencies". */
  sourceTable: string;
  sourceId: string;
  /** Short, human-readable reason. Rendered as-is; keep it factual. */
  note?: string;
}

export interface GraphNode {
  id: string;
  organizationId: string;
  /** Absent on organization-level nodes. */
  projectId: string | null;
  kind: GraphNodeKind;
  /** The table this node projects from. */
  canonicalEntityType: string;
  canonicalEntityId: string;
  label: string;
  /** The record's own description. Null when the row has none — never invented. */
  description: string | null;
  status: string | null;
  health: GraphHealth;
  /**
   * 0–1, computed from graph position and canonical criticality flags. Never
   * hand-authored.
   */
  criticality: number;
  metrics: Record<string, number | string | null>;
  provenance: GraphProvenance;
  confidence: number;
  evidenceRefs: GraphEvidenceRef[];
  validFrom: string | null;
  validTo: string | null;
  updatedAt: string | null;
}

export interface GraphEdge {
  id: string;
  organizationId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: GraphEdgeType;
  direction: GraphEdgeDirection;
  /** Relative strength; used for layout and centrality, never for money. */
  weight: number;
  status: string | null;
  provenance: GraphProvenance;
  confidence: number;
  evidenceRefs: GraphEvidenceRef[];
  validFrom: string | null;
  validTo: string | null;
  updatedAt: string | null;
}

/** Saved presentation state. Never operational truth — see CAP-048 §4. */
export interface GraphView {
  id: string;
  organizationId: string;
  ownerUserId: string | null;
  name: string;
  positions: Record<string, { x: number; y: number }>;
  pinnedNodeIds: string[];
  expandedNodeIds: string[];
  filters: GraphFilters;
  viewport: { x: number; y: number; zoom: number } | null;
  layout: GraphLayoutMode;
  version: number;
  updatedAt: string | null;
}

export type GraphLayoutMode = "hierarchical" | "radial" | "clustered";

export interface GraphFilters {
  projectIds: string[];
  nodeKinds: GraphNodeKind[];
  edgeTypes: GraphEdgeType[];
  /** Free-text search over node labels. */
  search: string;
  /** Hide edges below this confidence. */
  minConfidence: number;
}

/** Semantic zoom. Which kinds are legible depends on how far out you are. */
export type GraphZoomLevel = "far" | "mid" | "near";

export const ZOOM_LEVEL_KINDS: Record<GraphZoomLevel, readonly GraphNodeKind[]> = {
  far: ["organization", "project"],
  mid: ["organization", "project", "milestone", "risk", "resource", "kpi"],
  near: GRAPH_NODE_KINDS,
};

/**
 * The whole payload the canvas renders. `truncated` is explicit so the UI can
 * say "showing N of M" instead of quietly lying about completeness.
 */
export interface GraphProjection {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  totalNodeCount: number;
}

/**
 * Distinguishes "there is genuinely nothing" from "we could not read it".
 * Rule 14: never invent a value; say the data is unavailable.
 */
export type GraphDataState = "ok" | "empty" | "unavailable";
