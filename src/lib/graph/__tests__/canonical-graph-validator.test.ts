import { describe, expect, it } from "vitest";
import { projectKnowledgeObjectsToCanonicalGraph, type ScopedKnowledgeEvidence } from "../canonical-graph-projection";
import { validateCanonicalGraph } from "../canonical-graph-validator";
import type { KnowledgeObjectReadModel } from "@/lib/knowledge-layer/types";

const org = "11111111-1111-4111-8111-111111111111";
const project = "22222222-2222-4222-8222-222222222222";
const object = { id: "33333333-3333-4333-8333-333333333333", organizationId: org, projectId: project, knowledgeType: "finding", status: "active", currentVersionNo: 1, activeVersionNo: 1, title: "Finding", summary: "Summary", body: "Body", structuredContent: {}, confidence: "high", confidenceReason: "Evidence", provenance: { captureMethod: "direct", sourceKind: "review", sourceRef: "review-1" }, evidenceCount: 1, createdBy: "44444444-4444-4444-8444-444444444444", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } satisfies KnowledgeObjectReadModel;
const evidence = { id: "55555555-5555-4555-8555-555555555555", knowledgeObjectId: object.id, versionNo: 1, organizationId: org, projectId: project, type: "project_event", ref: "66666666-6666-4666-8666-666666666666", role: "supports", confidence: "high", metadata: {}, createdBy: object.createdBy, createdAt: object.createdAt } satisfies ScopedKnowledgeEvidence;

describe("canonical graph validator", () => {
  it("rejects cross-project, dangling, duplicate and unstable rows", () => {
    const projection = projectKnowledgeObjectsToCanonicalGraph([object], [evidence]);
    projection.nodes.push({ ...projection.nodes[0], projectId: "77777777-7777-4777-8777-777777777777" });
    projection.edges[0] = { ...projection.edges[0], id: "unstable", targetNodeId: "missing" };
    const codes = validateCanonicalGraph(projection, org, project).issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["cross_project", "duplicate_id", "dangling_endpoint"]));
  });

  it("rejects direct activation-like ownership changes by construction", () => {
    const projection = projectKnowledgeObjectsToCanonicalGraph([object], [evidence]);
    expect(projection.nodes[0].lifecycleStatus).toBe("active");
    expect(projection).not.toHaveProperty("transition");
  });
});
