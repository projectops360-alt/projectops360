"use client";

import type { DecisionStatus, ImpactArea } from "@/types/database";

export interface DecisionFilterState {
  status: DecisionStatus | "all";
  impactArea: ImpactArea | "all";
  dateFrom: string;
  dateTo: string;
}

interface DecisionFiltersProps {
  filters: DecisionFilterState;
  onFilterChange: (filters: DecisionFilterState) => void;
  labels: {
    status: Record<DecisionStatus, string> & { all: string };
    statusLabel: string;
    impactArea: Record<ImpactArea, string> & { all: string };
    impactAreaLabel: string;
    dateFrom: string;
    dateTo: string;
    clear: string;
  };
}

export function DecisionFilters({
  filters,
  onFilterChange,
  labels,
}: DecisionFiltersProps) {
  const statusOptions: (DecisionStatus | "all")[] = [
    "all",
    "proposed",
    "accepted",
    "rejected",
    "deferred",
    "revoked",
  ];

  const impactOptions: (ImpactArea | "all")[] = [
    "all",
    "scope",
    "schedule",
    "budget",
    "risk",
    "quality",
    "communication",
    "document",
    "other",
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {labels.statusLabel}
        </label>
        <select
          value={filters.status}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              status: e.target.value as DecisionStatus | "all",
            })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {labels.status[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Impact Area */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {labels.impactAreaLabel}
        </label>
        <select
          value={filters.impactArea}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              impactArea: e.target.value as ImpactArea | "all",
            })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {impactOptions.map((ia) => (
            <option key={ia} value={ia}>
              {labels.impactArea[ia]}
            </option>
          ))}
        </select>
      </div>

      {/* Date From */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {labels.dateFrom}
        </label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) =>
            onFilterChange({ ...filters, dateFrom: e.target.value })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Date To */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {labels.dateTo}
        </label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) =>
            onFilterChange({ ...filters, dateTo: e.target.value })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Clear */}
      {(filters.status !== "all" ||
        filters.impactArea !== "all" ||
        filters.dateFrom ||
        filters.dateTo) && (
        <button
          type="button"
          onClick={() =>
            onFilterChange({
              status: "all",
              impactArea: "all",
              dateFrom: "",
              dateTo: "",
            })
          }
          className="rounded-md px-3 py-1.5 text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          {labels.clear}
        </button>
      )}
    </div>
  );
}