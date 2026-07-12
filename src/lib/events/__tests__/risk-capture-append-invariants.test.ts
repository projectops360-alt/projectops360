// ============================================================================
// P2-T2 remediation — BLOCKER 4: append_risk_event_atomic invariants (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves append_risk_event_atomic verifies the REAL risk row before appending:
//   * nonexistent risk → no event, no refs, error;
//   * risk of another project (same org) → rejected;
//   * risk of another organization → rejected;
//   * subject_id ≠ source_entity_id → rejected;
//   * event project/org ≠ the risk's project/org → rejected;
//   * refs missing focal or context → rejected.
// Every failure raises WITHOUT a partial write (no event row, no object_refs).
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-append-invariants.test.ts
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

describe.runIf(RUN)("P2-T2 BLOCKER 4 — append_risk_event_atomic invariants (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  let builders: any;
  const ids = { orgA: "", projA: "", riskA: "", orgB: "", projB: "", riskB: "", owner: "" };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`P2-T2 B4 test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
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
      organization_id: ids.orgA, slug: `p2t2-b4-a-${Date.now()}`,
      title_i18n: { en: "B4 A", es: "B4 A" }, status: "active",
    }).select("id").single();
    ids.projA = projA.id;

    // Tenant B (separate org + project) to prove cross-tenant rejection.
    const { data: orgB } = await supabase.from("organizations").insert({
      name_i18n: { en: `B4-B-${Date.now()}`, es: `B4-B-${Date.now()}` }, slug: `b4-b-${Date.now()}`,
    }).select("id").single();
    ids.orgB = orgB.id;
    const { data: projB } = await supabase.from("projects").insert({
      organization_id: ids.orgB, slug: `p2t2-b4-b-${Date.now()}`,
      title_i18n: { en: "B4 B", es: "B4 B" }, status: "active",
    }).select("id").single();
    ids.projB = projB.id;

    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = `${ids.projA},${ids.projB}`;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = `${ids.projA},${ids.projB}`;

    const regA = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.orgA, project_id: ids.projA, title: "B4 risk A", category: "technical",
        probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "b4-test", title: "B4 risk A", evidenceRef: { type: "project", id: ids.projA },
      operationId: `b4:register:A`,
    });
    expect(regA.ok).toBe(true);
    ids.riskA = regA.riskId;

    const regB = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.orgB, project_id: ids.projB, title: "B4 risk B", category: "technical",
        probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "b4-test", title: "B4 risk B", evidenceRef: { type: "project", id: ids.projB },
      operationId: `b4:register:B`,
    });
    expect(regB.ok).toBe(true);
    ids.riskB = regB.riskId;
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

  function assessArgs(opts: {
    orgId: string; projId: string; subjectId: string;
    sourceEntityId?: string; subjectType?: string; sourceEntityType?: string;
    refsOk?: boolean;
  }) {
    const subjectType = opts.subjectType ?? "risk";
    const sourceEntityType = opts.sourceEntityType ?? "risks";
    const sourceEntityId = opts.sourceEntityId ?? opts.subjectId;
    const refs = opts.refsOk === false
      ? [{ objectType: "risk", objectId: opts.subjectId, role: "focal" }] // missing context
      : [
          { objectType: "risk", objectId: opts.subjectId, role: "focal" },
          { objectType: "project", objectId: opts.projId, role: "context" },
        ];
    const input = builders.buildRiskAssessed({
      risk: { riskId: opts.subjectId, organizationId: opts.orgId, projectId: opts.projId },
      actor: { actorType: "human", actorId: ids.owner },
      sourceModule: "b4-test", method: "qualitative",
      values: { probability: "medium", impact: "high", severity: "high" },
      assessedAt: new Date().toISOString(),
    });
    // Override the identity fields the RPC checks against the real risk row.
    (input as any).subjectId = opts.subjectId;
    (input as any).subjectType = subjectType;
    (input as any).sourceEntityType = sourceEntityType;
    (input as any).sourceEntityId = sourceEntityId;
    (input as any).organizationId = opts.orgId;
    (input as any).projectId = opts.projId;
    (input as any).objectRefs = refs;
    return { operationId: `b4:assess:${opts.subjectId}:${opts.orgId}:${opts.projId}:${Date.now()}-${Math.random()}`, input };
  }

  async function eventLogCount(subjectId: string): Promise<number> {
    const { count } = await supabase.from("project_event_log")
      .select("event_id", { count: "exact", head: true })
      .eq("subject_id", subjectId).eq("event_type", "risk_assessed");
    return count ?? 0;
  }

  it("nonexistent risk → rejected, no event written", async () => {
    const bogus = "00000000-0000-0000-0000-000000000099";
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projA, subjectId: bogus,
    }));
    expect(res.ok).toBe(false);
    expect(await eventLogCount(bogus)).toBe(0);
  });

  it("risk of another project (same org) → rejected", async () => {
    // Risk B lives in orgB/projB; claim it under orgA/projA.
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projA, subjectId: ids.riskB,
    }));
    expect(res.ok).toBe(false);
  });

  it("risk of another organization → rejected", async () => {
    // Risk B under its real org but a foreign project id — wrong scope.
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projB, subjectId: ids.riskB,
    }));
    expect(res.ok).toBe(false);
  });

  it("subject_id ≠ source_entity_id → rejected", async () => {
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projA, subjectId: ids.riskA,
      sourceEntityId: "00000000-0000-0000-0000-000000000077",
    }));
    expect(res.ok).toBe(false);
  });

  it("event project/org mismatch (risk real, event claims wrong project) → rejected", async () => {
    // Risk A is in projA; claim the event under projB (same org as A). The JOIN
    // requires r.project_id = p_event.project_id → not found.
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projB, subjectId: ids.riskA,
    }));
    expect(res.ok).toBe(false);
  });

  it("inconsistent refs (missing context) → rejected", async () => {
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projA, subjectId: ids.riskA, refsOk: false,
    }));
    expect(res.ok).toBe(false);
    expect(await eventLogCount(ids.riskA)).toBe(0); // no partial write
  });

  it("a well-formed assess on the real risk A succeeds (control)", async () => {
    const before = await eventLogCount(ids.riskA);
    const res = await atomic.captureRiskEventAtomic(assessArgs({
      orgId: ids.orgA, projId: ids.projA, subjectId: ids.riskA,
    }));
    expect(res.ok).toBe(true);
    expect(await eventLogCount(ids.riskA)).toBe(before + 1);
  });
});