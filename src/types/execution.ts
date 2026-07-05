// ============================================================================
// ProjectOps360° — Universal Execution Model Types
// ============================================================================
// Entities introduced by 20260708000000_universal_execution_model.sql.
// One execution model for every project type: software, data center,
// residential, commercial, infrastructure, industrial, general.
// ============================================================================

import type { I18nField, OrganizationScoped } from "./database";

// ── Project types ───────────────────────────────────────────────────────────

export type ProjectType =
  | "software_development"
  | "data_center_construction"
  | "residential_construction"
  | "commercial_construction"
  | "infrastructure"
  | "industrial"
  | "general"
  // Future platform: projects designed for AI-assisted execution. At this stage
  // this only IDENTIFIES the project (selectable + stored); no AI-specific
  // workflows or provider integrations. Backward compatible.
  | "ai_native_execution";

/** Modules that can be enabled/softened per project type. The underlying
 *  architecture always exists; project type only configures visibility. */
export type ProjectModule =
  | "overview"
  | "scope"
  | "milestones"
  | "tasks"
  | "dependencies"
  | "schedule"
  | "critical_path"
  | "resources"
  | "people"
  | "materials"
  | "equipment"
  | "budget"
  | "risks"
  | "rfis"
  | "submittals"
  | "inspections"
  | "permits"
  | "procurement"
  | "documents"
  | "drawing_intelligence"
  | "living_graph"
  | "labor_capacity"
  | "ai_recommendations"
  // Software-project execution evidence from a connected GitHub repository.
  // Gated by both project_type='software_development' AND the
  // GITHUB_INTELLIGENCE_ENABLED flag (stripped from nav when either is false).
  | "github_intelligence"
  | "reports";

// ── Universal statuses ──────────────────────────────────────────────────────

/** Universal item status shared across modules. Module-specific statuses
 *  (TaskStatus, material status, …) map into this set for health/reporting. */
export type UniversalStatus =
  | "planned"
  | "ready"
  | "in_progress"
  | "blocked"
  | "at_risk"
  | "needs_review"
  | "completed"
  | "cancelled"
  | "deferred";

// ── Suppliers ───────────────────────────────────────────────────────────────

export type SupplierType =
  | "vendor"
  | "subcontractor"
  | "manufacturer"
  | "distributor"
  | "service_provider";

export interface Supplier extends OrganizationScoped {
  id: string;
  project_id: string | null;
  name: string;
  supplier_type: SupplierType;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  default_lead_time_days: number | null;
  status: "active" | "inactive" | "blacklisted";
  metadata: Record<string, unknown>;
}

// ── Universal resources ─────────────────────────────────────────────────────

export type ResourceType =
  | "person"
  | "crew"
  | "team"
  | "role"
  | "skill"
  | "material"
  | "equipment"
  | "tool"
  | "software_license"
  | "cloud_service"
  | "vendor"
  | "supplier"
  | "subcontractor"
  | "facility"
  | "budget_pool"
  | "ai_agent";

export type ResourceStatus = "active" | "inactive" | "unavailable" | "retired";
export type CostUnit = "hour" | "day" | "week" | "month" | "unit" | "fixed";

/** Weekly availability window (same shape as labor_resources.availability). */
export interface AvailabilityWindow {
  week: string; // e.g. '2026-W29'
  start?: string;
  end?: string;
  available_hours: number;
  status: "available" | "partial" | "unavailable";
}

export interface Resource extends OrganizationScoped {
  id: string;
  project_id: string | null;
  resource_type: ResourceType;
  name: string;
  description: string | null;
  label_i18n: I18nField;
  status: ResourceStatus;
  unit_of_measure: string | null;
  cost_rate: number | null;
  cost_unit: CostUnit | null;
  capacity_per_day: number | null;
  availability: AvailabilityWindow[];
  skills: string[];
  trade_key: string | null;
  discipline: string | null;
  supplier_id: string | null;
  linked_user_id: string | null;
  legacy_labor_resource_id: string | null;
  metadata: Record<string, unknown>;
  order_index: number;
}

// ── Budget & cost ───────────────────────────────────────────────────────────

export type BudgetCategory =
  | "labor"
  | "material"
  | "equipment"
  | "subcontractor"
  | "software"
  | "cloud"
  | "permit"
  | "contingency"
  | "other";

export type BudgetItemStatus = "planned" | "approved" | "at_risk" | "overrun" | "closed";

export interface BudgetItem extends OrganizationScoped {
  id: string;
  project_id: string;
  cost_code: string | null;
  name: string;
  description: string | null;
  category: BudgetCategory;
  estimated_cost: number;
  committed_cost: number;
  actual_cost: number;
  forecast_cost: number | null;
  currency: string;
  status: BudgetItemStatus;
  milestone_id: string | null;
  metadata: Record<string, unknown>;
}

export type CostSource = "manual" | "timesheet" | "invoice" | "procurement" | "ai_estimate";

export interface CostActual extends OrganizationScoped {
  id: string;
  project_id: string;
  budget_item_id: string | null;
  task_id: string | null;
  resource_id: string | null;
  amount: number;
  currency: string;
  cost_date: string;
  cost_type: BudgetCategory;
  description: string | null;
  source: CostSource;
  metadata: Record<string, unknown>;
}

// ── Materials & procurement ─────────────────────────────────────────────────

export type MaterialStatus =
  | "planned"
  | "required"
  | "requested"
  | "quoted"
  | "ordered"
  | "partially_delivered"
  | "delivered"
  | "installed"
  | "unavailable"
  | "delayed"
  | "cancelled";

export type RecordOrigin =
  | "manual"
  | "drawing_extraction"
  | "drawing_intelligence"
  | "ai_suggested"
  | "health_engine"
  | "template"
  | "import";

export interface MaterialRequirement extends OrganizationScoped {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  spec_reference: string | null;
  discipline: string | null;
  trade_key: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  estimated_unit_cost: number | null;
  estimated_total_cost: number | null;
  supplier_id: string | null;
  lead_time_days: number | null;
  status: MaterialStatus;
  required_by_task_id: string | null;
  required_by_date: string | null;
  budget_item_id: string | null;
  resource_id: string | null;
  source_drawing_id: string | null;
  source_extraction_id: string | null;
  source_insight_id: string | null;
  confidence_score: number | null;
  evidence_json: Record<string, unknown>;
  needs_review: boolean;
  origin: RecordOrigin;
  metadata: Record<string, unknown>;
}

export type ProcurementStatus =
  | "planned"
  | "requested"
  | "quoted"
  | "ordered"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "cancelled";

export interface ProcurementItem extends OrganizationScoped {
  id: string;
  project_id: string;
  material_requirement_id: string | null;
  supplier_id: string | null;
  budget_item_id: string | null;
  name: string;
  status: ProcurementStatus;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  currency: string;
  order_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

// ── Risks / RFIs / Submittals / Inspections / Permits ───────────────────────

export type RiskCategory =
  | "schedule"
  | "budget"
  | "scope"
  | "labor"
  | "material"
  | "equipment"
  | "technical"
  | "quality"
  | "safety"
  | "permit"
  | "external"
  | "other";

export type RiskLevel = "low" | "medium" | "high";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskStatus = "open" | "mitigating" | "accepted" | "resolved" | "closed";

export interface Risk extends OrganizationScoped {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: RiskCategory;
  probability: RiskLevel;
  impact: RiskSeverity;
  severity: RiskSeverity;
  status: RiskStatus;
  mitigation_plan: string | null;
  owner_user_id: string | null;
  linked_task_id: string | null;
  linked_milestone_id: string | null;
  source_insight_id: string | null;
  origin: RecordOrigin;
  confidence_score: number | null;
  evidence_json: Record<string, unknown>;
  needs_review: boolean;
  metadata: Record<string, unknown>;
}

export type RfiStatus = "draft" | "open" | "answered" | "closed" | "void";

export interface Rfi extends OrganizationScoped {
  id: string;
  project_id: string;
  rfi_number: string | null;
  subject: string;
  question: string | null;
  answer: string | null;
  status: RfiStatus;
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  answered_at: string | null;
  blocks_task_id: string | null;
  source_drawing_id: string | null;
  source_insight_id: string | null;
  origin: RecordOrigin;
  evidence_json: Record<string, unknown>;
  needs_review: boolean;
  created_by: string | null;
  metadata: Record<string, unknown>;
}

export type SubmittalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "approved_as_noted"
  | "revise_resubmit"
  | "rejected"
  | "closed";

export interface Submittal extends OrganizationScoped {
  id: string;
  project_id: string;
  submittal_number: string | null;
  title: string;
  spec_section: string | null;
  description: string | null;
  status: SubmittalStatus;
  due_date: string | null;
  approved_at: string | null;
  required_before_task_id: string | null;
  supplier_id: string | null;
  source_drawing_id: string | null;
  source_insight_id: string | null;
  origin: RecordOrigin;
  evidence_json: Record<string, unknown>;
  needs_review: boolean;
  metadata: Record<string, unknown>;
}

export type InspectionStatus = "pending" | "scheduled" | "passed" | "failed" | "waived" | "cancelled";

export interface Inspection extends OrganizationScoped {
  id: string;
  project_id: string;
  title: string;
  inspection_type: string | null;
  status: InspectionStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  inspector_name: string | null;
  linked_task_id: string | null;
  location_zone: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export type PermitStatus = "required" | "applied" | "approved" | "rejected" | "expired" | "not_required";

export interface Permit extends OrganizationScoped {
  id: string;
  project_id: string;
  name: string;
  authority: string | null;
  permit_number: string | null;
  status: PermitStatus;
  applied_date: string | null;
  approved_date: string | null;
  expiry_date: string | null;
  linked_task_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

// ── Resource assignments ────────────────────────────────────────────────────

export type AssignmentType =
  | "owner"
  | "contributor"
  | "crew"
  | "reviewer"
  | "equipment"
  | "material"
  | "vendor"
  | "ai_agent";

export interface ResourceAssignment extends OrganizationScoped {
  id: string;
  project_id: string;
  task_id: string;
  resource_id: string;
  assignment_type: AssignmentType;
  allocation_pct: number | null;
  planned_hours: number | null;
  actual_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  metadata: Record<string, unknown>;
}

// ── Critical path snapshots ─────────────────────────────────────────────────

export type CriticalPathTrigger =
  | "manual"
  | "dependency_change"
  | "duration_change"
  | "material_delay"
  | "labor_unavailable"
  | "rfi_blocker"
  | "submittal_pending"
  | "drawing_revision"
  | "scheduled";

export interface CriticalPathSnapshot {
  id: string;
  organization_id: string;
  project_id: string;
  computed_at: string;
  trigger_reason: CriticalPathTrigger;
  task_count: number;
  critical_task_ids: string[];
  project_duration_days: number | null;
  project_earliest_finish: string | null;
  summary: Record<string, unknown>;
  created_at: string;
}
