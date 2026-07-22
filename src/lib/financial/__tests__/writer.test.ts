import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import {
  captureFinancialMovementAtomic,
  prepareFinancialMovementCapture,
  type FinancialMovementCaptureInput,
} from "../writer.server";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const parentId = "33333333-3333-4333-8333-333333333333";
const movementId = "44444444-4444-4444-8444-444444444444";

function validInput(): FinancialMovementCaptureInput {
  return {
    domain: "funding",
    parentId,
    operationKey: "release:FA-001:v1",
    movement: {
      id: movementId,
      movement_type: "release",
      amount: 250,
      currency: "USD",
      effective_date: "2026-07-22",
    },
    event: {
      organizationId,
      projectId,
      eventType: "funding_released",
      actorType: "human",
      actorId: "55555555-5555-4555-8555-555555555555",
      sourceModule: "financial_control",
      sourceEntityType: "funding_authorization",
      sourceEntityId: parentId,
      payload: { amount: 250, currency: "USD" },
      provenance: { evidenceRefs: ["approval:FA-001"] },
      objectRefs: [
        { objectType: "funding_authorization", objectId: parentId, role: "parent" },
      ],
    },
  };
}

beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv("FINANCIAL_FOUNDATION_ENABLED", "true");
  vi.stubEnv("FINANCIAL_WRITERS_ENABLED", "true");
  vi.stubEnv("FINANCIAL_PILOT_PROJECT_IDS", projectId);
});

afterEach(() => vi.unstubAllEnvs());

describe("financial atomic movement writer", () => {
  it("normalizes the event and binds the idempotency fingerprint", () => {
    const prepared = prepareFinancialMovementCapture(validInput());
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("expected_valid_capture");
    expect(prepared.data).toMatchObject({
      p_domain: "funding",
      p_parent_id: parentId,
      p_operation_key: "release:FA-001:v1",
      p_event: {
        project_id: projectId,
        subject_id: movementId,
        event_type: "funding_released",
      },
    });
    expect(prepared.data.p_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(
      (prepared.data.p_event.provenance as Record<string, unknown>).idempotency_fingerprint,
    ).toBe(prepared.data.p_fingerprint);
  });

  it("rejects an event that does not belong to the movement domain", () => {
    const prepared = prepareFinancialMovementCapture({
      ...validInput(),
      event: { ...validInput().event, eventType: "payment_settled" },
    });
    expect(prepared).toMatchObject({ ok: false });
  });

  it("does not call the database when writers are disabled", async () => {
    vi.stubEnv("FINANCIAL_WRITERS_ENABLED", "false");
    await expect(captureFinancialMovementAtomic(validInput())).resolves.toEqual({
      ok: false,
      error: "financial_writers_disabled",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the service-only atomic RPC when the pilot flags allow it", async () => {
    rpc.mockResolvedValue({
      data: { ok: true, event_id: "event-1", movement_id: movementId, deduped: false },
      error: null,
    });
    await expect(captureFinancialMovementAtomic(validInput())).resolves.toEqual({
      ok: true,
      eventId: "event-1",
      deduped: false,
    });
    expect(rpc).toHaveBeenCalledWith(
      "capture_financial_movement_atomic",
      expect.objectContaining({ p_domain: "funding", p_parent_id: parentId }),
    );
  });
});
