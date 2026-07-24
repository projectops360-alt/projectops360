import { describe, expect, it } from "vitest";
import { computeProcessGraphLayout } from "../graph/use-process-graph-layout";
import type {
  ProcessGraphConnection,
  ProcessGraphEntity,
} from "@/lib/pmo-process-intelligence/process-graph.types";

const stageIds = ["initiate", "plan", "execute", "control", "close"].map(
  (stage) => `stage:${stage}`,
);

const entities = stageIds.map(
  (id): ProcessGraphEntity => ({
    id,
    kind: "stage",
    label: id,
    definition: id,
    parentId: null,
    projectId: null,
    stageKey: id.slice("stage:".length) as ProcessGraphEntity["stageKey"],
    status: "stable",
    metrics: {},
    includedEntityIds: [],
    evidence: [],
    href: null,
  }),
);

const connections = stageIds.slice(0, -1).map(
  (source, index): ProcessGraphConnection => ({
    id: `edge:${index}`,
    source,
    target: stageIds[index + 1],
    sourceLabel: source,
    targetLabel: stageIds[index + 1],
    kind: "execution-flow",
    label: "reference",
    projectIds: [],
    caseCount: 0,
    transitionCount: 0,
    frequency: 0,
    averageTransitionMs: null,
    averageWaitMs: null,
    reworkCount: 0,
    budgetImpact: null,
    lastObservedAt: null,
    dataQualityScore: 0,
    evidence: [],
  }),
);

describe("Process graph Dagre layout", () => {
  it("does not share Dagre's mutable size object across same-kind nodes", () => {
    const positions = computeProcessGraphLayout(entities, connections);
    const xCoordinates = stageIds.map((id) => positions.get(id)?.x);

    expect(new Set(xCoordinates).size).toBe(stageIds.length);
    expect(xCoordinates).toEqual([...xCoordinates].sort((left, right) => (left ?? 0) - (right ?? 0)));
  });
});
