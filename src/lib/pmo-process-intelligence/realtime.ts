// ============================================================================
// PMO Process Intelligence — realtime helpers (CAP-047 · M8)
// ============================================================================
// Signature-based incremental refresh (the LGRE polling pattern): the client
// polls a cheap scope signature and re-renders ONLY when it changes — no
// render storms, no websocket fan-out, deterministic backoff on errors.
// Pure helpers here; the poller component owns the timers and cleans them up.
// ============================================================================

/** Base polling interval (ms). */
export const PMO_PI_POLL_BASE_MS = 20_000;
/** Ceiling for error backoff (ms). */
export const PMO_PI_POLL_MAX_MS = 120_000;

/** Deterministic backoff: base × 2^errors, capped. */
export function nextPollDelay(consecutiveErrors: number): number {
  const delay = PMO_PI_POLL_BASE_MS * 2 ** Math.max(0, consecutiveErrors);
  return Math.min(delay, PMO_PI_POLL_MAX_MS);
}

/** Refresh only on a real signature change — never on errors or no-ops. */
export function shouldRefresh(previous: string | null, next: string | null): boolean {
  if (previous == null || next == null) return false;
  return previous !== next;
}

/** Compose the scope signature from cheap aggregates (count + max sequence). */
export function composeSignature(eventCount: number, maxSequence: number | null): string {
  return `${eventCount}:${maxSequence ?? 0}`;
}
