// ============================================================================
// ProjectOps360° — LGRE · Incremental Recalculation Types (Phase 4, Task 3)
// ============================================================================
// Additive-only extension of the Task 1/2 type model: the read-only snapshot
// index the attribution planner matches invalidation tags against, the pure
// node/edge entity records the diff operates on, and the deterministic
// recalculation result (added/updated/removed entities with evidence refs).
//
// The recalculation service is ORCHESTRATION + DIFF only: the caller recomputes
// the affected subgraph with the EXISTING deterministic engines and hands the
// verbatim output in; the service never derives status, counts, or health, and
// never touches canonical truth. Constitution §9.
// ============================================================================

import type {
  LGRE_RECALC_MODES,
  LGRE_ENTITY_CHANGE_KINDS,
  LGRE_CONFIDENCE_LEVELS,
} from "./constants";
import type {
  LivingGraphRealtimeProjectScope,
  LivingGraphRealtimeAccessContext,
  LivingGraphRealtimeEngineVersion,
  LivingGraphRealtimeConfigVersion,
  LivingGraphRecalcReason,
  LivingGraphChangeNotice,
  GraphRecalculationPlan,
} from "./types";
import type { LivingGraphRealtimeConfig } from "./contracts";

// ── Derived union types (single source of truth: constants.ts) ────────────────

export type LivingGraphRecalculationMode = (typeof LGRE_RECALC_MODES)[number];
export type LivingGraphEntityChangeKind = (typeof LGRE_ENTITY_CHANGE_KINDS)[number];
export type LivingGraphRecalculationConfidence = (typeof LGRE_CONFIDENCE_LEVELS)[number];

// ── Snapshot index (read-only; built by the caller from the current snapshot) ─

/**
 * What the attribution planner matches change notices against. `subjectRefs`
 * are canonical-entity references in the same grammar as the deterministic
 * invalidation tags (`task:{id}`, `milestone:{id}`, `risk:{id}`, …): every
 * canonical subject a node/edge was derived FROM. The index carries identity
 * only — no status, no counts, no layout.
 */
export interface LivingGraphSnapshotIndexNode {
  nodeId: string;
  subjectRefs: readonly string[];
}

export interface LivingGraphSnapshotIndexEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  subjectRefs: readonly string[];
}

export interface LivingGraphSnapshotIndex {
  scope: LivingGraphRealtimeProjectScope;
  snapshotVersion: number;
  nodes: readonly LivingGraphSnapshotIndexNode[];
  edges: readonly LivingGraphSnapshotIndexEdge[];
}

// ── Pure graph entity records (verbatim engine output; never derived here) ────

export interface LivingGraphNodeRecord {
  nodeId: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface LivingGraphEdgeRecord {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface LivingGraphEntitySet {
  nodes: readonly LivingGraphNodeRecord[];
  edges: readonly LivingGraphEdgeRecord[];
}

// ── Attribution detail (plan + evidence of WHY each entity is affected) ───────

export interface LivingGraphAttributionDetail {
  plan: GraphRecalculationPlan;
  /** nodeId → notice ids that made it affected (evidence chain). */
  nodeSources: Readonly<Record<string, readonly string[]>>;
  /** edgeId → notice ids that made it affected. */
  edgeSources: Readonly<Record<string, readonly string[]>>;
  /** noticeId → underlying PEG event id (null for non-event notices). */
  noticeEventIds: Readonly<Record<string, string | null>>;
  /** Nodes added by downstream schedule propagation (subset of affected). */
  propagatedNodeIds: readonly string[];
}

// ── Recalculation result ──────────────────────────────────────────────────────

/** One changed graph entity with its evidence/source refs (where available). */
export interface LivingGraphChangedEntity {
  id: string;
  change: LivingGraphEntityChangeKind;
  /** Verbatim recomputed engine payload; null for removals. */
  payload: Readonly<Record<string, unknown>> | null;
  /** Change notices that attributed this entity (may be empty on full rebuilds). */
  sourceNoticeIds: readonly string[];
  /** Underlying project_event_log event ids (evidence; may be empty). */
  sourceEventIds: readonly string[];
}

export interface LivingGraphRecalculationResult {
  resultId: string;
  scope: LivingGraphRealtimeProjectScope;
  mode: LivingGraphRecalculationMode;
  /** The snapshot version the diff was computed against; null when unknown. */
  basedOnSnapshotVersion: number | null;
  affectedNodeIds: readonly string[];
  affectedEdgeIds: readonly string[];
  nodeChanges: readonly LivingGraphChangedEntity[];
  edgeChanges: readonly LivingGraphChangedEntity[];
  reasons: readonly LivingGraphRecalcReason[];
  /** Provenance-derived (weakest supporting notice wins); unknown when none. */
  confidence: LivingGraphRecalculationConfidence;
  warnings: readonly string[];
  engineVersion: LivingGraphRealtimeEngineVersion;
  configVersion: LivingGraphRealtimeConfigVersion;
  generatedAt: string;
}

// ── Service request/output ────────────────────────────────────────────────────

/**
 * The caller-provided recompute step: run the EXISTING deterministic engines
 * for the plan's affected scope (or the full scope on fallback) and return
 * their verbatim output. The service never computes graph content itself.
 */
export type LivingGraphRecomputeFn = (plan: GraphRecalculationPlan) => LivingGraphEntitySet;

export interface LivingGraphRecalculationRequest {
  scope: LivingGraphRealtimeProjectScope;
  access: LivingGraphRealtimeAccessContext;
  config: LivingGraphRealtimeConfig;
  /** Read-only change notices (Task 2 subscription output; never mutated). */
  notices: readonly LivingGraphChangeNotice[];
  /** Attribution index from the current snapshot; null ⇒ safe full fallback. */
  snapshotIndex: LivingGraphSnapshotIndex | null;
  /** The previously materialized entities; null ⇒ everything recomputed is added. */
  previous: LivingGraphEntitySet | null;
  recompute: LivingGraphRecomputeFn;
}

export interface LivingGraphRecalculationServiceCounts {
  noticesAccepted: number;
  noticesRejected: number;
  attributedNodeCount: number;
  attributedEdgeCount: number;
  propagatedNodeCount: number;
  changedNodeCount: number;
  changedEdgeCount: number;
  usedFullRebuildFallback: boolean;
}

export interface LivingGraphRecalculationOutput {
  plan: GraphRecalculationPlan;
  result: LivingGraphRecalculationResult;
  counts: LivingGraphRecalculationServiceCounts;
}
