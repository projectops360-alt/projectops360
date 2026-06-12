"use client";

import type { CommunicationSourceType, CommunicationStatus } from "@/types/database";

const sourceTypeOptions: CommunicationSourceType[] = [
  "email", "meeting", "phone", "teams", "slack",
  "in_person", "document", "manual_note", "other",
];

const statusOptions: CommunicationStatus[] = ["draft", "logged"];

export interface FilterState {
  sourceType: string;
  status: string;
  followUpOnly: boolean;
  dateFrom: string;
  dateTo: string;
}

interface CommunicationFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  sourceTypeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  followUpLabel: string;
  allLabel: string;
  clearLabel: string;
  dateFromLabel: string;
  dateToLabel: string;
}

export function CommunicationFilters({
  filters,
  onFiltersChange,
  sourceTypeLabels,
  statusLabels,
  followUpLabel,
  allLabel,
  clearLabel,
  dateFromLabel,
  dateToLabel,
}: CommunicationFiltersProps) {
  const hasFilters =
    filters.sourceType !== "" ||
    filters.status !== "" ||
    filters.followUpOnly ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {/* Source type */}
      <div className="space-y-1">
        <label htmlFor="filter-source-type" className="block text-xs font-medium text-muted-foreground">
          {sourceTypeLabels._label || "Source type"}
        </label>
        <select
          id="filter-source-type"
          value={filters.sourceType}
          onChange={(e) => onFiltersChange({ ...filters, sourceType: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">{allLabel}</option>
          {sourceTypeOptions.map((st) => (
            <option key={st} value={st}>
              {sourceTypeLabels[st] || st}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label htmlFor="filter-status" className="block text-xs font-medium text-muted-foreground">
          {statusLabels._label || "Status"}
        </label>
        <select
          id="filter-status"
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
        <label htmlFor="filter-date-from" className="block text-xs font-medium text-muted-foreground">
          {dateFromLabel}
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Date to */}
      <div className="space-y-1">
        <label htmlFor="filter-date-to" className="block text-xs font-medium text-muted-foreground">
          {dateToLabel}
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {/* Follow-up toggle */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          {followUpLabel}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.followUpOnly}
            onChange={(e) => onFiltersChange({ ...filters, followUpOnly: e.target.checked })}
            className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500/20"
          />
        </label>
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <div className="flex items-end">
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                sourceType: "",
                status: "",
                followUpOnly: false,
                dateFrom: "",
                dateTo: "",
              })
            }
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}