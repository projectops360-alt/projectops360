// ============================================================================
// S3-T4 — Criterion A: Immutability of the canonical event store (local DB)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Proves, against the REAL database, that project_event_log is append-only:
//   A1. an existing event CANNOT be UPDATEd (BEFORE UPDATE trigger raises);
//   A2. an existing event CANNOT be DELETEd (BEFORE DELETE trigger raises);
//   A3. corrections are represented by LATER events — a compensating event can
//       be appended (INSERT is allowed) and links back to the corrected event;
//   A4. project_event_objects cannot be disconnected from its event — a ref
//       pointing at a non-existent event_id is rejected by the FK, and a ref
//       pointing at a real event persists linked to it.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is localhost (beforeAll
// guard). Loads .env.test (gitignored), never .env.local (production).
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/event-immutability.test.ts
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

function loadEnvTest(): void {
  const p = resolve(process.cwd(), ".env.test");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const RUN = process.env.RISK_CAPTURE_VERIFY === "1";

describe.runIf(RUN)("S3-T4 A — event store immutability (local DB)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let atomic: any;
  const ids = { org: "", project: "", risk: "", owner: "", registeredEventId: "" };

  beforeAll(async () => {
    loadEnvTest();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(`S3-T4 immutability test refused: NEXT_PUBLIC_SUPABASE_URL must be local. Got "${url}".`);
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");
    const admin = await import("@/lib/supabase/admin");
    supabase = admin.createAdminClient();
    atomic = await import("@/lib/events/risk-events");

    const { data: anyProject } = await supabase
      .from("projects").select("organization_id, created_by").is("deleted_at", null).limit(1).single();
    ids.org = anyProject.organization_id;
    ids.owner = anyProject.created_by ?? "00000000-0000-0000-0000-000000000001";
    const { data: project, error } = await supabase.from("projects").insert({
      organization_id: ids.org, slug: `s3t4-imm-${Date.now()}`,
      title_i18n: { en: "S3-T4 immutability (temp)", es: "S3-T4 inmutabilidad (temp)" }, status: "active",
    }).select("id").single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = ids.project;

    const reg = await atomic.captureRiskRegisteredAtomic({
      riskFields: { organization_id: ids.org, project_id: ids.project, title: "S3-T4 immutability risk",
        category: "technical", probability: "medium", impact: "high", severity: "high", status: "open", origin: "manual" },
      actor: { actorType: "human", actorId: ids.owner }, captureMethod: "direct", origin: "manual",
      sourceModule: "s3t4-test", title: "S3-T4 immutability risk",
      evidenceRef: { type: "project", id: ids.project }, operationId: `s3t4:imm:register:${ids.project}`,
    });
    expect(reg.ok, `register failed: ${reg.error ?? ""}`).toBe(true);
    ids.risk = reg.riskId;
    ids.registeredEventId = reg.eventId;
  }, 120_000);

  afterAll(async () => {
    if (ids.project) {
      await supabase.from("project_event_counters").delete().eq("project_id", ids.project);
      await supabase.from("projects").delete().eq("id", ids.project);
    }
  }, 120_000);

  it("A1. an existing event CANNOT be UPDATEd (row fingerprint unchanged)", async () => {
    const { data: before } = await supabase.from("project_event_log")
      .select("event_importance, event_hash, payload").eq("event_id", ids.registeredEventId).single();
    const { error } = await supabase.from("project_event_log")
      .update({ event_importance: "LOW" }).eq("event_id", ids.registeredEventId);
    expect(error, "UPDATE on project_event_log must be rejected by the append-only trigger").not.toBeNull();
    const { data: after } = await supabase.from("project_event_log")
      .select("event_importance, event_hash, payload").eq("event_id", ids.registeredEventId).single();
    expect(after?.event_importance).toBe(before?.event_importance); // unchanged
    expect(after?.event_hash).toBe(before?.event_hash);             // fingerprint intact
  }, 60_000);

  it("A2. an existing event CANNOT be DELETEd (row survives)", async () => {
    const { error } = await supabase.from("project_event_log").delete().eq("event_id", ids.registeredEventId);
    expect(error, "DELETE on project_event_log must be rejected by the append-only trigger").not.toBeNull();
    const { count } = await supabase.from("project_event_log")
      .select("event_id", { count: "exact", head: true }).eq("event_id", ids.registeredEventId);
    expect(count, "the event row must still exist after a rejected DELETE").toBe(1);
  }, 60_000);

  it("A3. a correction is a LATER event: a compensating event appends and links back", async () => {
    // A compensating event is an INSERT (allowed — no BEFORE INSERT trigger)
    // that references the corrected event via compensates_event_id. Demonstrates
    // corrections-via-events at the DB level: the ledger is never edited, only
    // extended. This throwaway project is single-writer + sequential, so
    // MAX(sequence_number)+1 is a safe sequence (UNIQUE constraint protects).
    const { data: maxRow } = await supabase.from("project_event_log")
      .select("sequence_number").eq("project_id", ids.project)
      .order("sequence_number", { ascending: false }).limit(1).maybeSingle();
    const seq = ((maxRow as { sequence_number?: number } | null)?.sequence_number ?? 0) + 1;
    const insertRes = await supabase.from("project_event_log").insert({
      event_id: randomUUID(),
      organization_id: ids.org, project_id: ids.project, case_id: ids.project,
      event_category: "risk", event_type: "risk_registered_voided",
      subject_type: "risk", subject_id: ids.risk,
      actor_type: "human", actor_id: ids.owner,
      occurred_at: new Date().toISOString(),
      source_module: "s3t4-test",
      is_compensating_event: true, compensates_event_id: ids.registeredEventId,
      sequence_number: seq,
      payload: { reason: "duplicate of an earlier registration", corrected_by: "s3t4-test" },
    }).select("event_id, is_compensating_event, compensates_event_id").single();
    expect(insertRes.error, `compensating event insert failed: ${insertRes.error?.message ?? ""}`).toBeNull();
    expect(insertRes.data?.is_compensating_event).toBe(true);
    expect(insertRes.data?.compensates_event_id).toBe(ids.registeredEventId);
    // The corrected event is STILL present (not edited, not removed).
    const { count } = await supabase.from("project_event_log")
      .select("event_id", { count: "exact", head: true }).eq("event_id", ids.registeredEventId);
    expect(count).toBe(1);
  }, 60_000);

  it("A4. project_event_objects cannot be disconnected from its event", async () => {
    // (a) A ref pointing at a NON-EXISTENT event_id is rejected by the FK.
    const bogusEvent = "00000000-0000-0000-0000-000000000099";
    const { error: orphanErr } = await supabase.from("project_event_objects").insert({
      event_id: bogusEvent, object_type: "risk", object_id: ids.risk, role: "focal",
    });
    expect(orphanErr, "an object_ref with a non-existent event_id must be rejected (FK)").not.toBeNull();
    // (b) A NOVEL ref pointing at the REAL registered event is accepted and linked
    //     (the focal ref already exists from the atomic register, so use a fresh
    //     object+role triple to avoid the PK collision and prove linkage).
    const { data: ref, error: refErr } = await supabase.from("project_event_objects").insert({
      event_id: ids.registeredEventId,
      object_type: "project_memory_item", object_id: randomUUID(), role: "evidence",
    }).select("event_id, object_type, object_id, role").single();
    expect(refErr, `linked ref insert failed: ${refErr?.message ?? ""}`).toBeNull();
    expect(ref?.event_id).toBe(ids.registeredEventId);
    // (c) The focal ref created by the atomic register is reachable from the event
    //     (no disconnection): every object_ref row for this event points back at it.
    const { data: linked } = await supabase.from("project_event_objects")
      .select("object_type, object_id, role").eq("event_id", ids.registeredEventId);
    const rows = (linked ?? []) as Array<{ object_type: string; object_id: string; role: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.object_type === "risk" && r.object_id === ids.risk && r.role === "focal")).toBe(true);
  }, 60_000);
});