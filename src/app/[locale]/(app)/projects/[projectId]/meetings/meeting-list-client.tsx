"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarDays } from "lucide-react";
import type { Meeting, Locale } from "@/types/database";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { EditMeetingDialog } from "@/components/meetings/edit-meeting-dialog";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { MeetingFilters, type MeetingFilterState } from "@/components/meetings/meeting-filters";
import { archiveMeetingAction } from "./actions";

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
  statusLabels: Record<string, string>;
  filtersAll: string;
  filtersClear: string;
  filtersDateFrom: string;
  filtersDateTo: string;
}

interface MeetingListClientProps {
  projectId: string;
  projectTitle: string;
  meetings: Meeting[];
  stakeholders: StakeholderOption[];
  locale: Locale;
  translations: Translations;
}

export function MeetingListClient({
  projectId,
  projectTitle,
  meetings: initialMeetings,
  stakeholders,
  locale,
  translations: t,
}: MeetingListClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetings, setMeetings] = useState(initialMeetings);
  const [filters, setFilters] = useState<MeetingFilterState>({
    status: "",
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
    async (meeting: Meeting) => {
      if (!confirm(t.archiveConfirm)) return;

      const result = await archiveMeetingAction(meeting.id);
      if (!result.error) {
        setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
        router.refresh();
      }
    },
    [t.archiveConfirm, router],
  );

  // Client-side filtering
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (filters.status && m.status !== filters.status) return false;
      if (filters.dateFrom && m.meeting_date && m.meeting_date < filters.dateFrom) return false;
      if (filters.dateTo && m.meeting_date && m.meeting_date > filters.dateTo + "T23:59:59") return false;
      return true;
    });
  }, [meetings, filters]);

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
      {meetings.length > 0 && (
        <MeetingFilters
          filters={filters}
          onFiltersChange={setFilters}
          statusLabels={t.statusLabels}
          allLabel={t.filtersAll}
          clearLabel={t.filtersClear}
          dateFromLabel={t.filtersDateFrom}
          dateToLabel={t.filtersDateTo}
        />
      )}

      {/* Meeting grid */}
      {filteredMeetings.length === 0 && meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
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
      ) : filteredMeetings.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {locale === "es" ? "No hay reuniones que coincidan con los filtros actuales." : "No meetings match the current filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              locale={locale}
              projectId={projectId}
              statusLabel={t.statusLabels[meeting.status] || meeting.status}
              editLabel={t.edit}
              archiveLabel={t.archive}
              onEdit={setEditingMeeting}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateMeetingDialog
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit dialog */}
      {editingMeeting && (
        <EditMeetingDialog
          meeting={editingMeeting}
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          onClose={() => setEditingMeeting(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}