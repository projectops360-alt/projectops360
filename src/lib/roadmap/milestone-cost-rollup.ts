// ============================================================================
// What a milestone cost — effort, money, and what we cannot yet know
// ============================================================================
// "How much did this phase cost me?" had no answer anywhere in the product.
// The parts were all there — tasks carry hours and a milestone_id, budget
// lines carry money — but nothing added them up per milestone.
//
// This does, and is equally explicit about what is NOT knowable from the data:
// a figure the product cannot support is left null rather than guessed, so a
// card can say "not available" instead of showing a confident zero.
// ============================================================================

import type { Milestone, RoadmapTask } from "@/types/database";
import { TASK_COMPLETE_STATUSES } from "./status-mappings";

export interface BudgetLineLike {
  name: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  /**
   * The real link, when it exists. budget_items has this FK, but nothing
   * populates it today — every imported plan leaves it null and expresses the
   * relationship by sharing a name. Honoured first so that the day a budget
   * line is properly linked, the name stops mattering.
   */
  milestone_id?: string | null;
}

export interface MaterialLike {
  required_by_task_id: string | null;
  estimated_total_cost: number | null;
}

/** A resource whose rate turns a task's hours into money. */
export interface ResourceRateLike {
  id: string;
  cost_rate: number | null;
  /** "hour" | "day" | … — only hourly rates can price hours directly. */
  cost_unit: string | null;
}

export interface MilestoneCostRollup {
  milestoneId: string;
  /** Tasks under this milestone (excluding deleted). */
  taskCount: number;
  tasksDone: number;

  // ── Effort ────────────────────────────────────────────────────────────────
  estimatedHours: number;
  actualHours: number;
  /** actual − estimated. Positive means it took longer than planned. */
  varianceHours: number;

  // ── Time ──────────────────────────────────────────────────────────────────
  /** Calendar days from the earliest task start to the latest task end. */
  plannedDurationDays: number | null;

  // ── Money ─────────────────────────────────────────────────────────────────
  /**
   * Budget assigned to this milestone, matched from the project's budget
   * lines by name. Null when no line names this milestone — the honest answer
   * when a phase simply has no budget of its own.
   */
  budget: number | null;
  /** Materials required by this milestone's tasks. Null when none are linked. */
  materialCost: number | null;
  /**
   * Labour cost: each task's hours priced at the rate of the resource assigned
   * to it, summed. Null when no assigned resource has a rate — hours cannot
   * become money without one, and a default rate would put a fabricated number
   * on an executive card.
   */
  labourCost: number | null;
  /**
   * Tasks that could not be priced because their resource has no rate (or none
   * is assigned). Reported so a partial figure is never mistaken for a total.
   */
  tasksWithoutRate: number;
  /** budget + material + labour, or null while any component is unknowable. */
  totalCost: number | null;
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function daysBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Roll a milestone's tasks up into effort, time and money.
 *
 * Budget lines are matched to the milestone BY NAME because that is how the
 * relationship exists in imported plans: a phase and its budget line share a
 * name ("Preparación"), with no foreign key between them. Matching is
 * accent- and case-insensitive so "Exploración" finds "exploracion".
 */
export function computeMilestoneCostRollup(
  milestone: Milestone,
  tasks: RoadmapTask[],
  budgetLines: BudgetLineLike[] = [],
  materials: MaterialLike[] = [],
  hourlyRate: number | null = null,
  resourceRates: ResourceRateLike[] = [],
): MilestoneCostRollup {
  const own = tasks.filter((t) => t.milestone_id === milestone.id && !t.deleted_at);

  const estimatedHours = own.reduce((sum, t) => sum + (Number(t.estimate_hours) || 0), 0);
  const actualHours = own.reduce((sum, t) => sum + (Number(t.actual_hours) || 0), 0);

  const starts = own.map((t) => t.start_date).filter((d): d is string => !!d).sort();
  const ends = own.map((t) => t.end_date).filter((d): d is string => !!d).sort();
  const plannedDurationDays =
    starts.length > 0 && ends.length > 0 ? daysBetween(starts[0], ends[ends.length - 1]) : null;

  // Prefer the foreign key; fall back to the shared name. Once ANY line names
  // this milestone by id, name matches are ignored entirely — mixing the two
  // would double-count a line that is both linked and identically named.
  const milestoneKey = normalize(milestone.title);
  const linked = budgetLines.filter((b) => b.milestone_id === milestone.id);
  const matched =
    linked.length > 0
      ? linked
      : budgetLines.filter((b) => milestoneKey && normalize(b.name) === milestoneKey);
  const budget = matched.length > 0
    ? matched.reduce((sum, b) => sum + (Number(b.estimated_cost) || 0), 0)
    : null;

  const ownTaskIds = new Set(own.map((t) => t.id));
  const linkedMaterials = materials.filter(
    (m) => m.required_by_task_id != null && ownTaskIds.has(m.required_by_task_id),
  );
  const materialCost = linkedMaterials.length > 0
    ? linkedMaterials.reduce((sum, m) => sum + (Number(m.estimated_total_cost) || 0), 0)
    : null;

  // Labour cost is priced PER TASK, at the rate of the resource doing it —
  // people cost different amounts, and one blended rate would flatten exactly
  // the difference a PM is looking for. Hours actually logged are used when
  // there are any, otherwise the estimate, so a plan can be costed before work
  // starts.
  const rateByResource = new Map(
    resourceRates
      .filter((r) => r.cost_rate != null && r.cost_rate > 0 && (r.cost_unit ?? "hour") === "hour")
      .map((r) => [r.id, Number(r.cost_rate)]),
  );

  let labourCost: number | null = null;
  let tasksWithoutRate = 0;
  for (const t of own) {
    const hours = Number(t.actual_hours) || Number(t.estimate_hours) || 0;
    const rate = t.assigned_resource_id ? rateByResource.get(t.assigned_resource_id) : undefined;
    if (rate == null) {
      if (hours > 0) tasksWithoutRate++;
      continue;
    }
    labourCost = (labourCost ?? 0) + hours * rate;
  }

  // An explicit blended rate still works as a fallback for whoever wants one.
  if (labourCost == null && hourlyRate != null && hourlyRate > 0) {
    labourCost = actualHours * hourlyRate;
  }

  const components = [budget, materialCost, labourCost];
  const totalCost = components.some((c) => c != null)
    ? components.reduce((sum: number, c) => sum + (c ?? 0), 0)
    : null;

  return {
    milestoneId: milestone.id,
    taskCount: own.length,
    tasksDone: own.filter((t) => TASK_COMPLETE_STATUSES.includes(t.status)).length,
    estimatedHours,
    actualHours,
    varianceHours: actualHours - estimatedHours,
    plannedDurationDays,
    budget,
    materialCost,
    labourCost,
    tasksWithoutRate,
    totalCost,
  };
}

/** Roll up every milestone in one pass. */
export function computeMilestoneCostRollups(
  milestones: Milestone[],
  tasks: RoadmapTask[],
  budgetLines: BudgetLineLike[] = [],
  materials: MaterialLike[] = [],
  hourlyRate: number | null = null,
  resourceRates: ResourceRateLike[] = [],
): Map<string, MilestoneCostRollup> {
  return new Map(
    milestones.map((m) => [
      m.id,
      computeMilestoneCostRollup(m, tasks, budgetLines, materials, hourlyRate, resourceRates),
    ]),
  );
}
