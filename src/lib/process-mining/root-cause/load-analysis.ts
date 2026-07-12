// ============================================================================
// ProjectOps360° — Root Cause Miner · Read-only Load Adapter (CAP-046 F2)
// ============================================================================
// READ-ONLY adapter between canonical data and the statistical Root Cause
// Miner. Same safety pattern as the variant adapter: org context, deny-by-
// default project validation, RLS-scoped SELECTs only, no mutations, no LLM.
//
// Problem flags are resolved with the REG-010 canonical helpers (terminal
// tasks are never blocked; delay requires a real planned-finish reference).
// Rework counts come from TaskReopened business events in the PEG — the only
// event source (PD-019: no second pipeline).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { hasActiveBlocker, isTerminalStatus, isCompletedStatus } from "@/lib/execution/task-activity";
import { mineRootCauses } from "./engine";
import type { RootCauseMinerResult, RootCauseTaskInput } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REWORK_EVENTS = 5000;

export type RootCauseLoadResult =
  | { status: "ok"; result: RootCauseMinerResult; projectTitle: string }
  | { status: "unauthorized" }
  | { status: "error" };

interface TaskRow {
  id: string;
  title: string;
  milestone_id: string | null;
  priority: string;
  status: string;
  is_blocked: boolean;
  is_critical: boolean;
  discipline: string | null;
  trade_key: string | null;
  location_zone: string | null;
  assigned_to: string | null;
  assigned_resource_id: string | null;
  end_date: string | null;
  completed_at: string | null;
}

/** Delay per REG-010 semantics: open past planned finish, or finished late. */
export function isDelayedTask(
  row: Pick<TaskRow, "status" | "end_date" | "completed_at">,
  nowIso: string,
): boolean {
  if (!row.end_date) return false;
  if (isCompletedStatus(row.status)) {
    return row.completed_at !== null && row.completed_at > row.end_date;
  }
  if (isTerminalStatus(row.status)) return false; // deferred/cancelled ≠ delayed
  return row.end_date < nowIso;
}

export async function loadRootCauseAnalysis(
  projectId: string,
  locale: Locale,
): Promise<RootCauseLoadResult> {
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

  const [tasksResult, milestonesResult, reworkResult] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select(
        "id, title, milestone_id, priority, status, is_blocked, is_critical, discipline, trade_key, location_zone, assigned_to, assigned_resource_id, end_date, completed_at",
      )
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("milestones")
      .select("id, title")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("project_event_log")
      .select("subject_id")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .eq("event_type", "TaskReopened")
      .eq("is_compensating_event", false)
      .limit(MAX_REWORK_EVENTS),
  ]);

  if (tasksResult.error) return { status: "error" };

  const milestoneNames = new Map<string, string>();
  for (const m of milestonesResult.data ?? []) {
    milestoneNames.set(m.id as string, m.title as string);
  }

  const reworkCounts = new Map<string, number>();
  for (const row of reworkResult.error ? [] : (reworkResult.data ?? [])) {
    const subjectId = row.subject_id as string | null;
    if (subjectId) reworkCounts.set(subjectId, (reworkCounts.get(subjectId) ?? 0) + 1);
  }

  const nowIso = new Date().toISOString();
  const tasks: RootCauseTaskInput[] = ((tasksResult.data ?? []) as TaskRow[]).map((row) => ({
    taskId: row.id,
    title: row.title,
    milestoneId: row.milestone_id,
    milestoneLabel: row.milestone_id ? (milestoneNames.get(row.milestone_id) ?? null) : null,
    priority: row.priority,
    hasOwner: Boolean(row.assigned_to || row.assigned_resource_id),
    isCritical: row.is_critical === true,
    discipline: row.discipline,
    trade: row.trade_key,
    location: row.location_zone,
    isBlocked: hasActiveBlocker({ status: row.status as never, is_blocked: row.is_blocked }),
    isDelayed: isDelayedTask(row, nowIso),
    reworkCount: reworkCounts.get(row.id) ?? 0,
  }));

  try {
    const result = mineRootCauses(tasks);
    return {
      status: "ok",
      result,
      projectTitle: getI18nValue(project.title_i18n, locale) || project.slug,
    };
  } catch (err) {
    console.error("Root cause mining failed:", err);
    return { status: "error" };
  }
}
