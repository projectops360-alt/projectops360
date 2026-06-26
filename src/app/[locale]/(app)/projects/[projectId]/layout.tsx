import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, getProjectAccess, canAccessProjectTab, isProjectManagerTier, type ProjectTab } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, ProjectModule } from "@/types/database";
import { getEnabledModules } from "@/lib/execution/modules";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  // ── Access guard ──────────────────────────────────────────────────────────
  // Enforce the project boundary BEFORE rendering anything. A user who is not
  // PMO-level, the PM/creator, a project member, or a stakeholder cannot reach
  // this project — not even via a direct URL. (RLS enforces the same on the
  // authenticated client; this is the explicit, friendly app-layer guard.)
  let org;
  try {
    org = await getOrgContext();
  } catch {
    redirect(locale === routing.defaultLocale ? "/login" : `/${locale}/login`);
  }
  const access = await getProjectAccess(org, projectId);
  if (!access.canView) {
    notFound();
  }

  // Tabs the current user may open. Managers (PMO/PM/creator) see everything;
  // contributors (team members) are limited to execution (Workboard, Status, and
  // Memory if allowed). This drives the visible tabs; sensitive pages also guard
  // themselves so a direct URL cannot bypass it.
  const TAB_BY_KEY: Record<string, ProjectTab> = {
    commandCenter: "overview", charterGovernance: "charter", deliveryFramework: "delivery",
    teamRoles: "team", workboard: "workboard", executionMap: "execution-map",
    resourceCapacity: "resource-capacity", laborCapacity: "labor-capacity",
    drawingIntelligence: "drawing-intelligence", projectMemory: "memory",
    rhythm: "rhythm", statusReport: "status", settings: "settings",
  };
  const allowedTabKeys = Object.entries(TAB_BY_KEY)
    .filter(([, tab]) => canAccessProjectTab(access, tab))
    .map(([key]) => key);
  const isManagerTier = isProjectManagerTier(access);

  // Fetch the project title + type so tabs adapt to the project's modules
  let projectTitle = "";
  let enabledModules: ProjectModule[] | undefined;
  try {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("slug, title_i18n, project_type, enabled_modules")
      .eq("id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single();
    if (project) {
      projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
      enabledModules = getEnabledModules(project);
    }
  } catch {
    // Fetch failed — tabs still render without the title
  }

  return (
    <div>
      <ProjectTabs
        projectId={projectId}
        locale={locale}
        projectTitle={projectTitle}
        enabledModules={enabledModules}
        allowedTabKeys={isManagerTier ? undefined : allowedTabKeys}
      />
      <div className="p-6">{children}</div>
    </div>
  );
}
