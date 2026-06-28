// ============================================================================
// ProjectOps360° — Portfolio Health Briefing service (server-only, PMO)
// ============================================================================
// Loads org-wide execution data and returns Isabella's deterministic Portfolio
// Briefing for the PMO. Only owner/admin (PMO) roles receive it — members and
// viewers get the generic guide prompt outside a project. No fabricated data.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { I18nField, Locale, Milestone, RoadmapTask } from "@/types/database";
import { buildPortfolioBriefing } from "./portfolio-engine";
import type { PortfolioBriefingResult } from "./types";

/** Build the PMO portfolio briefing. Never throws. */
export async function getPortfolioBriefing(locale: Locale): Promise<PortfolioBriefingResult> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, reason: "not_authorized" };
  }

  // Portfolio view is a PMO capability — owner/admin only.
  if (org.role !== "owner" && org.role !== "admin") {
    return { ok: false, reason: "not_authorized" };
  }

  const supabase = createAdminClient();
  const lang = locale === "es" ? "es" : "en";

  const [projectsRes, tasksRes, milestonesRes, risksRes, decisionsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title_i18n, status")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("roadmap_tasks")
      .select("*")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("milestones")
      .select("*")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("risks")
      .select("project_id, severity, status")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("decisions")
      .select("project_id, impact_area, status")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .eq("status", "proposed"),
  ]);

  if (projectsRes.error) return { ok: false, reason: "unavailable" };

  const projects = (projectsRes.data ?? []) as Array<{ id: string; slug: string | null; title_i18n: I18nField; status: string | null }>;
  const aliveIds = new Set(projects.map((p) => p.id));
  const alive = <T extends { project_id?: string | null }>(rows: T[] | null) =>
    (rows ?? []).filter((r) => r.project_id != null && aliveIds.has(r.project_id));

  const tasks = alive((tasksRes.data ?? []) as RoadmapTask[]) as RoadmapTask[];
  const milestones = alive((milestonesRes.data ?? []) as Milestone[]) as Milestone[];

  const risks = risksRes.error
    ? null
    : alive((risksRes.data ?? []) as Array<{ project_id: string | null; severity: string | null; status: string | null }>);
  const pendingDecisions = alive(
    (decisionsRes.data ?? []) as Array<{ project_id: string | null; impact_area: string | null }>,
  );

  const briefing = buildPortfolioBriefing({
    projects: projects.map((p) => ({
      id: p.id,
      name: getI18nValue(p.title_i18n, lang) || p.slug || "Project",
      status: p.status,
    })),
    tasks,
    milestones,
    risks,
    pendingDecisions,
  });

  return { ok: true, briefing };
}
