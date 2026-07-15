import { describe, expect, it } from "vitest";
import type { IsabellaRecommendation } from "@/lib/isabella/recommendations/types";
import { createDecisionProposal, reviewDecisionProposal } from "../engine";

const recommendation: IsabellaRecommendation = {
  id: "rec-1",
  title: "Stabilize milestone handoffs",
  category: "stabilize_milestone",
  priority: "high",
  urgency: "this_week",
  effort: "medium",
  expectedImpact: "restore_sequence",
  confidence: "high",
  rationale: "Three reliable histories show repeated handoff delay.",
  expectedOutcome: "Reduce waiting time between milestone approval and task start.",
  affectedEntities: [],
  groupedCount: 1,
  sourceFindingIds: ["finding-1"],
  sourceConstraintIds: [],
  sourceEvidenceChainIds: ["chain-1"],
  evidenceRefs: ["event:e-1", "event:e-2"],
  humanApprovalRequired: true,
  executableNow: false,
};

describe("decision intelligence", () => {
  it("creates a deterministic advisory proposal with alternatives", () => {
    const input = {
      organizationId: "org-1",
      projectId: "project-1",
      recommendation,
      createdAt: "2026-07-15T12:00:00.000Z",
    };
    const first = createDecisionProposal(input);
    const second = createDecisionProposal(input);

    expect(first.id).toBe(second.id);
    expect(first.alternatives).toHaveLength(2);
    expect(first.humanApprovalRequired).toBe(true);
    expect(first.executableNow).toBe(false);
  });

  it("requires a human owner or admin to accept", () => {
    const proposal = createDecisionProposal({
      organizationId: "org-1",
      projectId: "project-1",
      recommendation,
      createdAt: "2026-07-15T12:00:00.000Z",
    });

    expect(() => reviewDecisionProposal(proposal, {
      canonicalDecisionId: "decision-1",
      targetStatus: "accepted",
      actorId: "isabella",
      actorRole: "admin",
      actorType: "ai",
      rationale: "Automated approval",
      selectedAlternativeId: "accept-recommendation",
      reviewedAt: "2026-07-15T13:00:00.000Z",
    })).toThrow(/human organization owner or admin/);

    const review = reviewDecisionProposal(proposal, {
      canonicalDecisionId: "decision-1",
      targetStatus: "accepted",
      actorId: "user-1",
      actorRole: "owner",
      actorType: "human",
      rationale: "Evidence is sufficient and the tradeoff is acceptable.",
      selectedAlternativeId: "accept-recommendation",
      reviewedAt: "2026-07-15T13:00:00.000Z",
    });
    expect(review.toStatus).toBe("accepted");
    expect(review.executableNow).toBe(false);
  });
});
