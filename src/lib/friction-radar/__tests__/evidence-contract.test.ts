import { describe, expect, it } from "vitest";
import { assessFrictionSignalEvidence, partitionEvidenceCompleteSignals } from "../evidence-contract";
import { buildFrictionRadarReadModel } from "../read-model";
import type { FrictionSignal } from "../types";

function signal(index: number): FrictionSignal {
  return {
    signalId: `signal-${index.toString().padStart(2, "0")}`,
    organizationId: "org",
    projectId: "project",
    source: "process_mining",
    signalType: "test_signal",
    category: "process",
    entityType: "task",
    entityId: `task-${index}`,
    taskId: `task-${index}`,
    milestoneId: null,
    severity: "high",
    confidence: "high",
    score: 100 - index,
    magnitude: (100 - index) / 100,
    observedValue: index,
    expectedOrBaseline: 0,
    evidenceStatus: "confirmed",
    occurredAt: null,
    evidenceTimestampStart: null,
    evidenceTimestampEnd: null,
    evidenceDescription: "Traceable test evidence.",
    evidenceRefs: [{ kind: "project_event_log", id: `event-${index}` }],
  };
}

describe("Friction Radar evidence contract and ranking", () => {
  it("accepts explicit null baselines/timestamps but rejects missing evidence refs", () => {
    expect(assessFrictionSignalEvidence(signal(1))).toMatchObject({ status: "complete" });
    const invalid = { ...signal(2), evidenceRefs: [] };
    expect(assessFrictionSignalEvidence(invalid)).toMatchObject({
      status: "incomplete",
      missingFields: ["evidenceRefs"],
    });
    expect(partitionEvidenceCompleteSignals([signal(1), invalid])).toMatchObject({
      complete: [signal(1)],
      rejected: [{ signalId: invalid.signalId, status: "incomplete" }],
    });
  });

  it("returns a deterministic Top 20 while keeping category/global scores null", () => {
    const model = buildFrictionRadarReadModel(
      "org",
      "project",
      Array.from({ length: 25 }, (_, index) => signal(index)),
    );
    expect(model.topSignalIds).toHaveLength(20);
    expect(model.topSignalIds[0]).toBe("signal-00");
    expect(model.topSignalIds.at(-1)).toBe("signal-19");
    expect(model.score).toBeNull();
    expect(model.categories.every((category) => category.score == null)).toBe(true);
  });
});
