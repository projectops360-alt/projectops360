import type { IsabellaRecommendation } from "@/lib/isabella/recommendations/types";
import type { OrganizationalLearningAssessment } from "@/lib/organizational-learning/types";

export type DecisionIntelligenceStatus = "proposed" | "accepted" | "rejected" | "deferred";
export type DecisionActorRole = "owner" | "admin" | "member" | "viewer";
export type DecisionActorType = "human" | "system" | "ai";

export interface DecisionAlternative {
  id: string;
  label: string;
  expectedOutcome: string;
  tradeoffs: string[];
}

export interface DecisionIntelligenceProposal {
  proposalVersion: "1.0.0";
  id: string;
  fingerprint: string;
  organizationId: string;
  projectId: string;
  status: "proposed";
  title: string;
  rationale: string;
  sourceRecommendationId: string;
  sourceLearningKeys: string[];
  sourceKnowledgeObjectIds: string[];
  evidenceRefs: string[];
  alternatives: DecisionAlternative[];
  preconditions: string[];
  humanApprovalRequired: true;
  executableNow: false;
  createdAt: string;
}

export interface DecisionProposalInput {
  organizationId: string;
  projectId: string;
  recommendation: IsabellaRecommendation;
  learnings?: OrganizationalLearningAssessment[];
  alternatives?: DecisionAlternative[];
  createdAt: string;
}

export interface DecisionReview {
  canonicalDecisionId: string;
  proposalId: string;
  fromStatus: "proposed";
  toStatus: Exclude<DecisionIntelligenceStatus, "proposed">;
  actorId: string;
  actorRole: DecisionActorRole;
  actorType: DecisionActorType;
  rationale: string;
  selectedAlternativeId: string | null;
  sourceRecommendationId: string;
  sourceLearningKeys: string[];
  evidenceRefs: string[];
  proposalFingerprint: string;
  reviewedAt: string;
  executableNow: false;
}

export interface DecisionReviewInput {
  canonicalDecisionId: string;
  targetStatus: Exclude<DecisionIntelligenceStatus, "proposed">;
  actorId: string;
  actorRole: DecisionActorRole;
  actorType: DecisionActorType;
  rationale: string;
  selectedAlternativeId?: string;
  reviewedAt: string;
}
