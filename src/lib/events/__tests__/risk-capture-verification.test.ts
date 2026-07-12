// ============================================================================
// P2-T2 remediation — Functional verification of the ATOMIC risk capture path
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Runs the live capture cycle against the REAL database through the REAL atomic
// capture helpers + RPCs (capture_risk_registered / capture_risk_event_atomic /
// capture_risk_status_change) and the single ingestion gateway (for the derived
// task trail), on a throwaway project fully cleaned up afterwards (FK cascade).
//
// SAFETY: this test REFUSES to run against anything other than local Supabase.
// It loads `.env.test` (gitignored — copy from .env.test.example) and asserts
// NEXT_PUBLIC_SUPABASE_URL contains localhost/127.0.0.1. It never reads
// .env.local (which points to production). Do NOT set RISK_CAPTURE_VERIFY=1 with
// prod env vars — the guard will throw.
//
//   set -a && source .env.test && set +a
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-verification.test.ts
//
// Cycle (Fase 6 compliant — no risk_closed):
//   register (atomic INSERT risk+event) → assess (atomic) → materialize (atomic)
//   → linked task advances (derived trail with causation, via the gateway)
//   → resolve (direct UPDATE status=resolved, NO event — "not capturable yet")
//   → reopen (atomic UPDATE status=open + risk_reopened, missing_prior_closure)
//   → dedup proof (re-register identical input → deduped).
// Asserts: ordered log, object refs, derived causation, NO risk_closed event,
// reopen carries missing_prior_closure (no prior closure event exists).
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.test (gitignored, local-only) BEFORE importing anything that reads
// env. Deliberately NOT .env.local (that points to production).
function loadEnvTest(): void {
  const p = resolve(process.cwd(), ".env.test");
  if (!existsSync(p)) return; // rely on whatever the runner already exported
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] == null) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

const RUN = process.env.RISK_CAPTURE_VERIFY === "1";

describe.runIf(RUN)("P2-T2 functional verification (local DB, atomic path, throwaway project)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let emitProjectEvent: any;
  let builders: any;
  let atomic: any;

  const ids = {
    org: "", project: "", risk: "", task: "", owner: "",
    registeredEventId: "", reopenedEventId: "",
  };

  beforeAll(async () => {
    loadEnvTest();

    // SAFETY GUARD (runs only when the suite is registered, i.e. RISK_CAPTURE_VERIFY=1):
    // refuse to run against anything other than local Supabase.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!url || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
      throw new Error(
        `P2-T2 verification refused: NEXT_PUBLIC_SUPABASE_URL must point at local Supabase (localhost/127.0.0.1). Got "${url}". ` +
          `Copy .env.test.example → .env.test, fill from \`supabase status\`, then re-run.`,
      );
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("P2-T2 verification refused: SUPABASE_SERVICE_ROLE_KEY not set (use .env.test).");
    }

    const admin = await import("@/lib/supabase/admin");
    supabase = admin.createAdminClient();
    ({ emitProjectEvent } = await import("@/lib/events/ingestion"));
    builders = await import("@/lib/events/risk-events");
    atomic = await import("@/lib/events/risk-events");

    // Anchor org: reuse the org of any existing project (no org mutation).
    const { data: anyProject } = await supabase
      .from("projects").select("organization_id, created_by").is("deleted_at", null).limit(1).single();
    ids.org = anyProject.organization_id;
    ids.owner = anyProject.created_by ?? "00000000-0000-0000-0000-000000000001";

    // Throwaway project (deleted afterwards; everything cascades).
    const { data: project, error } = await supabase.from("projects").insert({
      organization_id: ids.org,
      slug: `p2t2-verify-${Date.now()}`,
      title_i18n: { en: "P2-T2 verification (temp)", es: "Verificación P2-T2 (temporal)" },
      status: "active",
    }).select("id").single();
    if (error) throw new Error(`project insert failed: ${error.message}`);
    ids.project = project.id;

    // Enable BOTH pilot flags for THIS project only, in-process.
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;
    process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS = ids.project;

    // A linked response task (created directly; its PEG events are emitted below).
    const { data: task } = await supabase.from("roadmap_tasks").insert({
      organization_id: ids.org, project_id: ids.project,
      title: "Mitigation: vendor abstraction layer", status: "not_started",
    }).select("id").single();
    ids.task = task.id;
    // NOTE: the risk is NOT pre-inserted — step 1 creates it atomically via the
    // capture_risk_registered RPC (INSERT risk + event in one transaction).
  }, 60_000);

  afterAll(async () => {
    // Full cleanup: deleting the project cascades risks, tasks, event log rows
    // (FK ON DELETE CASCADE) and event objects (FK to event_id CASCADE).
    if (ids.project) {
      await supabase.from("project_event_counters").delete().eq("project_id", ids.project);
      await supabase.from("projects").delete().eq("id", ids.project);
    }
  }, 60_000);

  it("runs the atomic cycle and the log tells the story in order (no risk_closed)", async () => {
    const human = { actorType: "human" as const, actorId: ids.owner };
    const riskRef = () => ({
      riskId: ids.risk, organizationId: ids.org, projectId: ids.project, linkedTaskId: ids.task,
    });

    // 1. register — ATOMIC: INSERT risk + risk_registered event in one tx.
    // operationId is a STABLE workflow id (here: a synthetic scribe item id).
    const REGISTER_OP = "scribe:verify-mem-1";
    const reg = await atomic.captureRiskRegisteredAtomic({
      riskFields: {
        organization_id: ids.org, project_id: ids.project,
        title: "Vendor SDK deprecation before GA", category: "technical",
        probability: "medium", impact: "high", severity: "high",
        status: "open", origin: "manual", linked_task_id: ids.task,
      },
      actor: human, captureMethod: "direct", origin: "manual", sourceModule: "risks",
      title: "Vendor SDK deprecation before GA",
      evidenceRef: { type: "project", id: ids.project },
      operationId: REGISTER_OP,
    });
    expect(reg.ok, `register atomic failed: ${reg.error ?? ""} ${reg.errors ?? ""}`).toBe(true);
    expect(reg.riskId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(reg.deduped).toBe(false); // BLOCKER 2 #8: first call → deduped=false
    ids.risk = reg.riskId!;
    ids.registeredEventId = reg.eventId!;

    // 2. assess — ATOMIC append (no Risk mutation). BLOCKER 2: operationId drives
    //    the dedup_key; a retry (fresh assessedAt) dedupes to the first event.
    const ASSESS_OP = "closeout:assess:1";
    const assess = await atomic.captureRiskEventAtomic({
      operationId: ASSESS_OP,
      input: builders.buildRiskAssessed({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        method: "probability_impact_matrix",
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(),
      }),
    });
    expect(assess.ok, `assess atomic failed: ${assess.error ?? ""}`).toBe(true);
    expect(assess.deduped).toBe(false); // first assess → deduped=false

    // 2b. retry the SAME assess: deduped=true, no second event.
    const assessRetry = await atomic.captureRiskEventAtomic({
      operationId: ASSESS_OP,
      input: builders.buildRiskAssessed({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        method: "probability_impact_matrix",
        values: { probability: "medium", impact: "high", severity: "high" },
        assessedAt: new Date().toISOString(), // fresh timestamp, same operationId
      }),
    });
    expect(assessRetry.ok).toBe(true);
    expect(assessRetry.deduped).toBe(true);
    expect(assessRetry.eventId).toBe(assess.eventId);

    // 2c. a NEW operationId allows a later, legitimate assessment.
    const assessAgain = await atomic.captureRiskEventAtomic({
      operationId: "closeout:assess:2",
      input: builders.buildRiskAssessed({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        method: "qualitative",
        values: { probability: "high", impact: "high", severity: "critical" },
        assessedAt: new Date().toISOString(),
      }),
    });
    expect(assessAgain.ok).toBe(true);
    expect(assessAgain.deduped).toBe(false);

    // 3. materialize — ATOMIC append (no Risk mutation). BLOCKER 2: same contract.
    const MATERIALIZE_OP = "closeout:materialize:1";
    const mat = await atomic.captureRiskEventAtomic({
      operationId: MATERIALIZE_OP,
      input: builders.buildRiskMaterialized({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        materializationScope: "partial", impactNote: "Schedule slip on integration tests",
      }),
    });
    expect(mat.ok, `materialize atomic failed: ${mat.error ?? ""}`).toBe(true);
    expect(mat.deduped).toBe(false);

    // 3b. retry the SAME materialize: deduped=true.
    const matRetry = await atomic.captureRiskEventAtomic({
      operationId: MATERIALIZE_OP,
      input: builders.buildRiskMaterialized({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        materializationScope: "partial", impactNote: "Schedule slip on integration tests",
      }),
    });
    expect(matRetry.ok).toBe(true);
    expect(matRetry.deduped).toBe(true);
    expect(matRetry.eventId).toBe(mat.eventId);

    // 3c. a NEW operationId allows a later, legitimate materialization.
    const matAgain = await atomic.captureRiskEventAtomic({
      operationId: "closeout:materialize:2",
      input: builders.buildRiskMaterialized({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        materializationScope: "total", impactNote: "Full integration stop",
      }),
    });
    expect(matAgain.ok).toBe(true);
    expect(matAgain.deduped).toBe(false);

    // 4. linked task advances → derived trail. Task events enter through the
    //    SAME gateway; the derived bridge fires inside it (fire-and-forget).
    //    We do NOT call the bridge manually here — doing so would duplicate each
    //    derived event (gateway hook + manual call). The poll before the log
    //    fetch waits for the fire-and-forget derivation to land.
    const taskCreated = await emitProjectEvent({
      organizationId: ids.org, projectId: ids.project, eventType: "TaskCreated",
      subjectId: ids.task, actorType: "human", actorId: ids.owner,
      sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: ids.task,
      payload: { title: "Mitigation: vendor abstraction layer" },
    });
    expect(taskCreated.ok).toBe(true);

    const taskStarted = await emitProjectEvent({
      organizationId: ids.org, projectId: ids.project, eventType: "TaskStatusChanged",
      subjectId: ids.task, actorType: "human", actorId: ids.owner,
      sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: ids.task,
      toState: "in_progress",
    });

    const taskCompleted = await emitProjectEvent({
      organizationId: ids.org, projectId: ids.project, eventType: "TaskCompleted",
      subjectId: ids.task, actorType: "human", actorId: ids.owner,
      sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: ids.task,
      toState: "done",
    });
    void taskStarted;
    void taskCompleted;

    // 5. resolve — direct UPDATE status=resolved, NO event (Fase 6: not capturable
    //    yet). This mirrors resolveRiskAction's preserved transaccional behavior.
    const { error: resolveErr } = await supabase.from("risks")
      .update({ status: "resolved" })
      .eq("id", ids.risk).eq("project_id", ids.project).eq("organization_id", ids.org);
    expect(resolveErr, "resolve update failed").toBeNull();

    // 6. reopen — ATOMIC: UPDATE status=open + risk_reopened event in one tx.
    //    No prior closure event exists (risk_closed not emitted) → missing_prior_closure.
    //    BLOCKER 3: expectedFromStatus precondition + stable operationId.
    const REOPEN_OP = `closeout:reopen:${ids.risk}:resolved:risk_resurfaced:no-prior`;
    const { data: riskBeforeReopen } = await supabase
      .from("risks").select("updated_at")
      .eq("id", ids.risk).single();
    const reopen = await atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project,
      operationId: REOPEN_OP,
      input: builders.buildRiskReopened({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        reasonCode: "risk_resurfaced",
        priorClosureEventId: null, // none — risk_closed is not capturable yet
        fromState: "resolved", toState: "open",
      }),
    });
    expect(reopen.ok, `reopen atomic failed: ${reopen.error ?? ""}`).toBe(true);
    expect(reopen.deduped).toBe(false); // first reopen → deduped=false
    ids.reopenedEventId = reopen.eventId!;

    // 6b. BLOCKER 3 #5 — retry the SAME reopen: deduped, updated_at UNCHANGED.
    const { data: riskAfterReopen } = await supabase
      .from("risks").select("updated_at").eq("id", ids.risk).single();
    const reopenRetry = await atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project,
      operationId: REOPEN_OP, // SAME operation id → same dedup_key
      input: builders.buildRiskReopened({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        reasonCode: "risk_resurfaced", priorClosureEventId: null,
        fromState: "resolved", toState: "open",
      }),
    });
    expect(reopenRetry.ok).toBe(true);
    expect(reopenRetry.deduped).toBe(true); // retry → deduped
    expect(reopenRetry.eventId).toBe(ids.reopenedEventId); // same event
    const { data: riskAfterRetry } = await supabase
      .from("risks").select("updated_at").eq("id", ids.risk).single();
    expect(riskAfterRetry?.updated_at).toBe(riskAfterReopen?.updated_at); // not bumped

    // 6c. BLOCKER 3 #5 — a STALE reopen (expectedFromStatus='resolved' but the
    //    risk is now 'open') must FAIL without mutating or creating an event.
    const stale = await atomic.captureRiskStatusChangeAtomic({
      riskId: ids.risk, newStatus: "open", expectedFromStatus: "resolved",
      organizationId: ids.org, projectId: ids.project,
      operationId: `closeout:reopen:${ids.risk}:stale-${Date.now()}`,
      input: builders.buildRiskReopened({
        risk: riskRef(), actor: human, sourceModule: "closeout",
        reasonCode: "risk_resurfaced", priorClosureEventId: null,
        fromState: "resolved", toState: "open",
      }),
    });
    expect(stale.ok).toBe(false); // wrong_from_state → rejected

    // 7. BLOCKER 2 #8 — REAL idempotency: re-register with the SAME operationId.
    //    A network retry after the commit must NOT create a second Risk or event.
    const again = await atomic.captureRiskRegisteredAtomic({
      riskFields: {
        organization_id: ids.org, project_id: ids.project,
        title: "Vendor SDK deprecation before GA", category: "technical",
        probability: "medium", impact: "high", severity: "high",
        status: "open", origin: "manual", linked_task_id: ids.task,
      },
      actor: human, captureMethod: "direct", origin: "manual", sourceModule: "risks",
      title: "Vendor SDK deprecation before GA",
      evidenceRef: { type: "project", id: ids.project },
      operationId: REGISTER_OP, // SAME operation id as step 1
    });
    expect(again.ok, `re-register failed: ${again.error ?? ""}`).toBe(true);
    expect(again.deduped).toBe(true); // retry → deduped
    expect(again.eventId).toBe(ids.registeredEventId); // same event
    expect(again.riskId).toBe(ids.risk); // SAME canonical risk id (not a new uuid)

    // Wait for the gateway's fire-and-forget derived-risk bridge to land the 3
    // derived events (the bridge is invoked async, not awaited by emitProjectEvent).
    const EXPECTED_DERIVED = ["risk_response_action_created", "risk_response_started", "risk_response_action_completed"];
    const pollUntil = Date.now() + 15_000;
    for (;;) {
      const { data: present } = await supabase
        .from("project_event_log").select("event_type")
        .eq("project_id", ids.project).in("event_type", EXPECTED_DERIVED);
      const got = new Set((present ?? []).map((r: { event_type: string }) => r.event_type));
      if (EXPECTED_DERIVED.every((t) => got.has(t)) || Date.now() > pollUntil) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    // ── Evidence: the ordered log + object refs ──────────────────────────────
    const { data: log } = await supabase
      .from("project_event_log")
      .select("event_id, sequence_number, event_type, subject_id, actor_id, caused_by, confidence, event_lifecycle_class, payload, provenance")
      .eq("project_id", ids.project)
      .order("sequence_number", { ascending: true });

    console.log("\n===== project_event_log (ordered) =====");
    for (const r of log ?? []) {
      console.log(
        `#${r.sequence_number} ${r.event_type}` +
        ` | class=${r.event_lifecycle_class} | conf=${r.confidence ?? "-"}` +
        ` | caused_by=${JSON.stringify(r.caused_by)}` +
        ` | flags=${JSON.stringify((r.provenance as { data_quality_flags?: string[] })?.data_quality_flags ?? [])}`,
      );
    }

    const { data: objectRows } = await supabase
      .from("project_event_objects")
      .select("object_type, object_id, role")
      .eq("object_type", "risk")
      .eq("object_id", ids.risk);
    console.log(`===== project_event_objects: ${objectRows?.length ?? 0} refs to the pilot risk =====`);

    // ── Assertions on the story ──────────────────────────────────────────────
    const types = (log ?? []).map((r: { event_type: string }) => r.event_type);

    // Fase 6 — NO risk_closed event anywhere (closure without RI-05 is not captured).
    expect(types, "risk_closed must NOT be emitted from the resolve path (RI-05)").not.toContain("risk_closed");

    // Direct capture events present.
    expect(types).toContain("risk_registered");
    expect(types).toContain("risk_assessed");
    expect(types).toContain("risk_materialized");
    expect(types).toContain("risk_reopened");

    // Derived trail present and after their task events.
    expect(types).toContain("risk_response_action_created");
    expect(types).toContain("risk_response_started");
    expect(types).toContain("risk_response_action_completed");
    expect(types.indexOf("TaskCreated")).toBeLessThan(types.indexOf("risk_response_action_created"));
    expect(types.indexOf("TaskStatusChanged")).toBeLessThan(types.indexOf("risk_response_started"));
    expect(types.indexOf("TaskCompleted")).toBeLessThan(types.indexOf("risk_response_action_completed"));

    // Order: registration before reopen.
    expect(types.indexOf("risk_registered")).toBeLessThan(types.indexOf("risk_reopened"));

    // Derived events carry causation to their source task events + reduced confidence.
    const derived = (log ?? []).filter((r: { event_type: string }) => r.event_type.startsWith("risk_response_"));
    expect(derived.length).toBe(3);
    for (const d of derived) {
      expect((d.caused_by as string[]).length).toBeGreaterThan(0);
      expect(d.event_lifecycle_class).toBe("DERIVED_EVENT");
      expect(d.confidence).toBeLessThan(1);
    }

    // Reopen carries missing_prior_closure (no prior risk_closed event).
    const reopened = (log ?? []).find((r: { event_type: string }) => r.event_type === "risk_reopened");
    expect(reopened).toBeDefined();
    const reopenFlags = (reopened.provenance as { data_quality_flags?: string[] })?.data_quality_flags ?? [];
    expect(reopenFlags).toContain("missing_prior_closure");
    expect((reopened.caused_by as string[])).toEqual([]);

    // ── BLOCKER 2 #8 — REAL idempotency: exactly ONE Risk, ONE risk_registered,
    //    ONE set of object_refs for the registered event (despite the retry).
    const { count: riskRowCount } = await supabase
      .from("risks").select("id", { count: "exact", head: true })
      .eq("project_id", ids.project);
    expect(riskRowCount, "exactly one risk row after a retried register").toBe(1);

    const { count: registeredCount } = await supabase
      .from("project_event_log").select("event_id", { count: "exact", head: true })
      .eq("project_id", ids.project).eq("event_type", "risk_registered");
    expect(registeredCount, "exactly one risk_registered event after a retry").toBe(1);

    const { count: reopenedCount } = await supabase
      .from("project_event_log").select("event_id", { count: "exact", head: true })
      .eq("project_id", ids.project).eq("event_type", "risk_reopened");
    expect(reopenedCount, "exactly one risk_reopened event after a retry").toBe(1);

    // Object refs persisted for the pilot risk (registered + assessed + materialized + reopened).
    expect((objectRows ?? []).length).toBeGreaterThanOrEqual(4);
  }, 180_000);
});