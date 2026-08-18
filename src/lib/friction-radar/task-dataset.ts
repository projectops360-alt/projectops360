// ============================================================================
// ProjectOps360° — Friction Radar task-level evidence dataset (read-only)
// ============================================================================

import type { RoadmapTask } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import type { TimeEntry } from "@/lib/time-tracking/types";
import { taskIdForCanonicalEvent } from "@/lib/graph/task-case-analysis";
import {
  assessQueueFriction,
  assessTaskProjectionConsistency,
  assessTaskTemporalConsistency,
  deriveObservedTaskStart,
  detectCompletedThenReopened,
  type ObservedTaskStart,
  type ProjectionConsistencyAssessment,
  type QueueFrictionAssessment,
  type TaskReworkAssessment,
  type TaskTemporalConsistencyAssessment,
} from "./task-evidence";

export interface TaskFrictionEvidenceRow {
  projectId: string;
  milestoneId: string | null;
  taskId: string;
  title: string;
  status: string;
  progress: number;
  isBlocked: boolean;
  blockerReason: string | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  plannedHours: number | null;
  firstTaskStartedAt: string | null;
  observedStart: ObservedTaskStart;
  queueFriction: QueueFrictionAssessment;
  timeEntryCount: number;
  loggedHours: number;
  effortVarianceHours: number | null;
  rework: TaskReworkAssessment;
  temporalConsistency: TaskTemporalConsistencyAssessment;
  projectionConsistency: ProjectionConsistencyAssessment;
}

/**
 * Builds the Friction Radar base dataset from current snapshots plus immutable
 * events. Current non-deleted time entries are authoritative for work date and
 * effort; TimeEntryUpdated audit events are never summed.
 */
export function buildTaskFrictionEvidenceDataset(input: {
  tasks: readonly RoadmapTask[];
  events: readonly LivingGraphCanonicalEvent[];
  timeEntries: readonly TimeEntry[];
}): TaskFrictionEvidenceRow[] {
  const knownTaskIds = new Set(input.tasks.map((task) => task.id));
  const eventsByTask = new Map<string, LivingGraphCanonicalEvent[]>();
  for (const event of input.events) {
    const taskId = taskIdForCanonicalEvent(event, knownTaskIds);
    if (!taskId) continue;
    const rows = eventsByTask.get(taskId) ?? [];
    rows.push(event);
    eventsByTask.set(taskId, rows);
  }

  const entriesByTask = new Map<string, TimeEntry[]>();
  for (const entry of input.timeEntries) {
    if (entry.deleted_at != null || !knownTaskIds.has(entry.task_id)) continue;
    const rows = entriesByTask.get(entry.task_id) ?? [];
    rows.push(entry);
    entriesByTask.set(entry.task_id, rows);
  }

  return input.tasks.map((task) => {
    const events = [...(eventsByTask.get(task.id) ?? [])].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber,
    );
    const entries = entriesByTask.get(task.id) ?? [];
    const workDateEvidence = entries.map((entry) => ({
      id: entry.id,
      workDate: entry.work_date,
      deletedAt: entry.deleted_at,
    }));
    const observedStart = deriveObservedTaskStart(events, workDateEvidence);
    const plannedStart = task.baseline_start_date ?? task.start_date;
    const plannedHours =
      task.baseline_estimate_hours ??
      task.estimated_labor_hours ??
      task.estimate_hours;
    const loggedHours = entries.reduce(
      (sum, entry) => sum + (Number(entry.duration_hours) || 0),
      0,
    );
    const firstTaskStartedAt =
      events
        .filter((event) => event.eventType === "TaskStarted")
        .map((event) => event.occurredAt)
        .filter((value): value is string => value != null)
        .sort()[0] ?? null;

    return {
      projectId: task.project_id,
      milestoneId: task.milestone_id,
      taskId: task.id,
      title: task.title,
      status: task.status,
      progress: task.progress,
      isBlocked: task.is_blocked,
      blockerReason: task.blocker_reason,
      plannedStart,
      plannedFinish: task.baseline_end_date ?? task.end_date,
      plannedHours,
      firstTaskStartedAt,
      observedStart,
      queueFriction: assessQueueFriction({
        plannedStart,
        observedStart,
        events,
      }),
      timeEntryCount: entries.length,
      loggedHours,
      effortVarianceHours:
        plannedHours == null ? null : loggedHours - Number(plannedHours),
      rework: detectCompletedThenReopened(events),
      temporalConsistency: assessTaskTemporalConsistency({
        events,
        timeEntries: workDateEvidence,
      }),
      projectionConsistency: assessTaskProjectionConsistency({
        currentStatus: task.status,
        isBlocked: task.is_blocked,
        events,
      }),
    };
  });
}
