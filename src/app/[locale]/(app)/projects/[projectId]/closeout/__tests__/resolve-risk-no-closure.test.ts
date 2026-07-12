// ============================================================================
// P2-T2 remediation — Fase 6 regression test (CAP-045 §A.10 #11 binding: RI-05)
// ============================================================================
// resolveRiskAction is the Closeout bulk-resolve path. It is a closure
// ACCEPTANCE without the request→validate→evidence gate, so it must NOT emit
// risk_closed (and must NOT silently default closure_reason='accepted'). The
// preexisting transaccional behavior (UPDATE risks.status = 'resolved') is
// preserved. This test FAILS if any of the following is re-introduced:
//   * a risk_closed event via buildRiskClosed / emitRiskEventSafe;
//   * an atomic closure via capture_risk_status_change / capture_risk_event_atomic;
//   * any direct write to project_event_log from this action.
// "No green test, no closed regression" — CLAUDE.md rule #2.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// getOrgContext: authenticated PM (non-viewer).
vi.mock("@/lib/auth", () => ({
  getOrgContext: vi.fn().mockResolvedValue({
    organizationId: "00000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000004",
    role: "member",
  }),
}));

// revalidatePath: spy (no-op).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// risk-events: spies on every export so we can assert resolveRiskAction touches
// NONE of the closure/capture surfaces.
vi.mock("@/lib/events/risk-events", () => ({
  buildRiskClosed: vi.fn(),
  emitRiskEventSafe: vi.fn(),
  buildRiskAssessed: vi.fn(),
  buildRiskMaterialized: vi.fn(),
  buildRiskReopened: vi.fn(),
  captureRiskEventAtomic: vi.fn(),
  captureRiskStatusChangeAtomic: vi.fn(),
  captureRiskRegisteredAtomic: vi.fn(),
}));

// supabase admin: a recording fake. The select returns a scoped open risk; the
// update returns success. We assert which tables/methods were touched.
const supabaseCalls: { table: string; method: string; args: unknown[] }[] = [];
function recordCall(table: string, method: string, args: unknown[]) {
  supabaseCalls.push({ table, method, args });
}

function chainable(table: string, terminal: unknown) {
  const obj: Record<string, unknown> = {};
  const methods = ["select", "update", "insert", "eq", "neq", "is", "order", "limit", "maybeSingle", "single"];
  for (const m of methods) {
    obj[m] = vi.fn(function (this: unknown, ...args: unknown[]) {
      recordCall(table, m, args);
      return this;
    });
  }
  // Terminal async methods resolve the chain.
  obj.maybeSingle = vi.fn(async () => terminal);
  obj.single = vi.fn(async () => terminal);
  return obj;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    const from = vi.fn((table: string) => {
      // The first "risks" select returns a real-ish open risk row.
      if (table === "risks") {
        return chainable("risks", { data: { id: "r1", status: "open", linked_task_id: null, linked_milestone_id: null }, error: null });
      }
      return chainable(table, { data: null, error: null });
    });
    const rpc = vi.fn((name: string, params: unknown) => {
      recordCall("__rpc__", name, [params]);
      return Promise.resolve({ data: null, error: null });
    });
    return { from, rpc };
  }),
}));

import { resolveRiskAction } from "../actions";
import { getOrgContext } from "@/lib/auth";
import {
  buildRiskClosed,
  emitRiskEventSafe,
  captureRiskStatusChangeAtomic,
  captureRiskEventAtomic,
} from "@/lib/events/risk-events";

const PROJ = "00000000-0000-0000-0000-000000000002";
const RISK = "r1";

beforeEach(() => {
  supabaseCalls.length = 0;
  vi.clearAllMocks();
});

describe("resolveRiskAction — Fase 6: no risk_closed without RI-05", () => {
  it("updates the risk status to 'resolved' (preserves transaccional behavior)", async () => {
    await resolveRiskAction(PROJ, RISK, "en", "mitigated");
    const update = supabaseCalls.find((c) => c.table === "risks" && c.method === "update");
    expect(update).toBeDefined();
    expect(update?.args[0]).toEqual({ status: "resolved" });
  });

  it("does NOT emit a risk_closed event (no buildRiskClosed call)", async () => {
    await resolveRiskAction(PROJ, RISK, "en", "mitigated");
    expect(buildRiskClosed).not.toHaveBeenCalled();
  });

  it("does NOT call the fire-and-forget emitter", async () => {
    await resolveRiskAction(PROJ, RISK, "en", "mitigated");
    expect(emitRiskEventSafe).not.toHaveBeenCalled();
  });

  it("does NOT use an atomic capture RPC for closure", async () => {
    await resolveRiskAction(PROJ, RISK, "en", "mitigated");
    expect(captureRiskStatusChangeAtomic).not.toHaveBeenCalled();
    expect(captureRiskEventAtomic).not.toHaveBeenCalled();
  });

  it("does NOT write to project_event_log at all", async () => {
    await resolveRiskAction(PROJ, RISK, "en", "mitigated");
    const pelInsert = supabaseCalls.find((c) => c.table === "project_event_log" && c.method === "insert");
    expect(pelInsert).toBeUndefined();
    const closureRpc = supabaseCalls.find((c) => c.table === "__rpc__" && c.method === "capture_risk_status_change");
    expect(closureRpc).toBeUndefined();
  });

  it("ignores the closureReason argument (no silent 'accepted' default)", async () => {
    // Passing a reason must not trigger any closure event; the arg is reserved
    // for a future RI-05 workflow and is currently a no-op.
    await resolveRiskAction(PROJ, RISK, "en", "mitigated");
    expect(buildRiskClosed).not.toHaveBeenCalled();
    // No risk_closed anywhere in the recorded calls.
    const anyClosure = supabaseCalls.find(
      (c) => c.table === "project_event_log" || (c.table === "__rpc__" && /capture/.test(c.method)),
    );
    expect(anyClosure).toBeUndefined();
  });

  it("rejects viewers (not_authorized)", async () => {
    (getOrgContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      organizationId: "org1", userId: "u1", role: "viewer",
    });
    const res = await resolveRiskAction(PROJ, RISK, "en");
    expect(res).toEqual({ ok: false, reason: "not_authorized" });
  });
});