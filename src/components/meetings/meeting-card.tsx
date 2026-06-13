import Link from "next/link";
import { localizedHref } from "@/i18n/href";
import { Calendar, Clock, MapPin, Users, MoreHorizontal } from "lucide-react";
import type { Meeting, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { MeetingStatusBadge } from "./meeting-status-badge";

interface MeetingCardProps {
  meeting: Meeting;
  locale: Locale;
  projectId: string;
  statusLabel: string;
  editLabel: string;
  archiveLabel: string;
  onEdit: (meeting: Meeting) => void;
  onArchive: (meeting: Meeting) => void;
}

export function MeetingCard({
  meeting,
  locale,
  projectId,
  statusLabel,
  editLabel,
  archiveLabel,
  onEdit,
  onArchive,
}: MeetingCardProps) {
  const title = getI18nValue(meeting.title_i18n, locale) || "Untitled";
  const summary = getI18nValue(meeting.summary_i18n, locale);
  const agenda = getI18nValue(meeting.agenda_i18n, locale);

  const formattedDate = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const preview = summary || agenda;

  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-brand-500/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {title}
            </h3>
            <MeetingStatusBadge status={meeting.status} label={statusLabel} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEdit(meeting)}
          className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label={editLabel}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {formattedDate && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
        )}
        {meeting.duration_minutes && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {meeting.duration_minutes} min
          </span>
        )}
        {meeting.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[150px]">{meeting.location}</span>
          </span>
        )}
        {meeting.attendees && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="truncate max-w-[150px]">{meeting.attendees}</span>
          </span>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
      )}

      {/* Footer with link + archive */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <Link
          href={localizedHref(locale, `/projects/${projectId}/meetings/${meeting.id}`)}
          className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          View details →
        </Link>
        <button
          type="button"
          onClick={() => onArchive(meeting)}
          className="text-xs text-muted-foreground opacity-0 transition-opacity hover:text-red-600 dark:hover:text-red-400 group-hover:opacity-100"
        >
          {archiveLabel}
        </button>
      </div>
    </div>
  );
}