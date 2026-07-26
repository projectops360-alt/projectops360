// ============================================================================
// PMO Simulation — Stage: Resource (CAP-049 · intervention C)
// ============================================================================
// HARD RULE: a resource change affects ONLY tasks genuinely linked to that
// resource. The link must exist as a row somewhere:
//
//   * resource_assignments.resource_id          (explicit, carries planned_hours)
//   * roadmap_tasks.assigned_resource_id        (crew/equipment/vendor)
//   * roadmap_tasks.assigned_to                 (single user owner)
//
// If none of those match, the intervention is KEPT and reported as affecting no
// work. The alternative — falling back to "everyone on the project" — makes
// every resource look portfolio-critical and turns the whole feature into
// noise.
//
// UNIT DISCIPLINE (CAP-048 §5): everything here is HOURS, produced by the
// generic capacity engine in lib/capacity/formulas. `lib/labor/capacity` counts
// HEADCOUNT and is a different engine answering a different question. The two
// are never summed, and every metric this stage emits is tagged
// engine:"capacity_generic" so the UI can say which one spoke.
// ============================================================================

import {
  classifyCapacityStatus,
  effectiveCapacityHours,
  overallocatedHours,
  utilizationPercent,
} from "@/lib/capacity/formulas";
import type { SimAllocationRow, SimBaseline, SimWorkingCopy } from "../baseline";
import type { SimCausalStep, SimMetric, SimResourceIntervention } from "../contracts";

export interface ResourceStageOutcome {
  interventionId: string;
  computable: boolean;
  notComputableReason: string | null;
  affectedNodeIds: string[];
  metrics: SimMetric[];
  causalSteps: SimCausalStep[];
  assumptions: string[];
}

/**
 * Tasks genuinely linked to a resource. Returns the ids plus which link proved
 * it, so the causal chain can cite the actual row.
 */
export function linkedTaskIds(
  resourceId: string,
  baseline: SimBaseline,
): { taskId: string; via: "resource_assignments" | "assigned_resource_id" | "assigned_to" }[] {
  const found = new Map<string, "resource_assignments" | "assigned_resource_id" | "assigned_to">();

  for (const assignment of baseline.assignments) {
    if (assignment.resource_id === resourceId) found.set(assignment.task_id, "resource_assignments");
  }
  for (const task of baseline.tasks) {
    if (task.assigned_resource_id === resourceId && !found.has(task.id)) {
      found.set(task.id, "assigned_resource_id");
    }
    if (task.assigned_to === resourceId && !found.has(task.id)) {
      found.set(task.id, "assigned_to");
    }
  }

  return [...found.entries()].map(([taskId, via]) => ({ taskId, via }));
}

/** Allocations describing this resource's capacity. */
function allocationsFor(resourceId: string, allocations: readonly SimAllocationRow[]) {
  return allocations.filter(
    (row) =>
      (row.resource_profile_id === resourceId || row.user_id === resourceId) &&
      row.status === "active",
  );
}

/** Assigned hours on a set of tasks, from the most reliable source available. */
function assignedHours(
  taskIds: readonly string[],
  resourceId: string,
  baseline: SimBaseline,
): { hours: number; provenance: "OBSERVED" | "UNAVAILABLE"; reason: string | null } {
  const ids = new Set(taskIds);

  // planned_hours on the assignment is the resource-specific figure; prefer it.
  const planned = baseline.assignments.filter(
    (row) => row.resource_id === resourceId && ids.has(row.task_id) && row.planned_hours != null,
  );
  if (planned.length > 0) {
    return {
      hours: planned.reduce((sum, row) => sum + (row.planned_hours ?? 0), 0),
      provenance: "OBSERVED",
      reason: null,
    };
  }

  // Otherwise the task's own estimate. This attributes the WHOLE estimate to
  // this resource, which is only right when the task has a single assignee —
  // declared as an assumption by the caller.
  const estimates = baseline.tasks.filter((task) => ids.has(task.id) && task.estimate_hours != null);
  if (estimates.length > 0) {
    return {
      hours: estimates.reduce((sum, task) => sum + (task.estimate_hours ?? 0), 0),
      provenance: "OBSERVED",
      reason: null,
    };
  }

  return { hours: 0, provenance: "UNAVAILABLE", reason: "no_planned_or_estimated_hours" };
}

/**
 * Apply one resource intervention.
 *
 * Capacity is recomputed with the generic engine from the modified allocation
 * rows. Utilization is reported as a percentage and overload as hours — two
 * different units, two different fields, never merged into one "capacity score".
 */
export function applyResourceIntervention(
  intervention: SimResourceIntervention,
  working: SimWorkingCopy,
  baseline: SimBaseline,
): ResourceStageOutcome {
  const assumptions: string[] = [];
  const resourceId = intervention.target.id;
  const rows = allocationsFor(resourceId, working.allocations);

  if (rows.length === 0) {
    return {
      interventionId: intervention.id,
      computable: false,
      notComputableReason: "resource_has_no_active_allocation",
      affectedNodeIds: [],
      metrics: [],
      causalSteps: [],
      assumptions,
    };
  }

  const links = linkedTaskIds(resourceId, baseline);

  // ── Baseline capacity, before the edit ──────────────────────────────────
  const baseEffective = rows.reduce(
    (sum, row) =>
      sum +
      effectiveCapacityHours(
        row.weekly_capacity_hours ?? 0,
        row.availability_percent ?? 100,
        row.overhead_percent ?? 0,
      ),
    0,
  );

  // ── Edit ────────────────────────────────────────────────────────────────
  for (const row of rows) {
    if (intervention.availabilityPercent != null) {
      row.availability_percent = Math.min(100, Math.max(0, intervention.availabilityPercent));
    }
    if (intervention.weeklyHoursDelta != null) {
      row.weekly_capacity_hours = Math.max(
        0,
        (row.weekly_capacity_hours ?? 0) + intervention.weeklyHoursDelta,
      );
    }
  }

  if (intervention.periodStart != null || intervention.periodEnd != null) {
    // Allocations carry a validity window, but the generic capacity engine is
    // a weekly rate model with no time axis. Applying the change to the whole
    // allocation is the honest reading; pretending it is time-boxed would
    // imply a precision the engine does not have.
    assumptions.push("resource_period_applied_to_whole_allocation_no_time_axis");
  }

  const simEffective = rows.reduce(
    (sum, row) =>
      sum +
      effectiveCapacityHours(
        row.weekly_capacity_hours ?? 0,
        row.availability_percent ?? 100,
        row.overhead_percent ?? 0,
      ),
    0,
  );

  const metrics: SimMetric[] = [
    {
      key: "resource_effective_hours",
      unit: "hours",
      baseline: round2(baseEffective),
      simulated: round2(simEffective),
      delta: round2(simEffective - baseEffective),
      engine: "capacity_generic",
      provenance: "OBSERVED",
      unavailableReason: null,
    },
  ];

  // ── Demand, and therefore utilization and overload ──────────────────────
  if (links.length === 0) {
    // The hard rule, made visible: capacity changed, no work is attached to it.
    metrics.push({
      key: "resource_linked_tasks",
      unit: "count",
      baseline: 0,
      simulated: 0,
      delta: 0,
      engine: "capacity_generic",
      provenance: "OBSERVED",
      unavailableReason: null,
    });
    return {
      interventionId: intervention.id,
      computable: true,
      notComputableReason: null,
      affectedNodeIds: [`resource:${resourceId}`],
      metrics,
      causalSteps: [
        { kind: "intervention", id: intervention.id, label: intervention.label, evidence: null },
        {
          kind: "node",
          id: `resource:${resourceId}`,
          label: rows[0]?.display_name ?? resourceId,
          evidence: { sourceTable: "project_resource_allocations", sourceId: rows[0]?.id ?? resourceId },
        },
      ],
      assumptions: [...assumptions, "resource_change_affects_no_linked_task"],
    };
  }

  const taskIds = links.map((link) => link.taskId);
  const demand = assignedHours(taskIds, resourceId, baseline);

  metrics.push({
    key: "resource_linked_tasks",
    unit: "count",
    baseline: links.length,
    simulated: links.length,
    delta: 0,
    engine: "capacity_generic",
    provenance: "OBSERVED",
    unavailableReason: null,
  });

  if (demand.provenance === "UNAVAILABLE") {
    metrics.push(
      {
        key: "resource_utilization",
        unit: "percent",
        baseline: null,
        simulated: null,
        delta: null,
        engine: "capacity_generic",
        provenance: "UNAVAILABLE",
        unavailableReason: demand.reason,
      },
      {
        key: "resource_overallocated_hours",
        unit: "hours",
        baseline: null,
        simulated: null,
        delta: null,
        engine: "capacity_generic",
        provenance: "UNAVAILABLE",
        unavailableReason: demand.reason,
      },
    );
  } else {
    if (
      !baseline.assignments.some(
        (row) => row.resource_id === resourceId && row.planned_hours != null,
      )
    ) {
      assumptions.push("resource_demand_from_task_estimates_assumes_single_assignee");
    }

    const baseUtil = utilizationPercent(demand.hours, baseEffective);
    const simUtil = utilizationPercent(demand.hours, simEffective);
    const baseOver = overallocatedHours(demand.hours, baseEffective);
    const simOver = overallocatedHours(demand.hours, simEffective);

    metrics.push(
      {
        key: "resource_utilization",
        unit: "percent",
        baseline: baseUtil,
        simulated: simUtil,
        delta: baseUtil != null && simUtil != null ? round2(simUtil - baseUtil) : null,
        engine: "capacity_generic",
        provenance: "OBSERVED",
        unavailableReason: baseUtil == null || simUtil == null ? "no_effective_capacity" : null,
      },
      {
        key: "resource_overallocated_hours",
        unit: "hours",
        baseline: baseOver,
        simulated: simOver,
        delta: round2(simOver - baseOver),
        engine: "capacity_generic",
        provenance: "OBSERVED",
        unavailableReason: null,
      },
      {
        key: "resource_status_changed",
        unit: "count",
        baseline: 0,
        simulated:
          classifyCapacityStatus(baseUtil, baseEffective > 0) ===
          classifyCapacityStatus(simUtil, simEffective > 0)
            ? 0
            : 1,
        delta:
          classifyCapacityStatus(baseUtil, baseEffective > 0) ===
          classifyCapacityStatus(simUtil, simEffective > 0)
            ? 0
            : 1,
        engine: "capacity_generic",
        provenance: "OBSERVED",
        unavailableReason: null,
      },
    );
  }

  const causalSteps: SimCausalStep[] = [
    { kind: "intervention", id: intervention.id, label: intervention.label, evidence: null },
    {
      kind: "node",
      id: `resource:${resourceId}`,
      label: rows[0]?.display_name ?? resourceId,
      evidence: {
        sourceTable: "project_resource_allocations",
        sourceId: rows[0]?.id ?? resourceId,
      },
    },
    ...links.slice(0, 10).map(({ taskId, via }): SimCausalStep => {
      const task = baseline.tasks.find((row) => row.id === taskId);
      return {
        kind: "node",
        id: `task:${taskId}`,
        label: task?.title ?? taskId,
        evidence: { sourceTable: via === "resource_assignments" ? "resource_assignments" : "roadmap_tasks", sourceId: taskId },
      };
    }),
    { kind: "metric", id: "resource_utilization", label: "resource_utilization", evidence: null },
  ];

  return {
    interventionId: intervention.id,
    computable: true,
    notComputableReason: null,
    affectedNodeIds: [`resource:${resourceId}`, ...taskIds.map((id) => `task:${id}`)],
    metrics,
    causalSteps,
    assumptions,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
