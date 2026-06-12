"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare } from "lucide-react";
import type { CommunicationItem, Locale } from "@/types/database";
import { CreateCommunicationDialog } from "@/components/communications/create-communication-dialog";
import { EditCommunicationDialog } from "@/components/communications/edit-communication-dialog";
import { CommunicationCard } from "@/components/communications/communication-card";
import { CommunicationFilters, type FilterState } from "@/components/communications/communication-filters";
import { archiveCommunicationAction } from "./actions";

interface StakeholderOption {
  id: string;
  name: string;
}

interface Translations {
  title: string;
  description: string;
  create: string;
  empty: string;
  emptyDescription: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  sourceTypeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  followUpYes: string;
  filtersAll: string;
  filtersClear: string;
  filtersDateFrom: string;
  filtersDateTo: string;
  filtersFollowUp: string;
}

interface CommunicationsListClientProps {
  projectId: string;
  projectTitle: string;
  communications: CommunicationItem[];
  stakeholders: StakeholderOption[];
  locale: Locale;
  translations: Translations;
}

export function CommunicationsListClient({
  projectId,
  projectTitle,
  communications: initialCommunications,
  stakeholders,
  locale,
  translations: t,
}: CommunicationsListClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingCommunication, setEditingCommunication] = useState<CommunicationItem | null>(null);
  const [communications, setCommunications] = useState(initialCommunications);
  const [filters, setFilters] = useState<FilterState>({
    sourceType: "",
    status: "",
    followUpOnly: false,
    dateFrom: "",
    dateTo: "",
  });

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleArchive = useCallback(
    async (communication: CommunicationItem) => {
      if (!confirm(t.archiveConfirm)) return;

      const result = await archiveCommunicationAction(communication.id);
      if (!result.error) {
        setCommunications((prev) => prev.filter((c) => c.id !== communication.id));
        router.refresh();
      }
    },
    [t.archiveConfirm, router],
  );

  // Client-side filtering
  const filteredCommunications = useMemo(() => {
    return communications.filter((c) => {
      if (filters.sourceType && c.source_type !== filters.sourceType) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.followUpOnly && !c.requires_follow_up) return false;
      if (filters.dateFrom && c.item_date && c.item_date < filters.dateFrom) return false;
      if (filters.dateTo && c.item_date && c.item_date > filters.dateTo + "T23:59:59") return false;
      return true;
    });
  }, [communications, filters]);

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
      {communications.length > 0 && (
        <CommunicationFilters
          filters={filters}
          onFiltersChange={setFilters}
          sourceTypeLabels={t.sourceTypeLabels}
          statusLabels={t.statusLabels}
          followUpLabel={t.filtersFollowUp}
          allLabel={t.filtersAll}
          clearLabel={t.filtersClear}
          dateFromLabel={t.filtersDateFrom}
          dateToLabel={t.filtersDateTo}
        />
      )}

      {/* Communication grid */}
      {filteredCommunications.length === 0 && communications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16">
          <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
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
      ) : filteredCommunications.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t.filtersClear === "Clear filters" ? "No communications match the current filters." : "No hay comunicaciones que coincidan con los filtros actuales."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCommunications.map((communication) => (
            <CommunicationCard
              key={communication.id}
              communication={communication}
              locale={locale}
              sourceTypeLabel={
                communication.source_type
                  ? t.sourceTypeLabels[communication.source_type] || communication.source_type
                  : ""
              }
              statusLabel={t.statusLabels[communication.status] || communication.status}
              followUpLabel={t.followUpYes}
              editLabel={t.edit}
              archiveLabel={t.archive}
              onEdit={setEditingCommunication}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateCommunicationDialog
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit dialog */}
      {editingCommunication && (
        <EditCommunicationDialog
          communication={editingCommunication}
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          onClose={() => setEditingCommunication(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}