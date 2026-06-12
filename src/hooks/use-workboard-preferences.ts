"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TaskStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkboardPreferences {
  hiddenColumns: TaskStatus[];
  collapsedGroups: string[];      // "backlog" | "active" | "complete"
  columnWidths: Partial<Record<TaskStatus, number>>; // custom width in px
  collapsedColumns: TaskStatus[]; // individually collapsed columns
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const DEFAULT_COLUMN_WIDTH = 280;
export const MIN_COLUMN_WIDTH = 200;
export const MAX_COLUMN_WIDTH = 600;
export const COLLAPSED_COLUMN_WIDTH = 40;

const ALL_STATUSES: TaskStatus[] = [
  "not_started", "prompt_ready", "sent_to_ai", "in_progress",
  "implemented", "tested", "done", "blocked", "deferred",
];

const GROUP_LABELS = ["backlog", "active", "complete"] as const;

const defaultPreferences: WorkboardPreferences = {
  hiddenColumns: [],
  collapsedGroups: [],
  columnWidths: {},
  collapsedColumns: [],
};

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(ALL_STATUSES);
const VALID_GROUPS = new Set<string>(GROUP_LABELS);

function isValidColumnWidths(value: unknown): Partial<Record<TaskStatus, number>> {
  if (typeof value !== "object" || value === null) return {};
  const obj = value as Record<string, unknown>;
  const valid: Partial<Record<TaskStatus, number>> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (VALID_STATUSES.has(key) && typeof val === "number" && val >= MIN_COLUMN_WIDTH && val <= MAX_COLUMN_WIDTH) {
      valid[key as TaskStatus] = val;
    }
    // Silently strip invalid entries
  }
  return valid;
}

function isValidPreferences(value: unknown): value is WorkboardPreferences {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.hiddenColumns) || !Array.isArray(obj.collapsedGroups)) return false;
  // Validate each hiddenColumns entry is a valid TaskStatus
  for (const col of obj.hiddenColumns as unknown[]) {
    if (typeof col !== "string" || !VALID_STATUSES.has(col)) return false;
  }
  // Validate each collapsedGroups entry is a valid group label
  for (const grp of obj.collapsedGroups as unknown[]) {
    if (typeof grp !== "string" || !VALID_GROUPS.has(grp)) return false;
  }
  // Validate collapsedColumns
  if (Array.isArray(obj.collapsedColumns)) {
    for (const col of obj.collapsedColumns as unknown[]) {
      if (typeof col !== "string" || !VALID_STATUSES.has(col)) return false;
    }
  }
  // columnWidths: allow object or missing — invalid entries stripped by isValidColumnWidths
  return true;
}

// ── Storage helpers ────────────────────────────────────────────────────────────

function storageKey(projectId: string): string {
  return `pops360_workboard_prefs_${projectId}`;
}

function loadPreferences(projectId: string): WorkboardPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return defaultPreferences;
    const parsed = JSON.parse(raw);
    if (isValidPreferences(parsed)) {
      // Sanitize columnWidths (strip invalid entries)
      if (parsed.columnWidths && typeof parsed.columnWidths === "object") {
        parsed.columnWidths = isValidColumnWidths(parsed.columnWidths);
      } else {
        parsed.columnWidths = {};
      }
      // Ensure collapsedColumns exists
      if (!Array.isArray(parsed.collapsedColumns)) {
        parsed.collapsedColumns = [];
      }
      return parsed;
    }
    // Invalid or corrupt data — reset to defaults
    console.warn("[workboard-prefs] Invalid stored preferences, resetting to defaults");
    localStorage.removeItem(storageKey(projectId));
    return defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function savePreferences(projectId: string, prefs: WorkboardPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(projectId), JSON.stringify(prefs));
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useWorkboardPreferences(projectId: string) {
  const [preferences, setPreferences] = useState<WorkboardPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save — writes to localStorage after 300ms of inactivity
  const debouncedSave = useCallback((prefs: WorkboardPreferences) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePreferences(projectId, prefs);
    }, 300);
  }, [projectId]);

  // Immediate save for discrete actions (toggle, collapse, etc.)
  const immediateSave = useCallback((prefs: WorkboardPreferences) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    savePreferences(projectId, prefs);
  }, [projectId]);

  useEffect(() => {
    setPreferences(loadPreferences(projectId));
    setLoaded(true);
  }, [projectId]);

  // ── Column visibility ─────────────────────────────────────────────────────

  const isColumnVisible = useCallback(
    (status: TaskStatus): boolean => {
      return !preferences.hiddenColumns.includes(status);
    },
    [preferences.hiddenColumns]
  );

  const toggleColumn = useCallback(
    (status: TaskStatus) => {
      setPreferences((prev) => {
        const hidden = prev.hiddenColumns.includes(status)
          ? prev.hiddenColumns.filter((s) => s !== status)
          : [...prev.hiddenColumns, status];
        const next = { ...prev, hiddenColumns: hidden };
        immediateSave(next);
        return next;
      });
    },
    [projectId, immediateSave]
  );

  const showAllColumns = useCallback(() => {
    setPreferences((prev) => {
      const next = { ...prev, hiddenColumns: [], collapsedGroups: [], collapsedColumns: [] };
      immediateSave(next);
      return next;
    });
  }, [projectId, immediateSave]);

  // ── Group collapse ────────────────────────────────────────────────────────

  const isGroupCollapsed = useCallback(
    (label: string): boolean => {
      return preferences.collapsedGroups.includes(label);
    },
    [preferences.collapsedGroups]
  );

  const toggleGroup = useCallback(
    (label: string) => {
      setPreferences((prev) => {
        const collapsed = prev.collapsedGroups.includes(label)
          ? prev.collapsedGroups.filter((g) => g !== label)
          : [...prev.collapsedGroups, label];
        const next = { ...prev, collapsedGroups: collapsed };
        immediateSave(next);
        return next;
      });
    },
    [projectId, immediateSave]
  );

  // ── Column width ────────────────────────────────────────────────────────────

  const getColumnWidth = useCallback(
    (status: TaskStatus): number => {
      return preferences.columnWidths[status] ?? DEFAULT_COLUMN_WIDTH;
    },
    [preferences.columnWidths]
  );

  const setColumnWidth = useCallback(
    (status: TaskStatus, width: number) => {
      const clamped = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width));
      setPreferences((prev) => {
        const next = { ...prev, columnWidths: { ...prev.columnWidths, [status]: clamped } };
        debouncedSave(next); // debounced during resize
        return next;
      });
    },
    [debouncedSave]
  );

  const resetColumnWidth = useCallback(
    (status: TaskStatus) => {
      setPreferences((prev) => {
        const { [status]: _, ...rest } = prev.columnWidths;
        const next = { ...prev, columnWidths: rest };
        immediateSave(next);
        return next;
      });
    },
    [projectId, immediateSave]
  );

  // ── Column collapse (individual) ─────────────────────────────────────────────

  const isColumnCollapsed = useCallback(
    (status: TaskStatus): boolean => {
      return preferences.collapsedColumns.includes(status);
    },
    [preferences.collapsedColumns]
  );

  const toggleColumnCollapse = useCallback(
    (status: TaskStatus) => {
      setPreferences((prev) => {
        const collapsed = prev.collapsedColumns.includes(status)
          ? prev.collapsedColumns.filter((s) => s !== status)
          : [...prev.collapsedColumns, status];
        const next = { ...prev, collapsedColumns: collapsed };
        immediateSave(next);
        return next;
      });
    },
    [projectId, immediateSave]
  );

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetPreferences = useCallback(() => {
    immediateSave(defaultPreferences);
    setPreferences(defaultPreferences);
  }, [projectId, immediateSave]);

  return {
    preferences,
    loaded,
    isColumnVisible,
    toggleColumn,
    showAllColumns,
    isGroupCollapsed,
    toggleGroup,
    getColumnWidth,
    setColumnWidth,
    resetColumnWidth,
    isColumnCollapsed,
    toggleColumnCollapse,
    resetPreferences,
    allStatuses: ALL_STATUSES,
    groupLabels: GROUP_LABELS,
  };
}