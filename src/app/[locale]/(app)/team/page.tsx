import { setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { TeamClient, type TeamMember, type TeamResource, type TeamProject } from "./team-client";
import { LivingGuideWidget } from "@/components/living-guide";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = createAdminClient();

  // Fetch members first so we can look up their profiles by user id. A member's
  // profile.organization_id is their personal/home org and may differ from this
  // org, so we must NOT filter profiles by organization_id (that hid members and
  // made renames look like no-ops). Mirror /organization/members: fetch by id.
  const membersRes = await supabase.from("organization_members")
    .select("id, user_id, role, billing_seat_type, workspace_role, status, department, job_title")
    .eq("organization_id", org.organizationId);
  const memberRows = membersRes.data ?? [];
  const memberIds = memberRows.map((m) => String(m.user_id));

  const [profilesRes, resourcesRes, projectsRes] = await Promise.all([
    memberIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    supabase
      .from("resources")
      .select("id, name, resource_type, trade_key, project_id, status, cost_rate, cost_unit, linked_user_id")
      .eq("organization_id", org.organizationId)
      .in("resource_type", ["person", "crew", "team", "role", "vendor", "subcontractor"])
      .is("deleted_at", null),
    supabase.from("projects").select("id, title_i18n, slug").eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);

  // Emails (best-effort, from the auth admin API).
  const emailById = new Map<string, string>();
  try {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) if (u.email) emailById.set(u.id, u.email);
  } catch { /* ignore */ }

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const members: TeamMember[] = memberRows.map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    role: m.role,
    name: profileById.get(m.user_id)?.display_name || (m.user_id === org.userId ? org.displayName || org.email : "—"),
    email: emailById.get(m.user_id) ?? null,
    seatType: (m.billing_seat_type as string) ?? null,
    workspaceRole: (m.workspace_role as string) ?? null,
    status: (m.status as string) ?? "active",
    department: (m.department as string) ?? null,
    jobTitle: (m.job_title as string) ?? null,
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

  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <>
      <TeamClient
        locale={locale as Locale}
        members={members}
        resources={resources}
        projects={projects}
        canManage={canManage}
      />
      <LivingGuideWidget
        locale={locale as Locale}
        context={{
          module: "people_permissions",
          screen: "team_directory",
          role: org.role,
          userId: org.userId,
          organizationId: org.organizationId,
          permissions: canManage ? ["manage_members"] : ["view_only"],
        }}
      />
    </>
  );
}
