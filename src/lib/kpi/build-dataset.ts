// ============================================================================
// The same KPI, asked of one milestone instead of the whole project
// ============================================================================
// The expression engine was project-wide by construction: `SUM(actual_hours)`
// read an array of EVERY task, so "how many hours went into Preparación?" was
// not a question anyone could write down. There was no milestone dimension and
// no way to add one from the editor.
//
// The fix is not a second engine. A per-milestone dataset is the SAME shape as
// the project dataset — just built from that milestone's tasks — so every
// expression that already works keeps working, unchanged, in a narrower scope.
// This module is that construction, pulled out of the database loader so it is
// pure and can be tested on plain rows.
//
// It also adds what cost questions need: a per-task cost (hours priced at the
// rate of the resource assigned to it) and the milestone's budget. Those are
// what make "what did this phase cost me" expressible at all.
// ============================================================================

import {
  hasActiveBlocker,
  isCompletedStatus,
  isTerminalStatus,
  isUnassigned,
} from "@/lib/execution/task-activity";
import type { KpiDataset } from "./evaluate";

/** Weeks of completion history for the weekly series. */
export const WEEKLY_SERIES_WEEKS = 12;

export interface KpiTaskRow {
  id?: string;
  milestone_id?: string | null;
  status: string;
  is_blocked: boolean;
  is_critical: boolean;
  assigned_to: string | null;
  assigned_resource_id: string | null;
  estimate_hours: number | null;
  actual_hours: number | null;
  progress: number | null;
  duration_days: number | null;
  end_date: string | null;
  completed_at: string | null;
}

export interface KpiMilestoneRow {
  id: string;
  status: string;
  target_date: string | null;
  completed_date: string | null;
}

export interface KpiCostInputs {
  /** resource id → hourly rate. Only hourly rates: pricing hours from a daily
   *  rate would mean assuming the length of a working day. */
  rateByResource?: Map<string, number>;
  /** milestone id → budget assigned to it. */
  budgetByMilestone?: Map<string, number>;
}

const num = (value: number | null | undefined): number => (value == null ? NaN : value);

/** Tasks completed per ISO-ish week (UTC Monday buckets), oldest → newest. */
export function weeklyCompletedSeries(
  completedAts: readonly (string | null)[],
  nowIso: string,
  weeks = WEEKLY_SERIES_WEEKS,
): number[] {
  const now = new Date(nowIso);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7)); // back to Monday
  const buckets = new Array<number>(weeks).fill(0);
  const start = monday.getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000;
  for (const completedAt of completedAts) {
    if (!completedAt) continue;
    const t = Date.parse(completedAt);
    if (!Number.isFinite(t) || t < start) continue;
    const index = Math.min(weeks - 1, Math.floor((t - start) / (7 * 24 * 60 * 60 * 1000)));
    buckets[index] += 1;
  }
  return buckets;
}

/**
 * What one task cost.
 *
 * Hours actually logged when there are any, the estimate otherwise, priced at
 * the rate of the RESOURCE assigned to it — a blended project rate would
 * flatten exactly the difference between an architect's hour and a junior's.
 *
 * NaN when the task cannot be priced. The statistical functions drop non-finite
 * values, so a half-priced project still sums the half it knows instead of
 * poisoning the whole figure — and `COUNT(task_cost)` reports how many tasks
 * that was, which is how a partial answer stays distinguishable from a total.
 */
export function taskCost(task: KpiTaskRow, rateByResource: Map<string, number>): number {
  const rate = task.assigned_resource_id ? rateByResource.get(task.assigned_resource_id) : undefined;
  if (rate == null || !(rate > 0)) return NaN;
  const hours = Number(task.actual_hours) || Number(task.estimate_hours) || 0;
  return hours * rate;
}

/**
 * Build the allow-listed dataset from plain rows.
 *
 * Pass the whole project's tasks for a project KPI, or one milestone's tasks
 * for that milestone's KPI. Nothing else differs — which is the point.
 */
export function buildKpiDataset(
  tasks: readonly KpiTaskRow[],
  milestones: readonly KpiMilestoneRow[],
  nowIso: string,
  cost: KpiCostInputs = {},
): KpiDataset {
  const rateByResource = cost.rateByResource ?? new Map<string, number>();
  const budgetByMilestone = cost.budgetByMilestone ?? new Map<string, number>();

  return {
    estimate_hours: tasks.map((task) => num(task.estimate_hours)),
    actual_hours: tasks.map((task) => num(task.actual_hours)),
    progress: tasks.map((task) => num(task.progress)),
    completed_flag: tasks.map((task) => (isCompletedStatus(task.status) ? 1 : 0)),
    blocked_flag: tasks.map((task) =>
      hasActiveBlocker({ status: task.status as never, is_blocked: task.is_blocked }) ? 1 : 0,
    ),
    open_overdue_flag: tasks.map((task) =>
      !isTerminalStatus(task.status) && task.end_date !== null && task.end_date < nowIso ? 1 : 0,
    ),
    delayed_flag: tasks.map((task) => {
      if (!task.end_date) return 0;
      if (isCompletedStatus(task.status)) {
        return task.completed_at !== null && task.completed_at > task.end_date ? 1 : 0;
      }
      if (isTerminalStatus(task.status)) return 0;
      return task.end_date < nowIso ? 1 : 0;
    }),
    unassigned_flag: tasks.map((task) =>
      isUnassigned({ assigned_to: task.assigned_to, assigned_resource_id: task.assigned_resource_id })
        ? 1
        : 0,
    ),
    critical_flag: tasks.map((task) => (task.is_critical ? 1 : 0)),
    duration_days: tasks.map((task) => num(task.duration_days)),
    task_cost: tasks.map((task) => taskCost(task, rateByResource)),
    // 1 when the task's cost is known. Lets an expression state its own
    // coverage — "priced 12 of 53 tasks" — instead of presenting a partial
    // sum as if it were the total.
    priced_flag: tasks.map((task) => (Number.isFinite(taskCost(task, rateByResource)) ? 1 : 0)),
    milestone_completed_flag: milestones.map((m) => (m.completed_date ? 1 : 0)),
    milestone_delay_days: milestones.map((m) => {
      if (!m.completed_date || !m.target_date) return NaN;
      return (Date.parse(m.completed_date) - Date.parse(m.target_date)) / (24 * 60 * 60 * 1000);
    }),
    // NaN, never 0, for a milestone with no budget line: a gate that was never
    // budgeted did not cost nothing.
    milestone_budget: milestones.map((m) => budgetByMilestone.get(m.id) ?? NaN),
    weekly_completed: weeklyCompletedSeries(
      tasks.filter((task) => isCompletedStatus(task.status)).map((task) => task.completed_at),
      nowIso,
    ),
  };
}

export interface MilestoneScopedDataset {
  milestoneId: string;
  dataset: KpiDataset;
  /** Tasks in this scope — shown beside a value so an empty scope is obvious. */
  taskCount: number;
}

/**
 * One dataset per milestone, each holding only that milestone's tasks and only
 * that milestone's own row in the milestone-level arrays.
 *
 * A milestone with no tasks still gets a dataset. It would be easy to skip it,
 * but then a card would silently show nothing; an empty dataset makes the
 * engine answer "not computable", which is the difference between "no data"
 * and "no answer".
 */
export function buildMilestoneDatasets(
  tasks: readonly KpiTaskRow[],
  milestones: readonly KpiMilestoneRow[],
  nowIso: string,
  cost: KpiCostInputs = {},
): MilestoneScopedDataset[] {
  const byMilestone = new Map<string, KpiTaskRow[]>();
  for (const task of tasks) {
    if (!task.milestone_id) continue;
    const list = byMilestone.get(task.milestone_id) ?? [];
    list.push(task);
    byMilestone.set(task.milestone_id, list);
  }

  return milestones.map((milestone) => {
    const own = byMilestone.get(milestone.id) ?? [];
    return {
      milestoneId: milestone.id,
      dataset: buildKpiDataset(own, [milestone], nowIso, cost),
      taskCount: own.length,
    };
  });
}
