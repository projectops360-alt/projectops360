import { describe, expect, it } from "vitest";
import {
  frictionSignalsFromOperationalEvidence,
  type OperationalSignalInput,
} from "../operational-signal-adapter";
import type { TaskFrictionEvidenceRow } from "../task-dataset";

const ORG = "org";
const PROJECT = "project";
const NOW = "2026-08-18T12:00:00.000Z";

function task(overrides: Partial<TaskFrictionEvidenceRow> = {}): TaskFrictionEvidenceRow {
  return {
    projectId: PROJECT,
    milestoneId: "milestone",
    taskId: "task",
    title: "Task",
    status: "in_progress",
    progress: 50,
    isBlocked: false,
    blockerReason: null,
    plannedStart: "2026-08-01",
    plannedFinish: "2026-08-20",
    plannedDurationDays: 20,
    plannedHours: 10,
    currentStart: "2026-08-01",
    currentFinish: "2026-08-20",
    currentDurationDays: 20,
    assignedTo: null,
    assignedResourceId: null,
    assignedResourceName: null,
    assignedResourceStatus: null,
    resourceAssignmentCount: 0,
    resourceCapacityEvidence: "insufficient_evidence",
    isCritical: false,
    slackDays: null,
    firstTaskStartedAt: null,
    observedStart: {
      status: "insufficient_evidence",
      timestamp: null,
      eventId: null,
      eventType: null,
      sourceRecordId: null,
      source: "unknown",
      confidence: "unknown",
      reason: "no_qualified_observed_start",
    },
    queueFriction: {
      status: "unknown",
      queueTimeMs: null,
      severityScore: null,
      confidence: "unknown",
      evidenceEventIds: [],
      evidenceRecords: [],
      reason: "no_qualified_observed_start",
    },
    activeCycleTimeMs: null,
    activeCycleTimeStatus: "insufficient_evidence",
    timeEntryCount: 0,
    timeEntryIds: [],
    effortByUser: [],
    loggedHours: 0,
    taskActualHours: null,
    effortVarianceHours: -10,
    predecessorCount: 0,
    predecessorIds: [],
    successorCount: 0,
    successorIds: [],
    dependencyIds: [],
    fanIn: 0,
    fanOut: 0,
    dependencyTypes: [],
    maxDependencyLagDays: null,
    upstreamIncompleteCount: 0,
    downstreamImpactCount: 0,
    lifecycle: {
      implementedAt: null,
      testedAt: null,
      lastCompletedAt: null,
      completionCount: 0,
      reopenedCount: 0,
      reworkCycles: 0,
      repeatedCompletionStatus: "not_detected",
      regressionStatus: "not_detected",
      backwardTransitions: [],
      skippedExpectedStatesStatus: "unknown",
      skippedExpectedStatesReason: "workflow_expectation_not_configured",
      lastMeaningfulActivityAt: null,
      lastMeaningfulActivityEventIds: [],
      lastMeaningfulActivityRecords: [],
      evidenceEventIds: [],
    },
    stagnation: {
      status: "unknown",
      observedAt: NOW,
      inactiveForMs: null,
      severityScore: null,
      confidence: "unknown",
      evidenceEventIds: [],
      evidenceRecords: [],
      reason: "no_qualified_activity_evidence",
    },
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
    temporalConsistency: {
      status: "insufficient_evidence",
      confidence: "unknown",
      firstOperationalWorkAt: null,
      lastOperationalWorkAt: null,
      maxBoundaryGapMs: null,
      evidenceEventIds: [],
      evidenceRecords: [],
      reason: "no_comparable_evidence",
    },
    projectionConsistency: {
      status: "unknown",
      confidence: "unknown",
      evidenceEventIds: [],
      reason: "no_direct_state_event",
    },
    ...overrides,
  };
}

function input(overrides: Partial<OperationalSignalInput> = {}): OperationalSignalInput {
  return {
    organizationId: ORG,
    projectId: PROJECT,
    tasks: [task()],
    milestones: [],
    resourceAssignments: [],
    resourceWorkloadSnapshots: [],
    risks: [],
    decisions: [],
    budgetItems: [],
    costActuals: [],
    financialMeasurements: [],
    financialCockpit: [],
    criticalPathSnapshots: [],
    analysisTimestamp: NOW,
    ...overrides,
  };
}

describe("Friction Radar operational signal layer", () => {
  it("does not call an incomplete predecessor friction unless the task is explicitly blocked", () => {
    const predecessor = task({ taskId: "predecessor", status: "in_progress" });
    const successor = task({
      taskId: "successor",
      predecessorCount: 1,
      predecessorIds: ["predecessor"],
      dependencyIds: ["dependency"],
      upstreamIncompleteCount: 1,
    });
    const absent = frictionSignalsFromOperationalEvidence(input({ tasks: [predecessor, successor] }));
    expect(absent.signals.some((signal) => signal.signalType === "blocked_by_predecessor")).toBe(false);

    const detected = frictionSignalsFromOperationalEvidence(input({
      tasks: [predecessor, { ...successor, isBlocked: true }],
    }));
    const signal = detected.signals.find((item) => item.signalType === "blocked_by_predecessor");
    expect(signal).toMatchObject({ taskId: "successor", confidence: "medium" });
    expect(signal?.evidenceRefs).toContainEqual({ kind: "task_dependencies", id: "dependency" });
  });

  it("uses the end of a date-only baseline and emits overdue plus critical exposure only after it", () => {
    const result = frictionSignalsFromOperationalEvidence(input({
      tasks: [task({ plannedFinish: "2026-08-17", isCritical: true })],
    }));
    expect(result.signals.map((signal) => signal.signalType)).toEqual(
      expect.arrayContaining(["overdue_task", "critical_path_exposure"]),
    );

    const sameDay = frictionSignalsFromOperationalEvidence(input({
      analysisTimestamp: "2026-08-17T23:00:00.000Z",
      tasks: [task({ plannedFinish: "2026-08-17", isCritical: true })],
    }));
    expect(sameDay.signals.some((signal) => signal.signalType === "overdue_task")).toBe(false);
  });

  it("requires current time entries before emitting effort overrun", () => {
    const detected = frictionSignalsFromOperationalEvidence(input({
      tasks: [task({
        plannedHours: 10,
        loggedHours: 15,
        timeEntryCount: 1,
        timeEntryIds: ["entry"],
      })],
    }));
    expect(detected.signals.find((signal) => signal.signalType === "effort_overrun"))
      .toMatchObject({ observedValue: 15, expectedOrBaseline: 10, confidence: "high" });

    const missing = frictionSignalsFromOperationalEvidence(input({
      tasks: [task({ plannedHours: 10, loggedHours: 15, timeEntryCount: 0 })],
    }));
    expect(missing.signals.some((signal) => signal.signalType === "effort_overrun")).toBe(false);
  });

  it("detects recorded effort concentration and recorded overload without inventing capacity", () => {
    const result = frictionSignalsFromOperationalEvidence(input({
      tasks: [
        task({ taskId: "a", effortByUser: [{ userId: "u1", hours: 8, entryIds: ["e1"] }] }),
        task({ taskId: "b", effortByUser: [{ userId: "u1", hours: 8, entryIds: ["e2"] }] }),
        task({ taskId: "c", effortByUser: [{ userId: "u1", hours: 8, entryIds: ["e3"] }] }),
      ],
      resourceWorkloadSnapshots: [{
        id: "workload",
        organization_id: ORG,
        project_id: PROJECT,
        resource_profile_id: "profile",
        resource_key: "u1",
        period_start: "2026-08-10",
        period_end: "2026-08-16",
        effective_capacity_hours: 40,
        assigned_work_hours: 50,
        remaining_capacity_hours: -10,
        utilization_percent: 125,
        overallocated_hours: 10,
        status: "overallocated",
        calculation_source: "canonical_capacity",
      }],
    }));
    expect(result.signals.map((signal) => signal.signalType)).toEqual(
      expect.arrayContaining(["effort_concentration", "resource_overload"]),
    );
    expect(result.gaps.some((item) => item.signalType === "resource_overload")).toBe(false);
  });

  it("uses explicit risk and decision rows and reports decision absence as a gap", () => {
    const withRows = frictionSignalsFromOperationalEvidence(input({
      risks: [{
        id: "risk",
        organization_id: ORG,
        project_id: PROJECT,
        status: "open",
        severity: "high",
        confidence_score: 0.9,
        linked_task_id: null,
        linked_milestone_id: null,
        created_at: "2026-06-01T00:00:00.000Z",
      } as OperationalSignalInput["risks"][number]],
      decisions: [{
        id: "decision",
        organization_id: ORG,
        project_id: PROJECT,
        status: "deferred",
        created_at: "2026-08-01T00:00:00.000Z",
      } as OperationalSignalInput["decisions"][number]],
    }));
    expect(withRows.signals.map((signal) => signal.signalType)).toEqual(
      expect.arrayContaining(["open_risk_exposure", "decision_wait"]),
    );

    const noDecisions = frictionSignalsFromOperationalEvidence(input());
    expect(noDecisions.gaps.find((item) => item.signalType === "decision_wait"))
      .toMatchObject({ status: "insufficient_evidence" });
  });
});
