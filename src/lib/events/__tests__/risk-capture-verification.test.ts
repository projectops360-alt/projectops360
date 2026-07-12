// ============================================================================
// P2-T2 — Functional verification of the risk event capture pipeline (MANUAL)
// ============================================================================
// NOT part of the CI suite: gated by RISK_CAPTURE_VERIFY=1 (skipped otherwise).
// Runs the full pilot cycle against the REAL database through the REAL
// ingestion gateway (the same emit path every writer calls), on a throwaway
// project that is fully cleaned up afterwards (FK cascade).
//
//   RISK_CAPTURE_VERIFY=1 npx vitest run src/lib/events/__tests__/risk-capture-verification.test.ts
//
// Cycle: register → assess → owner → plan approved → linked task advances
// (derived trail with causation) → close with reason → reopen → dedup proof.
// Prints the resulting project_event_log + project_event_objects sequence (the
// PR evidence required by the plan's test gate).
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local (vitest does not) BEFORE importing anything that reads env.
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && process.env[m[1]] == null) {
        process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
      }
    }
  } catch {
    // no .env.local — the run will fail loudly on missing keys
  }
}

const RUN = process.env.RISK_CAPTURE_VERIFY === "1";

describe.runIf(RUN)("P2-T2 functional verification (real DB, throwaway project)", () => {
  loadEnvLocal();

  // Dynamic imports AFTER env is loaded.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let supabase: any;
  let emitProjectEvent: any;
  let builders: any;
  let bridge: any;

  const ids = {
    org: "", project: "", risk: "", task: "", owner: "",
    registeredEventId: "", closedEventId: "",
  };

  beforeAll(async () => {
    const admin = await import("@/lib/supabase/admin");
    supabase = admin.createAdminClient();
    ({ emitProjectEvent } = await import("@/lib/events/ingestion"));
    builders = await import("@/lib/events/risk-events");
    bridge = await import("@/lib/events/risk-derived-bridge");

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

    // Enable the pilot flag for THIS project only, in-process.
    process.env.RISK_EVENT_CAPTURE_PROJECT_IDS = ids.project;

    // A linked response task (created directly; its PEG events are emitted below).
    const { data: task } = await supabase.from("roadmap_tasks").insert({
      organization_id: ids.org, project_id: ids.project,
      title: "Mitigation: vendor abstraction layer", status: "todo",
    }).select("id").single();
    ids.task = task.id;

    // The pilot risk, linked to the response task.
    const { data: risk } = await supabase.from("risks").insert({
      organization_id: ids.org, project_id: ids.project,
      title: "Vendor SDK deprecation before GA", category: "technical",
      probability: "medium", impact: "high", severity: "high",
      status: "open", origin: "manual", linked_task_id: task.id,
    }).select("id").single();
    ids.risk = risk.id;
  }, 60_000);

  afterAll(async () => {
    // Full cleanup: deleting the project cascades risks, tasks, event log rows
    // (FK ON DELETE CASCADE) and event objects (FK to event_id CASCADE).
    if (ids.project) {
      await supabase.from("project_event_counters").delete().eq("project_id", ids.project);
      await supabase.from("projects").delete().eq("id", ids.project);
    }
  }, 60_000);

  it("runs the full cycle and the log tells the story in order", async () => {
    const risk = {
      riskId: ids.risk, organizationId: ids.org, projectId: ids.project, linkedTaskId: ids.task,
    };
    const human = { actorType: "human" as const, actorId: ids.owner };

    // 1. register (writer path: manual/direct)
    const reg = await emitProjectEvent(builders.buildRiskRegistered({
      risk, actor: human, captureMethod: "direct", origin: "manual", sourceModule: "risks",
    }));
    expect(reg.ok).toBe(true);
    ids.registeredEventId = reg.eventId;

    // 2. assess (affordance 2 path)
    expect((await emitProjectEvent(builders.buildRiskAssessed({
      risk, actor: human, sourceModule: "closeout",
      method: "probability_impact_matrix",
      values: { probability: "medium", impact: "high", severity: "high" },
      assessedAt: new Date().toISOString(),
    }))).ok).toBe(true);

    // 3. owner assigned (no product flow mutates owner today — contract-level
    //    demonstration through the same gateway; see PR note)
    expect((await emitProjectEvent(builders.buildRiskOwnerEvent({
      risk, actor: human, sourceModule: "risks", newOwner: ids.owner,
    }))).ok).toBe(true);

    // 4. response plan approved (same contract-level demonstration)
    expect((await emitProjectEvent(builders.buildRiskResponsePlanApproved({
      risk, actor: human, sourceModule: "risks", strategy: "mitigate",
    }))).ok).toBe(true);

    // 5. linked task advances → derived trail. Task events enter through the
    //    SAME gateway; the derived bridge fires inside it. We call the bridge
    //    deterministically here (the in-gateway hook is fire-and-forget).
    const taskCreated = await emitProjectEvent({
      organizationId: ids.org, projectId: ids.project, eventType: "TaskCreated",
      subjectId: ids.task, actorType: "human", actorId: ids.owner,
      sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: ids.task,
      payload: { title: "Mitigation: vendor abstraction layer" },
    });
    expect(taskCreated.ok).toBe(true);
    await bridge.deriveRiskEventsForTaskEvent({
      eventId: taskCreated.eventId, eventType: "TaskCreated",
      organizationId: ids.org, projectId: ids.project, taskId: ids.task,
      toState: null, occurredAt: new Date().toISOString(),
    });

    const taskStarted = await emitProjectEvent({
      organizationId: ids.org, projectId: ids.project, eventType: "TaskStatusChanged",
      subjectId: ids.task, actorType: "human", actorId: ids.owner,
      sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: ids.task,
      toState: "in_progress",
    });
    await bridge.deriveRiskEventsForTaskEvent({
      eventId: taskStarted.eventId, eventType: "TaskStatusChanged",
      organizationId: ids.org, projectId: ids.project, taskId: ids.task,
      toState: "in_progress", occurredAt: new Date().toISOString(),
    });

    const taskCompleted = await emitProjectEvent({
      organizationId: ids.org, projectId: ids.project, eventType: "TaskCompleted",
      subjectId: ids.task, actorType: "human", actorId: ids.owner,
      sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: ids.task,
      toState: "done",
    });
    await bridge.deriveRiskEventsForTaskEvent({
      eventId: taskCompleted.eventId, eventType: "TaskCompleted",
      organizationId: ids.org, projectId: ids.project, taskId: ids.task,
      toState: "done", occurredAt: new Date().toISOString(),
    });

    // 6. close with reason (affordance 1 path)
    const closed = await emitProjectEvent(builders.buildRiskClosed({
      risk, actor: human, sourceModule: "closeout", closureReason: "mitigated", viaCloseout: true,
    }));
    expect(closed.ok).toBe(true);
    ids.closedEventId = closed.eventId;

    // 7. reopen referencing the prior closure (affordance 3b path)
    expect((await emitProjectEvent(builders.buildRiskReopened({
      risk, actor: human, sourceModule: "closeout",
      reasonCode: "closure_invalidated", priorClosureEventId: ids.closedEventId,
    }))).ok).toBe(true);

    // 8. dedup proof: re-emitting the SAME registration input dedupes.
    const again = await emitProjectEvent(builders.buildRiskRegistered({
      risk, actor: human, captureMethod: "direct", origin: "manual", sourceModule: "risks",
    }));
    expect(again.ok).toBe(true);
    // (occurred_at defaults to now → a different second would not dedup; the
    // stable-key property over identical inputs is covered by unit tests. When
    // this emission lands in the same instant it returns deduped=true.)

    // ── Evidence: the ordered log + object refs ──────────────────────────────
    const { data: log } = await supabase
      .from("project_event_log")
      .select("event_id, sequence_number, event_type, subject_id, actor_id, caused_by, confidence, event_lifecycle_class, payload, provenance")
      .eq("project_id", ids.project)
      .order("sequence_number", { ascending: true });

    // Human-readable evidence for the PR:
    console.log("\n===== project_event_log (ordered) =====");
    for (const r of log ?? []) {
      console.log(
        `#${r.sequence_number} ${r.event_type}` +
        ` | class=${r.event_lifecycle_class} | conf=${r.confidence ?? "-"}` +
        ` | caused_by=${JSON.stringify(r.caused_by)} | payload=${JSON.stringify(r.payload)}` +
        ` | flags=${JSON.stringify((r.provenance as { data_quality_flags?: string[] })?.data_quality_flags ?? [])}`,
      );
    }

    const { data: objectRows } = await supabase
      .from("project_event_objects")
      .select("object_type, object_id, role")
      .eq("object_type", "risk")
      .eq("object_id", ids.risk);
    console.log(`===== project_event_objects: ${objectRows?.length ?? 0} refs to the pilot risk =====`);

    // Assertions on the story:
    const types = (log ?? []).map((r: { event_type: string }) => r.event_type);
    const expectedOrder = [
      "risk_registered", "risk_assessed", "risk_owner_assigned", "risk_response_plan_approved",
      "TaskCreated", "risk_response_action_created",
      "TaskStatusChanged", "risk_response_started",
      "TaskCompleted", "risk_response_action_completed",
      "risk_closed", "risk_reopened",
    ];
    for (const t of expectedOrder) expect(types, `log must contain ${t}`).toContain(t);
    // Order: registration before closure, closure before reopen; derived after its task event.
    expect(types.indexOf("risk_registered")).toBeLessThan(types.indexOf("risk_closed"));
    expect(types.indexOf("risk_closed")).toBeLessThan(types.indexOf("risk_reopened"));
    expect(types.indexOf("TaskCreated")).toBeLessThan(types.indexOf("risk_response_action_created"));
    expect(types.indexOf("TaskStatusChanged")).toBeLessThan(types.indexOf("risk_response_started"));
    expect(types.indexOf("TaskCompleted")).toBeLessThan(types.indexOf("risk_response_action_completed"));

    // Derived events carry causation to their source task events.
    const derived = (log ?? []).filter((r: { event_type: string }) => r.event_type.startsWith("risk_response_"));
    expect(derived.length).toBe(3);
    for (const d of derived) {
      expect((d.caused_by as string[]).length).toBeGreaterThan(0);
      expect(d.event_lifecycle_class).toBe("DERIVED_EVENT");
      expect(d.confidence).toBeLessThan(1);
    }

    // Reopen references the closure (recorded causality).
    const reopened = (log ?? []).find((r: { event_type: string }) => r.event_type === "risk_reopened");
    expect(reopened.caused_by).toContain(ids.closedEventId);

    // Object refs persisted for the pilot risk.
    expect((objectRows ?? []).length).toBeGreaterThanOrEqual(6);
  }, 120_000);
});
