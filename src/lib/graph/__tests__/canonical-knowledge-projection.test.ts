import { describe, expect, it } from "vitest";
import type { KnowledgeObjectReadModel } from "@/lib/knowledge-layer/types";
import { projectKnowledgeObjectsToCanonicalGraph, type ScopedKnowledgeEvidence } from "../canonical-graph-projection";
import { validateCanonicalGraph } from "../canonical-graph-validator";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const knowledgeObject: KnowledgeObjectReadModel = {
  id: "33333333-3333-4333-8333-333333333333", organizationId, projectId, knowledgeType: "finding", status: "validated",
  currentVersionNo: 2, activeVersionNo: 1, title: "Repeated approval delay", summary: "Approval waits repeat", body: "Body",
  structuredContent: {}, confidence: "high", confidenceReason: "Canonical event evidence", evidenceCount: 1,
  provenance: { captureMethod: "derived", sourceKind: "milestone_process_flow", sourceRef: "finding-1", engineName: "mpf" },
  createdBy: "44444444-4444-4444-8444-444444444444", createdAt: "2026-07-14T00:00:00Z", updatedAt: "2026-07-14T01:00:00Z",
};
const evidence: ScopedKnowledgeEvidence = {
  id: "55555555-5555-4555-8555-555555555555", knowledgeObjectId: knowledgeObject.id, versionNo: 2, organizationId, projectId,
  type: "engine_finding", ref: "finding-1", role: "supports", confidence: "high", note: "MPF finding", metadata: {},
  createdBy: knowledgeObject.createdBy, createdAt: "2026-07-14T01:00:00Z",
};

describe("canonical Knowledge projection", () => {
  it("preserves lifecycle, confidence, evidence and deterministic ids", () => {
    const first = projectKnowledgeObjectsToCanonicalGraph([knowledgeObject], [evidence]);
    const retry = projectKnowledgeObjectsToCanonicalGraph([knowledgeObject], [evidence]);
    expect(retry).toEqual(first);
    expect(first.nodes.find((node) => node.family === "knowledge_object")).toMatchObject({ layer: "knowledge", lifecycleStatus: "validated", confidence: "high", evidenceRefs: ["finding-1"] });
    expect(first.edges[0]).toMatchObject({ family: "derived_from", relationshipClass: "derived_intelligence", evidenceRefs: ["finding-1"] });
    expect(validateCanonicalGraph(first, organizationId, projectId)).toEqual({ valid: true, issues: [] });
  });

  it("does not mutate lifecycle data", () => {
    const frozen = structuredClone(knowledgeObject);
    projectKnowledgeObjectsToCanonicalGraph([knowledgeObject], [evidence]);
    expect(knowledgeObject).toEqual(frozen);
  });
});
