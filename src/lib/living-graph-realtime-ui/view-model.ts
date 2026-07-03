// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · View Model (pure)
// ============================================================================
// The client-side view model the high-fidelity realtime Living Graph renders.
// It is a PURE CONSUMER of the Task 4 hierarchy-safe delta/sync contract — it
// never queries project_event_log, never subscribes to Supabase directly,
// never recalculates graph truth, and never fabricates nodes/edges. Node/edge
// KIND, VISIBILITY policy, and HIERARCHY refs come verbatim from the approved
// delta payloads (Task 4); the UI only accumulates and displays them.
// ============================================================================

import type {
  LivingGraphNodeKind,
  LivingGraphEdgeKind,
  LivingGraphVisibilityPolicy,
} from "@/lib/living-graph/realtime";

/** Realtime change state a node/edge carries so the UI can pulse/fade it. */
export type RealtimeChangeState = "added" | "updated" | "removed" | "stable";

/** A node in the accumulated realtime view model (from a HierarchyNodeDelta). */
export interface RealtimeGraphNode {
  nodeId: string;
  nodeKind: LivingGraphNodeKind;
  visibility: LivingGraphVisibilityPolicy;
  parentId: string | null;
  parentKind: LivingGraphNodeKind | null;
  milestoneId: string | null;
  taskId: string | null;
  hierarchyPath: readonly string[];
  evidenceAvailable: boolean;
  directChildCount: number | null;
  hasDescendants: boolean | null;
  /** Verbatim engine display payload (title/status/owner/… — never recomputed). */
  payload: Readonly<Record<string, unknown>>;
  changeState: RealtimeChangeState;
  /** The delta version that last changed this node (drives the pulse decay). */
  changedAtVersion: number;
  updatedAt: string;
}

export interface RealtimeGraphEdge {
  edgeId: string;
  edgeKind: LivingGraphEdgeKind;
  sourceNodeId: string;
  targetNodeId: string;
  sourceKind: LivingGraphNodeKind | null;
  targetKind: LivingGraphNodeKind | null;
  visibility: LivingGraphVisibilityPolicy;
  payload: Readonly<Record<string, unknown>>;
  changeState: RealtimeChangeState;
  changedAtVersion: number;
  updatedAt: string;
}

/**
 * The accumulated view model. Immutable-by-convention: the snapshot adapter
 * returns a NEW model on each delta. Keyed records for O(1) upsert/remove.
 */
export interface RealtimeGraphViewModel {
  projectId: string;
  organizationId: string;
  version: number;
  nodes: Readonly<Record<string, RealtimeGraphNode>>;
  edges: Readonly<Record<string, RealtimeGraphEdge>>;
}

export function emptyViewModel(projectId: string, organizationId: string): RealtimeGraphViewModel {
  return { projectId, organizationId, version: 0, nodes: {}, edges: {} };
}

// ── Display helpers (pure; read verbatim payload, never recompute) ────────────

export function nodeTitle(node: RealtimeGraphNode): string {
  const p = node.payload;
  const t = p.title ?? p.label ?? p.name;
  return typeof t === "string" && t.length > 0 ? t : node.nodeId;
}

export function nodeStatus(node: RealtimeGraphNode): string | null {
  const s = node.payload.status;
  return typeof s === "string" ? s : null;
}

export function nodeProgress(node: RealtimeGraphNode): number | null {
  const v = node.payload.progress;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
}

export function nodeOwnerName(node: RealtimeGraphNode, ownerNames: Readonly<Record<string, string>>): string | null {
  const ownerId = node.payload.owner_id ?? node.payload.ownerId ?? node.payload.assigned_to;
  if (typeof ownerId !== "string" || !ownerId) return null;
  return ownerNames[ownerId] ?? null;
}

export function nodeIsBlocked(node: RealtimeGraphNode): boolean {
  return node.payload.isBlocked === true || node.payload.is_blocked === true || nodeStatus(node) === "blocked";
}
