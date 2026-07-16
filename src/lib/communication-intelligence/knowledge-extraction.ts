import { createHash } from "node:crypto";
import type {
  CommunicationKnowledgeCandidate,
  CommunicationKnowledgeReview,
  NormalizedCommunication,
  ProposedCommunicationKnowledge,
} from "./types";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildCommunicationKnowledgeCandidates(
  communication: NormalizedCommunication,
  proposed: readonly ProposedCommunicationKnowledge[],
): CommunicationKnowledgeCandidate[] {
  const seen = new Set<string>();
  return proposed.map((candidate) => {
    const sourceExcerpt = candidate.sourceExcerpt.trim();
    const statement = candidate.statement.trim();
    if (!sourceExcerpt || !communication.normalizedContent.includes(sourceExcerpt)) {
      throw new Error("communication_candidate_excerpt_not_verbatim");
    }
    if (!statement) throw new Error("communication_candidate_statement_required");
    if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
      throw new Error("communication_candidate_confidence_invalid");
    }
    const fingerprint = hash(JSON.stringify({ communicationId: communication.id, type: candidate.type, statement, sourceExcerpt }));
    if (seen.has(fingerprint)) throw new Error("communication_candidate_duplicate");
    seen.add(fingerprint);
    return {
      ...candidate,
      statement,
      sourceExcerpt,
      structuredContent: candidate.structuredContent ? structuredClone(candidate.structuredContent) : undefined,
      id: `communication-candidate:${fingerprint.slice(0, 24)}`,
      communicationId: communication.id,
      organizationId: communication.organizationId,
      projectId: communication.projectId,
      evidenceRefs: [communication.sourceRef, `communication-fingerprint:${communication.fingerprint}`],
      status: "needs_review",
      humanValidationRequired: true,
      executableNow: false,
    };
  });
}

export function reviewCommunicationKnowledgeCandidate(
  candidate: CommunicationKnowledgeCandidate,
  input: Omit<CommunicationKnowledgeReview, "candidateId" | "actorType" | "createsKnowledgeAutomatically">,
): CommunicationKnowledgeReview {
  if (!input.actorId.trim() || !["owner", "admin"].includes(input.actorRole)) {
    throw new Error("communication_candidate_human_authority_required");
  }
  if (input.rationale.trim().length < 3) throw new Error("communication_candidate_review_rationale_required");
  return {
    candidateId: candidate.id,
    decision: input.decision,
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorType: "human",
    rationale: input.rationale,
    reviewedAt: input.reviewedAt,
    createsKnowledgeAutomatically: false,
  };
}
