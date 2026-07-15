import type {
  HistoricalLearningObservation,
  LearningAssessmentConfig,
  LearningReliabilityIssue,
  LearningStage,
  LearningTransitionApproval,
  LearningTransitionResult,
  OrganizationalLearningAssessment,
} from "./types";

export const DEFAULT_LEARNING_ASSESSMENT_CONFIG: LearningAssessmentConfig = {
  minimumRepeatedCases: 3,
  minimumDistinctProjects: 2,
  minimumSupportRatio: 2 / 3,
  maximumContradictionRatio: 0.25,
  maximumAgeDays: 180,
};

const SUPPORTED_KNOWLEDGE_TYPES = new Set(["finding", "pattern", "best_practice", "lesson_learned"]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function reliabilityIssues(observation: HistoricalLearningObservation, organizationId: string): LearningReliabilityIssue[] {
  const issues: LearningReliabilityIssue[] = [];
  if (observation.organizationId !== organizationId) issues.push("cross_organization");
  if (observation.knowledgeStatus !== "active") issues.push("inactive_knowledge");
  if (!SUPPORTED_KNOWLEDGE_TYPES.has(observation.knowledgeType)) issues.push("unsupported_knowledge_type");
  if (observation.knowledgeConfidence !== "high" && observation.knowledgeConfidence !== "medium") issues.push("weak_knowledge_confidence");
  if (!observation.eventIntegrityPassed) issues.push("event_integrity_failed");
  if (!observation.historyComplete) issues.push("incomplete_history");
  if (observation.synthetic) issues.push("synthetic_history");
  if (observation.outcome === "unknown") issues.push("missing_outcome");
  if (observation.evidenceRefs.length === 0) issues.push("missing_evidence");
  return issues;
}

function stageFor(reliableCases: number, projects: number, supportRatio: number, config: LearningAssessmentConfig): LearningStage {
  if (reliableCases >= config.minimumRepeatedCases && projects >= config.minimumDistinctProjects && supportRatio >= config.minimumSupportRatio) {
    return "repeated_evidence";
  }
  if (reliableCases >= 2) return "pattern";
  return "finding";
}

export function assessOrganizationalLearning(
  observations: readonly HistoricalLearningObservation[],
  organizationId: string,
  learningKey: string,
  now: string,
  config: LearningAssessmentConfig = DEFAULT_LEARNING_ASSESSMENT_CONFIG,
): OrganizationalLearningAssessment {
  const scoped = observations.filter((observation) => observation.learningKey === learningKey);
  const excludedObservations = scoped.flatMap((observation) => {
    const issues = reliabilityIssues(observation, organizationId);
    return issues.length > 0 ? [{ observationId: observation.id, issues }] : [];
  });
  const excludedIds = new Set(excludedObservations.map((item) => item.observationId));
  const reliable = scoped.filter((observation) => !excludedIds.has(observation.id));
  const projectIds = unique(reliable.map((observation) => observation.projectId));
  const caseIds = unique(reliable.map((observation) => observation.caseId));
  const positiveOutcomes = reliable.filter((observation) => observation.outcome === "positive").length;
  const neutralOutcomes = reliable.filter((observation) => observation.outcome === "neutral").length;
  const negativeOutcomes = reliable.filter((observation) => observation.outcome === "negative").length;
  const denominator = Math.max(1, positiveOutcomes + neutralOutcomes + negativeOutcomes);
  const supportRatio = positiveOutcomes / denominator;
  const contradictionRatio = negativeOutcomes / denominator;
  const latestObservedAt = reliable.length > 0
    ? [...reliable].map((observation) => observation.observedAt).sort().at(-1) ?? null
    : null;
  const ageMs = latestObservedAt ? new Date(now).getTime() - new Date(latestObservedAt).getTime() : Number.POSITIVE_INFINITY;
  const stale = ageMs > config.maximumAgeDays * 86_400_000;
  const stage = stageFor(caseIds.length, projectIds.length, supportRatio, config);
  const blockers: LearningReliabilityIssue[] = [];

  if (caseIds.length < config.minimumRepeatedCases) blockers.push("insufficient_repetition");
  if (projectIds.length < config.minimumDistinctProjects) blockers.push("insufficient_project_diversity");
  if (contradictionRatio > config.maximumContradictionRatio) blockers.push("excessive_contradiction");
  if (stale) blockers.push("stale_history");

  const eligibleForValidation = stage === "repeated_evidence" && blockers.length === 0;
  const confidence = eligibleForValidation
    ? projectIds.length >= 3 && caseIds.length >= 5 && supportRatio >= 0.8 ? "high" : "medium"
    : reliable.length > 0 ? "low" : "insufficient";

  return {
    assessmentVersion: "1.0.0",
    organizationId,
    learningKey,
    stage,
    confidence,
    reliableObservationIds: reliable.map((observation) => observation.id).sort(),
    excludedObservations,
    sourceKnowledgeObjectIds: unique(reliable.map((observation) => observation.knowledgeObjectId)),
    projectIds,
    caseIds,
    evidenceRefs: unique(reliable.flatMap((observation) => observation.evidenceRefs)),
    positiveOutcomes,
    neutralOutcomes,
    negativeOutcomes,
    supportRatio,
    contradictionRatio,
    latestObservedAt,
    stale,
    eligibleForValidation,
    eligibleForPractice: eligibleForValidation && confidence !== "low" && confidence !== "insufficient",
    blockers: unique(blockers) as LearningReliabilityIssue[],
  };
}

function isHumanApprover(approval: LearningTransitionApproval | undefined): approval is LearningTransitionApproval {
  return approval?.actorType === "human"
    && (approval.actorRole === "owner" || approval.actorRole === "admin")
    && approval.rationale.trim().length >= 3;
}

export function transitionOrganizationalLearning(
  current: LearningStage,
  target: LearningStage,
  assessment: OrganizationalLearningAssessment,
  approval?: LearningTransitionApproval,
): LearningTransitionResult {
  if (target === "retired") {
    if (!isHumanApprover(approval)) throw new Error("learning_human_approval_required");
  } else if (current === "finding" && target === "pattern") {
    if (assessment.stage !== "pattern" && assessment.stage !== "repeated_evidence") throw new Error("learning_pattern_not_observed");
  } else if (current === "pattern" && target === "repeated_evidence") {
    if (!assessment.eligibleForValidation) throw new Error("learning_repeated_evidence_not_reliable");
  } else if (current === "repeated_evidence" && target === "validated_learning") {
    if (!assessment.eligibleForValidation) throw new Error("learning_validation_blocked");
    if (!isHumanApprover(approval)) throw new Error("learning_human_approval_required");
  } else if (current === "validated_learning" && target === "practice") {
    if (!assessment.eligibleForPractice || assessment.stale) throw new Error("learning_practice_blocked");
    if (!isHumanApprover(approval)) throw new Error("learning_human_approval_required");
  } else {
    throw new Error("learning_invalid_transition");
  }

  return {
    from: current,
    to: target,
    approvedBy: approval?.actorId ?? null,
    approvedAt: approval?.approvedAt ?? null,
    rationale: approval?.rationale ?? "Deterministic historical threshold reached.",
  };
}
