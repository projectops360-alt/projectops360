// ============================================================================
// ProjectOps360° — Project Execution Rollup Engine (REG-010)
// ============================================================================
// THE single deterministic source of truth for project-level execution counts
// (active blockers, waiting-on-dependency, priority mix, milestone health,
// capacity warnings). Every surface — Living Graph header, Executive Insights,
// PMO Summary, Resource Capacity — should agree because they share this engine
// (or the shared rules it is built on: see ./task-activity).
//
// Design principles (REG-010):
//   1. Fix the data/status/scope, never paper over it with frontend formatting.
//   2. Completed/terminal tasks NEVER count as active blockers, waiting, or
//      capacity risks.
//   3. Every metric declares its SCOPE so two numbers are only comparable when
//      their scopes match. No-owner / missing-estimate are capacity warnings,
//      not blockers, and live in a separate bucket.
//   4. Optional dev-only debug metadata exposes the exact entity ids behind
//      each count (gated by the caller; never rendered in production UI).
// ============================================================================

import type {
  RoadmapTask,
  Milestone,
  TaskDependency,
  MilestoneStatusDisplay,
} from "@/types/database";
import { hasActiveBlocker, isActiveStatus, isUnassigned } from "@/lib/execution/task-activity";
import { getComputedMilestoneStatus } from "@/lib/roadmap/progress";

/** A metric value carrying the scope it was computed over, so it is comparable. */
export interface ScopedMetric {
  value: number;
  /** Human-readable scope, bilingual. e.g. "active tasks" / "tareas activas". */
  scope: { en: string; es: string };
  /** Dev-only: entity ids that contributed to this count. */
  evidenceIds: string[];
}

export interface ProjectExecutionRollup {
  /** Tasks with an explicit, unresolved impediment (status blocked OR is_blocked on a non-terminal task). */
  activeBlockers: ScopedMetric;
  /** Active tasks waiting on an incomplete predecessor dependency (not blocked). */
  waitingOnDependency: ScopedMetric;
  /** Active tasks past their planned finish date. */
  overdue: ScopedMetric;
  /** Active tasks without a person or resource assigned (capacity warning, not a blocker). */
  unassignedActive: ScopedMetric;
  /** Active tasks with no estimate (forecast warning, not a blocker). */
  missingEstimateActive: ScopedMetric;
  /** Priority mix across ACTIVE tasks only (terminal work excluded). */
  priorityActive: { p1: ScopedMetric; p2: ScopedMetric; p3: ScopedMetric };
  /** Milestone health distribution from computed (live) status. */
  milestoneHealth: Record<MilestoneStatusDisplay, number>;
  /** Counters describing the fixture the rollup was computed over. */
  counts: { totalTasks: number; activeTasks: number; completedTasks: number; milestones: number };
}

const SCOPE_ACTIVE = { en: "active tasks", es: "tareas activas" } as const;

function metric(scope: { en: string; es: string }, ids: string[]): ScopedMetric {
  return { value: ids.length, scope, evidenceIds: ids };
}

export interface RollupInput {
  tasks: RoadmapTask[];
  milestones: Milestone[];
  dependencies?: TaskDependency[];
  /** Reference "today" (ISO yyyy-mm-dd) for overdue math. Defaults to now. */
  today?: string;
}

/**
 * Compute the canonical project execution rollup. Pure function — the caller
 * batch-loads project data and passes it in.
 */
export function computeProjectExecutionRollup(input: RollupInput): ProjectExecutionRollup {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const tasks = input.tasks.filter((t) => !t.deleted_at);
  const active = tasks.filter((t) => isActiveStatus(t.status));
  const completed = tasks.length - active.length;

  // ── Active blockers (explicit impediments only; terminal tasks excluded) ──
  const blockerIds = tasks.filter((t) => hasActiveBlocker(t)).map((t) => t.id);

  // ── Waiting on dependency (active task whose predecessor is not complete) ──
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const waitingIds: string[] = [];
  if (input.dependencies && input.dependencies.length > 0) {
    // map: successor task -> predecessor task ids it depends on
    const preds = new Map<string, string[]>();
    for (const d of input.dependencies) {
      const arr = preds.get(d.successor_id) ?? [];
      arr.push(d.predecessor_id);
      preds.set(d.successor_id, arr);
    }
    for (const t of active) {
      if (hasActiveBlocker(t)) continue; // blocked is reported separately, not "waiting"
      const ps = preds.get(t.id);
      if (!ps) continue;
      const blockedByIncomplete = ps.some((pid) => {
        const p = taskById.get(pid);
        return p != null && isActiveStatus(p.status); // predecessor still in flight
      });
      if (blockedByIncomplete) waitingIds.push(t.id);
    }
  }

  // ── Overdue (active, past planned finish) ──
  const overdueIds = active
    .filter((t) => t.end_date != null && t.end_date < today)
    .map((t) => t.id);

  // ── Capacity warnings (NOT blockers) ──
  const unassignedIds = active.filter((t) => isUnassigned(t)).map((t) => t.id);
  const missingEstimateIds = active
    .filter((t) => t.estimate_hours == null || Number(t.estimate_hours) <= 0)
    .map((t) => t.id);

  // ── Priority mix (active only) ──
  const p1 = active.filter((t) => t.priority === "p1").map((t) => t.id);
  const p2 = active.filter((t) => t.priority === "p2").map((t) => t.id);
  const p3 = active.filter((t) => t.priority === "p3").map((t) => t.id);

  // ── Milestone health distribution (computed/live status) ──
  const milestoneHealth: Record<MilestoneStatusDisplay, number> = {
    completed: 0, in_progress: 0, planned: 0, blocked: 0, deferred: 0, at_risk: 0,
  };
  for (const m of input.milestones) {
    const s = getComputedMilestoneStatus(m, tasks);
    milestoneHealth[s] = (milestoneHealth[s] ?? 0) + 1;
  }

  return {
    activeBlockers: metric({ en: "active tasks with an explicit impediment", es: "tareas activas con impedimento explícito" }, blockerIds),
    waitingOnDependency: metric({ en: "active tasks waiting on an incomplete predecessor", es: "tareas activas esperando un predecesor incompleto" }, waitingIds),
    overdue: metric({ en: "active tasks past planned finish", es: "tareas activas vencidas" }, overdueIds),
    unassignedActive: metric({ en: "active tasks without an owner", es: "tareas activas sin responsable" }, unassignedIds),
    missingEstimateActive: metric({ en: "active tasks without an estimate", es: "tareas activas sin estimación" }, missingEstimateIds),
    priorityActive: {
      p1: metric(SCOPE_ACTIVE, p1),
      p2: metric(SCOPE_ACTIVE, p2),
      p3: metric(SCOPE_ACTIVE, p3),
    },
    milestoneHealth,
    counts: { totalTasks: tasks.length, activeTasks: active.length, completedTasks: completed, milestones: input.milestones.length },
  };
}
