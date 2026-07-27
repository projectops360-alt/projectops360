import type {
  ControlState,
  EvidenceOutcome,
  FindingCondition,
  FindingSeverity,
} from "@/lib/eki-evidence/types";

/**
 * The three truth layers of EKI.
 *
 * They are kept apart deliberately. "SOC 2 requires access reviews", "we decided
 * our access review runs quarterly" and "the last review ran in March" are three
 * different statements, and an answer that merges them produces the single most
 * dangerous output a trust system can emit: a requirement that sounds satisfied
 * because a decision exists to satisfy it.
 */
export const TRUTH_LAYERS = ["normative", "instantiated", "observed"] as const;
export type TruthLayer = (typeof TRUTH_LAYERS)[number];

/** What a framework, policy or standard REQUIRES. Never has a runtime state. */
export interface NormativeStatement {
  layer: "normative";
  /** Knowledge package that carries the requirement (ADR-015). */
  packageId: string;
  packageTitle: string;
  requirement: string;
  /** Present only when a control has been mapped to it. Absent is not failure. */
  satisfiedByControlIds: string[];
}

/** What ProjectOps360 has DECIDED. A knowledge object with a lifecycle. */
export interface InstantiatedControl {
  layer: "instantiated";
  controlObjectId: string;
  title: string;
  summary: string;
  /** Knowledge lifecycle — proposed / validated / active. Not the control state. */
  knowledgeStatus: string;
  ownerUserId: string | null;
  ownerName: string | null;
  bindings: InstantiatedBinding[];
}

export interface InstantiatedBinding {
  bindingObjectId: string;
  title: string;
  resolverKey: string;
  freshnessInterval: string;
  evaluationInterval: string;
  evaluationEnabled: boolean;
  nextDueAt: string | null;
}

/** What the running system has OBSERVED. Measured, never declared. */
export interface ObservedControlState {
  layer: "observed";
  controlObjectId: string;
  controlState: ControlState;
  lastStateChangeAt: string;
  lastEvaluatedAt: string | null;
  gateReasons: string[];
  evaluations: ObservedEvaluation[];
  findings: ObservedFinding[];
}

export interface ObservedEvaluation {
  bindingObjectId: string;
  evaluationId: string;
  sequenceNo: number;
  evaluatedAt: string;
  outcome: EvidenceOutcome;
  reasonCode: string;
  evidenceCount: number;
  latestEvidenceAt: string | null;
  contradictionCount: number;
  /** Which table answered. Provenance travels with the measurement. */
  sourceTable: string | null;
}

export interface ObservedFinding {
  findingObjectId: string;
  targetObjectId: string;
  conditionCode: FindingCondition;
  severity: FindingSeverity | null;
  openedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  ownerUserId: string | null;
}

/** A relation between canonical objects. Supporting and contradictory both shown. */
export interface TrustRelation {
  relationType: string;
  sourceObjectId: string;
  targetObjectId: string;
  basis: string;
  resolutionStatus: string | null;
  /** True for `contradicts`. Never hidden — an unresolved contradiction blocks operating. */
  contradictory: boolean;
}

/** A governance audit record that produced or accompanied the evidence. */
export interface TrustAuditReference {
  eventId: string;
  sequenceNumber: number;
  eventType: string;
  decision: string;
  actorRole: string;
  occurredAt: string;
  reasonCodes: string[];
}

/**
 * The assembled Enterprise Trust context for one organization.
 *
 * Read-only projection over the canonical model. No second store, no compliance
 * corpus: every field here is derived from `project_knowledge_objects`, its
 * relations, the EKI runtime tables and `platform_governance_audit`.
 */
export interface TrustContext {
  organizationId: string;
  assembledAt: string;
  normative: NormativeStatement[];
  instantiated: InstantiatedControl[];
  observed: ObservedControlState[];
  relations: TrustRelation[];
  auditReferences: TrustAuditReference[];
  /** Named honestly when a layer could not be read, so absence is never silence. */
  unavailableLayers: TruthLayer[];
}

/** One control with its three layers already aligned, for answering about it. */
export interface TrustControlView {
  controlObjectId: string;
  title: string;
  ownerUserId: string | null;
  ownerName: string | null;
  knowledgeStatus: string;
  controlState: ControlState | null;
  gateReasons: string[];
  bindings: InstantiatedBinding[];
  latestEvaluations: ObservedEvaluation[];
  openFindings: ObservedFinding[];
  supportingRelations: TrustRelation[];
  contradictoryRelations: TrustRelation[];
  normativeRequirements: NormativeStatement[];
  auditReferences: TrustAuditReference[];
}
