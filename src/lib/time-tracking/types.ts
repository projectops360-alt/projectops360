// ============================================================================
// ProjectOps360° — Time Tracking Engine · Types
// ============================================================================
// Actual effort lives in ONE place: subtask_time_entries. Everything else
// (subtask cards, task report, dashboards, and later EVM/CPI/SPI, burn rate,
// utilisation, timesheets and billing) aggregates over these rows instead of
// storing hours again. task_subtasks.actual_hours is a derived cache written
// only by this engine — guard SUBTASK-ACTUAL-HOURS-DERIVED.
// ============================================================================

/** How an entry was captured. Manual today; the rest are future intake paths. */
export const TIME_ENTRY_SOURCES = ["manual", "timer", "import", "api"] as const;
export type TimeEntrySource = (typeof TIME_ENTRY_SOURCES)[number];

/** Mirrors public.subtask_time_entries (migration 20260870000000). */
export interface TimeEntry {
  id: string;
  organization_id: string;
  project_id: string;
  task_id: string;
  /** Null = logged against the task itself, not a subtask. */
  subtask_id: string | null;
  /** Whose effort this is (may differ from created_by). */
  user_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number;
  comment: string | null;
  source: TimeEntrySource;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** A time entry ready to render: the person's name resolved, newest first. */
export interface TimeEntryView extends TimeEntry {
  user_name: string;
  /** Whether the viewer may edit / delete this particular row. */
  can_edit: boolean;
  can_delete: boolean;
}

/**
 * Effort standing for one work item.
 *
 * The overrun lives in `varianceHours`, not in a negative `remainingHours`:
 * those two were the same number with opposite signs, so `remaining` now means
 * strictly "budget left" and floors at 0, while `variance` carries the sign.
 * Nothing a PM needs is hidden — it moved to the field that is named for it.
 */
export interface EffortSummary {
  estimatedHours: number | null;
  actualHours: number;
  /** MAX(estimated − actual, 0) — budget left, never negative. Null when unestimated. */
  remainingHours: number | null;
  /** actual ÷ estimated × 100. Null when nothing was estimated. */
  consumedPct: number | null;
  /** actual − estimated. Null when nothing was estimated. */
  varianceHours: number | null;
  severity: EffortSeverity;
}

/**
 * Four levels rather than three: "approaching the budget" and "past it" are
 * different conversations, and both happen before "way past it".
 */
export type EffortSeverity = "none" | "on_track" | "warning" | "over" | "critical";
