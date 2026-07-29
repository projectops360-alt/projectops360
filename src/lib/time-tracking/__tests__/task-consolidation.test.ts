import { describe, it, expect } from "vitest";

// ============================================================================
// Time Tracking Engine — task-level consolidation
// ============================================================================
// Guard TIME-TRACKING-TASK-ROLLUP: a task's actual hours are SUM(duration_hours)
// over every entry carrying its task_id — the ones logged directly on it AND the
// ones logged on its subtasks, each counted exactly ONCE.
//
// This is the regression these tests exist for: the engine used to refresh the
// subtask cache and stop there, so a task with 11h logged across its subtasks
// reported 0h to the task detail, the report and the PM dashboard, and the
// "remaining hours" card read the untouched plan back to the PM forever.
//
// The estimate side carries the matching rule: a task with subtasks is estimated
// BY those subtasks, never by adding its own number on top of them.
// ============================================================================

import { computeTaskEffort, PORTFOLIO_THRESHOLDS, TASK_THRESHOLDS } from "../effort";
import { authorizeTimeEntryAction } from "../permissions";

/** Shorthand for a batch of logged entries. */
const hours = (...values: number[]) => values.map((duration_hours) => ({ duration_hours }));

/** Shorthand for subtasks with estimates. */
const subtasks = (...estimates: (number | null)[]) =>
  estimates.map((estimatedHours) => ({ estimatedHours }));

describe("1 — task with no subtasks, hours logged directly on it", () => {
  it("reports its own estimate and its own logged time", () => {
    const effort = computeTaskEffort({
      taskEstimatedHours: 10,
      subtasks: [],
      entries: hours(4),
    });
    expect(effort.estimatedHours).toBe(10);
    expect(effort.actualHours).toBe(4);
    expect(effort.remainingHours).toBe(6);
    expect(effort.varianceHours).toBe(-6);
    expect(effort.consumedPct).toBe(40);
  });
});

describe("2 — task with one subtask", () => {
  it("takes the estimate from the subtask and the hours from its log", () => {
    const effort = computeTaskEffort({
      taskEstimatedHours: 999,
      subtasks: subtasks(20),
      entries: hours(6),
    });
    expect(effort.estimatedHours).toBe(20);
    expect(effort.actualHours).toBe(6);
    expect(effort.remainingHours).toBe(14);
  });
});

describe("3 — task with several subtasks", () => {
  it("consolidates every subtask's estimate and every subtask's hours", () => {
    // Task B from the brief: B1 20h/6h + B2 30h/9h → 50h estimated, 15h actual.
    const effort = computeTaskEffort({
      taskEstimatedHours: null,
      subtasks: subtasks(20, 30),
      entries: hours(6, 9),
    });
    expect(effort.estimatedHours).toBe(50);
    expect(effort.actualHours).toBe(15);
    expect(effort.remainingHours).toBe(35);
    expect(effort.varianceHours).toBe(-35);
    expect(effort.consumedPct).toBe(30);
  });

  it("ignores cancelled subtasks in the plan", () => {
    const effort = computeTaskEffort({
      taskEstimatedHours: null,
      subtasks: [
        { estimatedHours: 20 },
        { estimatedHours: 30, status: "cancelled" },
      ],
      entries: [],
    });
    expect(effort.estimatedHours).toBe(20);
  });
});

describe("4 — task with BOTH direct hours and subtask hours", () => {
  it("adds them once each, because both kinds of entry carry the task id", () => {
    // 2h logged on the task itself + 6h and 9h on two subtasks = 17h.
    const effort = computeTaskEffort({
      taskEstimatedHours: null,
      subtasks: subtasks(20, 30),
      entries: hours(2, 6, 9),
    });
    expect(effort.actualHours).toBe(17);
    expect(effort.estimatedHours).toBe(50);
  });
});

describe("5 & 6 — editing and deleting entries", () => {
  it("an edited duration changes the total, it does not add to it", () => {
    const before = computeTaskEffort({ taskEstimatedHours: 10, subtasks: [], entries: hours(4) });
    // The 4h entry is corrected to 6h — the total is 6h, not 10h.
    const after = computeTaskEffort({ taskEstimatedHours: 10, subtasks: [], entries: hours(6) });
    expect(before.actualHours).toBe(4);
    expect(after.actualHours).toBe(6);
  });

  it("a deleted entry leaves the total behind", () => {
    // Soft-deleted rows are filtered out before they ever reach this function.
    const after = computeTaskEffort({ taskEstimatedHours: 10, subtasks: [], entries: hours(4) });
    expect(after.actualHours).toBe(4);
    const allDeleted = computeTaskEffort({ taskEstimatedHours: 10, subtasks: [], entries: [] });
    expect(allDeleted.actualHours).toBe(0);
    expect(allDeleted.remainingHours).toBe(10);
  });
});

describe("7 — a manager logging hours for someone else", () => {
  const pm = { role: "admin" as const, userId: "pm", action: "log" as const };
  const contributor = { role: "member" as const, userId: "worker", action: "log" as const };

  it("lets a manager attribute effort to another person", () => {
    expect(authorizeTimeEntryAction({ ...pm, targetUserId: "worker" }).allowed).toBe(true);
  });

  it("still refuses a contributor logging in someone else's name", () => {
    const decision = authorizeTimeEntryAction({
      ...contributor,
      taskAssignedTo: "worker",
      targetUserId: "someone-else",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("cannot_log_for_others");
  });

  it("lets the task's assignee log their own hours on the task", () => {
    // Task-level logging leans on taskAssignedTo, since a task has no subtask owner.
    expect(
      authorizeTimeEntryAction({ ...contributor, taskAssignedTo: "worker", targetUserId: "worker" })
        .allowed,
    ).toBe(true);
  });

  it("refuses somebody with no responsibility for the work", () => {
    expect(
      authorizeTimeEntryAction({ ...contributor, taskAssignedTo: "another-person" }).allowed,
    ).toBe(false);
  });

  it("keeps deletion a manager-only action", () => {
    expect(
      authorizeTimeEntryAction({ role: "member", userId: "worker", action: "delete", entryCreatedBy: "worker" })
        .allowed,
    ).toBe(false);
    expect(
      authorizeTimeEntryAction({ role: "admin", userId: "pm", action: "delete" }).allowed,
    ).toBe(true);
  });
});

describe("8 — a project with several tasks", () => {
  // The project total is the sum of the per-task consolidations, using the SAME
  // function, which is what keeps task / report / dashboard in agreement.
  const taskA = computeTaskEffort({ taskEstimatedHours: 10, subtasks: [], entries: hours(4) });
  const taskB = computeTaskEffort({
    taskEstimatedHours: null,
    subtasks: subtasks(20, 30),
    entries: hours(6, 9),
  });

  it("matches the worked example in the brief", () => {
    const estimated = (taskA.estimatedHours ?? 0) + (taskB.estimatedHours ?? 0);
    const actual = taskA.actualHours + taskB.actualHours;
    expect(estimated).toBe(60);
    expect(actual).toBe(19);

    const project = computeTaskEffort(
      { taskEstimatedHours: estimated, subtasks: [], entries: hours(actual) },
      PORTFOLIO_THRESHOLDS,
    );
    expect(project.remainingHours).toBe(41);
    expect(project.varianceHours).toBe(-41);
    expect(project.consumedPct).toBe(31.7); // 19/60 = 31.67%, shown to one decimal
    expect(project.severity).toBe("on_track");
  });
});

describe("9 — a task with zero estimated hours", () => {
  it("does not divide by zero and does not invent a percentage", () => {
    const effort = computeTaskEffort({ taskEstimatedHours: 0, subtasks: [], entries: hours(5) });
    expect(effort.estimatedHours).toBeNull();
    expect(effort.actualHours).toBe(5);
    expect(effort.consumedPct).toBeNull();
    expect(effort.remainingHours).toBeNull();
    expect(effort.varianceHours).toBeNull();
    expect(effort.severity).toBe("none");
  });

  it("reports logged hours even with no plan at all", () => {
    const effort = computeTaskEffort({ taskEstimatedHours: null, subtasks: [], entries: hours(3, 2.5) });
    expect(effort.actualHours).toBe(5.5);
  });
});

describe("10 — actual hours above the estimate", () => {
  it("floors remaining at zero and puts the overrun in the variance", () => {
    const effort = computeTaskEffort({ taskEstimatedHours: 10, subtasks: [], entries: hours(13) });
    expect(effort.remainingHours).toBe(0);
    expect(effort.varianceHours).toBe(3);
    expect(effort.consumedPct).toBe(130);
    expect(effort.severity).toBe("critical");
  });

  it("warns before the budget is gone, while the work is still in flight", () => {
    const effort = computeTaskEffort(
      { taskEstimatedHours: 10, subtasks: [], entries: hours(9.5) },
      TASK_THRESHOLDS,
    );
    expect(effort.consumedPct).toBe(95);
    expect(effort.severity).toBe("warning");
    expect(effort.remainingHours).toBe(0.5);
  });
});

describe("11 — no double counting", () => {
  it("never adds the task estimate on top of its subtasks' estimates", () => {
    const effort = computeTaskEffort({
      taskEstimatedHours: 50,
      subtasks: subtasks(20, 30),
      entries: [],
    });
    expect(effort.estimatedHours).toBe(50);
    expect(effort.estimatedHours).not.toBe(100);
  });

  it("counts one entry once, no matter which level it was filed under", () => {
    // Three entries, one on the task and two on subtasks. A "task hours +
    // subtask hours" implementation would report 17 + 15 = 32 here.
    const effort = computeTaskEffort({
      taskEstimatedHours: null,
      subtasks: subtasks(20, 30),
      entries: hours(2, 6, 9),
    });
    expect(effort.actualHours).toBe(17);
    expect(effort.actualHours).not.toBe(32);
  });

  it("keeps decimal hours exact instead of drifting on repeated addition", () => {
    const effort = computeTaskEffort({
      taskEstimatedHours: 10,
      subtasks: [],
      entries: hours(1.25, 1.5, 2.75, 0.1, 0.2),
    });
    expect(effort.actualHours).toBe(5.8);
  });
});

describe("14 — one number, read the same everywhere", () => {
  it("gives the modal, the report and the dashboard identical figures", () => {
    // Every surface calls THIS function with the same rows, so agreement is
    // structural rather than something three code paths have to remember.
    const input = {
      taskEstimatedHours: 999,
      subtasks: subtasks(20, 30),
      entries: hours(2, 6, 9),
    };
    const fromModal = computeTaskEffort(input);
    const fromReport = computeTaskEffort(input);
    const fromDashboard = computeTaskEffort(input);
    expect(fromModal).toEqual(fromReport);
    expect(fromReport).toEqual(fromDashboard);
    expect(fromModal.actualHours).toBe(17);
    expect(fromModal.estimatedHours).toBe(50);
  });
});
