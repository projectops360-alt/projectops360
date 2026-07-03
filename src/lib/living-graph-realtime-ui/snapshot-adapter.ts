// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Snapshot / Delta Adapter (pure)
// ============================================================================
// Applies Task 4 HierarchicalGraphDeltas to the client view model. Pure +
// immutable: each apply returns a NEW view model. It NEVER fabricates entities
// (only what the delta changed), NEVER reclassifies kinds/visibility (verbatim
// from the delta), and NEVER recalculates graph truth. Replay-safe: a delta
// whose basedOnVersion doesn't match the model is rejected (the caller must
// full_resync — mirrors the Task 4 sync contract).
// ============================================================================

import type {
  HierarchicalGraphDelta,
  HierarchyNodeDelta,
  HierarchyEdgeDelta,
} from "@/lib/living-graph/realtime";
import type {
  RealtimeGraphViewModel,
  RealtimeGraphNode,
  RealtimeGraphEdge,
} from "./view-model";

function toNode(d: HierarchyNodeDelta): RealtimeGraphNode {
  return {
    nodeId: d.nodeId,
    nodeKind: d.nodeKind,
    visibility: d.visibility,
    parentId: d.parentId,
    parentKind: d.parentKind,
    milestoneId: d.milestoneId,
    taskId: d.taskId,
    hierarchyPath: d.hierarchyPath,
    evidenceAvailable: d.evidenceAvailable,
    directChildCount: d.directChildCount,
    hasDescendants: d.hasDescendants,
    payload: d.payload ?? {},
    changeState: d.change === "removed" ? "removed" : d.change,
    changedAtVersion: d.version,
    updatedAt: d.updatedAt,
  };
}

function toEdge(d: HierarchyEdgeDelta): RealtimeGraphEdge {
  return {
    edgeId: d.edgeId,
    edgeKind: d.edgeKind,
    sourceNodeId: d.sourceNodeId,
    targetNodeId: d.targetNodeId,
    sourceKind: d.sourceKind,
    targetKind: d.targetKind,
    visibility: d.visibility,
    payload: d.payload ?? {},
    changeState: d.change === "removed" ? "removed" : d.change,
    changedAtVersion: d.version,
    updatedAt: d.updatedAt,
  };
}

export interface ApplyDeltaResult {
  model: RealtimeGraphViewModel;
  /** True when the delta was applied; false when rejected (base mismatch). */
  applied: boolean;
  /** Set when applied=false so the caller can request a full resync. */
  rejectedReason: "base_version_mismatch" | "wrong_scope" | null;
}

/**
 * Apply one hierarchy-safe delta. Rejects (without mutating) when the delta's
 * basedOnVersion doesn't match the model version, or the scope doesn't match —
 * the caller then requests a full_resync (never an unsafe partial merge).
 */
export function applyDelta(
  model: RealtimeGraphViewModel,
  delta: HierarchicalGraphDelta,
): ApplyDeltaResult {
  if (delta.scope.projectId !== model.projectId || delta.scope.organizationId !== model.organizationId) {
    return { model, applied: false, rejectedReason: "wrong_scope" };
  }
  if (delta.basedOnVersion !== model.version) {
    return { model, applied: false, rejectedReason: "base_version_mismatch" };
  }
  if (delta.isEmpty) {
    // Valid, observable no-op — only the version advances.
    return { model: { ...model, version: delta.producedVersion }, applied: true, rejectedReason: null };
  }

  const nodes = { ...model.nodes };
  const edges = { ...model.edges };
  for (const nd of delta.nodeDeltas) {
    if (nd.change === "removed") delete nodes[nd.nodeId];
    else nodes[nd.nodeId] = toNode(nd);
  }
  for (const ed of delta.edgeDeltas) {
    if (ed.change === "removed") delete edges[ed.edgeId];
    else edges[ed.edgeId] = toEdge(ed);
  }
  return {
    model: { ...model, version: delta.producedVersion, nodes, edges },
    applied: true,
    rejectedReason: null,
  };
}

/**
 * Build a fresh view model from a full-resync sequence of deltas (an ordered
 * rebuild). Applies each in order starting from an empty model; a base
 * mismatch stops the rebuild (the caller keeps the last consistent model).
 */
export function rebuildFromDeltas(
  projectId: string,
  organizationId: string,
  orderedDeltas: readonly HierarchicalGraphDelta[],
): RealtimeGraphViewModel {
  let model: RealtimeGraphViewModel = { projectId, organizationId, version: 0, nodes: {}, edges: {} };
  for (const d of orderedDeltas) {
    const res = applyDelta(model, d);
    if (!res.applied) break;
    model = res.model;
  }
  return model;
}

/** Decay stale change markers to "stable" once past the pulse window (pure). */
export function decayChangeStates(
  model: RealtimeGraphViewModel,
  pulseWindowVersions: number,
): RealtimeGraphViewModel {
  const cutoff = model.version - pulseWindowVersions;
  const decay = <T extends { changeState: string; changedAtVersion: number }>(rec: Readonly<Record<string, T>>) => {
    let changed = false;
    const out: Record<string, T> = {};
    for (const [id, item] of Object.entries(rec)) {
      if (item.changeState !== "stable" && item.changedAtVersion <= cutoff) {
        out[id] = { ...item, changeState: "stable" };
        changed = true;
      } else {
        out[id] = item;
      }
    }
    return { out, changed };
  };
  const n = decay(model.nodes);
  const e = decay(model.edges);
  if (!n.changed && !e.changed) return model;
  return { ...model, nodes: n.out, edges: e.out };
}
