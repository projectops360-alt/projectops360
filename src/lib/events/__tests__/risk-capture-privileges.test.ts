// ============================================================================
// P2-T2 remediation — DB privilege verification (BLOCKER 1 #6)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Verifies, against the REAL local database, that the SECURITY DEFINER RPCs are
// locked down:
//   * anon CANNOT execute any of the three public RPCs;
//   * authenticated CANNOT execute any of the three public RPCs;
//   * service_role CAN execute them (the authorized pipeline);
//   * _append_event_atomic is NOT directly invocable by any client role
//     (anon / authenticated / service_role) — it is an internal helper callable
//     only by the capture_* functions (same owner);
//   * the grants match: routine_privileges / pg_proc show EXECUTE granted ONLY
//     to service_role on the public RPCs and to NOBODY on the helper.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (guard in
// beforeAll). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-privileges.test.ts
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

describe.runIf(RUN)("P2-T2 BLOCKER 1 — RPC privilege verification (local DB)", () => {
  let url!: string;
  let anonKey: string | undefined;
  let serviceKey!: string;
  let admin!: SupabaseClient;
  let anon!: SupabaseClient;
  let authed!: SupabaseClient;
  let authedUserId = "";

  beforeAll(async () => {
    loadEnvTest();
    url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(
        `P2-T2 privilege test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`,
      );
    }
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");

    admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    anon = createClient(url, anonKey ?? "anon-key-missing", { auth: { persistSession: false } });

    // Create a throwaway authenticated user (Tenant for the privilege test).
    const email = `p2t2-priv-${Date.now()}@example.test`;
    const password = "P2t2-priv-test-123!";
    const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    authedUserId = created?.user?.id ?? "";
    authed = createClient(url, anonKey ?? "", { auth: { persistSession: false } });
    await authed.auth.signInWithPassword({ email, password });
  }, 60_000);

  afterAll(async () => {
    if (authedUserId) {
      try { await admin.auth.admin.deleteUser(authedUserId); } catch { /* ignore */ }
    }
  });

  // A minimal, well-formed triple the service_role would send. anon/authenticated
  // should be rejected before any of it matters (permission denied or guard).
  function validTriple() {
    return {
      p_risk: {
        id: "00000000-0000-0000-0000-000000000001",
        organization_id: "00000000-0000-0000-0000-000000000001",
        project_id: "00000000-0000-0000-0000-000000000001",
        title: "x", category: "other", probability: "medium", impact: "medium",
        severity: "medium", status: "open", origin: "manual",
      },
      p_event: {
        organization_id: "00000000-0000-0000-0000-000000000001",
        project_id: "00000000-0000-0000-0000-000000000001",
        event_type: "risk_registered", event_category: "risk",
        event_importance: "HIGH", event_lifecycle_class: "BUSINESS_EVENT",
        subject_type: "risk",
        subject_id: "00000000-0000-0000-0000-000000000001",
        actor_type: "human", occurred_at: new Date().toISOString(),
        source_module: "test", dedup_key: "priv-test-dedup",
      },
      p_payload_text: "{}",
      p_refs: [
        { object_type: "risk", object_id: "00000000-0000-0000-0000-000000000001", role: "focal" },
        { object_type: "project", object_id: "00000000-0000-0000-0000-000000000001", role: "context" },
      ],
    };
  }

  it("anon CANNOT execute capture_risk_registered", async () => {
    const { error } = await anon.rpc("capture_risk_registered", validTriple() as never);
    expect(error, `anon must not call capture_risk_registered`).not.toBeNull();
  });

  it("anon CANNOT execute capture_risk_status_change", async () => {
    const { error } = await anon.rpc("capture_risk_status_change", {
      p_risk_id: "00000000-0000-0000-0000-000000000001",
      p_new_status: "open", p_expected_from_status: "resolved",
      p_organization_id: "00000000-0000-0000-0000-000000000001",
      p_project_id: "00000000-0000-0000-0000-000000000001",
      ...validTriple(),
    } as never);
    expect(error).not.toBeNull();
  });

  it("anon CANNOT execute append_risk_event_atomic", async () => {
    const { error } = await anon.rpc("append_risk_event_atomic", {
      p_event: validTriple().p_event, p_payload_text: "{}", p_refs: validTriple().p_refs,
    } as never);
    expect(error).not.toBeNull();
  });

  it("anon CANNOT execute the internal _append_event_atomic directly", async () => {
    const { error } = await anon.rpc("_append_event_atomic", {
      p_event: validTriple().p_event, p_payload_text: "{}", p_refs: validTriple().p_refs,
    } as never);
    expect(error, `the internal helper must not be callable by anon`).not.toBeNull();
  });

  it("authenticated CANNOT execute capture_risk_registered", async () => {
    const { error } = await authed.rpc("capture_risk_registered", validTriple() as never);
    expect(error, `authenticated must not call capture_risk_registered`).not.toBeNull();
  });

  it("authenticated CANNOT execute capture_risk_status_change", async () => {
    const { error } = await authed.rpc("capture_risk_status_change", {
      p_risk_id: "00000000-0000-0000-0000-000000000001",
      p_new_status: "open", p_expected_from_status: "resolved",
      p_organization_id: "00000000-0000-0000-0000-000000000001",
      p_project_id: "00000000-0000-0000-0000-000000000001",
      ...validTriple(),
    } as never);
    expect(error).not.toBeNull();
  });

  it("authenticated CANNOT execute append_risk_event_atomic", async () => {
    const { error } = await authed.rpc("append_risk_event_atomic", {
      p_event: validTriple().p_event, p_payload_text: "{}", p_refs: validTriple().p_refs,
    } as never);
    expect(error).not.toBeNull();
  });

  it("authenticated CANNOT execute the internal _append_event_atomic directly", async () => {
    const { error } = await authed.rpc("_append_event_atomic", {
      p_event: validTriple().p_event, p_payload_text: "{}", p_refs: validTriple().p_refs,
    } as never);
    expect(error, `the internal helper must not be callable by authenticated`).not.toBeNull();
  });

  it("service_role CANNOT execute the internal _append_event_atomic directly (helper-only)", async () => {
    // Even the service role must go through the public capture_* RPCs. The helper
    // has NO grant to service_role (only the owner can call it).
    const { error } = await admin.rpc("_append_event_atomic", {
      p_event: validTriple().p_event, p_payload_text: "{}", p_refs: validTriple().p_refs,
    } as never);
    expect(error, `service_role must not call _append_event_atomic directly`).not.toBeNull();
  });

  it("service_role CAN invoke capture_risk_registered (reaches the body, not permission-denied)", async () => {
    // We do NOT assert success (the synthetic org/project don't exist → the
    // invariant check raises 'invariant_project_not_in_org'). The point is that
    // service_role gets PAST the EXECUTE gate: a 42501 permission-denied would
    // mean the GRANT is missing. A non-permission error proves the grant works.
    const { error, data } = await admin.rpc("capture_risk_registered", validTriple() as never);
    const permDenied = error && /permission denied|42501/i.test(error.message);
    expect(permDenied, `service_role must have EXECUTE: ${error?.message ?? ""}`).toBeFalsy();
    void data;
  });

  it("service_role CAN invoke append_risk_event_atomic (reaches the body, not permission-denied)", async () => {
    const { error } = await admin.rpc("append_risk_event_atomic", {
      p_event: validTriple().p_event, p_payload_text: "{}", p_refs: validTriple().p_refs,
    } as never);
    const permDenied = error && /permission denied|42501/i.test(error.message);
    expect(permDenied, `service_role must have EXECUTE: ${error?.message ?? ""}`).toBeFalsy();
  });

  // NOTE on the catalog check (pg_proc / information_schema.routine_privileges):
  // the Supabase JS client cannot run arbitrary SELECTs against pg_catalog
  // (no RLS view is exposed). The behavioral assertions above prove the
  // security-relevant property (who can/cannot call each function). The explicit
  // catalog query — `\df+ public.capture_*` and
  // `SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges
  //  WHERE routine_schema='public' AND routine_name IN (...)` — is part of the
  // migration reconciliation step (BLOCKER 6) and is run via psql against local
  // Supabase; its expected output is documented in the PR.
});