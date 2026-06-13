// ============================================================================
// ProjectOps360° — Reports & Intelligence (Project Intelligence Studio)
// Semantic reporting layer — types
// ============================================================================
// The reporting layer exposes curated, business-friendly DATASETS instead of
// raw tables. The UI and report builder only ever reference dataset/column
// keys defined here — never database table or column names.
// ============================================================================

export type ColumnType = "text" | "number" | "date" | "boolean" | "enum";

export type DatasetScope = "organization" | "project" | "portfolio";

export type DatasetCategory =
  | "executive"
  | "schedule"
  | "tasks"
  | "resources"
  | "materials"
  | "procurement"
  | "budget"
  | "risks"
  | "rfis"
  | "drawing"
  | "graph"
  | "ai"
  | "audit";

export type VisualizationType = "table" | "kpi_cards" | "bar" | "line" | "donut" | "pivot";

/** A curated, business-friendly column in a dataset. */
export interface DatasetColumn {
  key: string;            // stable business key, e.g. "task_name"
  label: string;          // human label, e.g. "Task Name"
  group: string;          // UI grouping, e.g. "Schedule"
  type: ColumnType;
  /** Enum option values (raw) → labels, for enum columns. */
  enumValues?: { value: string; label: string }[];
  filterable?: boolean;
  sortable?: boolean;
  groupable?: boolean;
  /** Numeric columns that can be summed/averaged. */
  aggregatable?: boolean;
  /** Short business definition for the Data Explorer / tooltips. */
  description?: string;
}

export interface DatasetDefinition {
  id: string;
  displayName: string;
  description: string;
  category: DatasetCategory;
  scope: DatasetScope;
  columns: DatasetColumn[];
  defaultColumns: string[];
  supportedVisualizations: VisualizationType[];
  /** Project types this dataset is most relevant to (UI emphasis only). */
  emphasizedFor?: string[];
}

// ── Filter / sort / group config (the report definition) ─────────────────────

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"
  | "date_before"
  | "date_after"
  | "date_between";

export interface ReportFilter {
  column: string;
  operator: FilterOperator;
  /** Single value, or [min,max] for between / date_between, or string[] for in/not_in. */
  value?: string | number | boolean | (string | number)[] | null;
}

export type AggregationFn = "count" | "count_distinct" | "sum" | "average" | "min" | "max";

export interface ReportGrouping {
  column: string;
  /** Metrics to compute per group. */
  metrics: { column: string; fn: AggregationFn; label?: string }[];
}

export interface ReportSort {
  column: string;
  direction: "asc" | "desc";
}

/** A user- or AI-defined column computed from a formula over numeric columns. */
export interface CalculatedField {
  key: string;        // generated, e.g. "calc_margin"
  label: string;      // human label
  expression: string; // formula text over dataset column keys
  /** "manual" or "ai" — provenance, shown in the UI. */
  source?: "manual" | "ai";
}

/** A complete report configuration — saved, run, and exported. */
export interface ReportConfig {
  datasetId: string;
  columns: string[];
  filters: ReportFilter[];
  grouping: ReportGrouping | null;
  sort: ReportSort[];
  visualization: VisualizationType;
  /** Calculated columns added on top of the dataset's curated columns. */
  calculatedFields?: CalculatedField[];
}

/** A prebuilt report definition (configuration-driven, not page logic). */
export interface PrebuiltReport {
  id: string;
  name: string;
  description: string;
  category: DatasetCategory;
  datasetId: string;
  config: Omit<ReportConfig, "datasetId">;
}

// ── Runtime row shape ─────────────────────────────────────────────────────────

export type ReportRow = Record<string, string | number | boolean | null>;

export interface ReportResult {
  columns: DatasetColumn[];
  rows: ReportRow[];
  totalRows: number;
  /** When grouping is applied, the aggregated rows. */
  grouped?: ReportRow[];
  durationMs: number;
  truncated: boolean;
}
