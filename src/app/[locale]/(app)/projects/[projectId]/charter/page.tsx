import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { createCharterForProject, getCharterByProject } from "@/lib/charter/service";
import { getPeopleDirectory } from "@/lib/people/service";
import { CharterClient } from "./charter-client";

export const dynamic = "force-dynamic";

export default async function CharterPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ onboard?: string }>;
}) {
  const { locale, projectId } = await params;
  const { onboard } = await searchParams;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify the project with the admin client (scoped by org) to avoid any
  // RLS/session race on the first soft navigation.
  const { data: project } = await admin
    .from("projects").select("id, slug, title_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle();
  if (!project) notFound();

  // Always ensure a charter exists (covers projects created before this module).
  // Race-safe upsert + refetch; retry once before giving up so a transient
  // concurrent create (Next prefetch + real nav) never produces a 404.
  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
  let charter = await getCharterByProject(admin, org.organizationId, projectId);
  if (!charter) {
    await createCharterForProject(admin, org.organizationId, projectId, org.userId, projectName);
    charter = await getCharterByProject(admin, org.organizationId, projectId);
  }
  if (!charter) {
    await createCharterForProject(admin, org.organizationId, projectId, org.userId, projectName);
    charter = await getCharterByProject(admin, org.organizationId, projectId);
  }
  if (!charter) notFound();

  const [versionsRes, rolesRes, rulesRes, approvalsRes, signoffsRes, teamRes] = await Promise.all([
    supabase.from("project_charter_versions").select("id, version, change_reason, created_at").eq("charter_id", charter.id).order("version", { ascending: false }).limit(25),
    supabase.from("project_charter_roles").select("*").eq("charter_id", charter.id).is("deleted_at", null).order("created_at"),
    supabase.from("project_governance_rules").select("*").eq("charter_id", charter.id).is("deleted_at", null).order("created_at"),
    supabase.from("project_approval_matrix").select("*").eq("charter_id", charter.id).is("deleted_at", null).order("created_at"),
    supabase.from("project_signoffs").select("*").eq("charter_id", charter.id).order("created_at"),
    admin.from("project_team_members").select("display_name, project_role, governance_role")
      .eq("project_id", projectId).eq("organization_id", org.organizationId).neq("status", "removed"),
  ]);

  // People to suggest in the charter governance sections (roles / approvals /
  // sign-off). CAP-044 / PD-014 — sourced from the UNIFIED People Directory
  // (internal users + external contacts + stakeholders), not only the project
  // team, so a governance role can be assigned to any existing person instead of
  // retyping. Project members keep their known project/governance role.
  const teamMembers = ((teamRes.data ?? []) as Record<string, unknown>[])
    .map((r) => ({ name: (r.display_name as string) || "", role: (r.project_role as string) || "", govRole: (r.governance_role as string) || "" }))
    .filter((m) => m.name || m.role);

  const directory = await getPeopleDirectory(projectId);
  if (directory.ok) {
    const seen = new Set(teamMembers.map((m) => m.name.trim().toLowerCase()).filter(Boolean));
    for (const person of directory.people) {
      const key = person.displayName.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      teamMembers.push({ name: person.displayName, role: person.type.replace(/_/g, " "), govRole: "" });
    }
  }

  return (
    <CharterClient
      locale={locale}
      projectId={projectId}
      projectName={projectName}
      charter={charter}
      versions={versionsRes.data ?? []}
      roles={(rolesRes.data ?? []) as Record<string, unknown>[]}
      rules={(rulesRes.data ?? []) as Record<string, unknown>[]}
      approvals={(approvalsRes.data ?? []) as Record<string, unknown>[]}
      signoffs={(signoffsRes.data ?? []) as Record<string, unknown>[]}
      teamMembers={teamMembers}
      onboarding={onboard === "true"}
    />
  );
}
