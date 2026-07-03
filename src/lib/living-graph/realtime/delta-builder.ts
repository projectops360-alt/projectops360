// ============================================================================
// ProjectOps360° — LGRE · Hierarchy-Safe Delta Builder (Phase 4, Task 4)
// ============================================================================
// Pure, deterministic conversion of a Task 3 LivingGraphRecalculationResult
// into a hierarchy-safe HierarchicalGraphDelta the future UI can consume. It
// classifies every changed node/edge KIND, assigns a VISIBILITY policy (so
// evidence/events are never default-visible), and carries HIERARCHY refs
// (parent/milestone/task) so the UI narrows correctly without guessing.
//
// It NEVER fabricates nodes/edges (only what the recalc result changed), never
// mutates its inputs, and produces no UI. Node kinds come from explicit payload
// hints first, then the sanctioned id conventions (milestone:/task:/subtask:/
// event:/evidence:/dependency:). Edge kinds separate hierarchy (subtask_of)
// from dependency (caused/…) from evidence from milestone_flow.
// ============================================================================

import { LGRE_ENGINE_VERSION, LGRE_CONFIG_VERSION } from "./constants";
import type {
  LivingGraphNodeKind,
  LivingGraphEdgeKind,
  LivingGraphVisibilityPolicy,
  LivingGraphLayerKind,
  LivingGraphRootScope,
  HierarchicalGraphDelta,
  HierarchicalGraphDeltaScope,
  HierarchyNodeDelta,
  HierarchyEdgeDelta,
} from "./delta-types";
import type {
  LivingGraphRecalculationResult,
  LivingGraphChangedEntity,
} from "./recalculation-types";

// ── Node kind classification ──────────────────────────────────────────────────

function payloadString(payload: Readonly<Record<string, unknown>> | null, key: string): string | null {
  const v = payload?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
function payloadBool(payload: Readonly<Record<string, unknown>> | null, key: string): boolean {
  return payload?.[key] === true;
}
function payloadNumber(payload: Readonly<Record<string, unknown>> | null, key: string): number | null {
  const v = payload?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const ID_PREFIX_KIND: Record<string, LivingGraphNodeKind> = {
  project: "project",
  milestone: "milestone",
  phase: "phase",
  task: "task",
  subtask: "subtask",
  event: "event",
  evidence: "evidence",
  risk: "risk",
  decision: "decision",
  approval: "approval",
  dependency: "dependency",
};

/**
 * Classify a node's kind. Explicit payload hints win (`nodeKind`, then the
 * subtask layer's `is_subtask`), then the sanctioned id conventions
 * (`subtask:{id}`, `task:{id}`, `cluster:roadmap_tasks:{id}`, …). Pure.
 */
export function classifyGraphNodeKind(
  nodeId: string,
  payload: Readonly<Record<string, unknown>> | null = null,
): LivingGraphNodeKind {
  const explicit = payloadString(payload, "nodeKind");
  if (explicit && explicit in ID_PREFIX_KIND) return ID_PREFIX_KIND[explicit];
  if (payloadBool(payload, "is_subtask")) return "subtask";

  const prefix = nodeId.split(":", 1)[0];
  if (prefix in ID_PREFIX_KIND) return ID_PREFIX_KIND[prefix];
  // Living Graph cluster ids: `cluster:{sourceEntityType}:{id}`.
  if (prefix === "cluster") {
    const src = nodeId.split(":")[1];
    if (src === "roadmap_tasks") return "task";
    if (src === "milestones") return "milestone";
    if (src === "task_subtasks") return "subtask";
    if (src === "risks") return "risk";
    if (src === "decisions") return "decision";
  }
  // A synthetic subtask node id from the subtask layer.
  if (nodeId.startsWith("subtask-node:")) return "subtask";
  return "unknown";
}

// ── Edge kind classification ──────────────────────────────────────────────────

const HIERARCHY_EDGE_TYPES = new Set(["subtask_of"]);
const EVIDENCE_EDGE_TYPES = new Set(["informed", "generated_insight", "affects"]);
const MILESTONE_FLOW_EDGE_TYPES = new Set(["milestone_chain", "enabled"]);
const DEPENDENCY_EDGE_TYPES = new Set(["caused", "blocked", "delayed", "accelerated"]);

/**
 * Classify an edge's kind. Explicit payload `edgeKind`/`edgeType` wins, then id
 * conventions, then the source→target node kinds (a milestone→task or
 * task→subtask link is hierarchy). Hierarchy stays DISTINCT from dependency and
 * evidence. Pure.
 */
export function classifyGraphEdgeKind(
  edgeId: string,
  payload: Readonly<Record<string, unknown>> | null,
  sourceKind: LivingGraphNodeKind | null,
  targetKind: LivingGraphNodeKind | null,
): LivingGraphEdgeKind {
  const explicitKind = payloadString(payload, "edgeKind");
  if (explicitKind === "hierarchy" || explicitKind === "dependency" || explicitKind === "evidence" || explicitKind === "milestone_flow") {
    return explicitKind;
  }
  if (payloadBool(payload, "hierarchy")) return "hierarchy";

  const edgeType = payloadString(payload, "edgeType") ?? edgeId.split(":", 1)[0];
  if (HIERARCHY_EDGE_TYPES.has(edgeType) || edgeId.startsWith("subtask-edge:")) return "hierarchy";
  if (EVIDENCE_EDGE_TYPES.has(edgeType)) return "evidence";
  if (MILESTONE_FLOW_EDGE_TYPES.has(edgeType)) return "milestone_flow";
  if (DEPENDENCY_EDGE_TYPES.has(edgeType)) return "dependency";

  // Fall back to the endpoints: a parent→child kind pairing is hierarchy.
  if (
    (sourceKind === "milestone" && targetKind === "task") ||
    (sourceKind === "task" && targetKind === "subtask") ||
    (sourceKind === "subtask" && targetKind === "subtask")
  ) {
    return "hierarchy";
  }
  if (targetKind === "evidence" || targetKind === "event") return "evidence";
  return "unknown";
}

// ── Visibility policy ─────────────────────────────────────────────────────────

/**
 * The default visibility for a node kind. Milestones/tasks are default-visible;
 * subtasks appear on parent expansion; evidence/events ONLY in the evidence
 * overlay — never default-visible. Pure.
 */
export function resolveNodeVisibility(
  kind: LivingGraphNodeKind,
  opts: { evidenceLayerIncluded: boolean; isChildSubtask?: boolean } = { evidenceLayerIncluded: false },
): LivingGraphVisibilityPolicy {
  switch (kind) {
    case "project":
    case "milestone":
    case "phase":
    case "task":
      return "default_visible";
    case "subtask":
      return opts.isChildSubtask ? "visible_when_branch_expanded" : "visible_when_parent_expanded";
    case "evidence":
    case "event":
      return "visible_in_evidence_overlay";
    case "risk":
    case "decision":
    case "approval":
    case "dependency":
      return "visible_in_inspector_only";
    default:
      return "visible_in_inspector_only";
  }
}

function resolveEdgeVisibility(kind: LivingGraphEdgeKind): LivingGraphVisibilityPolicy {
  if (kind === "hierarchy" || kind === "milestone_flow") return "default_visible";
  if (kind === "evidence") return "visible_in_evidence_overlay";
  if (kind === "dependency") return "visible_when_parent_expanded";
  return "visible_in_inspector_only";
}

function layerOfNode(kind: LivingGraphNodeKind): LivingGraphLayerKind {
  if (kind === "evidence" || kind === "event") return "evidence";
  if (kind === "dependency") return "dependency";
  return "hierarchy";
}
function layerOfEdge(kind: LivingGraphEdgeKind): LivingGraphLayerKind {
  if (kind === "evidence") return "evidence";
  if (kind === "dependency") return "dependency";
  if (kind === "milestone_flow") return "milestone_flow";
  return "hierarchy";
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildHierarchicalDeltaInput {
  recalcResult: LivingGraphRecalculationResult;
  rootScope: LivingGraphRootScope;
  producedVersion: number;
  basedOnVersion: number;
  evidenceLayerIncluded: boolean;
  deltaId: string;
  now: () => Date;
}

function toNodeDelta(
  entity: LivingGraphChangedEntity,
  projectId: string,
  organizationId: string,
  evidenceLayerIncluded: boolean,
  version: number,
  updatedAt: string,
): HierarchyNodeDelta {
  const kind = classifyGraphNodeKind(entity.id, entity.payload);
  const parentId = payloadString(entity.payload, "parent_node_id") ?? payloadString(entity.payload, "parent_task_id");
  const taskId =
    kind === "subtask" ? payloadString(entity.payload, "parent_task_id") : kind === "task" ? entity.id : null;
  const milestoneId = payloadString(entity.payload, "milestone_id") ?? payloadString(entity.payload, "milestoneId");
  const parentKind = parentId ? classifyGraphNodeKind(parentId) : null;
  const isChildSubtask = kind === "subtask" && parentKind === "subtask";
  const hierarchyPath = parentId ? [parentId, entity.id] : [entity.id];
  // Evidence is available when explicitly flagged, or when the node clusters
  // more than one underlying process event (events behind this activity).
  const evidenceAvailable =
    payloadBool(entity.payload, "evidenceAvailable") ||
    (payloadNumber(entity.payload, "clusterSize") ?? 0) > 1;

  return {
    nodeId: entity.id,
    nodeKind: kind,
    change: entity.change,
    projectId,
    organizationId,
    parentId,
    parentKind,
    milestoneId,
    taskId,
    hierarchyPath,
    visibility:
      entity.change === "removed"
        ? "hidden_out_of_scope"
        : resolveNodeVisibility(kind, { evidenceLayerIncluded, isChildSubtask }),
    evidenceAvailable,
    directChildCount: payloadNumber(entity.payload, "subtask_total"),
    hasDescendants:
      payloadNumber(entity.payload, "subtask_total") != null
        ? (payloadNumber(entity.payload, "subtask_total") ?? 0) > 0
        : null,
    payload: entity.change === "removed" ? null : entity.payload,
    version,
    updatedAt,
  };
}

function toEdgeDelta(
  entity: LivingGraphChangedEntity,
  projectId: string,
  organizationId: string,
  version: number,
  updatedAt: string,
): HierarchyEdgeDelta {
  const source = payloadString(entity.payload, "sourceNodeId") ?? payloadString(entity.payload, "source");
  const target = payloadString(entity.payload, "targetNodeId") ?? payloadString(entity.payload, "target");
  const sourceKind = source ? classifyGraphNodeKind(source) : null;
  const targetKind = target ? classifyGraphNodeKind(target) : null;
  const kind = classifyGraphEdgeKind(entity.id, entity.payload, sourceKind, targetKind);
  return {
    edgeId: entity.id,
    edgeKind: kind,
    change: entity.change,
    sourceNodeId: source ?? "",
    targetNodeId: target ?? "",
    sourceKind,
    targetKind,
    projectId,
    organizationId,
    visibility: entity.change === "removed" ? "hidden_out_of_scope" : resolveEdgeVisibility(kind),
    payload: entity.change === "removed" ? null : entity.payload,
    version,
    updatedAt,
  };
}

/**
 * Build the hierarchy-safe delta from a recalculation result. Pure: it never
 * mutates the result, never fabricates entities, and emits a valid EMPTY delta
 * when the recalc changed nothing (isEmpty=true, observable).
 */
export function buildHierarchicalDelta(input: BuildHierarchicalDeltaInput): HierarchicalGraphDelta {
  const { recalcResult, producedVersion, basedOnVersion, evidenceLayerIncluded } = input;
  const { projectId, organizationId } = recalcResult.scope;
  const updatedAt = input.now().toISOString();

  const nodeDeltas = recalcResult.nodeChanges.map((e) =>
    toNodeDelta(e, projectId, organizationId, evidenceLayerIncluded, producedVersion, updatedAt),
  );
  const edgeDeltas = recalcResult.edgeChanges.map((e) =>
    toEdgeDelta(e, projectId, organizationId, producedVersion, updatedAt),
  );

  // Scope aggregation — what a consumer needs to decide relevance.
  const affectedMilestoneIds = new Set<string>();
  const affectedTaskIds = new Set<string>();
  const affectedSubtaskIds = new Set<string>();
  const affectedLayerKinds = new Set<LivingGraphLayerKind>();
  for (const n of nodeDeltas) {
    affectedLayerKinds.add(layerOfNode(n.nodeKind));
    if (n.milestoneId) affectedMilestoneIds.add(n.milestoneId);
    if (n.nodeKind === "milestone") affectedMilestoneIds.add(n.nodeId);
    if (n.nodeKind === "task") affectedTaskIds.add(n.nodeId);
    if (n.taskId) affectedTaskIds.add(n.taskId);
    if (n.nodeKind === "subtask") affectedSubtaskIds.add(n.nodeId);
  }
  for (const e of edgeDeltas) affectedLayerKinds.add(layerOfEdge(e.edgeKind));

  const scope: HierarchicalGraphDeltaScope = {
    projectId,
    organizationId,
    rootScopeType: input.rootScope.type,
    rootScopeId: input.rootScope.id,
    affectedMilestoneIds: [...affectedMilestoneIds].sort(),
    affectedTaskIds: [...affectedTaskIds].sort(),
    affectedSubtaskIds: [...affectedSubtaskIds].sort(),
    affectedLayerKinds: [...affectedLayerKinds].sort(),
    evidenceLayerIncluded,
    hierarchyDepth: nodeDeltas.length > 0 ? Math.max(...nodeDeltas.map((n) => n.hierarchyPath.length)) : null,
  };

  return {
    deltaId: input.deltaId,
    scope,
    basedOnVersion,
    producedVersion,
    isEmpty: nodeDeltas.length === 0 && edgeDeltas.length === 0,
    nodeDeltas,
    edgeDeltas,
    reasons: [...recalcResult.reasons],
    warnings: [...recalcResult.warnings],
    generatedAt: updatedAt,
    engineVersion: LGRE_ENGINE_VERSION,
    configVersion: LGRE_CONFIG_VERSION,
  };
}
