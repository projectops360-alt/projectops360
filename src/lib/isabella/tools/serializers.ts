// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · result serializers
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// The ONLY shapes handed back to the LLM. Rows are sanitized to a display-safe
// whitelist (names + opaque refs, never raw DB ids/payloads) and truncated to a
// safe limit. No `project_event_log`, no Supabase payloads, no secrets. Pure.
// ============================================================================

import type { TaskReportRow } from "@/lib/isabella/task-report";
import type { GroupBucket } from "@/lib/isabella/query-engine/filter-engine";

export type ToolStatus =
  | "success"
  | "empty"
  | "unauthorized"
  | "missing_context"
  | "unsupported_entity"
  | "invalid_args"
  | "unavailable";

/** A display-safe task row for the LLM (no raw ids/payloads). */
export interface SafeTaskRow {
  ref: string; // opaque, e.g. "task:<id>"
  title: string;
  status: string;
  priority: string | null;
  milestone: string | null;
  owner: string | null;
  dueDate: string | null;
  isSubtask: boolean;
}

export interface ToolResult {
  status: ToolStatus;
  entity?: string;
  rows?: SafeTaskRow[];
  rowCount: number;
  truncated: boolean;
  appliedFilters?: Record<string, unknown>;
  appliedSort?: Array<Record<string, unknown>>;
  grouping?: { field: string; buckets: Array<{ key: string; count: number }> } | null;
  evidenceRefs?: string[];
  citations?: Array<{ label: string; entityType: string; title: string; ref?: string | null }>;
  limitations?: string[];
  message?: string;
}

/** Map canonical task rows to display-safe rows (drops raw ids/payloads). */
export function sanitizeTaskRows(rows: TaskReportRow[], limit: number): { rows: SafeTaskRow[]; truncated: boolean } {
  const truncated = rows.length > limit;
  const safe = rows.slice(0, limit).map((r) => ({
    ref: `task:${r.id}`,
    title: r.title,
    status: r.status,
    priority: r.priority ?? null,
    milestone: r.milestoneTitle ?? null,
    owner: r.ownerName ?? null,
    dueDate: r.dueDate ?? null,
    isSubtask: r.isSubtask,
  }));
  return { rows: safe, truncated };
}

/** Serialize grouped buckets compactly (counts only). */
export function sanitizeGroups(field: string, buckets: GroupBucket[]): ToolResult["grouping"] {
  return { field, buckets: buckets.map((b) => ({ key: b.key, count: b.rows.length })) };
}

/** A safe empty/failure result — never invents rows. */
export function toolFailure(status: ToolStatus, message: string, entity?: string): ToolResult {
  return { status, entity, rowCount: 0, truncated: false, message };
}
