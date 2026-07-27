import { describe, expect, it, vi } from "vitest";
import type { EkiEvidenceRepository } from "../repository";
import { EkiEvidenceError, EkiEvidenceService } from "../service";
import type { EvidenceActorContext } from "../types";

const BINDING = "11111111-1111-4111-8111-111111111111";
const CONTROL = "22222222-2222-4222-8222-222222222222";
const FINDING = "33333333-3333-4333-8333-333333333333";
const PERSON = "44444444-4444-4444-8444-444444444444";

const admin: EvidenceActorContext = { organizationId: CONTROL, userId: PERSON, role: "admin" };
const member: EvidenceActorContext = { ...admin, role: "member" };
const viewer: EvidenceActorContext = { ...admin, role: "viewer" };

function repository(overrides: Partial<EkiEvidenceRepository> = {}): EkiEvidenceRepository {
  return {
    createBinding: vi.fn().mockResolvedValue({ bindingObjectId: BINDING, bindingState: "defined" }),
    setBindingState: vi.fn().mockResolvedValue({ bindingObjectId: BINDING, bindingState: "active" }),
    getBinding: vi.fn().mockResolvedValue(null),
    listBindings: vi.fn().mockResolvedValue([]),
    evaluateAndSync: vi.fn().mockResolvedValue({ outcome: "current", control: { controlState: "operating" } }),
    latestEvaluation: vi.fn().mockResolvedValue(null),
    evaluationHistory: vi.fn().mockResolvedValue([]),
    getControlRuntime: vi.fn().mockResolvedValue({ controlObjectId: CONTROL, controlState: "degraded" }),
    controlGate: vi.fn().mockResolvedValue({ canOperate: false, reasons: ["owner_not_assigned"] }),
    recalculateControl: vi.fn().mockResolvedValue({ controlState: "degraded", changed: false, reason: "unchanged" }),
    listOpenFindings: vi.fn().mockResolvedValue([]),
    resolveFinding: vi.fn().mockResolvedValue({ authorized: true, value: { controlState: "degraded" } }),
    assignOwner: vi.fn().mockResolvedValue({ authorized: true, value: { previousOwner: null } }),
    ...overrides,
  } as unknown as EkiEvidenceRepository;
}

const binding = {
  bindingObjectId: BINDING,
  resolverKey: "governance_audit_activity" as const,
  freshnessInterval: "7 days",
  warningInterval: "2 days",
};

describe("EkiEvidenceService authorization", () => {
  it("lets a member evaluate but not define a binding", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(service.evaluate(member, BINDING)).resolves.toMatchObject({ outcome: "current" });
    await expect(service.defineBinding(member, binding)).rejects.toMatchObject({ code: "eki_evidence_action_forbidden" });
    expect(repo.createBinding).not.toHaveBeenCalled();
  });

  it("lets a viewer read but never evaluate", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(service.listBindings(viewer)).resolves.toEqual([]);
    await expect(service.evaluate(viewer, BINDING)).rejects.toMatchObject({ code: "eki_evidence_action_forbidden" });
    expect(repo.evaluateAndSync).not.toHaveBeenCalled();
  });

  it("refuses a member closing a finding before it reaches the database", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(
      service.resolveFinding(member, { findingObjectId: FINDING, resolution: "resolved", rationale: "Fixed." }),
    ).rejects.toMatchObject({ code: "eki_evidence_action_forbidden" });
    expect(repo.resolveFinding).not.toHaveBeenCalled();
  });
});

describe("EkiEvidenceService validation", () => {
  it("rejects a malformed identifier before any query", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(service.evaluate(admin, "not-a-uuid")).rejects.toMatchObject({ code: "invalid_binding_object_id" });
    await expect(service.controlEvidenceStatus(admin, "1234")).rejects.toMatchObject({ code: "invalid_control_object_id" });
    expect(repo.evaluateAndSync).not.toHaveBeenCalled();
    expect(repo.getControlRuntime).not.toHaveBeenCalled();
  });

  it("rejects a resolution with no rationale", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(
      service.resolveFinding(admin, { findingObjectId: FINDING, resolution: "resolved", rationale: "  " }),
    ).rejects.toMatchObject({ code: "invalid_finding_resolution" });
    expect(repo.resolveFinding).not.toHaveBeenCalled();
  });

  it("rejects an interval it cannot recognise", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(
      service.defineBinding(admin, { ...binding, freshnessInterval: "whenever" }),
    ).rejects.toMatchObject({ code: "invalid_evidence_binding" });
    expect(repo.createBinding).not.toHaveBeenCalled();
  });
});

describe("EkiEvidenceService denial handling", () => {
  /**
   * The database returns denials rather than raising them, so the audit record
   * survives. The service converts the denial to an error only after that record
   * exists — this test pins the conversion, not the enforcement.
   */
  it("turns a database denial into an error without inventing a success", async () => {
    const repo = repository({
      resolveFinding: vi.fn().mockResolvedValue({ authorized: false, reason: "eki_finding_resolution_forbidden" }),
    });
    const service = new EkiEvidenceService(repo);
    await expect(
      service.resolveFinding(admin, { findingObjectId: FINDING, resolution: "resolved", rationale: "Reviewed." }),
    ).rejects.toMatchObject({ code: "eki_finding_resolution_forbidden" });
    expect(repo.resolveFinding).toHaveBeenCalledOnce();
  });

  it("does the same for owner assignment", async () => {
    const repo = repository({
      assignOwner: vi.fn().mockResolvedValue({ authorized: false, reason: "eki_owner_assignment_forbidden" }),
    });
    const service = new EkiEvidenceService(repo);
    await expect(
      service.assignOwner(admin, { objectId: CONTROL, ownerUserId: PERSON, rationale: "Named owner." }),
    ).rejects.toBeInstanceOf(EkiEvidenceError);
  });

  it("does not treat a missing reason as authorization", async () => {
    const repo = repository({ resolveFinding: vi.fn().mockResolvedValue({ authorized: false }) });
    const service = new EkiEvidenceService(repo);
    await expect(
      service.resolveFinding(admin, { findingObjectId: FINDING, resolution: "accepted", rationale: "Accepted." }),
    ).rejects.toMatchObject({ code: "eki_finding_resolution_forbidden" });
  });
});

describe("EkiEvidenceService control status", () => {
  it("returns the state, the gate and the open findings together", async () => {
    const repo = repository({
      listOpenFindings: vi.fn().mockResolvedValue([{ conditionCode: "evidence_stale", findingObjectId: FINDING }]),
    });
    const service = new EkiEvidenceService(repo);
    const status = await service.controlEvidenceStatus(admin, CONTROL);
    expect(status).toMatchObject({
      control: { controlState: "degraded" },
      gate: { canOperate: false, reasons: ["owner_not_assigned"] },
      openFindings: [{ conditionCode: "evidence_stale" }],
    });
  });

  /** No runtime row means the control was never measured — not that it passes. */
  it("returns null for an unmeasured control instead of a default", async () => {
    const repo = repository({ getControlRuntime: vi.fn().mockResolvedValue(null) });
    const service = new EkiEvidenceService(repo);
    await expect(service.controlEvidenceStatus(admin, CONTROL)).resolves.toBeNull();
    expect(repo.controlGate).not.toHaveBeenCalled();
  });
});

describe("EkiEvidenceService binding lifecycle", () => {
  it("activates and retires through the same guarded path", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await service.activateBinding(admin, BINDING);
    await service.retireBinding(admin, BINDING);
    expect(repo.setBindingState).toHaveBeenNthCalledWith(1, admin, BINDING, "active");
    expect(repo.setBindingState).toHaveBeenNthCalledWith(2, admin, BINDING, "retired");
  });

  it("does not let a member retire a binding", async () => {
    const repo = repository();
    const service = new EkiEvidenceService(repo);
    await expect(service.retireBinding(member, BINDING)).rejects.toMatchObject({ code: "eki_evidence_action_forbidden" });
    expect(repo.setBindingState).not.toHaveBeenCalled();
  });
});
