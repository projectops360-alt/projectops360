// ============================================================================
// P2-T2 remediation — BLOCKER 3: concurrency + reopen idempotency (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves, against the REAL local database, that capture_risk_status_change is
// concurrency-safe (SELECT ... FOR UPDATE + dedup re-check after the lock +
// conditional UPDATE validated by ROW_COUNT):
//   1. two CONCURRENT calls with the SAME commandOperationId → ONE event, ONE
//      transition (the second returns deduped);
//   2. two CONCURRENT calls with DIFFERENT command ids from the same state →
//      only ONE valid transition (the other raises wrong_from_state);
//   3. a second legitimate cycle (after re-resolving) with a new id → a NEW
//      risk_reopened event;
//   4. a retry of the first cycle (same id) does NOT affect the second cycle
//      and does NOT create a new event;
//   5. a dedup hit NEVER returns success leaving the state wrong.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-concurrency.test.ts
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeDedupKey } from "@/lib/events/ingestion";

function loadEnvTest(): void {
  const p = resolve(process.cwd(), ".env.test");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const RUN = process.env.RISK_CAPTURE_VERIFY === "1";

describe.runIf(RUN)("P2-T2 BLOCKER 3 — concurrency + reopen idempotency (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  let builders: any;
  const ids = { org: "", project: "", risk: "", owner: "", reopenOpId: "", reopenEventId: "" };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`P2-T2 concurrency test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");
    const admin = await import("@/lib/supabase/admin");
    supabase = admin.createAdminClient();
    atomic = await import("@/lib/events/risk-events");
    builders = await import("@/lib/events/risk-events");

    const { data: anyProject } = await supabase
      .from("projects").select("organization_id, created_by").is("deleted_at", null).limit(1).single();
    ids.org = anyProject.organization_id;
    ids.owner = anyProject.created_by ?? "00000000-0000-0000-0000-000000000001";
    const { data: project, error } = await supabase.from("projects").insert({
      organization_id: ids.org, slug: `p2t2-conc-${Date.now()}`,
      title_i18n: { en: "P2-T2 concurrency (temp)", es: "Verificación concurrencia (temp)" },
      status: "active",
    }).select("id").single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = ids.project;

    const reg = await atomic.captureRiskRegisteredAtomic({
      riskFields: {
        organization_id: ids.org, project_id: ids.project,
        title: "Concurrency risk", category: "technical",
        probability: "medium", impact: "high", severity: "high",
        status: "open", origin: "manual",
      },
      actor: { actorType: "human", actorId: ids.owner },
      captureMethod: "direct", origin: "manual", sourceModule: "conc-test",
      title: "Concurrency risk",
      evidenceRef: { type: "project", id: ids.project },
      operationId: `conc:register:${ids.project}`,
    });
    expect(reg.ok, `register failed: ${reg.error ?? ""}`).toBe(true);
    ids.risk = reg.riskId;
  }, 120_000);

  afterAll(async () => {
    if (ids.project) {
      await supabase.from("project_event_counters").delete().eq("project_id", ids.project);
      await supabase.from("projects").delete().eq("id", ids.project);
    }
  }, 120_000);

  function reopenInput(opId: string) {
    return atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project, operationId: opId,
      input: builders.buildRiskReopened({
        risk: { riskId: ids.risk, organizationId: ids.org, projectId: ids.project },
        actor: { actorType: "human", actorId: ids.owner },
        sourceModule: "conc-test", reasonCode: "risk_resurfaced",
        priorClosureEventId: null, fromState: "resolved", toState: "open",
      }),
    });
  }

  async function setStatus(status: string) {
    const { error } = await supabase.from("risks")
      .update({ status }).eq("id", ids.risk).eq("project_id", ids.project).eq("organization_id", ids.org);
    expect(error).toBeNull();
  }
  async function currentStatus(): Promise<string> {
    const { data } = await supabase.from("risks").select("status").eq("id", ids.risk).single();
    return data?.status;
  }
  async function reopenedCount(): Promise<number> {
    const { count } = await supabase.from("project_event_log")
      .select("event_id", { count: "exact", head: true })
      .eq("project_id", ids.project).eq("event_type", "risk_reopened");
    return count ?? 0;
  }

  it("1. two CONCURRENT same-command calls → ONE event, ONE transition", async () => {
    await setStatus("resolved");
    const opId = `conc:reopen:same:${ids.risk}:${Date.now()}`;
    const [a, b] = await Promise.all([reopenInput(opId), reopenInput(opId)]);
    // Exactly one transitioned (deduped=false), one deduped (deduped=true).
    const winners = [a, b].filter((r) => r.ok && r.deduped === false);
    const dedups = [a, b].filter((r) => r.ok && r.deduped === true);
    expect(winners.length).toBe(1);
    expect(dedups.length).toBe(1);
    expect(await currentStatus()).toBe("open");
    expect(await reopenedCount()).toBe(1);
    // Capture the EXACT operationId + event id of this cycle so test 4 can reuse
    // them (NOT the stored dedup_key — passing it back as an operationId would
    // hash the hash and fail to dedup).
    ids.reopenOpId = opId;
    ids.reopenEventId = winners[0].eventId!;
  }, 120_000);

  it("2. two CONCURRENT different-command calls from the same state → ONE valid transition", async () => {
    await setStatus("resolved");
    const opA = `conc:reopen:diff-a:${ids.risk}:${Date.now()}`;
    const opB = `conc:reopen:diff-b:${ids.risk}:${Date.now()}`;
    const [a, b] = await Promise.all([reopenInput(opA), reopenInput(opB)]);
    // Exactly one wins (deduped=false); the other is rejected (wrong_from_state).
    const winners = [a, b].filter((r) => r.ok && r.deduped === false);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);
    expect(await currentStatus()).toBe("open");
    expect(await reopenedCount()).toBe(2); // one from test 1 + one here
  }, 120_000);

  it("3. a second legitimate cycle (re-resolve → new id) creates a NEW risk_reopened", async () => {
    await setStatus("resolved"); // re-resolve
    const opId = `conc:reopen:cycle2:${ids.risk}:${Date.now()}`;
    const before = await reopenedCount();
    const r = await reopenInput(opId);
    expect(r.ok).toBe(true);
    expect(r.deduped).toBe(false);
    expect(await currentStatus()).toBe("open");
    expect(await reopenedCount()).toBe(before + 1);
  }, 120_000);

  it("4. retry of an EXISTING reopen command does NOT create a new event nor affect state", async () => {
    // Reuse the EXACT operationId from cycle 1 (ids.reopenOpId) — NOT the stored
    // dedup_key. The dedup_key is sha256(project|type|opId); passing it back as an
    // operationId would produce sha256(project|type|sha256(...)) — a DIFFERENT key
    // that does NOT match the stored row, so the RPC would NOT dedup and would
    // instead transition + append a duplicate event. Reusing the original opId is
    // the only correct retry.
    const existingOpId = ids.reopenOpId;
    expect(existingOpId).toBeTruthy();
    // Invariant: computeDedupKey(opId) MUST equal the stored dedup_key of cycle 1.
    const expectedDedup = computeDedupKey({
      organizationId: ids.org, projectId: ids.project, eventType: "risk_reopened",
      actorType: "human", sourceModule: "conc-test", idempotencyKey: existingOpId,
    } as never);
    const { data: stored } = await supabase.from("project_event_log")
      .select("event_id, dedup_key, subject_id, updated_at").eq("project_id", ids.project)
      .eq("event_type", "risk_reopened").eq("subject_id", ids.risk)
      .order("sequence_number", { ascending: true }).limit(1).single();
    expect(stored?.dedup_key).toBe(expectedDedup);
    const storedEventId = stored?.event_id as string;
    const storedUpdatedAt = (stored as { updated_at?: string } | null)?.updated_at ?? null;
    // Re-resolve so the state WOULD allow a transition if the id were new.
    await setStatus("resolved");
    const before = await reopenedCount();
    const retry = await reopenInput(existingOpId);
    expect(retry.ok).toBe(true);
    expect(retry.deduped).toBe(true);
    expect(retry.eventId).toBe(storedEventId); // same event id as cycle 1
    expect(await reopenedCount()).toBe(before); // no new event
    expect(await currentStatus()).toBe("resolved"); // NOT transitioned back to open
    // No mutation: the stored row's updated_at is unchanged by a dedup hit.
    const { data: after } = await supabase.from("project_event_log")
      .select("updated_at").eq("event_id", storedEventId).single();
    expect((after as { updated_at?: string } | null)?.updated_at ?? null).toBe(storedUpdatedAt);
  }, 120_000);

  it("5. a dedup hit NEVER returns success leaving the state wrong", async () => {
    // The risk is currently 'open' (after test 4 re-resolved then deduped... or
    // possibly resolved). Force a known resolved state, do one reopen (→ open),
    // then a retry of that SAME opId while the state is 'open' (not resolved):
    // the dedup MUST return before the precondition check and not raise.
    await setStatus("resolved");
    const opId = `conc:reopen:dedup:${ids.risk}:${Date.now()}`;
    const first = await reopenInput(opId);
    expect(first.ok && first.deduped === false).toBe(true);
    expect(await currentStatus()).toBe("open");
    // Retry the SAME opId. The state is now 'open' (≠ expected 'resolved'), but
    // the dedup fast-path returns deduped BEFORE the precondition — success, and
    // the state stays 'open' (not wrongly left as 'resolved').
    const retry = await reopenInput(opId);
    expect(retry.ok).toBe(true);
    expect(retry.deduped).toBe(true);
    expect(await currentStatus()).toBe("open"); // unchanged — no wrong state
  }, 120_000);
});