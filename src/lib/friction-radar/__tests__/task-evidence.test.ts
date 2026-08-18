import { describe, expect, it } from "vitest";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import {
  assessQueueFriction,
  assessTaskLifecycle,
  assessTaskProjectionConsistency,
  assessTaskStagnation,
  assessTaskTemporalConsistency,
  deriveObservedTaskStart,
  detectCompletedThenReopened,
  isEffortContributionEvent,
  qualifyElapsedDuration,
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

  it("does not manufacture queue time inside a date-only planned day", () => {
    const started = event("TaskStarted", "2026-08-06T23:59:59.000Z");
    expect(
      assessQueueFriction({
        plannedStart: "2026-08-06",
        observedStart: deriveObservedTaskStart([started]),
      }),
    ).toMatchObject({
      status: "not_detected",
      queueTimeMs: 0,
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

  it("takes the earliest valid source while current entries supersede TimeLogged payloads", () => {
    const started = event("TaskStarted", "2026-02-24T10:00:00.000Z", {
      eventId: "started-before-entry",
    });
    const staleLogged = event("TimeLogged", "2026-08-06T10:00:00.000Z", {
      eventId: "stale-time-log",
      captureMethod: null,
      payload: { entry_id: "entry-1", work_date: "2026-01-01" },
    });

    expect(
      deriveObservedTaskStart([staleLogged, started], [
        { id: "entry-1", workDate: "2026-02-25" },
      ]),
    ).toMatchObject({
      timestamp: "2026-02-24T10:00:00.000Z",
      eventId: "started-before-entry",
      source: "event_business_time",
      confidence: "high",
    });
  });

  it("returns UNKNOWN queue when a low-confidence mapping immediately reverses start", () => {
    const started = event("TaskStarted", "2026-08-06T23:09:42.707Z", {
      eventId: "878b7a08-c1c6-4b19-a8f0-57098bce0435",
      fromState: "not_started",
      toState: "in_progress",
    });
    const reversed = event("TaskStatusChanged", "2026-08-06T23:10:22.291Z", {
      eventId: "01ab6a5b-582f-4262-b38d-4fe2674a668f",
      sequenceNumber: 2,
      fromState: "in_progress",
      toState: "not_started",
      dataQualityFlags: ["mapping_low_confidence"],
    });

    expect(
      assessQueueFriction({
        plannedStart: "2026-03-10",
        observedStart: deriveObservedTaskStart([started, reversed]),
        events: [started, reversed],
      }),
    ).toMatchObject({
      status: "unknown",
      confidence: "low",
      queueTimeMs: null,
      evidenceEventIds: [started.eventId, reversed.eventId],
      reason: "observed_start_immediately_reversed_by_low_confidence_mapping",
    });
  });

  it("marks Aurora-style lifecycle dates months after work as a temporal conflict", () => {
    const started = event("TaskStarted", "2026-08-06T21:07:14.152Z", {
      eventId: "started",
    });
    const completed = event("TaskCompleted", "2026-08-06T21:09:41.000Z", {
      eventId: "completed",
      sequenceNumber: 2,
    });
    const workDates = [
      { id: "entry-1", workDate: "2026-02-25" },
      { id: "entry-2", workDate: "2026-02-28" },
    ];

    expect(
      assessTaskTemporalConsistency({
        events: [started, completed],
        timeEntries: workDates,
      }),
    ).toMatchObject({
      status: "conflict",
      confidence: "high",
      firstOperationalWorkAt: "2026-02-25T00:00:00.000Z",
      lastOperationalWorkAt: "2026-02-28T00:00:00.000Z",
      evidenceEventIds: ["started", "completed"],
      reason: "lifecycle_boundary_conflicts_with_operational_work_dates",
    });
    expect(qualifiedElapsedMs(started, completed, workDates)).toBeNull();
    expect(qualifyElapsedDuration(started, completed, workDates)).toMatchObject({
      durationMs: null,
      status: "temporal_conflict",
    });
  });

  it("keeps explicit lifecycle duration when work dates corroborate the window", () => {
    const started = event("TaskStarted", "2026-02-25T10:00:00.000Z");
    const completed = event("TaskCompleted", "2026-02-28T12:00:00.000Z", {
      sequenceNumber: 2,
    });

    expect(
      qualifyElapsedDuration(started, completed, [
        { id: "entry-1", workDate: "2026-02-25" },
        { id: "entry-2", workDate: "2026-02-28" },
      ]),
    ).toMatchObject({
      durationMs: 74 * 60 * 60 * 1000,
      status: "qualified",
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

  it("does not report projection mismatch for equivalent done/completed states", () => {
    const completed = event("TaskCompleted", "2026-08-06T11:00:00.000Z", {
      eventId: "completed",
      toState: "completed",
    });

    expect(
      assessTaskProjectionConsistency({
        currentStatus: "done",
        isBlocked: false,
        events: [completed],
      }),
    ).toMatchObject({
      status: "consistent",
    });
  });

  it("downgrades projection confidence when the latest state mapping is flagged", () => {
    const reversed = event("TaskStatusChanged", "2026-08-06T23:10:22.291Z", {
      eventId: "reversed",
      toState: "not_started",
      dataQualityFlags: ["mapping_low_confidence"],
    });

    expect(
      assessTaskProjectionConsistency({
        currentStatus: "not_started",
        isBlocked: false,
        events: [reversed],
      }),
    ).toMatchObject({ status: "consistent", confidence: "low" });
  });

  it("rejects impossible work dates instead of normalizing them", () => {
    const observed = deriveObservedTaskStart([], [
      {
        id: "invalid-date",
        workDate: "2026-02-30",
      },
    ]);

    expect(observed.status).toBe("insufficient_evidence");
  });

  it("detects explicit backward transitions and repeated completion", () => {
    const completed1 = event("TaskCompleted", "2026-02-26T10:00:00.000Z", {
      eventId: "completed-1",
      sequenceNumber: 1,
      fromState: "tested",
      toState: "done",
    });
    const reopened = event("TaskReopened", "2026-02-27T10:00:00.000Z", {
      eventId: "reopened",
      sequenceNumber: 2,
      fromState: "done",
      toState: "in_progress",
    });
    const completed2 = event("TaskCompleted", "2026-02-28T10:00:00.000Z", {
      eventId: "completed-2",
      sequenceNumber: 3,
      fromState: "in_progress",
      toState: "done",
    });

    expect(assessTaskLifecycle([completed1, reopened, completed2])).toMatchObject({
      completionCount: 2,
      reopenedCount: 1,
      reworkCycles: 1,
      repeatedCompletionStatus: "confirmed",
      backwardTransitions: [
        { eventId: "reopened", fromState: "done", toState: "in_progress" },
      ],
      skippedExpectedStatesStatus: "unknown",
      skippedExpectedStatesReason: "workflow_expectation_not_configured",
    });
  });

  it("keeps stagnation UNKNOWN when no meaningful activity exists", () => {
    const lifecycle = assessTaskLifecycle([
      event("TaskCreated", "2026-02-01T10:00:00.000Z"),
    ]);
    expect(assessTaskStagnation({
      currentStatus: "in_progress",
      lifecycle,
      observedAt: "2026-02-20T00:00:00.000Z",
    })).toMatchObject({
      status: "unknown",
      inactiveForMs: null,
      reason: "last_meaningful_activity_unavailable",
    });
  });

  it("detects stagnation only from positive prior-work evidence", () => {
    const lifecycle = assessTaskLifecycle([], [
      { id: "entry", workDate: "2026-02-01" },
    ]);
    expect(assessTaskStagnation({
      currentStatus: "in_progress",
      lifecycle,
      observedAt: "2026-02-15T00:00:00.000Z",
    })).toMatchObject({
      status: "candidate",
      inactiveForMs: 14 * 24 * 60 * 60 * 1000,
      confidence: "high",
      evidenceRecords: [{ table: "subtask_time_entries", id: "entry" }],
    });
  });

  it("keeps the exact last activity event as stagnation evidence", () => {
    const started = event("TaskStarted", "2026-08-07T14:41:56.120Z", {
      eventId: "started-997",
    });
    const lifecycle = assessTaskLifecycle([started]);
    expect(assessTaskStagnation({
      currentStatus: "in_progress",
      lifecycle,
      observedAt: "2026-08-17T14:41:56.120Z",
    })).toMatchObject({
      status: "candidate",
      observedAt: "2026-08-17T14:41:56.120Z",
      evidenceEventIds: ["started-997"],
      evidenceRecords: [],
    });
  });

});
