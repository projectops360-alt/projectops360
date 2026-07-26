"use client";

// ============================================================================
// PMO Intelligence Center — global filter bar (CAP-048 Phase 2, M3)
// ============================================================================
// These filters belong to the scope, not to a panel. Changing one here changes
// every surface below, which is the property the whole milestone is about.
//
// Two controls are rendered DISABLED with an explicit note: Portfolio and
// Program. There is no `portfolios` table and no `programs` table
// (parity matrix §4), so a working-looking dropdown would be a lie. Removing
// them entirely was the alternative; showing them disabled with the reason is
// better, because a PMO who expects the concept learns why it is absent instead
// of assuming the feature was forgotten.
//
// The date range genuinely reaches the database (read-model.server.ts applies
// it to the event-log query). Dashboard 2's range control never did — the
// matrix flagged it, and "a filter that silently does nothing is worse than no
// filter" is the reason it is wired end to end here.
// ============================================================================

import { useTranslations } from "next-intl";
import { Building2, CalendarRange, FolderTree, Lock, X } from "lucide-react";
import type { DateRange } from "@/lib/pmo-intelligence/scope";

export interface PmoProjectOption {
  id: string;
  label: string;
}

export interface PmoGlobalFiltersProps {
  organizationName: string;
  projects: readonly PmoProjectOption[];
  selectedProjectIds: readonly string[];
  onProjectIdsChange: (ids: string[]) => void;
  dateRange: DateRange;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  /** True while a data-affecting reload is in flight. */
  isLoading: boolean;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export function PmoGlobalFilters({
  organizationName,
  projects,
  selectedProjectIds,
  onProjectIdsChange,
  dateRange,
  onDateRangeChange,
  isLoading,
  onReset,
  hasActiveFilters,
}: PmoGlobalFiltersProps) {
  const t = useTranslations("pmoIntelligence");

  const toggleProject = (id: string) => {
    onProjectIdsChange(
      selectedProjectIds.includes(id)
        ? selectedProjectIds.filter((current) => current !== id)
        : [...selectedProjectIds, id],
    );
  };

  const projectSummary =
    selectedProjectIds.length === 0
      ? t("filterAllProjects")
      : t("filterProjectCount", { count: selectedProjectIds.length });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Organization — fixed. It comes from the session and is never a choice
          the client makes; RLS enforces the same boundary again. */}
      <span className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
        <Building2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        {organizationName}
      </span>

      {/* Portfolio / Program — declared absent, never simulated. */}
      <NotConfigured label={t("filterPortfolio")} note={t("filterNotConfigured")} />
      <NotConfigured label={t("filterProgram")} note={t("filterNotConfigured")} />

      {/* Projects — a real multi-select. */}
      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <FolderTree className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          {t("filterProjects")}
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">
            {projectSummary}
          </span>
        </summary>
        <div className="absolute left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {projects.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-500">{t("filterNoProjects")}</p>
          ) : (
            <ul className="space-y-1">
              {projects.map((project) => (
                <li key={project.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="min-w-0 flex-1 break-words">{project.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {selectedProjectIds.length > 0 ? (
            <button
              type="button"
              onClick={() => onProjectIdsChange([])}
              className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t("filterAllProjects")}
            </button>
          ) : null}
        </div>
      </details>

      {/* Date range — reaches the read model, which reaches the database. */}
      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1">
        <CalendarRange className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        <label className="sr-only" htmlFor="pmo-date-from">
          {t("filterDateFrom")}
        </label>
        <input
          id="pmo-date-from"
          type="date"
          value={dateRange.from ?? ""}
          max={dateRange.to ?? undefined}
          onChange={(event) => onDateRangeChange(event.target.value || null, dateRange.to)}
          className="w-[120px] bg-transparent text-xs text-slate-700 focus:outline-none"
        />
        <span className="text-xs text-slate-400" aria-hidden>
          →
        </span>
        <label className="sr-only" htmlFor="pmo-date-to">
          {t("filterDateTo")}
        </label>
        <input
          id="pmo-date-to"
          type="date"
          value={dateRange.to ?? ""}
          min={dateRange.from ?? undefined}
          onChange={(event) => onDateRangeChange(dateRange.from, event.target.value || null)}
          className="w-[120px] bg-transparent text-xs text-slate-700 focus:outline-none"
        />
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("filterReset")}
        </button>
      ) : null}

      {/* Loading is stated rather than implied by a frozen screen: the previous
          data stays visible, so without this the dashboard looks unresponsive. */}
      {isLoading ? (
        <span role="status" className="text-xs font-semibold text-sky-700">
          {t("loadingScope")}
        </span>
      ) : null}
    </div>
  );
}

/** A control the product does not have, shown as absent rather than faked. */
function NotConfigured({ label, note }: { label: string; note: string }) {
  return (
    <span
      title={note}
      aria-disabled="true"
      className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-400"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
      {label}
      <span className="text-[10px] font-medium normal-case text-slate-400">({note})</span>
    </span>
  );
}
