// ============================================================================
// CAP-046 / PD-019 — Feature 2: Root Cause Miner engine tests.
// Guard id: PROCESS-MINING-ROOT-CAUSE-ENGINE — statistical evidence only
// (no recommendations), adverse associations only, sample-size gating,
// structural dimensions only (PO-10: never a person dimension).
// ============================================================================

import { describe, it, expect } from "vitest";
import { mineRootCauses, phiCoefficient } from "../engine";
import type { RootCauseTaskInput } from "../types";

let counter = 0;
function task(overrides: Partial<RootCauseTaskInput> = {}): RootCauseTaskInput {
  counter += 1;
  return {
    taskId: `t-${counter}`,
    title: `Task ${counter}`,
    milestoneId: null,
    milestoneLabel: null,
    priority: "p2",
    hasOwner: true,
    isCritical: false,
    discipline: null,
    trade: null,
    location: null,
    isBlocked: false,
    isDelayed: false,
    reworkCount: 0,
    ...overrides,
  };
}

describe("PROCESS-MINING-ROOT-CAUSE-ENGINE", () => {
  it("surfaces an adverse association with lift, phi, coverage and examples", () => {
    const tasks = [
      // Milestone M1: 4 of 5 delayed
      ...Array.from({ length: 4 }, () =>
        task({ milestoneId: "m1", milestoneLabel: "Foundations", isDelayed: true }),
      ),
      task({ milestoneId: "m1", milestoneLabel: "Foundations" }),
      // Milestone M2: 0 of 5 delayed
      ...Array.from({ length: 5 }, () => task({ milestoneId: "m2", milestoneLabel: "Roof" })),
    ];
    const result = mineRootCauses(tasks);

    const finding = result.findings.find(
      (f) => f.problemType === "delay" && f.dimension === "milestone" && f.dimensionValue === "m1",
    );
    expect(finding).toBeDefined();
    expect(finding!.evidence.groupProblemCount).toBe(4);
    expect(finding!.evidence.groupRate).toBeCloseTo(0.8, 4);
    expect(finding!.evidence.baselineRate).toBeCloseTo(0.4, 4);
    expect(finding!.evidence.lift).toBeCloseTo(2, 2);
    expect(finding!.evidence.phi).toBeGreaterThan(0);
    expect(finding!.evidence.coverage).toBeCloseTo(1, 4);
    expect(finding!.evidence.exampleRefs.length).toBeGreaterThan(0);
    expect(finding!.influenceScore).toBeGreaterThan(0);
  });

  it("reports only ADVERSE associations (protective groups are never findings)", () => {
    const tasks = [
      ...Array.from({ length: 5 }, () =>
        task({ milestoneId: "bad", milestoneLabel: "Bad", isBlocked: true }),
      ),
      ...Array.from({ length: 5 }, () => task({ milestoneId: "good", milestoneLabel: "Good" })),
    ];
    const result = mineRootCauses(tasks);
    const good = result.findings.find((f) => f.dimensionValue === "good");
    expect(good).toBeUndefined();
  });

  it("never emits recommendations — explanations state evidence only", () => {
    const tasks = [
      ...Array.from({ length: 6 }, () => task({ hasOwner: false, isDelayed: true })),
      ...Array.from({ length: 6 }, () => task({ hasOwner: true })),
    ];
    const result = mineRootCauses(tasks);
    for (const finding of result.findings) {
      expect(finding.explanationEs).toContain("evidencia de asociación");
      expect(finding.explanationEs).not.toMatch(/deberías|recomend|asigna |reasigna/i);
      expect(finding.explanationEn).toContain("not a confirmed cause");
    }
    const ownership = result.findings.find(
      (f) => f.dimension === "ownership" && f.dimensionValue === "unassigned",
    );
    expect(ownership).toBeDefined();
  });

  it("PO-10: no per-person dimension exists in any finding", () => {
    const tasks = Array.from({ length: 12 }, (_, i) =>
      task({ isDelayed: i % 2 === 0, hasOwner: i % 3 === 0 }),
    );
    const result = mineRootCauses(tasks);
    const allowed = new Set([
      "milestone",
      "priority",
      "ownership",
      "criticality",
      "discipline",
      "trade",
      "location",
    ]);
    for (const finding of result.findings) {
      expect(allowed.has(finding.dimension)).toBe(true);
      expect(finding.dimension).not.toMatch(/owner_user|person|user|assignee/);
    }
  });

  it("gates small groups (< 3 members) and small samples via confidence", () => {
    const tasks = [
      task({ trade: "electrical", isBlocked: true }),
      task({ trade: "electrical", isBlocked: true }), // only 2 → below MIN_GROUP_SIZE
      ...Array.from({ length: 4 }, () => task({})),
    ];
    const result = mineRootCauses(tasks);
    expect(result.findings.find((f) => f.dimension === "trade")).toBeUndefined();
    expect(result.limitations.some((l) => l.includes("Small sample"))).toBe(true);
  });

  it("is deterministic and handles empty input", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task({ priority: i < 4 ? "p1" : "p3", isDelayed: i < 3 }),
    );
    expect(mineRootCauses(tasks)).toEqual(mineRootCauses(tasks));

    const empty = mineRootCauses([]);
    expect(empty.findings).toEqual([]);
    expect(empty.totalTasks).toBe(0);
  });
});

describe("phiCoefficient", () => {
  it("is 0 on empty margins, positive for direct association, bounded by 1", () => {
    expect(phiCoefficient(0, 0, 0, 0)).toBe(0);
    expect(phiCoefficient(5, 0, 0, 5)).toBe(1);
    expect(phiCoefficient(0, 5, 5, 0)).toBe(-1);
    const mid = phiCoefficient(4, 1, 1, 4);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});
