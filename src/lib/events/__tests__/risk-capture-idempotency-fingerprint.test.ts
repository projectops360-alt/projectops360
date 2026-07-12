// ============================================================================
// P2-T2 round-4 — BLOCKER 3: request fingerprint + idempotency_payload_conflict (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves, against the REAL local database, that a reused idempotency key with a
// DIFFERENT request is never silently accepted — the RPC compares the stored
// provenance.idempotency_fingerprint against the request's and raises
// idempotency_payload_conflict on a mismatch:
//   1. same commandId + same request → dedup;
//   2. same commandId + different assessment method → conflict;
//   3. same commandId + different materialization scope → conflict;
//   4. same commandId + different reopen reasonCode → conflict;
//   5. same Scribe item identity (captureOperationId:item:index) + different
//      logical Risk content → conflict;
//   6. a conflict NEVER writes an event nor mutates the risk.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-idempotency-fingerprint.test.ts
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvTest(): void {
  const p = resolve(process.cwd(), ".env.test");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const RUN = process.env.RISK_CAPTURE_VERIFY === "1";

describe.runIf(RUN)("P2-T2 round-4 BLOCKER 3 — request fingerprint + payload_conflict (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  let builders: any;
  const ids = { org: "", project: "", risk: "", owner: "" };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`P2-T2 B3 test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
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
      organization_id: ids.org, slug: `p2t2-b3-${Date.now()}`,
      title_i18n: { en: "B3 fingerprint (temp)", es: "B3 fingerprint (temp)" }, status: "active",
    }).select("id").single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = ids.project;

    const reg = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.org, project_id: ids.project, title: "B3 risk", category: "technical",
        probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "b3-test", title: "B3 risk", evidenceRef: { type: "project", id: ids.project },
      operationId: `b3:register:${ids.project}`,
    });
    expect(reg.ok).toBe(true);
    ids.risk = reg.riskId;
  }, 120_000);

  afterAll(async () => {
    if (ids.project) {
      await supabase.from("project_event_counters").delete().eq("project_id", ids.project);
      await supabase.from("projects").delete().eq("id", ids.project);
    }
  }, 120_000);

  function assess(method: string, opId: string) {
    return atomic.captureRiskEventAtomic({
      operationId: opId,
      input: builders.buildRiskAssessed({
        risk: { riskId: ids.risk, organizationId: ids.org, projectId: ids.project },
        actor: { actorType: "human", actorId: ids.owner },
        sourceModule: "b3-test", method,
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(),
      }),
    });
  }
  function materialize(scope: string, opId: string) {
    return atomic.captureRiskEventAtomic({
      operationId: opId,
      input: builders.buildRiskMaterialized({
        risk: { riskId: ids.risk, organizationId: ids.org, projectId: ids.project },
        actor: { actorType: "human", actorId: ids.owner },
        sourceModule: "b3-test", materializationScope: scope as "total" | "partial", impactNote: null,
      }),
    });
  }
  function reopen(reason: string, opId: string) {
    return atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project, operationId: opId,
      input: builders.buildRiskReopened({
        risk: { riskId: ids.risk, organizationId: ids.org, projectId: ids.project },
        actor: { actorType: "human", actorId: ids.owner },
        sourceModule: "b3-test", reasonCode: reason,
        priorClosureEventId: null, fromState: "resolved", toState: "open",
      }),
    });
  }

  async function typeCount(eventType: string): Promise<number> {
    const { count } = await supabase.from("project_event_log")
      .select("event_id", { count: "exact", head: true })
      .eq("project_id", ids.project).eq("event_type", eventType);
    return count ?? 0;
  }
  async function setStatus(status: string) {
    const { error } = await supabase.from("risks")
      .update({ status }).eq("id", ids.risk).eq("project_id", ids.project).eq("organization_id", ids.org);
    expect(error).toBeNull();
  }

  it("1. same commandId + same request → dedup", async () => {
    const first = await assess("qualitative", "b3:assess:same");
    expect(first.ok && first.deduped === false).toBe(true);
    const retry = await assess("qualitative", "b3:assess:same");
    expect(retry.ok).toBe(true);
    expect(retry.deduped).toBe(true);
    expect(retry.eventId).toBe(first.eventId);
  });

  it("2. same commandId + different assessment method → idempotency_payload_conflict", async () => {
    const before = await typeCount("risk_assessed");
    const res = await assess("quantitative", "b3:assess:same"); // same opId, different method
    expect(res.ok).toBe(false);
    expect(String(res.error ?? "")).toContain("idempotency_payload_conflict");
    expect(await typeCount("risk_assessed")).toBe(before); // no new event
  });

  it("3. same commandId + different materialization scope → conflict", async () => {
    const first = await materialize("total", "b3:mat:same");
    expect(first.ok && first.deduped === false).toBe(true);
    const before = await typeCount("risk_materialized");
    const res = await materialize("partial", "b3:mat:same"); // same opId, different scope
    expect(res.ok).toBe(false);
    expect(String(res.error ?? "")).toContain("idempotency_payload_conflict");
    expect(await typeCount("risk_materialized")).toBe(before);
  });

  it("4. same commandId + different reopen reasonCode → conflict", async () => {
    await setStatus("resolved");
    const first = await reopen("risk_resurfaced", "b3:reopen:same");
    expect(first.ok && first.deduped === false).toBe(true);
    const before = await typeCount("risk_reopened");
    // Re-resolve so the precondition would otherwise allow a transition, then
    // retry with a DIFFERENT reasonCode → fingerprint mismatch → conflict (no
    // new event, no mutation).
    await setStatus("resolved");
    const res = await reopen("new_information", "b3:reopen:same");
    expect(res.ok).toBe(false);
    expect(String(res.error ?? "")).toContain("idempotency_payload_conflict");
    expect(await typeCount("risk_reopened")).toBe(before);
  });

  it("5. same Scribe item identity + different logical Risk content → conflict", async () => {
    const opId = "b3:scribe:item:0";
    const first = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.org, project_id: ids.project, title: "Risk X", category: "other",
        probability: "medium", impact: "medium", severity: "medium", status: "open", origin: "ai_suggested" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "ai_suggested",
      sourceModule: "scribe", title: "Risk X", evidenceRef: { type: "project_memory_item", id: "mem-b3" },
      operationId: opId,
    });
    expect(first.ok && first.deduped === false).toBe(true);
    const before = await typeCount("risk_registered");
    const { count: riskBefore } = await supabase.from("risks").select("id", { count: "exact", head: true })
      .eq("project_id", ids.project).eq("title", "Risk Y");
    // Same captureOperationId:item:index, DIFFERENT logical Risk (title + category).
    const res = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.org, project_id: ids.project, title: "Risk Y", category: "technical",
        probability: "medium", impact: "medium", severity: "medium", status: "open", origin: "ai_suggested" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "ai_suggested",
      sourceModule: "scribe", title: "Risk Y", evidenceRef: { type: "project_memory_item", id: "mem-b3" },
      operationId: opId,
    });
    expect(res.ok).toBe(false);
    expect(String(res.error ?? "")).toContain("idempotency_payload_conflict");
    expect(await typeCount("risk_registered")).toBe(before); // no new event
    // No new "Risk Y" row was created (the orphan Risk from the conflict tx is
    // rolled back by the raising RPC).
    const { count: riskAfter } = await supabase.from("risks").select("id", { count: "exact", head: true })
      .eq("project_id", ids.project).eq("title", "Risk Y");
    expect(riskAfter).toBe(riskBefore ?? 0);
  });

  it("6. a conflict NEVER mutates the risk (status unchanged)", async () => {
    await setStatus("resolved");
    const before = await typeCount("risk_reopened");
    // Different reasonCode → conflict; the risk must stay 'resolved' (no reopen).
    const res = await reopen("new_information", "b3:reopen:other");
    // First use of "b3:reopen:other" — to force a fingerprint conflict we need an
    // existing event under the SAME opId first. Register one, then conflict.
    if (res.ok) {
      // No prior event under "b3:reopen:other" → it succeeded; now retry with a
      // different reasonCode to trigger the conflict.
      await setStatus("resolved");
      const conflict = await reopen("materialized_after_closure", "b3:reopen:other");
      expect(conflict.ok).toBe(false);
      expect(String(conflict.error ?? "")).toContain("idempotency_payload_conflict");
    } else {
      expect(String(res.error ?? "")).toContain("idempotency_payload_conflict");
    }
    expect(await typeCount("risk_reopened")).toBe(before + (res.ok ? 1 : 0));
    // After the conflict, the risk is NOT open (no spurious reopen): it was
    // resolved before the conflict and the conflict does not mutate.
    const { data: row } = await supabase.from("risks").select("status").eq("id", ids.risk).single();
    expect((row as { status?: string } | null)?.status).not.toBe("open");
  });
});