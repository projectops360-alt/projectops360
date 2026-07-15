import type {
  DecisionAlternative,
  DecisionIntelligenceProposal,
  DecisionProposalInput,
  DecisionReview,
  DecisionReviewInput,
} from "./types";

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function defaultAlternatives(input: DecisionProposalInput): DecisionAlternative[] {
  return [
    {
      id: "accept-recommendation",
      label: input.recommendation.title,
      expectedOutcome: input.recommendation.expectedOutcome,
      tradeoffs: input.recommendation.preconditions ?? [],
    },
    {
      id: "defer-for-evidence",
      label: "Defer and collect additional evidence",
      expectedOutcome: "Reduce uncertainty before committing resources or changing execution.",
      tradeoffs: ["Delays the potential benefit of the recommendation."],
    },
  ];
}

export function createDecisionProposal(input: DecisionProposalInput): DecisionIntelligenceProposal {
  const recommendation = input.recommendation;
  if (!recommendation.humanApprovalRequired || recommendation.executableNow) {
    throw new Error("Decision intelligence only accepts advisory, human-approved recommendations.");
  }
  if (recommendation.evidenceRefs.length === 0 || recommendation.missingEvidence?.length) {
    throw new Error("A decision proposal requires complete recommendation evidence.");
  }

  const supportingLearnings = (input.learnings ?? []).filter(
    (learning) =>
      learning.organizationId === input.organizationId &&
      (learning.stage === "validated_learning" || learning.stage === "practice") &&
      learning.evidenceRefs.length > 0,
  );
  const alternatives = input.alternatives?.length ? input.alternatives : defaultAlternatives(input);
  if (alternatives.length < 2 || unique(alternatives.map((alternative) => alternative.id)).length !== alternatives.length) {
    throw new Error("A decision proposal requires at least two uniquely identified alternatives.");
  }

  const evidenceRefs = unique([
    ...recommendation.evidenceRefs,
    ...supportingLearnings.flatMap((learning) => learning.evidenceRefs),
  ]);
  const sourceLearningKeys = unique(supportingLearnings.map((learning) => learning.learningKey));
  const sourceKnowledgeObjectIds = unique(
    supportingLearnings.flatMap((learning) => learning.sourceKnowledgeObjectIds),
  );
  const fingerprint = stableHash(
    JSON.stringify({
      organizationId: input.organizationId,
      projectId: input.projectId,
      recommendationId: recommendation.id,
      sourceLearningKeys,
      evidenceRefs,
      alternativeIds: alternatives.map((alternative) => alternative.id),
    }),
  );

  return {
    proposalVersion: "1.0.0",
    id: `decision-proposal:${fingerprint}`,
    fingerprint,
    organizationId: input.organizationId,
    projectId: input.projectId,
    status: "proposed",
    title: recommendation.title,
    rationale: recommendation.rationale,
    sourceRecommendationId: recommendation.id,
    sourceLearningKeys,
    sourceKnowledgeObjectIds,
    evidenceRefs,
    alternatives: alternatives.map((alternative) => ({ ...alternative, tradeoffs: [...alternative.tradeoffs] })),
    preconditions: [...(recommendation.preconditions ?? [])],
    humanApprovalRequired: true,
    executableNow: false,
    createdAt: input.createdAt,
  };
}

export function reviewDecisionProposal(
  proposal: DecisionIntelligenceProposal,
  input: DecisionReviewInput,
): DecisionReview {
  if (input.actorType !== "human" || !["owner", "admin"].includes(input.actorRole)) {
    throw new Error("Only a human organization owner or admin can review a decision proposal.");
  }
  if (!input.canonicalDecisionId.trim()) {
    throw new Error("Review must be attached to a canonical decision.");
  }
  if (!input.rationale.trim()) {
    throw new Error("Decision review rationale is required.");
  }

  let selectedAlternativeId: string | null = input.selectedAlternativeId ?? null;
  if (input.targetStatus === "accepted") {
    if (!selectedAlternativeId || !proposal.alternatives.some((alternative) => alternative.id === selectedAlternativeId)) {
      throw new Error("An accepted decision requires a valid selected alternative.");
    }
  } else if (selectedAlternativeId && !proposal.alternatives.some((alternative) => alternative.id === selectedAlternativeId)) {
    throw new Error("Selected alternative does not belong to this proposal.");
  }

  return {
    canonicalDecisionId: input.canonicalDecisionId,
    proposalId: proposal.id,
    fromStatus: "proposed",
    toStatus: input.targetStatus,
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorType: input.actorType,
    rationale: input.rationale,
    selectedAlternativeId,
    sourceRecommendationId: proposal.sourceRecommendationId,
    sourceLearningKeys: [...proposal.sourceLearningKeys],
    evidenceRefs: [...proposal.evidenceRefs],
    proposalFingerprint: proposal.fingerprint,
    reviewedAt: input.reviewedAt,
    executableNow: false,
  };
}
