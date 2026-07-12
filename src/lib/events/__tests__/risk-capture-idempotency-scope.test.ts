// ============================================================================
// P2-T2 round-4 — BLOCKER 2: idempotency scope includes the Risk (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves, against the REAL local database, that a reused commandId is scoped by
// the Risk (the dedup identity is projectId + eventType + riskId + commandId,
// enforced via the RPC scope check — the dedup_key intentionally does NOT embed
// the riskId, so a reuse is DETECTED in the dedup hit):
//   1. same commandId + same Risk → dedup (no duplicate event);
//   2. same commandId + ANOTHER Risk of the same project → idempotency_scope_conflict
//      (no false success, no second event);
//   3. same commandId + another project → INDEPENDENT (no collision by project);
//   4. the eventId returned on a dedup hit belongs to the expected subject.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-idempotency-scope.test.ts
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

describe.runIf(RUN)("P2-T2 round-4 BLOCKER 2 — idempotency scope includes the Risk (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  let builders: any;
  const ids = { orgA: "", projA: "", riskA: "", riskB: "", orgB: "", projB: "", riskC: "", owner: "" };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`P2-T2 B2 test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");
    const admin = await import("@/lib/supabase/admin");
    supabase = admin.createAdminClient();
    atomic = await import("@/lib/events/risk-events");
    builders = await import("@/lib/events/risk-events");

    const { data: anyProject } = await supabase
      .from("projects").select("organization_id, created_by").is("deleted_at", null).limit(1).single();
    ids.orgA = anyProject.organization_id;
    ids.owner = anyProject.created_by ?? "00000000-0000-0000-0000-000000000001";

    const { data: projA } = await supabase.from("projects").insert({
      organization_id: ids.orgA, slug: `p2t2-b2-a-${Date.now()}`,
      title_i18n: { en: "B2 A", es: "B2 A" }, status: "active",
    }).select("id").single();
    ids.projA = projA.id;

    const { data: orgB } = await supabase.from("organizations").insert({
      name_i18n: { en: `B2-B-${Date.now()}`, es: `B2-B-${Date.now()}` }, slug: `b2-b-${Date.now()}`,
    }).select("id").single();
    ids.orgB = orgB.id;
    const { data: projB } = await supabase.from("projects").insert({
      organization_id: ids.orgB, slug: `p2t2-b2-b-${Date.now()}`,
      title_i18n: { en: "B2 B", es: "B2 B" }, status: "active",
    }).select("id").single();
    ids.projB = projB.id;

    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = `${ids.projA},${ids.projB}`;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = `${ids.projA},${ids.projB}`;

    const regA = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.orgA, project_id: ids.projA, title: "B2 risk A", category: "technical",
        probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "b2-test", title: "B2 risk A", evidenceRef: { type: "project", id: ids.projA },
      operationId: `b2:register:A`,
    });
    expect(regA.ok).toBe(true);
    ids.riskA = regA.riskId;

    const regB = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.orgA, project_id: ids.projA, title: "B2 risk B", category: "technical",
        probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "b2-test", title: "B2 risk B", evidenceRef: { type: "project", id: ids.projA },
      operationId: `b2:register:B`,
    });
    expect(regB.ok).toBe(true);
    ids.riskB = regB.riskId;

    const regC = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.orgB, project_id: ids.projB, title: "B2 risk C", category: "technical",
        probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "b2-test", title: "B2 risk C", evidenceRef: { type: "project", id: ids.projB },
      operationId: `b2:register:C`,
    });
    expect(regC.ok).toBe(true);
    ids.riskC = regC.riskId;
  }, 120_000);

  afterAll(async () => {
    for (const pid of [ids.projA, ids.projB]) {
      if (pid) {
        await supabase.from("project_event_counters").delete().eq("project_id", pid);
        await supabase.from("projects").delete().eq("id", pid);
      }
    }
    if (ids.orgB) await supabase.from("organizations").delete().eq("id", ids.orgB);
  }, 120_000);

  function assessArgs(orgId: string, projId: string, riskId: string) {
    return {
      operationId: "b2:assess:cmd-1",
      input: builders.buildRiskAssessed({
        risk: { riskId, organizationId: orgId, projectId: projId },
        actor: { actorType: "human", actorId: ids.owner },
        sourceModule: "b2-test", method: "qualitative",
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(),
      }),
    };
  }

  async function assessedCount(riskId: string): Promise<number> {
    const { count } = await supabase.from("project_event_log")
      .select("event_id", { count: "exact", head: true })
      .eq("subject_id", riskId).eq("event_type", "risk_assessed");
    return count ?? 0;
  }

  it("1. same commandId + same Risk → dedup (no duplicate event)", async () => {
    const first = await atomic.captureRiskEventAtomic(assessArgs(ids.orgA, ids.projA, ids.riskA));
    expect(first.ok).toBe(true);
    expect(first.deduped).toBe(false);
    const before = await assessedCount(ids.riskA);
    const retry = await atomic.captureRiskEventAtomic(assessArgs(ids.orgA, ids.projA, ids.riskA));
    expect(retry.ok).toBe(true);
    expect(retry.deduped).toBe(true);
    expect(retry.eventId).toBe(first.eventId);
    expect(await assessedCount(ids.riskA)).toBe(before); // no new event
  });

  it("2. same commandId + ANOTHER Risk of the same project → idempotency_scope_conflict", async () => {
    const beforeB = await assessedCount(ids.riskB);
    const beforeA = await assessedCount(ids.riskA);
    const res = await atomic.captureRiskEventAtomic(assessArgs(ids.orgA, ids.projA, ids.riskB));
    expect(res.ok).toBe(false);
    expect(String(res.error ?? "")).toContain("idempotency_scope_conflict");
    // No false success, no new event on either risk.
    expect(await assessedCount(ids.riskB)).toBe(beforeB);
    expect(await assessedCount(ids.riskA)).toBe(beforeA);
  });

  it("3. same commandId + another project → INDEPENDENT (no collision by project)", async () => {
    const res = await atomic.captureRiskEventAtomic(assessArgs(ids.orgB, ids.projB, ids.riskC));
    expect(res.ok).toBe(true);
    expect(res.deduped).toBe(false); // a new event on riskC (cmd-1 is independent across projects)
  });

  it("4. the eventId returned on a dedup hit belongs to the expected subject", async () => {
    // Dedup riskA with cmd-1 again; the returned eventId must be riskA's event,
    // whose subject_id is riskA (not riskB, not the attempt id).
    const retry = await atomic.captureRiskEventAtomic(assessArgs(ids.orgA, ids.projA, ids.riskA));
    expect(retry.ok).toBe(true);
    expect(retry.deduped).toBe(true);
    const { data: row } = await supabase.from("project_event_log")
      .select("subject_id").eq("event_id", retry.eventId).single();
    expect((row as { subject_id?: string } | null)?.subject_id).toBe(ids.riskA);
  });
});