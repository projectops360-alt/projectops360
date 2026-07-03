// ============================================================================
// ProjectOps360° — LGRE Phase 4 / Task 6
// Living Graph Realtime PERFORMANCE BUDGET
// ============================================================================
// Documented, overridable thresholds that govern the realtime performance
// safeguards (throttle / debounce / batch / reconnect backoff / large-graph
// warning / max-delta fallback / progressive rendering). This is a PURE config
// module: no side effects, no React, no Supabase, no canonical mutation.
//
// It COMPOSES (does not replace) the Task 1 LGRE_DEFAULT_PERFORMANCE_BUDGET so
// there is a single source of truth for delta/coalescing budgets that pre-date
// Task 6. New Task-6 thresholds live here and are documented inline.
// ============================================================================

import { LGRE_DEFAULT_PERFORMANCE_BUDGET } from "./constants";

/**
 * Full performance budget consumed by the Task 6 safeguards. Every value has a
 * documented default; callers may override any subset via `resolvePerfBudget`.
 */
export interface LgrePerformanceBudget {
  // ── Throttle / debounce / batch (rendering + notice coalescing) ──────────
  /** Non-critical realtime updates are debounced by this window before they
   *  cause a refetch/re-render. Critical updates flush immediately. (ms) */
  debounceWindowMs: number;
  /** Minimum spacing between two applied (rendered) refreshes. Protects the UI
   *  from render storms during a burst. Critical updates bypass. (ms) */
  throttleIntervalMs: number;
  /** Hard cap on how many coalesced updates a single flush may represent. Above
   *  this the scheduler collapses to a single "batch" flush. */
  maxBatchSize: number;

  // ── Delta size (reuses the Task 1 operation budget) ──────────────────────
  /** Above this many total node+edge operations a delta must fall back to a
   *  full_resync instead of an incremental partial merge. */
  maxDeltaOperations: number;

  // ── Stale / fresh ─────────────────────────────────────────────────────────
  /** If no successful sync happens within this window the consumer is
   *  considered STALE and must stop advertising "live". (ms) */
  staleTimeoutMs: number;

  // ── Reconnect backoff ─────────────────────────────────────────────────────
  /** First reconnect delay (ms). Doubles each attempt up to the max. */
  reconnectBackoffMinMs: number;
  /** Ceiling for reconnect backoff (ms). */
  reconnectBackoffMaxMs: number;
  /** After this many consecutive failed attempts, stop auto-reconnecting and
   *  fall back to manual_refresh_required. */
  reconnectMaxAttempts: number;

  // ── Large graph ───────────────────────────────────────────────────────────
  /** At/above this visible node count the graph is "large": warn + require
   *  confirmation before a scoped Expand all. */
  largeGraphNodeThreshold: number;
  /** At/above this visible edge count the graph is "large". */
  largeGraphEdgeThreshold: number;

  // ── Progressive rendering ─────────────────────────────────────────────────
  /** Max nodes rendered per progressive frame when hydrating a large graph. */
  renderBatchSize: number;
}

/**
 * Task-6 defaults. Delta-operation budget is inherited from Task 1 so the two
 * layers can never disagree. Everything else is documented above.
 */
export const LGRE_PERFORMANCE_DEFAULTS: LgrePerformanceBudget = {
  debounceWindowMs: 350,
  throttleIntervalMs: 300,
  maxBatchSize: 100,
  maxDeltaOperations: LGRE_DEFAULT_PERFORMANCE_BUDGET.maxDeltaOperations, // 200
  staleTimeoutMs: 25_000,
  reconnectBackoffMinMs: 1_000,
  reconnectBackoffMaxMs: 30_000,
  reconnectMaxAttempts: 6,
  largeGraphNodeThreshold: 300,
  largeGraphEdgeThreshold: 600,
  renderBatchSize: 50,
} as const;

/**
 * Resolve an effective budget from a partial override, clamping every value to
 * a safe positive range so a bad config can never disable a safeguard entirely
 * (e.g. a 0ms debounce that reintroduces render storms, or a 0 delta budget
 * that force-resyncs forever).
 */
export function resolvePerfBudget(
  override?: Partial<LgrePerformanceBudget>,
): LgrePerformanceBudget {
  const base = { ...LGRE_PERFORMANCE_DEFAULTS, ...(override ?? {}) };
  const atLeast = (value: number, min: number) =>
    Number.isFinite(value) && value >= min ? value : min;

  const min = atLeast(base.reconnectBackoffMinMs, 100);
  const max = Math.max(min, atLeast(base.reconnectBackoffMaxMs, min));

  return {
    debounceWindowMs: atLeast(base.debounceWindowMs, 0),
    throttleIntervalMs: atLeast(base.throttleIntervalMs, 0),
    maxBatchSize: atLeast(Math.floor(base.maxBatchSize), 1),
    maxDeltaOperations: atLeast(Math.floor(base.maxDeltaOperations), 1),
    staleTimeoutMs: atLeast(base.staleTimeoutMs, 1_000),
    reconnectBackoffMinMs: min,
    reconnectBackoffMaxMs: max,
    reconnectMaxAttempts: atLeast(Math.floor(base.reconnectMaxAttempts), 1),
    largeGraphNodeThreshold: atLeast(Math.floor(base.largeGraphNodeThreshold), 1),
    largeGraphEdgeThreshold: atLeast(Math.floor(base.largeGraphEdgeThreshold), 1),
    renderBatchSize: atLeast(Math.floor(base.renderBatchSize), 1),
  };
}
