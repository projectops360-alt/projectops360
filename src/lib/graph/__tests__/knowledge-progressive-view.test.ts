import { describe, expect, it } from "vitest";
import type { LivingGraphEdge, LivingGraphNode } from "@/types/living-graph";
import { buildProgressiveKnowledgeGraph } from "../knowledge-progressive-view";

const projectId = "22222222-2222-4222-8222-222222222222";

function node(id: string, type: LivingGraphNode["nodeType"], createdAt: string, metadata: Record<string, unknown> = {}): LivingGraphNode {
  return {
    id, projectId, nodeType: type, sourceEntityType: type === "knowledge_object" ? "project_knowledge_objects" : "knowledge_evidence",
    sourceEntityId: id, label: id, description: null, status: type === "knowledge_object" ? "proposed" : null,
    progress: null, startDate: null, endDate: null, durationDays: null, occurredAt: createdAt, createdAt, updatedAt: createdAt,
    riskLevel: null, isBlocked: false, isCritical: false, milestoneId: null, milestoneLabel: null, milestoneOrder: null,
    traceabilityScore: 1, metadata,
  };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, ref: string): LivingGraphEdge {
  return {
    id, projectId, sourceNodeId, targetNodeId, edgeType: "supported_by", weight: 1, lagDays: null,
    isCritical: false, riskLevel: null,
    metadata: { evidenceType: "project_event", evidenceRole: "supports", evidenceRefs: [ref] },
  };
}

describe("progressive Knowledge graph", () => {
  const nodes = [
    node("knowledge-2", "knowledge_object", "2026-01-02T00:00:00Z"),
    node("event-1", "evidence_reference", "2026-01-03T00:00:00Z", { evidenceType: "project_event" }),
    node("knowledge-1", "knowledge_object", "2026-01-01T00:00:00Z"),
    node("event-2", "evidence_reference", "2026-01-04T00:00:00Z", { evidenceType: "project_event" }),
  ];
  const edges = [
    edge("edge-1", "knowledge-1", "event-1", "event-ref-1"),
    edge("edge-2", "knowledge-1", "event-2", "event-ref-2"),
    edge("edge-3", "knowledge-2", "event-2", "event-ref-2"),
  ];

  it("shows only ordered Knowledge Objects before focus", () => {
    const result = buildProgressiveKnowledgeGraph(nodes, edges, null, "en");
    expect(result.nodes.map((item) => item.id)).toEqual(["knowledge-1", "knowledge-2"]);
    expect(result.edges).toEqual([]);
    expect(result.positions.get("knowledge-1")?.x).toBeLessThan(result.positions.get("knowledge-2")!.x);
  });

  it("groups only the focused object's evidence", () => {
    const result = buildProgressiveKnowledgeGraph(nodes, edges, "knowledge-1", "en");
    const aggregate = result.nodes.find((item) => item.metadata.aggregateEvidence === true);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(1);
    expect(aggregate).toMatchObject({ label: "2 canonical events", metadata: { clusterSize: 2 } });
    expect(result.evidenceCount).toBe(2);
    expect(result.edges[0]).toMatchObject({ sourceNodeId: "knowledge-1", targetNodeId: aggregate?.id, weight: 2 });
  });

  it("does not mutate the canonical display graph", () => {
    const originalNodes = structuredClone(nodes);
    const originalEdges = structuredClone(edges);
    buildProgressiveKnowledgeGraph(nodes, edges, "knowledge-1", "es");
    expect(nodes).toEqual(originalNodes);
    expect(edges).toEqual(originalEdges);
  });
});
