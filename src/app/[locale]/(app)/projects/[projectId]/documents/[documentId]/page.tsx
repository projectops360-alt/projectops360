import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, DocumentStatus, DocumentType, StorageType } from "@/types/database";
import { DocumentDetailClient } from "./document-detail-client";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; documentId: string }>;
}) {
  const { locale, projectId, documentId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("documents");
  const tDetail = await getTranslations("documents.detail");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch the project
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

  // Fetch the document
  const { data: document } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!document) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  // Generate signed URL for uploaded files
  let signedUrl: string | null = null;
  if (document.storage_type === "upload" && document.file_url) {
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.file_url, 3600);
    signedUrl = urlData?.signedUrl ?? null;
  }

  return (
    <DocumentDetailClient
      projectId={projectId}
      projectTitle={projectTitle}
      document={document}
      signedUrl={signedUrl}
      organizationId={org.organizationId}
      locale={locale as Locale}
      translations={{
        back: tDetail("back"),
        owner: tDetail("owner"),
        noOwner: tDetail("noOwner"),
        storageType: tDetail("storageType"),
        documentType: tDetail("documentType"),
        file: tDetail("file"),
        externalLink: tDetail("externalLink"),
        description: tDetail("description"),
        noDescription: tDetail("noDescription"),
        version: tDetail("version"),
        openFile: tDetail("openFile"),
        openLink: tDetail("openLink"),
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
        } as Record<StorageType, string>,
      }}
    />
  );
}