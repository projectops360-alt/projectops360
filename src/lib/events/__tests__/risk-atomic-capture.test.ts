// ============================================================================
// P2-T2 remediation — atomic capture helpers + prepareAtomicEvent (Fase 2/8)
// ============================================================================
// Verifies the TS side of the transactional boundary:
//   * the capture flag OFF is a strict no-op by construction (no RPC call);
//   * validation failures are returned, never swallowed;
//   * the RPCs are called with the (event, payloadText, refs) triple produced by
//     prepareAtomicEvent, reusing computeDedupKey + the exact payload
//     serialization of computeEventHash (hash consistency with the SQL side).
// The PostgreSQL transaction itself is exercised by the functional DB test
// (risk-capture-verification.test.ts, RISK_CAPTURE_VERIFY=1) — not here.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";

// Capture flag must be mocked BEFORE importing the helpers (they read it at
// call time, so a runtime mock is fine, but the module must be importable).
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/events/risk-capture-flag", () => ({
  isRiskEventCaptureEnabled: vi.fn(),
  isRiskEventCaptureAffordancesEnabled: vi.fn(),
  isRiskEventCaptureEnabledFor: vi.fn(),
  isRiskEventCaptureAffordancesEnabledFor: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { isRiskEventCaptureEnabled } from "@/lib/events/risk-capture-flag";
import {
  captureRiskRegisteredAtomic,
  captureRiskEventAtomic,
  captureRiskStatusChangeAtomic,
} from "@/lib/events/risk-events";
import { prepareAtomicEvent, computeEventHash, computeDedupKey } from "@/lib/events/ingestion";

const ORG = "00000000-0000-0000-0000-000000000001";
const PROJ = "00000000-0000-0000-0000-000000000002";
const RISK = "00000000-0000-0000-0000-000000000003";
const USER = "00000000-0000-0000-0000-000000000004";

function fakeRpc(returnValue: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data: returnValue, error: null });
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ rpc });
  return rpc;
}

function validRegisteredInput() {
  // Mirrors buildRiskRegistered output for a known risk.
  return {
    organizationId: ORG,
    projectId: PROJ,
    eventType: "risk_registered",
    subjectId: RISK,
    actorType: "human" as const,
    actorId: USER,
    sourceModule: "scribe",
    sourceEntityType: "risks",
    sourceEntityId: RISK,
    occurredAt: "2026-07-12T00:00:00Z",
    fromState: "open",
    toState: "open",
    provenance: { capture_method: "direct", evidenceRefs: [{ type: "project_memory_item", id: "mem1" }] },
    payload: { origin: "ai_suggested" },
    objectRefs: [
      { objectType: "risk", objectId: RISK, role: "focal" },
      { objectType: "project", objectId: PROJ, role: "context" },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("prepareAtomicEvent", () => {
  it("produces the (event, payloadText, refs) triple with a dedup_key and snake_case refs", () => {
    const input = validRegisteredInput();
    const res = prepareAtomicEvent(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { event, payloadText, refs } = res.data;
    expect(payloadText).toBe(JSON.stringify(input.payload));
    expect(refs).toEqual([
      { object_type: "risk", object_id: RISK, role: "focal" },
      { object_type: "project", object_id: PROJ, role: "context" },
    ]);
    expect(event.dedup_key).toEqual(computeDedupKey({ ...input, occurredAt: event.occurred_at as string }));
    expect(event.event_type).toBe("risk_registered");
    expect(event.organization_id).toBe(ORG);
  });

  it("derives a STABLE dedup_key from idempotencyKey (independent of occurredAt/subjectId)", () => {
    // BLOCKER 2: a retry must produce the SAME dedup_key. With idempotencyKey set,
    // the key ignores the fresh occurredAt and the per-retry risk id.
    const base = validRegisteredInput();
    const first = computeDedupKey({ ...base, idempotencyKey: "scribe:mem-1", occurredAt: "2026-07-12T01:00:00Z" });
    const retry = computeDedupKey({
      ...base,
      idempotencyKey: "scribe:mem-1",
      occurredAt: "2026-07-12T02:00:00Z", // different
      subjectId: "00000000-0000-0000-0000-000000000099", // different per-retry uuid
      sourceEntityId: "00000000-0000-0000-0000-000000000099",
    });
    expect(first).toBe(retry);
    expect(first).toBe(createHash("sha256").update(`${PROJ}|risk_registered|scribe:mem-1`).digest("hex"));
  });

  it("fails on an invalid event (missing required payload field) without throwing", () => {
    const input = validRegisteredInput();
    // risk_registered requires payload.origin — remove it.
    (input as { payload: Record<string, unknown> }).payload = {};
    const res = prepareAtomicEvent(input);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.includes("payload.origin"))).toBe(true);
  });
});

describe("captureRiskEventAtomic (append-only: assess / materialize)", () => {
  it("is a strict no-op when the capture flag is OFF (no RPC call)", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const rpc = fakeRpc({ ok: true, deduped: false, event_id: "evt-1" });
    const res = await captureRiskEventAtomic({
      input: {
        ...validRegisteredInput(),
        eventType: "risk_assessed",
        payload: { method: "qualitative", values: { probability: "medium", impact: "high", severity: "high" }, assessed_at: "2026-07-12T00:00:00Z" },
      },
    });
    expect(res).toEqual({ ok: false, error: "flag_off" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls append_risk_event_atomic with the prepared triple and returns the event id", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const rpc = fakeRpc({ ok: true, deduped: false, event_id: "evt-assess-1" });
    const input = {
      organizationId: ORG, projectId: PROJ, eventType: "risk_assessed",
      subjectId: RISK, actorType: "human" as const, actorId: USER,
      sourceModule: "closeout", sourceEntityType: "risks", sourceEntityId: RISK,
      payload: { method: "qualitative", values: { probability: "medium", impact: "high", severity: "high" }, assessed_at: "2026-07-12T00:00:00Z" },
      objectRefs: [{ objectType: "risk", objectId: RISK, role: "focal" }],
    };
    const res = await captureRiskEventAtomic({ input });
    expect(res.ok).toBe(true);
    expect(res.eventId).toBe("evt-assess-1");
    expect(rpc).toHaveBeenCalledTimes(1);
    const args = rpc.mock.calls[0][1];
    expect(args).toEqual({ p_event: expect.any(Object), p_payload_text: expect.any(String), p_refs: expect.any(Array) });
    expect(args.p_payload_text).toBe(JSON.stringify(input.payload));
    expect(args.p_refs[0]).toEqual({ object_type: "risk", object_id: RISK, role: "focal" });
    // No risk mutation param for the append-only RPC.
    expect(args).not.toHaveProperty("p_risk");
  });

  it("returns validation_failed (no RPC) for an invalid event even with the flag on", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const rpc = fakeRpc({ ok: true, event_id: "x" });
    const res = await captureRiskEventAtomic({
      input: { ...validRegisteredInput(), eventType: "risk_assessed", payload: { method: "x" } }, // missing values + assessed_at
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("validation_failed");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates an RPC error (no silent drop)", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ rpc });
    const res = await captureRiskEventAtomic({
      input: {
        ...validRegisteredInput(), eventType: "risk_assessed",
        payload: { method: "qualitative", values: { probability: "medium", impact: "high", severity: "high" }, assessed_at: "2026-07-12T00:00:00Z" },
      },
    });
    expect(res).toEqual({ ok: false, error: "boom" });
  });
});

describe("captureRiskRegisteredAtomic (INSERT risk + event)", () => {
  const riskFields = {
    organization_id: ORG, project_id: PROJ, title: "Test risk", category: "other",
    probability: "medium", impact: "high", severity: "high", status: "open",
    origin: "ai_suggested", confidence_score: 0.9, needs_review: true,
  };

  it("is a strict no-op when the capture flag is OFF (no RPC, no riskId)", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const rpc = fakeRpc({ ok: true, event_id: "e", deduped: false });
    const res = await captureRiskRegisteredAtomic({
      riskFields,
      actor: { actorType: "human", actorId: USER },
      captureMethod: "direct",
      origin: "ai_suggested",
      sourceModule: "scribe",
      title: "Test risk",
      evidenceRef: { type: "project_memory_item", id: "mem1" },
      operationId: "scribe:mem1",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("flag_off");
    expect(res.riskId).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls capture_risk_registered with a writer-generated attempt id and returns the RPC risk_id", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    // The RPC returns the canonical risk_id (existing on dedup, new on insert).
    const rpc = fakeRpc({ ok: true, event_id: "evt-reg-1", deduped: false, risk_id: "rpc-risk-id" });
    const res = await captureRiskRegisteredAtomic({
      riskFields,
      actor: { actorType: "human", actorId: USER },
      captureMethod: "direct",
      origin: "ai_suggested",
      sourceModule: "scribe",
      title: "Test risk",
      evidenceRef: { type: "project_memory_item", id: "mem1" },
      operationId: "scribe:mem1",
    });
    expect(res.ok).toBe(true);
    expect(res.eventId).toBe("evt-reg-1");
    // BLOCKER 2: the returned risk id is the RPC's canonical id, NOT the
    // per-retry attempt id.
    expect(res.riskId).toBe("rpc-risk-id");
    const args = rpc.mock.calls[0][1];
    // The attempt id (a uuid) is passed as p_risk.id / subject_id / source_entity_id.
    expect(args.p_risk.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(args.p_risk.organization_id).toBe(ORG);
    expect(args.p_event.subject_id).toBe(args.p_risk.id);
    expect(args.p_event.source_entity_id).toBe(args.p_risk.id);
    // The dedup_key is derived from the STABLE operationId, not the attempt id.
    expect(args.p_event.dedup_key).toBe(
      createHash("sha256").update(`${PROJ}|risk_registered|scribe:mem1`).digest("hex"),
    );
    // Focal object_ref re-pointed to the attempt risk id.
    expect(args.p_refs).toContainEqual({ object_type: "risk", object_id: args.p_risk.id, role: "focal" });
  });
});

describe("captureRiskStatusChangeAtomic (UPDATE risk + event)", () => {
  it("is a strict no-op when the capture flag is OFF", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const rpc = fakeRpc({ ok: true, event_id: "e" });
    const res = await captureRiskStatusChangeAtomic({
      riskId: RISK, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ORG, projectId: PROJ, operationId: "closeout:reopen:r1",
      input: {
        ...validRegisteredInput(), eventType: "risk_reopened",
        payload: { reason_code: "risk_resurfaced" },
      },
    });
    expect(res).toEqual({ ok: false, error: "flag_off" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls capture_risk_status_change with the risk id, expectedFromStatus + stable dedup", async () => {
    (isRiskEventCaptureEnabled as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const rpc = fakeRpc({ ok: true, event_id: "evt-reopen-1", deduped: false });
    const res = await captureRiskStatusChangeAtomic({
      riskId: RISK, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ORG, projectId: PROJ, operationId: "closeout:reopen:r1",
      input: {
        ...validRegisteredInput(), eventType: "risk_reopened",
        payload: { reason_code: "risk_resurfaced" },
      },
    });
    expect(res.ok).toBe(true);
    expect(res.eventId).toBe("evt-reopen-1");
    const args = rpc.mock.calls[0][1];
    expect(args.p_risk_id).toBe(RISK);
    expect(args.p_new_status).toBe("open");
    expect(args.p_expected_from_status).toBe("resolved");
    expect(args.p_organization_id).toBe(ORG);
    expect(args.p_project_id).toBe(PROJ);
    // BLOCKER 3: the dedup_key is derived from the STABLE operationId, so a
    // retry produces the same key and the RPC dedupes BEFORE the UPDATE.
    expect(args.p_event.dedup_key).toBe(
      createHash("sha256").update(`${PROJ}|risk_reopened|closeout:reopen:r1`).digest("hex"),
    );
  });
});

describe("hash consistency between TS and the SQL RPC contract", () => {
  it("computeEventHash joins the same fields the RPC's _append_event_atomic hashes", () => {
    // Documented contract: the SQL hash = sha256(project|seq|type|subject|actor|
    // occurred|from|to|payload_text|prev). payload_text = JSON.stringify(payload).
    // computeEventHash must use the identical field order + serialization so the
    // chain stays verifiable across the atomic and non-atomic paths.
    const input = validRegisteredInput();
    const seq = 7;
    const prev = "prev-hash";
    const tsHash = computeEventHash(input, seq, prev);
    // Reconstruct with the exact same join — if computeEventHash changes field
    // order, this test fails and flags the divergence from the SQL formula.
    const stable = [
      input.projectId, seq, input.eventType, input.subjectId ?? "", input.actorType,
      input.occurredAt ?? "", input.fromState ?? "", input.toState ?? "",
      JSON.stringify(input.payload ?? {}), prev ?? "",
    ].join("|");
    expect(tsHash).toBe(createHash("sha256").update(stable).digest("hex"));
  });
});