import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { StakeholderListClient } from "./stakeholder-list-client";

export default async function StakeholdersPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("stakeholders");
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

  // Fetch stakeholders for this project
  const { data: stakeholders } = await supabase
    .from("stakeholders")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  return (
    <StakeholderListClient
      projectId={projectId}
      projectTitle={projectTitle}
      stakeholders={stakeholders ?? []}
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
        influenceHigh: t("influence.high"),
        influenceMedium: t("influence.medium"),
        influenceLow: t("influence.low"),
        interestHigh: t("interest.high"),
        interestMedium: t("interest.medium"),
        interestLow: t("interest.low"),
      }}
    />
  );
}