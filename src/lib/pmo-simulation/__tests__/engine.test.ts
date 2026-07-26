// ============================================================================
// PMO Simulation — engine guards (PMO-SIM-*)
// ============================================================================
// These tests encode the rules that make the simulator trustworthy rather than
// merely functional. Several of them exist to fail loudly if someone later
// "improves" the engine in a way that is intuitive and wrong — budget buying
// time, a resource change rippling across unrelated work, or a risk severity
// being quietly converted into dollars.
// ============================================================================

import { describe, expect, it } from "vitest";
import { simulate } from "../engine";
import { baselineFingerprint, type SimBaseline } from "../baseline";
import { resolveRiskExposure } from "../risk-exposure";
import type {
  SimBudgetIntervention,
  SimIntervention,
  SimResourceIntervention,
  SimRiskIntervention,
  SimScenario,
  SimScheduleIntervention,
} from "../contracts";
import type { TaskStatus } from "@/types/database";

const RAN_AT = "2026-07-26T10:00:00.000Z";

// ── Fixtures ────────────────────────────────────────────────────────────────

function task(
  id: string,
  overrides: Partial<SimBaseline["tasks"][number]> = {},
): SimBaseline["tasks"][number] {
  return {
    id,
    project_id: "p1",
    milestone_id: "m1",
    title: `Task ${id}`,
    status: "in_progress" as TaskStatus,
    start_date: "2026-01-01",
    end_date: "2026-01-10",
    duration_days: 10,
    estimate_hours: 80,
    assigned_to: null,
    assigned_resource_id: null,
    ...overrides,
  };
}

function makeBaseline(overrides: Partial<SimBaseline> = {}): SimBaseline {
  return {
    organizationId: "org1",
    capturedAt: "2026-07-26T09:00:00.000Z",
    projects: [
      { id: "p1", title: "Project One", status: "active", start_date: "2026-01-01", target_end_date: "2026-06-30" },
    ],
    milestones: [{ id: "m1", project_id: "p1", title: "Milestone One", status: "in_progress", target_date: "2026-03-01" }],
    tasks: [
      task("t1", { start_date: "2026-01-01", end_date: "2026-01-10", duration_days: 10 }),
      task("t2", { start_date: "2026-01-11", end_date: "2026-01-20", duration_days: 10 }),
    ],
    dependencies: [
      {
        id: "d1",
        project_id: "p1",
        predecessor_id: "t1",
        successor_id: "t2",
        dependency_type: "finish_to_start",
        lag_days: 0,
      },
    ],
    budgetItems: [
      { id: "b1", project_id: "p1", milestone_id: "m1", name: "Labor", category: "labor", estimated_cost: 100_000, committed_cost: 0, actual_cost: 40_000, forecast_cost: null },
      { id: "b2", project_id: "p1", milestone_id: "m1", name: "Buffer", category: "contingency", estimated_cost: 20_000, committed_cost: 0, actual_cost: 0, forecast_cost: null },
    ],
    risks: [
      { id: "r1", project_id: "p1", title: "Permit delay", status: "open", probability: "high", impact: "high", severity: "high", linked_task_id: "t1", linked_milestone_id: null },
    ],
    allocations: [
      { id: "a1", project_id: "p1", resource_profile_id: "res1", user_id: null, display_name: "Crew A", allocation_percent: 100, weekly_capacity_hours: 40, availability_percent: 100, overhead_percent: 0, start_date: null, end_date: null, status: "active" },
    ],
    assignments: [
      { id: "as1", project_id: "p1", task_id: "t1", resource_id: "res1", planned_hours: 50, actual_hours: null },
    ],
    evm: [
      {
        project_id: "p1",
        bac: 120_000,
        ev: 50_000,
        ac: 60_000,
        pv: 55_000,
        // EV only ever comes from a measurement snapshot; budget lines cannot
        // produce one. A fixture with an EV therefore has that source.
        source: "measurement_snapshot",
      },
    ],
    unavailableSources: [],
    ...overrides,
  };
}

function scenario(interventions: SimIntervention[]): SimScenario {
  return {
    id: "s1",
    organizationId: "org1",
    name: "Scenario",
    description: null,
    projectIds: [],
    baselineAt: "2026-07-26T09:00:00.000Z",
    horizonDays: null,
    state: "draft",
    interventions,
    createdBy: "u1",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
  };
}

const budget = (over: Partial<SimBudgetIntervention> = {}): SimBudgetIntervention => ({
  id: "i-budget",
  order: 0,
  enabled: true,
  label: "Budget change",
  note: null,
  kind: "budget",
  target: { kind: "project", id: "p1" },
  amountDelta: 50_000,
  percentDelta: null,
  category: null,
  effectiveDate: null,
  ...over,
});

const schedule = (over: Partial<SimScheduleIntervention> = {}): SimScheduleIntervention => ({
  id: "i-schedule",
  order: 0,
  enabled: true,
  label: "Schedule change",
  note: null,
  kind: "schedule",
  target: { kind: "task", id: "t1" },
  delayDays: 5,
  newStartDate: null,
  newEndDate: null,
  newDurationDays: null,
  ...over,
});

const resource = (over: Partial<SimResourceIntervention> = {}): SimResourceIntervention => ({
  id: "i-resource",
  order: 0,
  enabled: true,
  label: "Resource change",
  note: null,
  kind: "resource",
  target: { kind: "resource", id: "res1" },
  availabilityPercent: 50,
  weeklyHoursDelta: null,
  periodStart: null,
  periodEnd: null,
  ...over,
});

const risk = (over: Partial<SimRiskIntervention> = {}): SimRiskIntervention => ({
  id: "i-risk",
  order: 0,
  enabled: true,
  label: "Risk change",
  note: null,
  kind: "risk",
  target: { kind: "risk", id: "r1" },
  action: "mitigate_full",
  reductionPercent: null,
  assumedCostImpact: null,
  assumedDelayDays: null,
  ...over,
});

// ── PMO-SIM-EMPTY ───────────────────────────────────────────────────────────

describe("PMO-SIM-EMPTY: no interventions", () => {
  it("returns a result with no deltas and no issues", () => {
    const result = simulate(scenario([]), makeBaseline(), { ranAt: RAN_AT });

    expect(result.outcomes).toEqual([]);
    expect(result.issues.filter((i) => i.severity === "conflict")).toEqual([]);
    // BAC is always reported; with no change its delta is exactly zero.
    const bac = result.metrics.find((m) => m.key === "portfolio_bac");
    expect(bac?.delta).toBe(0);
  });

  it("reports the baseline timestamp it was run against", () => {
    const baseline = makeBaseline();
    const result = simulate(scenario([]), baseline, { ranAt: RAN_AT });
    expect(result.baselineAt).toBe(baseline.capturedAt);
    expect(result.ranAt).toBe(RAN_AT);
  });
});

// ── PMO-SIM-BASELINE-IMMUTABLE ──────────────────────────────────────────────

describe("PMO-SIM-BASELINE-IMMUTABLE", () => {
  it("never mutates the baseline, whatever the scenario does", () => {
    const baseline = makeBaseline();
    const before = baselineFingerprint(baseline);

    simulate(scenario([budget(), schedule(), resource(), risk()]), baseline, { ranAt: RAN_AT });

    expect(baselineFingerprint(baseline)).toBe(before);
    // Spot-check the actual rows, not only the fingerprint.
    expect(baseline.tasks[0].start_date).toBe("2026-01-01");
    expect(baseline.budgetItems[0].estimated_cost).toBe(100_000);
    expect(baseline.allocations[0].availability_percent).toBe(100);
  });

  it("is deterministic — identical inputs produce identical output", () => {
    const baseline = makeBaseline();
    const scn = scenario([budget(), schedule(), risk()]);
    const first = simulate(scn, baseline, { ranAt: RAN_AT });
    const second = simulate(scn, baseline, { ranAt: RAN_AT });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

// ── PMO-SIM-BUDGET ──────────────────────────────────────────────────────────

describe("PMO-SIM-BUDGET", () => {
  it("moves the BAC by the requested amount", () => {
    const result = simulate(scenario([budget({ amountDelta: 50_000 })]), makeBaseline(), { ranAt: RAN_AT });
    const bac = result.metrics.find((m) => m.key === "portfolio_bac");
    expect(bac?.baseline).toBe(120_000);
    expect(bac?.simulated).toBe(170_000);
    expect(bac?.delta).toBe(50_000);
    expect(bac?.unit).toBe("currency");
  });

  it("HARD RULE: increasing the budget does not shorten the schedule", () => {
    const result = simulate(
      scenario([budget({ amountDelta: 500_000 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    // No schedule intervention ⇒ no schedule metric at all. Money must not
    // produce a finish-date delta by any path.
    expect(result.metrics.find((m) => m.key === "portfolio_finish_days")).toBeUndefined();
    expect(result.metrics.every((m) => m.unit !== "days" || m.delta === 0 || m.delta == null)).toBe(true);
  });

  it("applies a percentage change pro rata across lines in scope", () => {
    const result = simulate(scenario([budget({ amountDelta: null, percentDelta: 10 })]), makeBaseline(), { ranAt: RAN_AT });
    const bac = result.metrics.find((m) => m.key === "portfolio_bac");
    expect(bac?.simulated).toBe(132_000); // 120,000 + 10%
  });

  it("scopes to a category when one is given", () => {
    const result = simulate(
      scenario([budget({ amountDelta: 10_000, category: "contingency" })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const outcome = result.outcomes.find((o) => o.kind === "budget");
    expect(outcome?.computable).toBe(true);
    // Only the contingency line moved: 120,000 + 10,000.
    expect(result.metrics.find((m) => m.key === "portfolio_bac")?.simulated).toBe(130_000);
  });

  it("keeps an intervention whose category matches nothing, and says why", () => {
    const result = simulate(
      scenario([budget({ category: "permit" })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const outcome = result.outcomes.find((o) => o.kind === "budget");
    expect(outcome?.computable).toBe(false);
    expect(outcome?.notComputableReason).toBe("no_budget_lines_for_target_and_category");
  });
});

// ── PMO-SIM-FINANCE-UNITS ───────────────────────────────────────────────────

describe("PMO-SIM-FINANCE-UNITS", () => {
  it("labels every financial metric as currency and never as days", () => {
    const result = simulate(scenario([budget()]), makeBaseline(), { ranAt: RAN_AT });
    for (const key of ["portfolio_bac", "portfolio_eac", "portfolio_vac"]) {
      const metric = result.metrics.find((m) => m.key === key);
      if (metric) expect(metric.unit).toBe("currency");
    }
  });

  it("reports EAC as unavailable when the project has no earned value", () => {
    const baseline = makeBaseline({ evm: [] });
    const result = simulate(scenario([budget()]), baseline, { ranAt: RAN_AT });
    const eac = result.metrics.find((m) => m.key === "portfolio_eac");
    expect(eac?.provenance).toBe("UNAVAILABLE");
    expect(eac?.simulated).toBeNull();
    expect(eac?.unavailableReason).toBe("no_project_with_changed_budget_has_earned_value");
  });

  it("does not pretend a budget increase improves past cost performance", () => {
    const result = simulate(scenario([budget({ amountDelta: 100_000 })]), makeBaseline(), { ranAt: RAN_AT });
    const cpi = result.metrics.find((m) => m.key === "portfolio_cpi");
    // CPI is EV/AC — both historical. More budget cannot change it.
    expect(cpi?.delta).toBe(0);
  });
});

// ── PMO-SIM-SCHEDULE ────────────────────────────────────────────────────────

describe("PMO-SIM-SCHEDULE", () => {
  it("propagates a delay through a real dependency edge", () => {
    const result = simulate(scenario([schedule({ delayDays: 5 })]), makeBaseline(), { ranAt: RAN_AT });
    const finish = result.metrics.find((m) => m.key === "portfolio_finish_days");
    expect(finish?.unit).toBe("days");
    expect(finish?.delta).toBe(5);

    // t2 depends on t1 and must appear as an affected node.
    const outcome = result.outcomes.find((o) => o.kind === "schedule");
    expect(outcome?.affectedNodeIds).toContain("task:t1");
    expect(outcome?.affectedNodeIds).toContain("task:t2");
  });

  it("does NOT move a task that has no dependency path from the change", () => {
    const baseline = makeBaseline({
      tasks: [
        task("t1"),
        task("t2", { start_date: "2026-01-11", end_date: "2026-01-20" }),
        // Unrelated: no dependency edge reaches it.
        task("t3", { project_id: "p2", milestone_id: null, start_date: "2026-02-01", end_date: "2026-02-10" }),
      ],
      projects: [
        { id: "p1", title: "Project One", status: "active", start_date: "2026-01-01", target_end_date: null },
        { id: "p2", title: "Project Two", status: "active", start_date: "2026-02-01", target_end_date: null },
      ],
    });
    const result = simulate(scenario([schedule({ delayDays: 5 })]), baseline, { ranAt: RAN_AT });
    const outcome = result.outcomes.find((o) => o.kind === "schedule");
    expect(outcome?.affectedNodeIds).not.toContain("task:t3");
  });

  it("keeps a schedule change on undated tasks and explains the gap", () => {
    const baseline = makeBaseline({
      tasks: [task("t1", { start_date: null, end_date: null, duration_days: null })],
      dependencies: [],
    });
    const result = simulate(scenario([schedule({ delayDays: 5 })]), baseline, { ranAt: RAN_AT });
    const outcome = result.outcomes.find((o) => o.kind === "schedule");
    expect(outcome?.computable).toBe(false);
    expect(outcome?.notComputableReason).toBe("target_tasks_have_no_dates");
  });

  it("PMO-SIM-NO-DOUBLE-COUNT: overlapping delays on one chain are counted once", () => {
    const result = simulate(
      scenario([
        schedule({ id: "s-a", target: { kind: "task", id: "t1" }, delayDays: 5 }),
        schedule({ id: "s-b", target: { kind: "task", id: "t2" }, delayDays: 3, order: 1 }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const finish = result.metrics.find((m) => m.key === "portfolio_finish_days");

    // t1 slips 5 and finishes on day 15, so its successor t2 cannot start
    // before 15. t2's own 3-day slip only moves its planned start from day 10
    // to day 13 — still earlier than 15, so the dependency dominates and the
    // second delay is absorbed by the first. The portfolio slips 5, not 8.
    //
    // The number that must never appear is 13 (5 + 8): that is what a
    // per-intervention CPM re-run would produce by counting the same downstream
    // movement once for each intervention that contributed to it.
    expect(finish?.delta).toBe(5);
    // Exactly one portfolio finish metric — not one per intervention.
    expect(result.metrics.filter((m) => m.key === "portfolio_finish_days")).toHaveLength(1);
    expect(result.assumptions).toContain("schedule_finish_delta_reported_jointly_not_per_intervention");
  });

  it("PMO-SIM-NO-DOUBLE-COUNT: a downstream delay that dominates is counted in full", () => {
    const result = simulate(
      scenario([
        schedule({ id: "s-a", target: { kind: "task", id: "t1" }, delayDays: 2 }),
        schedule({ id: "s-b", target: { kind: "task", id: "t2" }, delayDays: 9, order: 1 }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const finish = result.metrics.find((m) => m.key === "portfolio_finish_days");

    // t1 finishes on day 12; t2's own planned start moves to day 19, which now
    // dominates the dependency. The portfolio slips 9 — the binding constraint,
    // not the sum of the two interventions (11).
    expect(finish?.delta).toBe(9);
  });
});

// ── PMO-SIM-CYCLE ───────────────────────────────────────────────────────────

describe("PMO-SIM-CYCLE", () => {
  it("reports a dependency cycle instead of looping forever", () => {
    const baseline = makeBaseline({
      dependencies: [
        { id: "d1", project_id: "p1", predecessor_id: "t1", successor_id: "t2", dependency_type: "finish_to_start", lag_days: 0 },
        { id: "d2", project_id: "p1", predecessor_id: "t2", successor_id: "t1", dependency_type: "finish_to_start", lag_days: 0 },
      ],
    });
    const result = simulate(scenario([]), baseline, { ranAt: RAN_AT });
    const issue = result.issues.find((i) => i.code === "dependency_cycle_detected");
    expect(issue).toBeDefined();
    expect(issue?.detail).toBe("2_tasks_excluded");
  });
});

// ── PMO-SIM-RESOURCE ────────────────────────────────────────────────────────

describe("PMO-SIM-RESOURCE", () => {
  it("recomputes capacity in HOURS via the generic engine", () => {
    const result = simulate(scenario([resource({ availabilityPercent: 50 })]), makeBaseline(), { ranAt: RAN_AT });
    const hours = result.outcomes
      .find((o) => o.kind === "resource")
      ?.metrics.find((m) => m.key === "resource_effective_hours");
    expect(hours?.unit).toBe("hours");
    expect(hours?.baseline).toBe(40); // 40 * 100% * (1 - 0)
    expect(hours?.simulated).toBe(20); // 40 * 50%
    expect(hours?.engine).toBe("capacity_generic");
  });

  it("HARD RULE: a resource with no linked task affects no work", () => {
    const baseline = makeBaseline({
      assignments: [],
      tasks: [task("t1", { assigned_to: null, assigned_resource_id: null })],
    });
    const result = simulate(scenario([resource()]), baseline, { ranAt: RAN_AT });
    const outcome = result.outcomes.find((o) => o.kind === "resource");

    expect(outcome?.computable).toBe(true);
    expect(outcome?.affectedNodeIds).toEqual(["resource:res1"]);
    expect(outcome?.affectedNodeIds.some((id) => id.startsWith("task:"))).toBe(false);
    expect(result.assumptions).toContain("resource_change_affects_no_linked_task");
  });

  it("only touches tasks genuinely linked to the resource", () => {
    const baseline = makeBaseline({
      tasks: [task("t1"), task("t2"), task("t3")],
      assignments: [
        { id: "as1", project_id: "p1", task_id: "t1", resource_id: "res1", planned_hours: 50, actual_hours: null },
      ],
    });
    const result = simulate(scenario([resource()]), baseline, { ranAt: RAN_AT });
    const affected = result.outcomes.find((o) => o.kind === "resource")?.affectedNodeIds ?? [];
    expect(affected).toContain("task:t1");
    expect(affected).not.toContain("task:t2");
    expect(affected).not.toContain("task:t3");
  });

  it("keeps utilization in percent and overload in hours, never merged", () => {
    const result = simulate(scenario([resource({ availabilityPercent: 50 })]), makeBaseline(), { ranAt: RAN_AT });
    const metrics = result.outcomes.find((o) => o.kind === "resource")?.metrics ?? [];
    expect(metrics.find((m) => m.key === "resource_utilization")?.unit).toBe("percent");
    expect(metrics.find((m) => m.key === "resource_overallocated_hours")?.unit).toBe("hours");
  });

  it("says so when a resource has no allocation to change", () => {
    const baseline = makeBaseline({ allocations: [] });
    const result = simulate(scenario([resource()]), baseline, { ranAt: RAN_AT });
    const outcome = result.outcomes.find((o) => o.kind === "resource");
    // No allocation row ⇒ the target does not resolve at all.
    expect(outcome?.computable).toBe(false);
  });
});

// ── PMO-SIM-RISK ────────────────────────────────────────────────────────────

describe("PMO-SIM-RISK", () => {
  it("prefers an ASSUMED figure and labels it as the user's assumption", () => {
    const result = simulate(
      scenario([risk({ assumedCostImpact: 80_000, assumedDelayDays: 12, action: "materialize" })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const metrics = result.outcomes.find((o) => o.kind === "risk")?.metrics ?? [];
    const cost = metrics.find((m) => m.key === "risk_exposure_cost");
    const days = metrics.find((m) => m.key === "risk_exposure_days");

    expect(cost?.provenance).toBe("ASSUMED");
    expect(cost?.simulated).toBe(80_000);
    expect(days?.provenance).toBe("ASSUMED");
    expect(days?.simulated).toBe(12);
    expect(result.assumptions).toContain("risk_exposure_supplied_by_user_not_measured");
  });

  it("PMO-SIM-RISK-UNITS: cost and days are separate and never summed", () => {
    const result = simulate(
      scenario([risk({ assumedCostImpact: 80_000, assumedDelayDays: 12, action: "materialize" })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const cost = result.metrics.find((m) => m.key === "risk_exposure_cost");
    const days = result.metrics.find((m) => m.key === "risk_exposure_days");

    expect(cost?.unit).toBe("currency");
    expect(days?.unit).toBe("days");
    // 80,000 + 12 = 80,012 must appear nowhere.
    expect(result.metrics.some((m) => m.simulated === 80_012)).toBe(false);
  });

  it("falls back to DERIVED_PROXY from linked records, and shows the chain", () => {
    const result = simulate(scenario([risk({ action: "materialize" })]), makeBaseline(), { ranAt: RAN_AT });
    const metrics = result.outcomes.find((o) => o.kind === "risk")?.metrics ?? [];
    const cost = metrics.find((m) => m.key === "risk_exposure_cost");

    // r1 → t1 → m1 → budget lines b1 + b2 = 120,000.
    expect(cost?.provenance).toBe("DERIVED_PROXY");
    expect(cost?.simulated).toBe(120_000);
    expect(result.assumptions).toContain("risk_cost_is_budget_at_stake_proxy_not_predicted_loss");

    const chain = result.causalChains.find((c) => c.interventionId === "i-risk");
    expect(chain?.steps.some((s) => s.evidence?.sourceTable === "budget_items")).toBe(true);
  });

  it("derives delay days from real CPM float, never from severity", () => {
    const baseline = makeBaseline({
      // t1 gains 4 days of float by shortening it against the t2 chain.
      tasks: [
        task("t1", { duration_days: 6, start_date: "2026-01-01", end_date: null }),
        task("t2", { start_date: "2026-01-11", end_date: "2026-01-20", duration_days: 10 }),
      ],
    });
    const result = simulate(scenario([risk({ action: "materialize" })]), baseline, { ranAt: RAN_AT });
    const days = result.outcomes
      .find((o) => o.kind === "risk")
      ?.metrics.find((m) => m.key === "risk_exposure_days");

    expect(days?.provenance).toBe("DERIVED_PROXY");
    expect(days?.unit).toBe("days");
    expect(result.assumptions).toContain("risk_delay_proxy_is_linked_task_float");
  });

  it("reports UNAVAILABLE — not zero — when nothing is linked", () => {
    const baseline = makeBaseline({
      risks: [
        { id: "r1", project_id: "p1", title: "Unlinked risk", status: "open", probability: "high", impact: "critical", severity: "critical", linked_task_id: null, linked_milestone_id: null },
      ],
    });
    const result = simulate(scenario([risk({ action: "materialize" })]), baseline, { ranAt: RAN_AT });
    const metrics = result.outcomes.find((o) => o.kind === "risk")?.metrics ?? [];

    const cost = metrics.find((m) => m.key === "risk_exposure_cost");
    const days = metrics.find((m) => m.key === "risk_exposure_days");
    expect(cost?.provenance).toBe("UNAVAILABLE");
    expect(cost?.simulated).toBeNull();
    expect(cost?.unavailableReason).toBe("risk_has_no_linked_scope");
    expect(days?.provenance).toBe("UNAVAILABLE");
    expect(days?.simulated).toBeNull();
  });

  it("PMO-SIM-RISK-NO-SEVERITY-MAPPING: severity alone yields no money", () => {
    // Two risks, identical except severity, both unlinked. If severity leaked
    // into the money path they would differ.
    const base = (severity: string, impact: string) =>
      makeBaseline({
        risks: [
          { id: "r1", project_id: "p1", title: "R", status: "open", probability: "high", impact, severity, linked_task_id: null, linked_milestone_id: null },
        ],
      });

    const low = simulate(scenario([risk({ action: "materialize" })]), base("low", "low"), { ranAt: RAN_AT });
    const critical = simulate(scenario([risk({ action: "materialize" })]), base("critical", "critical"), { ranAt: RAN_AT });

    const costOf = (r: typeof low) =>
      r.outcomes.find((o) => o.kind === "risk")?.metrics.find((m) => m.key === "risk_exposure_cost");

    // Identical in every field that carries a number, and unavailable in both.
    expect(costOf(low)?.simulated ?? null).toBe(costOf(critical)?.simulated ?? null);
    expect(costOf(low)?.provenance).toBe(costOf(critical)?.provenance);
    expect(costOf(low)?.simulated).toBeNull();
    expect(costOf(critical)?.simulated).toBeNull();
  });

  it("applies partial mitigation as a declared 50% when no figure is given", () => {
    const result = simulate(
      scenario([risk({ action: "mitigate_partial", assumedCostImpact: 100_000 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const cost = result.outcomes
      .find((o) => o.kind === "risk")
      ?.metrics.find((m) => m.key === "risk_exposure_cost");

    expect(cost?.baseline).toBe(100_000);
    expect(cost?.simulated).toBe(50_000);
    expect(cost?.delta).toBe(-50_000);
    expect(result.assumptions).toContain("risk_partial_mitigation_assumed_50_percent");
  });

  it("applies an explicit reduction percentage", () => {
    const result = simulate(
      scenario([risk({ action: "reduce_impact", reductionPercent: 25, assumedCostImpact: 100_000 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const cost = result.outcomes
      .find((o) => o.kind === "risk")
      ?.metrics.find((m) => m.key === "risk_exposure_cost");
    expect(cost?.simulated).toBe(75_000);
  });

  it("full mitigation closes the risk and zeroes its exposure", () => {
    const result = simulate(
      scenario([risk({ action: "mitigate_full", assumedCostImpact: 100_000 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const metrics = result.outcomes.find((o) => o.kind === "risk")?.metrics ?? [];
    expect(metrics.find((m) => m.key === "risk_exposure_cost")?.simulated).toBe(0);
    expect(metrics.find((m) => m.key === "open_risks")?.delta).toBe(-1);
  });

  it("never writes assumed values back into the risk row", () => {
    const baseline = makeBaseline();
    simulate(
      scenario([risk({ assumedCostImpact: 999_999, assumedDelayDays: 42 })]),
      baseline,
      { ranAt: RAN_AT },
    );
    // `risks` has no cost/days columns and must gain none.
    expect(Object.keys(baseline.risks[0])).not.toContain("assumedCostImpact");
    expect(JSON.stringify(baseline.risks)).not.toContain("999999");
  });
});

// ── PMO-SIM-CONFLICT ────────────────────────────────────────────────────────

describe("PMO-SIM-CONFLICT", () => {
  it("flags two absolute schedule changes on the same task", () => {
    const result = simulate(
      scenario([
        schedule({ id: "s-a", delayDays: null, newStartDate: "2026-02-01" }),
        schedule({ id: "s-b", delayDays: null, newStartDate: "2026-03-01", order: 1 }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const conflict = result.issues.find((i) => i.code === "conflicting_schedule_targets");
    expect(conflict?.severity).toBe("conflict");
    expect(conflict?.interventionIds).toEqual(["s-a", "s-b"]);
    // Neither silently wins.
    expect(result.outcomes.filter((o) => o.kind === "schedule").every((o) => !o.computable)).toBe(true);
  });

  it("flags a risk both mitigated and materialized", () => {
    const result = simulate(
      scenario([
        risk({ id: "r-a", action: "mitigate_full" }),
        risk({ id: "r-b", action: "materialize", order: 1 }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const conflict = result.issues.find((i) => i.code === "risk_mitigated_and_materialized");
    expect(conflict?.severity).toBe("conflict");
    expect(conflict?.interventionIds).toHaveLength(2);
  });

  it("flags two different availabilities for one resource", () => {
    const result = simulate(
      scenario([
        resource({ id: "res-a", availabilityPercent: 50 }),
        resource({ id: "res-b", availabilityPercent: 80, order: 1 }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    expect(result.issues.some((i) => i.code === "conflicting_resource_availability")).toBe(true);
  });

  it("warns when absolute and percentage budget changes are mixed", () => {
    const result = simulate(
      scenario([
        budget({ id: "b-a", amountDelta: 10_000 }),
        budget({ id: "b-b", amountDelta: null, percentDelta: 10, order: 1 }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    expect(result.issues.some((i) => i.code === "budget_absolute_and_percent_mixed")).toBe(true);
  });
});

// ── PMO-SIM-MISSING-TARGET ──────────────────────────────────────────────────

describe("PMO-SIM-MISSING-TARGET", () => {
  it("keeps an intervention pointing at a nonexistent target and reports it", () => {
    const result = simulate(
      scenario([schedule({ target: { kind: "task", id: "does-not-exist" } })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );

    const outcome = result.outcomes.find((o) => o.interventionId === "i-schedule");
    expect(outcome).toBeDefined();
    expect(outcome?.computable).toBe(false);
    expect(outcome?.notComputableReason).toBe("target_not_found");
    expect(result.coverage.unresolvedTargets).toEqual([{ kind: "task", id: "does-not-exist" }]);
  });

  it("still computes the other interventions", () => {
    const result = simulate(
      scenario([
        schedule({ id: "bad", target: { kind: "task", id: "nope" } }),
        budget({ id: "good" }),
      ]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    expect(result.outcomes.find((o) => o.interventionId === "good")?.computable).toBe(true);
    expect(result.outcomes.find((o) => o.interventionId === "bad")?.computable).toBe(false);
  });
});

// ── PMO-SIM-MISSING-DATA ────────────────────────────────────────────────────

describe("PMO-SIM-MISSING-DATA", () => {
  it("names unreadable sources in the coverage report", () => {
    const baseline = makeBaseline({ unavailableSources: ["budget_items"] });
    const result = simulate(scenario([]), baseline, { ranAt: RAN_AT });
    expect(result.coverage.unavailableSources).toContain("budget_items");
    expect(result.coverage.availableSources).not.toContain("budget_items");
  });

  it("an empty baseline yields no metrics with invented values", () => {
    const baseline = makeBaseline({
      projects: [], milestones: [], tasks: [], dependencies: [],
      budgetItems: [], risks: [], allocations: [], assignments: [], evm: [],
    });
    const result = simulate(scenario([]), baseline, { ranAt: RAN_AT });
    const bac = result.metrics.find((m) => m.key === "portfolio_bac");
    expect(bac?.baseline).toBe(0);
    expect(bac?.delta).toBe(0);
  });
});

// ── PMO-SIM-MULTIPLE ────────────────────────────────────────────────────────

describe("PMO-SIM-MULTIPLE", () => {
  it("runs all four kinds together and keeps each outcome distinct", () => {
    const result = simulate(
      scenario([budget(), schedule(), resource(), risk({ assumedCostImpact: 10_000 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );

    expect(result.outcomes.map((o) => o.kind).sort()).toEqual(["budget", "resource", "risk", "schedule"]);
    expect(result.outcomes.every((o) => o.computable)).toBe(true);
    // Each intervention carries its own causal chain.
    expect(result.causalChains).toHaveLength(4);
  });

  it("applies interventions in a stable stage order regardless of input order", () => {
    const forward = simulate(
      scenario([budget({ order: 0 }), schedule({ order: 1 }), risk({ order: 2 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const reversed = simulate(
      scenario([risk({ order: 2 }), schedule({ order: 1 }), budget({ order: 0 })]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    const keyed = (r: typeof forward) =>
      r.metrics.map((m) => `${m.key}:${m.simulated}`).sort().join("|");
    expect(keyed(forward)).toBe(keyed(reversed));
  });

  it("ignores disabled interventions", () => {
    const result = simulate(
      scenario([budget({ enabled: false }), schedule()]),
      makeBaseline(),
      { ranAt: RAN_AT },
    );
    expect(result.outcomes.some((o) => o.kind === "budget")).toBe(false);
    expect(result.metrics.find((m) => m.key === "portfolio_bac")?.delta).toBe(0);
  });
});

// ── PMO-SIM-CAUSAL ──────────────────────────────────────────────────────────

describe("PMO-SIM-CAUSAL", () => {
  it("builds a chain from intervention through to a metric, with evidence", () => {
    const result = simulate(scenario([schedule()]), makeBaseline(), { ranAt: RAN_AT });
    const chain = result.causalChains.find((c) => c.interventionId === "i-schedule");

    expect(chain?.steps[0].kind).toBe("intervention");
    expect(chain?.steps.at(-1)?.kind).toBe("metric");
    expect(chain?.steps.some((s) => s.kind === "milestone")).toBe(true);
    expect(chain?.steps.some((s) => s.kind === "project")).toBe(true);

    // Every non-intervention, non-metric step cites a canonical row.
    for (const step of chain?.steps ?? []) {
      if (step.kind === "intervention" || step.kind === "metric") continue;
      expect(step.evidence).not.toBeNull();
      expect(step.evidence?.sourceId).toBeTruthy();
    }
  });
});

// ── PMO-SIM-EXPOSURE (unit-level) ───────────────────────────────────────────

describe("PMO-SIM-EXPOSURE precedence", () => {
  it("ASSUMED beats DERIVED_PROXY per unit, independently", () => {
    const baseline = makeBaseline();
    // Cost asserted, days left to the proxy.
    const exposure = resolveRiskExposure(
      "r1",
      baseline,
      { assumedCostImpact: 5_000, assumedDelayDays: null },
      new Map([["t1", 3]]),
    );
    expect(exposure.cost.provenance).toBe("ASSUMED");
    expect(exposure.cost.value).toBe(5_000);
    expect(exposure.delayDays.provenance).toBe("DERIVED_PROXY");
    expect(exposure.delayDays.value).toBe(3);
  });

  it("a proxy carries the evidence it walked", () => {
    const exposure = resolveRiskExposure("r1", makeBaseline(), null, new Map([["t1", 0]]));
    expect(exposure.cost.provenance).toBe("DERIVED_PROXY");
    expect(exposure.cost.evidence.map((e) => e.sourceTable)).toContain("budget_items");
    expect(exposure.cost.derivation.length).toBeGreaterThan(0);
  });

  it("an unscheduled linked task makes days unavailable", () => {
    const exposure = resolveRiskExposure("r1", makeBaseline(), null, new Map());
    expect(exposure.delayDays.provenance).toBe("UNAVAILABLE");
    expect(exposure.delayDays.unavailableReason).toBe("linked_task_not_scheduled");
  });
});
