// ============================================================================
// P2-T2 — Derived risk response trail guards (PD-018 §B.4; RI-09, RI-13)
// ============================================================================
// The explicit deterministic rule mapping linked-task events to derived risk
// response events. Protects: correct mapping + causation, derived marking with
// reduced confidence, no derivation without a link, and RI-09 (completing a
// response action NEVER closes the risk — the bridge cannot emit closures).
// ============================================================================

import { describe, it, expect } from "vitest";
import { validateProjectEvent } from "@/lib/events/ingestion";
import {
  mapTaskEventToDerivedRiskInput,
  DERIVED_CONFIDENCE,
  type TaskEventForDerivation,
} from "@/lib/events/risk-derived-bridge";

const ORG = "11111111-1111-1111-1111-111111111111";
const PROJ = "22222222-2222-2222-2222-222222222222";
const TASK = "55555555-5555-5555-5555-555555555555";
const RISK = "44444444-4444-4444-4444-444444444444";
const TASK_EVENT = "99999999-9999-9999-9999-999999999999";

function taskEvent(overrides: Partial<TaskEventForDerivation> = {}): TaskEventForDerivation {
  return {
    eventId: TASK_EVENT,
    eventType: "TaskCreated",
    organizationId: ORG,
    projectId: PROJ,
    taskId: TASK,
    toState: null,
    occurredAt: "2026-07-11T12:00:00.000Z",
    ...overrides,
  };
}

describe("mapTaskEventToDerivedRiskInput (explicit rule — PD-016 event #11)", () => {
  it("TaskCreated → risk_response_action_created", () => {
    const e = mapTaskEventToDerivedRiskInput(taskEvent(), RISK);
    expect(e?.eventType).toBe("risk_response_action_created");
    expect(e?.subjectId).toBe(RISK);
    expect(e && validateProjectEvent(e).ok).toBe(true);
  });

  it("TaskStatusChanged(→in_progress) → risk_response_started; other states derive nothing", () => {
    const started = mapTaskEventToDerivedRiskInput(
      taskEvent({ eventType: "TaskStatusChanged", toState: "in_progress" }), RISK);
    expect(started?.eventType).toBe("risk_response_started");

    for (const state of ["todo", "blocked", "done", "review", null]) {
      const none = mapTaskEventToDerivedRiskInput(
        taskEvent({ eventType: "TaskStatusChanged", toState: state }), RISK);
      expect(none, `toState=${state} must not derive`).toBeNull();
    }
  });

  it("TaskCompleted → risk_response_action_completed", () => {
    const e = mapTaskEventToDerivedRiskInput(taskEvent({ eventType: "TaskCompleted" }), RISK);
    expect(e?.eventType).toBe("risk_response_action_completed");
  });

  it("derived marking: capture_method=derived, reduced confidence, derived flag, DERIVED_EVENT class", () => {
    const e = mapTaskEventToDerivedRiskInput(taskEvent(), RISK)!;
    expect(e.lifecycleClassOverride).toBe("DERIVED_EVENT");
    expect(e.confidence).toBe(DERIVED_CONFIDENCE);
    expect(e.confidence).toBeLessThan(1);
    const prov = e.provenance as { capture_method?: string; data_quality_flags?: string[]; derivation_rule?: string };
    expect(prov.capture_method).toBe("derived");
    expect(prov.data_quality_flags).toContain("derived");
    expect(prov.derivation_rule).toContain("linked_task_id");
  });

  it("recorded causality: caused_by references the source task event", () => {
    const e = mapTaskEventToDerivedRiskInput(taskEvent(), RISK)!;
    expect(e.causedBy).toEqual([TASK_EVENT]);
    const refs = e.objectRefs ?? [];
    expect(refs).toContainEqual({ objectType: "risk", objectId: RISK, role: "focal" });
    expect(refs).toContainEqual({ objectType: "task", objectId: TASK, role: "response" });
  });

  it("derives nothing without a task or risk id, or for unmapped event types", () => {
    expect(mapTaskEventToDerivedRiskInput(taskEvent({ taskId: null }), RISK)).toBeNull();
    expect(mapTaskEventToDerivedRiskInput(taskEvent(), "")).toBeNull();
    expect(mapTaskEventToDerivedRiskInput(taskEvent({ eventType: "TaskAssigned" }), RISK)).toBeNull();
    expect(mapTaskEventToDerivedRiskInput(taskEvent({ eventType: "TaskDeleted" }), RISK)).toBeNull();
  });

  it("RI-09: the bridge can never emit a closure (completing an action ≠ closing the risk)", () => {
    for (const t of ["TaskCreated", "TaskStatusChanged", "TaskCompleted"]) {
      for (const state of ["in_progress", "done", null]) {
        const e = mapTaskEventToDerivedRiskInput(taskEvent({ eventType: t, toState: state }), RISK);
        if (e) {
          expect(e.eventType).not.toBe("risk_closed");
          expect(e.eventType).not.toBe("risk_closure_requested");
          expect(e.eventType).not.toBe("risk_closure_validated");
          expect(e.eventType).toMatch(/^risk_response_/);
        }
      }
    }
  });
});
