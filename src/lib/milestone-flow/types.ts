// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Types (Phase 3, Task 1)
// ============================================================================
// The canonical type foundation every future MPF task consumes. These types
// describe DERIVED milestone-flow intelligence only. They are never canonical
// business truth (Constitution §6.3): every derived conclusion carries evidence
// refs and a confidence level, and the honest default is "unknown".
//
// The engine READS the Project Event Graph; it never mutates it. Event evidence
// is referenced by id via MilestoneFlowEventRef — the engine holds a read-only
// projection of events, never a writable handle to project_event_log.
// ============================================================================

import type {
  MPF_TRANSITION_STATUSES,
  MPF_SEGMENT_TYPES,
  MPF_HEALTH_STATUSES,
  MPF_FRICTION_TYPES,
  MPF_BOTTLENECK_TYPES,
  MPF_PROPAGATION_TYPES,
  MPF_EVIDENCE_KINDS,
  MPF_EVIDENCE_CONFIDENCE_LEVELS,
  MPF_DATA_QUALITY_FLAGS,
  MPF_ACCESS_SCOPES,
} from "./constants";
// Type-only import (erased at runtime → no import cycle) for the Task 5 finding
// used by the projection's optional findingsByTransition.
import type { MilestoneFlowDetectionFinding } from "./delay-detector-types";

// ── 1. Engine identity ────────────────────────────────────────────────────────

export type MilestoneProcessFlowEngineVersion = string;
export type MilestoneProcessFlowRunId = string;
export type MilestoneProcessFlowConfigVersion = string;

// ── 2. Scope ──────────────────────────────────────────────────────────────────

export interface MilestoneFlowOrganizationScope {
  organizationId: string;
}

export interface MilestoneFlowPortfolioScope extends MilestoneFlowOrganizationScope {
  portfolioId: string;
}

export interface MilestoneFlowProgramScope extends MilestoneFlowOrganizationScope {
  programId: string;
  portfolioId?: string | null;
}

export interface MilestoneFlowProjectScope extends MilestoneFlowOrganizationScope {
  projectId: string;
  portfolioId?: string | null;
  programId?: string | null;
}

/** Any authorized scope the engine can be invoked against. */
export type MilestoneFlowScope =
  | MilestoneFlowProjectScope
  | MilestoneFlowProgramScope
  | MilestoneFlowPortfolioScope
  | MilestoneFlowOrganizationScope;

// ── Read-only inputs (canonical data the engine CONSUMES, never owns) ─────────

/**
 * A read-only projection of a project_event_log row. The engine consumes events
 * by value; it never receives a mutable handle. Only the fields relevant to
 * flow interpretation are surfaced (Constitution §11.3).
 */
export interface MilestoneFlowEventRef {
  eventId: string;
  eventType: string;
  eventCategory: string;
  occurredAt: string; // ISO
  subjectType: string;
  subjectId: string | null;
  fromState: string | null;
  toState: string | null;
  /** Provenance flags — backfilled/synthetic events are lower confidence. */
  lifecycleClass: string;
  confidence: number | null;
  isCompensatingEvent: boolean;
  /**
   * The canonical milestone this event pertains to, when the source row exposes
   * it (e.g. `payload.milestone_id` or a milestone subject). Optional and
   * additive — used by the Transition Builder for explicit event assignment.
   */
  milestoneId?: string | null;
}

/** Read-only canonical milestone data (owned by the Milestone domain). */
export interface MilestoneFlowMilestoneRef {
  milestoneId: string;
  name: string;
  type: string | null;
  plannedDate: string | null; // ISO
  forecastDate: string | null; // ISO
  actualDate: string | null; // ISO
  ownerId: string | null;
  status: string | null;
  /** The canonical predecessor milestone, when defined. */
  predecessorMilestoneId?: string | null;
}

// ── 3. Milestone transition ───────────────────────────────────────────────────

export type MilestoneTransitionId = string;
export type MilestoneTransitionStatus = (typeof MPF_TRANSITION_STATUSES)[number];

/** The live condition of a transition, derived from the latest evidence. */
export interface MilestoneTransitionState {
  status: MilestoneTransitionStatus;
  /** The dominant segment type at the point of assessment. */
  currentSegmentType: MilestoneFlowSegmentType | null;
  isBlocked: boolean;
  lastEventAt: string | null; // ISO
}

export interface MilestoneTransition {
  transitionId: MilestoneTransitionId;
  scope: MilestoneFlowProjectScope;
  sourceMilestoneId: string | null;
  targetMilestoneId: string;
  startedAt: string | null; // ISO
  completedAt: string | null; // ISO
  state: MilestoneTransitionState;
  segments: MilestoneFlowSegment[];
  /** Every event id that contributed to this transition (read-only refs). */
  evidenceEventIds: string[];
}

// ── 4. Flow segment ───────────────────────────────────────────────────────────

export type MilestoneFlowSegmentId = string;
export type MilestoneFlowSegmentType = (typeof MPF_SEGMENT_TYPES)[number];

export interface MilestoneFlowSegment {
  segmentId: MilestoneFlowSegmentId;
  transitionId: MilestoneTransitionId;
  type: MilestoneFlowSegmentType;
  startedAt: string | null; // ISO
  endedAt: string | null; // ISO
  durationMs: number | null;
  /** Cause classification when the segment is a waiting/blocked kind. */
  frictionType?: MilestoneFlowFrictionType | null;
  evidence: MilestoneFlowEvidenceRef[];
}

// ── 5. Flow metrics ───────────────────────────────────────────────────────────

export interface MilestoneTransitionDurationMetrics {
  plannedDurationMs: number | null;
  actualDurationMs: number | null;
  forecastDurationMs: number | null;
}

export interface MilestoneFlowEfficiencyMetrics {
  /** activeWork / (activeWork + waiting + blocked). Null when indeterminate. */
  flowEfficiencyRatio: number | null;
  waitingTimePct: number | null;
  blockedTimePct: number | null;
}

export interface MilestoneFlowMetrics {
  duration: MilestoneTransitionDurationMetrics;
  activeWorkTimeMs: number | null;
  waitingTimeMs: number | null;
  blockedTimeMs: number | null;
  decisionDelayTimeMs: number | null;
  approvalDelayTimeMs: number | null;
  reworkTimeMs: number | null;
  reworkLoops: number | null;
  escalationCount: number | null;
  unresolvedConstraintCount: number | null;
  efficiency: MilestoneFlowEfficiencyMetrics;
}

// ── 6. Transition health ──────────────────────────────────────────────────────

export type MilestoneTransitionHealthStatus = (typeof MPF_HEALTH_STATUSES)[number];

export interface MilestoneTransitionHealthReason {
  /** Short machine key, e.g. "approval_pending_blocking". */
  code: string;
  /** Human-readable, evidence-grounded explanation. */
  detail: string;
  evidence: MilestoneFlowEvidenceRef[];
}

export interface MilestoneTransitionHealth {
  transitionId: MilestoneTransitionId;
  status: MilestoneTransitionHealthStatus;
  /** Optional numeric score when scoring is enabled; null otherwise. */
  score: number | null;
  confidence: MilestoneFlowEvidenceConfidence;
  reasons: MilestoneTransitionHealthReason[];
}

export interface MilestoneTransitionHealthSummary {
  transitionId: MilestoneTransitionId;
  status: MilestoneTransitionHealthStatus;
  score: number | null;
  keyReason: string | null;
  topFrictionSources: MilestoneFlowFrictionType[];
  currentBlockers: MilestoneFlowEvidenceRef[];
  downstreamImpact: string | null;
  recommendedActionCategory: string | null;
  confidence: MilestoneFlowEvidenceConfidence;
  uncertaintyNotes: string[];
}

// ── 7. Friction & bottlenecks ─────────────────────────────────────────────────

export type MilestoneFlowFrictionType = (typeof MPF_FRICTION_TYPES)[number];
export type MilestoneFlowBottleneckType = (typeof MPF_BOTTLENECK_TYPES)[number];

export interface MilestoneFlowBottleneckClassification {
  transitionId: MilestoneTransitionId;
  type: MilestoneFlowBottleneckType;
  /** True when recurring/structural, false when a one-off delay. Constitution §8.8. */
  structural: boolean;
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  confidence: MilestoneFlowEvidenceConfidence;
  evidence: MilestoneFlowEvidenceRef[];
}

// ── 8. Constraint propagation ─────────────────────────────────────────────────

export type MilestoneConstraintPropagationType = (typeof MPF_PROPAGATION_TYPES)[number];

export interface MilestoneConstraintPropagation {
  type: MilestoneConstraintPropagationType;
  originEventId: string | null;
  originEntityId: string | null;
  originTransitionId: MilestoneTransitionId | null;
  affectedMilestoneIds: string[];
  affectedTransitionIds: MilestoneTransitionId[];
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  confidence: MilestoneFlowEvidenceConfidence;
  evidence: MilestoneFlowEvidenceRef[];
}

// ── 9. Evidence ───────────────────────────────────────────────────────────────

export type MilestoneFlowEvidenceKind = (typeof MPF_EVIDENCE_KINDS)[number];
export type MilestoneFlowEvidenceConfidence = (typeof MPF_EVIDENCE_CONFIDENCE_LEVELS)[number];

/**
 * A single traceable pointer back to the evidence supporting a conclusion.
 * At least one of eventId / metricRef must be present for a `fact`.
 */
export interface MilestoneFlowEvidenceRef {
  kind: MilestoneFlowEvidenceKind;
  /** A project_event_log event id, when the evidence is an event. */
  eventId?: string | null;
  /** A metric path, e.g. "metrics.approvalDelayTimeMs", when derived from a metric. */
  metricRef?: string | null;
  /** Free-text note (e.g. an uncertainty caveat). */
  note?: string | null;
  confidence: MilestoneFlowEvidenceConfidence;
}

export interface MilestoneFlowEvidencePacket {
  transitionId: MilestoneTransitionId;
  refs: MilestoneFlowEvidenceRef[];
  /** Overall confidence for the packet (never higher than its weakest fact). */
  confidence: MilestoneFlowEvidenceConfidence;
  dataQualityFlags: MilestoneFlowDataQualityFlag[];
  uncertaintyNotes: string[];
}

export type MilestoneFlowDataQualityFlag = (typeof MPF_DATA_QUALITY_FLAGS)[number];

// ── 10. Isabella integration ──────────────────────────────────────────────────

export interface IsabellaMilestoneFlowRecommendedAction {
  /** Category only — not a natural-language sentence (Constitution §24). */
  category: string;
  targetRole: "pm" | "pmo" | "approver" | "owner" | "unknown";
  rationaleEvidence: MilestoneFlowEvidenceRef[];
}

/**
 * The five-part explanation frame Isabella MUST use. Each slot holds only
 * evidence-backed refs; Isabella never invents entries (Constitution §24).
 */
export interface IsabellaMilestoneFlowExplanationFrame {
  fact: MilestoneFlowEvidenceRef[];
  inference: MilestoneFlowEvidenceRef[];
  prediction: MilestoneFlowEvidenceRef[];
  recommendation: MilestoneFlowEvidenceRef[];
  uncertainty: MilestoneFlowEvidenceRef[];
}

export interface IsabellaMilestoneFlowEvidencePacket {
  scope: MilestoneFlowProjectScope;
  transitionId: MilestoneTransitionId;
  frame: IsabellaMilestoneFlowExplanationFrame;
  recommendedActions: IsabellaMilestoneFlowRecommendedAction[];
  confidence: MilestoneFlowEvidenceConfidence;
  uncertaintyNotes: string[];
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
}

// ── 11. Living Graph integration (consumer model, NO UI logic) ─────────────────

export interface LivingGraphMilestoneNode {
  milestoneId: string;
  label: string;
  status: string | null;
  plannedDate: string | null;
  actualDate: string | null;
}

export interface LivingGraphFlowSegmentViewModel {
  segmentId: MilestoneFlowSegmentId;
  type: MilestoneFlowSegmentType;
  durationMs: number | null;
  frictionType: MilestoneFlowFrictionType | null;
  /** Evidence drill-down references only — never rendered geometry. */
  evidenceEventIds: string[];
}

export interface LivingGraphMilestoneTransitionEdge {
  transitionId: MilestoneTransitionId;
  sourceMilestoneId: string | null;
  targetMilestoneId: string;
  healthStatus: MilestoneTransitionHealthStatus;
  segments: LivingGraphFlowSegmentViewModel[];
  /** Constraint propagation references for downstream drill-down. */
  constraintPropagationRefs: string[];
}

export interface LivingGraphMilestoneFlowModel {
  scope: MilestoneFlowProjectScope;
  nodes: LivingGraphMilestoneNode[];
  edges: LivingGraphMilestoneTransitionEdge[];
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
}

// ── 12. Observability ─────────────────────────────────────────────────────────

export interface MilestoneFlowEngineWarning {
  code: string;
  message: string;
  transitionId?: MilestoneTransitionId | null;
}

export interface MilestoneFlowEngineError {
  code: string;
  message: string;
  transitionId?: MilestoneTransitionId | null;
}

export interface MilestoneFlowEngineObservabilityEvent {
  at: string; // ISO
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface MilestoneFlowEngineRunContext {
  runId: MilestoneProcessFlowRunId;
  scope: MilestoneFlowScope;
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
  startedAt: string; // ISO
  /** Why the run was triggered (audit); optional in non-user contexts. */
  triggeredBy?: string | null;
  triggerReason?: string | null;
}

export interface MilestoneFlowEngineRunSummary {
  runId: MilestoneProcessFlowRunId;
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
  organizationId: string;
  projectId: string | null;
  inputEventCount: number;
  includedEventCount: number;
  excludedEventCount: number;
  exclusionReasons: string[];
  transitionCount: number;
  segmentCount: number;
  bottleneckCount: number;
  healthAssessmentCount: number;
  /** Builder-stage counts (Task 3) — default 0 when the builder did not run. */
  unassignedEventCount: number;
  unknownSegmentCount: number;
  openTransitionCount: number;
  completedTransitionCount: number;
  /** Metrics-stage counts (Task 4) — optional; default 0 when metrics did not run. */
  metricsCalculatedCount?: number;
  metricsUnknownCount?: number;
  openSegmentDurationCount?: number;
  invalidDurationCount?: number;
  totalKnownSegmentTimeMs?: number;
  /** Detection-stage counts (Task 5) — optional; default 0 when detection did not run. */
  delayFindingCount?: number;
  blockerFindingCount?: number;
  waitingFindingCount?: number;
  decisionDelayFindingCount?: number;
  approvalDelayFindingCount?: number;
  openFindingCount?: number;
  resolvedFindingCount?: number;
  unknownFindingCount?: number;
  highSeverityFindingCount?: number;
  warningCount: number;
  errorCount: number;
  startedAt: string; // ISO
  completedAt: string; // ISO
  durationMs: number;
  warnings: MilestoneFlowEngineWarning[];
  errors: MilestoneFlowEngineError[];
}

// ── 13. Security ──────────────────────────────────────────────────────────────

export type MilestoneFlowAccessScope = (typeof MPF_ACCESS_SCOPES)[number];

export interface MilestoneFlowAccessContext {
  userId: string;
  organizationId: string;
  scope: MilestoneFlowAccessScope;
  /** Projects the caller may read (PM-level). Empty = none. */
  authorizedProjectIds: string[];
  /** Portfolios/programs the caller may aggregate (PMO-level). */
  authorizedPortfolioIds?: string[];
  authorizedProgramIds?: string[];
  /** Whether the caller may inspect engine runs / observability (admin). */
  canInspectRuns?: boolean;
}

export interface MilestoneFlowAccessDecision {
  allowed: boolean;
  /** Denial reason for logs/UI; empty when allowed. */
  reason: string;
  /** The scope actually granted (may be narrower than requested). */
  grantedScope: MilestoneFlowAccessScope | null;
}

// ── Primary output: the Milestone Flow Projection ─────────────────────────────

export interface MilestoneFlowProjection {
  runId: MilestoneProcessFlowRunId;
  scope: MilestoneFlowProjectScope;
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
  generatedAt: string; // ISO
  transitions: MilestoneTransition[];
  metricsByTransition: Record<MilestoneTransitionId, MilestoneFlowMetrics>;
  healthByTransition: Record<MilestoneTransitionId, MilestoneTransitionHealth>;
  bottlenecks: MilestoneFlowBottleneckClassification[];
  constraintPropagations: MilestoneConstraintPropagation[];
  dataQualityFlags: MilestoneFlowDataQualityFlag[];
  /**
   * Delay/blocker detection findings keyed by transition (Task 5). Optional +
   * additive — detection is derived intelligence, never health. Structured for a
   * future Health Classifier / Bottleneck Detector to consume.
   */
  findingsByTransition?: Record<MilestoneTransitionId, MilestoneFlowDetectionFinding[]>;
  observability: MilestoneFlowEngineRunSummary;
}
