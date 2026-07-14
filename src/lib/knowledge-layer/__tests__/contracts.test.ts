import { describe, expect, it } from "vitest";
import { authorizeKnowledgeAction, canTransitionKnowledgeObject, createKnowledgeObjectSchema } from "../contracts";
import { KNOWLEDGE_OBJECT_TYPES } from "../types";

const baseProposal = {
  projectId: "11111111-1111-4111-8111-111111111111",
  knowledgeType: "finding" as const,
  idempotencyKey: "manual:finding:one",
  title: "Finding",
  summary: "A supported finding",
  body: "Evidence-backed content",
  confidence: "high" as const,
  confidenceReason: "Direct evidence is available.",
  provenance: { captureMethod: "direct" as const, sourceKind: "review", sourceRef: "review-1" },
  evidence: [{ type: "document" as const, ref: "doc-1", role: "supports" as const, confidence: "high" as const }],
  proposalRationale: "Submitted for governed review.",
};

describe("knowledge object contracts", () => {
  it("accepts every canonical knowledge type", () => {
    for (const knowledgeType of KNOWLEDGE_OBJECT_TYPES) {
      expect(createKnowledgeObjectSchema.safeParse({ ...baseProposal, knowledgeType }).success).toBe(true);
    }
  });

  it("requires evidence", () => {
    expect(createKnowledgeObjectSchema.safeParse({ ...baseProposal, evidence: [] }).success).toBe(false);
  });

  it("enforces role permissions", () => {
    expect(authorizeKnowledgeAction("viewer", "propose")).toBe(false);
    expect(authorizeKnowledgeAction("member", "revise")).toBe(true);
    expect(authorizeKnowledgeAction("member", "validate")).toBe(false);
    expect(authorizeKnowledgeAction("admin", "activate")).toBe(true);
  });

  it("allows only proposed to validated to active", () => {
    expect(canTransitionKnowledgeObject("proposed", "validated")).toBe(true);
    expect(canTransitionKnowledgeObject("validated", "active")).toBe(true);
    expect(canTransitionKnowledgeObject("proposed", "active")).toBe(false);
    expect(canTransitionKnowledgeObject("active", "validated")).toBe(false);
  });
});
