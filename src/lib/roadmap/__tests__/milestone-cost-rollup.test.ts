// ============================================================================
// What a milestone cost — and what the product must refuse to invent
// ============================================================================
// Guard: MILESTONE-COST-ROLLUP
//
// "How much did this phase cost me?" had no answer anywhere: tasks carried
// hours and a milestone_id, budget lines carried money, and nothing added them
// up per milestone.
//
// The property that matters as much as the arithmetic: a figure the data
// cannot support is NULL, never 0. A confident zero on an executive card is
// worse than an honest "not available" — it reads as "this phase was free".
// ============================================================================

import { describe, it, expect } from "vitest";
import { computeMilestoneCostRollup, computeMilestoneCostRollups } from "../milestone-cost-rollup";
import type { Milestone, RoadmapTask } from "@/types/database";

const PROJECT = "11111111-1111-4111-8111-111111111111";

function task(overrides: Partial<RoadmapTask>): RoadmapTask {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    project_id: PROJECT,
    milestone_id: "m1",
    title: "Task",
    status: "not_started",
    estimate_hours: null,
    actual_hours: null,
    start_date: null,
    end_date: null,
    deleted_at: null,
    ...overrides,
  } as RoadmapTask;
}

function milestone(title: string, id = "m1"): Milestone {
  return { id, project_id: PROJECT, title, status: "planned" } as Milestone;
}

describe("effort", () => {
  it("adds the hours of its own tasks only", () => {
    const tasks = [
      task({ milestone_id: "m1", estimate_hours: 100, actual_hours: 40 }),
      task({ milestone_id: "m1", estimate_hours: 50, actual_hours: 10 }),
      task({ milestone_id: "other", estimate_hours: 999, actual_hours: 999 }),
    ];
    const r = computeMilestoneCostRollup(milestone("Preparación"), tasks);
    expect(r.estimatedHours).toBe(150);
    expect(r.actualHours).toBe(50);
    expect(r.varianceHours).toBe(-100); // came in under the estimate
  });

  it("reports an overrun as a positive variance", () => {
    const tasks = [task({ estimate_hours: 10, actual_hours: 25 })];
    expect(computeMilestoneCostRollup(milestone("X"), tasks).varianceHours).toBe(15);
  });

  it("ignores deleted tasks", () => {
    const tasks = [
      task({ estimate_hours: 10 }),
      task({ estimate_hours: 999, deleted_at: "2026-01-01" }),
    ];
    expect(computeMilestoneCostRollup(milestone("X"), tasks).estimatedHours).toBe(10);
  });
});

describe("time", () => {
  it("spans from the earliest start to the latest end", () => {
    const tasks = [
      task({ start_date: "2026-01-12", end_date: "2026-02-24" }),
      task({ start_date: "2026-02-01", end_date: "2026-03-06" }),
    ];
    // 12 Jan → 6 Mar inclusive
    expect(computeMilestoneCostRollup(milestone("X"), tasks).plannedDurationDays).toBe(54);
  });

  it("returns null when nothing is scheduled", () => {
    expect(computeMilestoneCostRollup(milestone("X"), [task({})]).plannedDurationDays).toBeNull();
  });
});

describe("money", () => {
  const budgetLines = [
    { name: "Preparación", estimated_cost: 210300, actual_cost: 0 },
    { name: "Exploración", estimated_cost: 521000, actual_cost: 0 },
  ];

  it("matches the budget line that names this milestone", () => {
    // The real case: an imported plan has no foreign key between a phase and
    // its budget line — they share a name.
    const r = computeMilestoneCostRollup(milestone("Preparación"), [], budgetLines);
    expect(r.budget).toBe(210300);
  });

  it("matches regardless of accents and case", () => {
    const r = computeMilestoneCostRollup(milestone("EXPLORACION"), [], budgetLines);
    expect(r.budget).toBe(521000);
  });

  it("prefers the foreign key over the name when a line is properly linked", () => {
    // budget_items HAS a milestone_id; nothing populates it yet. The day
    // something does, the name must stop being the deciding factor.
    const lines = [
      { name: "Preparación", estimated_cost: 210300, actual_cost: 0 },
      { name: "Anything at all", estimated_cost: 999, actual_cost: 0, milestone_id: "m1" },
    ];
    expect(computeMilestoneCostRollup(milestone("Preparación", "m1"), [], lines).budget).toBe(999);
  });

  it("does not count a line twice when it is both linked and named alike", () => {
    const lines = [{ name: "Preparación", estimated_cost: 210300, actual_cost: 0, milestone_id: "m1" }];
    expect(computeMilestoneCostRollup(milestone("Preparación", "m1"), [], lines).budget).toBe(210300);
  });

  it("says NOTHING rather than zero when no line names it", () => {
    // A gate has no budget of its own. "0" would read as "this cost nothing".
    const r = computeMilestoneCostRollup(milestone("Ejecución de Q-Gate"), [], budgetLines);
    expect(r.budget).toBeNull();
  });

  it("refuses to turn hours into money without a rate", () => {
    const tasks = [task({ actual_hours: 100 })];
    const r = computeMilestoneCostRollup(milestone("Preparación"), tasks, budgetLines);
    expect(r.actualHours).toBe(100);
    // No rate exists in the data; a default would be a fabricated number.
    expect(r.labourCost).toBeNull();
    expect(r.tasksWithoutRate).toBe(1);
  });

  it("prices each task at the rate of the resource doing it", () => {
    // The real chain: task has hours → task has an assigned resource → that
    // resource has a rate. One blended rate would flatten exactly the
    // difference between an architect and a junior.
    const tasks = [
      task({ actual_hours: 10, assigned_resource_id: "architect" }),
      task({ actual_hours: 10, assigned_resource_id: "junior" }),
    ];
    const rates = [
      { id: "architect", cost_rate: 150, cost_unit: "hour" },
      { id: "junior", cost_rate: 50, cost_unit: "hour" },
    ];
    const r = computeMilestoneCostRollup(milestone("X"), tasks, [], [], null, rates);
    expect(r.labourCost).toBe(2000); // 10×150 + 10×50, not 20×(blended)
    expect(r.tasksWithoutRate).toBe(0);
  });

  it("costs a plan before any work is logged, using estimates", () => {
    const tasks = [task({ estimate_hours: 40, actual_hours: null, assigned_resource_id: "pm" })];
    const rates = [{ id: "pm", cost_rate: 100, cost_unit: "hour" }];
    expect(computeMilestoneCostRollup(milestone("X"), tasks, [], [], null, rates).labourCost).toBe(4000);
  });

  it("prefers logged hours over the estimate once they exist", () => {
    const tasks = [task({ estimate_hours: 40, actual_hours: 10, assigned_resource_id: "pm" })];
    const rates = [{ id: "pm", cost_rate: 100, cost_unit: "hour" }];
    expect(computeMilestoneCostRollup(milestone("X"), tasks, [], [], null, rates).labourCost).toBe(1000);
  });

  it("reports how many tasks it could not price", () => {
    // A partial figure must never look like a total.
    const tasks = [
      task({ actual_hours: 10, assigned_resource_id: "priced" }),
      task({ actual_hours: 10, assigned_resource_id: "unpriced" }),
      task({ actual_hours: 10, assigned_resource_id: null }),
    ];
    const rates = [{ id: "priced", cost_rate: 100, cost_unit: "hour" }];
    const r = computeMilestoneCostRollup(milestone("X"), tasks, [], [], null, rates);
    expect(r.labourCost).toBe(1000);
    expect(r.tasksWithoutRate).toBe(2);
  });

  it("ignores a rate that is not per hour", () => {
    // A daily rate cannot price hours without knowing the working day.
    const tasks = [task({ actual_hours: 10, assigned_resource_id: "daily" })];
    const rates = [{ id: "daily", cost_rate: 800, cost_unit: "day" }];
    expect(computeMilestoneCostRollup(milestone("X"), tasks, [], [], null, rates).labourCost).toBeNull();
  });

  it("still accepts a blended rate for whoever wants one", () => {
    const tasks = [task({ actual_hours: 100 })];
    const r = computeMilestoneCostRollup(milestone("X"), tasks, [], [], 75);
    expect(r.labourCost).toBe(7500);
  });

  it("counts only materials required by its own tasks", () => {
    const mine = task({ id: "mine", milestone_id: "m1" });
    const theirs = task({ id: "theirs", milestone_id: "other" });
    const materials = [
      { required_by_task_id: "mine", estimated_total_cost: 1200 },
      { required_by_task_id: "theirs", estimated_total_cost: 9999 },
    ];
    const r = computeMilestoneCostRollup(milestone("X"), [mine, theirs], [], materials);
    expect(r.materialCost).toBe(1200);
  });

  it("totals only what is known, and stays null when nothing is", () => {
    const withBudget = computeMilestoneCostRollup(milestone("Preparación"), [], budgetLines);
    expect(withBudget.totalCost).toBe(210300);

    const knowsNothing = computeMilestoneCostRollup(milestone("Sin presupuesto"), [task({})]);
    expect(knowsNothing.totalCost).toBeNull();
    expect(knowsNothing.materialCost).toBeNull();
    expect(knowsNothing.labourCost).toBeNull();
  });
});

describe("computeMilestoneCostRollups", () => {
  it("rolls up every milestone in one pass", () => {
    const milestones = [milestone("Preparación", "m1"), milestone("Exploración", "m2")];
    const tasks = [
      task({ milestone_id: "m1", estimate_hours: 10 }),
      task({ milestone_id: "m2", estimate_hours: 20 }),
    ];
    const rollups = computeMilestoneCostRollups(milestones, tasks, [
      { name: "Preparación", estimated_cost: 210300, actual_cost: 0 },
    ]);
    expect(rollups.get("m1")!.estimatedHours).toBe(10);
    expect(rollups.get("m1")!.budget).toBe(210300);
    expect(rollups.get("m2")!.estimatedHours).toBe(20);
    expect(rollups.get("m2")!.budget).toBeNull();
  });
});
