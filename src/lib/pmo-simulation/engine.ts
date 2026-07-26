// ============================================================================
// PMO Simulation — deterministic engine (CAP-049 §2)
// ============================================================================
// One pure function: baseline + scenario → result. No I/O, no clock, no
// randomness, no React. Same inputs always produce the same output, which is
// what makes a simulated number defensible in a steering committee.
//
// ── CALCULATION ORDER, and why ──────────────────────────────────────────────
//
//   0. Baseline CPM ......... run FIRST, before any mutation.
//   1. Validate ............. resolve targets, detect contradictions.
//   2. Apply in order ....... budget → resource → schedule → risk.
//   3. Finance (EVM) ........ from the mutated budget lines.
//   4. Capacity ............. from the mutated allocations.
//   5. Schedule (CPM) ....... ONE re-run over the fully-mutated task copy.
//   6. Risk ................. needs the baseline float from step 0.
//   7. Aggregate ............ metrics, chains, coverage.
//
// The brief suggested finances → capacity → schedule → risks. Two deviations,
// both deliberate:
//
//   * The baseline CPM runs before everything. Risk day-exposure is derived
//     from a task's float, and float measured on the already-modified schedule
//     would describe the scenario rather than what the scenario is being
//     compared against. Measuring the ruler after bending it.
//
//   * The CPM runs ONCE, after every schedule edit is in place, rather than
//     per intervention. Re-running per intervention would let two delays on the
//     same dependency chain each claim the downstream slip they jointly caused
//     — textbook double counting. One run over the final state attributes it
//     once. This is also why `applyScheduleIntervention` only edits dates and
//     never computes propagation itself.
//
// Everything else follows the brief: money is settled before capacity because
// budget does not consume capacity, and capacity is settled before the schedule
// because it can change what work is feasible — while, per the hard rule, never
// letting money touch a duration.
// ============================================================================

import {
  baselineFingerprint,
  cloneBaseline,
  type SimBaseline,
} from "./baseline";
import type {
  SimCausalChain,
  SimIntervention,
  SimInterventionOutcome,
  SimIssue,
  SimMetric,
  SimResult,
  SimScenario,
} from "./contracts";
import { sortInterventions, validateScenario } from "./validation";
import { applyBudgetIntervention } from "./stages/budget";
import { applyResourceIntervention } from "./stages/resource";
import {
  applyScheduleIntervention,
  floatByTask,
  runCpm,
  scheduleCausalChain,
  scheduleMetrics,
} from "./stages/schedule";
import { applyRiskIntervention } from "./stages/risk";
import { financeMetrics } from "./stages/finance";

/** Stage order. Budget before resource before schedule before risk. */
const KIND_ORDER: Record<SimIntervention["kind"], number> = {
  budget: 0,
  resource: 1,
  schedule: 2,
  risk: 3,
};

export interface SimulateOptions {
  /** Timestamp recorded on the result. Injected so the engine stays pure. */
  ranAt: string;
}

export function simulate(
  scenario: SimScenario,
  baseline: SimBaseline,
  options: SimulateOptions,
): SimResult {
  const fingerprintBefore = baselineFingerprint(baseline);

  const issues: SimIssue[] = [];
  const assumptions = new Set<string>();
  const outcomes: SimInterventionOutcome[] = [];
  const causalChains: SimCausalChain[] = [];
  const affectedNodeIds = new Set<string>();

  // ── Stage 0: baseline CPM ───────────────────────────────────────────────
  // The anchor is fixed here and reused for the simulated run, so both
  // schedules are measured from the same origin.
  const baselineCpm = runCpm(baseline.tasks, baseline.dependencies);
  const baselineFloat = floatByTask(baselineCpm);
  const anchor = baselineCpm.anchorDate;

  if (baselineCpm.cycleTaskIds.length > 0) {
    // The CPM already refuses to schedule tasks in a cycle. We surface that
    // rather than silently reporting on a partial schedule.
    issues.push({
      code: "dependency_cycle_detected",
      severity: "warning",
      interventionIds: [],
      detail: `${baselineCpm.cycleTaskIds.length}_tasks_excluded`,
    });
  }

  // ── Stage 1: validate ───────────────────────────────────────────────────
  const validation = validateScenario(scenario.interventions, baseline);
  issues.push(...validation.issues);

  const ordered = sortInterventions(scenario.interventions)
    .filter((item) => item.enabled)
    .sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (a.order - b.order) || a.id.localeCompare(b.id));

  // Blocked interventions are KEPT in the results, marked not-computable. An
  // intervention that disappears reads as one that had no effect.
  for (const intervention of ordered) {
    if (!validation.blockedInterventionIds.has(intervention.id)) continue;
    outcomes.push({
      interventionId: intervention.id,
      kind: intervention.kind,
      computable: false,
      notComputableReason: validation.blockReasonById.get(intervention.id) ?? "blocked",
      affectedNodeIds: [],
      metrics: [],
    });
  }

  const runnable = ordered.filter((item) => !validation.blockedInterventionIds.has(item.id));

  // ── Stage 2: apply to the working copy ──────────────────────────────────
  const working = cloneBaseline(baseline);

  // Task → milestone index, so a task-targeted budget change can reach the
  // milestone's budget lines (budget_items has no task_id).
  const taskMilestoneIndex = new Map<string, Set<string>>();
  for (const task of baseline.tasks) {
    if (task.milestone_id) taskMilestoneIndex.set(task.id, new Set([task.milestone_id]));
  }

  const scheduleEdits: { intervention: Extract<SimIntervention, { kind: "schedule" }>; editedTaskIds: string[] }[] = [];

  for (const intervention of runnable) {
    switch (intervention.kind) {
      case "budget": {
        const outcome = applyBudgetIntervention(intervention, working, taskMilestoneIndex);
        outcomes.push({
          interventionId: outcome.interventionId,
          kind: "budget",
          computable: outcome.computable,
          notComputableReason: outcome.notComputableReason,
          affectedNodeIds: outcome.affectedNodeIds,
          metrics: outcome.metrics,
        });
        for (const id of outcome.affectedNodeIds) affectedNodeIds.add(id);
        for (const item of outcome.assumptions) assumptions.add(item);
        if (outcome.causalSteps.length > 0) {
          causalChains.push({ interventionId: intervention.id, steps: outcome.causalSteps });
        }
        break;
      }
      case "resource": {
        const outcome = applyResourceIntervention(intervention, working, baseline);
        outcomes.push({
          interventionId: outcome.interventionId,
          kind: "resource",
          computable: outcome.computable,
          notComputableReason: outcome.notComputableReason,
          affectedNodeIds: outcome.affectedNodeIds,
          metrics: outcome.metrics,
        });
        for (const id of outcome.affectedNodeIds) affectedNodeIds.add(id);
        for (const item of outcome.assumptions) assumptions.add(item);
        if (outcome.causalSteps.length > 0) {
          causalChains.push({ interventionId: intervention.id, steps: outcome.causalSteps });
        }
        break;
      }
      case "schedule": {
        const applied = applyScheduleIntervention(intervention, working);
        for (const item of applied.assumptions) assumptions.add(item);
        if (applied.notComputableReason != null) {
          outcomes.push({
            interventionId: intervention.id,
            kind: "schedule",
            computable: false,
            notComputableReason: applied.notComputableReason,
            affectedNodeIds: [],
            metrics: [],
          });
        } else {
          scheduleEdits.push({ intervention, editedTaskIds: applied.editedTaskIds });
        }
        break;
      }
      case "risk": {
        const outcome = applyRiskIntervention(intervention, working, baseline, baselineFloat);
        outcomes.push({
          interventionId: outcome.interventionId,
          kind: "risk",
          computable: outcome.computable,
          notComputableReason: outcome.notComputableReason,
          affectedNodeIds: outcome.affectedNodeIds,
          metrics: outcome.metrics,
        });
        for (const id of outcome.affectedNodeIds) affectedNodeIds.add(id);
        for (const item of outcome.assumptions) assumptions.add(item);
        if (outcome.causalSteps.length > 0) {
          causalChains.push({ interventionId: intervention.id, steps: outcome.causalSteps });
        }
        break;
      }
    }
  }

  // ── Stage 3: finance ────────────────────────────────────────────────────
  const finance = financeMetrics(baseline, working);
  for (const item of finance.assumptions) assumptions.add(item);

  // ── Stage 5: schedule — ONE CPM run over the final task state ───────────
  const portfolioMetrics: SimMetric[] = [...finance.metrics];

  if (scheduleEdits.length > 0) {
    const simulatedCpm = runCpm(working.tasks, baseline.dependencies, anchor);
    portfolioMetrics.push(...scheduleMetrics(baselineCpm, simulatedCpm));

    if (simulatedCpm.cycleTaskIds.length > baselineCpm.cycleTaskIds.length) {
      issues.push({
        code: "simulation_introduced_cycle",
        severity: "conflict",
        interventionIds: scheduleEdits.map((edit) => edit.intervention.id),
        detail: null,
      });
    }

    // Attribution per intervention, from the single shared run.
    for (const { intervention, editedTaskIds } of scheduleEdits) {
      const chain = scheduleCausalChain(
        intervention,
        editedTaskIds,
        baseline,
        baselineCpm,
        simulatedCpm,
      );
      for (const id of chain.affectedNodeIds) affectedNodeIds.add(id);
      causalChains.push({ interventionId: intervention.id, steps: chain.steps });

      // Per-intervention finish delta is reported only when this is the ONLY
      // schedule intervention. With several on one chain the portfolio delta is
      // a joint effect, and splitting it between them would be arbitrary.
      const metrics: SimMetric[] =
        scheduleEdits.length === 1
          ? scheduleMetrics(baselineCpm, simulatedCpm)
          : [
              {
                key: "tasks_directly_changed",
                unit: "count",
                baseline: 0,
                simulated: editedTaskIds.length,
                delta: editedTaskIds.length,
                engine: "cpm",
                provenance: "OBSERVED",
                unavailableReason: null,
              },
            ];
      if (scheduleEdits.length > 1) {
        assumptions.add("schedule_finish_delta_reported_jointly_not_per_intervention");
      }

      outcomes.push({
        interventionId: intervention.id,
        kind: "schedule",
        computable: true,
        notComputableReason: null,
        affectedNodeIds: chain.affectedNodeIds,
        metrics,
      });
    }
  }

  // ── Stage 7: aggregate ──────────────────────────────────────────────────
  // Risk exposure is aggregated per UNIT. Two totals, never one.
  const riskCost = sumMetric(outcomes, "risk_exposure_cost");
  if (riskCost) portfolioMetrics.push(riskCost);
  const riskDays = sumMetric(outcomes, "risk_exposure_days");
  if (riskDays) portfolioMetrics.push(riskDays);
  const openRisks = sumMetric(outcomes, "open_risks");
  if (openRisks) portfolioMetrics.push(openRisks);
  const overallocated = sumMetric(outcomes, "resource_overallocated_hours");
  if (overallocated) portfolioMetrics.push(overallocated);

  // The baseline must be exactly as we found it.
  if (baselineFingerprint(baseline) !== fingerprintBefore) {
    throw new Error("PMO-SIM: baseline was mutated during simulation");
  }

  return {
    scenarioId: scenario.id,
    baselineAt: baseline.capturedAt,
    ranAt: options.ranAt,
    metrics: portfolioMetrics,
    outcomes,
    issues,
    assumptions: [...assumptions].sort(),
    causalChains,
    coverage: {
      availableSources: [
        "projects",
        "milestones",
        "roadmap_tasks",
        "task_dependencies",
        "budget_items",
        "risks",
        "project_resource_allocations",
        "resource_assignments",
        "financial_measurement_snapshots",
      ].filter((table) => !baseline.unavailableSources.includes(table)),
      unavailableSources: [...baseline.unavailableSources],
      unresolvedTargets: validation.unresolvedTargets,
    },
    affectedNodeIds: [...affectedNodeIds],
  };
}

/**
 * Sum one metric key across outcomes, preserving its unit.
 *
 * Only metrics that share a key — and therefore a unit — are ever added. A
 * metric whose value is unavailable in every outcome stays unavailable rather
 * than summing to a misleading zero.
 */
function sumMetric(outcomes: readonly SimInterventionOutcome[], key: string): SimMetric | null {
  const rows = outcomes.flatMap((outcome) => outcome.metrics.filter((metric) => metric.key === key));
  if (rows.length === 0) return null;

  const usable = rows.filter((row) => row.baseline != null || row.simulated != null);
  const first = rows[0];

  if (usable.length === 0) {
    return {
      key,
      unit: first.unit,
      baseline: null,
      simulated: null,
      delta: null,
      engine: first.engine,
      provenance: "UNAVAILABLE",
      unavailableReason: first.unavailableReason ?? "no_quantified_value",
    };
  }

  const baseline = usable.reduce((sum, row) => sum + (row.baseline ?? 0), 0);
  const simulated = usable.reduce((sum, row) => sum + (row.simulated ?? 0), 0);

  // If any contributing row was a user assumption or a proxy, the total is too.
  const provenance = usable.some((row) => row.provenance === "ASSUMED")
    ? "ASSUMED"
    : usable.some((row) => row.provenance === "DERIVED_PROXY")
      ? "DERIVED_PROXY"
      : "OBSERVED";

  return {
    key,
    unit: first.unit,
    baseline: round2(baseline),
    simulated: round2(simulated),
    delta: round2(simulated - baseline),
    engine: first.engine,
    provenance,
    unavailableReason: usable.length < rows.length ? "partial_coverage" : null,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
