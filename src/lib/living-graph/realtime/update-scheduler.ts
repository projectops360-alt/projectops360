// ============================================================================
// ProjectOps360° — LGRE Phase 4 / Task 6
// UPDATE SCHEDULER — coalescing buffer (throttle + debounce + batch + dedup)
// ============================================================================
// A PURE, deterministic state machine that governs WHEN a burst of realtime
// updates is applied to the consumer. No timers, no React, no side effects: the
// caller drives it with an injected clock (`now`) so it is fully testable with
// a fake clock. Guarantees:
//
//   • Duplicate updates for the same key collapse to the latest (dedup) — the
//     FINAL state is always preserved (never lost by coalescing).
//   • Non-critical bursts are debounced, then throttled (min spacing between
//     applied flushes) to protect the UI from render storms.
//   • Any CRITICAL update flushes immediately, BYPASSING throttle/debounce, so
//     task-status / progress / topology changes are never delayed or dropped.
//   • Collapsed (superseded) intermediate updates are COUNTED, never hidden.
//   • A batch never exceeds maxBatchSize distinct keys before it must flush.
//
// This scheduler decides scheduling only; it does not compute graph truth.
// ============================================================================

import type { LgrePerformanceBudget } from "./performance-budget";

/** One buffered update, identified by a coalescing key (e.g. node/scope id). */
export interface ScheduledUpdate {
  /** Dedup key: two updates with the same key collapse to the latest. */
  key: string;
  critical: boolean;
}

export interface UpdateSchedulerState {
  /** Latest pending update per key (insertion order preserved for replay). */
  readonly pending: ReadonlyMap<string, ScheduledUpdate>;
  /** Wall-clock (from injected `now`) of the first still-pending enqueue. */
  readonly firstEnqueuedAt: number | null;
  /** Wall-clock of the last applied flush (for throttle spacing). */
  readonly lastFlushAt: number | null;
  /** True while at least one pending update is critical. */
  readonly hasCritical: boolean;
  /** Intermediate non-critical updates collapsed by a same-key supersede. */
  readonly coalescedNonCritical: number;
  /** Intermediate critical updates collapsed by a same-key supersede. */
  readonly coalescedCritical: number;
}

export function createUpdateSchedulerState(): UpdateSchedulerState {
  return {
    pending: new Map(),
    firstEnqueuedAt: null,
    lastFlushAt: null,
    hasCritical: false,
    coalescedNonCritical: 0,
    coalescedCritical: 0,
  };
}

/**
 * Enqueue an update. Returns a NEW state. If the key is already pending its
 * value is replaced (dedup → latest wins) and the superseded update is counted
 * as coalesced. The scheduler never drops the final value for a key.
 */
export function enqueueUpdate(
  state: UpdateSchedulerState,
  update: ScheduledUpdate,
  now: number,
): UpdateSchedulerState {
  const pending = new Map(state.pending);
  const superseded = pending.get(update.key);

  // Re-insert to keep the LATEST occurrence at the end (stable replay order).
  pending.delete(update.key);
  // Once critical, a key stays critical even if a later same-key update is not,
  // so we never demote a critical change into the throttleable lane.
  const critical = update.critical || superseded?.critical === true;
  pending.set(update.key, { key: update.key, critical });

  let { coalescedNonCritical, coalescedCritical } = state;
  if (superseded) {
    if (superseded.critical) coalescedCritical += 1;
    else coalescedNonCritical += 1;
  }

  return {
    pending,
    firstEnqueuedAt: state.firstEnqueuedAt ?? now,
    lastFlushAt: state.lastFlushAt,
    hasCritical: state.hasCritical || critical,
    coalescedNonCritical,
    coalescedCritical,
  };
}

export type FlushReason =
  | "critical" // a critical update forces an immediate flush
  | "batch_full" // maxBatchSize distinct keys reached
  | "debounced" // debounce window elapsed and throttle allows
  | "idle"; // nothing to flush

export interface FlushDecision {
  due: boolean;
  reason: FlushReason;
  /** ms until the next flush attempt is worth scheduling (null = no timer). */
  nextAttemptInMs: number | null;
}

/**
 * Decide whether the buffer should flush now. Critical updates bypass throttle
 * and debounce. Non-critical updates must (a) satisfy the debounce window (or
 * fill a batch) AND (b) respect the throttle spacing since the last flush.
 */
export function decideFlush(
  state: UpdateSchedulerState,
  now: number,
  budget: LgrePerformanceBudget,
): FlushDecision {
  if (state.pending.size === 0) {
    return { due: false, reason: "idle", nextAttemptInMs: null };
  }

  // Critical → immediate, bypassing throttle/debounce.
  if (state.hasCritical) {
    return { due: true, reason: "critical", nextAttemptInMs: 0 };
  }

  const sinceLastFlush =
    state.lastFlushAt == null ? Number.POSITIVE_INFINITY : now - state.lastFlushAt;
  const throttleRemaining = Math.max(0, budget.throttleIntervalMs - sinceLastFlush);

  const batchFull = state.pending.size >= budget.maxBatchSize;
  const sinceFirst =
    state.firstEnqueuedAt == null ? 0 : now - state.firstEnqueuedAt;
  const debounceRemaining = Math.max(0, budget.debounceWindowMs - sinceFirst);

  // Gate: either the batch is full, or the debounce window elapsed.
  const gateReady = batchFull || debounceRemaining === 0;
  if (!gateReady) {
    return {
      due: false,
      reason: batchFull ? "batch_full" : "debounced",
      nextAttemptInMs: batchFull ? throttleRemaining : Math.max(debounceRemaining, throttleRemaining),
    };
  }

  // Gate is ready — now respect throttle spacing.
  if (throttleRemaining > 0) {
    return {
      due: false,
      reason: batchFull ? "batch_full" : "debounced",
      nextAttemptInMs: throttleRemaining,
    };
  }

  return {
    due: true,
    reason: batchFull ? "batch_full" : "debounced",
    nextAttemptInMs: 0,
  };
}

export interface FlushResult {
  /** Keys applied this flush, in stable replay order (latest value each). */
  keys: readonly string[];
  batchSize: number;
  hadCritical: boolean;
  /** Non-critical intermediate updates collapsed since the last flush. */
  coalescedNonCritical: number;
  /** Critical intermediate updates collapsed since the last flush. */
  coalescedCritical: number;
  reason: FlushReason;
  /** Fresh, drained state to carry forward. */
  state: UpdateSchedulerState;
}

/**
 * Drain the buffer, producing the batch to apply and a reset state. Always call
 * this only when `decideFlush(...).due` (or on forced flush, e.g. unmount).
 */
export function drainScheduler(
  state: UpdateSchedulerState,
  now: number,
  reason: FlushReason = "debounced",
): FlushResult {
  const keys = [...state.pending.keys()];
  return {
    keys,
    batchSize: keys.length,
    hadCritical: state.hasCritical,
    coalescedNonCritical: state.coalescedNonCritical,
    coalescedCritical: state.coalescedCritical,
    reason,
    state: {
      pending: new Map(),
      firstEnqueuedAt: null,
      lastFlushAt: now,
      hasCritical: false,
      coalescedNonCritical: 0,
      coalescedCritical: 0,
    },
  };
}

/**
 * Force-flush semantics for unmount/detach: preserve the final state even if
 * the debounce/throttle windows have not elapsed. Returns null when empty.
 */
export function forceFlush(
  state: UpdateSchedulerState,
  now: number,
): FlushResult | null {
  if (state.pending.size === 0) return null;
  return drainScheduler(state, now, state.hasCritical ? "critical" : "debounced");
}
