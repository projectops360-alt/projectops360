// ============================================================================
// S3-T4 — Criterion D: Source traceability of the minimal risk events (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves, against the REAL database, that EVERY minimal pilot event carries the
// full traceability contract: identity (org/project), classification (type/
// subject), actor, source, timing, provenance (+ idempotency_fingerprint), and
// the focal-Risk + project-context object_refs — plus evidence or a limitation
// flag where the contract requires one.
//
// Minimal events validated: risk_registered, risk_assessed, risk_materialized,
// risk_reopened.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/event-traceability-fields.test.ts
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
const HEX64 = /^[0-9a-f]{64}$/;

describe.runIf(RUN)("S3-T4 D — traceability fields for minimal risk events (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  let builders: any;
  const ids = { org: "", project: "", risk: "", owner: "" };
  const eventIds: Record<string, string> = {};

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`S3-T4 traceability test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
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
      organization_id: ids.org, slug: `s3t4-trace-${Date.now()}`,
      title_i18n: { en: "S3-T4 traceability (temp)", es: "S3-T4 trazabilidad (temp)" }, status: "active",
    }).select("id").single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = ids.project;

    const human = { actorType: "human" as const, actorId: ids.owner };
    const riskRef = () => ({ riskId: ids.risk, organizationId: ids.org, projectId: ids.project });

    // 1. register — WITH an evidence ref (project memory item).
    const reg = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.org, project_id: ids.project, title: "S3-T4 traceability risk",
        category: "technical", probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: human, captureMethod: "direct", origin: "manual", sourceModule: "s3t4-test",
      title: "S3-T4 traceability risk",
      evidenceRef: { type: "project_memory_item", id: `mem-trace-${ids.project}` },
      operationId: `s3t4:trace:register:${ids.project}`,
    });
    expect(reg.ok, `register failed: ${reg.error ?? ""}`).toBe(true);
    ids.risk = reg.riskId;
    eventIds.risk_registered = reg.eventId;

    // 2. assess
    const assess = await atomic.captureRiskEventAtomic({
      operationId: `s3t4:trace:assess:${ids.risk}`,
      input: builders.buildRiskAssessed({
        risk: riskRef(), actor: human, sourceModule: "s3t4-test", method: "qualitative",
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(),
      }),
    });
    expect(assess.ok, `assess failed: ${assess.error ?? ""}`).toBe(true);
    eventIds.risk_assessed = assess.eventId;

    // 3. materialize
    const mat = await atomic.captureRiskEventAtomic({
      operationId: `s3t4:trace:materialize:${ids.risk}`,
      input: builders.buildRiskMaterialized({
        risk: riskRef(), actor: human, sourceModule: "s3t4-test",
        materializationScope: "partial", impactNote: "Integration slip",
      }),
    });
    expect(mat.ok, `materialize failed: ${mat.error ?? ""}`).toBe(true);
    eventIds.risk_materialized = mat.eventId;

    // 4. resolve (direct UPDATE, no event) → reopen (atomic)
    await supabase.from("risks").update({ status: "resolved" })
      .eq("id", ids.risk).eq("project_id", ids.project).eq("organization_id", ids.org);
    const reopen = await atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project, operationId: `s3t4:trace:reopen:${ids.risk}`,
      input: builders.buildRiskReopened({
        risk: riskRef(), actor: human, sourceModule: "s3t4-test", reasonCode: "risk_resurfaced",
        priorClosureEventId: null, fromState: "resolved", toState: "open",
      }),
    });
    expect(reopen.ok, `reopen failed: ${reopen.error ?? ""}`).toBe(true);
    eventIds.risk_reopened = reopen.eventId;
  }, 180_000);

  afterAll(async () => {
    if (ids.project) {
      await supabase.from("project_event_counters").delete().eq("project_id", ids.project);
      await supabase.from("projects").delete().eq("id", ids.project);
    }
  }, 120_000);

  // Shared field contract every minimal event must satisfy.
  async function assertCommonFields(eventId: string, expectedType: string) {
    const { data: row, error } = await supabase.from("project_event_log")
      .select("organization_id, project_id, event_type, subject_type, subject_id, actor_type, actor_id, "
        + "source_module, source_entity_type, source_entity_id, occurred_at, recorded_at, provenance")
      .eq("event_id", eventId).single();
    expect(error, `event ${expectedType} not found`).toBeNull();
    expect(row.organization_id).toBe(ids.org);
    expect(row.project_id).toBe(ids.project);
    expect(row.event_type).toBe(expectedType);
    expect(row.subject_type).toBe("risk");
    expect(row.subject_id).toBe(ids.risk);
    expect(row.actor_type).toBe("human");
    expect(row.actor_id).toBe(ids.owner);
    expect(row.source_module).toBe("s3t4-test");
    expect(row.source_entity_type).toBe("risks");
    expect(row.source_entity_id).toBe(ids.risk);
    expect(row.occurred_at).toBeTruthy();
    expect(row.recorded_at).toBeTruthy();
    // provenance present with capture_method + an idempotency_fingerprint (hex64).
    const prov = row.provenance as Record<string, unknown>;
    expect(prov).toBeDefined();
    expect(typeof prov.capture_method).toBe("string");
    expect(String(prov.idempotency_fingerprint)).toMatch(HEX64);

    // Object refs: focal Risk + project context both present.
    const { data: refs } = await supabase.from("project_event_objects")
      .select("object_type, object_id, role").eq("event_id", eventId);
    const roles = (refs ?? []) as Array<{ object_type: string; object_id: string; role: string }>;
    expect(roles.some((r) => r.object_type === "risk" && r.object_id === ids.risk && r.role === "focal")).toBe(true);
    expect(roles.some((r) => r.object_type === "project" && r.object_id === ids.project && r.role === "context")).toBe(true);
    return row;
  }

  it("risk_registered carries evidence (evidenceRefs)", async () => {
    const row = await assertCommonFields(eventIds.risk_registered, "risk_registered");
    const prov = row.provenance as { evidenceRefs?: Array<{ type: string; id: string }> };
    expect(prov.evidenceRefs?.length).toBeGreaterThanOrEqual(1);
    expect(prov.evidenceRefs?.[0]?.type).toBe("project_memory_item");
  }, 60_000);

  it("risk_assessed satisfies the full traceability contract", async () => {
    await assertCommonFields(eventIds.risk_assessed, "risk_assessed");
    // assess carries no evidence/limitation flag by design (a normal assessment);
    // "cuando corresponda" → not required here. Provenance is still present.
  }, 60_000);

  it("risk_materialized carries the RI-06 interim-exception limitation flag", async () => {
    const row = await assertCommonFields(eventIds.risk_materialized, "risk_materialized");
    const prov = row.provenance as { ri06_interim_exception?: boolean };
    expect(prov.ri06_interim_exception).toBe(true); // no Issue/Blocker target entity yet
  }, 60_000);

  it("risk_reopened carries the missing_prior_closure limitation flag", async () => {
    const row = await assertCommonFields(eventIds.risk_reopened, "risk_reopened");
    const prov = row.provenance as { data_quality_flags?: string[] };
    expect(prov.data_quality_flags).toContain("missing_prior_closure");
  }, 60_000);
});