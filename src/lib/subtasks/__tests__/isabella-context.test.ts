// ============================================================================
// TASK-EXECUTION-MAP — Isabella execution facts guards
// ============================================================================
// Protects the deterministic, record-backed facts Isabella uses to explain a
// task's progress from its subtasks (PD-012 pattern): calculated progress
// with mode, blocked/overdue lists with reasons and ages, critical-path
// impact, cancelled exclusion, hour variance, progress movement, and the
// deterministic recommended focus — in BOTH languages, never inventing.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildTaskExecutionFacts, recommendFocusSubtask } from "@/lib/subtasks/isabella-context";
import type { Subtask } from "@/lib/subtasks/types";

const ASOF = new Date("2026-07-03T12:00:00.000Z");

let seq = 0;
function subtask(overrides: Partial<Subtask> = {}): Subtask {
  seq += 1;
  return {
    id: overrides.id ?? `sub-${seq}`,
    task_id: "task-1",
    project_id: "proj-1",
    organization_id: "org-1",
    title: overrides.title ?? `Subtask ${seq}`,
    description: null,
    status: "in_progress",
    priority: "p2",
    owner_id: null,
    start_date: null,
    due_date: null,
    completed_at: null,
    estimated_hours: null,
    actual_hours: null,
    weight: null,
    progress: 50,
    is_critical: false,
    blocked_reason: null,
    blocked_at: null,
    sort_order: seq,
    created_by: null,
    updated_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function factsFor(subtasks: Subtask[], language: "en" | "es" = "en", extra: Partial<Parameters<typeof buildTaskExecutionFacts>[0]> = {}) {
  return buildTaskExecutionFacts({
    taskTitle: "QA certification",
    taskStatus: "in_progress",
    manualProgress: 40,
    subtasks,
    asOf: ASOF,
    language,
    ...extra,
  });
}

describe("Isabella execution facts — deterministic, record-backed", () => {
  it("reports the CALCULATED progress with mode and completed/active counts", () => {
    const facts = factsFor([
      subtask({ status: "completed" }),
      subtask({ status: "completed" }),
      subtask({ status: "in_progress", progress: 0 }),
      subtask({ status: "in_progress", progress: 0 }),
    ]);
    expect(facts).toContain("Task progress: 50%");
    expect(facts).toContain("2 of 4 active subtasks completed");
    expect(facts).toContain("count-based");
  });

  it("without subtasks it reports the manual progress honestly", () => {
    const facts = factsFor([]);
    expect(facts).toContain("Task progress: 40% (manual");
  });

  it("lists blockers with reason, age, owner and critical-path impact", () => {
    const facts = factsFor(
      [
        subtask({
          title: "QA approval",
          status: "blocked",
          blocked_reason: "Waiting on security sign-off",
          blocked_at: "2026-06-30T12:00:00.000Z",
          owner_id: "u1",
          is_critical: true,
        }),
      ],
      "en",
      { ownerNames: { u1: "Carlos QA" } },
    );
    expect(facts).toContain("Blocked subtasks: 1");
    expect(facts).toContain("Waiting on security sign-off");
    expect(facts).toContain("blocked 3 day(s)");
    expect(facts).toContain("Carlos QA");
    expect(facts).toContain("AFFECTS CRITICAL PATH");
    expect(facts).toContain("CRITICAL RISK");
  });

  it("lists overdue subtasks with due dates", () => {
    const facts = factsFor([subtask({ title: "Load test", status: "in_progress", due_date: "2026-07-01" })]);
    expect(facts).toContain("Overdue subtasks: 1");
    expect(facts).toContain('"Load test" was due 2026-07-01');
  });

  it("discloses cancelled subtasks excluded from progress", () => {
    const facts = factsFor([subtask({ status: "completed" }), subtask({ status: "cancelled" })]);
    expect(facts).toContain("Cancelled subtasks excluded from progress: 1");
  });

  it("explains progress movement from the recorded event trail (why 40% → 60%)", () => {
    const facts = factsFor([subtask({ status: "completed" })], "en", {
      recentProgressChange: { from: 40, to: 60, occurredAt: "2026-07-02T09:00:00.000Z" },
    });
    expect(facts).toContain("Progress moved from 40% to 60%");
  });

  it("reports hour variance", () => {
    const facts = factsFor([
      subtask({ status: "in_progress", estimated_hours: 4, actual_hours: 7 }),
    ]);
    expect(facts).toContain("estimated 4, actual 7, variance +3");
  });

  it("answers in Spanish with full orthography when language=es", () => {
    const facts = factsFor(
      [subtask({ title: "Aprobación QA", status: "blocked", blocked_reason: "Falta firma", is_critical: true })],
      "es",
    );
    expect(facts).toContain("Subtareas bloqueadas: 1");
    expect(facts).toContain("AFECTA LA RUTA CRÍTICA");
    expect(facts).toContain("RIESGO CRÍTICO");
  });
});

describe("recommended focus (deterministic)", () => {
  it("prioritizes blocked+critical, then oldest blocker, then most overdue", () => {
    const blockedCritical = subtask({ id: "bc", status: "blocked", is_critical: true, blocked_at: "2026-07-02T00:00:00.000Z" });
    const olderBlocked = subtask({ id: "ob", status: "blocked", blocked_at: "2026-06-25T00:00:00.000Z" });
    const overdue = subtask({ id: "od", status: "in_progress", due_date: "2026-07-01" });

    expect(recommendFocusSubtask([overdue, olderBlocked, blockedCritical], ASOF)?.subtask.id).toBe("bc");
    expect(recommendFocusSubtask([overdue, olderBlocked], ASOF)?.subtask.id).toBe("ob");
    expect(recommendFocusSubtask([overdue], ASOF)?.subtask.id).toBe("od");
    expect(recommendFocusSubtask([subtask({ status: "in_progress" })], ASOF)).toBeNull();
  });

  it("the facts block includes the recommendation", () => {
    const facts = factsFor([
      subtask({ title: "QA approval", status: "blocked", blocked_reason: "env down", is_critical: true }),
    ]);
    expect(facts).toContain('Recommended focus: resolve "QA approval" first.');
    expect(facts).toContain("blocked AND on the critical path");
  });

  it("per-subtask one-liners let Isabella answer about any node", () => {
    const facts = factsFor([subtask({ title: "Deploy", status: "in_review", progress: 80, due_date: "2026-07-09" })]);
    expect(facts).toContain('[subtask] "Deploy" — status: in_review; progress: 80%; due: 2026-07-09');
  });
});
