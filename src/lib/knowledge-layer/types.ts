/**
 * Knowledge scope (ADR-013).
 *
 * `organization` and `project` only. `portfolio` and `platform` are deferred with
 * reasons recorded in the ADR: platform-scope normative content lives in
 * knowledge packages, and portfolio has no entity that can own knowledge.
 *
 * A scope is stated, never inferred from the presence or absence of a project.
 */
export const KNOWLEDGE_SCOPES = ["organization", "project"] as const;

/** Delivery learning. Unchanged by EKI. */
export const DELIVERY_KNOWLEDGE_TYPES = [
  "finding",
  "pattern",
  "best_practice",
  "lesson_learned",
  "recommendation",
  "prediction",
  "root_cause",
] as const;

/**
 * Governance kinds (ADR-014, EKI gate §2.2).
 *
 * Only the instance and observed layers appear here. The normative kinds —
 * Principle, Policy, Standard, Obligation — live in knowledge packages
 * (ADR-015) because they have no lifecycle, no evidence and no owner.
 *
 * `evidence_record` is deliberately absent: it is a projection over the
 * canonical event log, not a stored object. A copy is not tamper-evident
 * because its original was.
 *
 * `finding` is NOT duplicated as a governance type. A finding is a finding;
 * scope and relationships distinguish governance from delivery.
 */
export const GOVERNANCE_KNOWLEDGE_TYPES = [
  "control",
  "control_mapping",
  "evidence_binding",
  "risk",
  "exception",
  "asset",
  "vendor",
  "trust_boundary",
  "assessment",
] as const;

export const KNOWLEDGE_OBJECT_TYPES = [
  ...DELIVERY_KNOWLEDGE_TYPES,
  ...GOVERNANCE_KNOWLEDGE_TYPES,
] as const;

export const KNOWLEDGE_LIFECYCLE_STATUSES = ["proposed", "validated", "active"] as const;
export const KNOWLEDGE_CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const;
export const KNOWLEDGE_EVIDENCE_TYPES = [
  "project_event",
  "project_object",
  "document",
  "metric",
  "engine_finding",
  "external_reference",
] as const;
export const KNOWLEDGE_EVIDENCE_ROLES = ["supports", "contradicts", "context"] as const;
export const KNOWLEDGE_CAPTURE_METHODS = ["direct", "mapped", "derived", "imported"] as const;

export type KnowledgeScope = (typeof KNOWLEDGE_SCOPES)[number];
export type DeliveryKnowledgeType = (typeof DELIVERY_KNOWLEDGE_TYPES)[number];
export type GovernanceKnowledgeType = (typeof GOVERNANCE_KNOWLEDGE_TYPES)[number];
export type KnowledgeObjectType = (typeof KNOWLEDGE_OBJECT_TYPES)[number];

/** True when the kind belongs to the governance vocabulary. */
export function isGovernanceKnowledgeType(value: KnowledgeObjectType): value is GovernanceKnowledgeType {
  return (GOVERNANCE_KNOWLEDGE_TYPES as readonly string[]).includes(value);
}
export type KnowledgeLifecycleStatus = (typeof KNOWLEDGE_LIFECYCLE_STATUSES)[number];
export type KnowledgeConfidence = (typeof KNOWLEDGE_CONFIDENCE_LEVELS)[number];
export type KnowledgeEvidenceType = (typeof KNOWLEDGE_EVIDENCE_TYPES)[number];
export type KnowledgeEvidenceRole = (typeof KNOWLEDGE_EVIDENCE_ROLES)[number];
export type KnowledgeCaptureMethod = (typeof KNOWLEDGE_CAPTURE_METHODS)[number];
export type KnowledgeAction = "read" | "propose" | "revise" | "validate" | "activate";
export type KnowledgeActorRole = "owner" | "admin" | "member" | "viewer";

export interface KnowledgeActorContext {
  organizationId: string;
  userId: string;
  role: KnowledgeActorRole;
}

export interface KnowledgeEvidenceInput {
  type: KnowledgeEvidenceType;
  ref: string;
  role: KnowledgeEvidenceRole;
  confidence: KnowledgeConfidence;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeProvenanceInput {
  captureMethod: KnowledgeCaptureMethod;
  sourceKind: string;
  sourceRef: string;
  engineName?: string | null;
  engineVersion?: string | null;
  configVersion?: string | null;
  dataQualityFlags?: string[];
}

export interface KnowledgeVersionInput {
  title: string;
  summary: string;
  body: string;
  structuredContent?: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  confidenceReason: string;
  provenance: KnowledgeProvenanceInput;
  evidence: KnowledgeEvidenceInput[];
  proposalRationale: string;
}

export interface CreateKnowledgeObjectInput extends KnowledgeVersionInput {
  /** ADR-013. Stated, never inferred from whether a project was supplied. */
  scope: KnowledgeScope;
  /** Required at project scope, forbidden at organization scope. */
  projectId: string | null;
  knowledgeType: KnowledgeObjectType;
  idempotencyKey: string;
  /** Exactly one accountable person. Ownership is an attribute, not an object. */
  ownerUserId?: string | null;
}

export interface ReviseKnowledgeObjectInput extends KnowledgeVersionInput {
  knowledgeObjectId: string;
  expectedVersionNo: number;
}

export interface TransitionKnowledgeObjectInput {
  knowledgeObjectId: string;
  expectedVersionNo: number;
  targetStatus: "validated" | "active";
  rationale: string;
}

export interface KnowledgeObjectMutationResult {
  knowledgeObjectId: string;
  versionNo: number;
  status: KnowledgeLifecycleStatus;
  deduped: boolean;
}

export interface KnowledgeObjectReadModel {
  id: string;
  organizationId: string;
  scope: KnowledgeScope;
  /** Null exactly when scope is `organization`. */
  projectId: string | null;
  ownerUserId: string | null;
  knowledgeType: KnowledgeObjectType;
  status: KnowledgeLifecycleStatus;
  currentVersionNo: number;
  activeVersionNo: number | null;
  title: string;
  summary: string;
  body: string;
  structuredContent: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  confidenceReason: string;
  provenance: KnowledgeProvenanceInput;
  evidenceCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeVersionRecord {
  knowledgeObjectId: string;
  versionNo: number;
  title: string;
  summary: string;
  body: string;
  structuredContent: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  confidenceReason: string;
  provenance: KnowledgeProvenanceInput;
  contentHash: string;
  createdBy: string;
  createdAt: string;
}

export interface KnowledgeEvidenceRecord extends KnowledgeEvidenceInput {
  id: string;
  knowledgeObjectId: string;
  versionNo: number;
  createdBy: string;
  createdAt: string;
}

export interface KnowledgeTransitionRecord {
  id: string;
  knowledgeObjectId: string;
  versionNo: number;
  fromStatus: KnowledgeLifecycleStatus | null;
  toStatus: KnowledgeLifecycleStatus;
  actorId: string;
  rationale: string;
  createdAt: string;
}

export interface KnowledgeObjectHistory {
  versions: KnowledgeVersionRecord[];
  evidence: KnowledgeEvidenceRecord[];
  transitions: KnowledgeTransitionRecord[];
}

export interface KnowledgeObjectListFilter {
  status?: KnowledgeLifecycleStatus;
  knowledgeType?: KnowledgeObjectType;
  limit?: number;
}

// ── Canonical relations (EKI §4, ADR-016) ───────────────────────────────────

/**
 * The closed relationship vocabulary.
 *
 * Relations to PEOPLE are deliberately absent: `owned_by` is an attribute,
 * `approved_by` is the actor on a transition, `generated_by` is provenance.
 * Modelling ownership as an edge would add a join to every ownership question
 * and a lifecycle to a fact.
 */
export const KNOWLEDGE_RELATION_TYPES = [
  "derived_from",
  "implements",
  "governed_by",
  "satisfies",
  "maps_to",
  "applies_to",
  "tested_by",
  "failed_by",
  "mitigates",
  "threatens",
  "accepted_as_exception_by",
  "depends_on",
  "supports",
  "contradicts",
  "supersedes",
] as const;

/** An endpoint is a knowledge object (instance/observed) or a package (normative). */
export const KNOWLEDGE_ENDPOINT_KINDS = ["knowledge_object", "knowledge_package"] as const;

/**
 * How a relation is known. An `inferred` relation may never change a compliance
 * status (EKI gate §3.1); recording the basis is what lets a consumer enforce that.
 */
export const KNOWLEDGE_RELATION_BASES = ["declared", "derived", "observed", "inferred"] as const;

/** Contradictions are never deleted. They are resolved, and the resolution is stated. */
export const KNOWLEDGE_RELATION_RESOLUTIONS = ["unresolved", "accepted", "resolved"] as const;

export type KnowledgeRelationType = (typeof KNOWLEDGE_RELATION_TYPES)[number];
export type KnowledgeEndpointKind = (typeof KNOWLEDGE_ENDPOINT_KINDS)[number];
export type KnowledgeRelationBasis = (typeof KNOWLEDGE_RELATION_BASES)[number];
export type KnowledgeRelationResolution = (typeof KNOWLEDGE_RELATION_RESOLUTIONS)[number];

export interface KnowledgeRelationEndpointInput {
  kind: KnowledgeEndpointKind;
  /** Object id when kind is `knowledge_object`, package id when `knowledge_package`. */
  id: string;
  /** Required for a version-sensitive relation on an object endpoint. */
  versionNo?: number | null;
}

export interface CreateKnowledgeRelationInput {
  scope: KnowledgeScope;
  projectId: string | null;
  relationType: KnowledgeRelationType;
  source: KnowledgeRelationEndpointInput;
  target: KnowledgeRelationEndpointInput;
  basis?: KnowledgeRelationBasis;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ResolveKnowledgeRelationInput {
  relationId: string;
  resolution: Exclude<KnowledgeRelationResolution, "unresolved">;
  rationale: string;
}

export interface KnowledgeRelationRecord {
  id: string;
  organizationId: string;
  scope: KnowledgeScope;
  projectId: string | null;
  relationType: KnowledgeRelationType;
  source: KnowledgeRelationEndpointInput;
  target: KnowledgeRelationEndpointInput;
  basis: KnowledgeRelationBasis;
  resolutionStatus: KnowledgeRelationResolution;
  resolutionRationale: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRelationListFilter {
  relationType?: KnowledgeRelationType;
  objectId?: string;
  unresolvedOnly?: boolean;
  limit?: number;
}
