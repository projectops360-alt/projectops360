import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IsabellaRecommendation } from "@/lib/isabella/recommendations/types";
import type { OrganizationalLearningAssessment } from "@/lib/organizational-learning/types";
import { createDecisionProposal, reviewDecisionProposal } from "../engine";

function recommendation(overrides: Partial<IsabellaRecommendation> = {}): IsabellaRecommendation {
  return {
    id: "rec-1",
    title: "Add a governed handoff control",
    category: "review_process_friction",
    priority: "high",
    urgency: "this_week",
    effort: "medium",
    expectedImpact: "restore_sequence",
    confidence: "high",
    rationale: "Reliable histories show the same handoff delay.",
    expectedOutcome: "Reduce handoff waiting time.",
    affectedEntities: [],
    groupedCount: 1,
    sourceFindingIds: ["finding-1"],
    sourceConstraintIds: [],
    sourceEvidenceChainIds: ["chain-1"],
    evidenceRefs: ["event:e-1"],
    humanApprovalRequired: true,
    executableNow: false,
    ...overrides,
  };
}

function learning(stage: OrganizationalLearningAssessment["stage"]): OrganizationalLearningAssessment {
  return {
    assessmentVersion: "1.0.0",
    organizationId: "org-1",
    learningKey: "handoff-control",
    stage,
    confidence: "medium",
    reliableObservationIds: ["observation-1", "observation-2", "observation-3"],
    excludedObservations: [],
    sourceKnowledgeObjectIds: ["knowledge-1"],
    projectIds: ["project-1", "project-2"],
    caseIds: ["case-1", "case-2", "case-3"],
    evidenceRefs: ["event:e-2"],
    positiveOutcomes: 3,
    neutralOutcomes: 0,
    negativeOutcomes: 0,
    supportRatio: 1,
    contradictionRatio: 0,
    latestObservedAt: "2026-07-14T12:00:00.000Z",
    stale: false,
    eligibleForValidation: true,
    eligibleForPractice: true,
    blockers: [],
  };
}

describe("decision traceability controls", () => {
  it("rejects evidence gaps and ignores unvalidated learning", () => {
    expect(() => createDecisionProposal({
      organizationId: "org-1",
      projectId: "project-1",
      recommendation: recommendation({ evidenceRefs: [] }),
      createdAt: "2026-07-15T12:00:00.000Z",
    })).toThrow(/requires complete recommendation evidence/);

    const proposal = createDecisionProposal({
      organizationId: "org-1",
      projectId: "project-1",
      recommendation: recommendation(),
      learnings: [learning("pattern"), learning("validated_learning")],
      createdAt: "2026-07-15T12:00:00.000Z",
    });
    expect(proposal.sourceLearningKeys).toEqual(["handoff-control"]);
    expect(proposal.evidenceRefs).toEqual(["event:e-1", "event:e-2"]);
  });

  it("preserves the complete human decision trace without execution", () => {
    const proposal = createDecisionProposal({
      organizationId: "org-1",
      projectId: "project-1",
      recommendation: recommendation(),
      learnings: [learning("practice")],
      createdAt: "2026-07-15T12:00:00.000Z",
    });
    const review = reviewDecisionProposal(proposal, {
      canonicalDecisionId: "decision-1",
      targetStatus: "accepted",
      actorId: "admin-1",
      actorRole: "admin",
      actorType: "human",
      rationale: "The evidence is current and the mitigation cost is acceptable.",
      selectedAlternativeId: "accept-recommendation",
      reviewedAt: "2026-07-15T13:00:00.000Z",
    });

    expect(review).toMatchObject({
      canonicalDecisionId: "decision-1",
      sourceRecommendationId: "rec-1",
      sourceLearningKeys: ["handoff-control"],
      evidenceRefs: ["event:e-1", "event:e-2"],
      actorId: "admin-1",
      actorType: "human",
      selectedAlternativeId: "accept-recommendation",
      executableNow: false,
    });
    expect(review.proposalFingerprint).toBe(proposal.fingerprint);
  });

  it("protects persistence and pure engines from silent execution", () => {
    const migration = readFileSync(
      "supabase/migrations/20260849000000_organizational_learning_decision_intelligence.sql",
      "utf8",
    );
    const engine = readFileSync("src/lib/decision-intelligence/engine.ts", "utf8");
    const learningEngine = readFileSync("src/lib/organizational-learning/engine.ts", "utf8");

    expect(migration).toContain("decisions_intelligence_never_auto_execute");
    expect(migration).toContain("decision_intelligence_reviews_no_update");
    expect(migration).toContain("decision_intelligence_reviews_no_delete");
    expect(migration).toContain("decision_human_approval_required");
    expect(migration).toContain("learning_insufficient_reliable_history");
    expect(`${engine}\n${learningEngine}`).not.toMatch(/createClient|\.from\(|insert\(|update\(|delete\(|upsert\(/);
  });
});
