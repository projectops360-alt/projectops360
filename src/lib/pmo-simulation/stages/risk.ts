// ============================================================================
// PMO Simulation — Stage: Risk (CAP-049 · intervention D)
// ============================================================================
// Applies the hybrid exposure policy from `risk-exposure.ts` and reports the
// result as TWO independent metrics: exposure in currency and exposure in days.
//
// They are never added, never averaged, and never reduced to a single score.
// A risk worth $80,000 and 12 days is two facts; "92" is neither of them. This
// is the specific arithmetic a PMO is most likely to be handed by a tool and
// least able to challenge, so the engine simply cannot produce it — there is no
// field for a combined figure anywhere in `SimMetric`.
//
// A mitigated risk reduces exposure it can prove. Where the exposure itself is
// UNAVAILABLE, the mitigation reports as "no quantified exposure" rather than a
// reduction of zero, which would read as "this mitigation achieves nothing".
// ============================================================================

import type { SimBaseline, SimWorkingCopy } from "../baseline";
import type { SimCausalStep, SimMetric, SimRiskIntervention } from "../contracts";
import { residualWeight, resolveRiskExposure, type FloatByTaskId } from "../risk-exposure";

export interface RiskStageOutcome {
  interventionId: string;
  computable: boolean;
  notComputableReason: string | null;
  affectedNodeIds: string[];
  metrics: SimMetric[];
  causalSteps: SimCausalStep[];
  assumptions: string[];
}

export function applyRiskIntervention(
  intervention: SimRiskIntervention,
  working: SimWorkingCopy,
  baseline: SimBaseline,
  floatByTask: FloatByTaskId,
): RiskStageOutcome {
  const assumptions: string[] = [];
  const riskId = intervention.target.id;
  const risk = baseline.risks.find((row) => row.id === riskId);

  if (!risk) {
    return {
      interventionId: intervention.id,
      computable: false,
      notComputableReason: "risk_not_in_baseline",
      affectedNodeIds: [],
      metrics: [],
      causalSteps: [],
      assumptions,
    };
  }

  const exposure = resolveRiskExposure(riskId, baseline, intervention, floatByTask);
  const weight = residualWeight(intervention.action, intervention.reductionPercent);

  // Record the scenario's view of this risk on the working copy. Nothing here
  // is ever written back to `risks` — the table has no such columns and a
  // simulation input is not a domain fact.
  if (intervention.action === "materialize") {
    working.materializedRiskIds.add(riskId);
  } else if (weight === 0) {
    working.neutralizedRiskIds.add(riskId);
  }
  working.riskWeight.set(riskId, weight);

  if (intervention.action === "mitigate_partial" && intervention.reductionPercent == null) {
    assumptions.push("risk_partial_mitigation_assumed_50_percent");
  }
  if (exposure.cost.provenance === "ASSUMED" || exposure.delayDays.provenance === "ASSUMED") {
    assumptions.push("risk_exposure_supplied_by_user_not_measured");
  }
  if (exposure.cost.provenance === "DERIVED_PROXY") {
    assumptions.push("risk_cost_is_budget_at_stake_proxy_not_predicted_loss");
  }
  if (exposure.delayDays.provenance === "DERIVED_PROXY") {
    assumptions.push("risk_delay_proxy_is_linked_task_float");
  }

  const metrics: SimMetric[] = [];

  // ── Exposure in CURRENCY ────────────────────────────────────────────────
  if (exposure.cost.value == null) {
    metrics.push({
      key: "risk_exposure_cost",
      unit: "currency",
      baseline: null,
      simulated: null,
      delta: null,
      engine: "risk_policy",
      provenance: "UNAVAILABLE",
      unavailableReason: exposure.cost.unavailableReason,
    });
  } else {
    const base = exposure.cost.value;
    // Materialising a risk brings its full exposure into the picture; the
    // baseline for that comparison is zero, because an unmaterialised risk has
    // not cost anything yet.
    const simulated = intervention.action === "materialize" ? base : base * weight;
    const baselineValue = intervention.action === "materialize" ? 0 : base;
    metrics.push({
      key: "risk_exposure_cost",
      unit: "currency",
      baseline: round2(baselineValue),
      simulated: round2(simulated),
      delta: round2(simulated - baselineValue),
      engine: "risk_policy",
      provenance: exposure.cost.provenance,
      unavailableReason: null,
    });
  }

  // ── Exposure in DAYS ────────────────────────────────────────────────────
  if (exposure.delayDays.value == null) {
    metrics.push({
      key: "risk_exposure_days",
      unit: "days",
      baseline: null,
      simulated: null,
      delta: null,
      engine: "risk_policy",
      provenance: "UNAVAILABLE",
      unavailableReason: exposure.delayDays.unavailableReason,
    });
  } else {
    const base = exposure.delayDays.value;
    const simulated = intervention.action === "materialize" ? base : base * weight;
    const baselineValue = intervention.action === "materialize" ? 0 : base;
    metrics.push({
      key: "risk_exposure_days",
      unit: "days",
      baseline: round2(baselineValue),
      simulated: round2(simulated),
      delta: round2(simulated - baselineValue),
      engine: "risk_policy",
      provenance: exposure.delayDays.provenance,
      unavailableReason: null,
    });
  }

  // ── Open risk count ─────────────────────────────────────────────────────
  const wasOpen = risk.status === "open" || risk.status === "mitigating";
  const stillOpen = intervention.action === "materialize" ? true : weight > 0;
  metrics.push({
    key: "open_risks",
    unit: "count",
    baseline: wasOpen ? 1 : 0,
    simulated: wasOpen && stillOpen ? 1 : 0,
    delta: (wasOpen && stillOpen ? 1 : 0) - (wasOpen ? 1 : 0),
    engine: "risk_policy",
    provenance: "OBSERVED",
    unavailableReason: null,
  });

  // ── Causal chain ────────────────────────────────────────────────────────
  const steps: SimCausalStep[] = [
    { kind: "intervention", id: intervention.id, label: intervention.label, evidence: null },
    {
      kind: "node",
      id: `risk:${riskId}`,
      label: risk.title,
      evidence: { sourceTable: "risks", sourceId: riskId },
    },
  ];

  // The derivation chain IS the explanation — each hop cites the row it walked.
  for (const ref of [...exposure.cost.evidence, ...exposure.delayDays.evidence]) {
    steps.push({
      kind: ref.sourceTable === "milestones" ? "milestone" : "node",
      id: `${ref.sourceTable}:${ref.sourceId}`,
      label: ref.sourceTable,
      evidence: ref,
    });
  }

  const affected = new Set<string>([`risk:${riskId}`, `project:${risk.project_id}`]);
  if (risk.linked_task_id) affected.add(`task:${risk.linked_task_id}`);
  if (risk.linked_milestone_id) affected.add(`milestone:${risk.linked_milestone_id}`);

  steps.push({
    kind: "project",
    id: `project:${risk.project_id}`,
    label: baseline.projects.find((row) => row.id === risk.project_id)?.title ?? risk.project_id,
    evidence: { sourceTable: "projects", sourceId: risk.project_id },
  });
  steps.push({
    kind: "metric",
    id: "risk_exposure_cost",
    label: "risk_exposure_cost",
    evidence: null,
  });

  return {
    interventionId: intervention.id,
    computable: true,
    notComputableReason: null,
    affectedNodeIds: [...affected],
    metrics,
    causalSteps: steps,
    assumptions,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
