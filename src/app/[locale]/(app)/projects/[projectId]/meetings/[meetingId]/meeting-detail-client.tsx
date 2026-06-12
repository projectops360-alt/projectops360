"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Pencil, Trash2, Sparkles, Zap } from "lucide-react";
import type { Meeting, MeetingStatus, TraceableEntityType, LinkType, ImpactArea, ActionItemPriority, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { EditMeetingDialog } from "@/components/meetings/edit-meeting-dialog";
import { LinkedRecords, type ResolvedLink } from "@/components/links/linked-records";
import { ExtractDecisionsPanel, ExtractActionItemsPanel, type AiExtractionTranslations, type AiActionExtractionTranslations } from "@/components/ai";
import { archiveMeetingAction } from "../actions";

interface StakeholderOption {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  title: string;
}

interface LinksTranslations {
  title: string;
  empty: string;
  emptyDescription: string;
  addLink: string;
  removeLink: string;
  removeConfirm: string;
  context: string;
  createdAt: string;
  entityTypeLabels: Record<TraceableEntityType, string>;
  linkTypeLabels: Record<LinkType, string>;
  dialogTranslations: {
    title: string;
    targetType: string;
    targetRecord: string;
    linkType: string;
    contextNotes: string;
    contextNotesPlaceholder: string;
    submit: string;
    cancel: string;
    entityTypeLabels: Record<TraceableEntityType, string>;
    linkTypeLabels: Record<LinkType, string>;
    errors: {
      targetRequired: string;
      linkTypeRequired: string;
      contextTooLong: string;
      duplicate: string;
      unexpected: string;
    };
  };
}

interface Translations {
  back: string;
  date: string;
  duration: string;
  durationValue: string;
  location: string;
  attendees: string;
  agenda: string;
  summary: string;
  notes: string;
  noNotes: string;
  linkedStakeholders: string;
  noStakeholders: string;
  linkedRecords: string;
  extractDecisions: string;
  extractDecisionsTooltip: string;
  extractActionItems: string;
  extractActionItemsTooltip: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  statusLabels: Record<string, string>;
  linksTranslations: LinksTranslations;
  aiExtractionTranslations: AiExtractionTranslations;
  aiActionExtractionTranslations: AiActionExtractionTranslations;
}

interface MeetingDetailClientProps {
  projectId: string;
  projectTitle: string;
  meeting: Meeting;
  stakeholders: StakeholderOption[];
  stakeholderMap: Map<string, string>;
  locale: Locale;
  links: ResolvedLink[];
  availableDecisions: EntityOption[];
  availableMeetings: EntityOption[];
  availableCommunications: EntityOption[];
  availableDocuments: EntityOption[];
  translations: Translations;
}

export function MeetingDetailClient({
  projectId,
  projectTitle,
  meeting,
  stakeholders,
  stakeholderMap,
  locale,
  links,
  availableDecisions,
  availableMeetings,
  availableCommunications,
  availableDocuments,
  translations: t,
}: MeetingDetailClientProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showAiExtraction, setShowAiExtraction] = useState(false);
  const [showAiActionExtraction, setShowAiActionExtraction] = useState(false);

  const title = getI18nValue(meeting.title_i18n, locale) || "Untitled";
  const agenda = getI18nValue(meeting.agenda_i18n, locale);
  const summary = getI18nValue(meeting.summary_i18n, locale);
  const notes = getI18nValue(meeting.notes_i18n, locale);

  const formattedDate = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const formattedTime = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const linkedNames = (meeting.linked_stakeholder_ids ?? [])
    .map((id) => stakeholderMap.get(id))
    .filter(Boolean);

  const handleArchive = useCallback(async () => {
    if (!confirm(t.archiveConfirm)) return;
    const result = await archiveMeetingAction(meeting.id);
    if (!result.error) {
      router.push(`/${locale}/projects/${projectId}/meetings`);
    }
  }, [meeting.id, t.archiveConfirm, router, locale, projectId]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/${locale}/projects/${projectId}/meetings`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <MeetingStatusBadge
              status={meeting.status as MeetingStatus}
              label={t.statusLabels[meeting.status] || meeting.status}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{projectTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiExtraction((v) => !v)}
            title={t.extractDecisionsTooltip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400 dark:hover:bg-amber-950"
          >
            <Sparkles className="h-4 w-4" />
            {t.extractDecisions}
          </button>
          <button
            type="button"
            onClick={() => setShowAiActionExtraction((v) => !v)}
            title={t.extractActionItemsTooltip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-950"
          >
            <Zap className="h-4 w-4" />
            {t.extractActionItems}
          </button>
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
        {formattedDate && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {t.date}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{formattedDate}</p>
            {formattedTime && (
              <p className="mt-0.5 text-xs text-muted-foreground">{formattedTime}</p>
            )}
          </div>
        )}
        {meeting.duration_minutes && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {t.duration}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {t.durationValue.replace("[minutes]", String(meeting.duration_minutes))}
            </p>
          </div>
        )}
        {meeting.location && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {t.location}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{meeting.location}</p>
          </div>
        )}
        {meeting.attendees && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {t.attendees}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{meeting.attendees}</p>
          </div>
        )}
      </div>

      {/* Linked stakeholders */}
      {linkedNames.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">{t.linkedStakeholders}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {linkedNames.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/50 dark:text-brand-300"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agenda */}
      {agenda && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">{t.agenda}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{agenda}</p>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">{t.summary}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{summary}</p>
        </div>
      )}

      {/* Notes */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">{t.notes}</h3>
        {notes ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{notes}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground/60">{t.noNotes}</p>
        )}
      </div>

      {/* AI Decision Extraction */}
      {showAiExtraction && (
        <ExtractDecisionsPanel
          meetingId={meeting.id}
          projectId={projectId}
          locale={locale}
          translations={t.aiExtractionTranslations}
          onDecisionCreated={() => router.refresh()}
        />
      )}

      {/* AI Action Item Extraction */}
      {showAiActionExtraction && (
        <ExtractActionItemsPanel
          meetingId={meeting.id}
          projectId={projectId}
          locale={locale}
          translations={t.aiActionExtractionTranslations}
          onActionItemCreated={() => router.refresh()}
        />
      )}

      {/* Linked Records (Traceability) */}
      <LinkedRecords
        projectId={projectId}
        sourceEntityType="meeting"
        sourceEntityId={meeting.id}
        links={links}
        availableDecisions={availableDecisions}
        availableMeetings={availableMeetings}
        availableCommunications={availableCommunications}
        availableDocuments={availableDocuments}
        locale={locale}
        translations={t.linksTranslations}
      />

      {/* Edit dialog */}
      {showEdit && (
        <EditMeetingDialog
          meeting={meeting}
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}