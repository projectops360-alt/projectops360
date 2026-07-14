// ============================================================================
// ProjectOps360° — Living Graph task-case projection (read-only)
// ============================================================================

import type { Milestone, RoadmapTask } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import type { SubtaskLayerRow } from "@/lib/graph/subtask-graph-layer";
import { isCompletedStatus } from "@/lib/execution/task-activity";

const TASK_ENTITY_TYPES = new Set(["task", "roadmap_task", "roadmap_tasks"]);

export interface TaskAttachmentRef {
  id: string;
  taskId: string;
  subtaskId: string | null;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
}

export type TaskCaseVerificationState =
  | "verified_complete"
  | "complete_unverified"
  | "not_complete";

export type TaskCaseWarningCode =
  | "no_history"
  | "missing_acceptance_criteria"
  | "missing_evidence"
  | "missing_completion_event"
  | "missing_completion_timestamp"
  | "incomplete";

export interface TaskCaseEvidenceRef {
  eventId: string;
  objectType: string;
  objectId: string;
}

export interface TaskCaseSummary {
  task: RoadmapTask;
  milestoneTitle: string | null;
  events: LivingGraphCanonicalEvent[];
  subtasks: SubtaskLayerRow[];
  attachments: TaskAttachmentRef[];
  evidenceRefs: TaskCaseEvidenceRef[];
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  elapsedMs: number | null;
  completedSubtasks: number;
  hasCompletionEvent: boolean;
  verificationState: TaskCaseVerificationState;
  warningCodes: TaskCaseWarningCode[];
}

function taskEntityCandidate(
  type: string | null | undefined,
  id: string | null | undefined,
  knownTaskIds: ReadonlySet<string>,
): string | null {
  if (!type || !id || !TASK_ENTITY_TYPES.has(type.toLowerCase())) return null;
  return knownTaskIds.has(id) ? id : null;
}

/** Resolve the task/lead object touched by one canonical event. */
export function taskIdForCanonicalEvent(
  event: LivingGraphCanonicalEvent,
  knownTaskIds: ReadonlySet<string>,
): string | null {
  const source = taskEntityCandidate(
    event.sourceEntityType,
    event.sourceEntityId,
    knownTaskIds,
  );
  if (source) return source;

  const subject = taskEntityCandidate(event.subjectType, event.subjectId, knownTaskIds);
  if (subject) return subject;

  for (const ref of event.objectRefs) {
    const object = taskEntityCandidate(ref.object_type, ref.object_id, knownTaskIds);
    if (object) return object;
  }
  return null;
}

function completionEvent(event: LivingGraphCanonicalEvent): boolean {
  const eventType = event.eventType.toLowerCase();
  if (
    eventType.includes("completed") ||
    eventType.includes("implemented") ||
    eventType.includes("tested")
  ) {
    return true;
  }
  return isCompletedStatus(event.toState);
}

function elapsed(events: readonly LivingGraphCanonicalEvent[]): {
  first: string | null;
  last: string | null;
  elapsedMs: number | null;
} {
  const times = events
    .map((event) => event.occurredAt)
    .filter((value): value is string => value != null)
    .map((value) => ({ iso: value, ms: Date.parse(value) }))
    .filter((value) => Number.isFinite(value.ms))
    .sort((a, b) => a.ms - b.ms);
  if (times.length === 0) return { first: null, last: null, elapsedMs: null };
  return {
    first: times[0].iso,
    last: times[times.length - 1].iso,
    elapsedMs: times[times.length - 1].ms - times[0].ms,
  };
}

/** Build one honest, chronological case per roadmap task. */
export function buildTaskCaseSummaries(input: {
  tasks: readonly RoadmapTask[];
  milestones: readonly Milestone[];
  events: readonly LivingGraphCanonicalEvent[];
  subtasks?: readonly SubtaskLayerRow[];
  attachments?: readonly TaskAttachmentRef[];
}): TaskCaseSummary[] {
  const knownTaskIds = new Set(input.tasks.map((task) => task.id));
  const milestoneTitleById = new Map(
    input.milestones.map((milestone) => [milestone.id, milestone.title]),
  );
  const eventsByTask = new Map<string, LivingGraphCanonicalEvent[]>();
  for (const event of input.events) {
    const taskId = taskIdForCanonicalEvent(event, knownTaskIds);
    if (!taskId) continue;
    const list = eventsByTask.get(taskId) ?? [];
    list.push(event);
    eventsByTask.set(taskId, list);
  }

  const subtasksByTask = new Map<string, SubtaskLayerRow[]>();
  for (const subtask of input.subtasks ?? []) {
    if (subtask.deleted_at) continue;
    const list = subtasksByTask.get(subtask.task_id) ?? [];
    list.push(subtask);
    subtasksByTask.set(subtask.task_id, list);
  }

  const attachmentsByTask = new Map<string, TaskAttachmentRef[]>();
  for (const attachment of input.attachments ?? []) {
    const list = attachmentsByTask.get(attachment.taskId) ?? [];
    list.push(attachment);
    attachmentsByTask.set(attachment.taskId, list);
  }

  return input.tasks.map((task) => {
    const events = [...(eventsByTask.get(task.id) ?? [])].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber,
    );
    const subtasks = [...(subtasksByTask.get(task.id) ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
    const attachments = [...(attachmentsByTask.get(task.id) ?? [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const evidenceRefs = events.flatMap((event) =>
      event.objectRefs
        .filter((ref) => ref.role === "evidence")
        .map((ref) => ({
          eventId: event.eventId,
          objectType: ref.object_type,
          objectId: ref.object_id,
        })),
    );
    const taskIsComplete = isCompletedStatus(task.status);
    const hasCompletionEvent = events.some(completionEvent);
    const hasAcceptanceCriteria = Boolean(task.acceptance_criteria?.trim());
    const hasEvidence = evidenceRefs.length > 0 || attachments.length > 0;
    const verificationState: TaskCaseVerificationState = !taskIsComplete
      ? "not_complete"
      : task.completed_at && hasCompletionEvent && hasAcceptanceCriteria && hasEvidence
        ? "verified_complete"
        : "complete_unverified";
    const warningCodes: TaskCaseWarningCode[] = [];
    if (events.length === 0) warningCodes.push("no_history");
    if (!hasAcceptanceCriteria) warningCodes.push("missing_acceptance_criteria");
    if (!hasEvidence) warningCodes.push("missing_evidence");
    if (taskIsComplete && !hasCompletionEvent) warningCodes.push("missing_completion_event");
    if (taskIsComplete && !task.completed_at) warningCodes.push("missing_completion_timestamp");
    if (!taskIsComplete) warningCodes.push("incomplete");
    const eventSpan = elapsed(events);

    return {
      task,
      milestoneTitle: task.milestone_id
        ? (milestoneTitleById.get(task.milestone_id) ?? null)
        : null,
      events,
      subtasks,
      attachments,
      evidenceRefs,
      firstOccurredAt: eventSpan.first,
      lastOccurredAt: eventSpan.last,
      elapsedMs: eventSpan.elapsedMs,
      completedSubtasks: subtasks.filter((subtask) =>
        isCompletedStatus(subtask.status) || subtask.status === "completed"
      ).length,
      hasCompletionEvent,
      verificationState,
      warningCodes,
    };
  });
}
