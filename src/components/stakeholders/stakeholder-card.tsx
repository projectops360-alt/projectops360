import { Mail, MoreHorizontal } from "lucide-react";
import type { Stakeholder } from "@/types/database";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { InfluenceBadge } from "./influence-badge";

interface StakeholderCardProps {
  stakeholder: Stakeholder;
  locale: Locale;
  roleLabel: string;
  influenceLabel: string;
  interestLabel: string;
  onEdit: (stakeholder: Stakeholder) => void;
  onArchive: (stakeholder: Stakeholder) => void;
}

export function StakeholderCard({
  stakeholder,
  locale,
  roleLabel,
  influenceLabel,
  interestLabel,
  onEdit,
  onArchive,
}: StakeholderCardProps) {
  const name = stakeholder.name;
  const role = getI18nValue(stakeholder.role_i18n, locale);
  const notes = getI18nValue(stakeholder.notes_i18n, locale);

  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-brand-500/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
              <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {name}
              </h3>
              {role && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {role}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions dropdown */}
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(stakeholder)}
            className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            aria-label={roleLabel}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {stakeholder.influence && (
          <InfluenceBadge level={stakeholder.influence} label={influenceLabel} />
        )}
        {stakeholder.interest && (
          <InfluenceBadge level={stakeholder.interest} label={interestLabel} />
        )}
        {stakeholder.email && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            {stakeholder.email}
          </span>
        )}
      </div>

      {/* Notes preview */}
      {notes && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {notes}
        </p>
      )}

      {/* Archive button (visible on hover) */}
      <div className="mt-3 flex justify-end border-t border-border/50 pt-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onArchive(stakeholder)}
          className="text-xs text-muted-foreground transition-colors hover:text-red-600 dark:hover:text-red-400"
        >
          {roleLabel ? "Archive" : "Archive"}
        </button>
      </div>
    </div>
  );
}