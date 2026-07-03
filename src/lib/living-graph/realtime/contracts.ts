// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Contracts (Phase 4, Task 1)
// ============================================================================
// The stable contract surface every future Phase 4 task and consumer depends
// on. These interfaces define WHAT the realtime engine accepts and emits; the
// runtime that fulfills them arrives in later Phase 4 tasks (Task 2: Event
// Subscription Layer). Consumers (Living Graph UI, Isabella freshness context,
// future PMO dashboards) MUST consume these outputs and MUST NOT re-derive
// change detection, recalculation planning, or sync logic.
//
// The LGRE is orchestration only: it never owns canonical truth, never derives
// domain intelligence (status/counts/health belong to the existing engines),
// never writes project_event_log, and never touches process_nodes/process_edges.
// ============================================================================

import type { LivingGraphSnapshotIndex } from "./recalculation-types";
import type {
  LivingGraphRealtimeEngineVersion,
  LivingGraphRealtimeConfigVersion,
  LivingGraphRealtimeScope,
  LivingGraphRealtimeProjectScope,
  LivingGraphRealtimeAccessContext,
  LivingGraphRealtimeAccessDecision,
  LivingGraphRealtimeTopic,
  LivingGraphChangeNotice,
  LivingGraphSubscriptionRequest,
  LivingGraphSubscriptionHandle,
  GraphRecalculationPlan,
  LivingGraphSnapshotDescriptor,
  LivingGraphDelta,
  LivingGraphSyncDecision,
  LivingGraphRealtimeConnectionState,
  LivingGraphRealtimeFallbackMode,
  LivingGraphRealtimeTickSummary,
} from "./types";

// ── Engine configuration (versioned; shapes engine behavior, never truth) ─────

export interface LivingGraphRealtimeConfig {
  configVersion: LivingGraphRealtimeConfigVersion;
  /** Coalesce notices inside this window before planning (ms). */
  coalescingWindowMs?: number;
  /** Above this many operations a delta becomes a full_resync instruction. */
  maxDeltaOperations?: number;
  /** A change should be visible to a live consumer within this budget (ms). */
  targetFreshnessMs?: number;
  /** Polling cadence when degraded to polling mode (ms). */
  degradedPollingIntervalMs?: number;
  /** Pending-notice backpressure limit before forcing a full rebuild plan. */
  maxPendingNotices?: number;
}

// ── Recalculation input ───────────────────────────────────────────────────────

/** Everything the engine needs to plan one recalculation cycle for a scope. */
export interface LivingGraphRecalculationInput {
  scope: LivingGraphRealtimeProjectScope;
  access: LivingGraphRealtimeAccessContext;
  config: LivingGraphRealtimeConfig;
  /** Read-only coalesced change notices (never mutated by the engine). */
  notices: readonly LivingGraphChangeNotice[];
  /** The snapshot the consumer currently holds; null before the first sync. */
  currentSnapshot: LivingGraphSnapshotDescriptor | null;
  /**
   * Task 3 — attribution index built from the current snapshot. When present,
   * planning is SELECTIVE (affected nodes/edges attributed via invalidation
   * tags); without it the engine keeps the conservative full-rebuild fallback.
   */
  snapshotIndex?: LivingGraphSnapshotIndex | null;
}

// ── 1. Engine Contract ────────────────────────────────────────────────────────

/**
 * The Living Graph Realtime Engine. Task 1 provides a safe foundation: it
 * validates input, enforces access, and plans conservatively (full rebuild
 * with a disclosed warning until selective planning ships). Subscription and
 * delta building throw LgreUnsupportedOperationError until Tasks 2+ implement
 * them — the engine never fabricates liveness or change data.
 */
export interface LivingGraphRealtimeEngine {
  readonly engineVersion: LivingGraphRealtimeEngineVersion;

  /** Attach a realtime subscription for a scope (Task 2 — Event Subscription Layer). */
  registerSubscription(request: LivingGraphSubscriptionRequest): LivingGraphSubscriptionHandle;

  /** Release a previously attached subscription (Task 2). */
  releaseSubscription(subscriptionId: string): void;

  /** Plan which parts of the graph view-model must be recomputed (pure). */
  planRecalculation(input: LivingGraphRecalculationInput): GraphRecalculationPlan;

  /** Build the minimal delta between two snapshots (later Phase 4 task). */
  buildDelta(
    previous: LivingGraphSnapshotDescriptor,
    next: LivingGraphSnapshotDescriptor,
  ): LivingGraphDelta;

  /** Decide what a consumer must do with a delta, given its local base version (pure). */
  decideSync(consumerVersion: number | null, delta: LivingGraphDelta): LivingGraphSyncDecision;

  /** Decide the delivery mode after N consecutive channel failures (pure, honest). */
  decideFallback(
    state: LivingGraphRealtimeConnectionState,
    consecutiveFailures: number,
  ): LivingGraphRealtimeFallbackMode;
}

// ── 2. Subscription Contract (producer side — Task 2 implements) ──────────────

/**
 * The Event Subscription Layer: the ONLY component that listens to upstream
 * change feeds (project_event_log INSERT notifications, projection-refresh
 * signals) and converts them into read-only LivingGraphChangeNotice values.
 * Delivery is at-least-once; consumers dedup by (eventId, sequence). It is a
 * LISTENER — it never writes to any upstream table.
 */
export interface LivingGraphRealtimeSubscriptionContract {
  /** Reject unregistered topics loudly (INVALID_SUBSCRIPTION_TOPIC). */
  validateTopics(topics: readonly LivingGraphRealtimeTopic[]): boolean;
  subscribe(request: LivingGraphSubscriptionRequest): LivingGraphSubscriptionHandle;
  unsubscribe(subscriptionId: string): void;
}

// ── 3. Recalculation Contract ─────────────────────────────────────────────────

/**
 * Pure planning: coalesced notices in, recalculation plan out. The plan names
 * WHICH existing deterministic engines must rerun (via targets); it never
 * computes status, counts, capacity, or health itself.
 */
export interface LivingGraphRecalculationContract {
  planRecalculation(input: LivingGraphRecalculationInput): GraphRecalculationPlan;
}

// ── 4. Delta / Sync Contract ──────────────────────────────────────────────────

/**
 * Versioned snapshot synchronization. Snapshot versions are monotonic per
 * scope; a delta is valid only against its exact basedOnVersion. Any base
 * mismatch or oversized delta resolves to full_resync — never a partial,
 * possibly-wrong merge.
 */
export interface LivingGraphDeltaSyncContract {
  buildDelta(
    previous: LivingGraphSnapshotDescriptor,
    next: LivingGraphSnapshotDescriptor,
  ): LivingGraphDelta;
  decideSync(consumerVersion: number | null, delta: LivingGraphDelta): LivingGraphSyncDecision;
}

// ── 5. Realtime UI Consumer Contract ──────────────────────────────────────────

/**
 * What any realtime UI consumer of the Living Graph must guarantee:
 * - applyDelta is pure and idempotent for the same (model, delta) pair;
 * - deltas change DATA only — manual node positions (saved layouts, UX-007)
 *   live outside the model and are preserved for surviving nodes; new nodes
 *   go to auto-layout; removed nodes release their saved position silently;
 * - freshness/connection state is disclosed honestly (LivingGraphRealtimeClientState);
 * - a full_resync instruction replaces the model wholesale — no partial merges.
 * The generic parameter keeps this contract free of UI/layout types.
 */
export interface LivingGraphRealtimeUiConsumerContract<TModel> {
  applyDelta(model: TModel, delta: LivingGraphDelta): TModel;
  applyFullSnapshot(model: TModel | null, snapshot: LivingGraphSnapshotDescriptor, data: TModel): TModel;
}

// ── 6. Security Contract ──────────────────────────────────────────────────────

export interface LivingGraphRealtimeSecurityContract {
  authorize(
    access: LivingGraphRealtimeAccessContext,
    scope: LivingGraphRealtimeScope,
  ): LivingGraphRealtimeAccessDecision;
  /** Strip any project not in the caller's authorized set from an aggregate. */
  redactUnauthorized(
    access: LivingGraphRealtimeAccessContext,
    projectIds: readonly string[],
  ): string[];
}

// ── 7. Observability Contract ─────────────────────────────────────────────────

export interface LivingGraphRealtimeObservabilityContract {
  /** Every tick MUST emit a complete tick summary. */
  summarizeTick(summary: LivingGraphRealtimeTickSummary): LivingGraphRealtimeTickSummary;
}

// ── 8. Fallback Contract ──────────────────────────────────────────────────────

/**
 * Honest degradation ladder: realtime → polling → manual_refresh. The engine
 * never reports "live" while degraded, and never silently swallows a channel
 * failure — the consumer state must reflect the real delivery mode.
 */
export interface LivingGraphRealtimeFallbackContract {
  decideFallback(
    state: LivingGraphRealtimeConnectionState,
    consecutiveFailures: number,
  ): LivingGraphRealtimeFallbackMode;
}

// ── Consolidated contract registry (documentation-in-code) ────────────────────

export const LGRE_CONTRACTS = {
  engine: "LivingGraphRealtimeEngine",
  subscription: "LivingGraphRealtimeSubscriptionContract",
  recalculation: "LivingGraphRecalculationContract",
  deltaSync: "LivingGraphDeltaSyncContract",
  uiConsumer: "LivingGraphRealtimeUiConsumerContract",
  security: "LivingGraphRealtimeSecurityContract",
  observability: "LivingGraphRealtimeObservabilityContract",
  fallback: "LivingGraphRealtimeFallbackContract",
} as const;
