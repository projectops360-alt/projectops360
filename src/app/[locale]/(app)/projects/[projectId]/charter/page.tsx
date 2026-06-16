import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { createCharterForProject, getCharterByProject } from "@/lib/charter/service";
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

  const { data: project } = await supabase
    .from("projects").select("id, slug, title_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  // Always ensure a charter exists (covers projects created before this module).
  const admin = createAdminClient();
  let charter = await getCharterByProject(admin, org.organizationId, projectId);
  if (!charter) {
    const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
    await createCharterForProject(admin, org.organizationId, projectId, org.userId, projectName);
    charter = await getCharterByProject(admin, org.organizationId, projectId);
  }
  if (!charter) notFound();

  const { data: versions } = await supabase
    .from("project_charter_versions")
    .select("id, version, change_reason, created_at")
    .eq("charter_id", charter.id)
    .order("version", { ascending: false })
    .limit(25);

  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  return (
    <CharterClient
      locale={locale}
      projectId={projectId}
      projectName={projectName}
      charter={charter}
      versions={versions ?? []}
      onboarding={onboard === "true"}
    />
  );
}
