import { describe, expect, it } from "vitest";
import {
  buildFrictionRadarReadModel,
  correlateFrictionSignals,
  scoreFrictionSignal,
  type FrictionSignal,
} from "@/lib/friction-radar";

const base = {
  organizationId: "org-1",
  projectId: "project-1",
  confidence: "high" as const,
  evidenceRefs: [{ kind: "event", id: "e1" }],
};

function signal(partial: Partial<FrictionSignal> & Pick<FrictionSignal, "signalId" | "category" | "severity">): FrictionSignal {
  return {
    ...base,
    source: "mpf",
    signalType: partial.signalId,
    ...partial,
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
});
