// ============================================================================
// ProjectOps360° — Isabella Recommendation & Next-Best-Action · types (Task 5)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Answers "given the diagnosis + root-cause evidence, what should the PM focus
// on next, why, what impact is expected, and what evidence supports it?" —
// evidence-backed, conservative, uncertainty-aware, ADVISORY ONLY. Every
// recommendation is human-approved and never auto-executed. Pure types; reuses
// Task 1 confidence + citation types and the Task 4 finding/evidence shapes.
// ============================================================================

import type { IsabellaConfidence, IsabellaCitation } from "@/lib/isabella/process-intelligence/types";
import type { IsabellaContextStatus } from "@/lib/isabella/process-context/types";
import type { AffectedEntity } from "@/lib/isabella/root-cause/types";

export type RecommendationCategory =
  | "resolve_explicit_blocker"
  | "assign_owner"
  | "assign_milestone"
  | "recover_overdue_work"
  | "validate_dependency"
  | "investigate_evidence_gap"
  | "stabilize_milestone"
  | "clarify_scope"
  | "reduce_execution_uncertainty";

/** Categories this engine can support TODAY (all others are never fabricated). */
export const SUPPORTED_RECOMMENDATION_CATEGORIES: RecommendationCategory[] = [
  "resolve_explicit_blocker",
  "assign_owner",
  "assign_milestone",
  "recover_overdue_work",
  "investigate_evidence_gap",
  "stabilize_milestone",
  "clarify_scope",
  "reduce_execution_uncertainty",
];

export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type RecommendationUrgency = "now" | "today" | "this_week" | "later" | "unknown";
export type RecommendationEffort = "low" | "medium" | "high" | "unknown";
export type RecommendationImpact =
  | "unblock_execution"
  | "reduce_risk"
  | "increase_clarity"
  | "restore_sequence"
  | "improve_accountability"
  | "reduce_uncertainty"
  | "unknown";

export interface IsabellaRecommendation {
  id: string;
  title: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  urgency: RecommendationUrgency;
  effort: RecommendationEffort;
  expectedImpact: RecommendationImpact;
  confidence: IsabellaConfidence;
  rationale: string;
  expectedOutcome: string;
  affectedEntities: AffectedEntity[];
  /** How many affected entities this (possibly grouped) recommendation covers. */
  groupedCount: number;
  sourceFindingIds: string[];
  sourceConstraintIds: string[];
  sourceEvidenceChainIds: string[];
  evidenceRefs: string[];
  citations?: IsabellaCitation[];
  preconditions?: string[];
  missingEvidence?: string[];
  /** ADVISORY SAFETY — never executed by this engine. Always true / false. */
  humanApprovalRequired: true;
  executableNow: false;
}

export interface RecommendationGroup {
  label: string;
  priority: RecommendationPriority;
  recommendations: string[];
  reason: string;
}

export interface RecommendationDecisionSupport {
  topPriorityReason?: string;
  tradeoffs?: string[];
  blockedByMissingEvidence?: boolean;
}

export interface IsabellaRecommendationPlan {
  status: IsabellaContextStatus;
  projectId: string | null;
  organizationId: string | null;
  snapshotAt: string;
  title: string;
  summary: string;
  recommendations: IsabellaRecommendation[];
  recommendationGroups: RecommendationGroup[];
  decisionSupport: RecommendationDecisionSupport;
  evidenceRefs: string[];
  citations: IsabellaCitation[];
  limitations: string[];
  message?: string;
}

export type RecommendationLanguage = "en" | "es";

/**
 * A pre-ranking candidate. `dedupeKey` groups candidates that describe the same
 * underlying action so we never emit one noisy recommendation per task.
 */
export interface RecommendationCandidate {
  dedupeKey: string;
  category: RecommendationCategory;
  title: string;
  rationale: string;
  expectedOutcome: string;
  expectedImpact: RecommendationImpact;
  priority: RecommendationPriority;
  urgency: RecommendationUrgency;
  effort: RecommendationEffort;
  confidence: IsabellaConfidence;
  affectedEntities: AffectedEntity[];
  sourceFindingIds: string[];
  sourceConstraintIds: string[];
  sourceEvidenceChainIds: string[];
  evidenceRefs: string[];
  preconditions?: string[];
  missingEvidence?: string[];
}
