// ============================================================================
// PMO Simulation — validation and conflict detection (CAP-049 §3)
// ============================================================================
// Runs BEFORE any stage mutates anything. Two jobs:
//
//   1. Resolve every intervention's target against the baseline. A target that
//      does not exist is reported, and its intervention is marked
//      not-computable — it is never silently skipped, because an intervention
//      that vanishes from the results looks like it had no effect.
//
//   2. Detect contradictory interventions. Two interventions that set the same
//      task to two different dates cannot both be true. Applying them in order
//      and keeping the last one produces a result that is internally consistent
//      and quietly wrong, which is worse than refusing. We surface the conflict
//      and let the user resolve it.
// ============================================================================

import type { SimBaseline } from "./baseline";
import type { SimIntervention, SimIssue, SimTarget } from "./contracts";

export interface ValidationResult {
  issues: SimIssue[];
  /** Interventions whose target does not exist in the baseline. */
  unresolvedTargets: SimTarget[];
  /** Intervention ids that cannot run: unresolved target or a hard conflict. */
  blockedInterventionIds: Set<string>;
  /** Why each blocked intervention is blocked. */
  blockReasonById: Map<string, string>;
}

/** Deterministic order: `order` first, then `id` so equal orders never race. */
export function sortInterventions(interventions: readonly SimIntervention[]): SimIntervention[] {
  return [...interventions].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id));
}

function targetExists(target: SimTarget, baseline: SimBaseline): boolean {
  switch (target.kind) {
    case "project":
      return baseline.projects.some((row) => row.id === target.id);
    case "milestone":
      return baseline.milestones.some((row) => row.id === target.id);
    case "task":
      return baseline.tasks.some((row) => row.id === target.id);
    case "risk":
      return baseline.risks.some((row) => row.id === target.id);
    case "resource":
      // A resource is identified by an allocation profile, a user, or a
      // resource id referenced by an assignment. Any of the three counts.
      return (
        baseline.allocations.some(
          (row) => row.resource_profile_id === target.id || row.user_id === target.id,
        ) || baseline.assignments.some((row) => row.resource_id === target.id)
      );
  }
}

export function validateScenario(
  interventions: readonly SimIntervention[],
  baseline: SimBaseline,
): ValidationResult {
  const issues: SimIssue[] = [];
  const unresolvedTargets: SimTarget[] = [];
  const blockedInterventionIds = new Set<string>();
  const blockReasonById = new Map<string, string>();

  const block = (id: string, reason: string) => {
    blockedInterventionIds.add(id);
    if (!blockReasonById.has(id)) blockReasonById.set(id, reason);
  };

  const active = sortInterventions(interventions).filter((item) => item.enabled);

  // ── 1. Target resolution ────────────────────────────────────────────────
  for (const intervention of active) {
    if (targetExists(intervention.target, baseline)) continue;
    unresolvedTargets.push(intervention.target);
    block(intervention.id, "target_not_found");
    issues.push({
      code: "target_not_found",
      severity: "warning",
      interventionIds: [intervention.id],
      detail: `${intervention.target.kind}:${intervention.target.id}`,
    });
  }

  // ── 2. Contradictions ───────────────────────────────────────────────────
  const runnable = active.filter((item) => !blockedInterventionIds.has(item.id));

  // 2a. Two schedule interventions setting the SAME task to different absolute
  // dates or durations. A delay stacked on a delay is additive and legitimate;
  // two different absolute answers to "when does this start" is not.
  const scheduleByTarget = new Map<string, typeof runnable>();
  for (const intervention of runnable) {
    if (intervention.kind !== "schedule") continue;
    const key = `${intervention.target.kind}:${intervention.target.id}`;
    scheduleByTarget.set(key, [...(scheduleByTarget.get(key) ?? []), intervention]);
  }
  for (const [key, group] of scheduleByTarget) {
    if (group.length < 2) continue;
    const absolute = group.filter(
      (item) =>
        item.kind === "schedule" &&
        (item.newStartDate != null || item.newEndDate != null || item.newDurationDays != null),
    );
    if (absolute.length >= 2) {
      const ids = absolute.map((item) => item.id);
      for (const id of ids) block(id, "conflicting_schedule_targets");
      issues.push({
        code: "conflicting_schedule_targets",
        severity: "conflict",
        interventionIds: ids,
        detail: key,
      });
    }
  }

  // 2b. The same risk driven in two incompatible directions — mitigated and
  // materialised at once. Order would decide the winner; that is not a decision
  // an engine should make on the user's behalf.
  const riskActions = new Map<string, { mitigating: string[]; materializing: string[] }>();
  for (const intervention of runnable) {
    if (intervention.kind !== "risk") continue;
    const entry = riskActions.get(intervention.target.id) ?? { mitigating: [], materializing: [] };
    if (intervention.action === "materialize") entry.materializing.push(intervention.id);
    else entry.mitigating.push(intervention.id);
    riskActions.set(intervention.target.id, entry);
  }
  for (const [riskId, entry] of riskActions) {
    if (entry.mitigating.length > 0 && entry.materializing.length > 0) {
      const ids = [...entry.mitigating, ...entry.materializing];
      for (const id of ids) block(id, "risk_mitigated_and_materialized");
      issues.push({
        code: "risk_mitigated_and_materialized",
        severity: "conflict",
        interventionIds: ids,
        detail: `risk:${riskId}`,
      });
    }
  }

  // 2c. Two budget interventions on the same target where one is absolute and
  // the other a percentage. Both are applicable in isolation; together the
  // result depends entirely on order, so the answer is ambiguous by definition.
  const budgetByTarget = new Map<string, typeof runnable>();
  for (const intervention of runnable) {
    if (intervention.kind !== "budget") continue;
    const key = `${intervention.target.kind}:${intervention.target.id}:${intervention.category ?? "*"}`;
    budgetByTarget.set(key, [...(budgetByTarget.get(key) ?? []), intervention]);
  }
  for (const [key, group] of budgetByTarget) {
    const hasAbsolute = group.some((i) => i.kind === "budget" && i.amountDelta != null);
    const hasPercent = group.some((i) => i.kind === "budget" && i.percentDelta != null);
    if (group.length >= 2 && hasAbsolute && hasPercent) {
      issues.push({
        code: "budget_absolute_and_percent_mixed",
        severity: "warning",
        interventionIds: group.map((item) => item.id),
        detail: key,
      });
    }
  }

  // 2d. A resource driven to two different availabilities over overlapping
  // periods. Same shape of ambiguity as 2a.
  const resourceByTarget = new Map<string, typeof runnable>();
  for (const intervention of runnable) {
    if (intervention.kind !== "resource") continue;
    const key = intervention.target.id;
    resourceByTarget.set(key, [...(resourceByTarget.get(key) ?? []), intervention]);
  }
  for (const [key, group] of resourceByTarget) {
    const absolute = group.filter(
      (item) => item.kind === "resource" && item.availabilityPercent != null,
    );
    if (absolute.length >= 2) {
      const ids = absolute.map((item) => item.id);
      for (const id of ids) block(id, "conflicting_resource_availability");
      issues.push({
        code: "conflicting_resource_availability",
        severity: "conflict",
        interventionIds: ids,
        detail: `resource:${key}`,
      });
    }
  }

  // ── 3. Well-formedness ──────────────────────────────────────────────────
  for (const intervention of runnable) {
    if (intervention.kind === "budget" && intervention.amountDelta == null && intervention.percentDelta == null) {
      block(intervention.id, "budget_change_not_specified");
      issues.push({
        code: "budget_change_not_specified",
        severity: "warning",
        interventionIds: [intervention.id],
        detail: null,
      });
    }
    if (
      intervention.kind === "schedule" &&
      intervention.delayDays == null &&
      intervention.newStartDate == null &&
      intervention.newEndDate == null &&
      intervention.newDurationDays == null
    ) {
      block(intervention.id, "schedule_change_not_specified");
      issues.push({
        code: "schedule_change_not_specified",
        severity: "warning",
        interventionIds: [intervention.id],
        detail: null,
      });
    }
    if (
      intervention.kind === "resource" &&
      intervention.availabilityPercent == null &&
      intervention.weeklyHoursDelta == null
    ) {
      block(intervention.id, "resource_change_not_specified");
      issues.push({
        code: "resource_change_not_specified",
        severity: "warning",
        interventionIds: [intervention.id],
        detail: null,
      });
    }
  }

  return { issues, unresolvedTargets, blockedInterventionIds, blockReasonById };
}
