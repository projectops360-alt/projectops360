// ============================================================================
// ProjectOps360° — LGRE · Delta Store & Sync Types (Phase 4, Task 4)
// ============================================================================
// The hierarchy-safe, replay-safe delta model a FUTURE UI consumes — never raw
// events, never raw recalculation internals. Each node/edge delta carries its
// KIND, VISIBILITY POLICY, and HIERARCHY refs so the UI narrows correctly
// (milestone → tasks → subtasks → child subtasks → evidence only when asked)
// without guessing. Presentation-delivery only: the store never owns canonical
// truth and never mutates project_event_log / process_nodes / process_edges.
// ============================================================================

import type {
  LGRE_NODE_KINDS,
  LGRE_EDGE_KINDS,
  LGRE_VISIBILITY_POLICIES,
  LGRE_ROOT_SCOPE_TYPES,
  LGRE_LAYER_KINDS,
  LGRE_SYNC_RESPONSE_KINDS,
} from "./constants";
import type {
  LivingGraphRealtimeProjectScope,
  LivingGraphRealtimeAccessContext,
  LivingGraphRealtimeEngineVersion,
  LivingGraphRealtimeConfigVersion,
} from "./types";
import type { LivingGraphEntityChangeKind } from "./recalculation-types";

// ── Derived union types (single source of truth: constants.ts) ────────────────

export type LivingGraphNodeKind = (typeof LGRE_NODE_KINDS)[number];
export type LivingGraphEdgeKind = (typeof LGRE_EDGE_KINDS)[number];
export type LivingGraphVisibilityPolicy = (typeof LGRE_VISIBILITY_POLICIES)[number];
export type LivingGraphRootScopeType = (typeof LGRE_ROOT_SCOPE_TYPES)[number];
export type LivingGraphLayerKind = (typeof LGRE_LAYER_KINDS)[number];
export type LivingGraphSyncResponseKind = (typeof LGRE_SYNC_RESPONSE_KINDS)[number];

// ── Root scope / delta scope ──────────────────────────────────────────────────

/** The narrowing context a delta batch is anchored to. */
export interface LivingGraphRootScope {
  type: LivingGraphRootScopeType;
  /** milestone id / task id / subtask id when the type is not "project". */
  id: string | null;
}

/**
 * Everything a consumer needs to answer "is this delta relevant to what I'm
 * looking at?" without inspecting node payloads.
 */
export interface HierarchicalGraphDeltaScope {
  projectId: string;
  organizationId: string;
  rootScopeType: LivingGraphRootScopeType;
  rootScopeId: string | null;
  affectedMilestoneIds: readonly string[];
  affectedTaskIds: readonly string[];
  affectedSubtaskIds: readonly string[];
  affectedLayerKinds: readonly LivingGraphLayerKind[];
  /** True only when an evidence overlay/mode is explicitly enabled. */
  evidenceLayerIncluded: boolean;
  /** How deep into the hierarchy this delta reaches, when known. */
  hierarchyDepth: number | null;
}

// ── Node / edge deltas (hierarchy-safe) ───────────────────────────────────────

export interface HierarchyNodeDelta {
  nodeId: string;
  nodeKind: LivingGraphNodeKind;
  change: LivingGraphEntityChangeKind;
  projectId: string;
  organizationId: string;
  /** Parent node id in the hierarchy (task for a subtask, milestone for a task). */
  parentId: string | null;
  parentKind: LivingGraphNodeKind | null;
  milestoneId: string | null;
  taskId: string | null;
  /** Ordered ancestor ids (root → this node) when derivable; else empty. */
  hierarchyPath: readonly string[];
  visibility: LivingGraphVisibilityPolicy;
  /** Whether this node has attached evidence/events (drives the overlay hint). */
  evidenceAvailable: boolean;
  /** Direct hierarchy children count, when known (expand affordance). */
  directChildCount: number | null;
  /** Whether deeper descendants exist (recursive expand availability). */
  hasDescendants: boolean | null;
  /** Verbatim recomputed engine payload for upserts; null for removals. */
  payload: Readonly<Record<string, unknown>> | null;
  version: number;
  updatedAt: string;
}

export interface HierarchyEdgeDelta {
  edgeId: string;
  edgeKind: LivingGraphEdgeKind;
  change: LivingGraphEntityChangeKind;
  sourceNodeId: string;
  targetNodeId: string;
  sourceKind: LivingGraphNodeKind | null;
  targetKind: LivingGraphNodeKind | null;
  projectId: string;
  organizationId: string;
  visibility: LivingGraphVisibilityPolicy;
  payload: Readonly<Record<string, unknown>> | null;
  version: number;
  updatedAt: string;
}

// ── The delivery payload ──────────────────────────────────────────────────────

/**
 * The replay-safe delta a consumer applies. `basedOnVersion` → `producedVersion`
 * define the exact transition; applying against any other base is invalid and
 * must resolve to full_resync. An empty delta (isEmpty) is valid + observable.
 */
export interface HierarchicalGraphDelta {
  deltaId: string;
  scope: HierarchicalGraphDeltaScope;
  basedOnVersion: number;
  producedVersion: number;
  isEmpty: boolean;
  nodeDeltas: readonly HierarchyNodeDelta[];
  edgeDeltas: readonly HierarchyEdgeDelta[];
  reasons: readonly string[];
  warnings: readonly string[];
  generatedAt: string;
  engineVersion: LivingGraphRealtimeEngineVersion;
  configVersion: LivingGraphRealtimeConfigVersion;
}

// ── Snapshot descriptor (Task 4 view — hierarchy-aware) ───────────────────────

export interface GraphSnapshotDescriptor {
  scope: LivingGraphRealtimeProjectScope;
  rootScope: LivingGraphRootScope;
  snapshotVersion: number;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  /** The oldest version still recoverable via missed-delta replay. */
  oldestRecoverableVersion: number;
  engineVersion: LivingGraphRealtimeEngineVersion;
  configVersion: LivingGraphRealtimeConfigVersion;
}

// ── Sync contract request / response ──────────────────────────────────────────

export interface GraphSyncRequest {
  access: LivingGraphRealtimeAccessContext;
  scope: LivingGraphRealtimeProjectScope;
  rootScope?: LivingGraphRootScope;
  /** The version the consumer currently holds; null = brand-new client. */
  sinceVersion: number | null;
}

export interface GraphSyncResponse {
  kind: LivingGraphSyncResponseKind;
  /** Machine-readable reason (auditable; never leaks another tenant's data). */
  reason: string;
  /** Ordered missed deltas when kind === "deltas". */
  deltas: readonly HierarchicalGraphDelta[];
  /** Present when kind === "full_resync" so the consumer can rebuild. */
  snapshot: GraphSnapshotDescriptor | null;
  /** The version the consumer will be at after applying the response. */
  targetVersion: number | null;
}

// ── Observability ─────────────────────────────────────────────────────────────

export interface DeltaStoreObservability {
  projectId: string;
  rootScopeType: LivingGraphRootScopeType;
  currentVersion: number;
  deltasCreated: number;
  nodesAdded: number;
  nodesChanged: number;
  nodesRemoved: number;
  edgesAdded: number;
  edgesChanged: number;
  edgesRemoved: number;
  emptyDeltas: number;
  duplicateDeltasIgnored: number;
  missedUpdateRecoveries: number;
  fullResyncDecisions: number;
  staleClients: number;
  freshClients: number;
  unauthorizedRequests: number;
  versionMismatches: number;
  evidenceLayerDeltas: number;
  hierarchyLayerDeltas: number;
  dependencyLayerDeltas: number;
  warnings: readonly string[];
}
