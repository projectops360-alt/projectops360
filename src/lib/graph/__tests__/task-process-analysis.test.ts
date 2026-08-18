import { describe, expect, it } from "vitest";
import type { RoadmapTask } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import type { TimeEntry } from "@/lib/time-tracking/types";
import {
  aggregateTaskProcess,
  assessTaskProcessDiscovery,
  buildTaskProcessModel,
} from "../task-process-analysis";

function task(id: string, status: RoadmapTask["status"] = "in_progress"): RoadmapTask {
  return {
    id,
    organization_id: "org",
    project_id: "p1",
    milestone_id: null,
    title: `Task ${id}`,
    description: null,
    status,
    priority: "p2",
    sprint_name: null,
    estimate_hours: null,
    actual_hours: null,
    dependency_notes: null,
    acceptance_criteria: null,
    order_index: 0,
    external_key: id,
    execution_notes: null,
    completed_at: null,
    prompt_body: null,
    prompt_context: null,
    prompt_version: 1,
    last_prompt_sent_at: null,
    ai_tool_target: null,
    implementation_notes: null,
    test_notes: null,
    start_date: null,
    end_date: null,
    duration_days: null,
    progress: 0,
    is_blocked: false,
    blocker_reason: null,
    is_critical: false,
    slack_days: null,
    earliest_start: null,
    earliest_finish: null,
    latest_start: null,
    latest_finish: null,
    created_by: null,
    assigned_to: null,
    assigned_resource_id: null,
    assignment_type: null,
    required_skills: [],
    required_crew_size: null,
    estimated_labor_hours: null,
    location_zone: null,
    discipline: null,
    trade_key: null,
    cost_code: null,
    budget_item_id: null,
    source_drawing_id: null,
    source_insight_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
  };
}

function event(taskId: string, sequenceNumber: number, eventType: string): LivingGraphCanonicalEvent {
  return {
    eventId: `${taskId}-${sequenceNumber}`,
    organizationId: "org",
    projectId: "p1",
    caseId: "p1",
    eventType,
    eventCategory: "task",
    eventSchemaVersion: 1,
    eventImportance: "MEDIUM",
    lifecycleClass: "BUSINESS_EVENT",
    subjectType: "task",
    subjectId: taskId,
    actorType: "system",
    actorId: null,
    occurredAt: new Date(Date.UTC(2026, 0, sequenceNumber)).toISOString(),
    recordedAt: new Date(Date.UTC(2026, 0, sequenceNumber)).toISOString(),
    sequenceNumber,
    sourceModule: "roadmap",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: taskId,
    fromState: null,
    toState: null,
    causedBy: [],
    isCompensatingEvent: false,
    compensatesEventId: null,
    eventHash: null,
    previousEventHash: null,
    provenance: null,
    confidence: null,
    payload: null,
    visibility: "normal",
    objectRefs: [],
    dataQualityFlags: [],
    captureMethod: "system",
    lateRecorded: false,
  };
}

function timeEntry(taskId: string, workDate: string): TimeEntry {
  return {
    id: `${taskId}-${workDate}`,
    organization_id: "org",
    project_id: "p1",
    task_id: taskId,
    subtask_id: null,
    user_id: "user",
    work_date: workDate,
    start_time: null,
    end_time: null,
    duration_hours: 8,
    crew_size: 1,
    hours_per_person: 8,
    comment: null,
    source: "manual",
    created_by: null,
    updated_by: null,
    created_at: `${workDate}T00:00:00.000Z`,
    updated_at: `${workDate}T00:00:00.000Z`,
    deleted_at: null,
  };
}

describe("task lifecycle process analysis", () => {
  it("groups task cases into variants and weighted direct-follow transitions", () => {
    const tasks = [task("t1", "done"), task("t2", "done"), task("t3")];
    const events = [
      event("t1", 1, "TaskCreated"), event("t1", 2, "TaskStarted"), event("t1", 3, "TaskCompleted"),
      event("t2", 4, "TaskCreated"), event("t2", 5, "TaskStarted"), event("t2", 6, "TaskCompleted"),
      event("t3", 7, "TaskCreated"), event("t3", 8, "TaskBlocked"),
    ];
    const model = buildTaskProcessModel({ tasks, events });
    expect(model.variants.analyzedCases).toBe(3);
    expect(model.variants.variants[0].caseCount).toBe(2);

    const aggregate = aggregateTaskProcess(model, {
      activityCoveragePct: 100,
      connectionCoveragePct: 100,
    });
    expect(aggregate.activities.find((row) => row.eventType === "TaskCreated")?.caseCount).toBe(3);
    expect(
      aggregate.transitions.find(
        (row) => row.sourceEventType === "TaskCreated" && row.targetEventType === "TaskStarted",
      )?.caseCount,
    ).toBe(2);
  });

  it("filters the aggregate to the selected variant cases", () => {
    const tasks = [task("t1", "done"), task("t2")];
    const events = [
      event("t1", 1, "TaskCreated"), event("t1", 2, "TaskCompleted"),
      event("t2", 3, "TaskCreated"), event("t2", 4, "TaskBlocked"),
    ];
    const model = buildTaskProcessModel({ tasks, events });
    const completedVariant = model.variants.variants.find((variant) =>
      variant.signature.includes("TaskCompleted"),
    )!;
    const aggregate = aggregateTaskProcess(model, {
      caseIds: new Set(completedVariant.caseIds),
      activityCoveragePct: 100,
      connectionCoveragePct: 100,
    });
    expect(aggregate.visibleCaseCount).toBe(1);
    expect(aggregate.activities.some((row) => row.eventType === "TaskBlocked")).toBe(false);
  });

  it("flags a repeated single event type as insufficient for process discovery", () => {
    const tasks = [task("t1"), task("t2")];
    const events = [
      event("t1", 1, "TaskStatusChanged"),
      event("t1", 2, "TaskStatusChanged"),
      event("t2", 3, "TaskStatusChanged"),
      event("t2", 4, "TaskStatusChanged"),
    ];
    const aggregate = aggregateTaskProcess(buildTaskProcessModel({ tasks, events }), {
      activityCoveragePct: 100,
      connectionCoveragePct: 100,
    });

    expect(assessTaskProcessDiscovery(aggregate)).toMatchObject({
      status: "single_activity",
      isDiscoverable: false,
      distinctActivityCount: 1,
      directFollowCount: 0,
    });
  });

  it("marks a multi-activity direct-follow path as discoverable", () => {
    const tasks = [task("t1")];
    const events = [
      event("t1", 1, "TaskCreated"),
      event("t1", 2, "TaskStarted"),
    ];
    const aggregate = aggregateTaskProcess(buildTaskProcessModel({ tasks, events }), {
      activityCoveragePct: 100,
      connectionCoveragePct: 100,
    });

    expect(assessTaskProcessDiscovery(aggregate)).toMatchObject({
      status: "ready",
      isDiscoverable: true,
      distinctActivityCount: 2,
      directFollowCount: 1,
    });
  });
  it("keeps imported events in the process path but excludes capture latency", () => {
    const created = {
      ...event("t1", 1, "TaskCreated"),
      captureMethod: "imported",
    };
    const started = {
      ...event("t1", 2, "TaskStarted"),
      captureMethod: "imported",
    };
    const aggregate = aggregateTaskProcess(
      buildTaskProcessModel({ tasks: [task("t1")], events: [created, started] }),
      { activityCoveragePct: 100, connectionCoveragePct: 100 },
    );
    const transition = aggregate.transitions.find(
      (row) =>
        row.sourceEventType === "TaskCreated" &&
        row.targetEventType === "TaskStarted",
    );

    expect(aggregate.visibleEventCount).toBe(2);
    expect(transition).toMatchObject({
      occurrenceCount: 1,
      medianDurationMs: null,
      qualifiedDurationCount: 0,
      temporalConflictCount: 0,
      durationEvidenceStatus: "insufficient_evidence",
    });
  });

  it("excludes lifecycle duration that conflicts with operational work dates", () => {
    const started = {
      ...event("t1", 1, "TaskStarted"),
      occurredAt: "2026-08-06T21:07:14.152Z",
      recordedAt: "2026-08-06T21:07:14.152Z",
    };
    const completed = {
      ...event("t1", 2, "TaskCompleted"),
      occurredAt: "2026-08-06T21:09:41.000Z",
      recordedAt: "2026-08-06T21:09:41.000Z",
    };
    const aggregate = aggregateTaskProcess(
      buildTaskProcessModel({
        tasks: [task("t1", "done")],
        events: [started, completed],
        timeEntries: [timeEntry("t1", "2026-02-25")],
      }),
      { activityCoveragePct: 100, connectionCoveragePct: 100 },
    );

    expect(aggregate.transitions[0]).toMatchObject({
      occurrenceCount: 1,
      medianDurationMs: null,
      qualifiedDurationCount: 0,
      temporalConflictCount: 1,
      durationEvidenceStatus: "temporal_conflict",
    });
  });

});
