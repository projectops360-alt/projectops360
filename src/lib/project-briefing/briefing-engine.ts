// ============================================================================
// ProjectOps360° — Project Health Briefing engine (REG-013, deterministic)
// ============================================================================
// Pure function that turns already-fetched project data into Isabella's Project
// Health Briefing. It reuses the canonical engines so the briefing AGREES with
// every other surface (REG-010):
//   • computeProjectExecutionRollup → blockers / waiting / overdue / capacity
//   • computeRoadmapProgress        → percent complete / next milestone
//
// Hard rules (no hallucination):
//   • Completed/terminal tasks never count as active blockers/waiting/capacity.
//   • "Blocked" and "Waiting on Dependency" are reported separately.
//   • Missing data → a `dataGaps` entry, never an invented finding.
//   • Role scope limits what is surfaced (external/member/full).
// ============================================================================

import type {
  RoadmapTask,
  Milestone,
  TaskDependency,
  MilestoneStatusDisplay,
} from "@/types/database";
import {
  computeProjectExecutionRollup,
} from "@/lib/project-rollups/project-rollup-engine";
import {
  computeRoadmapProgress,
  getComputedMilestoneStatus,
  findNextMilestone,
  findCurrentMilestone,
} from "@/lib/roadmap/progress";
import { isActiveStatus, isCompletedStatus } from "@/lib/execution/task-activity";
import type {
  AttentionItem,
  BriefingHealthBand,
  BriefingMemoryEntry,
  BriefingScope,
  DataGapKey,
  GoodSignalKey,
  ProjectBriefing,
  RecommendedActionKey,
  VerifyTargetKey,
} from "./types";

export interface BriefingEngineInput {
  projectId: string;
  projectName: string;
  scope: BriefingScope;
  tasks: RoadmapTask[];
  milestones: Milestone[];
  dependencies: TaskDependency[];
  /** Open + high-severity risk counts, or null when the source is unreadable. */
  risks: { open: number; high: number } | null;
  memory: {
    recentDecisions: BriefingMemoryEntry[];
    unresolvedActions: BriefingMemoryEntry[];
    recentNotes: BriefingMemoryEntry[];
    available: boolean;
  };
  /** Reference "today" (ISO yyyy-mm-dd). Defaults to now. */
  today?: string;
  /** Generation timestamp (ISO). Defaults to now. */
  generatedAt?: string;
}

const IN_PROGRESS_STATUSES = new Set([
  "in_progress",
  "sent_to_ai",
  "implemented",
]);

/**
 * Build the deterministic Project Health Briefing. Pure — the caller batch-loads
 * project data (scoped to org + project + role) and passes it in.
 */
export function buildProjectBriefing(input: BriefingEngineInput): ProjectBriefing {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const tasks = input.tasks.filter((t) => !t.deleted_at);
  const milestones = input.milestones;

  const rollup = computeProjectExecutionRollup({
    tasks,
    milestones,
    dependencies: input.dependencies,
    today,
  });
  const progress = computeRoadmapProgress(milestones, tasks);

  const activeTasks = rollup.counts.activeTasks;
  const completedTasks = tasks.filter((t) => isCompletedStatus(t.status)).length;
  const inProgressTasks = tasks.filter(
    (t) => isActiveStatus(t.status) && IN_PROGRESS_STATUSES.has(t.status),
  ).length;

  const milestoneHealth = rollup.milestoneHealth;
  const milestonesInProgress = milestoneHealth.in_progress ?? 0;
  const atRiskMilestones = (milestoneHealth.at_risk ?? 0) + (milestoneHealth.blocked ?? 0);

  // Next milestone — prefer the live current/next from the progress engine.
  const current = findCurrentMilestone(milestones, tasks);
  const next = findNextMilestone(milestones, current, tasks);
  const nextMilestoneEntity = next ?? current;
  const nextMilestone = nextMilestoneEntity
    ? { title: nextMilestoneEntity.title, date: nextMilestoneEntity.target_date }
    : null;

  const activeBlockers = rollup.activeBlockers.value;
  const waitingOnDependency = rollup.waitingOnDependency.value;
  const overdue = rollup.overdue.value;
  const unassignedActive = rollup.unassignedActive.value;
  const missingEstimateActive = rollup.missingEstimateActive.value;

  const risks = input.risks;
  const openRisks = risks?.open ?? 0;
  const highRisks = risks?.high ?? 0;

  // ── Data gaps (honesty before findings) ───────────────────────────────────
  const dataGaps: DataGapKey[] = [];
  if (tasks.length === 0) dataGaps.push("no_tasks");
  if (milestones.length === 0) dataGaps.push("no_milestones");
  if (activeTasks === 0) dataGaps.push("capacity_not_evaluable");
  if (risks === null) dataGaps.push("risks_unavailable");
  if (!input.memory.available) dataGaps.push("memory_unavailable");

  const capacityEvaluable = activeTasks > 0;

  // ── Needs attention (deterministic; only when count > 0) ──────────────────
  const attention: AttentionItem[] = [];
  if (activeBlockers > 0) attention.push({ key: "active_blockers", count: activeBlockers, severity: "high" });
  if (overdue > 0) attention.push({ key: "overdue", count: overdue, severity: "high" });
  if (atRiskMilestones > 0) attention.push({ key: "at_risk_milestones", count: atRiskMilestones, severity: "high" });
  if (highRisks > 0) attention.push({ key: "open_high_risks", count: highRisks, severity: "high" });
  if (waitingOnDependency > 0) attention.push({ key: "waiting_on_dependency", count: waitingOnDependency, severity: "medium" });
  if (unassignedActive > 0) attention.push({ key: "unassigned", count: unassignedActive, severity: "medium" });
  if (missingEstimateActive > 0) attention.push({ key: "missing_estimate", count: missingEstimateActive, severity: "low" });
  // Unresolved follow-ups are an attention item only when memory is readable.
  if (input.memory.available && input.memory.unresolvedActions.length > 0) {
    attention.push({ key: "unresolved_actions", count: input.memory.unresolvedActions.length, severity: "medium" });
  }

  // ── What looks good (only assert what is evidenced) ───────────────────────
  const good: GoodSignalKey[] = [];
  if (activeTasks > 0 && activeBlockers === 0) good.push("no_active_blockers");
  if (activeTasks > 0 && overdue === 0) good.push("no_overdue");
  if ((milestoneHealth.completed ?? 0) > 0) good.push("milestones_completed");
  if (activeTasks > 0 && atRiskMilestones === 0 && activeBlockers === 0) good.push("critical_path_clear");
  if (activeTasks > 0 && unassignedActive === 0) good.push("all_work_assigned");
  if (input.memory.available && input.memory.recentDecisions.length > 0) good.push("recent_decisions_captured");

  // ── Recommended next actions (max 3, evidence-driven, severity-ordered) ───
  const recommended: RecommendedActionKey[] = [];
  if (activeBlockers > 0) recommended.push("review_blockers");
  if (atRiskMilestones > 0) recommended.push("review_at_risk_milestones");
  if (overdue > 0) recommended.push("review_overdue");
  if (unassignedActive > 0) recommended.push("assign_owners");
  if (highRisks > 0) recommended.push("review_open_risks");
  if (missingEstimateActive > 0) recommended.push("add_estimates");
  if (input.memory.available && input.memory.unresolvedActions.length > 0) recommended.push("capture_decisions");
  const recommendedTop = recommended.slice(0, 3);

  // ── Verification destinations (always offer where to confirm) ─────────────
  const verify: VerifyTargetKey[] = ["workboard", "living_graph"];
  if (input.scope !== "external") verify.push("resource_capacity");
  verify.push("project_memory", "status_report");

  // ── Overall health band (deterministic) ───────────────────────────────────
  const healthBand = resolveHealthBand({
    activeTasks,
    activeBlockers,
    overdue,
    atRiskMilestones,
    highRisks,
    unassignedActive,
  });

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    generatedAt,
    scope: input.scope,
    healthBand,
    overview: {
      percentComplete: progress.overallPercent,
      totalTasks: tasks.length,
      activeTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks: overdue,
      milestonesTotal: milestones.length,
      milestonesInProgress,
      nextMilestone,
      milestoneHealth,
    },
    execution: {
      activeBlockers,
      waitingOnDependency,
      atRiskMilestones,
      overdue,
    },
    capacity: {
      // External viewers never see capacity/personnel detail.
      unassignedActive: input.scope === "external" ? 0 : unassignedActive,
      missingEstimateActive: input.scope === "external" ? 0 : missingEstimateActive,
      evaluable: capacityEvaluable,
    },
    risks: {
      open: openRisks,
      high: highRisks,
      available: risks !== null,
    },
    memory: {
      recentDecisions: input.memory.recentDecisions,
      unresolvedActions: input.scope === "external" ? [] : input.memory.unresolvedActions,
      recentNotes: input.scope === "external" ? [] : input.memory.recentNotes,
      available: input.memory.available,
    },
    good,
    // External scope hides capacity/personnel-derived attention items.
    attention:
      input.scope === "external"
        ? attention.filter((a) => a.key !== "unassigned" && a.key !== "missing_estimate" && a.key !== "unresolved_actions")
        : attention,
    recommended:
      input.scope === "external"
        ? recommendedTop.filter((r) => r !== "assign_owners" && r !== "add_estimates" && r !== "open_resource_capacity")
        : recommendedTop,
    verify: input.scope === "external" ? verify.filter((v) => v !== "resource_capacity") : verify,
    dataGaps,
  };
}

function resolveHealthBand(s: {
  activeTasks: number;
  activeBlockers: number;
  overdue: number;
  atRiskMilestones: number;
  highRisks: number;
  unassignedActive: number;
}): BriefingHealthBand {
  if (s.activeTasks === 0) return "watch"; // nothing in flight yet → not "healthy"
  const severe = s.activeBlockers + s.atRiskMilestones + s.highRisks;
  if (severe > 0) return "at_risk";
  if (s.overdue > 0 || s.unassignedActive > 0) return "watch";
  return "healthy";
}

/** Re-export for callers that want the raw computed milestone status. */
export { getComputedMilestoneStatus };
export type { MilestoneStatusDisplay };
