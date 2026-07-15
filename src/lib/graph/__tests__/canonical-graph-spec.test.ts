import { describe, expect, it } from "vitest";
import { CANONICAL_GRAPH_LAYERS, CANONICAL_GRAPH_SPEC, CANONICAL_RELATIONSHIP_RULES } from "../canonical-graph-spec";

describe("canonical graph specification", () => {
  it("publishes the six required versioned layers", () => {
    expect(CANONICAL_GRAPH_SPEC.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CANONICAL_GRAPH_LAYERS).toEqual(["object", "relationship", "event", "knowledge", "intelligence", "prediction"]);
  });

  it("keeps temporal order distinct from explicit causality and compensation", () => {
    expect(CANONICAL_RELATIONSHIP_RULES.find((rule) => rule.family === "project_sequence_next")).toMatchObject({ relationshipClass: "temporal", requiresExplicitProvenance: false });
    expect(CANONICAL_RELATIONSHIP_RULES.find((rule) => rule.family === "caused_by")).toMatchObject({ relationshipClass: "causal", requiresEvidence: true, requiresExplicitProvenance: true });
    expect(CANONICAL_RELATIONSHIP_RULES.find((rule) => rule.family === "compensates")).toMatchObject({ relationshipClass: "compensation", requiresEvidence: true });
    expect(CANONICAL_GRAPH_SPEC.invariants.temporalOrderIsCausality).toBe(false);
    expect(CANONICAL_GRAPH_SPEC.invariants.graphOwnsKnowledgeLifecycle).toBe(false);
  });
});
