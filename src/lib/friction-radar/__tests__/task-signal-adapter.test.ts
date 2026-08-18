import { describe, expect, it } from "vitest";
import type { TaskFrictionEvidenceRow } from "../task-dataset";
import { frictionSignalsFromTaskEvidence } from "../task-signal-adapter";

function row(
  overrides: Partial<TaskFrictionEvidenceRow> = {},
): TaskFrictionEvidenceRow {
  return {
    projectId: "a40a7436-c63f-4e3b-94cd-041447ee54d4",
    milestoneId: "milestone",
    taskId: "b0ca5ded-efdc-455d-abf7-671eb3fd8670",
    title: "Establecer / comunicar fechas marco",
    status: "done",
    progress: 0,
    isBlocked: true,
    blockerReason: "La persona se encuentra de reposo medico",
    plannedStart: "2026-01-21",
    plannedFinish: "2026-01-21",
    plannedHours: 8,
    firstTaskStartedAt: null,
    observedStart: {
      status: "observed",
      timestamp: "2026-01-21T00:00:00.000Z",
      eventId: null,
      eventType: "TimeLogged",
      sourceRecordId: "entry",
      source: "time_entry_work_date",
      confidence: "high",
      reason: "current_time_entry_work_date",
    },
    queueFriction: {
      status: "not_detected",
      queueTimeMs: 0,
      severityScore: 0,
      confidence: "high",
      evidenceEventIds: [],
      evidenceRecords: [{ table: "subtask_time_entries", id: "entry" }],
      reason: "no_material_queue_variance",
    },
    timeEntryCount: 1,
    loggedHours: 8,
    effortVarianceHours: 0,
    rework: {
      status: "confirmed",
      confidence: "high",
      completedEventId: "5c172027-1ca5-429b-b752-637cdee317e7",
      reopenedEventId: "44909854-4a9a-44a3-b23a-45668abbcb91",
      completedAt: "2026-08-06T21:08:07.000Z",
      reopenedAt: "2026-08-06T21:08:27.000Z",
      reopenedToState: "blocked",
      evidenceEventIds: [
        "5c172027-1ca5-429b-b752-637cdee317e7",
        "44909854-4a9a-44a3-b23a-45668abbcb91",
      ],
      reason: "explicit_completed_then_reopened_sequence",
    },
    temporalConsistency: {
      status: "conflict",
      confidence: "high",
      firstOperationalWorkAt: "2026-01-21T00:00:00.000Z",
      lastOperationalWorkAt: "2026-01-21T00:00:00.000Z",
      maxBoundaryGapMs: 100,
      evidenceEventIds: ["5c172027-1ca5-429b-b752-637cdee317e7"],
      evidenceRecords: [{ table: "subtask_time_entries", id: "entry" }],
      reason: "lifecycle_boundary_conflicts_with_operational_work_dates",
    },
    projectionConsistency: {
      status: "inconsistent",
      confidence: "high",
      evidenceEventIds: ["44909854-4a9a-44a3-b23a-45668abbcb91"],
      reason: "latest_event_disagrees_with_task_snapshot",
    },
    ...overrides,
  };
}

describe("task evidence signal adapter", () => {
  it("emits independent rework, process and resource signals for Aurora", () => {
    const signals = frictionSignalsFromTaskEvidence([row()], "org");

    expect(signals.map((item) => item.signalType).sort()).toEqual([
      "completed_then_reopened",
      "process_interruption",
      "resource_interruption",
    ]);
    expect(signals.every((item) => item.metadata?.signalScore === 100)).toBe(true);
    expect(signals.every((item) => item.taskId === row().taskId)).toBe(true);
    expect(
      signals.find((item) => item.signalType === "resource_interruption")
        ?.evidenceRefs,
    ).toContainEqual({
      kind: "roadmap_tasks",
      id: row().taskId,
      label: "blocker_reason",
    });
  });

  it("does not turn UNKNOWN queue evidence into a signal", () => {
    const signals = frictionSignalsFromTaskEvidence(
      [
        row({
          isBlocked: false,
          blockerReason: null,
          rework: {
            status: "not_detected",
            confidence: "high",
            completedEventId: null,
            reopenedEventId: null,
            completedAt: null,
            reopenedAt: null,
            reopenedToState: null,
            evidenceEventIds: [],
            reason: "no_completed_then_reopened_sequence",
          },
          queueFriction: {
            status: "unknown",
            queueTimeMs: null,
            severityScore: null,
            confidence: "low",
            evidenceEventIds: ["started", "reversed"],
            evidenceRecords: [],
            reason:
              "observed_start_immediately_reversed_by_low_confidence_mapping",
          },
        }),
      ],
      "org",
    );

    expect(signals).toEqual([]);
  });
});
