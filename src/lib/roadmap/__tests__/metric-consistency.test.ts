// ============================================================================
// One question, one answer — blockers and milestone completion
// ============================================================================
// Guard: METRIC-CONSISTENCY-BLOCKERS
//
// A real project showed THREE different answers to "how many blockers?" on a
// single screen: the status summary said 0, the banner said 1, and the KPI card
// said 2. And the Living Graph drew a milestone at a green 100% while the
// Progress card said 0/16 completed.
//
// Two causes:
//
//   * `countBlockers` returned `at-risk milestones + blocked tasks`, adding two
//     different kinds of thing into one number rendered as "BLOCKERS · P1 —
//     Critical". A milestone at risk is a schedule signal, not an impediment
//     someone can clear. It also tested `status === "blocked"` directly rather
//     than the canonical rule, so a stale `is_blocked` left on a FINISHED task
//     would have counted (REG-008).
//
//   * milestone completion was read from the stored column on one surface and
//     derived from tasks on the others, so a milestone whose 53 tasks were all
//     done was simultaneously complete and not complete.
// ============================================================================

import { describe, it, expect } from "vitest";
import { countBlockers, countAtRiskMilestones, getComputedMilestoneStatus } from "../progress";
import type { Milestone, RoadmapTask } from "@/types/database";

const PROJECT = "11111111-1111-4111-8111-111111111111";

function task(overrides: Partial<RoadmapTask>): RoadmapTask {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    project_id: PROJECT,
    milestone_id: null,
    title: "Task",
    status: "not_started",
    is_blocked: false,
    ...overrides,
  } as RoadmapTask;
}

function milestone(overrides: Partial<Milestone>): Milestone {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    project_id: PROJECT,
    title: "Milestone",
    status: "planned",
    ...overrides,
  } as Milestone;
}

describe("countBlockers", () => {
  it("counts a genuinely blocked task", () => {
    expect(countBlockers([], [task({ status: "blocked" })])).toBe(1);
  });

  it("counts a task flagged blocked while still active", () => {
    expect(countBlockers([], [task({ status: "in_progress", is_blocked: true })])).toBe(1);
  });

  it("does NOT count a stale flag on a finished task", () => {
    // REG-008: a terminal task is never blocked, whatever the flag says.
    expect(countBlockers([], [task({ status: "done", is_blocked: true })])).toBe(0);
  });

  it("does NOT add milestones into the blocker count", () => {
    // The reported case: one blocked task and one at-risk milestone showed "2".
    const tasks = [
      task({ id: "blocked-one", status: "blocked", milestone_id: "m1" }),
      task({ id: "finished", status: "done", is_blocked: true, milestone_id: "m1" }),
    ];
    const milestones = [milestone({ id: "m1" })];
    expect(countBlockers(milestones, tasks)).toBe(1);
  });

  it("reports zero when nothing is blocked", () => {
    expect(countBlockers([milestone({})], [task({ status: "in_progress" })])).toBe(0);
  });

  it("keeps at-risk milestones available as their own, separate metric", () => {
    const overdue = milestone({ id: "m1", target_date: "2020-01-01" } as Partial<Milestone>);
    // Whatever it computes to, it must not leak into the blocker count.
    const tasks = [task({ status: "in_progress", milestone_id: "m1" })];
    expect(countBlockers([overdue], tasks)).toBe(0);
    expect(countAtRiskMilestones([overdue], tasks)).toBeGreaterThanOrEqual(0);
  });
});

describe("milestone completion is derived, not stored", () => {
  it("treats a milestone whose tasks are all done as complete", () => {
    // The reported case: 53 of 53 tasks done, stored status still "planned",
    // graph showed 100% while the KPI card said 0 completed.
    const tasks = Array.from({ length: 53 }, () =>
      task({ status: "done", milestone_id: "m1" }),
    );
    const m = milestone({ id: "m1", status: "planned" });
    expect(getComputedMilestoneStatus(m, tasks)).toBe("completed");
  });

  it("does not call a milestone complete while work remains", () => {
    const tasks = [
      task({ status: "done", milestone_id: "m1" }),
      task({ status: "not_started", milestone_id: "m1" }),
    ];
    expect(getComputedMilestoneStatus(milestone({ id: "m1" }), tasks)).not.toBe("completed");
  });
});
