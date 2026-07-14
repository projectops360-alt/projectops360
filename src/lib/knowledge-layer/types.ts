export const KNOWLEDGE_OBJECT_TYPES = [
  "finding",
  "pattern",
  "best_practice",
  "lesson_learned",
  "recommendation",
  "prediction",
  "root_cause",
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

export type KnowledgeObjectType = (typeof KNOWLEDGE_OBJECT_TYPES)[number];
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
  projectId: string;
  knowledgeType: KnowledgeObjectType;
  idempotencyKey: string;
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
  projectId: string;
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
