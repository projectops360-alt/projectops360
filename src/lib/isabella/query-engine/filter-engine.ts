// ============================================================================
// ProjectOps360° — Isabella Query Engine · deterministic filter/sort/group
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// Applies a validated plan's filters/sort/grouping to already-retrieved,
// RBAC-scoped task rows. PURE + deterministic — the LLM never filters or sorts.
// The "no milestone" case is just `milestone is_null` here — no special phrase.
// ============================================================================

import type { TaskReportRow } from "@/lib/isabella/task-report";
import { sortTaskReportRows } from "@/lib/isabella/task-report";
import type { QueryFilter, QuerySort } from "./query-plan";

/** Relative-date tokens the parser may emit; resolved here against `asOf`. */
export type RelativeDateToken = "today";

export interface FilterContext {
  /** Deterministic "now" for relative date filters (e.g. overdue). */
  asOf: string; // ISO date (YYYY-MM-DD ok)
}

/** The underlying value used for NULL checks (ref fields check the id). */
function nullCheckValue(row: TaskReportRow, field: string): unknown {
  switch (field) {
    case "milestone": return row.milestoneId;
    case "owner": return row.ownerId;
    case "dueDate": return row.dueDate;
    case "blocked": return row.isBlocked;
    case "subtask": return row.isSubtask;
    case "updatedAt": return row.updatedAt;
    case "createdAt": return row.createdAt;
    case "status": return row.status;
    case "priority": return row.priority;
    case "title": return row.title;
    default: return undefined;
  }
}

/** The value used for comparisons/sort/group (ref fields compare the title/name). */
function compareValue(row: TaskReportRow, field: string): string | null {
  switch (field) {
    case "title": return row.title || null;
    case "status": return row.status;
    case "milestone": return row.milestoneTitle || null;
    case "priority": return row.priority;
    case "owner": return row.ownerName || null;
    case "dueDate": return row.dueDate;
    case "updatedAt": return row.updatedAt;
    case "createdAt": return row.createdAt;
    default: return null;
  }
}

function resolveDate(value: unknown, ctx: FilterContext): string | null {
  if (value === "today") return ctx.asOf.slice(0, 10);
  if (typeof value === "string" && value) return value.slice(0, 10);
  return null;
}

function matchesFilter(row: TaskReportRow, filter: QueryFilter, ctx: FilterContext): boolean {
  const { field, operator, value } = filter;

  // NULL checks operate on the underlying id/value.
  if (operator === "is_null" || operator === "is_not_null") {
    const v = nullCheckValue(row, field);
    const isNull = v == null || v === "";
    return operator === "is_null" ? isNull : !isNull;
  }

  // Boolean fields.
  if (field === "blocked" || field === "subtask") {
    const actual = field === "blocked" ? row.isBlocked : row.isSubtask;
    const want = value === true || value === "true";
    if (operator === "equals") return actual === want;
    if (operator === "not_equals") return actual !== want;
    return false;
  }

  const cmp = compareValue(row, field);

  switch (operator) {
    case "equals":
      return cmp != null && String(cmp).toLowerCase() === String(value).toLowerCase();
    case "not_equals":
      return cmp == null || String(cmp).toLowerCase() !== String(value).toLowerCase();
    case "contains":
      return cmp != null && cmp.toLowerCase().includes(String(value).toLowerCase());
    case "not_contains":
      return cmp == null || !cmp.toLowerCase().includes(String(value).toLowerCase());
    case "in":
      return Array.isArray(value) && cmp != null && value.map((x) => x.toLowerCase()).includes(cmp.toLowerCase());
    case "not_in":
      return !Array.isArray(value) || cmp == null || !value.map((x) => x.toLowerCase()).includes(cmp.toLowerCase());
    case "before":
    case "after":
    case "on_or_before":
    case "on_or_after":
    case "greater_than":
    case "less_than": {
      const target = resolveDate(value, ctx);
      if (cmp == null || target == null) return false;
      const a = cmp.slice(0, 10);
      if (operator === "before" || operator === "less_than") return a < target;
      if (operator === "after" || operator === "greater_than") return a > target;
      if (operator === "on_or_before") return a <= target;
      return a >= target; // on_or_after
    }
    default:
      return false;
  }
}

/** AND all filters. Deterministic, side-effect free. */
export function applyFilters(rows: TaskReportRow[], filters: QueryFilter[], ctx: FilterContext): TaskReportRow[] {
  if (filters.length === 0) return [...rows];
  return rows.filter((r) => filters.every((f) => matchesFilter(r, f, ctx)));
}

/** Deterministic multi-key sort (reuses the shipped title/status/… comparator). */
export function applySort(rows: TaskReportRow[], sort: QuerySort[]): TaskReportRow[] {
  if (sort.length === 0) return [...rows];
  // Apply least-significant first for a stable multi-key sort; the shipped
  // sortTaskReportRows carries the stable tie-breaker (createdAt DESC, id ASC).
  let out = [...rows];
  for (let i = sort.length - 1; i >= 0; i--) {
    const s = sort[i];
    out = sortTaskReportRows(out, mapSortField(s.field), s.direction);
  }
  return out;
}

/** Map a catalog field to the shipped sort vocabulary (superset-safe). */
function mapSortField(field: string): Parameters<typeof sortTaskReportRows>[1] {
  switch (field) {
    case "title": return "title";
    case "status": return "status";
    case "priority": return "priority";
    case "milestone": return "milestone";
    case "dueDate": return "due";
    case "updatedAt": return "updated";
    case "createdAt": return "created";
    default: return "title";
  }
}

export interface GroupBucket {
  key: string;
  rows: TaskReportRow[];
}

/** Group rows by a field's compare value; a null value becomes an explicit key. */
export function applyGrouping(rows: TaskReportRow[], groupBy: string): GroupBucket[] {
  const buckets = new Map<string, TaskReportRow[]>();
  for (const r of rows) {
    const v = compareValue(r, groupBy);
    const key = v == null || v === "" ? "__none__" : v;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  return [...buckets.entries()]
    .map(([key, rs]) => ({ key, rows: rs }))
    .sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.key.localeCompare(b.key, undefined, { sensitivity: "base" });
    });
}
