// ============================================================================
// PMO Simulation — the immutable baseline (CAP-049)
// ============================================================================
// The engine reads canonical rows and never writes them. That guarantee is
// worth more than a comment, so it is enforced structurally:
//
//   * every collection here is `readonly`, and every row type is `Readonly<…>`;
//   * `cloneBaseline` hands the mutation stages a deep copy to work on;
//   * `assertBaselineUnchanged` re-checks the original after a run, so a
//     regression that starts mutating inputs fails a test instead of quietly
//     corrupting the comparison a PMO is reading.
//
// A simulation that mutates its own baseline reports a delta against a moving
// target — the numbers stay plausible while being wrong, which is the failure
// mode hardest to notice on a demo screen.
// ============================================================================

import type { DependencyType, TaskStatus } from "@/types/database";

/** The task fields the CPM engine needs, plus what capacity and linking need. */
export interface SimTaskRow {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  status: TaskStatus;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  estimate_hours: number | null;
  /** Single-owner shortcut (auth.users id). */
  assigned_to: string | null;
  /** Assigned crew/team/vendor/equipment (resources id). */
  assigned_resource_id: string | null;
}

export interface SimDependencyRow {
  id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: DependencyType;
  lag_days: number | null;
}

export interface SimMilestoneRow {
  id: string;
  project_id: string;
  title: string;
  status: string | null;
  target_date: string | null;
}

export interface SimProjectRow {
  id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  target_end_date: string | null;
}

export interface SimBudgetRow {
  id: string;
  project_id: string;
  milestone_id: string | null;
  name: string;
  category: string;
  estimated_cost: number;
  committed_cost: number;
  actual_cost: number;
  forecast_cost: number | null;
}

/**
 * Risks carry NO cost and NO days — that is the schema, not an omission in this
 * read. `linked_task_id` / `linked_milestone_id` are the only bridge to
 * anything quantifiable, which is precisely what DERIVED_PROXY walks.
 */
export interface SimRiskRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  probability: string;
  impact: string;
  severity: string;
  linked_task_id: string | null;
  linked_milestone_id: string | null;
}

/** Generic capacity engine input (unit: HOURS — never headcount). */
export interface SimAllocationRow {
  id: string;
  project_id: string;
  resource_profile_id: string | null;
  user_id: string | null;
  display_name: string | null;
  allocation_percent: number | null;
  weekly_capacity_hours: number | null;
  availability_percent: number | null;
  overhead_percent: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

/** task ↔ resource, the authoritative link for resource interventions. */
export interface SimAssignmentRow {
  id: string;
  project_id: string;
  task_id: string;
  resource_id: string;
  planned_hours: number | null;
  actual_hours: number | null;
}

/**
 * Earned-value inputs, per project. Every field is nullable because most
 * portfolios do not have all three, and a missing EV must produce "unavailable"
 * rather than a confident zero.
 *
 * `source` records where EV/PV/AC came from, because the two origins are not
 * interchangeable. A measurement snapshot is a coherent reading of all three at
 * one data date; budget lines alone can supply AC but never EV, so a project
 * with no snapshot still has no forecast. Mixing an EV from one origin with an
 * AC from the other would produce a CPI that describes neither.
 */
export type SimEvmSource = "measurement_snapshot" | "budget_items";

export interface SimEvmRow {
  project_id: string;
  bac: number | null;
  ev: number | null;
  ac: number | null;
  pv: number | null;
  source: SimEvmSource;
}

export interface SimBaseline {
  organizationId: string;
  /** ISO timestamp the snapshot was taken. Results cite it. */
  capturedAt: string;
  projects: readonly Readonly<SimProjectRow>[];
  milestones: readonly Readonly<SimMilestoneRow>[];
  tasks: readonly Readonly<SimTaskRow>[];
  dependencies: readonly Readonly<SimDependencyRow>[];
  budgetItems: readonly Readonly<SimBudgetRow>[];
  risks: readonly Readonly<SimRiskRow>[];
  allocations: readonly Readonly<SimAllocationRow>[];
  assignments: readonly Readonly<SimAssignmentRow>[];
  evm: readonly Readonly<SimEvmRow>[];
  /** Tables that failed to read. Surfaced in coverage, never treated as empty. */
  unavailableSources: readonly string[];
}

export const EMPTY_BASELINE: SimBaseline = {
  organizationId: "",
  capturedAt: "1970-01-01T00:00:00.000Z",
  projects: [],
  milestones: [],
  tasks: [],
  dependencies: [],
  budgetItems: [],
  risks: [],
  allocations: [],
  assignments: [],
  evm: [],
  unavailableSources: [],
};

/** A mutable working copy. Stages mutate THIS; the baseline stays pristine. */
export interface SimWorkingCopy {
  tasks: SimTaskRow[];
  budgetItems: SimBudgetRow[];
  allocations: SimAllocationRow[];
  /** Risk ids the scenario assumes are no longer active. */
  neutralizedRiskIds: Set<string>;
  /** Risk ids the scenario assumes have occurred. */
  materializedRiskIds: Set<string>;
  /** Residual probability weight per risk, 0–1, after partial mitigation. */
  riskWeight: Map<string, number>;
}

/** Deep copy of everything a stage is allowed to modify. */
export function cloneBaseline(baseline: SimBaseline): SimWorkingCopy {
  return {
    tasks: baseline.tasks.map((task) => ({ ...task })),
    budgetItems: baseline.budgetItems.map((item) => ({ ...item })),
    allocations: baseline.allocations.map((allocation) => ({ ...allocation })),
    neutralizedRiskIds: new Set<string>(),
    materializedRiskIds: new Set<string>(),
    riskWeight: new Map<string, number>(),
  };
}

/**
 * Structural fingerprint of the mutable slices of a baseline. Cheap enough to
 * run on every simulation, and specific enough that any in-place edit changes
 * it. Used by the guard test PMO-SIM-BASELINE-IMMUTABLE.
 */
export function baselineFingerprint(baseline: SimBaseline): string {
  const tasks = baseline.tasks
    .map((t) => `${t.id}|${t.start_date}|${t.end_date}|${t.duration_days}|${t.estimate_hours}`)
    .join(";");
  const budget = baseline.budgetItems
    .map((b) => `${b.id}|${b.estimated_cost}|${b.forecast_cost}|${b.category}`)
    .join(";");
  const allocations = baseline.allocations
    .map((a) => `${a.id}|${a.weekly_capacity_hours}|${a.availability_percent}|${a.overhead_percent}`)
    .join(";");
  return `T:${tasks}#B:${budget}#A:${allocations}`;
}
