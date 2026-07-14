import { emitProjectEvents, type EmitEventInput, type EmitResult, type EventObjectRef } from "./ingestion";
import { isProcessMiningEventCaptureEnabled } from "./process-mining-capture-flag";
import type { ActorType, CaptureMethod, DataQualityFlag } from "./registry";

export interface ProcessMiningCaptureSource {
  actorType: ActorType;
  actorId?: string | null;
  sourceModule: string;
  captureMethod: CaptureMethod;
  occurredAt?: string;
  dataQualityFlags?: DataQualityFlag[];
  provenance?: Record<string, unknown>;
}

export interface TaskCaptureSnapshot {
  taskId: string;
  organizationId: string;
  projectId: string;
  title: string;
  status: string;
  milestoneId?: string | null;
  assignedTo?: string | null;
  assignedResourceId?: string | null;
  projectTeamMemberId?: string | null;
  priority?: string | null;
  estimateHours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export const TASK_CAPTURE_SELECT = "id, title, status, milestone_id, assigned_to, assigned_resource_id, project_team_member_id, priority, estimate_hours, start_date, end_date";

export interface TaskCaptureRow {
  id: string;
  title: string;
  status: string;
  milestone_id: string | null;
  assigned_to: string | null;
  assigned_resource_id: string | null;
  project_team_member_id: string | null;
  priority: string | null;
  estimate_hours: number | null;
  start_date: string | null;
  end_date: string | null;
}

export function taskCaptureSnapshotFromRow(
  row: TaskCaptureRow,
  organizationId: string,
  projectId: string,
): TaskCaptureSnapshot {
  return {
    taskId: row.id,
    organizationId,
    projectId,
    title: row.title,
    status: row.status,
    milestoneId: row.milestone_id,
    assignedTo: row.assigned_to,
    assignedResourceId: row.assigned_resource_id,
    projectTeamMemberId: row.project_team_member_id,
    priority: row.priority,
    estimateHours: row.estimate_hours,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export interface MilestoneCaptureSnapshot {
  milestoneId: string;
  organizationId: string;
  projectId: string;
  title: string;
  status: string;
}

export interface DependencyCaptureSnapshot {
  dependencyId: string;
  organizationId: string;
  projectId: string;
  predecessorId: string;
  successorId: string;
  dependencyType: string;
  lagDays?: number | null;
}

export interface ProcessMiningCaptureResult {
  enabled: boolean;
  complete: boolean;
  results: EmitResult[];
}

const STATUS_EVENT_TYPES: Readonly<Record<string, string>> = {
  prompt_ready: "TaskPromptPrepared",
  sent_to_ai: "TaskAISubmitted",
  in_progress: "TaskStarted",
  implemented: "TaskImplemented",
  tested: "TaskTested",
  done: "TaskCompleted",
  deferred: "TaskDeferred",
};

function assigneeObject(task: TaskCaptureSnapshot): EventObjectRef | null {
  if (task.projectTeamMemberId) {
    return { objectType: "project_team_member", objectId: task.projectTeamMemberId, role: "responsibility" };
  }
  if (task.assignedTo) {
    return { objectType: "user", objectId: task.assignedTo, role: "responsibility" };
  }
  if (task.assignedResourceId) {
    return { objectType: "resource", objectId: task.assignedResourceId, role: "responsibility" };
  }
  return null;
}

function assigneeRef(task: TaskCaptureSnapshot): string | null {
  const ref = assigneeObject(task);
  return ref ? `${ref.objectType}:${ref.objectId}` : null;
}

function uniqueRefs(refs: EventObjectRef[]): EventObjectRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.objectType}|${ref.objectId}|${ref.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function provenance(
  source: ProcessMiningCaptureSource,
  extraFlags: DataQualityFlag[] = [],
): Record<string, unknown> {
  const flags = new Set<DataQualityFlag>([
    ...(source.dataQualityFlags ?? []),
    ...extraFlags,
  ]);
  if (source.captureMethod === "imported") flags.add("imported");
  if (source.captureMethod === "derived") flags.add("derived");
  if (!source.actorId && source.actorType !== "system") flags.add("missing_actor");
  return {
    capture_method: source.captureMethod,
    ...(flags.size > 0 ? { data_quality_flags: [...flags] } : {}),
    ...(source.provenance ?? {}),
  };
}

function taskObjectRefs(task: TaskCaptureSnapshot): EventObjectRef[] {
  const refs: EventObjectRef[] = [
    { objectType: "task", objectId: task.taskId, role: "focal" },
    { objectType: "project", objectId: task.projectId, role: "context" },
  ];
  if (task.milestoneId) {
    refs.push({ objectType: "milestone", objectId: task.milestoneId, role: "phase" });
  }
  const assignee = assigneeObject(task);
  if (assignee) refs.push(assignee);
  return uniqueRefs(refs);
}

function taskEvent(
  task: TaskCaptureSnapshot,
  source: ProcessMiningCaptureSource,
  eventType: string,
  options: {
    fromState?: string | null;
    toState?: string | null;
    payload?: Record<string, unknown>;
    extraFlags?: DataQualityFlag[];
    objectRefs?: EventObjectRef[];
  } = {},
): EmitEventInput {
  return {
    organizationId: task.organizationId,
    projectId: task.projectId,
    eventType,
    subjectId: task.taskId,
    actorType: source.actorType,
    actorId: source.actorId ?? null,
    occurredAt: source.occurredAt,
    sourceModule: source.sourceModule,
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: task.taskId,
    caseId: task.taskId,
    fromState: options.fromState ?? null,
    toState: options.toState ?? null,
    provenance: provenance(source, options.extraFlags),
    payload: options.payload ?? {},
    objectRefs: uniqueRefs([
      ...taskObjectRefs(task),
      ...(options.objectRefs ?? []),
    ]),
  };
}

function milestoneEvent(
  milestone: MilestoneCaptureSnapshot,
  source: ProcessMiningCaptureSource,
  eventType: string,
  options: {
    fromState?: string | null;
    toState?: string | null;
    payload?: Record<string, unknown>;
  } = {},
): EmitEventInput {
  return {
    organizationId: milestone.organizationId,
    projectId: milestone.projectId,
    eventType,
    subjectId: milestone.milestoneId,
    actorType: source.actorType,
    actorId: source.actorId ?? null,
    occurredAt: source.occurredAt,
    sourceModule: source.sourceModule,
    sourceEntityType: "milestones",
    sourceEntityId: milestone.milestoneId,
    caseId: milestone.milestoneId,
    fromState: options.fromState ?? null,
    toState: options.toState ?? null,
    provenance: provenance(source),
    payload: options.payload ?? {},
    objectRefs: [
      { objectType: "milestone", objectId: milestone.milestoneId, role: "focal" },
      { objectType: "project", objectId: milestone.projectId, role: "context" },
    ],
  };
}

export function buildTaskStatusTransitionEvent(input: {
  task: TaskCaptureSnapshot;
  fromStatus: string;
  toStatus: string;
  source: ProcessMiningCaptureSource;
  note?: string | null;
}): EmitEventInput | null {
  if (input.fromStatus === input.toStatus) return null;

  let eventType: string;
  let payload: Record<string, unknown> = {};
  let flags: DataQualityFlag[] = [];

  if (input.fromStatus === "done" && input.toStatus !== "done") {
    eventType = "TaskReopened";
  } else if (input.fromStatus === "blocked" && input.toStatus !== "blocked") {
    eventType = "TaskUnblocked";
  } else if (input.fromStatus === "deferred" && input.toStatus !== "deferred") {
    eventType = "TaskResumed";
  } else if (input.toStatus === "blocked") {
    const impediment = input.note?.trim();
    if (impediment) {
      eventType = "TaskBlocked";
      payload = { impediment };
    } else {
      eventType = "TaskStatusChanged";
      payload = { semantic_target: "TaskBlocked" };
      flags = ["incomplete_payload", "unknown_reason"];
    }
  } else {
    eventType = STATUS_EVENT_TYPES[input.toStatus] ?? "TaskStatusChanged";
    if (eventType === "TaskStatusChanged") {
      payload = { semantic_target: "unmapped_task_status" };
      flags = ["mapping_low_confidence"];
    }
  }

  return taskEvent(input.task, input.source, eventType, {
    fromState: input.fromStatus,
    toState: input.toStatus,
    payload: {
      ...payload,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    },
    extraFlags: flags,
  });
}

export function buildTaskCreatedEvents(input: {
  task: TaskCaptureSnapshot;
  source: ProcessMiningCaptureSource;
  blockerReason?: string | null;
}): EmitEventInput[] {
  const events: EmitEventInput[] = [
    taskEvent(input.task, input.source, "TaskCreated", {
      toState: input.task.status,
      payload: {
        title: input.task.title,
        initial_status: input.task.status,
        ...(input.task.milestoneId ? { milestone_id: input.task.milestoneId } : {}),
      },
    }),
  ];

  const currentAssignee = assigneeRef(input.task);
  if (currentAssignee) {
    events.push(taskEvent(input.task, input.source, "TaskAssigned", {
      payload: { assignee_ref: currentAssignee },
    }));
  }

  if (input.task.status !== "not_started") {
    const statusEvent = buildTaskStatusTransitionEvent({
      task: input.task,
      fromStatus: "not_started",
      toStatus: input.task.status,
      source: input.source,
      note: input.blockerReason,
    });
    if (statusEvent) events.push(statusEvent);
  }

  return events;
}

export function buildTaskMutationEvents(input: {
  before: TaskCaptureSnapshot;
  after: TaskCaptureSnapshot;
  source: ProcessMiningCaptureSource;
  note?: string | null;
}): EmitEventInput[] {
  const events: EmitEventInput[] = [];
  const previousAssignee = assigneeRef(input.before);
  const nextAssignee = assigneeRef(input.after);
  const previousAssigneeObject = assigneeObject(input.before);

  if (previousAssignee !== nextAssignee) {
    if (nextAssignee) {
      events.push(taskEvent(input.after, input.source, "TaskAssigned", {
        payload: {
          assignee_ref: nextAssignee,
          ...(previousAssignee ? { previous_assignee_ref: previousAssignee } : {}),
        },
        objectRefs: previousAssigneeObject
          ? [{ ...previousAssigneeObject, role: "previous_responsibility" }]
          : [],
      }));
    } else {
      events.push(taskEvent(input.after, input.source, "TaskUnassigned", {
        payload: previousAssignee ? { previous_assignee_ref: previousAssignee } : {},
        objectRefs: previousAssigneeObject
          ? [{ ...previousAssigneeObject, role: "previous_responsibility" }]
          : [],
      }));
    }
  }

  if ((input.before.milestoneId ?? null) !== (input.after.milestoneId ?? null)) {
    events.push(taskEvent(input.after, input.source, "TaskMoved", {
      payload: {
        previous_milestone_id: input.before.milestoneId ?? null,
        new_milestone_id: input.after.milestoneId ?? null,
      },
      objectRefs: [
        ...(input.before.milestoneId
          ? [{ objectType: "milestone", objectId: input.before.milestoneId, role: "previous_phase" }]
          : []),
      ],
    }));
  }

  if ((input.before.startDate ?? null) !== (input.after.startDate ?? null)) {
    events.push(taskEvent(input.after, input.source, "TaskStartDateChanged", {
      payload: {
        previous_start_date: input.before.startDate ?? null,
        new_start_date: input.after.startDate ?? null,
      },
    }));
  }

  if ((input.before.endDate ?? null) !== (input.after.endDate ?? null)) {
    events.push(taskEvent(input.after, input.source, "TaskDueDateChanged", {
      payload: {
        previous_due_date: input.before.endDate ?? null,
        new_due_date: input.after.endDate ?? null,
      },
    }));
  }

  if ((input.before.estimateHours ?? null) !== (input.after.estimateHours ?? null)) {
    events.push(taskEvent(input.after, input.source, "TaskEstimateChanged", {
      payload: {
        previous_estimate_hours: input.before.estimateHours ?? null,
        new_estimate_hours: input.after.estimateHours ?? null,
      },
    }));
  }

  if ((input.before.priority ?? null) !== (input.after.priority ?? null)) {
    events.push(taskEvent(input.after, input.source, "TaskPriorityChanged", {
      payload: {
        previous_priority: input.before.priority ?? null,
        new_priority: input.after.priority ?? null,
      },
    }));
  }

  const statusEvent = buildTaskStatusTransitionEvent({
    task: input.after,
    fromStatus: input.before.status,
    toStatus: input.after.status,
    source: input.source,
    note: input.note,
  });
  if (statusEvent) events.push(statusEvent);

  return events;
}

export function buildTaskDeletedEvent(input: {
  task: TaskCaptureSnapshot;
  source: ProcessMiningCaptureSource;
}): EmitEventInput {
  return taskEvent(input.task, input.source, "TaskDeleted", {
    fromState: input.task.status,
    payload: { title: input.task.title },
  });
}

export function buildMilestoneCreatedEvents(input: {
  milestone: MilestoneCaptureSnapshot;
  source: ProcessMiningCaptureSource;
}): EmitEventInput[] {
  const events = [
    milestoneEvent(input.milestone, input.source, "MilestoneCreated", {
      toState: input.milestone.status,
      payload: {
        title: input.milestone.title,
        initial_status: input.milestone.status,
      },
    }),
  ];
  if (input.milestone.status !== "planned") {
    const statusEvent = buildMilestoneStatusTransitionEvent({
      milestone: input.milestone,
      fromStatus: "planned",
      toStatus: input.milestone.status,
      source: input.source,
    });
    if (statusEvent) events.push(statusEvent);
  }
  return events;
}

export function buildMilestoneStatusTransitionEvent(input: {
  milestone: MilestoneCaptureSnapshot;
  fromStatus: string;
  toStatus: string;
  source: ProcessMiningCaptureSource;
}): EmitEventInput | null {
  if (input.fromStatus === input.toStatus) return null;
  let eventType = "MilestoneUpdated";
  if (input.fromStatus === "completed" && input.toStatus !== "completed") {
    eventType = "MilestoneReopened";
  } else if (input.toStatus === "in_progress") {
    eventType = "MilestoneStarted";
  } else if (input.toStatus === "completed") {
    eventType = "MilestoneAchieved";
  } else if (input.toStatus === "blocked") {
    eventType = "MilestoneBlocked";
  } else if (input.toStatus === "deferred") {
    eventType = "MilestoneDeferred";
  }
  return milestoneEvent(input.milestone, input.source, eventType, {
    fromState: input.fromStatus,
    toState: input.toStatus,
  });
}

export function buildMilestoneDeletedEvent(input: {
  milestone: MilestoneCaptureSnapshot;
  source: ProcessMiningCaptureSource;
}): EmitEventInput {
  return milestoneEvent(input.milestone, input.source, "MilestoneDeleted", {
    fromState: input.milestone.status,
    payload: { title: input.milestone.title },
  });
}

export function buildTaskDependencyEvent(input: {
  dependency: DependencyCaptureSnapshot;
  change: "added" | "removed";
  source: ProcessMiningCaptureSource;
}): EmitEventInput {
  const { dependency } = input;
  return {
    organizationId: dependency.organizationId,
    projectId: dependency.projectId,
    eventType: input.change === "added" ? "TaskDependencyAdded" : "TaskDependencyRemoved",
    subjectId: dependency.successorId,
    actorType: input.source.actorType,
    actorId: input.source.actorId ?? null,
    occurredAt: input.source.occurredAt,
    sourceModule: input.source.sourceModule,
    sourceEntityType: "task_dependencies",
    sourceEntityId: dependency.dependencyId,
    caseId: dependency.successorId,
    provenance: provenance(input.source),
    payload: {
      dependency_id: dependency.dependencyId,
      dependency_type: dependency.dependencyType,
      lag_days: dependency.lagDays ?? 0,
    },
    objectRefs: [
      { objectType: "task", objectId: dependency.successorId, role: "focal" },
      { objectType: "task", objectId: dependency.predecessorId, role: "predecessor" },
      { objectType: "dependency", objectId: dependency.dependencyId, role: "relation" },
      { objectType: "project", objectId: dependency.projectId, role: "context" },
    ],
  };
}

export async function captureProcessMiningEvents(
  events: EmitEventInput[],
): Promise<ProcessMiningCaptureResult> {
  if (events.length === 0) return { enabled: false, complete: true, results: [] };
  const projectId = events[0].projectId;
  if (events.some((event) => event.projectId !== projectId)) {
    return {
      enabled: true,
      complete: false,
      results: [{ ok: false, error: "mixed_project_batch" }],
    };
  }
  if (!isProcessMiningEventCaptureEnabled(projectId)) {
    return { enabled: false, complete: false, results: [] };
  }
  try {
    const results = await emitProjectEvents(events);
    const complete = results.every((result) => result.ok);
    if (!complete) {
      console.error(
        "[events] process-mining capture incomplete:",
        results.filter((result) => !result.ok),
      );
    }
    return { enabled: true, complete, results };
  } catch (error) {
    console.error("[events] process-mining capture exception:", error);
    return {
      enabled: true,
      complete: false,
      results: [{ ok: false, error: "exception" }],
    };
  }
}
