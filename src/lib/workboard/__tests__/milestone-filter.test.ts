// ============================================================================
// The Workboard filter must show the whole plan, not the worked part of it
// ============================================================================
// Guard: WORKBOARD-MILESTONE-FILTER-COMPLETE
//
// The filter listed only milestones that already had tasks. On the SAP plan
// that drew 5 chips for 16 milestones, and the eleven it dropped were the
// Q-Gates and sign-offs.
//
// The failure is circular and self-concealing: an empty milestone is hidden →
// it cannot be selected → no task can be added to it from the board → it stays
// empty → it stays hidden. And a board showing 5 of 16 phases reads as a
// project that HAS 5 phases.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  milestoneFilterOptions,
  isEmptyByMilestoneFilter,
  type MilestoneLike,
  type TaskLike,
} from "../milestone-filter";

// The real shape: five worked phases, eleven gates and sign-offs with no tasks.
const AURORA: MilestoneLike[] = [
  { id: "prep", title: "Preparación" },
  { id: "gate1", title: "Ejecución de Q-Gate" },
  { id: "expl", title: "Exploración" },
  { id: "gate2", title: "Ejecución de Q-Gate — Exploración" },
  { id: "real", title: "Realización" },
];
const AURORA_TASKS: TaskLike[] = [
  ...Array.from({ length: 53 }, () => ({ milestone_id: "prep" })),
  ...Array.from({ length: 94 }, () => ({ milestone_id: "expl" })),
  ...Array.from({ length: 76 }, () => ({ milestone_id: "real" })),
  { milestone_id: null }, // an unassigned task
];

describe("the list is complete", () => {
  it("includes a milestone that has no tasks yet", () => {
    // THE regression: gates were absent, so the plan looked shorter than it is.
    const options = milestoneFilterOptions(AURORA, AURORA_TASKS);
    expect(options).toHaveLength(5);
    expect(options.map((o) => o.id)).toContain("gate1");
    expect(options.map((o) => o.id)).toContain("gate2");
  });

  it("keeps plan order, not task-count order", () => {
    // The chips read in the order the work happens; a gate sits between the
    // phases it gates, which is the only order that means anything.
    expect(milestoneFilterOptions(AURORA, AURORA_TASKS).map((o) => o.id)).toEqual([
      "prep", "gate1", "expl", "gate2", "real",
    ]);
  });

  it("counts the tasks under each", () => {
    const byId = new Map(milestoneFilterOptions(AURORA, AURORA_TASKS).map((o) => [o.id, o.taskCount]));
    expect(byId.get("prep")).toBe(53);
    expect(byId.get("expl")).toBe(94);
    expect(byId.get("real")).toBe(76);
  });

  it("shows a zero rather than omitting it", () => {
    // Zero is the information. Hiding it is what caused this.
    const gate = milestoneFilterOptions(AURORA, AURORA_TASKS).find((o) => o.id === "gate1")!;
    expect(gate.taskCount).toBe(0);
  });

  it("does not attribute an unassigned task to any milestone", () => {
    const total = milestoneFilterOptions(AURORA, AURORA_TASKS).reduce((n, o) => n + o.taskCount, 0);
    expect(total).toBe(223); // 53 + 94 + 76, not 224
  });

  it("lists every milestone even when nothing has been planned at all", () => {
    const options = milestoneFilterOptions(AURORA, []);
    expect(options).toHaveLength(5);
    expect(options.every((o) => o.taskCount === 0)).toBe(true);
  });

  it("survives a project with no milestones", () => {
    expect(milestoneFilterOptions([], AURORA_TASKS)).toEqual([]);
  });

  it("ignores a task pointing at a milestone that no longer exists", () => {
    const options = milestoneFilterOptions(AURORA, [{ milestone_id: "deleted" }]);
    expect(options.every((o) => o.taskCount === 0)).toBe(true);
  });
});

describe("an empty board explains itself", () => {
  const options = milestoneFilterOptions(AURORA, AURORA_TASKS);

  it("knows the board is empty because THIS milestone has no tasks", () => {
    // Without this the same screen looks like a broken board rather than an
    // invitation to add the first task.
    expect(isEmptyByMilestoneFilter(options, "gate1")).toBe(true);
  });

  it("says nothing when the selected milestone does have tasks", () => {
    expect(isEmptyByMilestoneFilter(options, "prep")).toBe(false);
  });

  it("says nothing when no milestone is selected", () => {
    expect(isEmptyByMilestoneFilter(options, null)).toBe(false);
  });

  it("says nothing for a selection that is not a milestone at all", () => {
    // The "no milestone" chip uses a sentinel value, not a milestone id.
    expect(isEmptyByMilestoneFilter(options, "__none__")).toBe(false);
  });
});
