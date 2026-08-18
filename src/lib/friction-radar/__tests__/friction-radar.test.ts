import { describe, expect, it } from "vitest";
import {
  buildFrictionRadarReadModel,
  correlateFrictionSignals,
  proposeCategoryAggregation,
  scoreFrictionSignal,
  type FrictionSignal,
} from "@/lib/friction-radar";

const base = {
  organizationId: "org-1",
  projectId: "project-1",
  confidence: "high" as const,
  evidenceRefs: [{ kind: "event", id: "e1" }],
  score: 50,
  observedValue: true,
  expectedOrBaseline: false,
  evidenceStatus: "confirmed" as const,
  evidenceTimestampStart: null,
  evidenceTimestampEnd: null,
  evidenceDescription: "test evidence",
};

function signal(partial: Partial<FrictionSignal> & Pick<FrictionSignal, "signalId" | "category" | "severity">): FrictionSignal {
  return {
    ...base,
    source: "mpf",
    signalType: partial.signalId,
    ...partial,
    score: partial.score ?? (partial.severity === "critical" ? 100 : partial.severity === "high" ? 72 : partial.severity === "medium" ? 45 : 20),
  };
}

describe("Friction Radar v1", () => {
  it("scores critical high-confidence signals higher than medium signals", () => {
    expect(scoreFrictionSignal(signal({ signalId: "critical", category: "process", severity: "critical" })))
      .toBeGreaterThan(scoreFrictionSignal(signal({ signalId: "medium", category: "process", severity: "medium" })));
  });

  it("creates a cross-category cluster only with an explicit shared entity", () => {
    const signals = [
      signal({ signalId: "wait", category: "process", severity: "high", entityId: "task-1" }),
      signal({ signalId: "cost", category: "cost", severity: "medium", entityId: "task-1" }),
      signal({ signalId: "risk", category: "risk", severity: "high", entityId: "task-2" }),
    ];
    const clusters = correlateFrictionSignals(signals);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].entityIds).toEqual(["task-1"]);
    expect(clusters[0].categories).toEqual(["cost", "process"]);
  });

  it("builds a deterministic read model and ignores cross-project signals", () => {
    const signals: FrictionSignal[] = [
      signal({ signalId: "wait", category: "process", severity: "critical", entityId: "m1" }),
      signal({ signalId: "approval", category: "decision", severity: "high", entityId: "m1" }),
      { ...signal({ signalId: "other", category: "risk", severity: "critical" }), projectId: "other-project" },
    ];
    const a = buildFrictionRadarReadModel("org-1", "project-1", signals, { previousScore: 20 });
    const b = buildFrictionRadarReadModel("org-1", "project-1", signals, { previousScore: 20 });
    expect(a).toEqual(b);
    expect(a.generatedFromSignalCount).toBe(2);
    expect(a.score).toBeNull();
    expect(a.severity).toBeNull();
    expect(a.trend).toBe("unknown");
    expect(a.categories.every((category) => category.score == null)).toBe(true);
    expect(a.clusters).toHaveLength(1);
    expect(a.clusters[0].score).toBeNull();
  });

  it("returns an honest empty radar when no scoped signals exist", () => {
    const model = buildFrictionRadarReadModel("org-1", "project-1", []);
    expect(model.score).toBeNull();
    expect(model.generatedFromSignalCount).toBe(0);
    expect(model.trend).toBe("unknown");
    expect(model.clusters).toEqual([]);
  });

  it("keeps the category aggregation formula proposal outside the read model", () => {
    const inputs = [
      signal({ signalId: "one", category: "process", severity: "critical", score: 100 }),
      signal({ signalId: "two", category: "process", severity: "high", score: 70, confidence: "medium" }),
      signal({ signalId: "three", category: "process", severity: "medium", score: 40 }),
      signal({ signalId: "four", category: "process", severity: "low", score: 10 }),
    ];
    const proposal = proposeCategoryAggregation(inputs).find(
      (item) => item.category === "process",
    );
    expect(proposal).toMatchObject({
      method: "top3_confidence_weighted_mean",
      status: "proposal_only",
      inputSignalIds: ["one", "two", "three"],
    });
    expect(buildFrictionRadarReadModel("org-1", "project-1", inputs)
      .categories.find((item) => item.category === "process")?.score).toBeNull();
  });
});
