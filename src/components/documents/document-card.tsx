"use client";

import Link from "next/link";
import { localizedHref } from "@/i18n/href";
import { Link2, Upload } from "lucide-react";
import type { Document, DocumentStatus, DocumentType, StorageType, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { DocumentStatusBadge } from "./document-status-badge";
import { DocumentTypeBadge } from "./document-type-badge";

interface DocumentCardProps {
  document: Document;
  locale: Locale;
  projectId: string;
  labels: {
    status: Record<DocumentStatus, string>;
    documentType: Record<DocumentType, string>;
    storageType: Record<StorageType, string>;
    noOwner: string;
  };
}

export function DocumentCard({
  document,
  locale,
  projectId,
  labels,
}: DocumentCardProps) {
  const title = getI18nValue(document.title_i18n, locale, "Untitled");
  const description = getI18nValue(document.description_i18n, locale);

  return (
    <Link
      href={localizedHref(locale, `/projects/${projectId}/documents/${document.id}`)}
      className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <DocumentStatusBadge
          status={document.status}
          label={labels.status[document.status]}
        />
      </div>

      {description && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <DocumentTypeBadge
          documentType={document.document_type}
          label={labels.documentType[document.document_type]}
        />

        {document.storage_type === "upload" ? (
          <span className="inline-flex items-center gap-1 text-gray-400">
            <Upload className="h-3 w-3" />
            {labels.storageType.upload}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-gray-400">
            <Link2 className="h-3 w-3" />
            {labels.storageType.external_url}
          </span>
        )}

        {document.owner && (
          <span className="truncate text-gray-400">
            · {document.owner}
          </span>
        )}
      </div>
    </Link>
  );
}