// ============================================================================
// ProjectOps360° — LGRE Phase 4 / Task 6
// RECONNECT BACKOFF — bounded exponential backoff (pure)
// ============================================================================
// Deterministic backoff math for realtime reconnect attempts. No timers, no
// randomness (deterministic + testable): the caller schedules the returned
// delay. Prevents tight reconnect loops and caps total attempts before falling
// back to manual_refresh_required. On give-up the consumer must show a degraded
// state — never a silent stale "live".
// ============================================================================

import type { LgrePerformanceBudget } from "./performance-budget";

export interface ReconnectPlan {
  /** 1-based attempt number this plan describes. */
  attempt: number;
  /** Delay to wait before this attempt (ms). */
  delayMs: number;
  /** True when attempts are exhausted → stop auto-reconnecting, degrade. */
  giveUp: boolean;
}

/**
 * Compute the reconnect delay for a given attempt (1-based). Exponential:
 * min * 2^(attempt-1), clamped to [min, max]. Attempt ≤ 0 is treated as 1.
 */
export function reconnectDelayMs(
  attempt: number,
  budget: LgrePerformanceBudget,
): number {
  const n = Math.max(1, Math.floor(attempt));
  const raw = budget.reconnectBackoffMinMs * 2 ** (n - 1);
  if (!Number.isFinite(raw)) return budget.reconnectBackoffMaxMs;
  return Math.min(budget.reconnectBackoffMaxMs, Math.max(budget.reconnectBackoffMinMs, raw));
}

/** True once the attempt count has reached the configured ceiling. */
export function shouldStopReconnecting(
  attempt: number,
  budget: LgrePerformanceBudget,
): boolean {
  return Math.floor(attempt) >= budget.reconnectMaxAttempts;
}

/**
 * Plan the next reconnect. `previousAttempts` is how many attempts already
 * failed. Returns the delay for the next attempt and whether to give up.
 */
export function planReconnect(
  previousAttempts: number,
  budget: LgrePerformanceBudget,
): ReconnectPlan {
  const attempt = Math.max(0, Math.floor(previousAttempts)) + 1;
  const giveUp = shouldStopReconnecting(attempt, budget);
  return {
    attempt,
    delayMs: reconnectDelayMs(attempt, budget),
    giveUp,
  };
}
