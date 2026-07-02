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
  TaskEstimateChanged: { category: "task", subjectType: "task", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskDueDateChanged: { category: "task", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  TaskPriorityChanged: { category: "task", subjectType: "task", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  TaskDependencyAdded: { category: "dependency", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["dependency_id"], invalidationScopes: ["scope:schedule"] },
  TaskDependencyRemoved: { category: "dependency", subjectType: "task", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: ["dependency_id"], invalidationScopes: ["scope:schedule"] },

  // ── Milestone / Phase ──
  MilestoneCreated: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneUpdated: { category: "milestone", subjectType: "milestone", importance: "LOW", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneStarted: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  MilestoneAchieved: { category: "milestone", subjectType: "milestone", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneMissed: { category: "milestone", subjectType: "milestone", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneDelayed: { category: "milestone", subjectType: "milestone", importance: "HIGH", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneForecastChanged: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: [], invalidationScopes: ["scope:schedule"] },
  MilestoneReadinessChanged: { category: "milestone", subjectType: "milestone", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: DER, requiredPayload: [] },
  PhaseCreated: { category: "planning", subjectType: "phase", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  PhaseStarted: { category: "planning", subjectType: "phase", importance: "NORMAL", retention: "OPERATIONAL", lifecycleClass: B, requiredPayload: [] },
  PhaseCompleted: { category: "planning", subjectType: "phase", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [] },

  // ── Risk / Issue ──
  RiskIdentified: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["severity"], invalidationScopes: ["scope:risk"] },
  RiskEscalated: { category: "risk", subjectType: "risk", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  RiskMitigated: { category: "risk", subjectType: "risk", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  RiskMaterialized: { category: "risk", subjectType: "risk", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
  RiskClosed: { category: "risk", subjectType: "risk", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: [], invalidationScopes: ["scope:risk"] },
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
  DrawingRevised: { category: "drawing", subjectType: "drawing", importance: "HIGH", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["rev"] },

  // ── Budget / Cost ──
  CostIncurred: { category: "budget", subjectType: "cost", importance: "NORMAL", retention: "AUDIT", lifecycleClass: B, requiredPayload: ["amount"], invalidationScopes: ["scope:budget"] },
  CostVarianceDetected: { category: "budget", subjectType: "budget", importance: "CRITICAL", retention: "AUDIT", lifecycleClass: DER, requiredPayload: [], invalidationScopes: ["scope:budget"] },

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

/** Heuristic: the event name reads as a past-tense fact, not an imperative. */
export function isPastTenseName(name: string): boolean {
  const words = name.match(/[A-Z][a-z0-9]*/g) ?? [];
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return false;
  if (IMPERATIVE_FIRST_WORDS.has(first)) return false;
  return IRREGULAR_PAST.has(last) || PAST_ENDINGS.test(last);
}
