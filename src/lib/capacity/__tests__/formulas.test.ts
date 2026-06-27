import { describe, it, expect } from "vitest";
import {
  effectiveCapacityHours, utilizationPercent, overallocatedHours, remainingCapacityHours,
  classifyCapacityStatus, workforceAvailabilityPercent, projectOverheadHours,
  capacityGapHours, calculateWorkforceHealthIndex,
} from "@/lib/capacity/formulas";

describe("effectiveCapacityHours", () => {
  it("40h @ 90% availability, 25% overhead = 27h (spec example)", () => {
    expect(effectiveCapacityHours(40, 90, 25)).toBe(27);
  });
  it("defaults: 100% availability, 0% overhead = nominal", () => {
    expect(effectiveCapacityHours(40, 100, 0)).toBe(40);
  });
  it("clamps overhead to 100%", () => {
    expect(effectiveCapacityHours(40, 100, 150)).toBe(0);
  });
});

describe("utilization + status", () => {
  it("42 assigned / 30 effective = 140% (spec example)", () => {
    expect(utilizationPercent(42, 30)).toBe(140);
  });
  it(">120% is critical", () => {
    expect(classifyCapacityStatus(utilizationPercent(42, 30), true)).toBe("critical");
  });
  it("band thresholds", () => {
    expect(classifyCapacityStatus(50, true)).toBe("available");
    expect(classifyCapacityStatus(80, true)).toBe("healthy");
    expect(classifyCapacityStatus(95, true)).toBe("near_capacity");
    expect(classifyCapacityStatus(110, true)).toBe("overallocated");
    expect(classifyCapacityStatus(130, true)).toBe("critical");
  });
  it("no capacity data → needs_review", () => {
    expect(classifyCapacityStatus(null, false)).toBe("needs_review");
    expect(classifyCapacityStatus(50, false)).toBe("needs_review");
  });
  it("zero effective capacity → utilization null → needs_review", () => {
    expect(utilizationPercent(10, 0)).toBeNull();
    expect(classifyCapacityStatus(utilizationPercent(10, 0), true)).toBe("needs_review");
  });
});

describe("derived hours", () => {
  it("overallocated = max(0, assigned - effective)", () => {
    expect(overallocatedHours(42, 30)).toBe(12);
    expect(overallocatedHours(20, 30)).toBe(0);
  });
  it("remaining can be negative", () => {
    expect(remainingCapacityHours(30, 42)).toBe(-12);
  });
  it("capacity gap", () => {
    expect(capacityGapHours(50, 32)).toBe(18);
  });
  it("workforce availability % and overhead hours", () => {
    expect(workforceAvailabilityPercent(228, 310)).toBe(73.55);
    expect(projectOverheadHours(310, 228)).toBe(82);
    expect(workforceAvailabilityPercent(100, 0)).toBeNull();
  });
});

describe("workforce health index", () => {
  it("perfect project = 100 healthy, no deductions", () => {
    const r = calculateWorkforceHealthIndex({
      criticalResourceCount: 0, overallocatedResourceCount: 0, unassignedCriticalTaskCount: 0,
      missingEstimateCount: 0, severeCapacityGapMilestoneCount: 0, overheadExceedsThreshold: false,
      effectiveBelow70PctOfNominal: false, missingCriticalRoleCount: 0,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("healthy");
    expect(r.deductions).toHaveLength(0);
  });
  it("deductions are explainable and clamp at 0", () => {
    const r = calculateWorkforceHealthIndex({
      criticalResourceCount: 5, overallocatedResourceCount: 5, unassignedCriticalTaskCount: 3,
      missingEstimateCount: 4, severeCapacityGapMilestoneCount: 2, overheadExceedsThreshold: true,
      effectiveBelow70PctOfNominal: true, missingCriticalRoleCount: 2,
    });
    expect(r.score).toBe(0); // way over 100 in deductions → clamped
    expect(r.band).toBe("critical");
    expect(r.deductions.find((d) => d.reason === "critical_resource")?.points).toBe(50);
  });
  it("mid-range project lands in a sensible band", () => {
    const r = calculateWorkforceHealthIndex({
      criticalResourceCount: 1, overallocatedResourceCount: 1, unassignedCriticalTaskCount: 0,
      missingEstimateCount: 1, severeCapacityGapMilestoneCount: 0, overheadExceedsThreshold: false,
      effectiveBelow70PctOfNominal: false, missingCriticalRoleCount: 0,
    });
    expect(r.score).toBe(82); // 100 -10 -5 -3
    expect(r.band).toBe("watch");
  });
});
