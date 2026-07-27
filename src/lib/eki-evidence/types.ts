// ============================================================================
// EKI Evidence Engine — types (Macrophase 2)
// ============================================================================
// Mirrors the closed vocabularies enforced by migration 20260864000000 and
// 20260865000000. The database is the enforcement point; these exist so a caller
// gets a usable error before a constraint raises one, and a guard test compares
// the two so they cannot drift.
// ============================================================================

/** The one resolver this macrophase implements. */
export const EVIDENCE_RESOLVERS = ["governance_audit_activity"] as const;

/**
 * Freshness outcomes.
 *
 * `unavailable` and `invalid` are deliberately distinct from `stale`: a source
 * that could not be read is a system fault, staleness is a control fault, and
 * conflating them misattributes the problem to the wrong owner.
 */
export const EVIDENCE_OUTCOMES = [
  "current",
  "approaching_stale",
  "stale",
  "unavailable",
  "invalid",
  "contradictory",
] as const;

/** Binding lifecycle. `stale` and `broken` are computed, never declared. */
export const BINDING_STATES = ["defined", "active", "stale", "broken", "retired"] as const;

/** Control lifecycle (EKI gate §4). */
export const CONTROL_STATES = [
  "proposed",
  "designed",
  "implemented",
  "operating",
  "degraded",
  "ineffective",
  "retired",
] as const;

/** The conditions that raise a finding. Each is a stated predicate, not a judgement. */
export const FINDING_CONDITIONS = [
  "evidence_missing",
  "evidence_stale",
  "evidence_unavailable",
  "evidence_invalid",
  "evidence_contradictory",
  "control_lost_operating",
] as const;

export const FINDING_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const FINDING_RESOLUTIONS = ["resolved", "accepted"] as const;

export type EvidenceResolver = (typeof EVIDENCE_RESOLVERS)[number];
export type EvidenceOutcome = (typeof EVIDENCE_OUTCOMES)[number];
export type BindingState = (typeof BINDING_STATES)[number];
export type ControlState = (typeof CONTROL_STATES)[number];
export type FindingCondition = (typeof FINDING_CONDITIONS)[number];
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export type FindingResolution = (typeof FINDING_RESOLUTIONS)[number];

export interface EvidenceActorContext {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
}

export interface CreateEvidenceBindingInput {
  /** The `evidence_binding` knowledge object whose specification this runs. */
  bindingObjectId: string;
  resolverKey: EvidenceResolver;
  /** Postgres interval, e.g. "7 days". Per binding, never global. */
  freshnessInterval: string;
  /** Must be strictly shorter than the freshness interval. */
  warningInterval: string;
}

export interface EvidenceBindingRecord {
  bindingObjectId: string;
  organizationId: string;
  resolverKey: EvidenceResolver;
  freshnessInterval: string;
  warningInterval: string;
  bindingState: BindingState;
  lastEvaluatedAt: string | null;
  lastSuccessAt: string | null;
  lastEvidenceAt: string | null;
  lastOutcome: EvidenceOutcome | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceEvaluationRecord {
  id: string;
  bindingObjectId: string;
  organizationId: string;
  evaluatedAt: string;
  sequenceNo: number;
  outcome: EvidenceOutcome;
  evidenceCount: number;
  latestEvidenceAt: string | null;
  contradictionCount: number;
  reasonCode: string;
  detail: Record<string, unknown>;
  evaluatedBy: "system" | "human";
}

export interface ControlRuntimeRecord {
  controlObjectId: string;
  organizationId: string;
  controlState: ControlState;
  lastStateChangeAt: string;
  lastEvaluatedAt: string | null;
}

export interface ControlGate {
  canOperate: boolean;
  reasons: string[];
  bindingCount: number;
  healthyBindingCount: number;
  blockingContradictions: number;
}

export interface EvaluationSyncResult {
  outcome: EvidenceOutcome;
  reasonCode: string;
  evidenceCount: number;
  latestEvidenceAt: string | null;
  evaluationId: string;
  bindingState: BindingState;
  controlObjectId: string | null;
  control: { controlState: ControlState; changed: boolean; reason: string } | null;
  finding: { findingObjectId: string; created: boolean; occurrenceCount: number } | null;
  condition: FindingCondition | null;
}

export interface OpenFindingRecord {
  organizationId: string;
  targetObjectId: string;
  conditionCode: FindingCondition;
  findingObjectId: string;
  openedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
}

export interface ResolveFindingInput {
  findingObjectId: string;
  resolution: FindingResolution;
  rationale: string;
  evidenceRef?: string | null;
}

/**
 * Result of an authorization-bearing mutation.
 *
 * A denial is RETURNED, not thrown, at the database layer: raising would roll
 * back the audit record that proves the refusal happened, and a system that logs
 * only successes cannot demonstrate that it refuses anything. The service layer
 * turns `authorized: false` into an error for the caller.
 */
export interface AuthorizedResult<T> {
  authorized: boolean;
  reason?: string;
  value?: T;
}

export interface AssignOwnerInput {
  objectId: string;
  ownerUserId: string;
  rationale: string;
}
