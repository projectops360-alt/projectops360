import { describe, it, expect } from "vitest";
import { buildCapacitySummary } from "@/lib/capacity/insight";
import type { ResourceCapacityResult, ResourceCapacityRow } from "@/lib/capacity/service";
import { calculateWorkforceHealthIndex } from "@/lib/capacity/formulas";

const labels = { resourceWord: "Resource", resourcesWord: "Resources" };

function row(over: Partial<ResourceCapacityRow>): ResourceCapacityRow {
  return {
    resourceKey: "r1", name: "R1", role: "Dev", userId: null, teamMemberId: null,
    nominalWeeklyHours: 40, effectiveWeeklyHours: 36, nominalPeriodHours: 160, effectivePeriodHours: 144,
    assignedHours: 0, remainingHours: 144, utilizationPercent: 0, overallocatedHours: 0,
    overheadPercent: 10, availabilityPercent: 100, status: "available",
    assignedTaskCount: 0, criticalTaskCount: 0, hasCapacityData: true, ...over,
  };
}

function result(over: Partial<ResourceCapacityResult>): ResourceCapacityResult {
  const base: ResourceCapacityResult = {
    hasResources: true, hasCapacityInputs: true, weeks: [], resources: [], milestones: [],
    totals: {
      totalNominalHours: 0, totalEffectiveHours: 0, totalAssignedHours: 0, totalRemainingHours: 0,
      totalOverallocatedHours: 0, workforceAvailabilityPercent: 100, projectOverheadPercent: 10,
      overallocatedResourceCount: 0, criticalResourceCount: 0, unassignedTaskCount: 0,
      unassignedCriticalTaskCount: 0, missingEstimateCount: 0, atRiskMilestoneCount: 0, averageUtilizationPercent: 0,
    },
    weekly: [], health: calculateWorkforceHealthIndex({
      criticalResourceCount: 0, overallocatedResourceCount: 0, unassignedCriticalTaskCount: 0,
      missingEstimateCount: 0, severeCapacityGapMilestoneCount: 0, overheadExceedsThreshold: false,
      effectiveBelow70PctOfNominal: false, missingCriticalRoleCount: 0,
    }), generatedAt: "",
  };
  return { ...base, ...over };
}

describe("buildCapacitySummary", () => {
  it("empty project asks to add resources", () => {
    const s = buildCapacitySummary(result({ hasResources: false }), labels, false);
    expect(s.bullets).toHaveLength(0);
    expect(s.recommendations[0]).toMatch(/add resources/i);
  });

  it("surfaces an overloaded resource as a bottleneck + recommendation", () => {
    const r = result({
      resources: [row({ name: "Sofía", status: "critical", utilizationPercent: 146, overallocatedHours: 66 })],
      totals: { ...result({}).totals, criticalResourceCount: 1 },
    });
    const s = buildCapacitySummary(r, labels, false);
    expect(s.bottlenecks.some((b) => b.includes("Sofía") && b.includes("146%"))).toBe(true);
    expect(s.recommendations.some((x) => x.includes("Sofía"))).toBe(true);
  });

  it("warns about missing estimates and unassigned critical tasks (incomplete forecast)", () => {
    const r = result({
      resources: [row({})],
      totals: { ...result({}).totals, missingEstimateCount: 5, unassignedCriticalTaskCount: 2 },
    });
    const s = buildCapacitySummary(r, labels, false);
    expect(s.warnings.some((w) => /5 tasks have no estimate/i.test(w))).toBe(true);
    expect(s.warnings.some((w) => /2 critical tasks are unassigned/i.test(w))).toBe(true);
  });

  it("flags missing per-resource capacity inputs", () => {
    const r = result({ hasCapacityInputs: false, resources: [row({ hasCapacityData: false, status: "needs_review" })] });
    const s = buildCapacitySummary(r, labels, false);
    expect(s.warnings.some((w) => /no per-resource capacity/i.test(w))).toBe(true);
  });
});
