// ============================================================================
// ProjectOps360° — Database Entity Types (MVP-0)
// ============================================================================
// Hand-written types matching the 12 MVP-0 tables.
// When Supabase codegen is set up, these can be replaced with generated types.
// ============================================================================

// ── i18n Helper Types ────────────────────────────────────────────────────────

/** Locale codes supported by the application */
export type Locale = "en" | "es";

/** JSONB i18n field: keys are locale codes, values are the translated text */
export type I18nField = Partial<Record<Locale, string>>;

/** Helper to extract a value from an i18n JSONB field with fallback */
export function getI18nValue(field: I18nField | null | undefined, locale: Locale, fallback?: string): string {
  if (!field) return fallback ?? "";
  return field[locale] ?? field.en ?? fallback ?? "";
}

/** Extract delay_reason_i18n from a ConstructionActivity's metadata JSONB.
 *  The delay reason follows the I18nField pattern: {"en": "...", "es": "..."} */
export function getDelayReason(metadata: Record<string, unknown>): I18nField | null {
  const reason = metadata?.delay_reason_i18n;
  if (reason && typeof reason === "object" && !Array.isArray(reason)) {
    return reason as I18nField;
  }
  return null;
}

// ── Common Fields ─────────────────────────────────────────────────────────────

/** Fields shared by all business tables with soft delete */
export interface BaseTimestamps {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Fields shared by all business tables that belong to an organization */
export interface OrganizationScoped extends BaseTimestamps {
  organization_id: string;
}

// ── Organizations ─────────────────────────────────────────────────────────────

export type OrganizationPlan = "free" | "pro" | "enterprise";

export interface Organization {
  id: string;
  slug: string;
  name_i18n: I18nField;
  description_i18n: I18nField;
  avatar_url: string | null;
  plan: OrganizationPlan;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string; // 1:1 with auth.users(id)
  organization_id: string;
  display_name: string | null;
  avatar_url: string | null;
  locale: Locale;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// ── Organization Members ──────────────────────────────────────────────────────

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  invited_at: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export interface Project extends OrganizationScoped {
  id: string;
  slug: string;
  title_i18n: I18nField;
  description_i18n: I18nField;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  created_by: string | null;
  /** Universal project type — configures templates, terminology, and default modules. */
  project_type: ProjectType;
  /** Explicit module list; null = derive defaults from project_type. */
  enabled_modules: ProjectModule[] | null;
}

// ── Stakeholders ──────────────────────────────────────────────────────────────

export type InfluenceLevel = "high" | "medium" | "low";
export type InterestLevel = "high" | "medium" | "low";

export interface Stakeholder extends OrganizationScoped {
  id: string;
  project_id: string | null;
  name: string;
  role_i18n: I18nField;
  email: string | null;
  influence: InfluenceLevel | null;
  interest: InterestLevel | null;
  notes_i18n: I18nField;
}

// ── Meetings ───────────────────────────────────────────────────────────────────

export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface Meeting extends OrganizationScoped {
  id: string;
  project_id: string | null;
  title_i18n: I18nField;
  agenda_i18n: I18nField;
  notes_i18n: I18nField;
  summary_i18n: I18nField;
  meeting_date: string | null;
  duration_minutes: number | null;
  location: string | null;
  attendees: string | null;
  status: MeetingStatus;
  linked_stakeholder_ids: string[];
  created_by: string | null;
  // ── Rhythm Center extensions ──
  event_id: string | null;
  meeting_type: RhythmMeetingType | null;
  objective: string | null;
  expected_outcome: string | null;
  agenda_json: AgendaSection[];
  ai_summary: Record<string, unknown>;
  meeting_status: EventStatus;
  meeting_link: string | null;
}

// ── Project Rhythm Center ────────────────────────────────────────────────────────

export type EventType =
  | "kickoff_meeting" | "status_update" | "stakeholder_review" | "project_review" | "project_closing"
  | "milestone" | "deliverable_deadline" | "risk_review" | "budget_review"
  | "change_review" | "vendor_followup" | "resource_planning" | "action_followup" | "other";

export type EventStatus =
  | "draft" | "scheduled" | "agenda_ready" | "in_progress"
  | "completed" | "follow_up_pending" | "closed" | "canceled";

export type EventPriority = "low" | "medium" | "high" | "critical";
export type EventSource = "manual" | "template" | "system" | "ai";
export type RhythmMeetingType = "kickoff" | "status_update" | "stakeholder_review" | "project_review" | "closing" | "other";
export type AttendeeRole = "organizer" | "presenter" | "required" | "optional";
export type AttendanceStatus = "invited" | "accepted" | "declined" | "tentative" | "attended" | "absent";

export interface AgendaSection {
  key: string;
  title: string;
  content: string;
}

export interface ProjectEvent extends OrganizationScoped {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_datetime: string;
  end_datetime: string | null;
  status: EventStatus;
  priority: EventPriority;
  source: EventSource;
  related_milestone_id: string | null;
  related_task_id: string | null;
  related_risk_id: string | null;
  related_change_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
}

export interface MeetingAttendee {
  id: string;
  organization_id: string;
  meeting_id: string;
  user_id: string | null;
  stakeholder_id: string | null;
  name: string | null;
  role: AttendeeRole;
  attendance_status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

// ── Decisions ──────────────────────────────────────────────────────────────────

export type DecisionStatus = "proposed" | "accepted" | "rejected" | "deferred" | "revoked";

export type DecisionSourceType = "meeting" | "communication" | "document" | "manual" | "other";

export type ImpactArea = "scope" | "schedule" | "budget" | "risk" | "quality" | "communication" | "document" | "other";

export interface Decision extends OrganizationScoped {
  id: string;
  project_id: string | null;
  title_i18n: I18nField;
  description_i18n: I18nField;
  rationale_i18n: I18nField;
  status: DecisionStatus;
  decision_date: string | null;
  decision_maker: string | null;
  source_type: DecisionSourceType | null;
  source_record_id: string | null;
  impact_area: ImpactArea | null;
  evidence_url: string | null;
  decided_by: string | null;
  created_by: string | null;
}

// ── Communication Items ────────────────────────────────────────────────────────

export type CommunicationSourceType =
  | "email" | "meeting" | "phone" | "teams" | "slack"
  | "in_person" | "document" | "manual_note" | "other";

export type CommunicationStatus = "draft" | "logged";

export interface CommunicationItem extends OrganizationScoped {
  id: string;
  project_id: string | null;
  meeting_id: string | null;
  title_i18n: I18nField;
  summary_i18n: I18nField;
  content_i18n: I18nField;
  source_type: CommunicationSourceType | null;
  item_date: string | null;
  sender: string | null;
  recipients: string | null;
  requires_follow_up: boolean;
  status: CommunicationStatus;
  related_stakeholder_ids: string[];
  created_by: string | null;
}

// ── Documents ──────────────────────────────────────────────────────────────────

export type DocumentStatus = "draft" | "review" | "approved" | "archived";
export type DocumentType = "evidence" | "contract" | "specification" | "report" | "presentation" | "other";
export type StorageType = "upload" | "external_url";

export interface Document extends OrganizationScoped {
  id: string;
  project_id: string | null;
  title_i18n: I18nField;
  description_i18n: I18nField;
  document_type: DocumentType;
  storage_type: StorageType;
  external_url: string | null;
  owner: string | null;
  file_url: string | null;
  file_type: string | null;
  version: number;
  status: DocumentStatus;
  created_by: string | null;
}

// ── Project Memory Items ─────────────────────────────────────────────────────────

export type MemorySourceType =
  | "manual_note"
  | "email"
  | "chat_message"
  | "meeting_note"
  | "decision"
  | "action_item"
  | "risk_signal"
  | "evidence"
  | "approval"
  | "change_request"
  | "system_event"
  | "document";

export type MemoryImportance = "low" | "medium" | "high" | "critical";
export type MemorySentiment = "positive" | "neutral" | "negative" | "concerned" | "mixed";
export type MemoryVisibility = "project" | "organization" | "private";
export type MemoryPipelineStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
export type MemoryUrgency = "low" | "medium" | "high";

/** Structured JSON stored in project_memory_items.ai_classification. */
export interface MemoryClassification {
  contains_decision?: boolean;
  contains_risk?: boolean;
  contains_action_item?: boolean;
  contains_scope_change?: boolean;
  contains_schedule_impact?: boolean;
  contains_cost_impact?: boolean;
  contains_stakeholder_concern?: boolean;
  sentiment?: MemorySentiment;
  urgency?: MemoryUrgency;
  suggested_tags?: string[];
  /** AI-suggested links to existing entities (not auto-applied). */
  suggested_links?: Array<{ entity_type: string; hint: string }>;
  confidence?: number;
}

export interface ProjectMemoryItem extends OrganizationScoped {
  id: string;
  project_id: string;
  title: string;
  content: string | null;
  summary: string | null;
  source_type: MemorySourceType;
  source_system: string | null;
  source_external_id: string | null;
  author_name: string | null;
  author_email: string | null;
  participants: string[];
  occurred_at: string | null;
  importance_level: MemoryImportance;
  sentiment: MemorySentiment | null;
  ai_classification: MemoryClassification;
  tags: string[];
  metadata: Record<string, unknown>;
  visibility: MemoryVisibility;
  ai_status: MemoryPipelineStatus;
  index_status: MemoryPipelineStatus;
  created_by: string | null;
}

// ── Traceability Links ─────────────────────────────────────────────────────────

export type TraceableEntityType =
  | "decision" | "meeting" | "communication" | "document"
  | "action_item" | "stakeholder" | "project"
  | "memory" | "task" | "milestone" | "risk";
export type LinkType = "related_to" | "caused_by" | "depends_on" | "supersedes" | "derived_from" | "contradicts";

export interface TraceabilityLink {
  id: string;
  organization_id: string;
  source_type: TraceableEntityType;
  source_id: string;
  target_type: TraceableEntityType;
  target_id: string;
  link_type: LinkType;
  context_i18n: I18nField;
  created_by: string | null;
  created_at: string;
}

// ── AI Runs ────────────────────────────────────────────────────────────────────

export type AiPromptType = "summary" | "decision_analysis" | "stakeholder_mapping" | "risk_assessment" | "action_extraction" | "communication_history_summary" | "drawing_interpretation" | "memory_classification" | "guide_coaching" | "custom";
export type AiRunStatus = "pending" | "completed" | "failed" | "cancelled";
export type AiSourceType = "decision" | "meeting" | "communication" | "document" | "action_item" | "project" | "memory";

export interface AiRun {
  id: string;
  organization_id: string;
  user_id: string | null;
  model: string;
  prompt_type: AiPromptType;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown>;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: AiRunStatus;
  error_message: string | null;
  source_type: AiSourceType | null;
  source_id: string | null;
  created_at: string;
}

// ── Action Items ────────────────────────────────────────────────────────────────

export type ActionItemStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type ActionItemPriority = "low" | "medium" | "high" | "critical";

export interface ActionItem extends OrganizationScoped {
  id: string;
  project_id: string | null;
  meeting_id: string | null;
  decision_id: string | null;
  ai_run_id: string | null;
  title_i18n: I18nField;
  description_i18n: I18nField;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
}

// ── Milestones ────────────────────────────────────────────────────────────────────

export type MilestoneStatus = "planned" | "in_progress" | "completed" | "blocked" | "deferred";

/** Computed status extends stored status with "at_risk" for milestones with blocked tasks. */
export type MilestoneStatusDisplay = MilestoneStatus | "at_risk";

export interface Milestone extends OrganizationScoped {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  progress_percent: number;
  order_index: number;
  icon_key: string | null;
  color_key: string | null;
  created_by: string | null;
  /** When true, the milestone status is manually pinned and will not be auto-recalculated from task completion. */
  status_override_enabled: boolean;
  /** The manually-set status value, used only when status_override_enabled is true. */
  status_override_value: MilestoneStatus | null;
}

// ── Roadmap Tasks ────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "not_started"
  | "prompt_ready"
  | "sent_to_ai"
  | "in_progress"
  | "implemented"
  | "tested"
  | "done"
  | "blocked"
  | "deferred";
export type TaskPriority = "p1" | "p2" | "p3";

export interface RoadmapTask extends OrganizationScoped {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sprint_name: string | null;
  estimate_hours: number | null;
  actual_hours: number | null;
  dependency_notes: string | null;
  acceptance_criteria: string | null;
  order_index: number;
  external_key: string | null;
  execution_notes: string | null;
  completed_at: string | null;
  prompt_body: string | null;
  prompt_context: string | null;
  prompt_version: number;
  last_prompt_sent_at: string | null;
  ai_tool_target: string | null;
  implementation_notes: string | null;
  test_notes: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  progress: number;
  is_blocked: boolean;
  blocker_reason: string | null;
  is_critical: boolean;
  slack_days: number | null;
  earliest_start: string | null;
  earliest_finish: string | null;
  latest_start: string | null;
  latest_finish: string | null;
  created_by: string | null;
  // ── Universal execution model (20260708000000) ──
  /** Single-owner shortcut (auth.users id). Multi-resource assignment lives in resource_assignments. */
  assigned_to: string | null;
  /** Assigned crew/team/vendor/equipment (resources id). */
  assigned_resource_id: string | null;
  assignment_type: TaskAssignmentType | null;
  required_skills: string[];
  required_crew_size: number | null;
  estimated_labor_hours: number | null;
  location_zone: string | null;
  discipline: string | null;
  trade_key: string | null;
  cost_code: string | null;
  budget_item_id: string | null;
  source_drawing_id: string | null;
  source_insight_id: string | null;
}

/** How a task is assigned: directly to a person, or to a group-like resource. */
export type TaskAssignmentType =
  | "person"
  | "team"
  | "role"
  | "crew"
  | "vendor"
  | "resource_group"
  | "ai_agent";

// ── Task Dependencies ──────────────────────────────────────────────────────────────

export type DependencyType =
  | "finish_to_start"
  | "start_to_start"
  | "start_to_finish"
  | "finish_to_finish";

export interface TaskDependency {
  id: string;
  organization_id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  created_at: string;
}

// ── Living Graph (Process Intelligence) ──────────────────────────────────────────

export type ProcessNodeType =
  | "task_transition"
  | "decision_cascade"
  | "communication_flow"
  | "document_link"
  | "milestone_gate"
  | "blocker_event"
  | "labor_risk"
  | "drawing_event"
  | "drawing_insight"
  // Universal execution model (20260708) + import intelligence (20260710)
  | "resource_event"
  | "material_event"
  | "procurement_event"
  | "budget_event"
  | "risk_event"
  | "rfi_event"
  | "submittal_event"
  | "inspection_event"
  | "permit_event"
  | "critical_path_event"
  | "import_event"
  // Task Execution Map — SYNTHETIC client-side node for expanded subtasks.
  // Presentation-only: never written to process_nodes (the layer is derived
  // from task_subtasks at render time).
  | "subtask_item"
  | "knowledge_object"
  | "evidence_reference";

export type ProcessEdgeType =
  | "caused"
  | "enabled"
  | "blocked"
  | "delayed"
  | "accelerated"
  | "informed"
  | "labor_constrained"
  | "generated_insight"
  | "affects"
  // Universal execution model (20260708) + import intelligence (20260710)
  | "requires_material"
  | "requires_resource"
  | "requires_approval"
  | "assigned_to"
  | "impacts_cost"
  | "impacts_procurement"
  | "creates_risk"
  | "mitigates_risk"
  | "supplied_by"
  | "contains"
  | "imported_from"
  // Task Execution Map — SYNTHETIC client-side hierarchy edge (parent task →
  // subtask). Presentation-only: never written to process_edges.
  | "subtask_of"
  | "supported_by"
  | "contradicted_by"
  | "derived_from";

export type ProcessNodeSourceType =
  | "roadmap_tasks"
  | "decisions"
  | "communication_items"
  | "meetings"
  | "documents"
  | "milestones"
  | "construction_activities"
  | "drawing_files"
  | "drawing_insights"
  // Universal execution model (20260708) + import intelligence (20260710)
  | "resources"
  | "material_requirements"
  | "procurement_items"
  | "budget_items"
  | "risks"
  | "rfis"
  | "submittals"
  | "inspections"
  | "permits"
  | "critical_path_snapshots"
  | "project_import_jobs"
  // Task Execution Map — SYNTHETIC client-side subtask nodes (never persisted).
  | "task_subtasks"
  | "project_knowledge_objects"
  | "knowledge_evidence";

export interface ProcessNode {
  id: string;
  organization_id: string;
  project_id: string;
  node_type: ProcessNodeType;
  source_entity_type: ProcessNodeSourceType;
  source_entity_id: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  embedding: number[] | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessEdge {
  id: string;
  organization_id: string;
  project_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: ProcessEdgeType;
  weight: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProcessSnapshot {
  id: string;
  organization_id: string;
  project_id: string;
  snapshot_date: string;
  node_count: number;
  edge_count: number;
  summary: Record<string, unknown>;
  created_at: string;
}

// ── Graph Traversal RPC Result Types (PI-004) ──────────────────────────────────

export interface FindPathResult {
  path_node_ids: string[];
  total_weight: number;
  path_length: number;
}

export interface DetectCycleResult {
  cycle_id: number;
  node_ids: string[];
  node_titles: string[];
  cycle_length: number;
}

export interface SubgraphNode {
  id: string;
  node_type: ProcessNodeType;
  source_entity_type: ProcessNodeSourceType;
  source_entity_id: string;
  title: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface SubgraphEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: ProcessEdgeType;
  weight: number;
  metadata: Record<string, unknown>;
}

export interface ExtractSubgraphResult {
  nodes: SubgraphNode[];
  edges: SubgraphEdge[];
}

export interface ProcessTimelineEntry {
  node_id: string;
  node_type: ProcessNodeType;
  source_entity_type: ProcessNodeSourceType;
  source_entity_id: string;
  title: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  in_degree: number;
  out_degree: number;
}

export interface NodeNeighbor {
  neighbor_id: string;
  neighbor_node_type: ProcessNodeType;
  neighbor_title: string;
  neighbor_source_entity_type: ProcessNodeSourceType;
  neighbor_source_entity_id: string;
  neighbor_occurred_at: string;
  edge_id: string;
  edge_type: ProcessEdgeType;
  edge_weight: number;
  edge_metadata: Record<string, unknown>;
  direction: "incoming" | "outgoing";
}

// ── Trade Taxonomy (Data Center Labor Risk Intelligence Lab) ───────────────────────

/** Category of taxonomy entry */
export type TradeTaxonomyType = "trade" | "skill" | "certification" | "specialist_role";

export interface TradeTaxonomy {
  id: string;
  organization_id: string;
  project_id: string | null;
  trade_key: string;
  label_i18n: I18nField;
  trade_type: TradeTaxonomyType;
  parent_key: string | null;
  metadata: Record<string, unknown>;
  order_index: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Labor Resources (Data Center Labor Risk Intelligence Lab) ─────────────────────

/** Type of labor resource */
export type LaborResourceType = "crew" | "specialist" | "inspector" | "vendor" | "witness";

/** Skill level of a labor resource */
export type SkillLevel = "apprentice" | "journeyman" | "senior" | "master";

export interface LaborResource {
  id: string;
  organization_id: string;
  project_id: string | null;
  resource_key: string;
  name: string;
  trade_key: string;
  label_i18n: I18nField;
  resource_type: LaborResourceType;
  skill_level: SkillLevel;
  headcount: number;
  capacity_hours_per_week: number;
  availability: Record<string, unknown>[];
  constraints: Record<string, unknown>;
  metadata: Record<string, unknown>;
  order_index: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Construction Activities (Data Center Labor Risk Intelligence Lab) ───────────

/** Status of a construction activity */
export type ConstructionActivityStatus = "not_started" | "in_progress" | "completed" | "blocked" | "deferred";

/** Commissioning test level for data center construction */
export type CommissioningLevel = "L2" | "L3" | "L4" | "L5" | "L6";

/** Workface readiness criterion for a construction activity.
 *  Each criterion represents a prerequisite that must be satisfied
 *  before the activity can be executed. */
export type ReadinessCriterion =
  | "rfi_answered"
  | "submittal_approved"
  | "drawing_current"
  | "material_onsite"
  | "area_released"
  | "permit_ready"
  | "predecessor_complete"
  | "qa_prerequisite"
  | "crew_assigned";

/** Category of a readiness criterion. */
export type ReadinessCriterionCategory = "prerequisite" | "resource";

/** A single item in a workface readiness checklist. */
export interface ReadinessChecklistItem {
  /** The criterion this item tracks. */
  item_key: ReadinessCriterion;
  /** Bilingual label for display. */
  label_i18n: I18nField;
  /** Whether this item is required for the activity to be considered ready. */
  required: boolean;
  /** Whether this item has been completed. */
  completed: boolean;
  /** ISO timestamp when the item was marked complete, null if not completed. */
  completed_at: string | null;
  /** Optional notes about this checklist item. */
  notes: string;
}

export interface ConstructionActivity extends OrganizationScoped {
  id: string;
  project_id: string | null;
  activity_key: string;
  name: string;
  label_i18n: I18nField;
  description_i18n: I18nField;
  required_trade_key: string;
  required_crew_count: number;
  estimated_hours: number;
  /** Actual labor hours spent. NULL means not yet tracked. */
  actual_hours: number | null;
  /** Planned production rate (units/hour). NULL means not set. */
  planned_production_rate: number | null;
  /** Actual production rate achieved (units/hour). NULL means not yet measured. */
  actual_production_rate: number | null;
  /** Actual crew size deployed (headcount). NULL means not yet tracked. */
  crew_size: number | null;
  /** Number of rework cycles. 0 means no rework. */
  rework_count: number;
  planned_start_date: string;
  planned_end_date: string;
  location_zone: string;
  commissioning_level: CommissioningLevel | null;
  assigned_resource_keys: string[];
  status: ConstructionActivityStatus;
  progress: number;
  /** Workface readiness checklist items. Stored as JSONB in the database. */
  readiness_checklist: ReadinessChecklistItem[];
  metadata: Record<string, unknown>;
  order_index: number;
}

// ── Activity Dependencies (Data Center Labor Risk Intelligence Lab) ──────────

/** Dependency type between construction activities (mirrors task_dependencies pattern) */
export type ActivityDependencyType =
  | "finish_to_start"
  | "start_to_start"
  | "start_to_finish"
  | "finish_to_finish";

export interface ActivityDependency {
  id: string;
  organization_id: string;
  project_id: string | null;
  predecessor_id: string;
  successor_id: string;
  dependency_type: ActivityDependencyType;
  lag_days: number;
  created_at: string;
}

// ── Labor Weekly Capacity (DCL-006) ──────────────────────────────────────────────

export type ShortageRiskLevel = "none" | "low" | "medium" | "high" | "critical";

/** Readiness level for a construction activity in the lookahead window. */
export type ReadinessLevel = "ready" | "at_risk" | "not_ready" | "blocked";

/** Severity of idle risk when a crew is assigned to not-ready work. */
export type IdleRiskSeverity = "none" | "low" | "medium" | "high" | "critical";

/** Types of recommended actions for idle risk mitigation. */
export type RecommendedActionType =
  | "reassign"
  | "stagger"
  | "expedite_prerequisite"
  | "confirm_vendor"
  | "monitor";

/** Blocker type for lookahead activities. */
export type LookaheadBlockerType =
  | "unmet_dependency"
  | "labor_shortage"
  | "vendor_unconfirmed"
  | "over_allocated"
  | "blocked_status"
  | "checklist_incomplete";

export interface LaborWeeklyCapacity {
  id: string;
  organization_id: string;
  project_id: string;
  trade_key: string;
  week_label: string;           // e.g. '2026-W29'
  week_start: string;           // ISO date (Monday)
  week_end: string;             // ISO date (Friday)
  location_zone: string | null; // NULL = aggregated across all zones
  required_headcount: number;
  available_headcount: number;
  required_hours: number;
  available_hours: number;
  gap_headcount: number;        // available - required (negative = shortage)
  gap_hours: number;
  utilization_pct: number | null; // required/available * 100 (null if available=0)
  shortage_risk: ShortageRiskLevel;
  critical_path_impact: boolean;
  affected_activity_keys: string[];  // activity_key values
  affected_resource_keys: string[];  // resource_key values
  metadata: Record<string, unknown>;
  computed_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Audit Logs ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "task_status_changed"
  | "prompt_copied"
  | "prompt_sent_to_ai"
  | "task_blocked"
  | "task_completed"
  | "task_unblocked"
  | "export";

export interface AuditLog {
  id: string;
  organization_id: string;
  project_id: string | null;
  actor_user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Database Type Map ──────────────────────────────────────────────────────────

/**
 * Maps table names to their TypeScript row types.
 * Useful for generic helpers: type Row = DatabaseTables[TableName]
 */
export interface DatabaseTables {
  organizations: Organization;
  profiles: Profile;
  organization_members: OrganizationMember;
  projects: Project;
  stakeholders: Stakeholder;
  communication_items: CommunicationItem;
  meetings: Meeting;
  project_events: ProjectEvent;
  meeting_attendees: MeetingAttendee;
  decisions: Decision;
  documents: Document;
  project_memory_items: ProjectMemoryItem;
  traceability_links: TraceabilityLink;
  ai_runs: AiRun;
  action_items: ActionItem;
  audit_logs: AuditLog;
  milestones: Milestone;
  roadmap_tasks: RoadmapTask;
  task_dependencies: TaskDependency;
  process_nodes: ProcessNode;
  process_edges: ProcessEdge;
  process_snapshots: ProcessSnapshot;
  trade_taxonomy: TradeTaxonomy;
  labor_resources: LaborResource;
  construction_activities: ConstructionActivity;
  activity_dependencies: ActivityDependency;
  labor_weekly_capacity: LaborWeeklyCapacity;
  // ── Universal execution model (20260708000000) ──
  suppliers: Supplier;
  resources: Resource;
  budget_items: BudgetItem;
  cost_actuals: CostActual;
  material_requirements: MaterialRequirement;
  procurement_items: ProcurementItem;
  risks: Risk;
  rfis: Rfi;
  submittals: Submittal;
  inspections: Inspection;
  permits: Permit;
  resource_assignments: ResourceAssignment;
  critical_path_snapshots: CriticalPathSnapshot;
}

/** Union of all table names */
export type TableName = keyof DatabaseTables;

// ── Universal Execution Model re-exports ──────────────────────────────────────

import type {
  ProjectType,
  ProjectModule,
  Supplier,
  Resource,
  BudgetItem,
  CostActual,
  MaterialRequirement,
  ProcurementItem,
  Risk,
  Rfi,
  Submittal,
  Inspection,
  Permit,
  ResourceAssignment,
  CriticalPathSnapshot,
} from "./execution";

export type {
  ProjectType,
  ProjectModule,
  UniversalStatus,
  Supplier,
  SupplierType,
  Resource,
  ResourceType,
  ResourceStatus,
  AvailabilityWindow,
  BudgetItem,
  BudgetCategory,
  BudgetItemStatus,
  CostActual,
  MaterialRequirement,
  MaterialStatus,
  ProcurementItem,
  ProcurementStatus,
  Risk,
  RiskCategory,
  RiskSeverity,
  RiskStatus,
  Rfi,
  RfiStatus,
  Submittal,
  SubmittalStatus,
  Inspection,
  InspectionStatus,
  Permit,
  PermitStatus,
  ResourceAssignment,
  AssignmentType,
  CriticalPathSnapshot,
  CriticalPathTrigger,
  RecordOrigin,
} from "./execution";
