// ============================================================================
// CAP-046 / PD-019 — Feature 1: Execution Variant Analysis engine tests.
// Guard id: PROCESS-MINING-VARIANT-ENGINE — deterministic variant discovery
// over PEG business events; no invented data (no reference without outcomes).
// ============================================================================

import { describe, it, expect } from "vitest";
import { analyzeVariants, sequenceFitness, variantIdFor } from "../engine";
import type { VariantCaseInput, VariantEventRef } from "../types";

let eventCounter = 0;
function ev(
  eventType: string,
  occurredAt: string,
  overrides: Partial<VariantEventRef> = {},
): VariantEventRef {
  eventCounter += 1;
  return {
    eventId: `e-${eventCounter}`,
    eventType,
    eventCategory: "task",
    occurredAt,
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
    ...overrides,
  };
}

function projectCase(
  caseId: string,
  activities: string[],
  outcome: VariantCaseInput["outcome"] = "open",
): VariantCaseInput {
  const events = activities.map((activity, index) =>
    ev(activity, new Date(Date.UTC(2026, 0, 1 + index)).toISOString()),
  );
  return { caseId, events, outcome };
}

describe("PROCESS-MINING-VARIANT-ENGINE — variant discovery", () => {
  it("groups identical sequences into one variant and computes frequency", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      projectCase("p1", ["TaskCreated", "TaskStarted", "TaskCompleted"]),
      projectCase("p2", ["TaskCreated", "TaskStarted", "TaskCompleted"]),
      projectCase("p3", ["TaskCreated", "TaskCompleted"]),
    ]);

    expect(analysis.variants).toHaveLength(2);
    expect(analysis.variants[0].caseCount).toBe(2);
    expect(analysis.variants[0].frequencyPct).toBeCloseTo(66.67, 1);
    expect(analysis.variants[1].caseCount).toBe(1);
    expect(analysis.analyzedCases).toBe(3);
  });

  it("is deterministic: same input yields identical variant ids and ordering", () => {
    const cases = [
      projectCase("p1", ["A", "B", "C"]),
      projectCase("p2", ["A", "C"]),
      projectCase("p3", ["A", "B", "C"]),
    ];
    const first = analyzeVariants("project_lifecycle", cases);
    const second = analyzeVariants("project_lifecycle", cases);
    expect(second).toEqual(first);
    expect(variantIdFor(["A", "B", "C"])).toBe(variantIdFor(["A", "B", "C"]));
    expect(variantIdFor(["A", "B"])).not.toBe(variantIdFor(["A", "B", "C"]));
  });

  it("excludes non-business and compensating events from sequences (PD-018 §A.3/§A.6)", () => {
    const events = [
      ev("TaskCreated", "2026-01-01T00:00:00Z"),
      ev("ProjectHealthChanged", "2026-01-02T00:00:00Z", { lifecycleClass: "DERIVED_EVENT" }),
      ev("SyncRan", "2026-01-03T00:00:00Z", { lifecycleClass: "SYSTEM_EVENT" }),
      ev("TaskCompleted", "2026-01-04T00:00:00Z"),
      ev("TaskCompleted", "2026-01-05T00:00:00Z", { isCompensatingEvent: true }),
    ];
    const analysis = analyzeVariants("project_lifecycle", [
      { caseId: "p1", events, outcome: "open" },
    ]);

    expect(analysis.variants[0].signature).toEqual(["TaskCreated", "TaskCompleted"]);
    expect(analysis.quality.businessEventsUsed).toBe(2);
    expect(analysis.quality.excludedEvents).toBe(3);
  });

  it("orders by business time (occurred_at), not input order", () => {
    const events = [
      ev("TaskCompleted", "2026-01-05T00:00:00Z"),
      ev("TaskCreated", "2026-01-01T00:00:00Z"),
      ev("TaskStarted", "2026-01-03T00:00:00Z"),
    ];
    const analysis = analyzeVariants("project_lifecycle", [
      { caseId: "p1", events, outcome: "open" },
    ]);
    expect(analysis.variants[0].signature).toEqual([
      "TaskCreated",
      "TaskStarted",
      "TaskCompleted",
    ]);
  });

  it("computes duration and rework from the sequence", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      projectCase("p1", ["A", "B", "A", "C"]), // 4 events, 3 unique → rework 0.25
    ]);
    const variant = analysis.variants[0];
    expect(variant.reworkRate).toBeCloseTo(0.25, 4);
    expect(variant.avgDurationMs).toBe(3 * 24 * 60 * 60 * 1000);
    expect(variant.medianDurationMs).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("computes success rate only from decided cases; open cases don't dilute it", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      projectCase("p1", ["A", "B"], "success"),
      projectCase("p2", ["A", "B"], "failure"),
      projectCase("p3", ["A", "B"], "open"),
    ]);
    const variant = analysis.variants[0];
    expect(variant.successRate).toBeCloseTo(0.5, 4);
    expect(variant.decidedCaseCount).toBe(2);
  });

  it("selects the most successful variant as reference and scores fitness/deviations", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      projectCase("p1", ["A", "B", "C"], "success"),
      projectCase("p2", ["A", "B", "C"], "success"),
      projectCase("p3", ["A", "X"], "failure"),
    ]);

    const reference = analysis.variants.find((v) => v.isReference);
    expect(reference?.signature).toEqual(["A", "B", "C"]);
    expect(analysis.referenceVariantId).toBe(reference?.variantId);

    const deviant = analysis.assignments.find((a) => a.caseId === "p3");
    expect(deviant?.fitnessVsReference).toBeLessThan(1);
    expect(deviant?.skippedActivities).toEqual(["B", "C"]);
    expect(deviant?.insertedActivities).toEqual(["X"]);

    const conforming = analysis.assignments.find((a) => a.caseId === "p1");
    expect(conforming?.fitnessVsReference).toBe(1);
    expect(conforming?.skippedActivities).toEqual([]);
  });

  it("NEVER invents a reference without outcome data (guardrail)", () => {
    const analysis = analyzeVariants("project_lifecycle", [
      projectCase("p1", ["A", "B"]),
      projectCase("p2", ["A", "C"]),
    ]);
    expect(analysis.referenceVariantId).toBeNull();
    expect(analysis.variants.every((v) => v.successRate === null)).toBe(true);
    expect(analysis.assignments.every((a) => a.fitnessVsReference === null)).toBe(true);
  });

  it("handles empty input and event-less cases honestly", () => {
    const empty = analyzeVariants("project_lifecycle", []);
    expect(empty.variants).toEqual([]);
    expect(empty.referenceVariantId).toBeNull();

    const eventless = analyzeVariants("project_lifecycle", [
      { caseId: "p1", events: [], outcome: "open" },
    ]);
    expect(eventless.analyzedCases).toBe(0);
    expect(eventless.quality.casesWithoutEvents).toBe(1);
  });
});

describe("sequenceFitness", () => {
  it("is 1 for identical, 0 against empty, symmetric and bounded", () => {
    expect(sequenceFitness(["A", "B"], ["A", "B"])).toBe(1);
    expect(sequenceFitness([], ["A"])).toBe(0);
    expect(sequenceFitness([], [])).toBe(1);
    const ab = sequenceFitness(["A", "B", "C"], ["A", "C"]);
    const ba = sequenceFitness(["A", "C"], ["A", "B", "C"]);
    expect(ab).toBe(ba);
    expect(ab).toBeGreaterThan(0);
    expect(ab).toBeLessThan(1);
  });
});
