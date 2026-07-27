import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseEkiEvidenceRepository } from "../repository";
import type { EvidenceActorContext } from "../types";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const BINDING = "33333333-3333-4333-8333-333333333333";
const CONTROL = "44444444-4444-4444-8444-444444444444";

const context: EvidenceActorContext = { organizationId: ORG, userId: USER, role: "admin" };

type Call = { table: string; filters: Record<string, unknown>; order?: string; payload?: unknown };

/**
 * A query-builder stub that records what was asked for.
 *
 * The point of these tests is not that Supabase works — it is that every read is
 * scoped to the caller's organization and every "latest" read is ordered by the
 * identity column rather than the timestamp. Both are invisible in a mock that
 * only checks the returned rows.
 */
function stubClient(result: { data: unknown; error: unknown }, log: Call[]) {
  const builder = (table: string, payload?: unknown) => {
    const call: Call = { table, filters: {}, payload };
    log.push(call);
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = (column: string, value: unknown) => {
      call.filters[column] = value;
      return chain;
    };
    chain.order = (column: string, opts?: { ascending?: boolean }) => {
      call.order = `${column} ${opts?.ascending === false ? "desc" : "asc"}`;
      return chain;
    };
    chain.limit = self;
    chain.maybeSingle = () => Promise.resolve(result);
    chain.single = () => Promise.resolve(result);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  };

  return {
    from: (table: string) => ({
      select: (...args: unknown[]) => (builder(table) as { select: (...a: unknown[]) => unknown }).select(...args),
      insert: (payload: unknown) => builder(table, payload),
      update: (payload: unknown) => builder(table, payload),
    }),
    rpc: vi.fn().mockResolvedValue(result),
  } as unknown as SupabaseClient;
}

const bindingRow = {
  binding_object_id: BINDING,
  organization_id: ORG,
  resolver_key: "governance_audit_activity",
  freshness_interval: "7 days",
  warning_interval: "2 days",
  binding_state: "active",
  last_evaluated_at: null,
  last_success_at: null,
  last_evidence_at: null,
  last_outcome: null,
  consecutive_failures: 0,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("repository tenancy scoping", () => {
  it("scopes every read to the caller's organization", async () => {
    const log: Call[] = [];
    const read = stubClient({ data: bindingRow, error: null }, log);
    const repo = createSupabaseEkiEvidenceRepository(read, stubClient({ data: null, error: null }, []));

    await repo.getBinding(context, BINDING);
    await repo.getControlRuntime(context, CONTROL);

    expect(log).toHaveLength(2);
    for (const call of log) {
      expect(call.filters.organization_id, `${call.table} is not scoped by organization`).toBe(ORG);
    }
  });

  it("scopes list reads too", async () => {
    const log: Call[] = [];
    const read = stubClient({ data: [], error: null }, log);
    const repo = createSupabaseEkiEvidenceRepository(read, stubClient({ data: null, error: null }, []));

    await repo.listBindings(context);
    await repo.listOpenFindings(context);
    await repo.listOpenFindings(context, CONTROL);

    expect(log.map((c) => c.filters.organization_id)).toEqual([ORG, ORG, ORG]);
    expect(log[2].filters.target_object_id).toBe(CONTROL);
  });
});

describe("repository evaluation ordering", () => {
  /**
   * REG-029. `now()` is the transaction timestamp, so two evaluations written in
   * one transaction share it. Ordering by `evaluated_at` then picks an arbitrary
   * one as "latest", and a control that has just been re-evidenced keeps
   * reporting the stale result.
   */
  it("resolves the latest evaluation by sequence, not by timestamp", async () => {
    const log: Call[] = [];
    const read = stubClient({ data: null, error: null }, log);
    const repo = createSupabaseEkiEvidenceRepository(read, stubClient({ data: null, error: null }, []));

    await repo.latestEvaluation(context, BINDING);
    await repo.evaluationHistory(context, BINDING);

    expect(log.map((c) => c.order)).toEqual(["sequence_no desc", "sequence_no desc"]);
  });
});

describe("repository write routing", () => {
  it("sends mutations to the service-role client, never the caller's", async () => {
    const readLog: Call[] = [];
    const writeLog: Call[] = [];
    const read = stubClient({ data: null, error: null }, readLog);
    const write = stubClient({ data: bindingRow, error: null }, writeLog);
    const repo = createSupabaseEkiEvidenceRepository(read, write);

    await repo.createBinding(context, {
      bindingObjectId: BINDING,
      resolverKey: "governance_audit_activity",
      freshnessInterval: "7 days",
      warningInterval: "2 days",
    });

    expect(readLog).toHaveLength(0);
    expect(writeLog).toHaveLength(1);
    expect(writeLog[0].table).toBe("eki_evidence_binding_runtime");
  });

  /**
   * The actor comes from the trusted context. A client-supplied organization or
   * user id would let a caller write into a tenant it cannot read, and the audit
   * trail would record the forged identity as fact.
   */
  it("takes the organization and creator from the trusted context", async () => {
    const writeLog: Call[] = [];
    const write = stubClient({ data: bindingRow, error: null }, writeLog);
    const repo = createSupabaseEkiEvidenceRepository(stubClient({ data: null, error: null }, []), write);

    await repo.createBinding(context, {
      bindingObjectId: BINDING,
      resolverKey: "governance_audit_activity",
      freshnessInterval: "7 days",
      warningInterval: "2 days",
    });

    expect(writeLog[0].payload).toMatchObject({ organization_id: ORG, created_by: USER, binding_state: "defined" });
  });

  it("passes the trusted actor id to the resolution RPC", async () => {
    const write = stubClient({ data: { authorized: true, control_state: null }, error: null }, []);
    const repo = createSupabaseEkiEvidenceRepository(stubClient({ data: null, error: null }, []), write);

    await repo.resolveFinding(context, { findingObjectId: CONTROL, resolution: "resolved", rationale: "Evidence restored." });

    expect(write.rpc).toHaveBeenCalledWith("eki_resolve_finding", expect.objectContaining({ p_actor_id: USER }));
  });
});

describe("repository failure handling", () => {
  it("raises rather than returning an empty result when a read fails", async () => {
    const read = stubClient({ data: null, error: { message: "permission denied" } }, []);
    const repo = createSupabaseEkiEvidenceRepository(read, stubClient({ data: null, error: null }, []));
    await expect(repo.listBindings(context)).rejects.toThrow("permission denied");
  });

  it("raises when an evaluation RPC fails instead of reporting a pass", async () => {
    const write = stubClient({ data: null, error: { message: "eki_binding_not_found" } }, []);
    const repo = createSupabaseEkiEvidenceRepository(stubClient({ data: null, error: null }, []), write);
    await expect(repo.evaluateAndSync(context, BINDING)).rejects.toThrow("eki_binding_not_found");
  });
});

describe("repository result mapping", () => {
  it("maps a sync result with no control without inventing one", async () => {
    const write = stubClient(
      {
        data: {
          outcome: "current",
          reason_code: "evidence_fresh",
          evidence_count: 12,
          latest_evidence_at: "2026-07-20T10:00:00Z",
          evaluation_id: BINDING,
          binding_state: "active",
          control_object_id: null,
          finding: null,
        },
        error: null,
      },
      [],
    );
    const repo = createSupabaseEkiEvidenceRepository(stubClient({ data: null, error: null }, []), write);
    const result = await repo.evaluateAndSync(context, BINDING);
    expect(result).toMatchObject({ outcome: "current", evidenceCount: 12, controlObjectId: null, control: null, finding: null, condition: null });
  });

  it("maps a sync result that raised a finding", async () => {
    const write = stubClient(
      {
        data: {
          outcome: "stale",
          reason_code: "no_fresh_evidence",
          evidence_count: 0,
          latest_evidence_at: null,
          evaluation_id: BINDING,
          binding_state: "stale",
          control_object_id: CONTROL,
          control: { control_state: "degraded", changed: true, reason: "evidence_lapsed" },
          finding: { finding_object_id: CONTROL, created: true, occurrence_count: 1 },
          condition: "evidence_missing",
        },
        error: null,
      },
      [],
    );
    const repo = createSupabaseEkiEvidenceRepository(stubClient({ data: null, error: null }, []), write);
    const result = await repo.evaluateAndSync(context, BINDING);
    expect(result.control).toEqual({ controlState: "degraded", changed: true, reason: "evidence_lapsed" });
    expect(result.finding).toEqual({ findingObjectId: CONTROL, created: true, occurrenceCount: 1 });
    expect(result.condition).toBe("evidence_missing");
  });

  it("maps a denial without a value", async () => {
    const write = stubClient({ data: { authorized: false, reason: "eki_finding_resolution_forbidden" }, error: null }, []);
    const repo = createSupabaseEkiEvidenceRepository(stubClient({ data: null, error: null }, []), write);
    const result = await repo.resolveFinding(context, { findingObjectId: CONTROL, resolution: "resolved", rationale: "Attempt." });
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("eki_finding_resolution_forbidden");
  });
});
