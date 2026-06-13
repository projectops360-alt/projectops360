import { setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { TeamClient, type TeamMember, type TeamResource, type TeamProject } from "./team-client";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = createAdminClient();

  const [membersRes, profilesRes, resourcesRes, projectsRes] = await Promise.all([
    supabase.from("organization_members").select("user_id, role").eq("organization_id", org.organizationId),
    supabase.from("profiles").select("id, display_name").eq("organization_id", org.organizationId),
    supabase
      .from("resources")
      .select("id, name, resource_type, trade_key, project_id, status, cost_rate, cost_unit, linked_user_id")
      .eq("organization_id", org.organizationId)
      .in("resource_type", ["person", "crew", "team", "role", "vendor", "subcontractor"])
      .is("deleted_at", null),
    supabase.from("projects").select("id, title_i18n, slug").eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const members: TeamMember[] = (membersRes.data ?? []).map((m) => ({
    role: m.role,
    name: profileById.get(m.user_id)?.display_name || (m.user_id === org.userId ? org.displayName || org.email : "—"),
    isYou: m.user_id === org.userId,
  }));

  const projects: TeamProject[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id,
    name: getI18nValue(p.title_i18n, locale as Locale) || p.slug,
  }));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const resources: TeamResource[] = (resourcesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    resourceType: r.resource_type,
    trade: r.trade_key,
    projectName: r.project_id ? projectName.get(r.project_id) ?? null : null,
    status: r.status,
    costRate: r.cost_rate != null ? Number(r.cost_rate) : null,
    costUnit: r.cost_unit,
    linkedUserId: r.linked_user_id,
  }));

  return (
    <TeamClient
      locale={locale as Locale}
      members={members}
      resources={resources}
      projects={projects}
      canManage={org.role === "owner" || org.role === "admin"}
    />
  );
}
