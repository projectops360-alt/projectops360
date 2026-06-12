import { Calendar, Mail, MoreHorizontal, AlertTriangle } from "lucide-react";
import type { CommunicationItem, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { SourceTypeBadge } from "./source-type-badge";
import { StatusBadge } from "./status-badge";

interface CommunicationCardProps {
  communication: CommunicationItem;
  locale: Locale;
  sourceTypeLabel: string;
  statusLabel: string;
  followUpLabel: string;
  editLabel: string;
  archiveLabel: string;
  onEdit: (communication: CommunicationItem) => void;
  onArchive: (communication: CommunicationItem) => void;
}

export function CommunicationCard({
  communication,
  locale,
  sourceTypeLabel,
  statusLabel,
  followUpLabel,
  editLabel,
  archiveLabel,
  onEdit,
  onArchive,
}: CommunicationCardProps) {
  const title = getI18nValue(communication.title_i18n, locale) || "Untitled";
  const summary = getI18nValue(communication.summary_i18n, locale);
  const content = getI18nValue(communication.content_i18n, locale);

  const formattedDate = communication.item_date
    ? new Date(communication.item_date).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-brand-500/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {title}
            </h3>
            {communication.requires_follow_up && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {followUpLabel}
              </span>
            )}
          </div>
          {communication.sender && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {communication.sender}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onEdit(communication)}
          className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label={editLabel}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {communication.source_type && (
          <SourceTypeBadge sourceType={communication.source_type} label={sourceTypeLabel} />
        )}
        <StatusBadge status={communication.status} label={statusLabel} />
        {formattedDate && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
        )}
      </div>

      {/* Summary preview */}
      {summary && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{summary}</p>
      )}
      {!summary && content && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{content}</p>
      )}

      {/* Recipients */}
      {communication.recipients && (
        <p className="mt-1 truncate text-xs text-muted-foreground/70">
          → {communication.recipients}
        </p>
      )}

      {/* Archive button (visible on hover) */}
      <div className="mt-3 flex justify-end border-t border-border/50 pt-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onArchive(communication)}
          className="text-xs text-muted-foreground transition-colors hover:text-red-600 dark:hover:text-red-400"
        >
          {archiveLabel}
        </button>
      </div>
    </div>
  );
}