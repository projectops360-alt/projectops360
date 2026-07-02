// ============================================================================
// ProjectOps360° — MPF Engine · Event Semantics Map (Phase 3, Task 2)
// ============================================================================
// The deterministic, provenance-agnostic mapping from EACH canonical event type
// (src/lib/events/registry.ts) to its milestone-flow meaning. This is the single
// source of truth for "what does this event mean for milestone flow?". It does
// NOT invent event names — every key is a real registered canonical event.
//
// It produces only FACTS and INFERENCES + directional signals. It never computes
// final health, durations, or bottlenecks (those are later Phase 3 tasks). It
// never mutates events, project_event_log, process_nodes, or process_edges.
// ============================================================================

import type { MilestoneFlowEventSemantics } from "./event-semantics-types";

// Defaults keep the map terse: an entry only states what differs from "a neutral,
// deterministic, high-confidence business fact with no flow signal".
const DEFAULTS: Omit<MilestoneFlowEventSemantics, "canonicalEventType" | "semanticCategory"> = {
  flowSegmentType: "unknown",
  transitionSignal: "no_transition_signal",
  healthSignal: "neutral",
  frictionType: null,
  bottleneckCandidateType: null,
  constraintPropagationSignal: "no_constraint_signal",
  reworkSignal: "no_rework_signal",
  evidenceKind: "fact",
  confidenceImpact: "eligible_high",
  provenanceHandling: "respect_event_provenance",
  replayBehavior: "deterministic",
  notes: "",
};

function sem(
  canonicalEventType: string,
  semanticCategory: MilestoneFlowEventSemantics["semanticCategory"],
  overrides: Partial<Omit<MilestoneFlowEventSemantics, "canonicalEventType" | "semanticCategory">> = {},
): MilestoneFlowEventSemantics {
  return { ...DEFAULTS, canonicalEventType, semanticCategory, ...overrides };
}

// Shorthand for DERIVED_EVENT-class canonical events (already computed by other
// engines): treat as inference and cap confidence at medium.
const DERIVED = {
  evidenceKind: "inference",
  confidenceImpact: "cap_medium",
  provenanceHandling: "treat_as_derived_inference",
} as const;

/**
 * MILESTONE_FLOW_EVENT_SEMANTICS — every registered canonical event mapped.
 * Coverage is enforced by validateMilestoneFlowEventSemanticsMap().
 */
export const MILESTONE_FLOW_EVENT_SEMANTICS: Record<string, MilestoneFlowEventSemantics> = {
  // ── Project (project-level; not a milestone transition by itself) ──────────
  ProjectCreated: sem("ProjectCreated", "project", { notes: "Project defined; no milestone-flow signal." }),
  ProjectStarted: sem("ProjectStarted", "project", { notes: "Project-level start; milestone transitions open via Milestone/Phase events." }),
  ProjectPaused: sem("ProjectPaused", "project", { flowSegmentType: "waiting", healthSignal: "degrades_health", notes: "Project paused; execution waiting." }),
  ProjectResumed: sem("ProjectResumed", "project", { healthSignal: "indicates_recovery", notes: "Project resumed." }),
  ProjectClosed: sem("ProjectClosed", "project", { notes: "Project closed; milestone closure carried by Milestone/Closeout events." }),
  ProjectArchived: sem("ProjectArchived", "project", { notes: "Project archived." }),
  ProjectReopened: sem("ProjectReopened", "project", { healthSignal: "indicates_regression", reworkSignal: "indicates_possible_rework", notes: "Project reopened after closure; possible rework." }),
  ProjectTypeChanged: sem("ProjectTypeChanged", "project", { notes: "Project type changed." }),
  ProjectOwnerChanged: sem("ProjectOwnerChanged", "project", { frictionType: "ownership", notes: "Project ownership changed." }),
  ProjectHealthChanged: sem("ProjectHealthChanged", "project", { ...DERIVED, healthSignal: "unknown", notes: "Derived health change; direction is in payload (rag), not inferable from type." }),

  // ── Milestone / Phase (the transition anchors) ────────────────────────────
  MilestoneCreated: sem("MilestoneCreated", "milestone", { notes: "Milestone defined (target); does not open a transition." }),
  MilestoneUpdated: sem("MilestoneUpdated", "milestone", { notes: "Milestone metadata updated." }),
  MilestoneStarted: sem("MilestoneStarted", "milestone", { transitionSignal: "opens_transition", flowSegmentType: "active_work", notes: "Work toward the milestone begins — opens a transition corridor." }),
  MilestoneAchieved: sem("MilestoneAchieved", "milestone", { transitionSignal: "closes_transition", flowSegmentType: "active_work", healthSignal: "improves_health", constraintPropagationSignal: "resolves_constraint", notes: "Milestone reached — closes the transition." }),
  MilestoneMissed: sem("MilestoneMissed", "milestone", { healthSignal: "degrades_health", notes: "Milestone missed (critical); degrades transition health." }),
  MilestoneDelayed: sem("MilestoneDelayed", "milestone", { flowSegmentType: "waiting", healthSignal: "degrades_health", notes: "Milestone delayed; execution waiting." }),
  MilestoneForecastChanged: sem("MilestoneForecastChanged", "milestone", { ...DERIVED, healthSignal: "unknown", notes: "Derived forecast change; direction not inferable from type." }),
  MilestoneReadinessChanged: sem("MilestoneReadinessChanged", "milestone", { ...DERIVED, healthSignal: "unknown", notes: "Derived readiness change; direction in payload." }),
  PhaseCreated: sem("PhaseCreated", "phase", { notes: "Phase defined." }),
  PhaseStarted: sem("PhaseStarted", "phase", { transitionSignal: "opens_transition", flowSegmentType: "active_work", notes: "Phase started — opens a transition corridor." }),
  PhaseCompleted: sem("PhaseCompleted", "phase", { transitionSignal: "closes_transition", flowSegmentType: "active_work", healthSignal: "improves_health", notes: "Phase completed — closes the transition." }),

  // ── Task / Work ───────────────────────────────────────────────────────────
  TaskCreated: sem("TaskCreated", "work", { notes: "Task defined (planning); no flow signal yet." }),
  TaskUpdated: sem("TaskUpdated", "work", { notes: "Task metadata updated." }),
  TaskAssigned: sem("TaskAssigned", "work", { notes: "Owner assigned; relieves ownership gap." }),
  TaskUnassigned: sem("TaskUnassigned", "work", { frictionType: "ownership", bottleneckCandidateType: "ownership", notes: "Owner removed; possible ownership friction." }),
  TaskStarted: sem("TaskStarted", "work", { transitionSignal: "progresses_transition", flowSegmentType: "active_work", notes: "Work active on a task." }),
  TaskPaused: sem("TaskPaused", "work", { flowSegmentType: "waiting", notes: "Task paused; work not advancing." }),
  TaskResumed: sem("TaskResumed", "work", { transitionSignal: "resumes_transition", flowSegmentType: "active_work", notes: "Task resumed." }),
  TaskBlocked: sem("TaskBlocked", "blocker", { transitionSignal: "blocks_transition", flowSegmentType: "blocked", healthSignal: "blocks_health", constraintPropagationSignal: "creates_constraint", notes: "Active impediment blocks the task; blocks flow." }),
  TaskUnblocked: sem("TaskUnblocked", "blocker", { transitionSignal: "unblocks_transition", flowSegmentType: "active_work", healthSignal: "indicates_recovery", constraintPropagationSignal: "resolves_constraint", notes: "Impediment cleared; flow can resume." }),
  TaskCompleted: sem("TaskCompleted", "work", { transitionSignal: "progresses_transition", flowSegmentType: "active_work", healthSignal: "improves_health", notes: "Task completed; contributes to milestone progress." }),
  TaskReopened: sem("TaskReopened", "work", { transitionSignal: "reopens_transition", flowSegmentType: "rework", reworkSignal: "starts_rework", healthSignal: "indicates_regression", notes: "Completed work reopened — rework." }),
  TaskCancelled: sem("TaskCancelled", "work", { notes: "Task cancelled." }),
  TaskDeleted: sem("TaskDeleted", "work", { notes: "Task deleted (audit)." }),
  TaskMoved: sem("TaskMoved", "work", { notes: "Task moved (board/position)." }),
  TaskStatusChanged: sem("TaskStatusChanged", "work", { transitionSignal: "progresses_transition", flowSegmentType: "active_work", notes: "Task status changed; direction depends on to_state." }),
  TaskEstimateChanged: sem("TaskEstimateChanged", "work", { notes: "Task estimate changed." }),
  TaskDueDateChanged: sem("TaskDueDateChanged", "work", { notes: "Task due date changed (schedule)." }),
  TaskPriorityChanged: sem("TaskPriorityChanged", "work", { notes: "Task priority changed." }),
  TaskDependencyAdded: sem("TaskDependencyAdded", "dependency", { frictionType: "dependency", bottleneckCandidateType: "dependency", constraintPropagationSignal: "creates_constraint", notes: "Dependency added; may constrain downstream flow." }),
  TaskDependencyRemoved: sem("TaskDependencyRemoved", "dependency", { constraintPropagationSignal: "resolves_constraint", notes: "Dependency removed; constraint relieved." }),

  // ── Risk / Issue ──────────────────────────────────────────────────────────
  RiskIdentified: sem("RiskIdentified", "risk", { healthSignal: "increases_risk", constraintPropagationSignal: "creates_constraint", notes: "Risk identified." }),
  RiskEscalated: sem("RiskEscalated", "risk", { healthSignal: "increases_risk", constraintPropagationSignal: "intensifies_constraint", notes: "Risk escalated (critical)." }),
  RiskMitigated: sem("RiskMitigated", "risk", { healthSignal: "indicates_recovery", constraintPropagationSignal: "reduces_constraint", notes: "Risk mitigated." }),
  RiskMaterialized: sem("RiskMaterialized", "risk", { healthSignal: "degrades_health", reworkSignal: "indicates_possible_rework", constraintPropagationSignal: "intensifies_constraint", notes: "Risk materialized; may force rework." }),
  RiskClosed: sem("RiskClosed", "risk", { healthSignal: "indicates_recovery", constraintPropagationSignal: "resolves_constraint", notes: "Risk closed." }),
  IssueRaised: sem("IssueRaised", "issue", { healthSignal: "degrades_health", constraintPropagationSignal: "creates_constraint", notes: "Issue raised." }),
  IssueEscalated: sem("IssueEscalated", "issue", { healthSignal: "degrades_health", constraintPropagationSignal: "intensifies_constraint", notes: "Issue escalated (critical)." }),
  IssueResolved: sem("IssueResolved", "issue", { healthSignal: "indicates_recovery", constraintPropagationSignal: "resolves_constraint", notes: "Issue resolved." }),

  // ── Decision ──────────────────────────────────────────────────────────────
  DecisionProposed: sem("DecisionProposed", "decision", { flowSegmentType: "decision_delay", frictionType: "decision", bottleneckCandidateType: "decision", constraintPropagationSignal: "creates_constraint", notes: "Decision open/proposed; downstream may wait — decision delay." }),
  DecisionMade: sem("DecisionMade", "decision", { transitionSignal: "progresses_transition", flowSegmentType: "active_work", healthSignal: "improves_health", constraintPropagationSignal: "resolves_constraint", notes: "Decision resolved; unblocks dependent work." }),
  DecisionDeferred: sem("DecisionDeferred", "decision", { flowSegmentType: "decision_delay", frictionType: "decision", bottleneckCandidateType: "decision", healthSignal: "degrades_health", constraintPropagationSignal: "intensifies_constraint", notes: "Decision deferred; delay continues." }),
  DecisionReversed: sem("DecisionReversed", "decision", { transitionSignal: "reopens_transition", flowSegmentType: "rework", reworkSignal: "starts_rework", healthSignal: "indicates_regression", notes: "Decision reversed; may invalidate completed work — rework." }),

  // ── Approval ──────────────────────────────────────────────────────────────
  ApprovalRequested: sem("ApprovalRequested", "approval", { flowSegmentType: "approval_delay", frictionType: "approval", bottleneckCandidateType: "approval", constraintPropagationSignal: "creates_constraint", notes: "Approval requested/pending; downstream may wait — approval delay." }),
  ApprovalGranted: sem("ApprovalGranted", "approval", { transitionSignal: "progresses_transition", flowSegmentType: "active_work", healthSignal: "improves_health", constraintPropagationSignal: "resolves_constraint", notes: "Approval granted; unblocks dependent work." }),
  ApprovalRejected: sem("ApprovalRejected", "approval", { transitionSignal: "reopens_transition", flowSegmentType: "rework", reworkSignal: "starts_rework", frictionType: "approval", healthSignal: "indicates_regression", notes: "Approval rejected; forces correction — rework." }),
  ApprovalExpired: sem("ApprovalExpired", "approval", { flowSegmentType: "approval_delay", frictionType: "approval", bottleneckCandidateType: "approval", healthSignal: "degrades_health", constraintPropagationSignal: "intensifies_constraint", notes: "Approval expired (system); approval delay persists. Closest taxonomy match to 'approval delayed'." }),

  // ── Change / Scope (also covers 'requirement changed' — see doc) ───────────
  ScopeChanged: sem("ScopeChanged", "scope", { frictionType: "scope_change", reworkSignal: "indicates_possible_rework", healthSignal: "degrades_health", constraintPropagationSignal: "creates_constraint", notes: "Scope changed; may invalidate work — possible rework. No separate RequirementChanged event exists." }),

  // ── Document / Drawing (deliverable-family in current taxonomy) ────────────
  DocumentUploaded: sem("DocumentUploaded", "deliverable", { flowSegmentType: "review", notes: "Deliverable submitted (document) — enters review." }),
  DocumentApproved: sem("DocumentApproved", "deliverable", { transitionSignal: "progresses_transition", flowSegmentType: "active_work", healthSignal: "improves_health", constraintPropagationSignal: "resolves_constraint", notes: "Deliverable accepted (document approved)." }),
  DrawingUploaded: sem("DrawingUploaded", "document", { flowSegmentType: "review", notes: "Drawing submitted — enters review." }),
  DrawingRevised: sem("DrawingRevised", "document", { flowSegmentType: "rework", reworkSignal: "indicates_possible_rework", frictionType: "quality", notes: "Drawing revised; possible rework." }),

  // ── Quality ───────────────────────────────────────────────────────────────
  DefectRaised: sem("DefectRaised", "quality", { frictionType: "quality", bottleneckCandidateType: "quality", reworkSignal: "indicates_possible_rework", healthSignal: "degrades_health", constraintPropagationSignal: "creates_constraint", notes: "Defect raised; likely rework. Closest match to 'deliverable rejected'." }),

  // ── Meeting / Communication ───────────────────────────────────────────────
  MeetingHeld: sem("MeetingHeld", "meeting", { notes: "Meeting evidence (coordination); factual, no direct flow signal." }),
  ActionItemCreated: sem("ActionItemCreated", "meeting", { notes: "Action item captured." }),
  CommitmentMade: sem("CommitmentMade", "communication", { notes: "Commitment recorded." }),
  CommunicationSent: sem("CommunicationSent", "communication", { notes: "Communication sent." }),

  // ── Budget / Cost ─────────────────────────────────────────────────────────
  CostIncurred: sem("CostIncurred", "cost", { notes: "Cost incurred (fact)." }),
  CostVarianceDetected: sem("CostVarianceDetected", "cost", { ...DERIVED, healthSignal: "degrades_health", notes: "Derived cost variance (critical)." }),

  // ── Resource / Capacity ───────────────────────────────────────────────────
  ResourceAssigned: sem("ResourceAssigned", "resource", { notes: "Resource assigned; relieves resource gap." }),
  CapacityExceeded: sem("CapacityExceeded", "resource", { ...DERIVED, flowSegmentType: "waiting", frictionType: "resource", bottleneckCandidateType: "resource", healthSignal: "degrades_health", constraintPropagationSignal: "creates_constraint", notes: "Derived capacity overrun; resource friction." }),

  // ── Closeout / Learning ───────────────────────────────────────────────────
  CloseoutStarted: sem("CloseoutStarted", "closeout", { transitionSignal: "opens_transition", flowSegmentType: "active_work", notes: "Closeout transition opened." }),
  LessonLearnedCaptured: sem("LessonLearnedCaptured", "lessons", { notes: "Lesson learned captured (learning corpus)." }),

  // ── AI-Native ─────────────────────────────────────────────────────────────
  AIExecutionRecordCreated: sem("AIExecutionRecordCreated", "ai", { evidenceKind: "inference", confidenceImpact: "cap_medium", provenanceHandling: "treat_as_derived_inference", notes: "AI execution record; derived, not a canonical flow fact." }),
  AIResultReviewed: sem("AIResultReviewed", "ai", { evidenceKind: "inference", confidenceImpact: "cap_medium", provenanceHandling: "treat_as_derived_inference", notes: "AI result reviewed; derived." }),

  // ── Isabella (AI interaction; never a canonical flow fact) ─────────────────
  IsabellaRecommendationGenerated: sem("IsabellaRecommendationGenerated", "isabella", { evidenceKind: "inference", confidenceImpact: "cap_low", provenanceHandling: "treat_as_derived_inference", notes: "Isabella artifact; weak evidence, not canonical flow truth." }),
  IsabellaBriefingGenerated: sem("IsabellaBriefingGenerated", "isabella", { evidenceKind: "inference", confidenceImpact: "cap_low", provenanceHandling: "treat_as_derived_inference", notes: "Isabella briefing artifact; weak evidence." }),

  // ── System ────────────────────────────────────────────────────────────────
  ImportCompleted: sem("ImportCompleted", "system", { notes: "Import completed (audit)." }),
  SnapshotCreated: sem("SnapshotCreated", "system", { notes: "Snapshot created." }),
  BackfillCompleted: sem("BackfillCompleted", "backfill", { notes: "Audit marker for a historical backfill run (not itself a flow signal)." }),
  IntegrationSyncFailed: sem("IntegrationSyncFailed", "system", { frictionType: "external_constraint", notes: "External integration sync failed." }),

  // ── Portfolio ─────────────────────────────────────────────────────────────
  ResourceContentionDetected: sem("ResourceContentionDetected", "portfolio", { ...DERIVED, frictionType: "resource", bottleneckCandidateType: "resource", healthSignal: "increases_risk", constraintPropagationSignal: "propagates_constraint", notes: "Derived cross-project resource contention." }),
};
