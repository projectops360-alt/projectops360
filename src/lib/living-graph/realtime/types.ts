// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Types (Phase 4, Task 1)
// ============================================================================
// The full type model of the LGRE: scope + access, read-only change notices,
// subscriptions, recalculation plans, snapshot descriptors, deltas, sync
// decisions, the realtime UI consumer state, and observability tick summaries.
//
// The LGRE owns NO canonical truth and derives NO domain intelligence. Node
// status, edge evidence, counts, capacity, and milestone-flow content are
// produced by the existing deterministic engines; the LGRE only describes
// WHEN to recompute and WHAT changed between two snapshot versions.
// ============================================================================

import type {
  LGRE_CHANGE_SOURCES,
  LGRE_SUBSCRIPTION_TOPICS,
  LGRE_RECALC_TARGETS,
  LGRE_RECALC_REASONS,
  LGRE_DELTA_OPERATIONS,
  LGRE_SYNC_INSTRUCTIONS,
  LGRE_CONNECTION_STATES,
  LGRE_FALLBACK_MODES,
  LGRE_FRESHNESS_STATES,
  LGRE_ACCESS_SCOPES,
  LGRE_ERROR_CODES,
  LGRE_ENGINE_VERSION,
  LGRE_CONFIG_VERSION,
} from "./constants";

// ── Derived union types (single source of truth: constants.ts) ────────────────

export type LivingGraphRealtimeChangeSource = (typeof LGRE_CHANGE_SOURCES)[number];
export type LivingGraphRealtimeTopic = (typeof LGRE_SUBSCRIPTION_TOPICS)[number];
export type LivingGraphRecalcTarget = (typeof LGRE_RECALC_TARGETS)[number];
export type LivingGraphRecalcReason = (typeof LGRE_RECALC_REASONS)[number];
export type LivingGraphDeltaOperationKind = (typeof LGRE_DELTA_OPERATIONS)[number];
export type LivingGraphSyncInstruction = (typeof LGRE_SYNC_INSTRUCTIONS)[number];
export type LivingGraphRealtimeConnectionState = (typeof LGRE_CONNECTION_STATES)[number];
export type LivingGraphRealtimeFallbackMode = (typeof LGRE_FALLBACK_MODES)[number];
export type LivingGraphRealtimeFreshness = (typeof LGRE_FRESHNESS_STATES)[number];
export type LivingGraphRealtimeAccessScope = (typeof LGRE_ACCESS_SCOPES)[number];
export type LivingGraphRealtimeErrorCode = (typeof LGRE_ERROR_CODES)[number];
export type LivingGraphRealtimeEngineVersion = typeof LGRE_ENGINE_VERSION;
export type LivingGraphRealtimeConfigVersion = typeof LGRE_CONFIG_VERSION;

// ── Scope + access ────────────────────────────────────────────────────────────

/** The scope a realtime consumer operates against. */
export interface LivingGraphRealtimeScope {
  organizationId: string;
  /** Required for project-level realtime; absent only for future PMO/portfolio aggregates. */
  projectId?: string;
  portfolioId?: string;
}

/** Project-level scope (the only scope Phase 4 serves; portfolio is the extension path). */
export interface LivingGraphRealtimeProjectScope extends LivingGraphRealtimeScope {
  projectId: string;
}

export interface LivingGraphRealtimeAccessContext {
  userId: string;
  organizationId: string;
  scope: LivingGraphRealtimeAccessScope;
  /** The projects this caller may receive realtime data for. Deny-by-default. */
  authorizedProjectIds: readonly string[];
}

export interface LivingGraphRealtimeAccessDecision {
  allowed: boolean;
  /** Machine-readable reason (auditable; never leaks other tenants' data). */
  reason: string;
}

// ── Change notices (READ-ONLY input; the LGRE never produces these) ───────────

/**
 * A read-only notice that approved upstream truth changed. When the source is
 * the Project Event Graph this is a projection of an APPENDED project_event_log
 * row (id, type, sequence, invalidation tags) — never the row itself and never
 * a write handle. The LGRE consumes notices; it never emits events.
 */
export interface LivingGraphChangeNotice {
  noticeId: string;
  source: LivingGraphRealtimeChangeSource;
  organizationId: string;
  projectId: string;
  /** project_event_log event id when source = project_event_graph; else null. */
  eventId: string | null;
  /** Canonical registered event type (registry.ts) when applicable; else null. */
  eventType: string | null;
  /** Per-project monotonic sequence when applicable (ordering + dedup); else null. */
  sequence: number | null;
  occurredAt: string; // ISO timestamp
  /** Deterministic projection-invalidation tags (generateProjectionInvalidationTags). */
  invalidationTags: readonly string[];
  /** Provenance lifecycle class of the underlying event, when applicable. */
  lifecycleClass: string | null;
  isCompensatingEvent: boolean;
}

// ── Subscription model (contract only in Task 1; runtime is Task 2) ───────────

export interface LivingGraphSubscriptionRequest {
  consumerId: string;
  scope: LivingGraphRealtimeProjectScope;
  topics: readonly LivingGraphRealtimeTopic[];
  access: LivingGraphRealtimeAccessContext;
}

export interface LivingGraphSubscriptionHandle {
  subscriptionId: string;
  consumerId: string;
  scope: LivingGraphRealtimeProjectScope;
  topics: readonly LivingGraphRealtimeTopic[];
  state: LivingGraphRealtimeConnectionState;
  createdAt: string;
}

// ── Graph recalculation model ─────────────────────────────────────────────────

/**
 * A plan describing WHICH parts of the graph view-model must be recomputed —
 * by the EXISTING deterministic engines at the call site — in response to a
 * coalesced batch of change notices. The plan carries no computed status, no
 * counts, no health: it is pure orchestration data.
 */
export interface GraphRecalculationPlan {
  planId: string;
  scope: LivingGraphRealtimeProjectScope;
  targets: readonly LivingGraphRecalcTarget[];
  /** Node/edge/overlay ids the plan can attribute the change to (may be empty). */
  affectedNodeIds: readonly string[];
  affectedEdgeIds: readonly string[];
  affectedOverlays: readonly string[];
  /** True when selective attribution is not possible — rebuild the whole scope. */
  fullRebuild: boolean;
  reasons: readonly LivingGraphRecalcReason[];
  /** How many notices were coalesced into this single plan. */
  coalescedNoticeCount: number;
  /** Notices rejected (wrong scope, malformed) — disclosed, never silently dropped. */
  rejectedNoticeCount: number;
  warnings: readonly string[];
  generatedAt: string;
}

// ── Snapshot + delta / sync contract ──────────────────────────────────────────

/**
 * Identity of one materialized graph projection for a scope. The version is
 * MONOTONIC per project scope; consumers compare versions, never timestamps.
 */
export interface LivingGraphSnapshotDescriptor {
  scope: LivingGraphRealtimeProjectScope;
  /** Monotonically increasing per scope. */
  snapshotVersion: number;
  generatedAt: string;
  /** Versions of the upstream engines whose output the snapshot contains. */
  upstreamEngineVersions: Readonly<Record<string, string>>;
  nodeCount: number;
  edgeCount: number;
}

/**
 * One data change inside a delta. The payload is produced by the upstream
 * deterministic engines and passed through verbatim — the LGRE never derives
 * status, counts, or health, and a payload NEVER contains layout/position
 * fields (saved layouts are presentation-only and client-owned, UX-007).
 */
export interface LivingGraphDeltaOperation {
  op: LivingGraphDeltaOperationKind;
  /** Node id, edge id, overlay key, or summary key the operation targets. */
  targetId: string;
  /** Verbatim engine output for upserts/patches; null for removals. */
  payload: Readonly<Record<string, unknown>> | null;
}

/**
 * The minimal change set that moves a consumer from basedOnVersion to
 * snapshotVersion. Applying a delta to any other base is invalid — the sync
 * decision must then be full_resync.
 */
export interface LivingGraphDelta {
  deltaId: string;
  scope: LivingGraphRealtimeProjectScope;
  basedOnVersion: number;
  snapshotVersion: number;
  operations: readonly LivingGraphDeltaOperation[];
  sourcePlanId: string | null;
  generatedAt: string;
}

export interface LivingGraphSyncDecision {
  instruction: LivingGraphSyncInstruction;
  /** Machine-readable reason (e.g. "base_matches", "base_version_diverged"). */
  reason: string;
}

// ── Realtime UI consumer contract (state model; UI itself is out of scope) ────

/**
 * The honest client-side state a realtime UI consumer must be able to expose.
 * Freshness is disclosed, never fabricated: no sync info ⇒ "unknown".
 */
export interface LivingGraphRealtimeClientState {
  connectionState: LivingGraphRealtimeConnectionState;
  fallbackMode: LivingGraphRealtimeFallbackMode;
  freshness: LivingGraphRealtimeFreshness;
  /** The snapshot version the client currently renders; null before first sync. */
  snapshotVersion: number | null;
  lastSyncedAt: string | null;
  pendingNoticeCount: number;
}

// ── Observability ─────────────────────────────────────────────────────────────

/** Immutable summary of one engine tick (a coalescing window / plan cycle). */
export interface LivingGraphRealtimeTickSummary {
  tickId: string;
  organizationId: string;
  projectId: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  noticesReceived: number;
  noticesCoalesced: number;
  noticesRejected: number;
  plansEmitted: number;
  deltasEmitted: number;
  fullResyncsRequested: number;
  warningCount: number;
  warnings: readonly string[];
  engineVersion: LivingGraphRealtimeEngineVersion;
  configVersion: LivingGraphRealtimeConfigVersion;
}
