// ============================================================================
// Earned Value: SPI and CPI, and the four ways they can honestly refuse
// ============================================================================
// SPI and CPI answer the two questions every steering committee asks — "are we
// on schedule?" and "are we on budget?" — as ratios where 1.00 is on plan.
// They need three numbers per task, and the whole discipline is in getting
// those three right and in refusing to produce a ratio when one is missing.
//
//   PV  Planned Value  what the BASELINE said should be done by today
//   EV  Earned Value   what has actually been finished, valued at the baseline
//   AC  Actual Cost    what has actually been spent getting there
//
//   SPI = EV / PV      < 1 behind schedule
//   CPI = EV / AC      < 1 over budget
//
// EV against PV is what makes this different from "% complete vs % of time
// elapsed": both sides are valued in the SAME units at the SAME rates, so
// finishing cheap work early cannot disguise expensive work running late.
//
// WHY THE SCHEDULE SIDE IS IN HOURS
// SPI is computed from hours, not money. Hours need no rate, so a project that
// has never entered a cost rate still gets a real schedule index. CPI is the
// one that needs money, and it says so when it cannot have it.
//
// THE REFUSALS
// A ratio with a zero denominator is not 1.0, and it is not infinity — it is
// "no answer yet", and each case means something different to a PM:
//   no baseline      → nothing was ever committed to; there is nothing to slip
//   PV = 0           → today is before any planned work; too early to judge
//   AC = 0           → no hours logged; nothing has been spent to compare
//   nothing priced   → hours exist but no rate does; CPI is unavailable, and
//                      SPI is unaffected because it never needed one
// ============================================================================

export interface EvmTaskInput {
  /** Dates the work was COMMITTED to. Without them the task has no PV. */
  baseline_start_date?: string | null;
  baseline_end_date?: string | null;
  baseline_estimate_hours?: number | null;
  /** Today's plan — used only as the fallback budget, never as the baseline. */
  estimate_hours?: number | null;
  actual_hours?: number | null;
  progress?: number | null;
  status: string;
  assigned_resource_id?: string | null;
}

/** Statuses that mean the work is finished, so EV is the full budget. */
const DONE = new Set(["done", "tested", "implemented", "completed", "closed"]);

/**
 * Budget At Completion for one task, in hours.
 *
 * The BASELINE estimate, not today's: re-estimating a task upward mid-flight
 * must not quietly enlarge the budget it is being judged against. Falls back to
 * the current estimate only when no baseline hours were captured.
 */
export function taskBac(task: EvmTaskInput): number {
  const baseline = Number(task.baseline_estimate_hours);
  if (Number.isFinite(baseline) && baseline > 0) return baseline;
  const current = Number(task.estimate_hours);
  return Number.isFinite(current) && current > 0 ? current : 0;
}

/**
 * How much of this task the baseline said would be done by `asOf`, 0–1.
 *
 * Straight-line across the baseline window. Real EVM allows any spread curve,
 * but a straight line is the only one this data can support — inventing an
 * S-curve would be inventing the answer.
 */
export function plannedFraction(task: EvmTaskInput, asOf: Date): number | null {
  const start = task.baseline_start_date ? Date.parse(task.baseline_start_date) : NaN;
  const end = task.baseline_end_date ? Date.parse(task.baseline_end_date) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null; // no baseline
  const now = asOf.getTime();
  if (now <= start) return 0;
  if (now >= end) return 1;
  const span = end - start;
  return span > 0 ? (now - start) / span : 1;
}

/**
 * How much of this task is actually done, 0–1.
 *
 * A terminal status is 100% whatever the progress field says — a task marked
 * done with progress left at 0 is a data-entry gap, not work that never
 * happened, and letting it drag EV down would understate the whole project.
 */
export function earnedFraction(task: EvmTaskInput): number {
  if (DONE.has((task.status ?? "").toLowerCase())) return 1;
  const progress = Number(task.progress);
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  return Math.min(1, progress / 100);
}

export interface EvmTaskValues {
  /** Budget At Completion, hours. */
  bacHours: number;
  /** Planned Value, hours. NaN when the task has no baseline. */
  plannedValueHours: number;
  /** Earned Value, hours. */
  earnedValueHours: number;
  /** Actual hours logged. */
  actualHours: number;
  /** The same three in money. NaN when the task cannot be priced. */
  bacCost: number;
  plannedValueCost: number;
  earnedValueCost: number;
  actualCost: number;
}

/**
 * The EVM numbers for one task.
 *
 * NaN — not 0 — wherever the data cannot support a figure. The KPI functions
 * drop non-finite values, so a half-baselined project still sums the half it
 * knows instead of silently counting the rest as zero and reporting a project
 * that looks wildly ahead of schedule.
 */
export function taskEarnedValue(
  task: EvmTaskInput,
  asOf: Date,
  rateByResource: Map<string, number>,
): EvmTaskValues {
  const bacHours = taskBac(task);
  const planned = plannedFraction(task, asOf);
  const earned = earnedFraction(task);

  const plannedValueHours = planned == null ? NaN : bacHours * planned;
  const earnedValueHours = bacHours * earned;
  const actualHours = Number(task.actual_hours) || 0;

  const rate = task.assigned_resource_id ? rateByResource.get(task.assigned_resource_id) : undefined;
  const priced = rate != null && rate > 0;

  return {
    bacHours,
    plannedValueHours,
    earnedValueHours,
    actualHours,
    bacCost: priced ? bacHours * rate : NaN,
    plannedValueCost: priced && Number.isFinite(plannedValueHours) ? plannedValueHours * rate : NaN,
    earnedValueCost: priced ? earnedValueHours * rate : NaN,
    // AC is what was SPENT. Unlike the forecasting cost figure elsewhere, this
    // never falls back to the estimate: money not yet spent is not a cost.
    actualCost: priced ? actualHours * rate : NaN,
  };
}

export interface EvmTotals {
  pvHours: number;
  evHours: number;
  acHours: number;
  bacHours: number;
  pvCost: number;
  evCost: number;
  acCost: number;
  bacCost: number;
  /** Tasks carrying a baseline — the basis SPI is computed from. */
  baselinedTasks: number;
  pricedTasks: number;
  totalTasks: number;
}

export function sumEarnedValue(
  tasks: readonly EvmTaskInput[],
  asOf: Date,
  rateByResource: Map<string, number>,
): EvmTotals {
  const totals: EvmTotals = {
    pvHours: 0, evHours: 0, acHours: 0, bacHours: 0,
    pvCost: 0, evCost: 0, acCost: 0, bacCost: 0,
    baselinedTasks: 0, pricedTasks: 0, totalTasks: tasks.length,
  };
  for (const task of tasks) {
    const v = taskEarnedValue(task, asOf, rateByResource);
    if (Number.isFinite(v.plannedValueHours)) {
      totals.pvHours += v.plannedValueHours;
      totals.baselinedTasks++;
    }
    totals.evHours += v.earnedValueHours;
    totals.acHours += v.actualHours;
    totals.bacHours += v.bacHours;
    if (Number.isFinite(v.actualCost)) {
      totals.pricedTasks++;
      totals.acCost += v.actualCost;
      totals.bacCost += v.bacCost;
      totals.evCost += v.earnedValueCost;
      if (Number.isFinite(v.plannedValueCost)) totals.pvCost += v.plannedValueCost;
    }
  }
  return totals;
}

export type EvmUnavailable =
  | "no_baseline"   // nothing was committed to
  | "not_started"   // today precedes all planned work
  | "nothing_spent" // no hours logged
  | "no_rates";     // hours exist, money does not

export type EvmIndex =
  | { status: "ok"; value: number }
  | { status: "unavailable"; reason: EvmUnavailable };

/**
 * Schedule Performance Index — EV / PV, in hours.
 *
 * 1.00 = on plan. 0.80 = four fifths of the work that should be done is done.
 * Needs no cost rate at all.
 */
export function scheduleIndex(totals: EvmTotals): EvmIndex {
  if (totals.baselinedTasks === 0) return { status: "unavailable", reason: "no_baseline" };
  // PV of zero means today is before the first baselined start. Reporting 1.00
  // ("perfectly on schedule") for a project that has not begun is a lie a
  // steering committee would act on.
  if (!(totals.pvHours > 0)) return { status: "unavailable", reason: "not_started" };
  return { status: "ok", value: totals.evHours / totals.pvHours };
}

/**
 * Cost Performance Index — EV / AC, in money.
 *
 * 1.00 = a unit of value costs a unit of budget. 0.80 = every dollar bought
 * eighty cents of progress.
 */
export function costIndex(totals: EvmTotals): EvmIndex {
  if (totals.pricedTasks === 0) return { status: "unavailable", reason: "no_rates" };
  // AC of zero is not infinite efficiency; it is a project nobody has billed to
  // yet. There is nothing to divide.
  if (!(totals.acCost > 0)) return { status: "unavailable", reason: "nothing_spent" };
  return { status: "ok", value: totals.evCost / totals.acCost };
}

/** Schedule Variance in hours. Negative = behind. */
export function scheduleVarianceHours(totals: EvmTotals): number | null {
  return totals.baselinedTasks > 0 ? totals.evHours - totals.pvHours : null;
}

/** Cost Variance in money. Negative = over budget. */
export function costVariance(totals: EvmTotals): number | null {
  return totals.pricedTasks > 0 ? totals.evCost - totals.acCost : null;
}

/**
 * Estimate At Completion — BAC / CPI.
 *
 * "If we keep spending at the efficiency we have shown so far, this is what
 * the whole thing costs." The most quoted EVM forecast, and the one most often
 * shown without saying it assumes today's efficiency holds.
 */
export function estimateAtCompletion(totals: EvmTotals): number | null {
  const cpi = costIndex(totals);
  if (cpi.status !== "ok" || !(cpi.value > 0)) return null;
  return totals.bacCost / cpi.value;
}

/** Variance At Completion — BAC − EAC. Negative = expected overrun. */
export function varianceAtCompletion(totals: EvmTotals): number | null {
  const eac = estimateAtCompletion(totals);
  return eac == null ? null : totals.bacCost - eac;
}

/** How a value reads on a card: 1.00 is on plan, below it is trouble. */
export function indexTone(value: number): "good" | "warn" | "danger" {
  if (value >= 1) return "good";
  if (value >= 0.9) return "warn";
  return "danger";
}
