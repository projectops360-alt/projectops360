import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import {
  getProjectTeam, getProjectRaci, getStakeholderAccess, getCompanyDirectory,
  getCompanyTeams, getExternalContacts, computeTeamCompleteness,
} from "@/lib/team-roles/service";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const { guardProjectTab } = await import("@/lib/auth/project-guard");
  await guardProjectTab(projectId, "team");
  const org = await getOrgContext();
  const admin = createAdminClient();

  const { data: project } = await admin.from("projects").select("id, slug, title_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle();
  if (!project) notFound();

  const [team, raci, stakeholders, directory, companyTeams, externals, milestonesRes] = await Promise.all([
    getProjectTeam(org, projectId),
    getProjectRaci(org, projectId),
    getStakeholderAccess(org, projectId),
    getCompanyDirectory(org),
    getCompanyTeams(org),
    getExternalContacts(org),
    admin.from("milestones").select("id, title").eq("project_id", projectId).is("deleted_at", null).order("order_index"),
  ]);

  const completeness = computeTeamCompleteness(team);
  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  return (
    <TeamClient
      locale={locale}
      projectId={projectId}
      projectName={projectName}
      team={team}
      raci={raci}
      stakeholders={stakeholders}
      directory={directory}
      companyTeams={companyTeams.teams}
      externals={externals}
      milestones={(milestonesRes.data ?? []) as Record<string, unknown>[]}
      completeness={completeness}
    />
  );
}
