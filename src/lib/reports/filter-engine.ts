// ============================================================================
// ProjectOps360° — Report Filter / Sort / Aggregation Engine (pure)
// ============================================================================
// Operates on already-fetched, org/project-scoped business rows. No SQL is
// built from user input — filters are applied in memory against curated
// columns, so there is no injection surface. Pure + fully testable.
// ============================================================================

import type {
  DatasetColumn,
  ReportFilter,
  ReportSort,
  ReportGrouping,
  ReportRow,
  FilterOperator,
  ColumnType,
} from "./types";

// ── Validation ────────────────────────────────────────────────────────────────

/** Operators allowed per column type. */
const OPERATORS_BY_TYPE: Record<ColumnType, FilterOperator[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between", "in", "not_in", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "date_before", "date_after", "date_between", "is_empty", "is_not_empty"],
  boolean: ["equals", "not_equals", "is_empty", "is_not_empty"],
  enum: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
};

export interface FilterValidationError {
  index: number;
  message: string;
}

/** Validate filters against the dataset columns. Returns [] when all valid. */
export function validateFilters(filters: ReportFilter[], columns: DatasetColumn[]): FilterValidationError[] {
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const errors: FilterValidationError[] = [];
  filters.forEach((f, i) => {
    const col = byKey.get(f.column);
    if (!col) {
      errors.push({ index: i, message: `Unknown column "${f.column}".` });
      return;
    }
    if (col.filterable === false) {
      errors.push({ index: i, message: `Column "${col.label}" is not filterable.` });
      return;
    }
    if (!OPERATORS_BY_TYPE[col.type].includes(f.operator)) {
      errors.push({ index: i, message: `Operator "${f.operator}" is not valid for ${col.type} column "${col.label}".` });
      return;
    }
    const needsValue = !["is_empty", "is_not_empty"].includes(f.operator);
    if (needsValue && (f.value === undefined || f.value === null || f.value === "")) {
      errors.push({ index: i, message: `Filter on "${col.label}" needs a value.` });
    }
    if ((f.operator === "between" || f.operator === "date_between") && (!Array.isArray(f.value) || f.value.length !== 2)) {
      errors.push({ index: i, message: `"${col.label}" range filter needs two values.` });
    }
  });
  return errors;
}

// ── Predicate evaluation ────────────────────────────────────────────────────

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function asTime(v: unknown): number | null {
  if (!v) return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

type TextMatchMode = "equals" | "contains" | "starts_with" | "ends_with";

function matchesText(raw: unknown, value: unknown, mode: TextMatchMode): boolean {
  const input = raw === null || raw === undefined ? "" : String(raw);
  const pattern = value === null || value === undefined ? "" : String(value);
  const hasWildcard = pattern.includes("*") || pattern.includes("?");

  if (!hasWildcard) {
    const normalizedInput = input.toLowerCase();
    const normalizedPattern = pattern.toLowerCase();
    if (mode === "contains") return normalizedInput.includes(normalizedPattern);
    if (mode === "starts_with") return normalizedInput.startsWith(normalizedPattern);
    if (mode === "ends_with") return normalizedInput.endsWith(normalizedPattern);
    return normalizedInput === normalizedPattern;
  }

  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*+/g, ".*")
    .replace(/\?/g, ".");
  const prefix = mode === "equals" || mode === "starts_with" ? "^" : "";
  const suffix = mode === "equals" || mode === "ends_with" ? "$" : "";
  return new RegExp(`${prefix}${escaped}${suffix}`, "i").test(input);
}

function matchesFilter(row: ReportRow, filter: ReportFilter): boolean {
  const raw = row[filter.column] ?? null;
  const op = filter.operator;

  if (op === "is_empty") return raw === null || raw === "";
  if (op === "is_not_empty") return raw !== null && raw !== "";

  const val = filter.value;

  switch (op) {
    case "equals":
      if (typeof raw === "boolean") return raw === (val === true || val === "true");
      return matchesText(raw, val, "equals");
    case "not_equals":
      if (typeof raw === "boolean") return raw !== (val === true || val === "true");
      return !matchesText(raw, val, "equals");
    case "contains": return matchesText(raw, val, "contains");
    case "not_contains": return !matchesText(raw, val, "contains");
    case "starts_with": return matchesText(raw, val, "starts_with");
    case "ends_with": return matchesText(raw, val, "ends_with");
    case "in": return Array.isArray(val) && val.some((candidate) => matchesText(raw, candidate, "equals"));
    case "not_in": return Array.isArray(val) && val.every((candidate) => !matchesText(raw, candidate, "equals"));
    case "greater_than": { const a = asNumber(raw), b = asNumber(val); return a !== null && b !== null && a > b; }
    case "greater_than_or_equal": { const a = asNumber(raw), b = asNumber(val); return a !== null && b !== null && a >= b; }
    case "less_than": { const a = asNumber(raw), b = asNumber(val); return a !== null && b !== null && a < b; }
    case "less_than_or_equal": { const a = asNumber(raw), b = asNumber(val); return a !== null && b !== null && a <= b; }
    case "between": {
      const a = asNumber(raw);
      if (a === null || !Array.isArray(val)) return false;
      const lo = asNumber(val[0]), hi = asNumber(val[1]);
      return lo !== null && hi !== null && a >= lo && a <= hi;
    }
    case "date_before": { const a = asTime(raw), b = asTime(val); return a !== null && b !== null && a < b; }
    case "date_after": { const a = asTime(raw), b = asTime(val); return a !== null && b !== null && a > b; }
    case "date_between": {
      const a = asTime(raw);
      if (a === null || !Array.isArray(val)) return false;
      const lo = asTime(val[0]), hi = asTime(val[1]);
      return lo !== null && hi !== null && a >= lo && a <= hi;
    }
    default: return true;
  }
}

/**
 * Apply filters with AND semantics across columns and constraints. Repeated
 * positive membership filters (`equals` / `in`) on the same column are
 * alternatives, so Project=A + Project=B behaves as Project IN (A, B).
 */
export function applyFilters(rows: ReportRow[], filters: ReportFilter[]): ReportRow[] {
  if (filters.length === 0) return rows;

  const alternativesByColumn = new Map<string, ReportFilter[]>();
  const constraints: ReportFilter[] = [];

  for (const filter of filters) {
    if (filter.operator === "equals" || filter.operator === "in") {
      const alternatives = alternativesByColumn.get(filter.column) ?? [];
      alternatives.push(filter);
      alternativesByColumn.set(filter.column, alternatives);
    } else {
      constraints.push(filter);
    }
  }

  return rows.filter((row) =>
    constraints.every((filter) => matchesFilter(row, filter))
    && Array.from(alternativesByColumn.values()).every((alternatives) =>
      alternatives.some((filter) => matchesFilter(row, filter)),
    ),
  );
}

// ── Sorting ─────────────────────────────────────────────────────────────────

export function applySort(rows: ReportRow[], sorts: ReportSort[], columns: DatasetColumn[]): ReportRow[] {
  if (sorts.length === 0) return rows;
  const typeByKey = new Map(columns.map((c) => [c.key, c.type]));
  return [...rows].sort((ra, rb) => {
    for (const s of sorts) {
      const type = typeByKey.get(s.column);
      const a = ra[s.column], b = rb[s.column];
      let cmp = 0;
      if (a === null || a === undefined) cmp = b === null || b === undefined ? 0 : 1;
      else if (b === null || b === undefined) cmp = -1;
      else if (type === "number") cmp = (asNumber(a) ?? 0) - (asNumber(b) ?? 0);
      else if (type === "date") cmp = (asTime(a) ?? 0) - (asTime(b) ?? 0);
      else cmp = String(a).localeCompare(String(b));
      if (cmp !== 0) return s.direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

// ── Aggregation / grouping ────────────────────────────────────────────────────

export function applyGrouping(rows: ReportRow[], grouping: ReportGrouping): ReportRow[] {
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = String(row[grouping.column] ?? "—");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const out: ReportRow[] = [];
  for (const [key, groupRows] of groups) {
    const aggregated: ReportRow = { [grouping.column]: key, group_count: groupRows.length };
    for (const metric of grouping.metrics) {
      const label = metric.label ?? `${metric.fn}_${metric.column}`;
      aggregated[label] = aggregate(groupRows, metric.column, metric.fn);
    }
    out.push(aggregated);
  }
  return out;
}

function aggregate(rows: ReportRow[], column: string, fn: string): number {
  switch (fn) {
    case "count": return rows.length;
    case "count_distinct": return new Set(rows.map((r) => r[column])).size;
    case "sum": return round(rows.reduce((s, r) => s + (asNumber(r[column]) ?? 0), 0));
    case "average": {
      const nums = rows.map((r) => asNumber(r[column])).filter((n): n is number => n !== null);
      return nums.length ? round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;
    }
    case "min": {
      const nums = rows.map((r) => asNumber(r[column])).filter((n): n is number => n !== null);
      return nums.length ? Math.min(...nums) : 0;
    }
    case "max": {
      const nums = rows.map((r) => asNumber(r[column])).filter((n): n is number => n !== null);
      return nums.length ? Math.max(...nums) : 0;
    }
    default: return 0;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── CSV serialization ─────────────────────────────────────────────────────────

/** RFC-4180 CSV. Columns are resolved to labels via the dataset metadata. */
export function rowsToCsv(rows: ReportRow[], columns: { key: string; label: string }[]): string {
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")).join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}
