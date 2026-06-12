"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import type { Document, DocumentStatus, DocumentType, StorageType, Locale } from "@/types/database";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { EditDocumentDialog } from "@/components/documents/edit-document-dialog";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentFilters, type DocumentFilterState } from "@/components/documents/document-filters";
import { archiveDocumentAction } from "./actions";

interface Translations {
  title: string;
  description: string;
  create: string;
  empty: string;
  emptyDescription: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  statusLabels: Record<DocumentStatus, string>;
  documentTypeLabels: Record<DocumentType, string>;
  storageTypeLabels: Record<StorageType, string>;
  filters: {
    status: string;
    documentType: string;
    storageType: string;
    all: string;
    clear: string;
  };
}

interface DocumentListClientProps {
  projectId: string;
  projectTitle: string;
  documents: Document[];
  organizationId: string;
  locale: Locale;
  translations: Translations;
}

export function DocumentListClient({
  projectId,
  projectTitle,
  documents: initialDocuments,
  organizationId,
  locale,
  translations: t,
}: DocumentListClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [filters, setFilters] = useState<DocumentFilterState>({
    status: "all",
    documentType: "all",
    storageType: "all",
  });

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleArchive = useCallback(
    async (document: Document) => {
      if (!confirm(t.archiveConfirm)) return;

      const result = await archiveDocumentAction(document.id);
      if (!result.error) {
        setDocuments((prev) => prev.filter((d) => d.id !== document.id));
        router.refresh();
      }
    },
    [t.archiveConfirm, router],
  );

  // Client-side filtering
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (filters.status !== "all" && d.status !== filters.status) return false;
      if (filters.documentType !== "all" && d.document_type !== filters.documentType) return false;
      if (filters.storageType !== "all" && d.storage_type !== filters.storageType) return false;
      return true;
    });
  }, [documents, filters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectTitle} · {t.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <Plus className="h-4 w-4" />
          {t.create}
        </button>
      </div>

      {/* Filters */}
      {documents.length > 0 && (
        <DocumentFilters
          filters={filters}
          onFilterChange={setFilters}
          labels={{
            status: {
              draft: t.statusLabels.draft,
              review: t.statusLabels.review,
              approved: t.statusLabels.approved,
              archived: t.statusLabels.archived,
              all: t.filters.all,
            },
            documentType: {
              evidence: t.documentTypeLabels.evidence,
              contract: t.documentTypeLabels.contract,
              specification: t.documentTypeLabels.specification,
              report: t.documentTypeLabels.report,
              presentation: t.documentTypeLabels.presentation,
              other: t.documentTypeLabels.other,
              all: t.filters.all,
            },
            storageType: {
              upload: t.storageTypeLabels.upload,
              external_url: t.storageTypeLabels.external_url,
              all: t.filters.all,
            },
            statusLabel: t.filters.status,
            documentTypeLabel: t.filters.documentType,
            storageTypeLabel: t.filters.storageType,
            clear: t.filters.clear,
          }}
        />
      )}

      {/* Document grid */}
      {filteredDocuments.length === 0 && documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t.empty}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">{t.emptyDescription}</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            {t.create}
          </button>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {locale === "es" ? "No hay documentos que coincidan con los filtros actuales." : "No documents match the current filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              locale={locale}
              projectId={projectId}
              labels={{
                status: t.statusLabels,
                documentType: t.documentTypeLabels,
                storageType: t.storageTypeLabels,
                noOwner: locale === "es" ? "Sin propietario" : "No owner",
              }}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateDocumentDialog
          locale={locale}
          projectId={projectId}
          organizationId={organizationId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit dialog */}
      {editingDocument && (
        <EditDocumentDialog
          document={editingDocument}
          locale={locale}
          projectId={projectId}
          organizationId={organizationId}
          onClose={() => setEditingDocument(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}