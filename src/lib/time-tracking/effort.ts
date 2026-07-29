// ============================================================================
// ProjectOps360° — Time Tracking Engine · Duration & effort math (pure)
// ============================================================================
// No database, no React: every number a user sees about effort is computed
// here, so it can be tested exhaustively and reused by the report, the
// dashboard, Isabella and (next) the EVM engine without drifting.
// ============================================================================

import type { EffortSeverity, EffortSummary } from "./types";

/** Hours are money — keep two decimals and never let float noise through. */
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export const MAX_DAILY_HOURS = 24;

// ── Duration from an interval ────────────────────────────────────────────────

export interface DurationResult {
  ok: boolean;
  hours: number | null;
  /** Machine-readable so the UI can phrase it in the user's language. */
  error?: "invalid_time" | "end_before_start" | "zero_duration" | "exceeds_day";
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** Minutes since midnight, or null when the string is not a valid HH:MM. */
export function parseTimeToMinutes(value: string): number | null {
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Duration between two clock times on the SAME day.
 *
 * A shift that ends before it starts is rejected rather than silently wrapped
 * past midnight: "09:00 → 08:00" is far more likely a typo than a 23-hour
 * night shift, and guessing would quietly corrupt Actual Cost.
 */
export function durationFromInterval(start: string, end: string): DurationResult {
  const from = parseTimeToMinutes(start);
  const to = parseTimeToMinutes(end);
  if (from === null || to === null) return { ok: false, hours: null, error: "invalid_time" };
  if (to === from) return { ok: false, hours: null, error: "zero_duration" };
  if (to < from) return { ok: false, hours: null, error: "end_before_start" };
  return { ok: true, hours: roundHours((to - from) / 60) };
}

/** Validate a directly typed duration (the "I just know it was 3h" path). */
export function validateDuration(hours: number): DurationResult {
  if (!Number.isFinite(hours)) return { ok: false, hours: null, error: "invalid_time" };
  const rounded = roundHours(hours);
  if (rounded <= 0) return { ok: false, hours: null, error: "zero_duration" };
  if (rounded > MAX_DAILY_HOURS) return { ok: false, hours: null, error: "exceeds_day" };
  return { ok: true, hours: rounded };
}

/**
 * Resolve what to store from what the user filled in. An interval wins when
 * both are present, because start/end is the more specific claim.
 */
export function resolveEntryDuration(input: {
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: number | null;
}): DurationResult {
  const hasInterval = !!input.startTime && !!input.endTime;
  if (hasInterval) return durationFromInterval(input.startTime!, input.endTime!);
  if (input.durationHours === null || input.durationHours === undefined) {
    return { ok: false, hours: null, error: "zero_duration" };
  }
  return validateDuration(input.durationHours);
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/** Total logged hours. The ONLY way actual hours are ever produced. */
export function sumHours(entries: { duration_hours: number }[]): number {
  return roundHours(entries.reduce((total, e) => total + (Number(e.duration_hours) || 0), 0));
}

/** Group totals by an arbitrary key — subtask, task, person or day. */
export function sumHoursBy<T extends { duration_hours: number }>(
  entries: T[],
  key: (entry: T) => string | null,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const k = key(entry);
    if (k === null) continue;
    totals.set(k, (totals.get(k) ?? 0) + (Number(entry.duration_hours) || 0));
  }
  for (const [k, v] of totals) totals.set(k, roundHours(v));
  return totals;
}

// ── Effort standing ──────────────────────────────────────────────────────────

export interface EffortThresholds {
  /** % of the estimate at which we start warning. */
  warningPct: number;
  /** % at which the item is treated as over budget. */
  overPct: number;
  /** % at which it becomes critical. */
  criticalPct: number;
}

/**
 * A single subtask warns EARLY — the point is to catch the overrun while the
 * work is still in flight (90% / 100% / 120%).
 */
export const SUBTASK_THRESHOLDS: EffortThresholds = { warningPct: 90, overPct: 100, criticalPct: 120 };

/**
 * A task warns on the same early scale as a subtask, deliberately: it is still
 * ONE piece of work in flight, not a portfolio. Named separately from
 * SUBTASK_THRESHOLDS so the two can diverge later without hunting callers.
 */
export const TASK_THRESHOLDS: EffortThresholds = SUBTASK_THRESHOLDS;

/**
 * Aggregates warn LATER: across a whole project, being at 95% of budget is
 * normal, so green holds until the estimate is actually passed (100% / 120%).
 * These are the two scales the product asked for; they are deliberately
 * different, not a rounding of one another.
 */
export const PORTFOLIO_THRESHOLDS: EffortThresholds = { warningPct: 100, overPct: 100, criticalPct: 120 };

export function effortSeverity(
  consumedPct: number | null,
  thresholds: EffortThresholds = SUBTASK_THRESHOLDS,
): EffortSeverity {
  if (consumedPct === null) return "none";
  if (consumedPct > thresholds.criticalPct) return "critical";
  if (consumedPct > thresholds.overPct) return "over";
  if (consumedPct >= thresholds.warningPct) return "warning";
  return "on_track";
}

/**
 * Everything the UI needs about one work item's effort, in one call.
 *
 * `remainingHours` is BUDGET LEFT, so it floors at 0: there is no such thing as
 * "-12 hours of budget remaining". The overrun is not lost by that floor — it is
 * `varianceHours`, which is the same number with the opposite sign
 * (remaining_signed = estimated − actual = −variance), so clamping here removes
 * a duplicate rather than information.
 */
export function computeEffort(
  estimatedHours: number | null | undefined,
  actualHours: number,
  thresholds: EffortThresholds = SUBTASK_THRESHOLDS,
): EffortSummary {
  const estimated = estimatedHours == null || estimatedHours <= 0 ? null : roundHours(estimatedHours);
  const actual = roundHours(actualHours);
  // Guarded above: `estimated` is null when the divisor would be 0 or negative.
  const consumedPct = estimated === null ? null : Math.round((actual / estimated) * 1000) / 10;
  return {
    estimatedHours: estimated,
    actualHours: actual,
    remainingHours: estimated === null ? null : roundHours(Math.max(estimated - actual, 0)),
    consumedPct,
    varianceHours: estimated === null ? null : roundHours(actual - estimated),
    severity: effortSeverity(consumedPct, thresholds),
  };
}

/**
 * The estimate for one task, with subtask double-counting ruled out.
 *
 * When a task is broken into subtasks, the subtasks ARE the plan — adding the
 * task's own number on top would count the same work twice. The task estimate
 * survives as a fallback for the in-between state where subtasks exist but
 * nobody has estimated them yet; without it a project's planned hours would
 * silently DROP the moment someone adds an unestimated subtask.
 */
export function consolidatedEstimatedHours(
  taskEstimatedHours: number | null | undefined,
  subtaskEstimatedHours: (number | null | undefined)[],
): number | null {
  const fromSubtasks = subtaskEstimatedHours.reduce<number>(
    (total, hours) => total + (Number(hours) || 0),
    0,
  );
  if (fromSubtasks > 0) return roundHours(fromSubtasks);
  const fromTask = Number(taskEstimatedHours) || 0;
  return fromTask > 0 ? roundHours(fromTask) : null;
}

export interface TaskEffortInput {
  /** The task's own planned hours, used only when it has no estimated subtasks. */
  taskEstimatedHours: number | null | undefined;
  subtasks: { estimatedHours: number | null | undefined; status?: string | null }[];
  /**
   * Live entries carrying this task's id — its own AND its subtasks'. Because
   * every row stores task_id, this one list already covers both levels, which is
   * why the total below is a single sum and not an addition of two subtotals.
   */
  entries: { duration_hours: number }[];
}

/**
 * Effort standing for ONE task — the canonical formula, kept pure so the modal,
 * the report, the dashboard, Isabella and the future EVM engine cannot drift
 * into private arithmetic.
 *
 * Actual  = SUM(entries.duration_hours)               (each entry exactly once)
 * Estimate= subtasks' sum when estimated, else the task's own number
 */
export function computeTaskEffort(
  input: TaskEffortInput,
  thresholds: EffortThresholds = TASK_THRESHOLDS,
): EffortSummary {
  const active = input.subtasks.filter((s) => s.status !== "cancelled");
  const estimated = consolidatedEstimatedHours(
    input.taskEstimatedHours,
    active.map((s) => s.estimatedHours),
  );
  return computeEffort(estimated, sumHours(input.entries), thresholds);
}

/** Width of the effort bar: capped at 100 so the track never overflows. */
export function effortBarPct(summary: EffortSummary): number {
  if (summary.consumedPct === null) return 0;
  return Math.max(0, Math.min(100, summary.consumedPct));
}

/**
 * Whether crossing this entry's total warrants alerting the PM and Isabella.
 * Fires on the TRANSITION only — logging more time on an already-over subtask
 * must not re-alert on every entry.
 */
export function crossedEffortBudget(
  estimatedHours: number | null | undefined,
  previousActual: number,
  newActual: number,
): boolean {
  if (estimatedHours == null || estimatedHours <= 0) return false;
  return previousActual <= estimatedHours && newActual > estimatedHours;
}
