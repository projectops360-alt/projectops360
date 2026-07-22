// ============================================================================
// ProjectOps360° — Canonical Event Taxonomy Registry (Phase 2)
// ============================================================================
// The CLOSED vocabulary of the Project Event Graph. No module may emit an event
// type that is not registered here. Names are past-tense facts (TaskCreated,
// ApprovalGranted), never imperative (CreateTask). Corrections are compensating
// events, not new types. See docs/product-brain/00-product-constitution.md §4
// and the Canonical Event Taxonomy design.
// ============================================================================

export type EventImportance = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type RetentionClass =
  | "OPERATIONAL"
  | "AUDIT"
  | "COMPLIANCE"
  | "LEARNING"
  | "EPHEMERAL_EXCLUDED";
export type EventLifecycleClass =
  | "BUSINESS_EVENT"
  | "SYSTEM_EVENT"
  | "AI_EVENT"
  | "DERIVED_EVENT"
  | "EXTERNAL_EVENT"
  | "SYNTHETIC_BACKFILL_EVENT";
export type ActorType = "human" | "system" | "ai" | "external";

export interface EventDef {
  category: string;
  subjectType: string;
  importance: EventImportance;
  retention: RetentionClass;
  lifecycleClass: EventLifecycleClass;
  /** Event-specific payload keys that MUST be present (never envelope fields). */
  requiredPayload: string[];
  /** Extra projection-invalidation scope tags (beyond project/case/subject). */
  invalidationScopes?: string[];
}

const B: EventLifecycleClass = "BUSINESS_EVENT";
const SYS: EventLifecycleClass = "SYSTEM_EVENT";
const AI: EventLifecycleClass = "AI_EVENT";
const DER: EventLifecycleClass = "DERIVED_EVENT";

/** Registry — curated core covering the main categories. Extensible per pack. */
export const EVENT_REGISTRY: Record<string, EventDef> = {
  // ── Project ──
  ProjectCreated: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectStarted: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectPaused: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectResumed: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectClosed: { category: "project", subjectType: "project", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectArchived: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectReopened: { category: "project", subjectType: "project", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectTypeChanged: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["to"] },
  ProjectOwnerChanged: { category: "project", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ProjectHealthChanged: { category: "project", subjectType: "project", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: ["rag"] },

  // ── Task / Execution ──
  TaskCreated: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["title"] },
  TaskUpdated: { category: "task", subjectType: "task", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskAssigned: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["assignee_ref"] },
  TaskUnassigned: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskStarted: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskPaused: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskResumed: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskBlocked: { category: "blocker", subjectType: "task", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["impediment"] },
  TaskUnblocked: { category: "blocker", subjectType: "task", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskCompleted: { category: "task", subjectType: "task", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskReopened: { category: "task", subjectType: "task", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskCancelled: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskDeleted: { category: "task", subjectType: "task", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  TaskMoved: { category: "task", subjectType: "task", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskStatusChanged: { category: "task", subjectType: "task", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  TaskPromptPrepared: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskAISubmitted: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskImplemented: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskTested: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskDeferred: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskEstimateChanged: { category: "task", subjectType: "task", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskStartDateChanged: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  TaskDueDateChanged: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  TaskPriorityChanged: { category: "task", subjectType: "task", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskDependencyAdded: { category: "dependency", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["dependency_id"], invalidationScopes: ["scope:schedule"] },
  TaskDependencyRemoved: { category: "dependency", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["dependency_id"], invalidationScopes: ["scope:schedule"] },

  // ── Subtask (Task Execution Map) ──
  SubtaskCreated: { category: "task", subjectType: "subtask", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["title", "task_id"] },
  SubtaskUpdated: { category: "task", subjectType: "subtask", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"] },
  SubtaskStarted: { category: "task", subjectType: "subtask", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"] },
  SubtaskCompleted: { category: "task", subjectType: "subtask", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"] },
  SubtaskBlocked: { category: "blocker", subjectType: "subtask", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["impediment", "task_id"] },
  SubtaskUnblocked: { category: "blocker", subjectType: "subtask", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"] },
  SubtaskReassigned: { category: "task", subjectType: "subtask", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"] },
  SubtaskDueDateChanged: { category: "task", subjectType: "subtask", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"], invalidationScopes: ["scope:schedule"] },
  SubtaskEstimateChanged: { category: "task", subjectType: "subtask", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id"] },
  SubtaskProgressChanged: { category: "task", subjectType: "subtask", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["task_id", "new_value"] },
  SubtaskDeleted: { category: "task", subjectType: "subtask", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["task_id"] },
  ParentTaskProgressRecalculated: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: ["new_value"] },
  ParentTaskProgressOverride: { category: "task", subjectType: "task", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["reason", "new_value"] },

  // ── Milestone / Phase ──
  MilestoneCreated: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneUpdated: { category: "milestone", subjectType: "milestone", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneStarted: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneAchieved: { category: "milestone", subjectType: "milestone", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneMissed: { category: "milestone", subjectType: "milestone", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneDelayed: { category: "milestone", subjectType: "milestone", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneForecastChanged: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneReadinessChanged: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: [] },
  MilestoneBlocked: { category: "milestone", subjectType: "milestone", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneDeferred: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneReopened: { category: "milestone", subjectType: "milestone", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  MilestoneDeleted: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  PhaseCreated: { category: "planning", subjectType: "phase", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  PhaseStarted: { category: "planning", subjectType: "phase", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  PhaseCompleted: { category: "planning", subjectType: "phase", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },

  // ── Risk / Issue ──
  RiskIdentified: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["severity"], invalidationScopes: ["scope:risk"] },
  RiskEscalated: { category: "risk", subjectType: "risk", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  RiskMitigated: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  RiskMaterialized: { category: "risk", subjectType: "risk", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  RiskClosed: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  // ── Risk pilot — canonical snake_case vocabulary (P2-T2 / PD-018 §B.4) ──
  // Frozen contract: PD-016 §4 (24-event vocabulary) + PD-018 §A.4 naming.
  // Only the minimum pilot subset is registered; deferred events (signal,
  // classified, trigger, review, residual, escalated, retired, invalidated,
  // linked_object_changed) are added in their own phases. requiredPayload
  // enforces the RI invariants each event carries (RI-02, RI-07, resolution #11).
  risk_registered: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["origin"], invalidationScopes: ["scope:risk"] },
  risk_assessed: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["method", "values", "assessed_at"], invalidationScopes: ["scope:risk"] },
  risk_owner_assigned: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["new_owner"], invalidationScopes: ["scope:risk"] },
  risk_owner_changed: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["new_owner", "previous_owner"], invalidationScopes: ["scope:risk"] },
  risk_response_plan_approved: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["strategy"], invalidationScopes: ["scope:risk"] },
  risk_closure_requested: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  risk_closure_validated: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["validator"], invalidationScopes: ["scope:risk"] },
  risk_closed: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["closure_reason"], invalidationScopes: ["scope:risk"] },
  risk_reopened: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["reason_code"], invalidationScopes: ["scope:risk"] },
  risk_materialized: { category: "risk", subjectType: "risk", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["materialization_scope"], invalidationScopes: ["scope:risk"] },
  // Derived response trail — mapped from linked-task events under the explicit
  // rule of PD-016 event #11 (derivable only with an explicit rule; RI-13).
  risk_response_action_created: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: DER, requiredPayload: ["task_id"], invalidationScopes: ["scope:risk"] },
  risk_response_started: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: DER, requiredPayload: ["task_id"], invalidationScopes: ["scope:risk"] },
  risk_response_action_completed: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: DER, requiredPayload: ["task_id"], invalidationScopes: ["scope:risk"] },

  IssueRaised: { category: "issue", subjectType: "issue", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["severity"] },
  IssueEscalated: { category: "issue", subjectType: "issue", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  IssueResolved: { category: "issue", subjectType: "issue", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },

  // ── Decision / Approval ──
  DecisionProposed: { category: "decision", subjectType: "decision", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  DecisionMade: { category: "decision", subjectType: "decision", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["rationale"] },
  DecisionDeferred: { category: "decision", subjectType: "decision", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  DecisionReversed: { category: "decision", subjectType: "decision", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  ApprovalRequested: { category: "approval", subjectType: "approval", importance: "NORMAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["approver_ref"] },
  ApprovalGranted: { category: "approval", subjectType: "approval", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["approver_ref"] },
  ApprovalRejected: { category: "approval", subjectType: "approval", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["approver_ref"] },
  ApprovalExpired: { category: "approval", subjectType: "approval", importance: "NORMAL", retention: "COMPLIANCE", lifecycleClass: SYS, requiredPayload: [] },

  // ── Meeting / Communication ──
  MeetingHeld: { category: "meeting", subjectType: "meeting", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  ActionItemCreated: { category: "meeting", subjectType: "action_item", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  CommitmentMade: { category: "communication", subjectType: "commitment", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["owner_ref"] },
  CommunicationSent: { category: "communication", subjectType: "communication", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },

  // ── Document / Drawing ──
  DocumentUploaded: { category: "document", subjectType: "document", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  DocumentApproved: { category: "document", subjectType: "document", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  DrawingUploaded: { category: "drawing", subjectType: "drawing", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },
  DrawingRevised: { category: "drawing", subjectType: "drawing", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["rev"] },

  // ── Budget / Cost ──
  CostIncurred: { category: "budget", subjectType: "cost", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["amount"], invalidationScopes: ["scope:budget"] },
  CostVarianceDetected: { category: "budget", subjectType: "budget", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: DER, requiredPayload: [], invalidationScopes: ["scope:budget"] },
  financial_estimate_prepared: { category: "financial", subjectType: "financial_estimate", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["version"], invalidationScopes: ["scope:budget"] },
  financial_boe_approved: { category: "financial", subjectType: "financial_boe", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["version"], invalidationScopes: ["scope:budget"] },
  financial_baseline_activated: { category: "financial", subjectType: "financial_baseline", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["version", "amount", "currency"], invalidationScopes: ["scope:budget"] },
  funding_authorized: { category: "financial", subjectType: "funding_authorization", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  funding_released: { category: "financial", subjectType: "funding_movement", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  commitment_posted: { category: "financial", subjectType: "commitment_movement", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  actual_posted: { category: "financial", subjectType: "actual_cost", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  accrual_posted: { category: "financial", subjectType: "accrual_movement", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  financial_accrual_approved: { category: "financial", subjectType: "financial_accrual", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  financial_payment_approved: { category: "financial", subjectType: "financial_payment", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  payment_settled: { category: "financial", subjectType: "payment_movement", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget"] },
  financial_change_approved: { category: "financial", subjectType: "financial_change", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["change_type"], invalidationScopes: ["scope:budget", "scope:schedule"] },
  financial_change_posted: { category: "financial", subjectType: "financial_change", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["change_type"], invalidationScopes: ["scope:budget", "scope:schedule"] },
  reserve_released: { category: "financial", subjectType: "reserve_movement", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["amount", "currency"], invalidationScopes: ["scope:budget", "scope:risk"] },
  financial_snapshot_created: { category: "financial", subjectType: "financial_snapshot", importance: "NORMAL", retention: "AUDIT", lifecycleClass: DER, requiredPayload: ["formula_version"], invalidationScopes: ["scope:budget"] },
  financial_reconciliation_completed: { category: "financial", subjectType: "financial_reconciliation", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["status"], invalidationScopes: ["scope:budget"] },
  financial_period_closed: { category: "financial", subjectType: "financial_period", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["period_key"], invalidationScopes: ["scope:budget"] },
  financial_period_reopened: { category: "financial", subjectType: "financial_period", importance: "CRITICAL", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["period_key", "reason"], invalidationScopes: ["scope:budget"] },
  financial_record_reversed: { category: "financial", subjectType: "financial_record", importance: "HIGH", retention: "COMPLIANCE", lifecycleClass: B, requiredPayload: ["reason"], invalidationScopes: ["scope:budget"] },

  // ── Resource / Capacity ──
  ResourceAssigned: { category: "resource", subjectType: "resource", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["resource_ref"], invalidationScopes: ["scope:capacity"] },
  CapacityExceeded: { category: "resource", subjectType: "resource", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: [], invalidationScopes: ["scope:capacity"] },

  // ── Change / Scope ──
  ScopeChanged: { category: "change_control", subjectType: "scope", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:scope", "scope:schedule"] },

  // ── Quality ──
  DefectRaised: { category: "quality", subjectType: "defect", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["severity"] },

  // ── Closeout / Learning ──
  CloseoutStarted: { category: "closeout", subjectType: "closeout", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:closeout"] },
  LessonLearnedCaptured: { category: "lessons", subjectType: "lesson", importance: "NORMAL", retention: "LEARNING", lifecycleClass: B, requiredPayload: [] },

  // ── AI-Native (future-ready; producers not built) ──
  AIExecutionRecordCreated: { category: "ai_native", subjectType: "task", importance: "NORMAL", retention: "LEARNING", lifecycleClass: AI, requiredPayload: ["prompt_ref"] },
  AIResultReviewed: { category: "ai_native", subjectType: "task", importance: "NORMAL", retention: "LEARNING", lifecycleClass: AI, requiredPayload: [] },

  // ── Isabella (AI interaction / knowledge — never replaces canonical facts) ──
  IsabellaRecommendationGenerated: { category: "isabella", subjectType: "recommendation", importance: "NORMAL", retention: "LEARNING", lifecycleClass: AI, requiredPayload: [] },
  IsabellaBriefingGenerated: { category: "isabella", subjectType: "briefing", importance: "LOW", retention: "LEARNING", lifecycleClass: AI, requiredPayload: [] },

  // ── System ──
  ImportCompleted: { category: "system", subjectType: "import", importance: "NORMAL", retention: "AUDIT", lifecycleClass: SYS, requiredPayload: [] },
  SnapshotCreated: { category: "system", subjectType: "snapshot", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: SYS, requiredPayload: [] },
  BackfillCompleted: { category: "system", subjectType: "project", importance: "NORMAL", retention: "AUDIT", lifecycleClass: SYS, requiredPayload: [] },
  IntegrationSyncFailed: { category: "system", subjectType: "integration", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: SYS, requiredPayload: ["source"] },

  // ── Portfolio ──
  ResourceContentionDetected: { category: "portfolio", subjectType: "resource", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: [], invalidationScopes: ["scope:capacity"] },
};

// ── Risk pilot vocabularies & legacy migration (P2-T2 / PD-018) ──────────────

/** Resolution #11 (PD-018 §A.10, binding): the only valid closure reasons. */
export const CLOSURE_REASONS = [
  "mitigated", "avoided", "accepted", "expired", "materialized_transferred",
] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

/** PD-018 §A.1 row 12 — normalized capture methods. */
export const CAPTURE_METHODS = ["direct", "mapped", "derived", "imported"] as const;
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

/** PD-018 §A.7 — normalized data-quality flag vocabulary (extensible, versioned). */
export const DATA_QUALITY_FLAGS = [
  "missing_actor", "approximate_timestamp", "late_recorded", "derived",
  "backfilled", "imported", "single_source", "ordering_uncertain",
  "incomplete_payload", "unknown_reason", "legacy_ambiguous_semantics",
  "mapping_low_confidence", "unvalidated_closure", "bulk_closure",
  "missing_prior_closure",
] as const;
export type DataQualityFlag = (typeof DATA_QUALITY_FLAGS)[number];

/**
 * Legacy PascalCase risk types — DEPRECATED for new emissions (PD-018 §A.4).
 * Historical rows are never rewritten; reads resolve through the alias map.
 */
export const DEPRECATED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "RiskIdentified", "RiskEscalated", "RiskMitigated", "RiskMaterialized", "RiskClosed",
]);

/** Read-time alias map: legacy type → canonical type (+ mandatory quality flags). */
export const LEGACY_RISK_EVENT_ALIASES: Record<
  string,
  { canonical: string; dataQualityFlags: DataQualityFlag[] }
> = {
  RiskIdentified: { canonical: "risk_registered", dataQualityFlags: [] },
  RiskEscalated: { canonical: "risk_escalated", dataQualityFlags: [] },
  RiskMaterialized: { canonical: "risk_materialized", dataQualityFlags: [] },
  RiskClosed: { canonical: "risk_closed", dataQualityFlags: ["unknown_reason"] },
  // No canonical equivalent (PD-016 §12.4): conservative projection to the
  // response trail, always flagged as ambiguous.
  RiskMitigated: { canonical: "risk_response_action_completed", dataQualityFlags: ["legacy_ambiguous_semantics"] },
};

/** Resolve an event type for READ/projection: legacy aliases map to canonical. */
export function resolveCanonicalEventType(eventType: string): {
  canonical: string;
  isLegacyAlias: boolean;
  dataQualityFlags: DataQualityFlag[];
} {
  const alias = LEGACY_RISK_EVENT_ALIASES[eventType];
  if (alias) return { canonical: alias.canonical, isLegacyAlias: true, dataQualityFlags: alias.dataQualityFlags };
  return { canonical: eventType, isLegacyAlias: false, dataQualityFlags: [] };
}

/** Known but EPHEMERAL_EXCLUDED — must NEVER enter project_event_log. */
export const EPHEMERAL_EXCLUDED_EVENTS: ReadonlySet<string> = new Set([
  "MouseMoved",
  "ViewportMoved",
  "PageScrolled",
  "RecordViewed",
  "NodeHovered",
  "PanelResized",
]);

export const VALID_ACTOR_TYPES: ReadonlySet<string> = new Set(["human", "system", "ai", "external"]);
export const VALID_VISIBILITY: ReadonlySet<string> = new Set(["normal", "confidential", "audit_only"]);
export const VALID_IMPORTANCE: ReadonlySet<string> = new Set(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

export function getEventDef(eventType: string): EventDef | undefined {
  return EVENT_REGISTRY[eventType];
}

export function isRegisteredEvent(eventType: string): boolean {
  return Object.prototype.hasOwnProperty.call(EVENT_REGISTRY, eventType);
}

export function isEphemeralExcluded(eventType: string): boolean {
  return EPHEMERAL_EXCLUDED_EVENTS.has(eventType);
}

/** HIGH / CRITICAL events (or AI events) must carry evidence. */
export function requiresEvidence(importance: EventImportance): boolean {
  return importance === "HIGH" || importance === "CRITICAL";
}

const IMPERATIVE_FIRST_WORDS = new Set([
  "Create", "Update", "Delete", "Handle", "Get", "Set", "Make", "Add", "Remove",
  "Assign", "Approve", "Reject", "Start", "Complete", "Block", "Send", "Hold",
  "Raise", "Change", "Manage", "Process", "Run", "Do", "Fetch", "Save",
]);
const PAST_ENDINGS = /(?:ed|en|d|t|wn|ne|de|lt|nt|ld|ung|ozen|ought|aught)$/;
const IRREGULAR_PAST = new Set([
  "Made", "Sent", "Held", "Built", "Met", "Won", "Begun", "Chosen", "Frozen",
  "Written", "Known", "Shown", "Kept", "Left", "Read", "Put", "Set", "Undone",
]);

/** Heuristic: the event name reads as a past-tense fact, not an imperative.
 *  Supports both PascalCase (legacy) and canonical snake_case (PD-018 §A.4). */
export function isPastTenseName(name: string): boolean {
  const words = name.includes("_")
    ? name.split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    : name.match(/[A-Z][a-z0-9]*/g) ?? [];
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return false;
  if (IMPERATIVE_FIRST_WORDS.has(first)) return false;
  return IRREGULAR_PAST.has(last) || PAST_ENDINGS.test(last);
}
