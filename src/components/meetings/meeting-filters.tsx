"use client";

import type { MeetingStatus } from "@/types/database";

const statusOptions: MeetingStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

export interface MeetingFilterState {
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface MeetingFiltersProps {
  filters: MeetingFilterState;
  onFiltersChange: (filters: MeetingFilterState) => void;
  statusLabels: Record<string, string>;
  allLabel: string;
  clearLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
}

export function MeetingFilters({
  filters,
  onFiltersChange,
  statusLabels,
  allLabel,
  clearLabel,
  dateFromLabel,
  dateToLabel,
}: MeetingFiltersProps) {
  const hasFilters =
    filters.status !== "" || filters.dateFrom !== "" || filters.dateTo !== "";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {/* Status */}
      <div className="space-y-1">
        <label htmlFor="filter-meeting-status" className="block text-xs font-medium text-muted-foreground">
          {statusLabels._label || "Status"}
        </label>
        <select
          id="filter-meeting-status"
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">{allLabel}</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s] || s}
            </option>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div className="space-y-1">
        <label htmlFor="filter-meeting-date-from" className="block text-xs font-medium text-muted-foreground">
          {dateFromLabel}
        </label>
        <input
          id="filter-meeting-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Date to */}
      <div className="space-y-1">
        <label htmlFor="filter-meeting-date-to" className="block text-xs font-medium text-muted-foreground">
          {dateToLabel}
        </label>
        <input
          id="filter-meeting-date-to"
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => onFiltersChange({ status: "", dateFrom: "", dateTo: "" })}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}