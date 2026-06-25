// ============================================================================
// ProjectOps360° — PM Center service (server-only)
// ============================================================================
// The execution-focused counterpart to the PMO Command Center. Aggregates ONLY
// the projects the current user may access (PM/creator/member/stakeholder), or
// every project when a PMO-level user opts in. Built around "my projects, my
// execution, my risks, my next actions" — never portfolio governance.
//
// All data is scoped by organization_id AND the accessible project IDs, so a PM
// never sees another PM's projects.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { localizedHref } from "@/i18n/href";
import { getI18nValue, type I18nField } from "@/types/database";
import type { OrgContext } from "@/lib/auth";
import { getAccessibleProjectIds } from "@/lib/auth";

const DONE = new Set(["done", "tested"]);

export interface PmProjectRow {
  id: string;
  title: string;
  status: string;
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
  progress: number;
  href: string;
}
export interface PmTaskRow { id: string; title: string; project: string; status: string; reason: string; href: string }
export interface PmMilestoneRow { id: string; title: string; project: string; targetDate: string | null; status: string; href: string }
export interface PmRiskRow { title: string; project: string; severity: string; status: string; href: string }
export interface PmDecisionRow { title: string; project: string; impact: string; href: string }
export interface PmEventRow { date: string; title: string; project: string; href: string }

export interface PmCenterData {
  hasProjects: boolean;
  projects: PmProjectRow[];
  criticalTasks: PmTaskRow[];
  milestonesNeedingAttention: PmMilestoneRow[];
  myRisks: PmRiskRow[];
  pendingDecisions: PmDecisionRow[];
  upcoming: PmEventRow[];
  counts: { projects: number; openTasks: number; blocked: number; risks: number };
}

const empty: PmCenterData = {
  hasProjects: false, projects: [], criticalTasks: [], milestonesNeedingAttention: [],
  myRisks: [], pendingDecisions: [], upcoming: [],
  counts: { projects: 0, openTasks: 0, blocked: 0, risks: 0 },
};

export async function getPmCenterSummary(org: OrgContext, locale = "en"): Promise<PmCenterData> {
  const supabase = createAdminClient();
  const orgId = org.organizationId;
  const link = (path: string) => localizedHref(locale, path);
  const i18n = (f: I18nField | null | undefined, fb = "—") => getI18nValue((f ?? {}) as I18nField, locale as "en" | "es") || fb;

  const accessibleIds = await getAccessibleProjectIds(org);
  if (accessibleIds !== null && accessibleIds.length === 0) return empty;

  // Helper to apply the project scope to a query that has a project_id column.
  // Typed loosely on purpose: the Supabase builder's generic chain is too deep
  // for TS to instantiate through a generic wrapper.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scopeChild = (q: any): any =>
    accessibleIds === null ? q : q.in("project_id", accessibleIds);

  let projectsQ = supabase
    .from("projects")
    .select("id, title_i18n, slug, status")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (accessibleIds !== null) projectsQ = projectsQ.in("id", accessibleIds);

  const [projectsRes, tasksRes, milestonesRes, risksRes, decisionsRes, eventsRes] = await Promise.all([
    projectsQ,
    scopeChild(supabase.from("roadmap_tasks")
      .select("id, title, project_id, status, is_blocked, is_critical, assigned_to, blocker_reason, end_date")
      .eq("organization_id", orgId).is("deleted_at", null)),
    scopeChild(supabase.from("milestones")
      .select("id, title, project_id, target_date, status")
      .eq("organization_id", orgId).is("deleted_at", null)),
    scopeChild(supabase.from("risks")
      .select("title, project_id, severity, status")
      .eq("organization_id", orgId).is("deleted_at", null)),
    scopeChild(supabase.from("decisions")
      .select("title_i18n, project_id, status, impact_area")
      .eq("organization_id", orgId).is("deleted_at", null)),
    scopeChild(supabase.from("project_events")
      .select("title_i18n, project_id, start_at")
      .eq("organization_id", orgId)),
  ]);

  const projectRows = projectsRes.data ?? [];
  if (projectRows.length === 0) return empty;

  const nameById = new Map(projectRows.map((p) => [p.id, i18n(p.title_i18n as I18nField, p.slug)]));
  const pname = (id: string | null) => (id ? nameById.get(id) ?? "—" : "—");
  const P = "/projects";

  // ── My projects (rollup) ──
  const tasks = (tasksRes.data ?? []) as unknown as Array<{
    id: string; title: string; project_id: string | null; status: string;
    is_blocked: boolean; is_critical: boolean; assigned_to: string | null;
  }>;
  const tasksByProject = new Map<string, { total: number; done: number; blocked: number }>();
  for (const t of tasks) {
    const pid = t.project_id as string | null;
    if (!pid) continue;
    const agg = tasksByProject.get(pid) ?? { total: 0, done: 0, blocked: 0 };
    agg.total += 1;
    if (DONE.has(t.status)) agg.done += 1;
    if (t.is_blocked) agg.blocked += 1;
    tasksByProject.set(pid, agg);
  }

  const projects: PmProjectRow[] = projectRows.map((p) => {
    const agg = tasksByProject.get(p.id) ?? { total: 0, done: 0, blocked: 0 };
    return {
      id: p.id,
      title: nameById.get(p.id) ?? p.slug,
      status: p.status,
      totalTasks: agg.total,
      doneTasks: agg.done,
      blockedTasks: agg.blocked,
      progress: agg.total > 0 ? Math.round((agg.done / agg.total) * 100) : 0,
      href: link(`${P}/${p.id}/execution-map`),
    };
  });

  // ── My critical tasks: blocked / critical / assigned-to-me, not done ──
  const criticalTasks: PmTaskRow[] = tasks
    .filter((t) => !DONE.has(t.status) && (t.is_blocked || t.is_critical || t.assigned_to === org.userId))
    .slice(0, 12)
    .map((t) => ({
      id: t.id as string,
      title: t.title as string,
      project: pname(t.project_id as string | null),
      status: t.status as string,
      reason: t.is_blocked ? (locale === "es" ? "Bloqueada" : "Blocked")
        : t.is_critical ? (locale === "es" ? "Ruta crítica" : "Critical path")
        : (locale === "es" ? "Asignada a ti" : "Assigned to you"),
      href: link(`${P}/${t.project_id}/workboard?task=${t.id}`),
    }));

  // ── Milestones needing attention: due within 21 days and not done ──
  const horizon = new Date(); horizon.setDate(horizon.getDate() + 21);
  const milestonesNeedingAttention: PmMilestoneRow[] = ((milestonesRes.data ?? []) as unknown as Array<{
    id: string; title: string; project_id: string | null; target_date: string | null; status: string;
  }>)
    .filter((m) => !DONE.has(m.status) && m.status !== "completed" && m.target_date && new Date(m.target_date) <= horizon)
    .slice(0, 10)
    .map((m) => ({
      id: m.id as string, title: m.title as string, project: pname(m.project_id as string | null),
      targetDate: (m.target_date as string) ?? null, status: m.status as string,
      href: link(`${P}/${m.project_id}/execution-map`),
    }));

  // ── My risks: open ──
  const myRisks: PmRiskRow[] = ((risksRes.data ?? []) as unknown as Array<{
    title: string; project_id: string | null; severity: string | null; status: string | null;
  }>)
    .filter((r) => r.status !== "closed" && r.status !== "resolved")
    .slice(0, 10)
    .map((r) => ({
      title: r.title as string, project: pname(r.project_id as string | null),
      severity: (r.severity as string) ?? "—", status: (r.status as string) ?? "—",
      href: link(`${P}/${r.project_id}`),
    }));

  // ── Pending decisions ──
  const pendingDecisions: PmDecisionRow[] = ((decisionsRes.data ?? []) as unknown as Array<{
    title_i18n: I18nField | null; project_id: string | null; status: string; impact_area: string | null;
  }>)
    .filter((d) => d.status === "proposed")
    .slice(0, 8)
    .map((d) => ({
      title: i18n(d.title_i18n as I18nField), project: pname(d.project_id as string | null),
      impact: (d.impact_area as string) ?? "—",
      href: link(`${P}/${d.project_id}/decisions`),
    }));

  // ── Upcoming 14 days ──
  const now = new Date(); const upper = new Date(); upper.setDate(upper.getDate() + 14);
  const upcoming: PmEventRow[] = ((eventsRes.data ?? []) as unknown as Array<{
    title_i18n: I18nField | null; project_id: string | null; start_at: string | null;
  }>)
    .filter((e) => e.start_at && new Date(e.start_at) >= now && new Date(e.start_at) <= upper)
    .sort((a, b) => new Date(a.start_at as string).getTime() - new Date(b.start_at as string).getTime())
    .slice(0, 10)
    .map((e) => ({
      date: e.start_at as string, title: i18n(e.title_i18n as I18nField), project: pname(e.project_id as string | null),
      href: link(`${P}/${e.project_id}/rhythm`),
    }));

  const openTasks = tasks.filter((t) => !DONE.has(t.status)).length;
  const blocked = tasks.filter((t) => t.is_blocked && !DONE.has(t.status)).length;

  return {
    hasProjects: true,
    projects,
    criticalTasks,
    milestonesNeedingAttention,
    myRisks,
    pendingDecisions,
    upcoming,
    counts: { projects: projects.length, openTasks, blocked, risks: myRisks.length },
  };
}
