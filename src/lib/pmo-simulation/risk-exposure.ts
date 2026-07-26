// ============================================================================
// PMO Simulation — risk exposure policy (CAP-049 §4)
// ============================================================================
// `risks` has no cost column and no duration column. It has a qualitative
// probability, a qualitative impact, a severity, and optional links to one task
// or one milestone. That is the whole of it.
//
// The tempting move is to map severity onto money — "critical = $100k" — and
// every simulator that does it produces confident, auditable-looking, entirely
// invented numbers. This module refuses. Severity is a label a human chose; it
// carries no monetary information whatsoever, and multiplying it by a constant
// does not create any.
//
// Three sources, in strict precedence:
//
//   1. ASSUMED         — the user typed the figure on the intervention. It is
//                        their assumption, labelled as theirs, and it is NEVER
//                        written back to `risks`.
//   2. DERIVED_PROXY   — derived from records the risk is actually LINKED to:
//                        cost from the budget of the linked task's milestone,
//                        days from that task's CPM float. Traceable end to end,
//                        and labelled as a proxy wherever it is shown.
//   3. UNAVAILABLE     — no assumption and nothing linked. We say so.
//
// Cost and days are returned as two separate values and are never summed,
// averaged, or folded into a single "exposure score".
// ============================================================================

import type { SimBaseline } from "./baseline";
import type { SimProvenance, SimRiskIntervention } from "./contracts";

/** One resolved exposure figure, in ONE unit, with its derivation. */
export interface ExposureValue {
  value: number | null;
  provenance: SimProvenance;
  /** Human-readable derivation chain. Empty when ASSUMED or UNAVAILABLE. */
  derivation: string[];
  /** Canonical rows the proxy walked, so the UI can link back. */
  evidence: { sourceTable: string; sourceId: string }[];
  /** Why the value is missing, when it is. */
  unavailableReason: string | null;
}

export interface RiskExposure {
  riskId: string;
  /** Currency. Never combined with `delayDays`. */
  cost: ExposureValue;
  /** Calendar days. Never combined with `cost`. */
  delayDays: ExposureValue;
}

const unavailable = (reason: string): ExposureValue => ({
  value: null,
  provenance: "UNAVAILABLE",
  derivation: [],
  evidence: [],
  unavailableReason: reason,
});

/** Total float per task id, supplied by the CPM run over the baseline. */
export type FloatByTaskId = ReadonlyMap<string, number>;

/**
 * Resolve one risk's exposure under the hybrid policy.
 *
 * @param floatByTask Total float from the BASELINE CPM run. Days come from real
 *                    schedule slack, never from severity.
 */
export function resolveRiskExposure(
  riskId: string,
  baseline: SimBaseline,
  intervention: Pick<SimRiskIntervention, "assumedCostImpact" | "assumedDelayDays"> | null,
  floatByTask: FloatByTaskId,
): RiskExposure {
  const risk = baseline.risks.find((row) => row.id === riskId);
  if (!risk) {
    return {
      riskId,
      cost: unavailable("risk_not_in_baseline"),
      delayDays: unavailable("risk_not_in_baseline"),
    };
  }

  // ── 1. ASSUMED ───────────────────────────────────────────────────────────
  // Resolved per-unit: a user may assert a cost without asserting days, and the
  // unasserted one still falls through to the proxy. Treating the pair as
  // all-or-nothing would discard a perfectly good derivation.
  const cost =
    intervention?.assumedCostImpact != null && Number.isFinite(intervention.assumedCostImpact)
      ? ({
          value: intervention.assumedCostImpact,
          provenance: "ASSUMED" as const,
          derivation: [],
          evidence: [],
          unavailableReason: null,
        } satisfies ExposureValue)
      : deriveCostProxy(risk, baseline);

  const delayDays =
    intervention?.assumedDelayDays != null && Number.isFinite(intervention.assumedDelayDays)
      ? ({
          value: intervention.assumedDelayDays,
          provenance: "ASSUMED" as const,
          derivation: [],
          evidence: [],
          unavailableReason: null,
        } satisfies ExposureValue)
      : deriveDelayProxy(risk, floatByTask);

  return { riskId, cost, delayDays };
}

/**
 * 2a. DERIVED_PROXY — cost.
 *
 * Walks: risk → linked task → its milestone → budget lines on that milestone.
 * When the risk links a milestone directly, that milestone is used. The figure
 * is the budget genuinely AT STAKE in the scope the risk touches; it is not a
 * prediction of loss, and the label says exactly that.
 *
 * No link, or a linked scope with no budget lines, yields UNAVAILABLE — never
 * a project-wide fallback, which would make an unlinked risk look expensive
 * purely because its project is large.
 */
function deriveCostProxy(
  risk: SimBaseline["risks"][number],
  baseline: SimBaseline,
): ExposureValue {
  const derivation: string[] = [];
  const evidence: { sourceTable: string; sourceId: string }[] = [];

  let milestoneId: string | null = risk.linked_milestone_id;

  if (!milestoneId && risk.linked_task_id) {
    const task = baseline.tasks.find((row) => row.id === risk.linked_task_id);
    if (!task) return unavailable("linked_task_not_in_baseline");
    evidence.push({ sourceTable: "roadmap_tasks", sourceId: task.id });
    derivation.push(`risk_linked_to_task:${task.title}`);
    milestoneId = task.milestone_id;
    if (!milestoneId) return unavailable("linked_task_has_no_milestone");
  }

  if (!milestoneId) return unavailable("risk_has_no_linked_scope");

  const milestone = baseline.milestones.find((row) => row.id === milestoneId);
  if (milestone) {
    evidence.push({ sourceTable: "milestones", sourceId: milestone.id });
    derivation.push(`scope_milestone:${milestone.title}`);
  }

  const lines = baseline.budgetItems.filter((item) => item.milestone_id === milestoneId);
  if (lines.length === 0) return unavailable("no_budget_lines_on_linked_scope");

  let total = 0;
  for (const line of lines) {
    total += line.estimated_cost ?? 0;
    evidence.push({ sourceTable: "budget_items", sourceId: line.id });
  }
  derivation.push(`sum_estimated_cost_of_${lines.length}_budget_lines`);

  return {
    value: round2(total),
    provenance: "DERIVED_PROXY",
    derivation,
    evidence,
    unavailableReason: null,
  };
}

/**
 * 2b. DERIVED_PROXY — days.
 *
 * The delay a risk could absorb before it moves the project is the linked
 * task's total float, straight from the CPM run. A task on the critical path
 * has zero float, so materialising a risk there costs day-for-day; a task with
 * 10 days of slack absorbs the first 10.
 *
 * Only a linked TASK yields this. A milestone has no float of its own in this
 * engine, and averaging its tasks' float would invent a number.
 */
function deriveDelayProxy(
  risk: SimBaseline["risks"][number],
  floatByTask: FloatByTaskId,
): ExposureValue {
  if (!risk.linked_task_id) return unavailable("risk_has_no_linked_task");
  const totalFloat = floatByTask.get(risk.linked_task_id);
  if (totalFloat == null) return unavailable("linked_task_not_scheduled");

  return {
    value: Math.max(0, totalFloat),
    provenance: "DERIVED_PROXY",
    derivation: [
      `risk_linked_to_task:${risk.linked_task_id}`,
      totalFloat <= 0
        ? "task_on_critical_path_zero_float"
        : `task_total_float_${totalFloat}_days`,
    ],
    evidence: [{ sourceTable: "roadmap_tasks", sourceId: risk.linked_task_id }],
    unavailableReason: null,
  };
}

/**
 * Residual weight after a risk action, 0–1.
 *
 * This scales an exposure the caller already resolved; it never creates one.
 * Applied to cost and to days INDEPENDENTLY, each staying in its own unit.
 */
export function residualWeight(
  action: SimRiskIntervention["action"],
  reductionPercent: number | null,
): number {
  const pct = reductionPercent == null ? 0 : Math.min(100, Math.max(0, reductionPercent));
  switch (action) {
    case "mitigate_full":
      return 0;
    case "mitigate_partial":
      // No explicit percentage means "half", stated as an assumption by the
      // engine rather than presented as a measurement.
      return reductionPercent == null ? 0.5 : 1 - pct / 100;
    case "reduce_probability":
    case "reduce_impact":
      return 1 - pct / 100;
    case "materialize":
      return 1;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
