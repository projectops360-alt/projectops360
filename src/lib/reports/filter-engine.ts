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
export const OPERATORS_BY_TYPE: Record<ColumnType, FilterOperator[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between", "in", "not_in", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "date_before", "date_after", "date_on_or_before", "date_on_or_after", "date_between", "is_empty", "is_not_empty"],
  boolean: ["equals", "not_equals", "is_empty", "is_not_empty"],
  enum: ["equals", "not_equals", "contains", "in", "not_in", "is_empty", "is_not_empty"],
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

// ── Wildcards (the in-memory equivalent of SQL ILIKE) ────────────────────────

/** `*` = any run of characters, `?` = exactly one. Everything else is literal. */
export function hasWildcard(value: unknown): boolean {
  return typeof value === "string" && /[*?]/.test(value);
}

const REGEX_SPECIALS = /[.+^${}()|[\]\\]/g;

/**
 * Compile a user pattern into a case-insensitive RegExp.
 * `anchor: "full"` behaves like `ILIKE 'x'`, `"start"` like `ILIKE 'x%'`,
 * `"end"` like `ILIKE '%x'`, `"loose"` like `ILIKE '%x%'`.
 */
function globToRegExp(pattern: string, anchor: "full" | "start" | "end" | "loose"): RegExp {
  const body = pattern
    .replace(REGEX_SPECIALS, "\\$&")   // escape regex metachars, leaving * and ?
    .replace(/\*/g, "[\\s\\S]*")
    .replace(/\?/g, "[\\s\\S]");
  const prefix = anchor === "full" || anchor === "start" ? "^" : "";
  const suffix = anchor === "full" || anchor === "end" ? "$" : "";
  return new RegExp(`${prefix}${body}${suffix}`, "i");
}

function textValue(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Equality that honours wildcards — used by equals/not_equals/in/not_in. */
function makeEqualityTest(value: unknown): (str: string) => boolean {
  const needle = textValue(value);
  if (hasWildcard(needle)) {
    const re = globToRegExp(needle, "full");
    return (str) => re.test(str);
  }
  const lower = needle.toLowerCase();
  return (str) => str.toLowerCase() === lower;
}

/** Substring/prefix/suffix test that honours wildcards. */
function makeTextTest(value: unknown, anchor: "start" | "end" | "loose"): (str: string) => boolean {
  const needle = textValue(value);
  if (hasWildcard(needle)) {
    const re = globToRegExp(needle, anchor);
    return (str) => re.test(str);
  }
  const lower = needle.toLowerCase();
  if (anchor === "start") return (str) => str.toLowerCase().startsWith(lower);
  if (anchor === "end") return (str) => str.toLowerCase().endsWith(lower);
  return (str) => str.toLowerCase().includes(lower);
}

// ── Filter compilation ───────────────────────────────────────────────────────

type Predicate = (row: ReportRow) => boolean;

const NEVER: Predicate = () => false;

/**
 * Compile one filter into a row predicate. Patterns, numbers and dates are
 * parsed ONCE here instead of per row, so adding filters stays O(rows) with a
 * small constant regardless of how many filters the report carries.
 */
function compileFilter(filter: ReportFilter, type: ColumnType | undefined): Predicate {
  const col = filter.column;
  const op = filter.operator;
  const val = filter.value;

  if (op === "is_empty") return (row) => { const r = row[col] ?? null; return r === null || r === ""; };
  if (op === "is_not_empty") return (row) => { const r = row[col] ?? null; return r !== null && r !== ""; };

  const asBool = (v: unknown) => v === true || v === "true";

  switch (op) {
    case "equals":
    case "not_equals": {
      const negate = op === "not_equals";
      // Numeric columns compare numerically so 30 === "30.0".
      if (type === "number" && !hasWildcard(val)) {
        const b = asNumber(val);
        if (b === null) return NEVER;
        return (row) => { const a = asNumber(row[col]); return a !== null && (negate ? a !== b : a === b); };
      }
      const test = makeEqualityTest(val);
      return (row) => {
        const raw = row[col] ?? null;
        if (typeof raw === "boolean") return negate ? raw !== asBool(val) : raw === asBool(val);
        const hit = test(textValue(raw));
        return negate ? !hit : hit;
      };
    }
    case "contains":
    case "not_contains": {
      const test = makeTextTest(val, "loose");
      const negate = op === "not_contains";
      return (row) => { const hit = test(textValue(row[col])); return negate ? !hit : hit; };
    }
    case "starts_with": {
      const test = makeTextTest(val, "start");
      return (row) => test(textValue(row[col]));
    }
    case "ends_with": {
      const test = makeTextTest(val, "end");
      return (row) => test(textValue(row[col]));
    }
    case "in":
    case "not_in": {
      const negate = op === "not_in";
      const list = Array.isArray(val) ? val : val === null || val === undefined || val === "" ? [] : [val];
      if (list.length === 0) return NEVER;
      const tests = list.map((v) => makeEqualityTest(v));
      return (row) => {
        const str = textValue(row[col]);
        const hit = tests.some((t) => t(str));
        return negate ? !hit : hit;
      };
    }
    case "greater_than":
    case "greater_than_or_equal":
    case "less_than":
    case "less_than_or_equal": {
      const b = asNumber(val);
      if (b === null) return NEVER;
      return (row) => {
        const a = asNumber(row[col]);
        if (a === null) return false;
        if (op === "greater_than") return a > b;
        if (op === "greater_than_or_equal") return a >= b;
        if (op === "less_than") return a < b;
        return a <= b;
      };
    }
    case "between": {
      if (!Array.isArray(val)) return NEVER;
      const lo = asNumber(val[0]), hi = asNumber(val[1]);
      if (lo === null || hi === null) return NEVER;
      // Tolerate reversed bounds ("between 60 and 30") instead of returning nothing.
      const min = Math.min(lo, hi), max = Math.max(lo, hi);
      return (row) => { const a = asNumber(row[col]); return a !== null && a >= min && a <= max; };
    }
    case "date_before":
    case "date_after":
    case "date_on_or_before":
    case "date_on_or_after": {
      const b = asTime(val);
      if (b === null) return NEVER;
      return (row) => {
        const a = asTime(row[col]);
        if (a === null) return false;
        if (op === "date_before") return a < b;
        if (op === "date_after") return a > b;
        if (op === "date_on_or_before") return a <= b;
        return a >= b;
      };
    }
    case "date_between": {
      if (!Array.isArray(val)) return NEVER;
      const lo = asTime(val[0]), hi = asTime(val[1]);
      if (lo === null || hi === null) return NEVER;
      const min = Math.min(lo, hi), max = Math.max(lo, hi);
      return (row) => { const a = asTime(row[col]); return a !== null && a >= min && a <= max; };
    }
    default:
      return () => true;
  }
}

/** Operators that pick a value out of a set — repeating them reads as "or". */
const MEMBERSHIP_OPS = new Set<FilterOperator>(["equals", "in"]);

/**
 * Apply filters: AND across different columns, OR between repeated membership
 * filters on the SAME column. So `Owner = Paul*` + `Owner = Marta` matches
 * either person, while `Project = Agro*` + `Owner = Paul*` requires both —
 * which is what a report builder with only an "Add filter" button can express.
 *
 * `columns` is optional but recommended: it lets numeric/date columns compare
 * by value instead of by string.
 */
export function applyFilters(rows: ReportRow[], filters: ReportFilter[], columns?: DatasetColumn[]): ReportRow[] {
  if (filters.length === 0) return rows;
  const typeByKey = new Map((columns ?? []).map((c) => [c.key, c.type]));

  // Patterns compile once here, never per row.
  const required: Predicate[] = [];
  const anyOfByColumn = new Map<string, Predicate[]>();
  for (const f of filters) {
    const predicate = compileFilter(f, typeByKey.get(f.column));
    if (MEMBERSHIP_OPS.has(f.operator)) {
      const group = anyOfByColumn.get(f.column) ?? [];
      group.push(predicate);
      anyOfByColumn.set(f.column, group);
    } else {
      required.push(predicate);
    }
  }
  const anyOfGroups = [...anyOfByColumn.values()];

  return rows.filter((row) =>
    required.every((p) => p(row)) && anyOfGroups.every((group) => group.some((p) => p(row))),
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
