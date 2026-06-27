// ============================================================================
// ProjectOps360° — Resource Capacity Intelligence: deterministic formulas
// ============================================================================
// Pure, deterministic capacity math. No DB, no AI, no randomness.
// Percentages are expressed 0–100 (e.g. availability_percent = 90 means 90%).
// Same inputs → same outputs.
//
// These are the project-type-agnostic calculations. Labels/terminology change
// per project type at the UI layer; the math here never does.
// ============================================================================

export type CapacityStatus =
  | "available"        // 0–69% utilization
  | "healthy"          // 70–89%
  | "near_capacity"    // 90–100%
  | "overallocated"    // 101–120%
  | "critical"         // >120%
  | "needs_review";    // no capacity data

export type TaskCapacityFlag = "ok" | "incomplete_estimate" | "unassigned";

export type WorkforceHealthBand = "healthy" | "watch" | "at_risk" | "critical";

const clampPct = (v: number): number => (Number.isFinite(v) ? Math.max(0, v) : 0);

/** Theoretical hours available before any adjustment. */
export function nominalCapacityHours(weeklyCapacityHours: number): number {
  return Math.max(0, weeklyCapacityHours || 0);
}

/**
 * Real hours available after availability + overhead adjustments.
 * effective = weekly * availability% * (1 - overhead%)
 * Example: 40 * 0.90 * (1 - 0.25) = 27
 */
export function effectiveCapacityHours(
  weeklyCapacityHours: number,
  availabilityPercent: number,
  overheadPercent: number,
): number {
  const w = Math.max(0, weeklyCapacityHours || 0);
  const a = clampPct(availabilityPercent ?? 100) / 100;
  const o = Math.min(1, clampPct(overheadPercent ?? 0) / 100);
  return round2(w * a * (1 - o));
}

export function remainingCapacityHours(effective: number, assigned: number): number {
  return round2((effective || 0) - (assigned || 0));
}

/** Utilization %. Returns null when there is no effective capacity to divide by. */
export function utilizationPercent(assigned: number, effective: number): number | null {
  if (!effective || effective <= 0) return null;
  return round2((assigned / effective) * 100);
}

export function overallocatedHours(assigned: number, effective: number): number {
  return round2(Math.max(0, (assigned || 0) - (effective || 0)));
}

export function capacityGapHours(requiredHours: number, availableEffectiveHours: number): number {
  return round2((requiredHours || 0) - (availableEffectiveHours || 0));
}

export function workforceAvailabilityPercent(totalEffective: number, totalNominal: number): number | null {
  if (!totalNominal || totalNominal <= 0) return null;
  return round2((totalEffective / totalNominal) * 100);
}

export function projectOverheadHours(totalNominal: number, totalEffective: number): number {
  return round2(Math.max(0, (totalNominal || 0) - (totalEffective || 0)));
}

/**
 * Classify a resource by utilization. `hasCapacityData=false` → needs_review,
 * regardless of utilization (we cannot trust a number with no capacity input).
 */
export function classifyCapacityStatus(
  utilization: number | null,
  hasCapacityData: boolean,
): CapacityStatus {
  if (!hasCapacityData || utilization === null) return "needs_review";
  if (utilization <= 69) return "available";
  if (utilization <= 89) return "healthy";
  if (utilization <= 100) return "near_capacity";
  if (utilization <= 120) return "overallocated";
  return "critical";
}

export interface HealthDeduction { reason: string; points: number; count?: number }

export interface WorkforceHealthInput {
  criticalResourceCount: number;
  overallocatedResourceCount: number;
  unassignedCriticalTaskCount: number;
  missingEstimateCount: number;
  severeCapacityGapMilestoneCount: number;
  overheadExceedsThreshold: boolean;
  effectiveBelow70PctOfNominal: boolean;
  missingCriticalRoleCount: number;
}

export interface WorkforceHealthResult {
  score: number;
  band: WorkforceHealthBand;
  deductions: HealthDeduction[];
}

/**
 * Project-level Workforce Health Index. Starts at 100, subtracts explainable
 * deductions, clamps to 0–100. Every deduction is returned so the UI can show
 * exactly why points were removed.
 */
export function calculateWorkforceHealthIndex(input: WorkforceHealthInput): WorkforceHealthResult {
  const deductions: HealthDeduction[] = [];
  const add = (reason: string, perItem: number, count: number) => {
    if (count > 0) deductions.push({ reason, points: perItem * count, count });
  };

  add("critical_resource", 10, input.criticalResourceCount);
  add("overallocated_resource", 5, input.overallocatedResourceCount);
  add("unassigned_critical_task", 5, input.unassignedCriticalTaskCount);
  add("missing_estimate", 3, input.missingEstimateCount);
  add("milestone_severe_capacity_gap", 10, input.severeCapacityGapMilestoneCount);
  add("missing_critical_role", 5, input.missingCriticalRoleCount);
  if (input.overheadExceedsThreshold) deductions.push({ reason: "overhead_over_threshold", points: 5 });
  if (input.effectiveBelow70PctOfNominal) deductions.push({ reason: "effective_below_70pct_nominal", points: 5 });

  const total = deductions.reduce((s, d) => s + d.points, 0);
  const score = Math.max(0, Math.min(100, 100 - total));
  const band: WorkforceHealthBand =
    score >= 85 ? "healthy" : score >= 70 ? "watch" : score >= 50 ? "at_risk" : "critical";

  return { score, band, deductions };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
