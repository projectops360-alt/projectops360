import { describe, expect, it } from "vitest";
import type { RoadmapTask } from "@/types/database";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import type { TimeEntry } from "@/lib/time-tracking/types";
import { buildTaskFrictionEvidenceDataset } from "../task-dataset";

const PROJECT = "a40a7436-c63f-4e3b-94cd-041447ee54d4";

function task(overrides: Partial<RoadmapTask>): RoadmapTask {
  return {
    id: "93dff1de-c356-403e-9701-a1d184d5105e",
    organization_id: "org",
    project_id: PROJECT,
    milestone_id: "milestone",
    title: "Validación de servidores - GBM",
    description: null,
    status: "done",
    priority: "p2",
    sprint_name: null,
    estimate_hours: 56,
    actual_hours: 56,
    dependency_notes: null,
    acceptance_criteria: null,
    order_index: 0,
    external_key: null,
    execution_notes: null,
    completed_at: null,
    prompt_body: null,
    prompt_context: null,
    prompt_version: 1,
    last_prompt_sent_at: null,
    ai_tool_target: null,
    implementation_notes: null,
    test_notes: null,
    start_date: "2026-02-12",
    end_date: "2026-02-23",
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
    created_at: "2026-08-06T01:00:00.000Z",
    updated_at: "2026-08-06T01:00:00.000Z",
    deleted_at: null,
    baseline_start_date: "2026-02-12",
    baseline_end_date: "2026-02-23",
    baseline_estimate_hours: 56,
    ...overrides,
  };
}

function event(
  taskId: string,
  eventType: string,
  sequenceNumber: number,
  overrides: Partial<LivingGraphCanonicalEvent> = {},
): LivingGraphCanonicalEvent {
  const occurredAt = new Date(Date.UTC(2026, 7, 6, 20, sequenceNumber)).toISOString();
  return {
    eventId: `${taskId}-${eventType}-${sequenceNumber}`,
    organizationId: "org",
    projectId: PROJECT,
    caseId: PROJECT,
    eventType,
    eventCategory: "task",
    eventSchemaVersion: 1,
    eventImportance: "MEDIUM",
    lifecycleClass: "BUSINESS_EVENT",
    subjectType: "task",
    subjectId: taskId,
    actorType: "system",
    actorId: null,
    occurredAt,
    recordedAt: occurredAt,
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
    captureMethod: "direct",
    lateRecorded: false,
    ...overrides,
  };
}

function timeEntry(
  taskId: string,
  id: string,
  workDate: string,
  hours: number,
): TimeEntry {
  return {
    id,
    organization_id: "org",
    project_id: PROJECT,
    task_id: taskId,
    subtask_id: null,
    user_id: "user",
    work_date: workDate,
    start_time: null,
    end_time: null,
    duration_hours: hours,
    crew_size: 1,
    hours_per_person: hours,
    comment: null,
    source: "import",
    created_by: null,
    updated_by: null,
    created_at: "2026-08-06T20:00:00.000Z",
    updated_at: "2026-08-06T20:00:00.000Z",
    deleted_at: null,
  };
}

describe("Friction Radar task dataset", () => {
  it("uses current work dates and never labels missing TaskStarted as waiting", () => {
    const currentTask = task({});
    const row = buildTaskFrictionEvidenceDataset({
      tasks: [currentTask],
      events: [
        event(currentTask.id, "TaskCompleted", 10, {
          fromState: "not_started",
          toState: "done",
        }),
      ],
      timeEntries: [
        timeEntry(currentTask.id, "entry-1", "2026-02-12", 8),
        timeEntry(currentTask.id, "entry-2", "2026-02-20", 48),
      ],
    })[0];

    expect(row.firstTaskStartedAt).toBeNull();
    expect(row.observedStart).toMatchObject({
      timestamp: "2026-02-12T00:00:00.000Z",
      source: "time_entry_work_date",
      confidence: "high",
    });
    expect(row.queueFriction).toMatchObject({
      status: "not_detected",
      queueTimeMs: 0,
    });
    expect(row.loggedHours).toBe(56);
    expect(row.effortVarianceHours).toBe(0);
  });

  it("prefers corrected current entry over stale TimeLogged payload", () => {
    const currentTask = task({
      id: "8f0f1e7e-a629-4be0-8abc-24bd1b6b2c2f",
      title: "Definir/revisar Organigrama del Proyecto Ola 1",
      start_date: "2026-02-25",
      baseline_start_date: "2026-02-25",
      estimate_hours: 32,
      baseline_estimate_hours: 32,
    });
    const row = buildTaskFrictionEvidenceDataset({
      tasks: [currentTask],
      events: [
        event(currentTask.id, "TimeLogged", 20, {
          captureMethod: null,
          payload: {
            task_id: currentTask.id,
            entry_id: "entry-1",
            work_date: "2026-01-26",
            duration_hours: 8,
          },
        }),
      ],
      timeEntries: [
        timeEntry(currentTask.id, "entry-1", "2026-02-25", 8),
      ],
    })[0];

    expect(row.observedStart.timestamp).toBe("2026-02-25T00:00:00.000Z");
    expect(row.queueFriction.status).toBe("not_detected");
  });

  it("keeps confirmed rework separate from snapshot inconsistency", () => {
    const currentTask = task({
      id: "b0ca5ded-efdc-455d-abf7-671eb3fd8670",
      title: "Establecer / comunicar fechas marco para las Fases de la Ola 1",
      status: "done",
      is_blocked: true,
      blocker_reason: "La persona se encuentra de reposo medico",
      start_date: "2026-01-21",
      baseline_start_date: "2026-01-21",
      estimate_hours: 8,
      baseline_estimate_hours: 8,
    });
    const completed = event(currentTask.id, "TaskCompleted", 10, {
      eventId: "5c172027-1ca5-429b-b752-637cdee317e7",
      fromState: "in_progress",
      toState: "done",
    });
    const reopened = event(currentTask.id, "TaskReopened", 11, {
      eventId: "44909854-4a9a-44a3-b23a-45668abbcb91",
      fromState: "done",
      toState: "blocked",
    });
    const row = buildTaskFrictionEvidenceDataset({
      tasks: [currentTask],
      events: [completed, reopened],
      timeEntries: [
        timeEntry(currentTask.id, "entry", "2026-01-21", 8),
      ],
    })[0];

    expect(row.rework).toMatchObject({
      status: "confirmed",
      confidence: "high",
      evidenceEventIds: [
        "5c172027-1ca5-429b-b752-637cdee317e7",
        "44909854-4a9a-44a3-b23a-45668abbcb91",
      ],
    });
    expect(row.projectionConsistency).toMatchObject({
      status: "inconsistent",
      evidenceEventIds: ["44909854-4a9a-44a3-b23a-45668abbcb91"],
    });
  });
});
