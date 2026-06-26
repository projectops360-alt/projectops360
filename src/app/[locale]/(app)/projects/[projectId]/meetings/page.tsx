import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { MeetingListClient } from "./meeting-list-client";

export default async function MeetingsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const { guardProjectTab } = await import("@/lib/auth/project-guard");
  await guardProjectTab(projectId, "meetings");

  const t = await getTranslations("meetings");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch the project, scoped to the user's organization
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  // Fetch meetings for this project, ordered by date (newest first)
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("meeting_date", { ascending: false, nullsFirst: false });

  // Fetch stakeholders for the multi-select widget
  const { data: stakeholders } = await supabase
    .from("stakeholders")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  return (
    <MeetingListClient
      projectId={projectId}
      projectTitle={projectTitle}
      meetings={meetings ?? []}
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
        statusLabels: {
          _label: t("filters.status"),
          scheduled: t("status.scheduled"),
          in_progress: t("status.in_progress"),
          completed: t("status.completed"),
          cancelled: t("status.cancelled"),
        },
        filtersAll: t("filters.all"),
        filtersClear: t("filters.clear"),
        filtersDateFrom: t("filters.dateFrom"),
        filtersDateTo: t("filters.dateTo"),
      }}
    />
  );
}