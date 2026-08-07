// ============================================================================
// Monthly cash flow — when the money actually leaves, not just how much
// ============================================================================
// A budget total answers "how much"; it never answers "when". A project can be
// perfectly on budget and still run out of cash in March, and nothing in the
// product could show that: costs existed only as totals attached to phases.
//
// This spreads each task's cost across the months it is actually worked. The
// spread is by CALENDAR DAYS in each month — a task running 20 Jan → 10 Feb
// puts twelve days of its cost in January and ten in February — because that
// is the only distribution the data supports. A resource-loaded S-curve would
// look more sophisticated and would be invented.
//
// Three series, because they answer different questions:
//   planned    what the CURRENT plan will cost, month by month
//   baseline   what the COMMITTED plan said it would cost — the two diverging
//              is the cash consequence of rescheduling
//   actual     what has been spent, from logged hours only
// ============================================================================

export interface CashFlowTask {
  start_date?: string | null;
  end_date?: string | null;
  baseline_start_date?: string | null;
  baseline_end_date?: string | null;
  estimate_hours?: number | null;
  baseline_estimate_hours?: number | null;
  actual_hours?: number | null;
  assigned_resource_id?: string | null;
  status?: string | null;
}

export interface CashFlowMonth {
  /** "2026-01" — sortable and locale-free; formatting belongs to the UI. */
  month: string;
  planned: number;
  baseline: number;
  actual: number;
  /** Running totals — the shape a cash-flow curve is actually read from. */
  cumulativePlanned: number;
  cumulativeBaseline: number;
  cumulativeActual: number;
}

export interface CashFlowResult {
  months: CashFlowMonth[];
  /** Tasks that could not be priced or dated, so a gap is never silent. */
  skippedUnpriced: number;
  skippedUndated: number;
  /** The month the current plan spends most — where the cash squeeze lands. */
  peakMonth: string | null;
  peakAmount: number;
  hasBaseline: boolean;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * Split an amount across the months a window covers, weighted by how many days
 * of the window fall in each.
 *
 * A window with no span at all (start === end, a milestone-like task) puts the
 * whole amount in its single month rather than dividing by zero.
 */
export function spreadAcrossMonths(
  start: Date,
  end: Date,
  amount: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!(amount > 0)) return out;

  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);

  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor <= to) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const segmentEnd = monthEnd < to ? monthEnd : to;
    const days = Math.round((segmentEnd.getTime() - cursor.getTime()) / 86_400_000) + 1;
    const key = monthKey(cursor);
    out.set(key, (out.get(key) ?? 0) + (amount * days) / totalDays);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return out;
}

/** Statuses meaning the work is finished — actual spend is realised. */
const DONE = new Set(["done", "tested", "implemented", "completed", "closed"]);

/**
 * Monthly cash flow for a set of tasks.
 *
 * Returns a CONTIGUOUS run of months: a month in which nothing is spent still
 * appears, with zeros. Skipping it would compress the gap and draw a curve
 * that implies continuous spending where there was a pause.
 */
export function monthlyCashFlow(
  tasks: readonly CashFlowTask[],
  rateByResource: Map<string, number>,
): CashFlowResult {
  const planned = new Map<string, number>();
  const baseline = new Map<string, number>();
  const actual = new Map<string, number>();
  let skippedUnpriced = 0;
  let skippedUndated = 0;
  let hasBaseline = false;

  for (const task of tasks) {
    const rate = task.assigned_resource_id ? rateByResource.get(task.assigned_resource_id) : undefined;
    const estimate = Number(task.estimate_hours) || 0;
    const actualHours = Number(task.actual_hours) || 0;

    if (rate == null || !(rate > 0)) {
      if (estimate > 0 || actualHours > 0) skippedUnpriced++;
      continue;
    }

    const start = parse(task.start_date);
    const end = parse(task.end_date) ?? start;
    if (!start || !end) {
      if (estimate > 0) skippedUndated++;
      continue;
    }

    for (const [month, amount] of spreadAcrossMonths(start, end, estimate * rate)) {
      planned.set(month, (planned.get(month) ?? 0) + amount);
    }

    const bStart = parse(task.baseline_start_date);
    const bEnd = parse(task.baseline_end_date) ?? bStart;
    if (bStart && bEnd) {
      hasBaseline = true;
      const bHours = Number(task.baseline_estimate_hours) || estimate;
      for (const [month, amount] of spreadAcrossMonths(bStart, bEnd, bHours * rate)) {
        baseline.set(month, (baseline.get(month) ?? 0) + amount);
      }
    }

    // Actual spend follows the work's own window: money left as the work was
    // done, not all at once on the day it finished.
    if (actualHours > 0) {
      const realisedEnd = DONE.has((task.status ?? "").toLowerCase()) ? end : new Date();
      const cappedEnd = realisedEnd < start ? start : realisedEnd;
      for (const [month, amount] of spreadAcrossMonths(start, cappedEnd, actualHours * rate)) {
        actual.set(month, (actual.get(month) ?? 0) + amount);
      }
    }
  }

  const keys = [...new Set([...planned.keys(), ...baseline.keys(), ...actual.keys()])].sort();
  if (keys.length === 0) {
    return {
      months: [], skippedUnpriced, skippedUndated,
      peakMonth: null, peakAmount: 0, hasBaseline: false,
    };
  }

  // Fill the gaps so a quiet month reads as a quiet month.
  const all: string[] = [];
  const [firstYear, firstMonth] = keys[0].split("-").map(Number);
  const [lastYear, lastMonth] = keys[keys.length - 1].split("-").map(Number);
  let cursor = new Date(Date.UTC(firstYear, firstMonth - 1, 1));
  const last = new Date(Date.UTC(lastYear, lastMonth - 1, 1));
  while (cursor <= last) {
    all.push(monthKey(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  let cp = 0, cb = 0, ca = 0;
  let peakMonth: string | null = null;
  let peakAmount = 0;

  const months = all.map((month) => {
    const p = Math.round(planned.get(month) ?? 0);
    const b = Math.round(baseline.get(month) ?? 0);
    const a = Math.round(actual.get(month) ?? 0);
    cp += p; cb += b; ca += a;
    if (p > peakAmount) { peakAmount = p; peakMonth = month; }
    return {
      month, planned: p, baseline: b, actual: a,
      cumulativePlanned: cp, cumulativeBaseline: cb, cumulativeActual: ca,
    };
  });

  return { months, skippedUnpriced, skippedUndated, peakMonth, peakAmount, hasBaseline };
}
