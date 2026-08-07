// ============================================================================
// The same expression, asked of one milestone
// ============================================================================
// Guard: KPI-MILESTONE-DIMENSION
//
// The KPI engine was project-wide by construction: `SUM(actual_hours)` read an
// array of EVERY task, so "how many hours went into Preparación?" could not be
// written down at all.
//
// The property being protected is that there is still only ONE engine. A
// per-milestone dataset is the same shape as the project dataset, so every
// expression that already worked keeps working in the narrower scope — no
// second evaluator, no second set of semantics to drift apart (REG-010).
//
// And the cost variables must never turn absence into a number: a project
// where nothing has a rate answers "not computable", never "$0".
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildKpiDataset, buildMilestoneDatasets, taskCost, type KpiTaskRow, type KpiMilestoneRow } from "../build-dataset";
import { evaluateKpi } from "../evaluate";
import { KPI_CATALOG } from "../catalog";

const NOW = "2026-08-06T00:00:00.000Z";

function task(over: Partial<KpiTaskRow> = {}): KpiTaskRow {
  return {
    id: `t${Math.random().toString(36).slice(2)}`,
    milestone_id: "m1",
    status: "not_started",
    is_blocked: false,
    is_critical: false,
    assigned_to: null,
    assigned_resource_id: null,
    estimate_hours: null,
    actual_hours: null,
    progress: null,
    duration_days: null,
    end_date: null,
    completed_at: null,
    ...over,
  };
}

function milestone(id: string, over: Partial<KpiMilestoneRow> = {}): KpiMilestoneRow {
  return { id, status: "planned", target_date: null, completed_date: null, ...over };
}

describe("the milestone dimension", () => {
  const tasks = [
    task({ milestone_id: "m1", actual_hours: 100 }),
    task({ milestone_id: "m1", actual_hours: 50 }),
    task({ milestone_id: "m2", actual_hours: 999 }),
    task({ milestone_id: null, actual_hours: 7 }), // unassigned to any phase
  ];
  const milestones = [milestone("m1"), milestone("m2")];

  it("answers the SAME expression per milestone", () => {
    const scopes = buildMilestoneDatasets(tasks, milestones, NOW);
    const hours = (id: string) => {
      const scope = scopes.find((s) => s.milestoneId === id)!;
      const result = evaluateKpi({ expression: "SUM(actual_hours)" }, scope.dataset);
      return result.status === "ok" ? result.value : null;
    };
    expect(hours("m1")).toBe(150);
    expect(hours("m2")).toBe(999);
  });

  it("still answers it for the whole project", () => {
    const all = buildKpiDataset(tasks, milestones, NOW);
    const result = evaluateKpi({ expression: "SUM(actual_hours)" }, all);
    expect(result.status === "ok" && result.value).toBe(1156); // 100+50+999+7
  });

  it("gives a milestone only its OWN row in the milestone-level arrays", () => {
    // Otherwise "was this phase late?" would answer for every phase at once.
    const withDates = [
      milestone("m1", { target_date: "2026-01-10", completed_date: "2026-01-20" }), // 10 late
      milestone("m2", { target_date: "2026-01-10", completed_date: "2026-01-05" }), // 5 early
    ];
    const scopes = buildMilestoneDatasets(tasks, withDates, NOW);
    const delay = (id: string) => {
      const scope = scopes.find((s) => s.milestoneId === id)!;
      const r = evaluateKpi({ expression: "SUM(milestone_delay_days)" }, scope.dataset);
      return r.status === "ok" ? r.value : null;
    };
    expect(delay("m1")).toBe(10);
    expect(delay("m2")).toBe(-5);
  });

  it("keeps a milestone with no tasks, so it can say so", () => {
    // Dropping it would make a card render nothing, which looks like a bug.
    // An empty dataset makes the engine answer "not computable" — a real
    // answer, and the difference between "no data" and "no result".
    const scopes = buildMilestoneDatasets(tasks, [...milestones, milestone("gate")], NOW);
    const gate = scopes.find((s) => s.milestoneId === "gate")!;
    expect(gate.taskCount).toBe(0);
    const r = evaluateKpi({ expression: "AVG(actual_hours)" }, gate.dataset);
    expect(r.status).toBe("not_computable");
  });

  it("does not leak a task with no milestone into any scope", () => {
    const scopes = buildMilestoneDatasets(tasks, milestones, NOW);
    expect(scopes.reduce((n, s) => n + s.taskCount, 0)).toBe(3); // not 4
  });

  it("reports how many tasks a scope holds", () => {
    const scopes = buildMilestoneDatasets(tasks, milestones, NOW);
    expect(scopes.find((s) => s.milestoneId === "m1")!.taskCount).toBe(2);
  });
});

describe("cost", () => {
  const rates = new Map([
    ["architect", 150],
    ["junior", 50],
  ]);

  it("prices a task at the rate of the resource doing it", () => {
    expect(taskCost(task({ actual_hours: 10, assigned_resource_id: "architect" }), rates)).toBe(1500);
    expect(taskCost(task({ actual_hours: 10, assigned_resource_id: "junior" }), rates)).toBe(500);
  });

  it("uses the estimate before any hours are logged", () => {
    expect(taskCost(task({ estimate_hours: 8, assigned_resource_id: "junior" }), rates)).toBe(400);
  });

  it("prefers logged hours once they exist", () => {
    expect(
      taskCost(task({ estimate_hours: 8, actual_hours: 2, assigned_resource_id: "junior" }), rates),
    ).toBe(100);
  });

  it("has no value for a task it cannot price", () => {
    expect(taskCost(task({ actual_hours: 10, assigned_resource_id: "unknown" }), rates)).toBeNaN();
    expect(taskCost(task({ actual_hours: 10 }), rates)).toBeNaN();
  });

  it("sums the part it knows instead of poisoning the whole figure", () => {
    // Half a project priced should still answer for that half.
    const ds = buildKpiDataset(
      [
        task({ actual_hours: 10, assigned_resource_id: "architect" }),
        task({ actual_hours: 10, assigned_resource_id: "nobody" }),
      ],
      [milestone("m1")],
      NOW,
      { rateByResource: rates },
    );
    const r = evaluateKpi({ expression: "SUM(task_cost)" }, ds);
    expect(r.status === "ok" && r.value).toBe(1500);
  });

  it("says what fraction of the scope that figure actually covers", () => {
    const ds = buildKpiDataset(
      [
        task({ actual_hours: 10, assigned_resource_id: "architect" }),
        task({ actual_hours: 10, assigned_resource_id: "nobody" }),
      ],
      [milestone("m1")],
      NOW,
      { rateByResource: rates },
    );
    const r = evaluateKpi({ kpiSlug: "cost_coverage_pct" }, ds);
    expect(r.status === "ok" && r.value).toBe(50);
  });

  it("refuses to report a cost of zero when NOTHING can be priced", () => {
    // The trap this guards: SUM over an empty set is 0, and "$0" on a phase
    // that consumed 332 hours reads as "this was free".
    const ds = buildKpiDataset(
      [task({ actual_hours: 332, assigned_resource_id: "nobody" })],
      [milestone("m1")],
      NOW,
      { rateByResource: rates },
    );
    expect(evaluateKpi({ kpiSlug: "labour_cost" }, ds).status).toBe("not_computable");
    // …and the unguarded form is exactly the trap, which is why the catalog
    // KPI carries the guard rather than leaving it to whoever writes one.
    const naive = evaluateKpi({ expression: "SUM(task_cost)" }, ds);
    expect(naive.status === "ok" && naive.value).toBe(0);
  });

  it("gives each milestone its own budget, and nothing to one without a line", () => {
    const budgets = new Map([["m1", 210300]]);
    const scopes = buildMilestoneDatasets(
      [task({ milestone_id: "m1" }), task({ milestone_id: "m2" })],
      [milestone("m1"), milestone("m2")],
      NOW,
      { budgetByMilestone: budgets },
    );
    const budget = (id: string) =>
      evaluateKpi({ kpiSlug: "budget_amount" }, scopes.find((s) => s.milestoneId === id)!.dataset);
    const m1 = budget("m1");
    expect(m1.status === "ok" && m1.value).toBe(210300);
    // A gate with no budget line did not cost nothing — it is unknown.
    expect(budget("m2").status).toBe("not_computable");
  });

  it("computes budget consumption per milestone", () => {
    const scopes = buildMilestoneDatasets(
      [
        task({ milestone_id: "m1", actual_hours: 10, assigned_resource_id: "architect" }), // 1500
        task({ milestone_id: "m2", actual_hours: 10, assigned_resource_id: "junior" }), // 500
      ],
      [milestone("m1"), milestone("m2")],
      NOW,
      { rateByResource: rates, budgetByMilestone: new Map([["m1", 3000], ["m2", 1000]]) },
    );
    const pct = (id: string) => {
      const r = evaluateKpi({ kpiSlug: "budget_consumed_pct" }, scopes.find((s) => s.milestoneId === id)!.dataset);
      return r.status === "ok" ? r.value : null;
    };
    expect(pct("m1")).toBe(50);
    expect(pct("m2")).toBe(50);
  });
});

describe("one engine, not two", () => {
  it("evaluates every built-in KPI against a milestone scope without special-casing", () => {
    // If a catalog KPI could not run in a milestone scope, the two scopes
    // would have drifted into different semantics — the failure REG-010 exists
    // to prevent.
    const scopes = buildMilestoneDatasets(
      [task({ milestone_id: "m1", actual_hours: 10, estimate_hours: 8, status: "completed", completed_at: NOW })],
      [milestone("m1")],
      NOW,
    );
    const ds = scopes[0].dataset;
    for (const definition of KPI_CATALOG) {
      const r = evaluateKpi({ kpiSlug: definition.slug }, ds);
      // "invalid" would mean the expression itself is broken; not_computable
      // is a legitimate answer for a scope that lacks the data.
      expect(r.status, `${definition.slug}: ${r.status === "invalid" ? r.error : ""}`).not.toBe("invalid");
    }
  });
});
