// ============================================================================
// ProjectOps360° — Subtasks · Canonical event builders (pure, tested)
// ============================================================================
// Builds the EmitEventInput for every subtask lifecycle event so the Project
// Event Graph (and through it the Living Graph / LGRE pipeline) understands
// subtask execution. Pure builders — the server actions call
// emitProjectEventSafe with these; the event types are registered in the
// Canonical Event Taxonomy (events/registry.ts). Every event carries actor,
// org, project, task, subtask, old/new values, reason when applicable, and
// timestamp metadata per the taxonomy envelope.
// ============================================================================

import type { EmitEventInput } from "@/lib/events/ingestion";

export type SubtaskEventType =
  | "SubtaskCreated"
  | "SubtaskUpdated"
  | "SubtaskStarted"
  | "SubtaskCompleted"
  | "SubtaskBlocked"
  | "SubtaskUnblocked"
  | "SubtaskReassigned"
  | "SubtaskDueDateChanged"
  | "SubtaskEstimateChanged"
  | "SubtaskProgressChanged"
  | "SubtaskDeleted"
  | "ParentTaskProgressRecalculated"
  | "ParentTaskProgressOverride";

export interface SubtaskEventArgs {
  eventType: SubtaskEventType;
  organizationId: string;
  projectId: string;
  taskId: string;
  /** Null for parent-level events (recalculated/override). */
  subtaskId: string | null;
  actorId: string;
  title: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

/** Parent-level events subject = the task; subtask events subject = the subtask. */
export function buildSubtaskEvent(args: SubtaskEventArgs): EmitEventInput {
  const isParentEvent =
    args.eventType === "ParentTaskProgressRecalculated" ||
    args.eventType === "ParentTaskProgressOverride";
  const payload: Record<string, unknown> = {
    title: args.title,
    task_id: args.taskId,
    ...(args.subtaskId ? { subtask_id: args.subtaskId } : {}),
    ...(args.oldValue !== undefined ? { old_value: args.oldValue } : {}),
    ...(args.newValue !== undefined ? { new_value: args.newValue } : {}),
    ...(args.reason ? { reason: args.reason } : {}),
    ...(args.metadata ?? {}),
  };
  // Registry requiredPayload contracts (see events/registry.ts):
  if (args.eventType === "SubtaskBlocked") payload.impediment = args.reason ?? "unspecified";
  return {
    organizationId: args.organizationId,
    projectId: args.projectId,
    eventType: args.eventType,
    subjectId: isParentEvent ? args.taskId : (args.subtaskId ?? args.taskId),
    actorType: "human",
    actorId: args.actorId,
    sourceModule: "subtasks",
    sourceEntityType: isParentEvent ? "roadmap_tasks" : "task_subtasks",
    sourceEntityId: isParentEvent ? args.taskId : (args.subtaskId ?? args.taskId),
    occurredAt: args.occurredAt,
    payload,
  };
}
