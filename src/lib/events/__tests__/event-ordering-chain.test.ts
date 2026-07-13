// ============================================================================
// S3-T4 — Criterion B: Ordering & tamper-evident chain (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves, against the REAL database, per project:
//   B1. sequence_number is UNIQUE (uq_pel_project_seq) and strictly monotonic;
//   B2. two CONCURRENT legitimate writes receive DISTINCT sequence numbers;
//   B4. previous_event_hash links each event to its predecessor's event_hash
//       (event[0].previous_event_hash IS NULL; event[i] links to event[i-1]).
// (B3 concurrency-one-event and B5 hash-contract are covered by the existing
//  risk-capture-concurrency.test.ts and risk-atomic-capture.test.ts suites.)
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/event-ordering-chain.test.ts
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

describe.runIf(RUN)("S3-T4 B — ordering & hash chain (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  let builders: any;
  const ids = { org: "", project: "", risk: "", owner: "" };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`S3-T4 ordering test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
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
      organization_id: ids.org, slug: `s3t4-ord-${Date.now()}`,
      title_i18n: { en: "S3-T4 ordering (temp)", es: "S3-T4 orden (temp)" }, status: "active",
    }).select("id").single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = ids.project;

    const reg = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.org, project_id: ids.project, title: "S3-T4 ordering risk",
        category: "technical", probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "s3t4-test", title: "S3-T4 ordering risk",
      evidenceRef: { type: "project", id: ids.project }, operationId: `s3t4:ord:register:${ids.project}`,
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

  const riskRef = () => ({ riskId: ids.risk, organizationId: ids.org, projectId: ids.project });
  const human = { actorType: "human" as const, actorId: "" };

  async function orderedLog() {
    const { data } = await supabase.from("project_event_log")
      .select("event_id, sequence_number, event_type, event_hash, previous_event_hash")
      .eq("project_id", ids.project).order("sequence_number", { ascending: true });
    return (data ?? []) as Array<{
      event_id: string; sequence_number: number; event_type: string;
      event_hash: string | null; previous_event_hash: string | null;
    }>;
  }

  it("B1+B4. a sequential register→assess→materialize→reopen yields unique, monotonic sequences and a linked hash chain", async () => {
    human.actorId = ids.owner;
    // assess (sequential, awaited — each reads the true last event for prev hash)
    const assess = await atomic.captureRiskEventAtomic({
      operationId: `s3t4:ord:assess:${ids.risk}`,
      input: builders.buildRiskAssessed({
        risk: riskRef(), actor: human, sourceModule: "s3t4-test", method: "qualitative",
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(),
      }),
    });
    expect(assess.ok, `assess failed: ${assess.error ?? ""}`).toBe(true);

    // materialize
    const mat = await atomic.captureRiskEventAtomic({
      operationId: `s3t4:ord:materialize:${ids.risk}`,
      input: builders.buildRiskMaterialized({
        risk: riskRef(), actor: human, sourceModule: "s3t4-test",
        materializationScope: "partial", impactNote: "Integration slip",
      }),
    });
    expect(mat.ok, `materialize failed: ${mat.error ?? ""}`).toBe(true);

    // resolve (direct UPDATE, no event) then reopen (atomic UPDATE + event)
    await supabase.from("risks").update({ status: "resolved" })
      .eq("id", ids.risk).eq("project_id", ids.project).eq("organization_id", ids.org);
    const reopen = await atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project, operationId: `s3t4:ord:reopen:${ids.risk}`,
      input: builders.buildRiskReopened({
        risk: riskRef(), actor: human, sourceModule: "s3t4-test", reasonCode: "risk_resurfaced",
        priorClosureEventId: null, fromState: "resolved", toState: "open",
      }),
    });
    expect(reopen.ok, `reopen failed: ${reopen.error ?? ""}`).toBe(true);

    const log = await orderedLog();
    expect(log.length).toBeGreaterThanOrEqual(4); // register + assess + materialize + reopen

    // B1 — sequence_number unique + strictly monotonic.
    const seqs = log.map((r) => r.sequence_number);
    expect(new Set(seqs).size).toBe(seqs.length);               // unique
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);             // monotonic
    }

    // B4 — tamper-evident chain: genesis prev is NULL; each event links to the
    // previous event's event_hash.
    expect(log[0].previous_event_hash).toBeNull();
    for (let i = 1; i < log.length; i++) {
      expect(log[i].previous_event_hash, `event #${i} must link to predecessor's hash`).toBe(log[i - 1].event_hash);
    }
    // Every event has a non-empty event_hash (the chain payload).
    for (const r of log) expect(r.event_hash).toBeTruthy();
  }, 120_000);

  it("B2. two CONCURRENT legitimate appends receive DISTINCT sequence numbers (no seq collision)", async () => {
    // Two DIFFERENT assess operations (different operationIds) on the same risk,
    // fired concurrently. Both are pure appends (no state precondition) → both
    // succeed. next_project_event_seq is atomic (upsert RETURNING) → the two
    // sequences MUST differ.
    const opA = `s3t4:ord:conc-a:${Date.now()}`;
    const opB = `s3t4:ord:conc-b:${Date.now()}`;
    const [a, b] = await Promise.all([
      atomic.captureRiskEventAtomic({
        operationId: opA,
        input: builders.buildRiskAssessed({
          risk: riskRef(), actor: human, sourceModule: "s3t4-test", method: "qualitative",
          values: { probability: "low", impact: "medium", severity: "medium" },
          assessedAt: new Date().toISOString(),
        }),
      }),
      atomic.captureRiskEventAtomic({
        operationId: opB,
        input: builders.buildRiskAssessed({
          risk: riskRef(), actor: human, sourceModule: "s3t4-test", method: "qualitative",
          values: { probability: "high", impact: "medium", severity: "high" },
          assessedAt: new Date().toISOString(),
        }),
      }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(a.deduped).toBe(false);
    expect(b.deduped).toBe(false);
    const { data: rowA } = await supabase.from("project_event_log")
      .select("sequence_number").eq("event_id", a.eventId).single();
    const { data: rowB } = await supabase.from("project_event_log")
      .select("sequence_number").eq("event_id", b.eventId).single();
    expect(rowA?.sequence_number).not.toBe(rowB?.sequence_number);
  }, 120_000);
});