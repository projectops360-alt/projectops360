"use client";

import type { DocumentStatus, DocumentType, StorageType } from "@/types/database";

export interface DocumentFilterState {
  status: DocumentStatus | "all";
  documentType: DocumentType | "all";
  storageType: StorageType | "all";
}

interface DocumentFiltersProps {
  filters: DocumentFilterState;
  onFilterChange: (filters: DocumentFilterState) => void;
  labels: {
    status: Record<DocumentStatus, string> & { all: string };
    documentType: Record<DocumentType, string> & { all: string };
    storageType: Record<StorageType, string> & { all: string };
    statusLabel: string;
    documentTypeLabel: string;
    storageTypeLabel: string;
    clear: string;
  };
}

export function DocumentFilters({
  filters,
  onFilterChange,
  labels,
}: DocumentFiltersProps) {
  const statusOptions: (DocumentStatus | "all")[] = ["all", "draft", "review", "approved", "archived"];
  const typeOptions: (DocumentType | "all")[] = ["all", "evidence", "contract", "specification", "report", "presentation", "other"];
  const storageOptions: (StorageType | "all")[] = ["all", "upload", "external_url"];

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
              status: e.target.value as DocumentStatus | "all",
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

      {/* Document Type */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {labels.documentTypeLabel}
        </label>
        <select
          value={filters.documentType}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              documentType: e.target.value as DocumentType | "all",
            })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {labels.documentType[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Storage Type */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {labels.storageTypeLabel}
        </label>
        <select
          value={filters.storageType}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              storageType: e.target.value as StorageType | "all",
            })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {storageOptions.map((st) => (
            <option key={st} value={st}>
              {labels.storageType[st]}
            </option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {(filters.status !== "all" ||
        filters.documentType !== "all" ||
        filters.storageType !== "all") && (
        <button
          type="button"
          onClick={() =>
            onFilterChange({
              status: "all",
              documentType: "all",
              storageType: "all",
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