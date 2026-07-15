import { describe, expect, it } from "vitest";
import { assessOrganizationalLearning, transitionOrganizationalLearning } from "../engine";
import type { HistoricalLearningObservation, LearningTransitionApproval } from "../types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const now = "2026-07-15T00:00:00Z";

function observation(id: number, projectId: string, outcome: HistoricalLearningObservation["outcome"] = "positive", overrides: Partial<HistoricalLearningObservation> = {}): HistoricalLearningObservation {
  return {
    id: `observation-${id}`,
    organizationId,
    projectId,
    caseId: `case-${id}`,
    learningKey: "owner-before-start",
    knowledgeObjectId: `knowledge-${id}`,
    knowledgeType: "pattern",
    knowledgeStatus: "active",
    knowledgeConfidence: "high",
    outcome,
    observedAt: `2026-07-${String(10 + id).padStart(2, "0")}T00:00:00Z`,
    eventIntegrityPassed: true,
    historyComplete: true,
    synthetic: false,
    evidenceRefs: [`event-${id}`],
    ...overrides,
  };
}

const approval: LearningTransitionApproval = {
  actorId: "22222222-2222-4222-8222-222222222222",
  actorRole: "owner",
  actorType: "human",
  rationale: "Reviewed against reliable cross-project outcomes.",
  approvedAt: now,
};

describe("organizational learning lifecycle", () => {
  it("recognizes repeated evidence only across reliable histories and projects", () => {
    const assessment = assessOrganizationalLearning([
      observation(1, "project-a"),
      observation(2, "project-a"),
      observation(3, "project-b"),
    ], organizationId, "owner-before-start", now);
    expect(assessment).toMatchObject({
      stage: "repeated_evidence",
      confidence: "medium",
      eligibleForValidation: true,
      projectIds: ["project-a", "project-b"],
      positiveOutcomes: 3,
    });
  });

  it("requires separate human approvals for validation and practice", () => {
    const assessment = assessOrganizationalLearning([
      observation(1, "project-a"), observation(2, "project-a"), observation(3, "project-b"),
    ], organizationId, "owner-before-start", now);
    expect(() => transitionOrganizationalLearning("repeated_evidence", "validated_learning", assessment)).toThrow("learning_human_approval_required");
    expect(transitionOrganizationalLearning("repeated_evidence", "validated_learning", assessment, approval).to).toBe("validated_learning");
    expect(transitionOrganizationalLearning("validated_learning", "practice", assessment, approval).to).toBe("practice");
  });

  it("does not mutate historical observations", () => {
    const observations = [observation(1, "project-a"), observation(2, "project-a"), observation(3, "project-b")];
    const frozen = structuredClone(observations);
    assessOrganizationalLearning(observations, organizationId, "owner-before-start", now);
    expect(observations).toEqual(frozen);
  });
});
