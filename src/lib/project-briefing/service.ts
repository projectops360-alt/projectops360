// ============================================================================
// ProjectOps360° — Project Health Briefing service (server-only, REG-013)
// ============================================================================
// Loads real, org+project-scoped execution data and returns Isabella's
// deterministic Project Health Briefing. No fabricated data — every field comes
// from live tables, and missing sources become honest `dataGaps`.
//
// Access control: the org + role come from the trusted session (getOrgContext).
// The project must belong to the caller's organization or the briefing refuses.
// Role maps to a briefing SCOPE that hides sensitive capacity/governance detail
// from members and external viewers.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type {
  I18nField,
  Locale,
  Milestone,
  RoadmapTask,
  TaskDependency,
} from "@/types/database";
import { buildProjectBriefing } from "./briefing-engine";
import type {
  BriefingMemoryEntry,
  BriefingScope,
  ProjectBriefing,
  ProjectBriefingResult,
} from "./types";

function scopeForRole(role: OrgContext["role"]): BriefingScope {
  if (role === "owner" || role === "admin") return "full";
  if (role === "viewer") return "external";
  return "member";
}

const OPEN_RISK_STATUSES = new Set(["open", "mitigating"]);
const HIGH_RISK_SEVERITIES = new Set(["high", "critical"]);

/**
 * Build the deterministic Project Health Briefing for a project. Never throws —
 * returns a typed result the action can hand straight to the widget.
 */
export async function getProjectBriefing(
  projectId: string,
  locale: Locale,
): Promise<ProjectBriefingResult> {
  if (!projectId) return { ok: false, reason: "no_project" };

  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, reason: "not_authorized" };
  }

  const supabase = createAdminClient();
  const lang = locale === "es" ? "es" : "en";

  // ── Project identity (also the org-scope gate) ────────────────────────────
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectErr) return { ok: false, reason: "unavailable" };
  if (!project) return { ok: false, reason: "no_project" };

  const scope = scopeForRole(org.role);
  const projectName = getI18nValue(project.title_i18n as I18nField, lang) || project.slug || "Project";

  // ── Execution data (org + project scoped) ─────────────────────────────────
  const [tasksRes, milestonesRes, depsRes, risksRes, decisionsRes, actionsRes, memoryRes] =
    await Promise.all([
      supabase
        .from("roadmap_tasks")
        .select("*")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null),
      supabase
        .from("milestones")
        .select("*")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true }),
      supabase
        .from("task_dependencies")
        .select("predecessor_id, successor_id")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId),
      supabase
        .from("risks")
        .select("severity, status")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null),
      supabase
        .from("decisions")
        .select("id, title_i18n, decision_date, status")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null)
        .order("decision_date", { ascending: false, nullsFirst: false })
        .limit(5),
      supabase
        .from("action_items")
        .select("id, title_i18n, due_date, status")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from("project_memory_items")
        .select("id, title, summary, created_at")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const tasks = (tasksRes.data ?? []) as RoadmapTask[];
  const milestones = (milestonesRes.data ?? []) as Milestone[];
  const dependencies = ((depsRes.data ?? []) as Array<{ predecessor_id: string; successor_id: string }>).map(
    (d) =>
      ({
        id: `${d.predecessor_id}->${d.successor_id}`,
        organization_id: org.organizationId,
        project_id: projectId,
        predecessor_id: d.predecessor_id,
        successor_id: d.successor_id,
        dependency_type: "finish_to_start",
        lag_days: 0,
        created_at: "",
      }) as TaskDependency,
  );

  // ── Risks (null when unreadable so the engine reports the gap) ─────────────
  let risks: { open: number; high: number } | null = null;
  if (!risksRes.error) {
    const rows = (risksRes.data ?? []) as Array<{ severity: string | null; status: string | null }>;
    const open = rows.filter((r) => r.status != null && OPEN_RISK_STATUSES.has(r.status));
    risks = {
      open: open.length,
      high: open.filter((r) => r.severity != null && HIGH_RISK_SEVERITIES.has(r.severity)).length,
    };
  }

  // ── Project Memory (decisions + follow-ups + notes) ───────────────────────
  const memoryAvailable = !decisionsRes.error && !actionsRes.error && !memoryRes.error;
  const recentDecisions: BriefingMemoryEntry[] = (decisionsRes.data ?? []).map((d) => ({
    id: d.id as string,
    title: getI18nValue(d.title_i18n as I18nField, lang) || "Decision",
    date: (d.decision_date as string | null) ?? null,
    kind: "decision" as const,
  }));
  const unresolvedActions: BriefingMemoryEntry[] = (actionsRes.data ?? []).map((a) => ({
    id: a.id as string,
    title: getI18nValue(a.title_i18n as I18nField, lang) || "Action",
    date: (a.due_date as string | null) ?? null,
    kind: "action" as const,
  }));
  const recentNotes: BriefingMemoryEntry[] = (memoryRes.data ?? []).map((m) => ({
    id: m.id as string,
    title: (m.title as string | null) ?? (m.summary as string | null) ?? "Note",
    date: (m.created_at as string | null) ?? null,
    kind: "note" as const,
  }));

  const briefing: ProjectBriefing = buildProjectBriefing({
    projectId,
    projectName,
    scope,
    tasks,
    milestones,
    dependencies,
    risks,
    memory: {
      recentDecisions,
      unresolvedActions,
      recentNotes,
      available: memoryAvailable,
    },
  });

  return { ok: true, briefing };
}
