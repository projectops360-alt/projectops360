import { describe, expect, it } from "vitest";
import {
  buildMilestoneCreatedEvents,
  buildMilestoneDeletedEvent,
  buildMilestoneStatusTransitionEvent,
  buildTaskCreatedEvents,
  buildTaskDependencyEvent,
  buildTaskMutationEvents,
  buildTaskStatusTransitionEvent,
  type MilestoneCaptureSnapshot,
  type ProcessMiningCaptureSource,
  type TaskCaptureSnapshot,
} from "@/lib/events/process-mining-capture";
import { isProcessMiningEventCaptureEnabledFor } from "@/lib/events/process-mining-capture-flag";
import { validateProjectEvent } from "@/lib/events/ingestion";
import { isPastTenseName, isRegisteredEvent } from "@/lib/events/registry";
import {
  aggregateTaskProcess,
  assessTaskProcessDiscovery,
  buildTaskProcessModel,
} from "@/lib/graph/task-process-analysis";
import type { RoadmapTask } from "@/types/database";
import type {
  CanonicalEventObjectRole,
  LivingGraphCanonicalEvent,
} from "@/types/living-graph";

const ORG = "11111111-1111-1111-1111-111111111111";
const PROJECT = "22222222-2222-2222-2222-222222222222";
const TASK = "33333333-3333-3333-3333-333333333333";
const MILESTONE = "44444444-4444-4444-4444-444444444444";
const USER = "55555555-5555-5555-5555-555555555555";

const source: ProcessMiningCaptureSource = {
  actorType: "human",
  actorId: USER,
  sourceModule: "roadmap",
  captureMethod: "direct",
  occurredAt: "2026-07-13T18:00:00.000Z",
};

const task: TaskCaptureSnapshot = {
  taskId: TASK,
  organizationId: ORG,
  projectId: PROJECT,
  title: "Implement minimum event capture",
  status: "not_started",
  milestoneId: MILESTONE,
  assignedTo: USER,
  priority: "p1",
  estimateHours: 8,
  startDate: "2026-07-13",
  endDate: "2026-07-14",
};

const milestone: MilestoneCaptureSnapshot = {
  milestoneId: MILESTONE,
  organizationId: ORG,
  projectId: PROJECT,
  title: "Event Architecture",
  status: "planned",
};

describe("process-mining capture flag", () => {
  it("is default-off and project-scoped", () => {
    expect(isProcessMiningEventCaptureEnabledFor(PROJECT, undefined)).toBe(false);
    expect(isProcessMiningEventCaptureEnabledFor(PROJECT, "")).toBe(false);
    expect(isProcessMiningEventCaptureEnabledFor(PROJECT, "all")).toBe(true);
    expect(isProcessMiningEventCaptureEnabledFor(PROJECT, `other, ${PROJECT}`)).toBe(true);
    expect(isProcessMiningEventCaptureEnabledFor(PROJECT, "other")).toBe(false);
  });
});

describe("mining-ready task lifecycle builders", () => {
  it("creates a task case with focal, project, milestone and responsibility refs", () => {
    const events = buildTaskCreatedEvents({ task, source });
    expect(events.map((event) => event.eventType)).toEqual(["TaskCreated", "TaskAssigned"]);
    expect(events[0].caseId).toBe(TASK);
    expect(events[0].actorId).toBe(USER);
    expect(events[0].provenance).toMatchObject({ capture_method: "direct" });
    expect(events[0].objectRefs).toEqual(expect.arrayContaining([
      { objectType: "task", objectId: TASK, role: "focal" },
      { objectType: "project", objectId: PROJECT, role: "context" },
      { objectType: "milestone", objectId: MILESTONE, role: "phase" },
      { objectType: "user", objectId: USER, role: "responsibility" },
    ]));
    for (const event of events) expect(validateProjectEvent(event)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ["not_started", "prompt_ready", "TaskPromptPrepared"],
    ["prompt_ready", "sent_to_ai", "TaskAISubmitted"],
    ["sent_to_ai", "in_progress", "TaskStarted"],
    ["in_progress", "implemented", "TaskImplemented"],
    ["implemented", "tested", "TaskTested"],
    ["tested", "done", "TaskCompleted"],
    ["in_progress", "deferred", "TaskDeferred"],
    ["done", "in_progress", "TaskReopened"],
    ["blocked", "in_progress", "TaskUnblocked"],
    ["deferred", "in_progress", "TaskResumed"],
  ])("maps %s → %s to %s", (fromStatus, toStatus, eventType) => {
    const event = buildTaskStatusTransitionEvent({
      task: { ...task, status: toStatus },
      fromStatus,
      toStatus,
      source,
      note: "recorded reason",
    });
    expect(event?.eventType).toBe(eventType);
    expect(event?.fromState).toBe(fromStatus);
    expect(event?.toState).toBe(toStatus);
    expect(event && validateProjectEvent(event).ok).toBe(true);
  });

  it("uses TaskBlocked only with a real impediment", () => {
    const complete = buildTaskStatusTransitionEvent({
      task: { ...task, status: "blocked" },
      fromStatus: "in_progress",
      toStatus: "blocked",
      source,
      note: "Waiting for owner approval",
    });
    expect(complete?.eventType).toBe("TaskBlocked");
    expect(complete?.payload).toMatchObject({ impediment: "Waiting for owner approval" });

    const incomplete = buildTaskStatusTransitionEvent({
      task: { ...task, status: "blocked" },
      fromStatus: "in_progress",
      toStatus: "blocked",
      source,
    });
    expect(incomplete?.eventType).toBe("TaskStatusChanged");
    expect(incomplete?.provenance).toMatchObject({
      data_quality_flags: expect.arrayContaining(["incomplete_payload", "unknown_reason"]),
    });
    expect(incomplete && validateProjectEvent(incomplete).ok).toBe(true);
  });

  it("emits only meaningful changes from a full task edit", () => {
    const before = task;
    const after: TaskCaptureSnapshot = {
      ...task,
      status: "in_progress",
      milestoneId: null,
      assignedTo: null,
      priority: "p2",
      estimateHours: 13,
      endDate: "2026-07-16",
    };
    const events = buildTaskMutationEvents({ before, after, source });
    expect(events.map((event) => event.eventType)).toEqual([
      "TaskUnassigned",
      "TaskMoved",
      "TaskDueDateChanged",
      "TaskEstimateChanged",
      "TaskPriorityChanged",
      "TaskStarted",
    ]);
    expect(events.every((event) => event.caseId === TASK)).toBe(true);
    expect(events.every((event) => validateProjectEvent(event).ok)).toBe(true);
    expect(events[0].objectRefs).toContainEqual({
      objectType: "user",
      objectId: USER,
      role: "previous_responsibility",
    });
  });

  it("adds an initial semantic activity when a task enters with a non-default status", () => {
    const imported = buildTaskCreatedEvents({
      task: { ...task, assignedTo: null, status: "done" },
      source: { ...source, captureMethod: "imported", sourceModule: "import-intelligence" },
    });
    expect(imported.map((event) => event.eventType)).toEqual(["TaskCreated", "TaskCompleted"]);
    expect(imported[0].provenance).toMatchObject({
      capture_method: "imported",
      data_quality_flags: expect.arrayContaining(["imported"]),
    });
  });

  it("distinguishes planned start and due date changes", () => {
    const events = buildTaskMutationEvents({
      before: task,
      after: { ...task, startDate: "2026-07-14", endDate: "2026-07-15" },
      source,
    });
    expect(events.map((event) => event.eventType)).toEqual([
      "TaskStartDateChanged",
      "TaskDueDateChanged",
    ]);
  });

  it("produces a discoverable direct-follow process instead of one repeated activity", () => {
    const unassigned = { ...task, assignedTo: null };
    const inputs = [
      ...buildTaskCreatedEvents({
        task: unassigned,
        source: { ...source, occurredAt: "2026-07-13T18:00:00.000Z" },
      }),
      buildTaskStatusTransitionEvent({
        task: { ...unassigned, status: "in_progress" },
        fromStatus: "not_started",
        toStatus: "in_progress",
        source: { ...source, occurredAt: "2026-07-13T19:00:00.000Z" },
      })!,
      buildTaskStatusTransitionEvent({
        task: { ...unassigned, status: "done" },
        fromStatus: "in_progress",
        toStatus: "done",
        source: { ...source, occurredAt: "2026-07-13T20:00:00.000Z" },
      })!,
    ];
    const events = inputs.map((input, index) => ({
      eventId: `event-${index}`,
      organizationId: input.organizationId,
      projectId: input.projectId,
      caseId: input.caseId ?? input.projectId,
      eventType: input.eventType,
      eventCategory: "task",
      eventSchemaVersion: 1,
      eventImportance: "MEDIUM",
      lifecycleClass: "BUSINESS_EVENT",
      subjectType: "task",
      subjectId: input.subjectId ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      occurredAt: input.occurredAt ?? null,
      recordedAt: input.occurredAt ?? null,
      sequenceNumber: index + 1,
      sourceModule: input.sourceModule,
      sourceEntityType: input.sourceEntityType ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      causedBy: [],
      isCompensatingEvent: false,
      compensatesEventId: null,
      eventHash: null,
      previousEventHash: null,
      provenance: input.provenance ?? null,
      confidence: null,
      payload: input.payload ?? null,
      visibility: "normal",
      objectRefs: (input.objectRefs ?? []).map((ref) => ({
        object_type: ref.objectType,
        object_id: ref.objectId,
        role: ref.role as CanonicalEventObjectRole,
      })),
      dataQualityFlags: [],
      captureMethod: "direct",
      lateRecorded: false,
    })) as LivingGraphCanonicalEvent[];
    const taskRow = {
      id: TASK,
      title: task.title,
      status: "done",
      external_key: "P2-T2",
    } as RoadmapTask;
    const aggregate = aggregateTaskProcess(
      buildTaskProcessModel({ tasks: [taskRow], events }),
      { activityCoveragePct: 100, connectionCoveragePct: 100 },
    );

    expect(aggregate.activities.map((activity) => activity.eventType)).toEqual(expect.arrayContaining([
      "TaskCreated",
      "TaskStarted",
      "TaskCompleted",
    ]));
    expect(aggregate.transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceEventType: "TaskCreated", targetEventType: "TaskStarted" }),
      expect.objectContaining({ sourceEventType: "TaskStarted", targetEventType: "TaskCompleted" }),
    ]));
    expect(assessTaskProcessDiscovery(aggregate)).toMatchObject({ status: "ready", isDiscoverable: true });
  });
});

describe("milestone and dependency builders", () => {
  it("captures milestone creation and semantic phase transitions", () => {
    const created = buildMilestoneCreatedEvents({ milestone, source });
    expect(created.map((event) => event.eventType)).toEqual(["MilestoneCreated"]);
    expect(created[0].caseId).toBe(MILESTONE);

    const started = buildMilestoneStatusTransitionEvent({
      milestone: { ...milestone, status: "in_progress" },
      fromStatus: "planned",
      toStatus: "in_progress",
      source,
    });
    const achieved = buildMilestoneStatusTransitionEvent({
      milestone: { ...milestone, status: "completed" },
      fromStatus: "in_progress",
      toStatus: "completed",
      source,
    });
    expect(started?.eventType).toBe("MilestoneStarted");
    expect(achieved?.eventType).toBe("MilestoneAchieved");
    expect(started && validateProjectEvent(started).ok).toBe(true);
    expect(achieved && validateProjectEvent(achieved).ok).toBe(true);

    const deleted = buildMilestoneDeletedEvent({ milestone, source });
    expect(deleted.eventType).toBe("MilestoneDeleted");
    expect(deleted.caseId).toBe(MILESTONE);
    expect(validateProjectEvent(deleted).ok).toBe(true);
  });

  it("captures dependency direction as object references", () => {
    const event = buildTaskDependencyEvent({
      dependency: {
        dependencyId: "66666666-6666-6666-6666-666666666666",
        organizationId: ORG,
        projectId: PROJECT,
        predecessorId: "77777777-7777-7777-7777-777777777777",
        successorId: TASK,
        dependencyType: "finish_to_start",
        lagDays: 0,
      },
      change: "added",
      source,
    });
    expect(event.eventType).toBe("TaskDependencyAdded");
    expect(event.subjectId).toBe(TASK);
    expect(event.caseId).toBe(TASK);
    expect(event.objectRefs).toEqual(expect.arrayContaining([
      { objectType: "task", objectId: TASK, role: "focal" },
      { objectType: "task", objectId: "77777777-7777-7777-7777-777777777777", role: "predecessor" },
    ]));
    expect(validateProjectEvent(event)).toEqual({ ok: true, errors: [] });
  });

  it("registers every added semantic activity as a past-tense fact", () => {
    for (const eventType of [
      "TaskPromptPrepared",
      "TaskAISubmitted",
      "TaskImplemented",
      "TaskTested",
      "TaskDeferred",
      "TaskStartDateChanged",
      "MilestoneBlocked",
      "MilestoneDeferred",
      "MilestoneReopened",
      "MilestoneDeleted",
    ]) {
      expect(isRegisteredEvent(eventType), eventType).toBe(true);
      expect(isPastTenseName(eventType), eventType).toBe(true);
    }
  });
});
