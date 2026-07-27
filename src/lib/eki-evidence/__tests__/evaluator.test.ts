import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { EkiEvaluator, scheduledRunKey } from "../evaluator";
import {
  evaluatorSecret,
  extractSecret,
  isAutomatedEvaluationEnabled,
  secretMatches,
} from "../automation-flag";

const RUN = "11111111-1111-4111-8111-111111111111";
const BINDING_A = "22222222-2222-4222-8222-222222222222";
const BINDING_B = "33333333-3333-4333-8333-333333333333";
const ORG = "44444444-4444-4444-8444-444444444444";

/** Records every RPC so the orchestration can be asserted, not just the result. */
function stubClient(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      if (!handler) return { data: null, error: { message: `unstubbed:${fn}` } };
      const result = handler(args);
      if (result instanceof Error) return { data: null, error: { message: result.message } };
      return { data: result, error: null };
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

const claim = (bindingObjectId: string, token: string) => ({
  binding_object_id: bindingObjectId,
  organization_id: ORG,
  claim_token: token,
});

const okEvaluation = { evaluated: true, outcome: "current", control: { control_state: "operating" } };

describe("scheduled run key", () => {
  /**
   * Every at-least-once scheduler eventually delivers the same tick twice.
   * Collapsing to the minute means the duplicate joins the run in flight instead
   * of starting a second sweep that competes for the same bindings.
   */
  it("collapses deliveries within the same minute", () => {
    const a = scheduledRunKey(new Date("2026-07-27T10:15:03.000Z"));
    const b = scheduledRunKey(new Date("2026-07-27T10:15:59.999Z"));
    expect(a).toBe(b);
  });

  it("separates different minutes and different tenants", () => {
    expect(scheduledRunKey(new Date("2026-07-27T10:15:00Z"))).not.toBe(
      scheduledRunKey(new Date("2026-07-27T10:16:00Z")),
    );
    expect(scheduledRunKey(new Date("2026-07-27T10:15:00Z"), ORG)).not.toBe(
      scheduledRunKey(new Date("2026-07-27T10:15:00Z")),
    );
  });
});

describe("sweep orchestration", () => {
  it("claims what is due and evaluates each claim exactly once", async () => {
    const { client, calls } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => [claim(BINDING_A, "t-a"), claim(BINDING_B, "t-b")],
      eki_evaluate_claimed_binding: () => okEvaluation,
      eki_complete_evaluation_run: () => ({ status: "succeeded", claimed: 2, evaluated: 2, failed: 0 }),
    });

    const summary = await new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" });

    expect(summary).toMatchObject({ evaluated: 2, failed: 0, superseded: 0, status: "succeeded" });
    const evaluations = calls.filter((c) => c.fn === "eki_evaluate_claimed_binding");
    expect(evaluations).toHaveLength(2);
    // The token travels with the binding. Sending the wrong one would evaluate a
    // binding the sweep does not hold.
    expect(evaluations[0].args).toMatchObject({ p_binding_object_id: BINDING_A, p_claim_token: "t-a" });
    expect(evaluations[1].args).toMatchObject({ p_binding_object_id: BINDING_B, p_claim_token: "t-b" });
  });

  /**
   * The whole reason this is a sweep and not a transaction. A batch that aborts
   * on the first failure leaves every later tenant unevaluated, and that silence
   * is indistinguishable from health.
   */
  it("keeps going when one binding fails", async () => {
    const { client } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => [claim(BINDING_A, "t-a"), claim(BINDING_B, "t-b")],
      eki_evaluate_claimed_binding: (args) =>
        args.p_binding_object_id === BINDING_A
          ? { evaluated: false, reason: "evaluation_error", error: "source unreadable" }
          : okEvaluation,
      eki_complete_evaluation_run: () => ({ status: "partial", claimed: 2, evaluated: 1, failed: 1 }),
    });

    const summary = await new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" });
    expect(summary).toMatchObject({ evaluated: 1, failed: 1, status: "partial" });
  });

  it("keeps going when the RPC itself throws for one binding", async () => {
    const { client } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => [claim(BINDING_A, "t-a"), claim(BINDING_B, "t-b")],
      eki_evaluate_claimed_binding: (args) =>
        args.p_binding_object_id === BINDING_A ? new Error("transport failure") : okEvaluation,
      eki_complete_evaluation_run: () => ({ status: "partial", claimed: 2, evaluated: 1, failed: 1 }),
    });

    const summary = await new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" });
    expect(summary.evaluated).toBe(1);
    expect(summary.failed).toBeGreaterThanOrEqual(1);
  });

  /** A superseded worker is neither a success nor a failure — it is counted apart. */
  it("counts a superseded claim separately from a failure", async () => {
    const { client } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => [claim(BINDING_A, "stale-token")],
      eki_evaluate_claimed_binding: () => ({ evaluated: false, reason: "claim_superseded" }),
      eki_complete_evaluation_run: () => ({ status: "succeeded", claimed: 1, evaluated: 0, failed: 0 }),
    });

    const summary = await new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" });
    expect(summary.superseded).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it("claims nothing when the run is a duplicate delivery", async () => {
    const { client, calls } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: true, status: "running" }),
    });

    const summary = await new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" });
    expect(summary).toMatchObject({ duplicate: true, status: "duplicate", claimed: 0, evaluated: 0 });
    expect(calls.some((c) => c.fn === "eki_claim_due_bindings")).toBe(false);
  });

  it("closes the run with a failure category when claiming fails", async () => {
    const { client, calls } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => new Error("claim exploded"),
      eki_complete_evaluation_run: () => ({ status: "failed", claimed: 0, evaluated: 0, failed: 0 }),
    });

    await expect(new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" })).rejects.toThrow();
    // The run is closed rather than left `running` forever, which would make the
    // next sweep's observability read as if a worker were still alive.
    const completion = calls.find((c) => c.fn === "eki_complete_evaluation_run");
    expect(completion?.args).toMatchObject({ p_failure_category: "claim_failed" });
  });

  it("never attributes a scheduled run to a person", async () => {
    const { client, calls } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => [],
      eki_complete_evaluation_run: () => ({ status: "succeeded", claimed: 0, evaluated: 0, failed: 0 }),
    });

    await new EkiEvaluator(client).sweep({ runKey: "k", trigger: "scheduled" });
    expect(calls[0].args).toMatchObject({ p_requested_by: null, p_trigger_type: "scheduled" });
  });

  it("bounds the batch size it will claim", async () => {
    const { client, calls } = stubClient({
      eki_start_evaluation_run: () => ({ run_id: RUN, duplicate: false }),
      eki_claim_due_bindings: () => [],
      eki_complete_evaluation_run: () => ({ status: "succeeded", claimed: 0, evaluated: 0, failed: 0 }),
    });

    const evaluator = new EkiEvaluator(client);
    await evaluator.sweep({ runKey: "a", trigger: "scheduled", batchSize: 10_000 });
    await evaluator.sweep({ runKey: "b", trigger: "scheduled", batchSize: -5 });
    const claims = calls.filter((c) => c.fn === "eki_claim_due_bindings");
    expect(claims[0].args.p_limit).toBe(500);
    expect(claims[1].args.p_limit).toBe(1);
  });
});

describe("evaluator endpoint gating", () => {
  it("is off unless explicitly enabled", () => {
    const original = process.env.EKI_AUTOMATED_EVALUATION_ENABLED;
    delete process.env.EKI_AUTOMATED_EVALUATION_ENABLED;
    expect(isAutomatedEvaluationEnabled()).toBe(false);
    process.env.EKI_AUTOMATED_EVALUATION_ENABLED = "1";
    expect(isAutomatedEvaluationEnabled()).toBe(false);
    process.env.EKI_AUTOMATED_EVALUATION_ENABLED = "true";
    expect(isAutomatedEvaluationEnabled()).toBe(true);
    if (original === undefined) delete process.env.EKI_AUTOMATED_EVALUATION_ENABLED;
    else process.env.EKI_AUTOMATED_EVALUATION_ENABLED = original;
  });

  /** A short secret is treated as no secret: the endpoint refuses rather than accepts. */
  it("rejects a secret too short to be one", () => {
    const original = process.env.EKI_EVALUATOR_SECRET;
    process.env.EKI_EVALUATOR_SECRET = "short";
    expect(evaluatorSecret()).toBeNull();
    process.env.EKI_EVALUATOR_SECRET = "0123456789abcdef0123";
    expect(evaluatorSecret()).toBe("0123456789abcdef0123");
    if (original === undefined) delete process.env.EKI_EVALUATOR_SECRET;
    else process.env.EKI_EVALUATOR_SECRET = original;
  });

  it("compares secrets without accepting a prefix", () => {
    expect(secretMatches("0123456789abcdef", "0123456789abcdef")).toBe(true);
    expect(secretMatches("0123456789abcde", "0123456789abcdef")).toBe(false);
    expect(secretMatches("0123456789abcdefX", "0123456789abcdef")).toBe(false);
    expect(secretMatches(null, "0123456789abcdef")).toBe(false);
    expect(secretMatches("", "0123456789abcdef")).toBe(false);
  });

  it("accepts the Bearer header the scheduler sends and the explicit ops header", () => {
    expect(extractSecret(new Headers({ authorization: "Bearer abc" }))).toBe("abc");
    expect(extractSecret(new Headers({ "x-eki-evaluator-secret": "abc" }))).toBe("abc");
    expect(extractSecret(new Headers({ authorization: "Basic abc" }))).toBeNull();
    expect(extractSecret(new Headers())).toBeNull();
  });
});
