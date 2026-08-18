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
      status: "candidate",
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

});
