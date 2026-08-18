import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRICTION_SIGNAL_FILTERS,
  affectedTaskCount,
  filterAndSortFrictionSignals,
  frictionSignalEntityHref,
} from "../ui-model";
import type { FrictionSignal } from "../types";

function signal(overrides: Partial<FrictionSignal> = {}): FrictionSignal {
  return {
    signalId: "signal-1",
    organizationId: "org-1",
    projectId: "project-1",
    source: "process_mining",
    signalType: "queue_friction",
    category: "process",
    entityType: "task",
    entityId: "task-1",
    taskId: "task-1",
    milestoneId: "milestone-1",
    severity: "high",
    confidence: "high",
    score: 72,
    observedValue: 12,
    expectedOrBaseline: 8,
    evidenceStatus: "candidate",
    occurredAt: "2026-08-01T00:00:00.000Z",
    evidenceTimestampStart: "2026-07-31T00:00:00.000Z",
    evidenceTimestampEnd: "2026-08-01T00:00:00.000Z",
    evidenceDescription: "Qualified queue variance.",
    evidenceRefs: [{ kind: "project_event_log", id: "event-1" }],
    ...overrides,
  };
}

describe("Friction Radar UI projection", () => {
  const signals = [
    signal(),
    signal({
      signalId: "signal-2",
      taskId: "task-2",
      entityId: "task-2",
      milestoneId: "milestone-2",
      category: "schedule",
      severity: "critical",
      confidence: "medium",
      score: 95,
      evidenceTimestampEnd: "2026-08-03T00:00:00.000Z",
    }),
    signal({ signalId: "signal-3", taskId: null, entityId: "risk-1", category: "risk", score: 45 }),
  ];

  it("defaults to deterministic Top 20 ordering by independent score", () => {
    const result = filterAndSortFrictionSignals({
      signals,
      topSignalIds: ["signal-2", "signal-1"],
      filters: DEFAULT_FRICTION_SIGNAL_FILTERS,
    });
    expect(result.map((item) => item.signalId)).toEqual(["signal-2", "signal-1"]);
  });

  it("combines category, severity, confidence, milestone and task filters", () => {
    const result = filterAndSortFrictionSignals({
      signals,
      topSignalIds: signals.map((item) => item.signalId),
      filters: {
        ...DEFAULT_FRICTION_SIGNAL_FILTERS,
        scope: "all",
        category: "schedule",
        severity: "critical",
        confidence: "medium",
        milestoneId: "milestone-2",
        taskId: "task-2",
      },
    });
    expect(result.map((item) => item.signalId)).toEqual(["signal-2"]);
  });

  it("searches task titles and evidence IDs without changing evidence", () => {
    const result = filterAndSortFrictionSignals({
      signals,
      topSignalIds: signals.map((item) => item.signalId),
      taskTitles: { "task-1": "Aurora blueprint", "task-2": "Testing" },
      filters: { ...DEFAULT_FRICTION_SIGNAL_FILTERS, scope: "all", query: "blueprint" },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(signals[0]);
  });

  it("links tasks to Workboard and other categories to their closest project surface", () => {
    expect(frictionSignalEntityHref("p1", signals[0])).toBe("/projects/p1/workboard?task=task-1");
    expect(frictionSignalEntityHref("p1", { ...signals[2], milestoneId: null })).toBe("/projects/p1/status");
    expect(frictionSignalEntityHref("p1", signal({ taskId: null, milestoneId: null, category: "cost" }))).toBe("/projects/p1/budget");
  });

  it("counts unique affected tasks only", () => {
    expect(affectedTaskCount(signals)).toBe(2);
  });

  it("filters 10,000 signals inside the interaction budget", () => {
    const many = Array.from({ length: 10_000 }, (_, index) => signal({ signalId: `signal-${index}`, taskId: `task-${index}` }));
    const started = performance.now();
    const result = filterAndSortFrictionSignals({
      signals: many,
      topSignalIds: many.slice(0, 20).map((item) => item.signalId),
      filters: { ...DEFAULT_FRICTION_SIGNAL_FILTERS, scope: "all", query: "event-1" },
    });
    expect(result).toHaveLength(10_000);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
