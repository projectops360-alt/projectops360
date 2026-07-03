// ============================================================================
// SUBTASK-PROGRESS — Parent progress engine guards
// ============================================================================
// Protects the calculated-parent-progress rules: three modes + strict
// fallback chain, cancelled excluded, completed=100 / not_started=0, tasks
// without subtasks preserve manual behavior (engine returns null), parent
// signals (blocked/overdue/critical risk), and the close gate.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  computeParentProgress,
  deriveParentSignals,
  evaluateParentCloseGate,
} from "@/lib/subtasks/progress";
import { isSubtaskOverdue, effectiveSubtaskProgress, type Subtask } from "@/lib/subtasks/types";

const ASOF = new Date("2026-07-03T12:00:00.000Z");

let seq = 0;
function subtask(overrides: Partial<Subtask> = {}): Subtask {
  seq += 1;
  return {
    id: `sub-${seq}`,
    task_id: "task-1",
    project_id: "proj-1",
    organization_id: "org-1",
    title: `Subtask ${seq}`,
    description: null,
    status: "not_started",
    priority: "p2",
    owner_id: null,
    start_date: null,
    due_date: null,
    completed_at: null,
    estimated_hours: null,
    actual_hours: null,
    weight: null,
    progress: 0,
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

describe("count-based progress", () => {
  it("progress = completed / total_active * 100", () => {
    const result = computeParentProgress(
      [
        subtask({ status: "completed" }),
        subtask({ status: "completed" }),
        subtask({ status: "in_progress", progress: 50 }),
        subtask({ status: "not_started" }),
      ],
      "count",
    );
    // Count mode uses effective progress per equal share: (100+100+50+0)/4 = 62.5 → 63
    expect(result?.modeUsed).toBe("count");
    expect(result?.progress).toBe(63);
    expect(result?.activeCount).toBe(4);
    expect(result?.completedCount).toBe(2);
  });

  it("completed subtasks always count as 100 and not_started as 0 (stored progress ignored)", () => {
    expect(effectiveSubtaskProgress({ status: "completed", progress: 10 })).toBe(100);
    expect(effectiveSubtaskProgress({ status: "not_started", progress: 80 })).toBe(0);
  });
});

describe("weighted progress", () => {
  it("progress = sum(weight * progress) / total_weight", () => {
    const result = computeParentProgress(
      [
        subtask({ status: "completed", weight: 3 }),
        subtask({ status: "in_progress", progress: 50, weight: 1 }),
      ],
      "weighted",
    );
    // (3*100 + 1*50) / 4 = 87.5 → 88
    expect(result?.modeUsed).toBe("weighted");
    expect(result?.progress).toBe(88);
    expect(result?.fallbackReason).toBeNull();
  });

  it("falls back to count-based when no valid weights exist", () => {
    const result = computeParentProgress(
      [subtask({ status: "completed" }), subtask({ status: "not_started" })],
      "weighted",
    );
    expect(result?.modeUsed).toBe("count");
    expect(result?.fallbackReason).toBe("no_valid_weights");
    expect(result?.progress).toBe(50);
  });
});

describe("hours-based progress", () => {
  it("progress = sum(estimated_hours * progress) / total_estimated_hours", () => {
    const result = computeParentProgress(
      [
        subtask({ status: "completed", estimated_hours: 8 }),
        subtask({ status: "in_progress", progress: 25, estimated_hours: 8 }),
      ],
      "hours",
    );
    // (8*100 + 8*25) / 16 = 62.5 → 63
    expect(result?.modeUsed).toBe("hours");
    expect(result?.progress).toBe(63);
  });

  it("falls back hours → weighted → count", () => {
    const weighted = computeParentProgress(
      [subtask({ status: "completed", weight: 1 }), subtask({ status: "not_started", weight: 3 })],
      "hours",
    );
    expect(weighted?.modeUsed).toBe("weighted");
    expect(weighted?.fallbackReason).toBe("no_valid_estimates");
    expect(weighted?.progress).toBe(25);

    const count = computeParentProgress(
      [subtask({ status: "completed" }), subtask({ status: "not_started" })],
      "hours",
    );
    expect(count?.modeUsed).toBe("count");
    expect(count?.fallbackReason).toBe("no_valid_estimates");
  });
});

describe("cancelled subtasks", () => {
  it("are excluded from every calculation mode", () => {
    const result = computeParentProgress(
      [
        subtask({ status: "completed" }),
        subtask({ status: "cancelled", progress: 0 }),
        subtask({ status: "cancelled", progress: 0 }),
      ],
      "count",
    );
    // Only the completed one is active → 100%.
    expect(result?.progress).toBe(100);
    expect(result?.activeCount).toBe(1);
  });

  it("a task with ONLY cancelled subtasks preserves manual progress (null)", () => {
    expect(computeParentProgress([subtask({ status: "cancelled" })], "count")).toBeNull();
  });
});

describe("tasks without subtasks — existing behavior preserved", () => {
  it("returns null so callers never overwrite the manual task progress", () => {
    expect(computeParentProgress([], "auto")).toBeNull();
    expect(computeParentProgress([], "count")).toBeNull();
    expect(computeParentProgress([], "hours")).toBeNull();
  });
});

describe("auto mode", () => {
  it("prefers hours, then weighted, then count", () => {
    expect(
      computeParentProgress([subtask({ status: "completed", estimated_hours: 4 })], "auto")?.modeUsed,
    ).toBe("hours");
    expect(
      computeParentProgress([subtask({ status: "completed", weight: 2 })], "auto")?.modeUsed,
    ).toBe("weighted");
    expect(computeParentProgress([subtask({ status: "completed" })], "auto")?.modeUsed).toBe("count");
  });
});

describe("overdue detection", () => {
  it("overdue = past due date and not completed/cancelled", () => {
    expect(isSubtaskOverdue(subtask({ due_date: "2026-07-01", status: "in_progress" }), ASOF)).toBe(true);
    expect(isSubtaskOverdue(subtask({ due_date: "2026-07-10", status: "in_progress" }), ASOF)).toBe(false);
    expect(isSubtaskOverdue(subtask({ due_date: "2026-07-01", status: "completed" }), ASOF)).toBe(false);
    expect(isSubtaskOverdue(subtask({ due_date: "2026-07-01", status: "cancelled" }), ASOF)).toBe(false);
    expect(isSubtaskOverdue(subtask({ due_date: null, status: "in_progress" }), ASOF)).toBe(false);
  });
});

describe("parent signals", () => {
  it("derives blocked/overdue/critical risk + hour variance", () => {
    const signals = deriveParentSignals(
      [
        subtask({ status: "blocked", is_critical: true, estimated_hours: 4, actual_hours: 6 }),
        subtask({ status: "in_progress", due_date: "2026-07-01", estimated_hours: 4, actual_hours: 3 }),
        subtask({ status: "completed", estimated_hours: 2, actual_hours: 2 }),
        subtask({ status: "cancelled" }),
      ],
      ASOF,
    );
    expect(signals.activeCount).toBe(3);
    expect(signals.blockedCount).toBe(1);
    expect(signals.overdueCount).toBe(1);
    expect(signals.cancelledCount).toBe(1);
    expect(signals.criticalAtRisk).toBe(true); // critical + blocked
    expect(signals.canComplete).toBe(false);
    expect(signals.estimatedHours).toBe(10);
    expect(signals.actualHours).toBe(11);
    expect(signals.varianceHours).toBe(1);
  });

  it("criticalAtRisk also fires for an OVERDUE critical subtask", () => {
    const signals = deriveParentSignals(
      [subtask({ status: "in_progress", is_critical: true, due_date: "2026-07-01" })],
      ASOF,
    );
    expect(signals.criticalAtRisk).toBe(true);
  });

  it("no critical risk when critical subtasks are healthy", () => {
    const signals = deriveParentSignals(
      [subtask({ status: "in_progress", is_critical: true, due_date: "2026-08-01" })],
      ASOF,
    );
    expect(signals.criticalAtRisk).toBe(false);
  });
});

describe("parent close gate", () => {
  it("cannot close while active subtasks remain incomplete (override required)", () => {
    const gate = evaluateParentCloseGate([
      { status: "completed" },
      { status: "in_progress" },
    ]);
    expect(gate.allowed).toBe(false);
    expect(gate.requiresOverride).toBe(true);
    expect(gate.incompleteCount).toBe(1);
  });

  it("may close when every ACTIVE subtask is completed (cancelled ignored)", () => {
    const gate = evaluateParentCloseGate([
      { status: "completed" },
      { status: "cancelled" },
    ]);
    expect(gate.allowed).toBe(true);
    expect(gate.requiresOverride).toBe(false);
  });

  it("no subtasks ⇒ close allowed (existing task behavior untouched)", () => {
    expect(evaluateParentCloseGate([]).allowed).toBe(true);
  });
});
