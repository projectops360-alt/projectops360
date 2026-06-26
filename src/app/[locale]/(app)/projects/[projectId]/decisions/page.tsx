import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { DecisionListClient } from "./decision-list-client";

export default async function DecisionsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const { guardProjectTab } = await import("@/lib/auth/project-guard");
  await guardProjectTab(projectId, "decisions");

  const t = await getTranslations("decisions");
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

  // Fetch decisions for this project, ordered by date (newest first)
  const { data: decisions } = await supabase
    .from("decisions")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("decision_date", { ascending: false, nullsFirst: false });

  // Fetch stakeholders for the multi-select widget
  const { data: stakeholders } = await supabase
    .from("stakeholders")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  return (
    <DecisionListClient
      projectId={projectId}
      projectTitle={projectTitle}
      decisions={decisions ?? []}
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
          proposed: t("status.proposed"),
          accepted: t("status.accepted"),
          rejected: t("status.rejected"),
          deferred: t("status.deferred"),
          revoked: t("status.revoked"),
        },
        impactAreaLabels: {
          scope: t("impactArea.scope"),
          schedule: t("impactArea.schedule"),
          budget: t("impactArea.budget"),
          risk: t("impactArea.risk"),
          quality: t("impactArea.quality"),
          communication: t("impactArea.communication"),
          document: t("impactArea.document"),
          other: t("impactArea.other"),
        },
        filters: {
          status: t("filters.status"),
          impactArea: t("filters.impactArea"),
          dateFrom: t("filters.dateFrom"),
          dateTo: t("filters.dateTo"),
          all: t("filters.all"),
          clear: t("filters.clear"),
        },
      }}
    />
  );
}