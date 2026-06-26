import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { DocumentListClient } from "./document-list-client";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const { guardProjectTab } = await import("@/lib/auth/project-guard");
  await guardProjectTab(projectId, "documents");

  const t = await getTranslations("documents");
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

  // Fetch documents for this project, ordered by creation date (newest first)
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <DocumentListClient
      projectId={projectId}
      projectTitle={projectTitle}
      documents={documents ?? []}
      organizationId={org.organizationId}
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
          draft: t("status.draft"),
          review: t("status.review"),
          approved: t("status.approved"),
          archived: t("status.archived"),
        },
        documentTypeLabels: {
          evidence: t("documentType.evidence"),
          contract: t("documentType.contract"),
          specification: t("documentType.specification"),
          report: t("documentType.report"),
          presentation: t("documentType.presentation"),
          other: t("documentType.other"),
        },
        storageTypeLabels: {
          upload: t("storageType.upload"),
          external_url: t("storageType.external_url"),
        },
        filters: {
          status: t("filters.status"),
          documentType: t("filters.documentType"),
          storageType: t("filters.storageType"),
          all: t("filters.all"),
          clear: t("filters.clear"),
        },
      }}
    />
  );
}