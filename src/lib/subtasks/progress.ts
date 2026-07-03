// ============================================================================
// ProjectOps360° — Subtasks · Parent Progress Engine (pure, deterministic)
// ============================================================================
// Calculates parent-task progress from subtasks with three modes and a strict
// fallback chain, plus the parent signals PMs need (blocked/overdue/critical)
// and the close gate. Rules (guarded by SUBTASK-PROGRESS):
// - cancelled subtasks NEVER count toward active progress;
// - completed subtasks always count as 100%; not_started as 0%;
// - weighted without valid weights → count; hours without valid estimates →
//   weighted → count;
// - a task with NO subtasks returns null: the existing manual task progress
//   behavior is preserved (never invented).
// ============================================================================

import {
  isActiveSubtask,
  effectiveSubtaskProgress,
  isSubtaskOverdue,
  type Subtask,
  type SubtaskProgressMode,
} from "./types";

export interface ParentProgressResult {
  /** 0-100 integer. */
  progress: number;
  /** The mode that actually computed the number (after fallbacks). */
  modeUsed: Exclude<SubtaskProgressMode, "auto">;
  /** Why a fallback happened, when it did. */
  fallbackReason: "no_valid_weights" | "no_valid_estimates" | null;
  /** Per-subtask contribution for the explainable breakdown panel. */
  breakdown: { subtaskId: string; title: string; share: number; effectiveProgress: number }[];
  activeCount: number;
  completedCount: number;
}

type CalcSubtask = Pick<
  Subtask,
  "id" | "title" | "status" | "progress" | "weight" | "estimated_hours"
>;

function round(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Compute parent progress from subtasks. Returns null when there are no
 * ACTIVE subtasks — the caller must preserve the task's manual progress.
 */
export function computeParentProgress(
  subtasks: readonly CalcSubtask[],
  mode: SubtaskProgressMode = "auto",
): ParentProgressResult | null {
  const active = subtasks.filter(isActiveSubtask);
  if (active.length === 0) return null;

  const completedCount = active.filter((s) => s.status === "completed").length;

  const buildResult = (
    modeUsed: ParentProgressResult["modeUsed"],
    shares: Map<string, number>,
    fallbackReason: ParentProgressResult["fallbackReason"],
  ): ParentProgressResult => {
    let total = 0;
    const breakdown = active.map((s) => {
      const share = shares.get(s.id) ?? 0;
      const effectiveProgress = effectiveSubtaskProgress(s);
      total += share * (effectiveProgress / 100);
      return { subtaskId: s.id, title: s.title, share, effectiveProgress };
    });
    return {
      progress: round(total * 100),
      modeUsed,
      fallbackReason,
      breakdown,
      activeCount: active.length,
      completedCount,
    };
  };

  const countShares = (): Map<string, number> =>
    new Map(active.map((s) => [s.id, 1 / active.length]));

  const weightedShares = (): Map<string, number> | null => {
    const weights = active.map((s) => (typeof s.weight === "number" && s.weight > 0 ? s.weight : 0));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return null;
    return new Map(active.map((s, i) => [s.id, weights[i] / totalWeight]));
  };

  const hoursShares = (): Map<string, number> | null => {
    const hours = active.map((s) =>
      typeof s.estimated_hours === "number" && s.estimated_hours > 0 ? s.estimated_hours : 0,
    );
    const totalHours = hours.reduce((a, b) => a + b, 0);
    if (totalHours <= 0) return null;
    return new Map(active.map((s, i) => [s.id, hours[i] / totalHours]));
  };

  if (mode === "count") return buildResult("count", countShares(), null);

  if (mode === "weighted") {
    const shares = weightedShares();
    if (shares) return buildResult("weighted", shares, null);
    return buildResult("count", countShares(), "no_valid_weights");
  }

  if (mode === "hours") {
    const byHours = hoursShares();
    if (byHours) return buildResult("hours", byHours, null);
    const byWeight = weightedShares();
    if (byWeight) return buildResult("weighted", byWeight, "no_valid_estimates");
    return buildResult("count", countShares(), "no_valid_estimates");
  }

  // auto: prefer hours, then weighted, then count — without fallback warnings
  // (auto means "use the best available signal").
  const byHours = hoursShares();
  if (byHours) return buildResult("hours", byHours, null);
  const byWeight = weightedShares();
  if (byWeight) return buildResult("weighted", byWeight, null);
  return buildResult("count", countShares(), null);
}

// ── Parent signals (blocked / overdue / critical risk) ────────────────────────

export interface ParentSubtaskSignals {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  blockedCount: number;
  overdueCount: number;
  cancelledCount: number;
  criticalCount: number;
  /** A critical-path subtask is blocked or overdue — the map must shout. */
  criticalAtRisk: boolean;
  /** Parent may complete: every ACTIVE subtask is completed. */
  canComplete: boolean;
  estimatedHours: number;
  actualHours: number;
  /** actual − estimated (positive = over). Null when no estimates exist. */
  varianceHours: number | null;
}

export function deriveParentSignals(
  subtasks: readonly Pick<
    Subtask,
    "status" | "due_date" | "is_critical" | "estimated_hours" | "actual_hours"
  >[],
  asOf: Date,
): ParentSubtaskSignals {
  const active = subtasks.filter(isActiveSubtask);
  const blocked = active.filter((s) => s.status === "blocked");
  const overdue = active.filter((s) => isSubtaskOverdue(s, asOf));
  const completed = active.filter((s) => s.status === "completed");
  const critical = active.filter((s) => s.is_critical);
  const criticalAtRisk = critical.some(
    (s) => s.status === "blocked" || isSubtaskOverdue(s, asOf),
  );
  const estimatedHours = active.reduce((a, s) => a + (s.estimated_hours ?? 0), 0);
  const actualHours = active.reduce((a, s) => a + (s.actual_hours ?? 0), 0);
  const hasEstimates = active.some((s) => (s.estimated_hours ?? 0) > 0);
  return {
    totalCount: subtasks.length,
    activeCount: active.length,
    completedCount: completed.length,
    blockedCount: blocked.length,
    overdueCount: overdue.length,
    cancelledCount: subtasks.length - active.length,
    criticalCount: critical.length,
    criticalAtRisk,
    canComplete: active.length > 0 && completed.length === active.length,
    estimatedHours,
    actualHours,
    varianceHours: hasEstimates ? actualHours - estimatedHours : null,
  };
}

// ── Close gate ────────────────────────────────────────────────────────────────

export interface ParentCloseGate {
  allowed: boolean;
  /** Closing requires an authorized override + reason when incomplete work remains. */
  requiresOverride: boolean;
  incompleteCount: number;
}

/** A parent task must not close while active subtasks remain incomplete. */
export function evaluateParentCloseGate(
  subtasks: readonly Pick<Subtask, "status">[],
): ParentCloseGate {
  const active = subtasks.filter(isActiveSubtask);
  const incomplete = active.filter((s) => s.status !== "completed");
  if (active.length === 0 || incomplete.length === 0) {
    return { allowed: true, requiresOverride: false, incompleteCount: 0 };
  }
  return { allowed: false, requiresOverride: true, incompleteCount: incomplete.length };
}
