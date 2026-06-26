import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { CommunicationsListClient } from "./communications-list-client";

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const { guardProjectTab } = await import("@/lib/auth/project-guard");
  await guardProjectTab(projectId, "communications");

  const t = await getTranslations("communications");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Project, communications and stakeholders are all independent (they only
  // depend on projectId/org), so we fan them out together.
  const [projectResult, communicationsResult, stakeholdersResult] = await Promise.all([
    supabase.from("projects").select("id, slug, title_i18n").eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single(),
    supabase.from("communication_items").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("item_date", { ascending: false, nullsFirst: false }),
    supabase.from("stakeholders").select("id, name").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("name", { ascending: true }),
  ]);

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
  const communications = communicationsResult.data;
  const stakeholders = stakeholdersResult.data;

  return (
    <CommunicationsListClient
      projectId={projectId}
      projectTitle={projectTitle}
      communications={communications ?? []}
      stakeholders={(stakeholders ?? []).map((s) => ({ id: s.id, name: s.name }))}
      locale={locale as Locale}
      translations={{
        title: t("title"),
        description: t("description"),
        create: t("create"),
        empty: t("empty"),
        emptyDescription: t("emptyDescription"),
        edit: t("edit"),
        archive: t("archive"),
        archiveConfirm: t("archiveConfirm"),
        sourceTypeLabels: {
          _label: t("filters.sourceType"),
          email: t("sourceType.email"),
          meeting: t("sourceType.meeting"),
          phone: t("sourceType.phone"),
          teams: t("sourceType.teams"),
          slack: t("sourceType.slack"),
          in_person: t("sourceType.in_person"),
          document: t("sourceType.document"),
          manual_note: t("sourceType.manual_note"),
          other: t("sourceType.other"),
        },
        statusLabels: {
          _label: t("filters.status"),
          draft: t("status.draft"),
          logged: t("status.logged"),
        },
        followUpYes: t("followUp.yes"),
        filtersAll: t("filters.all"),
        filtersClear: t("filters.clear"),
        filtersDateFrom: t("filters.dateFrom"),
        filtersDateTo: t("filters.dateTo"),
        filtersFollowUp: t("filters.followUp"),
      }}
    />
  );
}