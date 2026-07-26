// ============================================================================
// PMO Simulation — Stage: Budget (CAP-049 · intervention A)
// ============================================================================
// HARD RULE, enforced here by omission: this stage writes to budget lines and
// to nothing else. It cannot reach tasks, durations or dependencies. Increasing
// a budget therefore CANNOT shorten a schedule, because there is no code path
// from this file to one.
//
// That is deliberate and it is not a limitation to be fixed later. Money buys
// time only through a crash-cost model — a per-task curve saying what an extra
// dollar actually accelerates. This product has no such data. Wiring budget to
// duration without it would let a PMO "solve" a late project by typing a bigger
// number, which is the most expensive lie a planning tool can tell.
//
// Financial consequence is computed by the EVM stage, from the values this
// stage produces. Where EVM inputs are missing, the metric says unavailable
// rather than inventing an EAC.
// ============================================================================

import type { SimBudgetRow, SimWorkingCopy } from "../baseline";
import type { SimBudgetIntervention, SimCausalStep, SimMetric } from "../contracts";

export interface BudgetStageOutcome {
  interventionId: string;
  computable: boolean;
  notComputableReason: string | null;
  affectedNodeIds: string[];
  metrics: SimMetric[];
  causalSteps: SimCausalStep[];
  assumptions: string[];
}

/** Budget lines the intervention actually reaches, honouring the category scope. */
function linesInScope(
  intervention: SimBudgetIntervention,
  lines: readonly SimBudgetRow[],
  milestoneIdsByProject: ReadonlyMap<string, Set<string>>,
): SimBudgetRow[] {
  const matchesCategory = (line: SimBudgetRow) =>
    intervention.category == null || line.category === intervention.category;

  switch (intervention.target.kind) {
    case "project":
      return lines.filter(
        (line) => line.project_id === intervention.target.id && matchesCategory(line),
      );
    case "milestone":
      return lines.filter(
        (line) => line.milestone_id === intervention.target.id && matchesCategory(line),
      );
    case "task": {
      // budget_items has no task_id: the finest real granularity is the
      // milestone. Resolving a task target to its milestone's lines is stated
      // as an assumption rather than performed silently.
      const ids = milestoneIdsByProject.get(intervention.target.id);
      if (!ids) return [];
      return lines.filter(
        (line) => line.milestone_id != null && ids.has(line.milestone_id) && matchesCategory(line),
      );
    }
    default:
      return [];
  }
}

/**
 * Apply one budget intervention to the working copy.
 *
 * A percentage change scales `estimated_cost` proportionally across the lines
 * in scope. An absolute amount is distributed pro rata by each line's share of
 * the scope's total — spreading it evenly would misstate small lines, and
 * putting it all on one line would be arbitrary.
 */
export function applyBudgetIntervention(
  intervention: SimBudgetIntervention,
  working: SimWorkingCopy,
  taskMilestoneIndex: ReadonlyMap<string, Set<string>>,
): BudgetStageOutcome {
  const assumptions: string[] = [];
  const scope = linesInScope(intervention, working.budgetItems, taskMilestoneIndex);

  if (scope.length === 0) {
    return {
      interventionId: intervention.id,
      computable: false,
      notComputableReason:
        intervention.category != null
          ? "no_budget_lines_for_target_and_category"
          : "no_budget_lines_for_target",
      affectedNodeIds: [],
      metrics: [],
      causalSteps: [],
      assumptions,
    };
  }

  if (intervention.target.kind === "task") {
    assumptions.push("budget_task_target_resolved_to_milestone_lines");
  }

  const baselineTotal = scope.reduce((sum, line) => sum + (line.estimated_cost ?? 0), 0);

  let appliedDelta = 0;
  if (intervention.percentDelta != null) {
    appliedDelta = baselineTotal * (intervention.percentDelta / 100);
    for (const line of scope) {
      line.estimated_cost = round2(
        (line.estimated_cost ?? 0) * (1 + intervention.percentDelta / 100),
      );
    }
  } else if (intervention.amountDelta != null) {
    appliedDelta = intervention.amountDelta;
    if (baselineTotal <= 0) {
      // Pro rata is undefined against a zero total; splitting evenly is the
      // only non-arbitrary alternative, and it is declared.
      const share = intervention.amountDelta / scope.length;
      assumptions.push("budget_absolute_split_evenly_zero_baseline");
      for (const line of scope) line.estimated_cost = round2((line.estimated_cost ?? 0) + share);
    } else {
      for (const line of scope) {
        const weight = (line.estimated_cost ?? 0) / baselineTotal;
        line.estimated_cost = round2(
          (line.estimated_cost ?? 0) + intervention.amountDelta * weight,
        );
      }
    }
  }

  const simulatedTotal = scope.reduce((sum, line) => sum + (line.estimated_cost ?? 0), 0);

  const metrics: SimMetric[] = [
    {
      key: "budget_scope_total",
      unit: "currency",
      baseline: round2(baselineTotal),
      simulated: round2(simulatedTotal),
      delta: round2(simulatedTotal - baselineTotal),
      engine: "projection",
      provenance: "OBSERVED",
      unavailableReason: null,
    },
  ];

  // Contingency is a real category in budget_items, so it is reported only when
  // lines of that category are genuinely in scope.
  const contingency = scope.filter((line) => line.category === "contingency");
  if (contingency.length > 0) {
    const simulatedContingency = contingency.reduce(
      (sum, line) => sum + (line.estimated_cost ?? 0),
      0,
    );
    const baselineContingency =
      intervention.percentDelta != null
        ? simulatedContingency / (1 + intervention.percentDelta / 100)
        : simulatedContingency - appliedDelta * (simulatedContingency / (simulatedTotal || 1));
    metrics.push({
      key: "budget_contingency",
      unit: "currency",
      baseline: round2(baselineContingency),
      simulated: round2(simulatedContingency),
      delta: round2(simulatedContingency - baselineContingency),
      engine: "projection",
      provenance: "OBSERVED",
      unavailableReason: null,
    });
  }

  const causalSteps: SimCausalStep[] = [
    {
      kind: "intervention",
      id: intervention.id,
      label: intervention.label,
      evidence: null,
    },
    ...scope.slice(0, 10).map(
      (line): SimCausalStep => ({
        kind: "node",
        id: `budget_item:${line.id}`,
        label: line.name,
        evidence: { sourceTable: "budget_items", sourceId: line.id },
      }),
    ),
    {
      kind: "metric",
      id: "budget_scope_total",
      label: "budget_scope_total",
      evidence: null,
    },
  ];

  return {
    interventionId: intervention.id,
    computable: true,
    notComputableReason: null,
    affectedNodeIds: scope.map((line) => `budget_item:${line.id}`),
    metrics,
    causalSteps,
    assumptions,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
