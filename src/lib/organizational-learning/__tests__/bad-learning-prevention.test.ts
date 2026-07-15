import { describe, expect, it } from "vitest";
import { assessOrganizationalLearning, transitionOrganizationalLearning } from "../engine";
import type { HistoricalLearningObservation } from "../types";

function observation(
  id: string,
  overrides: Partial<HistoricalLearningObservation> = {},
): HistoricalLearningObservation {
  return {
    id,
    organizationId: "org-1",
    projectId: id === "3" ? "project-2" : "project-1",
    caseId: `case-${id}`,
    learningKey: "handoff-control",
    knowledgeObjectId: `knowledge-${id}`,
    knowledgeType: "pattern",
    knowledgeStatus: "active",
    knowledgeConfidence: "high",
    outcome: "positive",
    observedAt: `2026-07-1${id}T12:00:00.000Z`,
    eventIntegrityPassed: true,
    historyComplete: true,
    synthetic: false,
    evidenceRefs: [`event:${id}`],
    ...overrides,
  };
}

describe("bad-learning prevention", () => {
  it("excludes contaminated and unverifiable histories", () => {
    const assessment = assessOrganizationalLearning([
      observation("1", { synthetic: true }),
      observation("2", { historyComplete: false }),
      observation("3", { eventIntegrityPassed: false }),
      observation("4", { knowledgeStatus: "proposed" }),
      observation("5", { outcome: "unknown" }),
      observation("6", { evidenceRefs: [] }),
    ], "org-1", "handoff-control", "2026-07-15T12:00:00.000Z");

    expect(assessment.reliableObservationIds).toEqual([]);
    expect(assessment.confidence).toBe("insufficient");
    expect(assessment.eligibleForValidation).toBe(false);
    expect(assessment.excludedObservations.flatMap((item) => item.issues)).toEqual(expect.arrayContaining([
      "synthetic_history",
      "incomplete_history",
      "event_integrity_failed",
      "inactive_knowledge",
      "missing_outcome",
      "missing_evidence",
    ]));
  });

  it("blocks single-project, contradictory and stale repetition", () => {
    const singleProject = assessOrganizationalLearning([
      observation("1"), observation("2"), observation("3", { projectId: "project-1" }),
    ], "org-1", "handoff-control", "2026-07-15T12:00:00.000Z");
    expect(singleProject.blockers).toContain("insufficient_project_diversity");

    const contradictory = assessOrganizationalLearning([
      observation("1"), observation("2", { outcome: "negative" }), observation("3", { outcome: "negative" }),
    ], "org-1", "handoff-control", "2026-07-15T12:00:00.000Z");
    expect(contradictory.blockers).toContain("excessive_contradiction");

    const stale = assessOrganizationalLearning([
      observation("1", { observedAt: "2025-01-01T00:00:00.000Z" }),
      observation("2", { observedAt: "2025-01-02T00:00:00.000Z" }),
      observation("3", { observedAt: "2025-01-03T00:00:00.000Z" }),
    ], "org-1", "handoff-control", "2026-07-15T12:00:00.000Z");
    expect(stale.blockers).toContain("stale_history");
  });

  it("prevents AI validation and requires a separate practice approval", () => {
    const assessment = assessOrganizationalLearning([
      observation("1"), observation("2"), observation("3"),
    ], "org-1", "handoff-control", "2026-07-15T12:00:00.000Z");

    expect(() => transitionOrganizationalLearning("repeated_evidence", "validated_learning", assessment, {
      actorId: "isabella",
      actorRole: "admin",
      actorType: "ai",
      rationale: "Automatic validation",
      approvedAt: "2026-07-15T13:00:00.000Z",
    })).toThrow("learning_human_approval_required");

    const validation = transitionOrganizationalLearning("repeated_evidence", "validated_learning", assessment, {
      actorId: "owner-1",
      actorRole: "owner",
      actorType: "human",
      rationale: "Reliable outcomes support validation.",
      approvedAt: "2026-07-15T13:00:00.000Z",
    });
    expect(validation.to).toBe("validated_learning");
    expect(() => transitionOrganizationalLearning("validated_learning", "practice", assessment)).toThrow(
      "learning_human_approval_required",
    );
  });
});
