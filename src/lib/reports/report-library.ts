// ============================================================================
// ProjectOps360° — Prebuilt Report Library (configuration-driven)
// ============================================================================
// Reports are data, not page logic. Each entry is a ReportConfig over a
// curated dataset, so the library expands by adding objects here.
// ============================================================================

import type { PrebuiltReport } from "./types";

export const PREBUILT_REPORTS: PrebuiltReport[] = [
  // ── Executive ──────────────────────────────────────────────────────────────
  {
    id: "project_health_report",
    name: "Project Health Report",
    description: "Status, progress, and open risk areas for every project.",
    category: "executive",
    datasetId: "project_health",
    config: {
      columns: ["project_name", "project_type", "status", "progress_pct", "blocked_tasks", "open_risks", "open_rfis"],
      filters: [],
      grouping: null,
      sort: [{ column: "progress_pct", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "at_risk_projects",
    name: "At-Risk Projects",
    description: "Projects with blocked tasks or open risks that need leadership attention.",
    category: "executive",
    datasetId: "project_health",
    config: {
      columns: ["project_name", "status", "progress_pct", "blocked_tasks", "open_risks"],
      filters: [{ column: "blocked_tasks", operator: "greater_than", value: 0 }],
      grouping: null,
      sort: [{ column: "blocked_tasks", direction: "desc" }],
      visualization: "table",
    },
  },

  // ── Schedule & Task Execution ────────────────────────────────────────────────
  {
    id: "task_status_report",
    name: "Task Status Report",
    description: "All tasks grouped by status with owner and finish date.",
    category: "tasks",
    datasetId: "task_execution",
    config: {
      columns: ["project_name", "milestone", "task_name", "status", "owner", "planned_finish", "blocked", "critical_path"],
      filters: [],
      grouping: null,
      sort: [{ column: "planned_finish", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "open_tasks_report",
    name: "Open Tasks Report",
    description: "Everything not yet done — what's still on the table.",
    category: "tasks",
    datasetId: "task_execution",
    config: {
      columns: ["project_name", "milestone", "task_name", "status", "owner", "priority", "planned_finish"],
      filters: [{ column: "status", operator: "not_in", value: ["done", "tested", "deferred"] }],
      grouping: null,
      sort: [{ column: "priority", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "blocked_tasks_report",
    name: "Blocked Tasks Report",
    description: "Tasks on hold, with the reason and whether they sit on the critical path.",
    category: "tasks",
    datasetId: "task_execution",
    config: {
      columns: ["project_name", "task_name", "owner", "blocker_reason", "critical_path", "planned_finish"],
      filters: [{ column: "blocked", operator: "equals", value: true }],
      grouping: null,
      sort: [{ column: "critical_path", direction: "desc" }],
      visualization: "table",
    },
  },
  {
    id: "tasks_without_owner",
    name: "Tasks Without Owner",
    description: "Open work that has nobody assigned yet.",
    category: "tasks",
    datasetId: "task_execution",
    config: {
      columns: ["project_name", "milestone", "task_name", "status", "planned_finish"],
      filters: [
        { column: "owner", operator: "is_empty" },
        { column: "status", operator: "not_in", value: ["done", "tested", "deferred"] },
      ],
      grouping: null,
      sort: [{ column: "planned_finish", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "tasks_by_status",
    name: "Tasks by Status",
    description: "Count of tasks in each status.",
    category: "tasks",
    datasetId: "task_execution",
    config: {
      columns: ["project_name", "task_name", "status"],
      filters: [],
      grouping: { column: "status", metrics: [{ column: "task_name", fn: "count", label: "Tasks" }] },
      sort: [],
      visualization: "bar",
    },
  },
  {
    id: "critical_path_report",
    name: "Critical Path Report",
    description: "The tasks that drive the finish date.",
    category: "schedule",
    datasetId: "task_execution",
    config: {
      columns: ["project_name", "task_name", "owner", "planned_start", "planned_finish", "total_float", "blocked"],
      filters: [{ column: "critical_path", operator: "equals", value: true }],
      grouping: null,
      sort: [{ column: "planned_start", direction: "asc" }],
      visualization: "table",
    },
  },

  // ── Budget ──────────────────────────────────────────────────────────────────
  {
    id: "budget_vs_actual",
    name: "Budget vs Actual Report",
    description: "Estimated, actual, forecast cost and variance per budget item.",
    category: "budget",
    datasetId: "budget_performance",
    config: {
      columns: ["project_name", "budget_item", "category", "estimated_cost", "actual_cost", "forecast_cost", "variance", "variance_pct"],
      filters: [],
      grouping: null,
      sort: [{ column: "variance", direction: "desc" }],
      visualization: "table",
    },
  },
  {
    id: "cost_by_category",
    name: "Cost by Category",
    description: "Estimated cost summed by budget category.",
    category: "budget",
    datasetId: "budget_performance",
    config: {
      columns: ["project_name", "budget_item", "category", "estimated_cost"],
      filters: [],
      grouping: { column: "category", metrics: [{ column: "estimated_cost", fn: "sum", label: "Estimated Cost" }] },
      sort: [],
      visualization: "bar",
    },
  },
  {
    id: "cost_overrun_risk",
    name: "Cost Overrun Risk",
    description: "Budget items forecast or trending above estimate.",
    category: "budget",
    datasetId: "budget_performance",
    config: {
      columns: ["project_name", "budget_item", "estimated_cost", "forecast_cost", "variance", "variance_pct"],
      filters: [{ column: "variance", operator: "greater_than", value: 0 }],
      grouping: null,
      sort: [{ column: "variance_pct", direction: "desc" }],
      visualization: "table",
    },
  },

  // ── Risks ─────────────────────────────────────────────────────────────────
  {
    id: "risk_register_report",
    name: "Risk Register",
    description: "All risks with severity, status, and mitigation.",
    category: "risks",
    datasetId: "risk_register",
    config: {
      columns: ["project_name", "risk_title", "category", "severity", "status", "mitigation"],
      filters: [],
      grouping: null,
      sort: [{ column: "severity", direction: "desc" }],
      visualization: "table",
    },
  },
  {
    id: "top_risks",
    name: "Top Project Risks",
    description: "Open high and critical risks.",
    category: "risks",
    datasetId: "risk_register",
    config: {
      columns: ["project_name", "risk_title", "category", "severity", "status"],
      filters: [
        { column: "severity", operator: "in", value: ["high", "critical"] },
        { column: "status", operator: "in", value: ["open", "mitigating"] },
      ],
      grouping: null,
      sort: [{ column: "severity", direction: "desc" }],
      visualization: "table",
    },
  },
  {
    id: "risks_by_severity",
    name: "Risks by Severity",
    description: "Count of risks at each severity level.",
    category: "risks",
    datasetId: "risk_register",
    config: {
      columns: ["project_name", "risk_title", "severity"],
      filters: [],
      grouping: { column: "severity", metrics: [{ column: "risk_title", fn: "count", label: "Risks" }] },
      sort: [],
      visualization: "donut",
    },
  },

  // ── Materials ─────────────────────────────────────────────────────────────
  {
    id: "material_requirements_report",
    name: "Material Requirements Report",
    description: "Materials needed, with quantity, status, and required-by date.",
    category: "materials",
    datasetId: "material_requirements",
    config: {
      columns: ["project_name", "material_name", "quantity", "unit", "status", "required_by_date", "origin"],
      filters: [],
      grouping: null,
      sort: [{ column: "required_by_date", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "delayed_materials",
    name: "Delayed / Unavailable Materials",
    description: "Materials that are delayed or unavailable.",
    category: "materials",
    datasetId: "material_requirements",
    config: {
      columns: ["project_name", "material_name", "status", "required_by_date", "lead_time_days"],
      filters: [{ column: "status", operator: "in", value: ["delayed", "unavailable"] }],
      grouping: null,
      sort: [{ column: "required_by_date", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "drawing_derived_materials",
    name: "Drawing-Derived Materials",
    description: "Materials extracted from drawings that may need review.",
    category: "materials",
    datasetId: "material_requirements",
    config: {
      columns: ["project_name", "material_name", "quantity", "unit", "confidence_pct", "needs_review"],
      filters: [{ column: "origin", operator: "equals", value: "drawing_extraction" }],
      grouping: null,
      sort: [{ column: "confidence_pct", direction: "asc" }],
      visualization: "table",
    },
  },

  // ── RFIs ──────────────────────────────────────────────────────────────────
  {
    id: "rfi_log_report",
    name: "RFI Log",
    description: "All RFIs with status, priority, and due date.",
    category: "rfis",
    datasetId: "rfi_log",
    config: {
      columns: ["project_name", "rfi_number", "subject", "status", "priority", "due_date", "blocks_work"],
      filters: [],
      grouping: null,
      sort: [{ column: "due_date", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "open_rfis",
    name: "Open RFIs",
    description: "RFIs still awaiting an answer.",
    category: "rfis",
    datasetId: "rfi_log",
    config: {
      columns: ["project_name", "rfi_number", "subject", "priority", "due_date", "blocks_work"],
      filters: [{ column: "status", operator: "in", value: ["draft", "open"] }],
      grouping: null,
      sort: [{ column: "due_date", direction: "asc" }],
      visualization: "table",
    },
  },
  {
    id: "rfis_blocking_work",
    name: "RFIs Blocking Work",
    description: "Open RFIs that are holding up tasks.",
    category: "rfis",
    datasetId: "rfi_log",
    config: {
      columns: ["project_name", "rfi_number", "subject", "status", "priority"],
      filters: [{ column: "blocks_work", operator: "equals", value: true }],
      grouping: null,
      sort: [{ column: "priority", direction: "desc" }],
      visualization: "table",
    },
  },
];

export function listPrebuiltReports(): PrebuiltReport[] {
  return PREBUILT_REPORTS;
}

export function getPrebuiltReport(id: string): PrebuiltReport | null {
  return PREBUILT_REPORTS.find((r) => r.id === id) ?? null;
}
