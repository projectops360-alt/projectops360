// ============================================================================
// ProjectOps360° — Isabella Task Report retrieval (server-only, RBAC-scoped)
// ============================================================================
// ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA
//
// The DETERMINISTIC, approved retrieval behind Isabella's task report. Access
// control MIRRORS the Project Health Briefing (REG-013): the org + role come
// from the trusted session; the client-supplied projectId is only a lookup key.
// The project must belong to the caller's organization or the report refuses —
// so cross-org / cross-project tasks never leak. Reads only; never mutates
// canonical truth, `project_event_log`, `process_nodes` or `process_edges`.
//
// The LLM never sees raw rows and never sorts: this returns a typed, projected,
// deterministically-sorted `TaskReportOutcome` the pure formatter renders.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { I18nField, TaskPriority, TaskStatus } from "@/types/database";
import {
  DEFAULT_TASK_REPORT_DISPLAY_LIMIT,
  sortTaskReportRows,
  type TaskReportOutcome,
  type TaskReportRow,
  type TaskReportSortDirection,
  type TaskReportSortField,
} from "./task-report";

// Hard cap on rows pulled from the DB — protects the query from a pathological
// project. The display window (truncation) is applied separately, smaller.
const RETRIEVAL_HARD_CAP = 2000;

export interface BuildTaskReportParams {
  org: OrgContext;
  projectId: string | undefined;
  sortBy: TaskReportSortField;
  sortDirection: TaskReportSortDirection;
  language: "en" | "es";
  displayLimit?: number;
}

/**
 * Build the deterministic, RBAC-scoped task report for the current project.
 * Never throws — returns a typed outcome the pure formatter turns into an answer.
 */
export async function buildTaskReport(params: BuildTaskReportParams): Promise<TaskReportOutcome> {
  const { org, projectId, sortBy, sortDirection, language } = params;
  if (!projectId) return { ok: false, reason: "no_project" };

  const supabase = createAdminClient();
  const lang = language === "es" ? "es" : "en";

  // ── Project identity (also the org-scope gate — same as the Briefing) ──────
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectErr) return { ok: false, reason: "unavailable" };
  if (!project) return { ok: false, reason: "no_project" };

  const projectName = getI18nValue(project.title_i18n as I18nField, lang) || project.slug || "Project";

  // ── Tasks + milestone titles (org + project scoped) ────────────────────────
  const [tasksRes, milestonesRes] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select(
        "id, title, status, priority, milestone_id, assigned_to, end_date, updated_at, created_at, is_blocked, blocker_reason",
      )
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .limit(RETRIEVAL_HARD_CAP),
    supabase
      .from("milestones")
      .select("id, title")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
  ]);

  if (tasksRes.error) return { ok: false, reason: "unavailable" };

  const rawTasks = (tasksRes.data ?? []) as Array<{
    id: string;
    title: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    milestone_id: string | null;
    assigned_to: string | null;
    end_date: string | null;
    updated_at: string | null;
    created_at: string | null;
    is_blocked: boolean | null;
    blocker_reason: string | null;
  }>;

  const milestoneTitleById = new Map<string, string>(
    ((milestonesRes.data ?? []) as Array<{ id: string; title: string | null }>).map((m) => [
      m.id,
      m.title ?? "",
    ]),
  );

  // ── Owner display names — resolved ONLY within the caller's org (no leak) ───
  const ownerIds = [...new Set(rawTasks.map((t) => t.assigned_to).filter((v): v is string => !!v))];
  const ownerNameById = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("organization_id", org.organizationId)
      .in("id", ownerIds);
    for (const p of (profiles ?? []) as Array<{ id: string; display_name: string | null }>) {
      if (p.display_name) ownerNameById.set(p.id, p.display_name);
    }
  }

  const rows: TaskReportRow[] = rawTasks.map((t) => ({
    id: t.id,
    title: t.title ?? "",
    status: t.status,
    milestoneId: t.milestone_id,
    milestoneTitle: t.milestone_id ? (milestoneTitleById.get(t.milestone_id) || null) : null,
    priority: t.priority,
    ownerId: t.assigned_to,
    ownerName: t.assigned_to ? (ownerNameById.get(t.assigned_to) ?? null) : null,
    dueDate: t.end_date,
    updatedAt: t.updated_at,
    createdAt: t.created_at,
    isBlocked: t.is_blocked ?? false,
    blockerReason: t.blocker_reason,
    isSubtask: false,
  }));

  const sorted = sortTaskReportRows(rows, sortBy, sortDirection);
  const displayLimit = params.displayLimit ?? DEFAULT_TASK_REPORT_DISPLAY_LIMIT;

  return {
    ok: true,
    data: {
      projectName,
      rows: sorted.slice(0, displayLimit),
      total: sorted.length,
      displayed: Math.min(sorted.length, displayLimit),
      truncated: sorted.length > displayLimit,
      sortBy,
      sortDirection,
    },
  };
}
