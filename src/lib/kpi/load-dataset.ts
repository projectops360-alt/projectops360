// ============================================================================
// ProjectOps360° — KPI Calculation Engine · Read-only dataset adapter
// ============================================================================
// CAP-046 F3. Builds the allow-listed KPI dataset for one project from
// canonical tables (RLS-scoped, SELECT only, deny-by-default). Flags follow
// REG-010 canonical helpers — this loader NEVER re-derives blocker/overdue
// semantics its own way (one source of metrics, REG-010).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { hasActiveBlocker, isCompletedStatus, isTerminalStatus, isUnassigned } from "@/lib/execution/task-activity";
import type { KpiDataset } from "./evaluate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Weeks of completion history for the weekly series. */
const WEEKLY_SERIES_WEEKS = 12;

export type KpiDatasetLoadResult =
  | { status: "ok"; dataset: KpiDataset; projectTitle: string; taskCount: number; milestoneCount: number }
  | { status: "unauthorized" }
  | { status: "error" };

interface TaskRow {
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

const num = (value: number | null): number => (value === null ? NaN : value);

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
    if (index >= 0) buckets[index] += 1;
  }
  return buckets;
}

export async function loadKpiDataset(projectId: string, locale: Locale): Promise<KpiDatasetLoadResult> {
  if (!UUID_RE.test(projectId)) return { status: "unauthorized" };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }

  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (projectError || !project) return { status: "unauthorized" };

  const [tasksResult, milestonesResult] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select(
        "status, is_blocked, is_critical, assigned_to, assigned_resource_id, estimate_hours, actual_hours, progress, duration_days, end_date, completed_at",
      )
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("milestones")
      .select("status, target_date, completed_date")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
  ]);
  if (tasksResult.error || milestonesResult.error) return { status: "error" };

  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const milestones = (milestonesResult.data ?? []) as Array<{
    status: string;
    target_date: string | null;
    completed_date: string | null;
  }>;
  const nowIso = new Date().toISOString();

  const dataset: KpiDataset = {
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
      isUnassigned({ assigned_to: task.assigned_to, assigned_resource_id: task.assigned_resource_id }) ? 1 : 0,
    ),
    critical_flag: tasks.map((task) => (task.is_critical ? 1 : 0)),
    duration_days: tasks.map((task) => num(task.duration_days)),
    milestone_completed_flag: milestones.map((m) => (m.completed_date ? 1 : 0)),
    milestone_delay_days: milestones.map((m) => {
      if (!m.completed_date || !m.target_date) return NaN;
      return (Date.parse(m.completed_date) - Date.parse(m.target_date)) / (24 * 60 * 60 * 1000);
    }),
    weekly_completed: weeklyCompletedSeries(
      tasks.filter((task) => isCompletedStatus(task.status)).map((task) => task.completed_at),
      nowIso,
    ),
  };

  return {
    status: "ok",
    dataset,
    projectTitle: getI18nValue(project.title_i18n, locale) || project.slug,
    taskCount: tasks.length,
    milestoneCount: milestones.length,
  };
}
