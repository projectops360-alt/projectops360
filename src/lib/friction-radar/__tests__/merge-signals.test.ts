import { describe, expect, it } from "vitest";
import { mergeFrictionSignals } from "../merge-signals";
import type { FrictionSignal } from "../types";

function signal(overrides: Partial<FrictionSignal> = {}): FrictionSignal {
  return {
    signalId: "mpf:one",
    organizationId: "org",
    projectId: "project",
    source: "mpf",
    signalType: "rework:loop",
    category: "quality",
    entityType: "milestone_transition",
    entityId: "transition",
    severity: "high",
    confidence: "medium",
    score: 72,
    observedValue: true,
    expectedOrBaseline: false,
    evidenceStatus: "candidate",
    evidenceTimestampStart: null,
    evidenceTimestampEnd: null,
    evidenceDescription: "test evidence",
    evidenceRefs: [
      { kind: "project_event_log", id: "completed" },
      { kind: "project_event_log", id: "reopened" },
    ],
    ...overrides,
  };
}

describe("Friction Radar signal union", () => {
  it("prefers task-specific evidence when two engines use the same event set", () => {
    const task = signal({
      signalId: "task:one:rework",
      source: "process_mining",
      signalType: "completed_then_reopened",
      taskId: "task",
      entityType: "task",
      entityId: "task",
      confidence: "high",
    });
    const merged = mergeFrictionSignals([signal()], [task]);
    expect(merged).toHaveLength(1);
    expect(merged[0].signalId).toBe(task.signalId);
  });

  it("keeps independent categories even when they share event evidence", () => {
    const process = signal({
      signalId: "task:one:interrupt",
      source: "process_mining",
      signalType: "process_interruption",
      category: "process",
      taskId: "task",
    });
    expect(mergeFrictionSignals([signal()], [process])).toHaveLength(2);
  });

  it("keeps independent signal types in the same category", () => {
    const repeated = signal({
      signalId: "task:one:repeated-completion",
      source: "process_mining",
      signalType: "repeated_completion",
      taskId: "task",
      entityType: "task",
      entityId: "task",
      confidence: "high",
    });
    expect(mergeFrictionSignals([signal()], [repeated])).toHaveLength(2);
  });
});
