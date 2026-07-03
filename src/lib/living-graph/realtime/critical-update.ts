// ============================================================================
// ProjectOps360° — LGRE Phase 4 / Task 6
// CRITICAL UPDATE classification (priority-aware safeguards)
// ============================================================================
// Pure classifier that decides whether a realtime update may be throttled /
// debounced / batched, or must be applied without delay. The design is
// FAIL-SAFE: an UNKNOWN event type is treated as CRITICAL so a safeguard can
// never silently drop something it does not recognise. Only an explicit
// allow-list of visually-redundant / cosmetic event types is throttleable.
//
// This module reads canonical event-type strings (registry vocabulary) but
// never queries, mutates, or projects canonical truth. No side effects.
// ============================================================================

import type { LivingGraphChangeNotice } from "./types";

/**
 * Event types whose realtime effect is redundant or cosmetic enough that
 * collapsing a burst to the final state loses nothing a user can perceive.
 * Everything NOT in this set is treated as critical (fail-safe).
 */
export const LGRE_NON_CRITICAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  // Metadata / attribution edits — do not change status, counts, or topology.
  "TaskUpdated",
  "TaskAssigned",
  "TaskUnassigned",
  "TaskPriorityChanged",
  "TaskDueDateChanged",
  "TaskEstimateChanged",
  "SubtaskUpdated",
  "SubtaskReassigned",
  "SubtaskDueDateChanged",
  "SubtaskEstimateChanged",
  // Narrative / advisory projections — never gate correctness of the graph.
  "IsabellaBriefingGenerated",
  "IsabellaRecommendationGenerated",
  "SnapshotCreated",
  "CommunicationSent",
  "MeetingHeld",
  "DocumentUploaded",
  "DrawingUploaded",
]);

/**
 * Event types that MUST bypass throttle/debounce because they change status,
 * counts, progress, topology, or visibility. Kept as an explicit set for
 * documentation and tests; it is not required for correctness (anything not
 * non-critical is already critical) but it makes intent auditable.
 */
export const LGRE_CRITICAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  // Task status / movement / lifecycle.
  "TaskStatusChanged",
  "TaskMoved",
  "TaskStarted",
  "TaskCompleted",
  "TaskReopened",
  "TaskPaused",
  "TaskResumed",
  "TaskCancelled",
  "TaskCreated",
  "TaskDeleted",
  "TaskBlocked",
  "TaskUnblocked",
  "TaskDependencyAdded",
  "TaskDependencyRemoved",
  // Subtask status / progress / topology.
  "SubtaskStarted",
  "SubtaskCompleted",
  "SubtaskCreated",
  "SubtaskDeleted",
  "SubtaskBlocked",
  "SubtaskUnblocked",
  "SubtaskProgressChanged",
  // Parent rollups.
  "ParentTaskProgressRecalculated",
  "ParentTaskProgressOverride",
  // Milestone status / progress / readiness.
  "MilestoneCreated",
  "MilestoneStarted",
  "MilestoneAchieved",
  "MilestoneDelayed",
  "MilestoneMissed",
  "MilestoneUpdated",
  "MilestoneReadinessChanged",
  "MilestoneForecastChanged",
  // Project-level visibility.
  "ProjectArchived",
  "ProjectClosed",
  "ProjectReopened",
]);

/**
 * Sync-lifecycle signals that are always critical regardless of event type.
 * These are produced by the transport/store, not by the event ledger, and must
 * flush any pending buffer (Task 6 flush-on-critical contract).
 */
export type LgreCriticalSyncSignal =
  | "full_resync_required"
  | "permission_lost"
  | "version_mismatch"
  | "stale_transition"
  | "degraded_transition"
  | "reconnect_result";

/**
 * Classify an event type. Unknown/empty → critical (fail-safe: never silently
 * drop something we do not recognise).
 */
export function isCriticalEventType(eventType: string | null | undefined): boolean {
  if (!eventType) return true;
  return !LGRE_NON_CRITICAL_EVENT_TYPES.has(eventType);
}

/**
 * Classify a change notice. A compensating/reversal event, or any notice that
 * carries topology/status invalidation tags, is always critical even if the
 * bare event type were otherwise throttleable.
 */
export function isCriticalNotice(notice: LivingGraphChangeNotice): boolean {
  if (notice.isCompensatingEvent) return true;
  if (isCriticalEventType(notice.eventType)) return true;
  // A tag that touches status / topology / counts escalates to critical even
  // when the event type is otherwise cosmetic.
  return notice.invalidationTags.some((tag) => CRITICAL_TAG_PATTERN.test(tag));
}

/** Invalidation-tag fragments that always escalate a notice to critical. */
const CRITICAL_TAG_PATTERN =
  /(status|progress|count|rollup|dependency|blocker|milestone|topology|delete|archive|visibility)/i;
