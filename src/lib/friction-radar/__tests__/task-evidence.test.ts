import { describe, expect, it } from "vitest";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import {
  assessQueueFriction,
  assessTaskProjectionConsistency,
  deriveObservedTaskStart,
  detectCompletedThenReopened,
  isEffortContributionEvent,
  qualifiedElapsedMs,
} from "../task-evidence";

function event(
  eventType: string,
  occurredAt: string,
  overrides: Partial<LivingGraphCanonicalEvent> = {},
): LivingGraphCanonicalEvent {
  return {
    eventId: `e-${eventType}-${occurredAt}`,
    organizationId: "org",
    projectId: "project",
    caseId: "project",
    eventType,
    eventCategory: "task",
    eventSchemaVersion: 1,
    eventImportance: "MEDIUM",
    lifecycleClass: "BUSINESS_EVENT",
    subjectType: "task",
    subjectId: "task",
    actorType: "system",
    actorId: null,
    occurredAt,
    recordedAt: occurredAt,
    sequenceNumber: 1,
    sourceModule: "roadmap",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: "task",
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
    ...overrides,
  };
}

describe("Friction Radar task evidence", () => {
  it("does not infer waiting from a missing TaskStarted event", () => {
    const logged = event("TimeLogged", "2026-08-06T10:00:00.000Z");
    const completed = event("TaskCompleted", "2026-08-06T12:00:00.000Z", {
      sequenceNumber: 2,
    });

    const observed = deriveObservedTaskStart([logged, completed]);

    expect(observed).toMatchObject({
      status: "observed",
      eventId: logged.eventId,
      eventType: "TimeLogged",
      confidence: "high",
    });
  });

  it("accepts only active TaskStatusChanged transitions as observed work", () => {
    const done = event("TaskStatusChanged", "2026-08-06T12:00:00.000Z", {
      toState: "done",
    });
    const active = event("TaskStatusChanged", "2026-08-06T10:00:00.000Z", {
      eventId: "active",
      toState: "in_progress",
    });

    expect(deriveObservedTaskStart([done]).status).toBe("insufficient_evidence");
    expect(deriveObservedTaskStart([done, active]).eventId).toBe("active");
  });

  it("returns UNKNOWN queue friction for imported capture timestamps", () => {
    const imported = event("TaskStarted", "2026-08-06T10:00:00.000Z", {
      captureMethod: "import",
      recordedAt: "2026-08-06T10:00:00.000Z",
    });
    const assessment = assessQueueFriction({
      plannedStart: "2026-08-05T08:00:00.000Z",
      observedStart: deriveObservedTaskStart([imported]),
    });

    expect(assessment).toMatchObject({
      status: "unknown",
      queueTimeMs: null,
      severityScore: null,
      reason: "business_time_insufficiently_proven",
    });
  });

  it("requires planned start before calculating queue variance", () => {
    const started = event("TaskStarted", "2026-08-06T10:00:00.000Z");
    expect(
      assessQueueFriction({
        plannedStart: null,
        observedStart: deriveObservedTaskStart([started]),
      }),
    ).toMatchObject({
      status: "unknown",
      queueTimeMs: null,
      reason: "planned_start_unavailable",
    });
  });

  it("calculates a candidate only from qualified business time and plan", () => {
    const started = event("TaskStarted", "2026-08-06T10:00:00.000Z");
    expect(
      assessQueueFriction({
        plannedStart: "2026-08-05T10:00:00.000Z",
        observedStart: deriveObservedTaskStart([started]),
      }),
    ).toMatchObject({
      status: "candidate",
      queueTimeMs: 24 * 60 * 60 * 1000,
      confidence: "high",
    });
  });

  it("never double-counts TimeEntryUpdated as effort", () => {
    expect(
      isEffortContributionEvent(event("TimeLogged", "2026-08-06T10:00:00.000Z")),
    ).toBe(true);
    expect(
      isEffortContributionEvent(
        event("TimeEntryUpdated", "2026-08-06T11:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("excludes import latency from direct-follow duration", () => {
    const created = event("TaskCreated", "2026-08-05T10:00:00.000Z", {
      captureMethod: "import",
    });
    const started = event("TaskStarted", "2026-08-06T10:00:00.000Z", {
      captureMethod: "import",
      sequenceNumber: 2,
    });

    expect(qualifiedElapsedMs(created, started)).toBeNull();
  });
  it("detects the Aurora completed-to-reopened rework sequence", () => {
    const completed = event("TaskCompleted", "2026-08-06T10:00:00.000Z", {
      eventId: "completed",
      sequenceNumber: 10,
      toState: "done",
    });
    const reopened = event("TaskReopened", "2026-08-06T11:00:00.000Z", {
      eventId: "44909854-4a9a-44a3-b23a-45668abbcb91",
      sequenceNumber: 11,
      fromState: "done",
      toState: "blocked",
    });

    expect(detectCompletedThenReopened([reopened, completed])).toMatchObject({
      status: "confirmed",
      confidence: "high",
      completedEventId: "completed",
      reopenedEventId: "44909854-4a9a-44a3-b23a-45668abbcb91",
      evidenceEventIds: [
        "completed",
        "44909854-4a9a-44a3-b23a-45668abbcb91",
      ],
    });
  });

  it("reports stale snapshot state separately from rework", () => {
    const reopened = event("TaskReopened", "2026-08-06T11:00:00.000Z", {
      eventId: "reopened",
      sequenceNumber: 11,
      fromState: "done",
      toState: "blocked",
    });

    expect(
      assessTaskProjectionConsistency({
        currentStatus: "done",
        isBlocked: true,
        events: [reopened],
      }),
    ).toMatchObject({
      status: "inconsistent",
      evidenceEventIds: ["reopened"],
      reason: "latest_event_disagrees_with_task_snapshot",
    });
  });

  it("recognizes the exact imported capture method used in Aurora PROD", () => {
    const created = event("TaskCreated", "2026-08-06T01:00:41.091Z", {
      captureMethod: "imported",
    });
    const started = event("TaskStarted", "2026-08-06T21:07:14.152Z", {
      captureMethod: "imported",
      sequenceNumber: 2,
    });

    expect(qualifiedElapsedMs(created, started)).toBeNull();
    expect(
      assessQueueFriction({
        plannedStart: "2026-02-25",
        observedStart: deriveObservedTaskStart([started]),
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "business_time_insufficiently_proven",
    });
  });

  it("does not trust occurredAt when capture method is missing", () => {
    const started = event("TaskStarted", "2026-08-06T21:07:14.152Z", {
      captureMethod: null,
    });

    expect(
      assessQueueFriction({
        plannedStart: "2026-02-25",
        observedStart: deriveObservedTaskStart([started]),
      }),
    ).toMatchObject({
      status: "unknown",
      reason: "business_time_insufficiently_proven",
    });
  });

  it("treats event payload work_date as provisional, not authoritative", () => {
    const logged = event("TimeLogged", "2026-08-06T23:27:40.321Z", {
      captureMethod: null,
      payload: {
        task_id: "8f0f1e7e-a629-4be0-8abc-24bd1b6b2c2f",
        entry_id: "old-entry",
        work_date: "2026-01-26",
        duration_hours: 8,
      },
    });
    const observed = deriveObservedTaskStart([logged]);

    expect(observed).toMatchObject({
      timestamp: "2026-01-26T00:00:00.000Z",
      source: "event_work_date",
      confidence: "medium",
    });
    expect(
      assessQueueFriction({
        plannedStart: "2026-02-25",
        observedStart: observed,
      }).status,
    ).toBe("unknown");
  });

  it("prefers current time-entry work_date over stale event payload history", () => {
    const logged = event("TimeLogged", "2026-08-06T23:27:40.321Z", {
      captureMethod: null,
      payload: {
        task_id: "8f0f1e7e-a629-4be0-8abc-24bd1b6b2c2f",
        entry_id: "old-entry",
        work_date: "2026-01-26",
        duration_hours: 8,
      },
    });
    const observed = deriveObservedTaskStart([logged], [
      {
        id: "37e10874-13dc-4de7-a2ed-bceb0e9592c0",
        workDate: "2026-02-25",
      },
    ]);

    expect(observed).toMatchObject({
      timestamp: "2026-02-25T00:00:00.000Z",
      sourceRecordId: "37e10874-13dc-4de7-a2ed-bceb0e9592c0",
      source: "time_entry_work_date",
      confidence: "high",
    });
    expect(
      assessQueueFriction({
        plannedStart: "2026-02-25",
        observedStart: observed,
      }),
    ).toMatchObject({
      status: "not_detected",
      queueTimeMs: 0,
      evidenceEventIds: [],
    });
  });

  it("ignores deleted time entries when deriving observed start", () => {
    const observed = deriveObservedTaskStart([], [
      {
        id: "deleted",
        workDate: "2026-01-01",
        deletedAt: "2026-08-07T00:00:00.000Z",
      },
    ]);

    expect(observed).toMatchObject({
      status: "insufficient_evidence",
      source: "unknown",
    });
  });

});
