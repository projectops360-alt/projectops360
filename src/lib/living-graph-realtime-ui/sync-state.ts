// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Sync State (pure)
// ============================================================================
// Derives the honest realtime status the UI displays from a Task 4
// GraphSyncResponse: freshness, current version, and whether a full resync /
// missed-update recovery is in play. Never fabricates liveness — an unknown
// state stays "unknown". Pure.
// ============================================================================

import type { GraphSyncResponse } from "@/lib/living-graph/realtime";

export type RealtimeFreshness = "live" | "recovering" | "resync_required" | "stale" | "unknown";

export interface RealtimeSyncState {
  freshness: RealtimeFreshness;
  version: number | null;
  needsFullResync: boolean;
  recovering: boolean;
  unauthorized: boolean;
  lastSyncedAt: string | null;
  /** Human-safe reason (machine code from the sync response). */
  reason: string;
}

export function initialSyncState(): RealtimeSyncState {
  return {
    freshness: "unknown",
    version: null,
    needsFullResync: false,
    recovering: false,
    unauthorized: false,
    lastSyncedAt: null,
    reason: "not_synced",
  };
}

/** Fold a sync response into the display state. Pure. */
export function applySyncResponse(response: GraphSyncResponse, nowIso: string): RealtimeSyncState {
  switch (response.kind) {
    case "noop":
      return {
        freshness: "live",
        version: response.targetVersion,
        needsFullResync: false,
        recovering: false,
        unauthorized: false,
        lastSyncedAt: nowIso,
        reason: response.reason,
      };
    case "deltas":
      return {
        freshness: "live",
        version: response.targetVersion,
        needsFullResync: false,
        recovering: true, // recovered from a missed-update window
        unauthorized: false,
        lastSyncedAt: nowIso,
        reason: response.reason,
      };
    case "full_resync":
      return {
        freshness: "resync_required",
        version: response.snapshot?.snapshotVersion ?? response.targetVersion,
        needsFullResync: true,
        recovering: false,
        unauthorized: false,
        lastSyncedAt: nowIso,
        reason: response.reason,
      };
    case "unauthorized":
      return {
        freshness: "unknown",
        version: null,
        needsFullResync: false,
        recovering: false,
        unauthorized: true,
        lastSyncedAt: null,
        reason: response.reason,
      };
    default:
      return initialSyncState();
  }
}

/**
 * Mark the client stale when no sync has landed within the freshness budget.
 * `sinceMs` is the elapsed time since `lastSyncedAt`. Pure.
 */
export function markStaleIfExpired(
  state: RealtimeSyncState,
  sinceMs: number,
  freshnessBudgetMs: number,
): RealtimeSyncState {
  if (state.freshness !== "live") return state;
  if (sinceMs <= freshnessBudgetMs) return state;
  return { ...state, freshness: "stale", reason: "freshness_budget_exceeded" };
}
