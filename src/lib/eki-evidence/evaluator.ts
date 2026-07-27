import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BindingClaim,
  ClaimedEvaluationResult,
  RunTrigger,
  SweepSummary,
} from "./types";

/**
 * The automated evaluator.
 *
 * Macrophase 2 produced an engine that answers correctly whenever something asks
 * it. Nothing asked it. This is the thing that asks — on a cadence, exactly once
 * per due execution, and leaving a record afterwards.
 *
 * Every write goes through a database function that runs as the service role.
 * The orchestration here is deliberately thin: claiming, sequencing and failure
 * containment are enforced in SQL, where a second process cannot route around
 * them. Moving any of that into this file would make correctness depend on there
 * being exactly one evaluator, which is the assumption the whole design refuses.
 */

/** How many bindings one sweep will claim. Bounded so a sweep cannot run forever. */
const DEFAULT_BATCH = 50;

/** Claim lifetime. Longer than any healthy evaluation, shorter than a cadence. */
const CLAIM_TTL = "5 minutes";

export interface EvaluatorOptions {
  /** Restricts the sweep to one tenant. Derived server-side, never from a client. */
  organizationId?: string | null;
  batchSize?: number;
  /**
   * Idempotency key for the run. Duplicate delivery of the same job resolves to
   * the same run rather than to two runs that each claim half the work.
   */
  runKey: string;
  trigger: RunTrigger;
  requestedBy?: string | null;
}

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export class EkiEvaluator {
  constructor(private readonly serviceClient: SupabaseClient) {}

  /**
   * Run one sweep: start (or join) a run, claim what is due, evaluate each claim,
   * close the run.
   *
   * A binding that fails is recorded and skipped; the sweep continues. A batch
   * that aborts on the first failure leaves every later tenant unevaluated, and
   * that silence is indistinguishable from health — which is the exact confusion
   * this system exists to remove.
   */
  async sweep(options: EvaluatorOptions): Promise<SweepSummary> {
    const started = await this.startRun(options);
    if (started.duplicate) {
      // Someone else already owns this run key. Claiming again would compete
      // with the run that is already in flight for the same bindings.
      return {
        runId: started.runId,
        duplicate: true,
        claimed: 0,
        evaluated: 0,
        failed: 0,
        superseded: 0,
        status: "duplicate",
      };
    }

    let claims: BindingClaim[] = [];
    try {
      claims = await this.claimDue(started.runId, options);
    } catch (error) {
      await this.completeRun(started.runId, "claim_failed", messageOf(error));
      throw error;
    }

    let evaluated = 0;
    let failed = 0;
    let superseded = 0;

    for (const claim of claims) {
      let result: ClaimedEvaluationResult;
      try {
        result = await this.evaluateClaim(started.runId, claim);
      } catch (error) {
        // The RPC itself failed — a transport or permission problem rather than
        // an evidence problem. Contained here so the remaining tenants still run.
        failed += 1;
        void error;
        continue;
      }
      if (result.evaluated) evaluated += 1;
      else if (result.reason === "claim_superseded") superseded += 1;
      else failed += 1;
    }

    const summary = await this.completeRun(started.runId);
    return { ...summary, runId: started.runId, duplicate: false, superseded };
  }

  async startRun(options: EvaluatorOptions): Promise<{ runId: string; duplicate: boolean }> {
    const { data, error } = await this.serviceClient.rpc("eki_start_evaluation_run", {
      p_run_key: options.runKey,
      p_trigger_type: options.trigger,
      p_organization_id: options.organizationId ?? null,
      // The scheduler has no human actor and must not borrow one. A run
      // attributed to a person who was asleep is a false statement in the record.
      p_requested_by: options.requestedBy ?? null,
    });
    if (error || !data) fail(error, "eki_run_start_failed");
    const row = data as Record<string, unknown>;
    return { runId: String(row.run_id), duplicate: Boolean(row.duplicate) };
  }

  async claimDue(runId: string, options: EvaluatorOptions): Promise<BindingClaim[]> {
    const batch = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH, 1), 500);
    const { data, error } = await this.serviceClient.rpc("eki_claim_due_bindings", {
      p_run_id: runId,
      p_limit: batch,
      p_organization_id: options.organizationId ?? null,
      p_claim_ttl: CLAIM_TTL,
    });
    if (error) fail(error, "eki_claim_failed");
    return (data as unknown[] | null ?? []).map((row) => {
      const claim = row as Record<string, unknown>;
      return {
        bindingObjectId: String(claim.binding_object_id),
        organizationId: String(claim.organization_id),
        claimToken: String(claim.claim_token),
      };
    });
  }

  async evaluateClaim(runId: string, claim: BindingClaim): Promise<ClaimedEvaluationResult> {
    const { data, error } = await this.serviceClient.rpc("eki_evaluate_claimed_binding", {
      p_run_id: runId,
      p_binding_object_id: claim.bindingObjectId,
      p_claim_token: claim.claimToken,
    });
    if (error || !data) fail(error, "eki_claimed_evaluation_failed");
    const row = data as Record<string, unknown>;
    const control = row.control as Record<string, unknown> | null;
    return {
      evaluated: Boolean(row.evaluated),
      reason: row.reason == null ? undefined : String(row.reason),
      outcome: row.outcome as ClaimedEvaluationResult["outcome"],
      controlObjectId: row.control_object_id == null ? null : String(row.control_object_id),
      controlState: control ? (control.control_state as ClaimedEvaluationResult["controlState"]) : null,
      findingObjectId:
        row.finding && typeof row.finding === "object"
          ? String((row.finding as Record<string, unknown>).finding_object_id)
          : null,
      condition: (row.condition ?? null) as ClaimedEvaluationResult["condition"],
      error: row.error == null ? undefined : String(row.error),
    };
  }

  async completeRun(
    runId: string,
    failureCategory?: string,
    error?: string,
  ): Promise<{ claimed: number; evaluated: number; failed: number; status: SweepSummary["status"] }> {
    const { data, error: rpcError } = await this.serviceClient.rpc("eki_complete_evaluation_run", {
      p_run_id: runId,
      p_failure_category: failureCategory ?? null,
      p_error: error ?? null,
    });
    if (rpcError || !data) fail(rpcError, "eki_run_complete_failed");
    const row = data as Record<string, unknown>;
    return {
      claimed: Number(row.claimed ?? 0),
      evaluated: Number(row.evaluated ?? 0),
      failed: Number(row.failed ?? 0),
      status: row.status as SweepSummary["status"],
    };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The run key for a scheduled sweep.
 *
 * Truncated to the minute so a cron delivered twice — which every at-least-once
 * scheduler does eventually — resolves to one run instead of two competing ones.
 * Exported and pure so the collapsing behaviour is testable without a scheduler.
 */
export function scheduledRunKey(at: Date, organizationId?: string | null): string {
  const minute = new Date(Math.floor(at.getTime() / 60_000) * 60_000).toISOString().slice(0, 16);
  return `scheduled:${organizationId ?? "all"}:${minute}`;
}
