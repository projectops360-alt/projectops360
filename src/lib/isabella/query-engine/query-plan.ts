// ============================================================================
// ProjectOps360° — Isabella Generic Project-Data Query Engine · plan contract
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// A SAFE, deterministic query plan. Natural language is transformed into this
// plan; the plan is VALIDATED against the semantic catalog; only a valid plan is
// executed by an approved server-side adapter. The LLM never decides data and
// never sorts/filters rows. Pure types + validation — no retrieval, no LLM.
// ============================================================================

/** Entities the engine understands. `task` is wired; others are catalog-declared. */
export type QueryEntity =
  | "task"
  | "subtask"
  | "milestone"
  | "risk"
  | "decision"
  | "approval";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "is_null"
  | "is_not_null"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after"
  | "greater_than"
  | "less_than";

export type QueryFilterValue = string | number | boolean | string[] | null;

export interface QueryFilter {
  /** Canonical field name (never a raw column) — validated against the catalog. */
  field: string;
  operator: FilterOperator;
  value?: QueryFilterValue;
}

export interface QuerySort {
  field: string;
  direction: "asc" | "desc";
}

export type QueryAggregation = "list" | "count" | "grouped_list";

/** The one shape the parser produces and the adapter consumes. */
export interface IsabellaProjectQueryPlan {
  intent: "deterministic_project_report";
  entity: QueryEntity;
  selectedFields: string[];
  filters: QueryFilter[];
  sort: QuerySort[];
  groupBy: string | null;
  aggregation: QueryAggregation;
  limit: number;
  language: "en" | "es";
  requiresClarification: boolean;
  clarificationQuestion: string | null;
}

export const NULLARY_OPERATORS: ReadonlySet<FilterOperator> = new Set(["is_null", "is_not_null"]);

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];
}
