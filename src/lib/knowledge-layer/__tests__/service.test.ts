import { describe, expect, it, vi } from "vitest";
import type { KnowledgeLayerRepository } from "../repository";
import { KnowledgeLayerError, KnowledgeLayerService } from "../service";

const context = { organizationId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", role: "member" as const };
const proposal = {
  projectId: "33333333-3333-4333-8333-333333333333", knowledgeType: "finding" as const, idempotencyKey: "manual:finding:one",
  title: "Finding", summary: "Supported finding", body: "Body", confidence: "medium" as const,
  confidenceReason: "Evidence is partial.", provenance: { captureMethod: "direct" as const, sourceKind: "review", sourceRef: "r-1" },
  evidence: [{ type: "document" as const, ref: "d-1", role: "supports" as const, confidence: "medium" as const }],
  proposalRationale: "Requires validation.",
};

function repository(): KnowledgeLayerRepository {
  return {
    create: vi.fn().mockResolvedValue({ knowledgeObjectId: "k", versionNo: 1, status: "proposed", deduped: false }),
    revise: vi.fn(), transition: vi.fn().mockResolvedValue({ knowledgeObjectId: "k", versionNo: 1, status: "validated", deduped: false }),
    list: vi.fn().mockResolvedValue([]), history: vi.fn().mockResolvedValue({ versions: [], evidence: [], transitions: [] }),
  };
}

describe("KnowledgeLayerService", () => {
  it("lets members propose but not validate", async () => {
    const repo = repository();
    const service = new KnowledgeLayerService(repo);
    await expect(service.propose(context, proposal)).resolves.toMatchObject({ status: "proposed" });
    await expect(service.validate(context, { knowledgeObjectId: "44444444-4444-4444-8444-444444444444", expectedVersionNo: 1, rationale: "Reviewed." }))
      .rejects.toMatchObject({ code: "knowledge_action_forbidden" } satisfies Partial<KnowledgeLayerError>);
    expect(repo.transition).not.toHaveBeenCalled();
  });

  it("rejects invalid input before persistence", async () => {
    const repo = repository();
    const service = new KnowledgeLayerService(repo);
    await expect(service.propose(context, { ...proposal, evidence: [] })).rejects.toMatchObject({ code: "invalid_knowledge_proposal" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("allows admins to validate and activate", async () => {
    const repo = repository();
    const service = new KnowledgeLayerService(repo);
    const admin = { ...context, role: "admin" as const };
    const transition = { knowledgeObjectId: "44444444-4444-4444-8444-444444444444", expectedVersionNo: 1, rationale: "Evidence reviewed." };
    await service.validate(admin, transition);
    await service.activate(admin, transition);
    expect(repo.transition).toHaveBeenNthCalledWith(1, admin, { ...transition, targetStatus: "validated" });
    expect(repo.transition).toHaveBeenNthCalledWith(2, admin, { ...transition, targetStatus: "active" });
  });
});
