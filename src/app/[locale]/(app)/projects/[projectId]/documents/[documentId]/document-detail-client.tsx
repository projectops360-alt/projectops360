"use client";

import { useState, useCallback } from "react";
import { localizedHref } from "@/i18n/href";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, FileText, Upload, Link2, Hash, Pencil, Trash2, ExternalLink } from "lucide-react";
import type { Document, DocumentStatus, DocumentType, StorageType, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import { archiveDocumentAction } from "../actions";

interface Translations {
  back: string;
  owner: string;
  noOwner: string;
  storageType: string;
  documentType: string;
  file: string;
  externalLink: string;
  description: string;
  noDescription: string;
  version: string;
  openFile: string;
  openLink: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  statusLabels: Record<DocumentStatus, string>;
  documentTypeLabels: Record<DocumentType, string>;
  storageTypeLabels: Record<StorageType, string>;
}

interface DocumentDetailClientProps {
  projectId: string;
  projectTitle: string;
  document: Document;
  signedUrl: string | null;
  organizationId: string;
  locale: Locale;
  translations: Translations;
}

export function DocumentDetailClient({
  projectId,
  projectTitle,
  document,
  signedUrl,
  organizationId,
  locale,
  translations: t,
}: DocumentDetailClientProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);

  const title = getI18nValue(document.title_i18n, locale) || "Untitled";
  const description = getI18nValue(document.description_i18n, locale);

  const handleArchive = useCallback(async () => {
    if (!confirm(t.archiveConfirm)) return;
    const result = await archiveDocumentAction(document.id);
    if (!result.error) {
      router.push(localizedHref(locale, `/projects/${projectId}/documents`));
    }
  }, [document.id, t.archiveConfirm, router, locale, projectId]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/${locale}/projects/${projectId}/documents`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <DocumentStatusBadge
              status={document.status}
              label={t.statusLabels[document.status]}
            />
            <DocumentTypeBadge
              documentType={document.document_type}
              label={t.documentTypeLabels[document.document_type]}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{projectTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            {t.edit}
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            {t.archive}
          </button>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {document.owner && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {t.owner}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{document.owner}</p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {t.documentType}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {t.documentTypeLabels[document.document_type]}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {document.storage_type === "upload" ? (
              <Upload className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {t.storageType}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {t.storageTypeLabels[document.storage_type]}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            {t.version}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">v{document.version}</p>
        </div>
      </div>

      {/* File / Link section */}
      {document.storage_type === "upload" && signedUrl && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">{t.file}</h3>
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {t.openFile}
          </a>
        </div>
      )}
      {document.storage_type === "external_url" && document.external_url && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">{t.externalLink}</h3>
          <a
            href={document.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {t.openLink}
          </a>
        </div>
      )}

      {/* Description / Notes */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">{t.description}</h3>
        {description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground/60">{t.noDescription}</p>
        )}
      </div>

      {/* Edit dialog */}
      {showEdit && (
        <EditDocumentDialog
          document={document}
          locale={locale}
          projectId={projectId}
          organizationId={organizationId}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}