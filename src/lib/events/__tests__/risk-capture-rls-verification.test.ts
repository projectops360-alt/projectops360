// ============================================================================
// P2-T2 remediation — real cross-tenant RLS verification (BLOCKER 5)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Creates TWO throwaway tenants (org + user + project + risk + events) and
// proves, with REAL authenticated sessions (no mocks), that the PEG is isolated:
//   1. User A can read the visible events of its own organization;
//   2. User B cannot read User A's project_event_log rows;
//   3. User B cannot read User A's project_event_objects rows;
//   4. User A and User B cannot execute the service_role-reserved capture RPCs;
//   5. User B cannot INSERT a project_event_log row for A's project;
//   6. anon cannot read events nor execute the RPCs;
//   7. service_role can run the authorized pipeline.
// Cleans up users (auth.admin.deleteUser), orgs (cascade deletes projects,
// risks, events, refs).
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (guard in
// beforeAll). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-rls-verification.test.ts
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvTest(): void {
  const p = resolve(process.cwd(), ".env.test");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const RUN = process.env.RISK_CAPTURE_VERIFY === "1";
const STAMP = `${Date.now()}`;

describe.runIf(RUN)("P2-T2 BLOCKER 5 — cross-tenant RLS verification (local DB, real sessions)", () => {
  let url!: string;
  let anonKey: string | undefined;
  let serviceKey!: string;
  let admin!: SupabaseClient;
  let anon!: SupabaseClient;

  // Tenant A
  let clientA!: SupabaseClient;
  const a = { userId: "", orgId: "", projectId: "", riskId: "", registeredEventId: "" };
  // Tenant B
  let clientB!: SupabaseClient;
  const b = { userId: "", orgId: "", projectId: "" };

  beforeAll(async () => {
    loadEnvTest();
    url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`P2-T2 RLS test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
    }
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");

    admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    anon = createClient(url, anonKey ?? "anon-key-missing", { auth: { persistSession: false } });

    // ── Tenant A: org + user + project + risk + risk_registered event ──────────
    const { data: orgA, error: orgAErr } = await admin.from("organizations").insert({
      name_i18n: { en: `RLS-A-${STAMP}`, es: `RLS-A-${STAMP}` },
      slug: `rls-a-${STAMP}`,
    }).select("id").single();
    if (orgAErr || !orgA) throw new Error(`orgA insert failed: ${orgAErr?.message ?? ""}`);
    a.orgId = orgA.id;

    const emailA = `rls-a-${STAMP}@example.test`;
    const { data: userA } = await admin.auth.admin.createUser({ email: emailA, password: "Rls-test-A-123!", email_confirm: true });
    a.userId = userA?.user?.id ?? "";
    await admin.from("organization_members").insert({
      organization_id: a.orgId, user_id: a.userId, role: "member", org_role: "member", status: "active",
    });

    const { data: projA, error: projAErr } = await admin.from("projects").insert({
      organization_id: a.orgId,
      slug: `rls-a-proj-${STAMP}`,
      title_i18n: { en: `RLS A proj ${STAMP}`, es: `RLS A proj ${STAMP}` },
      status: "active",
    }).select("id").single();
    if (projAErr || !projA) throw new Error(`projA insert failed: ${projAErr?.message ?? ""}`);
    a.projectId = projA.id;

    // Enable the pilot flag for tenant A's project, in-process.
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = a.projectId;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = a.projectId;

    // Register a risk ATOMICALLY via the real helper (service_role admin client).
    const { captureRiskRegisteredAtomic } = await import("@/lib/events/risk-events");
    const reg = await captureRiskRegisteredAtomic({
      riskFields: {
        organization_id: a.orgId, project_id: a.projectId,
        title: `RLS A risk ${STAMP}`, category: "technical",
        probability: "medium", impact: "high", severity: "high",
        status: "open", origin: "manual",
      },
      actor: { actorType: "human", actorId: a.userId },
      captureMethod: "direct", origin: "manual", sourceModule: "risks",
      title: `RLS A risk ${STAMP}`,
      evidenceRef: { type: "project", id: a.projectId },
      operationId: `rls-a:${a.projectId}:${STAMP}`,
    });
    expect(reg.ok, `A register failed: ${reg.error ?? ""} ${reg.errors ?? ""}`).toBe(true);
    a.riskId = reg.riskId!;
    a.registeredEventId = reg.eventId!;

    // ── Tenant B: org + user + project (no access to A) ────────────────────────
    const { data: orgB, error: orgBErr } = await admin.from("organizations").insert({
      name_i18n: { en: `RLS-B-${STAMP}`, es: `RLS-B-${STAMP}` },
      slug: `rls-b-${STAMP}`,
    }).select("id").single();
    if (orgBErr || !orgB) throw new Error(`orgB insert failed: ${orgBErr?.message ?? ""}`);
    b.orgId = orgB.id;

    const emailB = `rls-b-${STAMP}@example.test`;
    const { data: userB } = await admin.auth.admin.createUser({ email: emailB, password: "Rls-test-B-123!", email_confirm: true });
    b.userId = userB?.user?.id ?? "";
    await admin.from("organization_members").insert({
      organization_id: b.orgId, user_id: b.userId, role: "member", org_role: "member", status: "active",
    });

    const { data: projB, error: projBErr } = await admin.from("projects").insert({
      organization_id: b.orgId,
      slug: `rls-b-proj-${STAMP}`,
      title_i18n: { en: `RLS B proj ${STAMP}`, es: `RLS B proj ${STAMP}` },
      status: "active",
    }).select("id").single();
    if (projBErr || !projB) throw new Error(`projB insert failed: ${projBErr?.message ?? ""}`);
    b.projectId = projB.id;

    // Authenticated clients (real sessions).
    clientA = createClient(url, anonKey ?? "", { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password: "Rls-test-A-123!" });
    clientB = createClient(url, anonKey ?? "", { auth: { persistSession: false } });
    await clientB.auth.signInWithPassword({ email: emailB, password: "Rls-test-B-123!" });
  }, 120_000);

  afterAll(async () => {
    // Users first (FK), then orgs (cascade projects/risks/events/refs/counters).
    for (const uid of [a.userId, b.userId]) {
      if (uid) { try { await admin.auth.admin.deleteUser(uid); } catch { /* ignore */ } }
    }
    for (const oid of [a.orgId, b.orgId]) {
      if (oid) {
        try { await admin.from("project_event_counters").delete().eq("project_id", a.projectId); } catch { /* ignore */ }
        try { await admin.from("organizations").delete().eq("id", oid); } catch { /* ignore */ }
      }
    }
  }, 120_000);

  it("1. User A CAN read the visible events of its own organization", async () => {
    const { data, error } = await clientA.from("project_event_log")
      .select("event_id, event_type").eq("project_id", a.projectId);
    expect(error, `A should read its events: ${error?.message ?? ""}`).toBeNull();
    expect((data ?? []).some((r: { event_id: string }) => r.event_id === a.registeredEventId)).toBe(true);
  });

  it("2. User B CANNOT read User A's project_event_log rows", async () => {
    const { data, error } = await clientB.from("project_event_log")
      .select("event_id").eq("project_id", a.projectId);
    // RLS filters to B's own org → zero rows from A; no error, just empty.
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
    // Direct probe: a targeted select by A's event_id must also be empty for B.
    const { data: probe } = await clientB.from("project_event_log")
      .select("event_id").eq("event_id", a.registeredEventId);
    expect((probe ?? []).length).toBe(0);
  });

  it("3. User B CANNOT read User A's project_event_objects rows", async () => {
    const { data, error } = await clientB.from("project_event_objects")
      .select("event_id, object_id").eq("object_id", a.riskId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("4. User A and User B CANNOT execute the service_role-reserved capture RPCs", async () => {
    for (const [name, client] of [["A", clientA], ["B", clientB]] as const) {
      const { error: e1 } = await client.rpc("capture_risk_registered", {
        p_risk: { id: "00000000-0000-0000-0000-000000000001", organization_id: "00000000-0000-0000-0000-000000000001", project_id: "00000000-0000-0000-0000-000000000001", title: "x" },
        p_event: { organization_id: "00000000-0000-0000-0000-000000000001", project_id: "00000000-0000-0000-0000-000000000001", event_type: "risk_registered", event_category: "risk", event_importance: "HIGH", event_lifecycle_class: "BUSINESS_EVENT", subject_type: "risk", subject_id: "00000000-0000-0000-0000-000000000001", actor_type: "human", occurred_at: new Date().toISOString(), source_module: "t", dedup_key: "x" },
        p_payload_text: "{}",
        p_refs: [{ object_type: "risk", object_id: "00000000-0000-0000-0000-000000000001", role: "focal" }, { object_type: "project", object_id: "00000000-0000-0000-0000-000000000001", role: "context" }],
      } as never);
      expect(e1, `${name} must not call capture_risk_registered`).not.toBeNull();
    }
  });

  it("5. User B CANNOT insert a project_event_log row for A's project", async () => {
    const { error, data } = await clientB.from("project_event_log").insert({
      organization_id: a.orgId, project_id: a.projectId, case_id: a.projectId,
      sequence_number: 9999, event_category: "risk", event_type: "risk_assessed",
      event_importance: "HIGH", event_lifecycle_class: "BUSINESS_EVENT",
      subject_type: "risk", subject_id: a.riskId, actor_type: "human",
      occurred_at: new Date().toISOString(), source_module: "rls-test",
      visibility: "normal",
    }).select("event_id");
    // RLS denies the INSERT (no member-write policy on project_event_log).
    expect(error, `B must not insert into A's event log: ${error?.message ?? ""}`).not.toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("6. anon CANNOT read events nor execute the RPCs", async () => {
    const { data, error } = await anon.from("project_event_log")
      .select("event_id").eq("project_id", a.projectId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0); // anon is not an org member → empty
    const { error: rpcErr } = await anon.rpc("capture_risk_registered", {
      p_risk: { id: "00000000-0000-0000-0000-000000000001" },
      p_event: { event_type: "risk_registered" }, p_payload_text: "{}", p_refs: [],
    } as never);
    expect(rpcErr).not.toBeNull();
  });

  it("7. service_role CAN run the authorized pipeline (assess on A's risk)", async () => {
    const { captureRiskEventAtomic, buildRiskAssessed } = await import("@/lib/events/risk-events");
    const res = await captureRiskEventAtomic({
      operationId: `rls-test:assess:${a.riskId}:${STAMP}`,
      input: buildRiskAssessed({
        risk: { riskId: a.riskId, organizationId: a.orgId, projectId: a.projectId },
        actor: { actorType: "human", actorId: a.userId },
        sourceModule: "rls-test",
        method: "qualitative",
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(),
      }),
    });
    expect(res.ok, `service_role assess failed: ${res.error ?? ""}`).toBe(true);
  });
});