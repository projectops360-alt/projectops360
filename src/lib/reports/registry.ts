// ============================================================================
// ProjectOps360° — Curated Semantic Dataset Registry
// ============================================================================
// The single source of truth for the curated datasets the Report Builder and
// Data Explorer expose. Column keys here are business-friendly and decoupled
// from database schema. Row fetching for each dataset lives in query-service.ts
// (server-only); this file is pure metadata so it can be imported anywhere.
// ============================================================================

import type { DatasetColumn, DatasetDefinition } from "./types";

const text = (key: string, label: string, group: string, extra: Partial<DatasetColumn> = {}): DatasetColumn => ({
  key, label, group, type: "text", filterable: true, sortable: true, groupable: true, ...extra,
});
const num = (key: string, label: string, group: string, extra: Partial<DatasetColumn> = {}): DatasetColumn => ({
  key, label, group, type: "number", filterable: true, sortable: true, aggregatable: true, ...extra,
});
const date = (key: string, label: string, group: string, extra: Partial<DatasetColumn> = {}): DatasetColumn => ({
  key, label, group, type: "date", filterable: true, sortable: true, ...extra,
});
const bool = (key: string, label: string, group: string, extra: Partial<DatasetColumn> = {}): DatasetColumn => ({
  key, label, group, type: "boolean", filterable: true, sortable: true, groupable: true, ...extra,
});
const enumCol = (key: string, label: string, group: string, values: { value: string; label: string }[], extra: Partial<DatasetColumn> = {}): DatasetColumn => ({
  key, label, group, type: "enum", enumValues: values, filterable: true, sortable: true, groupable: true, ...extra,
});

const TASK_STATUS_VALUES = [
  { value: "not_started", label: "Not started" },
  { value: "prompt_ready", label: "Prompt ready" },
  { value: "sent_to_ai", label: "Sent to AI" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "implemented", label: "Implemented" },
  { value: "tested", label: "Tested" },
  { value: "done", label: "Done" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
  { value: "cancelled", label: "Cancelled" },
  { value: "deferred", label: "Deferred" },
];
const PRIORITY_VALUES = [
  { value: "p1", label: "P1 — Critical" },
  { value: "p2", label: "P2 — Important" },
  { value: "p3", label: "P3 — Normal" },
];
const SEVERITY_VALUES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

// ── Datasets ──────────────────────────────────────────────────────────────────

export const DATASETS: DatasetDefinition[] = [
  // 1 — Project Health
  {
    id: "project_health",
    displayName: "Project Health",
    description: "Executive view of every project's status, progress, and open risk areas.",
    category: "executive",
    scope: "organization",
    columns: [
      text("project_name", "Project Name", "Identification"),
      enumCol("project_type", "Project Type", "Identification", [
        { value: "software_development", label: "Software" },
        { value: "data_center_construction", label: "Data Center" },
        { value: "residential_construction", label: "Residential" },
        { value: "commercial_construction", label: "Commercial" },
        { value: "infrastructure", label: "Infrastructure" },
        { value: "industrial", label: "Industrial" },
        { value: "general", label: "General" },
      ]),
      enumCol("status", "Status", "Status", [
        { value: "planning", label: "Planning" },
        { value: "active", label: "Active" },
        { value: "on_hold", label: "On hold" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ]),
      date("start_date", "Start Date", "Schedule"),
      date("target_finish", "Target Finish", "Schedule"),
      num("progress_pct", "Overall Progress %", "Progress"),
      num("total_tasks", "Total Tasks", "Progress"),
      num("done_tasks", "Completed Tasks", "Progress"),
      num("blocked_tasks", "Blocked Tasks", "Risk"),
      num("open_risks", "Open Risks", "Risk"),
      num("open_rfis", "Open RFIs", "Risk"),
    ],
    defaultColumns: ["project_name", "project_type", "status", "progress_pct", "blocked_tasks", "open_risks"],
    supportedVisualizations: ["table", "kpi_cards", "bar", "donut"],
  },

  // 2 — Task Execution
  {
    id: "task_execution",
    displayName: "Task Execution",
    description: "Day-to-day task control: status, owners, schedule, blockers, and critical path.",
    category: "tasks",
    scope: "project",
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("milestone", "Milestone", "Project Structure"),
      enumCol("record_type", "Record Type", "Project Structure", [
        { value: "task", label: "Task" },
        { value: "subtask", label: "Subtask" },
      ]),
      text("parent_task", "Parent Task", "Project Structure"),
      text("task_name", "Task Name", "Identification"),
      enumCol("status", "Status", "Status", TASK_STATUS_VALUES),
      enumCol("priority", "Priority", "Status", PRIORITY_VALUES),
      text("owner", "Owner", "Assignment"),
      text("trade", "Trade", "Assignment"),
      text("discipline", "Discipline", "Assignment"),
      date("planned_start", "Planned Start", "Schedule"),
      date("planned_finish", "Planned Finish", "Schedule"),
      num("duration_days", "Duration (days)", "Schedule"),
      num("progress_pct", "Progress %", "Schedule"),
      bool("blocked", "Blocked", "Risk"),
      text("blocker_reason", "Blocker Reason", "Risk", { groupable: false }),
      bool("critical_path", "On Critical Path", "Risk"),
      num("total_float", "Total Float (days)", "Risk"),
      num("estimated_hours", "Estimated Hours", "Effort"),
    ],
    defaultColumns: ["project_name", "milestone", "task_name", "status", "owner", "planned_finish", "blocked", "critical_path"],
    supportedVisualizations: ["table", "pivot", "kpi_cards", "bar"],
  },

  // 3 — Budget Performance
  {
    id: "budget_performance",
    displayName: "Budget Performance",
    description: "Project controls: estimated, committed, actual, and forecast cost with variance.",
    category: "budget",
    scope: "project",
    emphasizedFor: ["data_center_construction", "residential_construction", "commercial_construction", "infrastructure", "industrial"],
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("budget_item", "Budget Item", "Identification"),
      enumCol("category", "Category", "Identification", [
        { value: "labor", label: "Labor" },
        { value: "material", label: "Material" },
        { value: "equipment", label: "Equipment" },
        { value: "subcontractor", label: "Subcontractor" },
        { value: "software", label: "Software" },
        { value: "cloud", label: "Cloud" },
        { value: "permit", label: "Permit" },
        { value: "contingency", label: "Contingency" },
        { value: "other", label: "Other" },
      ]),
      text("cost_code", "Cost Code", "Identification"),
      num("estimated_cost", "Estimated Cost", "Cost"),
      num("committed_cost", "Committed Cost", "Cost"),
      num("actual_cost", "Actual Cost", "Cost"),
      num("forecast_cost", "Forecast Cost", "Cost"),
      num("variance", "Variance", "Cost", { description: "Forecast (or actual) minus estimated cost." }),
      num("variance_pct", "Variance %", "Cost"),
      enumCol("budget_status", "Status", "Status", [
        { value: "planned", label: "Planned" },
        { value: "approved", label: "Approved" },
        { value: "at_risk", label: "At risk" },
        { value: "overrun", label: "Overrun" },
        { value: "closed", label: "Closed" },
      ]),
    ],
    defaultColumns: ["project_name", "budget_item", "category", "estimated_cost", "actual_cost", "variance", "variance_pct"],
    supportedVisualizations: ["table", "kpi_cards", "bar", "pivot"],
  },

  // 3B — Governed Financial Control
  {
    id: "financial_control",
    displayName: "Financial Control",
    description: "PMO control view from canonical baseline, funding, commitment, actual, accrual, payment, reserve, and forecast projections.",
    category: "budget",
    scope: "project",
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("currency", "Currency", "Financial Context"),
      num("original_budget", "Original Budget", "Baseline"),
      num("current_baseline", "Current Baseline", "Baseline"),
      num("authorized_funding", "Authorized Funding", "Funding"),
      num("released_funding", "Released Funding", "Funding"),
      num("current_commitment", "Current Commitment", "Commitments"),
      num("outstanding_commitment", "Outstanding Commitment", "Commitments"),
      num("actual_cost", "Actual Cost", "Cost"),
      num("open_accrual", "Open Accrual", "Cost"),
      num("settled_payments", "Settled Payments", "Cash Flow"),
      num("remaining_reserve", "Remaining Reserve", "Reserves"),
      num("approved_changes_not_posted", "Approved Changes Not Posted", "Changes"),
      num("latest_eac", "Latest EAC", "Forecast"),
      num("p50_eac", "P50 EAC", "Forecast"),
      num("p80_eac", "P80 EAC", "Forecast"),
      num("cpi", "CPI", "Performance"),
      num("spi", "SPI", "Performance"),
      text("quality_status", "Quality Status", "Data Quality"),
      num("pending_approvals", "Pending Approvals", "Control Queue"),
      num("reconciliation_exceptions", "Reconciliation Exceptions", "Data Quality"),
      num("unverified_actuals", "Unverified Actuals", "Data Quality"),
      num("currency_mismatches", "Currency Mismatches", "Data Quality"),
      date("data_date", "Data Date", "Financial Context"),
    ],
    defaultColumns: [
      "project_name",
      "currency",
      "current_baseline",
      "authorized_funding",
      "current_commitment",
      "actual_cost",
      "open_accrual",
      "settled_payments",
      "latest_eac",
      "quality_status",
    ],
    supportedVisualizations: ["table", "kpi_cards", "bar"],
  },

  // 4 — Risk Register
  {
    id: "risk_register",
    displayName: "Risk Register",
    description: "Risk analysis and mitigation tracking across the project.",
    category: "risks",
    scope: "project",
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("risk_title", "Risk", "Identification"),
      enumCol("category", "Category", "Identification", [
        { value: "schedule", label: "Schedule" }, { value: "budget", label: "Budget" },
        { value: "scope", label: "Scope" }, { value: "labor", label: "Labor" },
        { value: "material", label: "Material" }, { value: "equipment", label: "Equipment" },
        { value: "technical", label: "Technical" }, { value: "quality", label: "Quality" },
        { value: "safety", label: "Safety" }, { value: "permit", label: "Permit" },
        { value: "external", label: "External" }, { value: "other", label: "Other" },
      ]),
      enumCol("probability", "Probability", "Assessment", [
        { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
      ]),
      enumCol("impact", "Impact", "Assessment", SEVERITY_VALUES),
      enumCol("severity", "Severity", "Assessment", SEVERITY_VALUES),
      enumCol("status", "Status", "Status", [
        { value: "open", label: "Open" }, { value: "mitigating", label: "Mitigating" },
        { value: "accepted", label: "Accepted" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" },
      ]),
      text("mitigation", "Mitigation Plan", "Mitigation", { groupable: false }),
      bool("ai_generated", "AI Generated", "AI / Evidence"),
      num("confidence_pct", "AI Confidence %", "AI / Evidence"),
      bool("needs_review", "Needs Review", "AI / Evidence"),
    ],
    defaultColumns: ["project_name", "risk_title", "category", "severity", "status", "mitigation"],
    supportedVisualizations: ["table", "kpi_cards", "bar", "donut"],
  },

  // 5 — Material Requirements
  {
    id: "material_requirements",
    displayName: "Material Requirements",
    description: "Materials needed by task, date, supplier, and status — including drawing-derived items.",
    category: "materials",
    scope: "project",
    emphasizedFor: ["data_center_construction", "residential_construction", "commercial_construction", "infrastructure", "industrial"],
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("material_name", "Material", "Identification"),
      num("quantity", "Quantity", "Quantity"),
      text("unit", "Unit", "Quantity"),
      num("estimated_total_cost", "Estimated Total Cost", "Cost"),
      enumCol("status", "Procurement Status", "Status", [
        { value: "planned", label: "Planned" }, { value: "required", label: "Required" },
        { value: "requested", label: "Requested" }, { value: "quoted", label: "Quoted" },
        { value: "ordered", label: "Ordered" }, { value: "partially_delivered", label: "Partially delivered" },
        { value: "delivered", label: "Delivered" }, { value: "installed", label: "Installed" },
        { value: "unavailable", label: "Unavailable" }, { value: "delayed", label: "Delayed" },
        { value: "cancelled", label: "Cancelled" },
      ]),
      num("lead_time_days", "Lead Time (days)", "Schedule"),
      date("required_by_date", "Required By", "Schedule"),
      enumCol("origin", "Source", "AI / Evidence", [
        { value: "manual", label: "Manual" }, { value: "drawing_extraction", label: "Drawing" },
        { value: "ai_suggested", label: "AI" }, { value: "template", label: "Template" }, { value: "import", label: "Import" },
      ]),
      num("confidence_pct", "Confidence %", "AI / Evidence"),
      bool("needs_review", "Needs Review", "AI / Evidence"),
    ],
    defaultColumns: ["project_name", "material_name", "quantity", "unit", "status", "required_by_date", "origin"],
    supportedVisualizations: ["table", "kpi_cards", "bar", "pivot"],
  },

  // 6 — RFI Log
  {
    id: "rfi_log",
    displayName: "RFI Log",
    description: "Requests for information: status, ownership, and what work they block.",
    category: "rfis",
    scope: "project",
    emphasizedFor: ["data_center_construction", "residential_construction", "commercial_construction", "infrastructure", "industrial"],
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("rfi_number", "RFI Number", "Identification"),
      text("subject", "Subject", "Identification"),
      enumCol("status", "Status", "Status", [
        { value: "draft", label: "Draft" }, { value: "open", label: "Open" },
        { value: "answered", label: "Answered" }, { value: "closed", label: "Closed" }, { value: "void", label: "Void" },
      ]),
      enumCol("priority", "Priority", "Status", SEVERITY_VALUES),
      date("due_date", "Due Date", "Schedule"),
      bool("blocks_work", "Blocking Work", "Risk"),
      enumCol("origin", "Source", "AI / Evidence", [
        { value: "manual", label: "Manual" }, { value: "drawing_intelligence", label: "Drawing" },
        { value: "ai_suggested", label: "AI" }, { value: "import", label: "Import" },
      ]),
      bool("needs_review", "Needs Review", "AI / Evidence"),
    ],
    defaultColumns: ["project_name", "rfi_number", "subject", "status", "priority", "due_date", "blocks_work"],
    supportedVisualizations: ["table", "kpi_cards", "bar"],
  },

  // 7 — Project Memory
  {
    id: "project_memory",
    displayName: "Project Memory",
    description: "Captured project context — notes, communications, decisions, risk signals, and evidence — with AI classification flags. Foundation for Decision Log, Communication Log, Risk Signals, Stakeholder Concerns and Evidence reports.",
    category: "executive",
    scope: "project",
    columns: [
      text("project_name", "Project", "Project Structure"),
      text("title", "Title", "Identification"),
      enumCol("source_type", "Source Type", "Identification", [
        { value: "manual_note", label: "Manual note" }, { value: "email", label: "Email" },
        { value: "chat_message", label: "Chat message" }, { value: "meeting_note", label: "Meeting note" },
        { value: "decision", label: "Decision" }, { value: "action_item", label: "Action item" },
        { value: "risk_signal", label: "Risk signal" }, { value: "evidence", label: "Evidence" },
        { value: "approval", label: "Approval" }, { value: "change_request", label: "Change request" },
        { value: "system_event", label: "System event" }, { value: "document", label: "Document" },
      ]),
      enumCol("importance_level", "Importance", "Assessment", SEVERITY_VALUES),
      enumCol("sentiment", "Sentiment", "Assessment", [
        { value: "positive", label: "Positive" }, { value: "neutral", label: "Neutral" },
        { value: "negative", label: "Negative" }, { value: "concerned", label: "Concerned" },
        { value: "mixed", label: "Mixed" },
      ]),
      text("author", "Author", "People", { groupable: true }),
      date("occurred_at", "Occurred At", "Schedule"),
      bool("contains_decision", "Decision", "AI Classification"),
      bool("contains_risk", "Risk", "AI Classification"),
      bool("contains_action_item", "Action Item", "AI Classification"),
      bool("contains_scope_change", "Scope Change", "AI Classification"),
      bool("contains_schedule_impact", "Schedule Impact", "AI Classification"),
      bool("contains_cost_impact", "Cost Impact", "AI Classification"),
      bool("contains_stakeholder_concern", "Stakeholder Concern", "AI Classification"),
      num("ai_confidence_pct", "AI Confidence %", "AI Classification"),
    ],
    defaultColumns: ["project_name", "title", "source_type", "importance_level", "occurred_at", "contains_decision", "contains_risk"],
    supportedVisualizations: ["table", "kpi_cards", "bar", "donut"],
  },
];

// ── Lookups ───────────────────────────────────────────────────────────────────

const DATASET_BY_ID = new Map(DATASETS.map((d) => [d.id, d]));

export function listDatasets(): DatasetDefinition[] {
  return DATASETS;
}

export function getDataset(id: string): DatasetDefinition | null {
  return DATASET_BY_ID.get(id) ?? null;
}

export function getDatasetColumns(id: string): DatasetColumn[] {
  return DATASET_BY_ID.get(id)?.columns ?? [];
}

export function getColumn(datasetId: string, columnKey: string): DatasetColumn | null {
  return getDatasetColumns(datasetId).find((c) => c.key === columnKey) ?? null;
}
