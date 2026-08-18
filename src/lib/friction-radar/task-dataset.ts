// ============================================================================
// ProjectOps360° — Friction Radar task-level evidence dataset (read-only)
// ============================================================================

import type { RoadmapTask, TaskDependency } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import type { TimeEntry } from "@/lib/time-tracking/types";
import type { Resource, ResourceAssignment } from "@/types/execution";
import { taskIdForCanonicalEvent } from "@/lib/graph/task-case-analysis";
import {
  assessQueueFriction,
  assessTaskLifecycle,
  assessTaskProjectionConsistency,
  assessTaskStagnation,
  assessTaskTemporalConsistency,
  deriveObservedTaskStart,
  detectCompletedThenReopened,
  qualifyElapsedDuration,
  type ObservedTaskStart,
  type ProjectionConsistencyAssessment,
  type QueueFrictionAssessment,
  type StagnationAssessment,
  type TaskLifecycleAssessment,
  type TaskReworkAssessment,
  type TaskTemporalConsistencyAssessment,
} from "./task-evidence";

export interface ResourceCapacityProfile {
  user_id: string | null;
  default_weekly_capacity_hours: number | null;
  default_availability_percent: number | null;
}

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
  plannedDurationDays: number | null;
  plannedHours: number | null;
  currentStart: string | null;
  currentFinish: string | null;
  currentDurationDays: number | null;
  assignedTo: string | null;
  assignedResourceId: string | null;
  assignedResourceName: string | null;
  assignedResourceStatus: string | null;
  resourceAssignmentCount: number;
  resourceCapacityEvidence: "available" | "insufficient_evidence";
  isCritical: boolean;
  slackDays: number | null;
  firstTaskStartedAt: string | null;
  observedStart: ObservedTaskStart;
  queueFriction: QueueFrictionAssessment;
  activeCycleTimeMs: number | null;
  activeCycleTimeStatus:
    | "qualified"
    | "temporal_conflict"
    | "insufficient_evidence";
  timeEntryCount: number;
  timeEntryIds: string[];
  effortByUser: Array<{ userId: string; hours: number; entryIds: string[] }>;
  loggedHours: number;
  taskActualHours: number | null;
  effortVarianceHours: number | null;
  predecessorCount: number;
  predecessorIds: string[];
  successorCount: number;
  successorIds: string[];
  dependencyIds: string[];
  fanIn: number;
  fanOut: number;
  dependencyTypes: string[];
  maxDependencyLagDays: number | null;
  upstreamIncompleteCount: number;
  downstreamImpactCount: number;
  lifecycle: TaskLifecycleAssessment;
  stagnation: StagnationAssessment;
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
  dependencies?: readonly TaskDependency[];
  resources?: readonly Resource[];
  resourceAssignments?: readonly ResourceAssignment[];
  resourceProfiles?: readonly ResourceCapacityProfile[];
  analysisTimestamp?: string | null;
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

  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const resourceById = new Map(
    (input.resources ?? []).map((resource) => [resource.id, resource]),
  );
  const capacityProfileByUserId = new Map(
    (input.resourceProfiles ?? [])
      .filter((profile) => profile.user_id != null)
      .map((profile) => [profile.user_id!, profile]),
  );
  const resourceAssignmentsByTask = new Map<string, ResourceAssignment[]>();
  for (const assignment of input.resourceAssignments ?? []) {
    if (!knownTaskIds.has(assignment.task_id)) continue;
    const assignments = resourceAssignmentsByTask.get(assignment.task_id) ?? [];
    assignments.push(assignment);
    resourceAssignmentsByTask.set(assignment.task_id, assignments);
  }
  const predecessorsByTask = new Map<string, TaskDependency[]>();
  const successorsByTask = new Map<string, TaskDependency[]>();
  for (const dependency of input.dependencies ?? []) {
    if (
      dependency.project_id !== input.tasks[0]?.project_id ||
      !knownTaskIds.has(dependency.predecessor_id) ||
      !knownTaskIds.has(dependency.successor_id)
    ) {
      continue;
    }
    const predecessors = predecessorsByTask.get(dependency.successor_id) ?? [];
    predecessors.push(dependency);
    predecessorsByTask.set(dependency.successor_id, predecessors);
    const successors = successorsByTask.get(dependency.predecessor_id) ?? [];
    successors.push(dependency);
    successorsByTask.set(dependency.predecessor_id, successors);
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
    const effortByUserMap = new Map<
      string,
      { userId: string; hours: number; entryIds: string[] }
    >();
    for (const entry of entries) {
      const effort = effortByUserMap.get(entry.user_id) ?? {
        userId: entry.user_id,
        hours: 0,
        entryIds: [],
      };
      effort.hours += Number(entry.duration_hours) || 0;
      effort.entryIds.push(entry.id);
      effortByUserMap.set(entry.user_id, effort);
    }
    const firstTaskStartedAt =
      events
        .filter((event) => event.eventType === "TaskStarted")
        .map((event) => event.occurredAt)
        .filter((value): value is string => value != null)
        .sort()[0] ?? null;
    const temporalConsistency = assessTaskTemporalConsistency({
      events,
      timeEntries: workDateEvidence,
    });
    const lifecycle = assessTaskLifecycle(events, workDateEvidence);
    const observedStartEvent = observedStart.eventId
      ? events.find((event) => event.eventId === observedStart.eventId) ?? null
      : null;
    const completedEvent = lifecycle.lastCompletedAt
      ? [...events]
          .reverse()
          .find((event) => event.eventType === "TaskCompleted") ?? null
      : null;
    const activeCycleTime =
      observedStartEvent && completedEvent
        ? qualifyElapsedDuration(
            observedStartEvent,
            completedEvent,
            workDateEvidence,
          )
        : {
            durationMs: null,
            status: "insufficient_evidence" as const,
            reason: "qualified_start_and_completion_events_required",
          };
    const predecessors = predecessorsByTask.get(task.id) ?? [];
    const successors = successorsByTask.get(task.id) ?? [];
    const dependencyTypes = [...new Set(
      [...predecessors, ...successors].map((dependency) =>
        dependency.dependency_type,
      ),
    )].sort();
    const lags = [...predecessors, ...successors].map(
      (dependency) => dependency.lag_days,
    );
    const upstreamIncompleteCount = predecessors.filter((dependency) => {
      const predecessor = taskById.get(dependency.predecessor_id);
      return predecessor != null && !["done", "completed"].includes(predecessor.status);
    }).length;
    const assignedResource = task.assigned_resource_id
      ? resourceById.get(task.assigned_resource_id) ?? null
      : null;
    const capacityProfile = assignedResource?.linked_user_id
      ? capacityProfileByUserId.get(assignedResource.linked_user_id) ?? null
      : null;
    const resourceAssignments = resourceAssignmentsByTask.get(task.id) ?? [];

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
      plannedDurationDays:
        task.baseline_start_date != null &&
        task.baseline_end_date != null &&
        task.start_date === task.baseline_start_date &&
        task.end_date === task.baseline_end_date
          ? task.duration_days
          : null,
      plannedHours,
      currentStart: task.start_date,
      currentFinish: task.end_date,
      currentDurationDays: task.duration_days,
      assignedTo: task.assigned_to,
      assignedResourceId: task.assigned_resource_id,
      assignedResourceName: assignedResource?.name ?? null,
      assignedResourceStatus: assignedResource?.status ?? null,
      resourceAssignmentCount: resourceAssignments.length,
      resourceCapacityEvidence:
        assignedResource?.capacity_per_day != null ||
        (assignedResource?.availability.length ?? 0) > 0 ||
        capacityProfile?.default_weekly_capacity_hours != null ||
        capacityProfile?.default_availability_percent != null ||
        resourceAssignments.some((assignment) =>
          assignment.allocation_pct != null || assignment.planned_hours != null,
        )
          ? "available"
          : "insufficient_evidence",
      isCritical: task.is_critical,
      slackDays: task.slack_days,
      firstTaskStartedAt,
      observedStart,
      queueFriction: assessQueueFriction({
        plannedStart,
        observedStart,
        events,
      }),
      activeCycleTimeMs: activeCycleTime.durationMs,
      activeCycleTimeStatus: activeCycleTime.status,
      timeEntryCount: entries.length,
      timeEntryIds: entries.map((entry) => entry.id),
      effortByUser: [...effortByUserMap.values()].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      ),
      loggedHours,
      taskActualHours:
        task.actual_hours == null ? null : Number(task.actual_hours),
      effortVarianceHours:
        plannedHours == null ? null : loggedHours - Number(plannedHours),
      predecessorCount: predecessors.length,
      predecessorIds: predecessors.map((dependency) => dependency.predecessor_id),
      successorCount: successors.length,
      successorIds: successors.map((dependency) => dependency.successor_id),
      dependencyIds: [...predecessors, ...successors].map(
        (dependency) => dependency.id,
      ),
      fanIn: predecessors.length,
      fanOut: successors.length,
      dependencyTypes,
      maxDependencyLagDays: lags.length > 0 ? Math.max(...lags) : null,
      upstreamIncompleteCount,
      downstreamImpactCount: successors.length,
      lifecycle,
      stagnation: assessTaskStagnation({
        currentStatus: task.status,
        lifecycle,
        observedAt: input.analysisTimestamp ?? null,
      }),
      rework: detectCompletedThenReopened(events),
      temporalConsistency,
      projectionConsistency: assessTaskProjectionConsistency({
        currentStatus: task.status,
        isBlocked: task.is_blocked,
        events,
      }),
    };
  });
}
