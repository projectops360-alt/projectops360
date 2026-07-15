import type { KnowledgeConfidence, KnowledgeLifecycleStatus, KnowledgeObjectType } from "@/lib/knowledge-layer/types";

export const LEARNING_STAGES = [
  "finding",
  "pattern",
  "repeated_evidence",
  "validated_learning",
  "practice",
  "retired",
] as const;

export type LearningStage = (typeof LEARNING_STAGES)[number];
export type LearningConfidence = "high" | "medium" | "low" | "insufficient";
export type HistoricalOutcome = "positive" | "neutral" | "negative" | "unknown";
export type LearningActorRole = "owner" | "admin" | "member" | "viewer";
export type LearningActorType = "human" | "system" | "ai";

export interface HistoricalLearningObservation {
  id: string;
  organizationId: string;
  projectId: string;
  caseId: string;
  learningKey: string;
  knowledgeObjectId: string;
  knowledgeType: KnowledgeObjectType;
  knowledgeStatus: KnowledgeLifecycleStatus;
  knowledgeConfidence: KnowledgeConfidence;
  outcome: HistoricalOutcome;
  observedAt: string;
  eventIntegrityPassed: boolean;
  historyComplete: boolean;
  synthetic: boolean;
  evidenceRefs: string[];
}

export type LearningReliabilityIssue =
  | "cross_organization"
  | "inactive_knowledge"
  | "unsupported_knowledge_type"
  | "weak_knowledge_confidence"
  | "event_integrity_failed"
  | "incomplete_history"
  | "synthetic_history"
  | "missing_outcome"
  | "missing_evidence"
  | "stale_history"
  | "insufficient_repetition"
  | "insufficient_project_diversity"
  | "excessive_contradiction";

export interface ExcludedLearningObservation {
  observationId: string;
  issues: LearningReliabilityIssue[];
}

export interface OrganizationalLearningAssessment {
  assessmentVersion: "1.0.0";
  organizationId: string;
  learningKey: string;
  stage: LearningStage;
  confidence: LearningConfidence;
  reliableObservationIds: string[];
  excludedObservations: ExcludedLearningObservation[];
  sourceKnowledgeObjectIds: string[];
  projectIds: string[];
  caseIds: string[];
  evidenceRefs: string[];
  positiveOutcomes: number;
  neutralOutcomes: number;
  negativeOutcomes: number;
  supportRatio: number;
  contradictionRatio: number;
  latestObservedAt: string | null;
  stale: boolean;
  eligibleForValidation: boolean;
  eligibleForPractice: boolean;
  blockers: LearningReliabilityIssue[];
}

export interface LearningAssessmentConfig {
  minimumRepeatedCases: number;
  minimumDistinctProjects: number;
  minimumSupportRatio: number;
  maximumContradictionRatio: number;
  maximumAgeDays: number;
}

export interface LearningTransitionApproval {
  actorId: string;
  actorRole: LearningActorRole;
  actorType: LearningActorType;
  rationale: string;
  approvedAt: string;
}

export interface LearningTransitionResult {
  from: LearningStage;
  to: LearningStage;
  approvedBy: string | null;
  approvedAt: string | null;
  rationale: string;
}
