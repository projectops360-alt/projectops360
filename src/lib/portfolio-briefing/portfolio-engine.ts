// ============================================================================
// ProjectOps360° — Portfolio Health Briefing engine (PMO, deterministic)
// ============================================================================
// Pure function that aggregates org-wide execution data into the PMO portfolio
// briefing. It uses the SAME canonical rules as every other surface (REG-010):
//   • hasActiveBlocker / isActiveStatus / isUnassigned (task-activity)
//   • getComputedMilestoneStatus (roadmap progress)
// so portfolio counts agree with the Command Center and per-project briefings.
//
// No hallucination: completed/terminal tasks never count as active blockers,
// waiting, or capacity risks; missing data becomes a `dataGap`.
// ============================================================================

import type { Milestone, RoadmapTask } from "@/types/database";
import { hasActiveBlocker, isActiveStatus, isUnassigned } from "@/lib/execution/task-activity";
import { getComputedMilestoneStatus } from "@/lib/roadmap/progress";
import type { BriefingHealthBand } from "@/lib/project-briefing/types";
import type {
  PortfolioActionKey,
  PortfolioAttentionItem,
  PortfolioBriefing,
  PortfolioDataGapKey,
  PortfolioGoodKey,
  PortfolioProjectRisk,
} from "./types";

export interface PortfolioEngineProject {
  id: string;
  name: string;
  /** active | planning | … — only active/planning count as "active projects". */
  status: string | null;
}

export interface PortfolioEngineInput {
  projects: PortfolioEngineProject[];
  /** Org-wide tasks (already filtered to alive projects). */
  tasks: RoadmapTask[];
  /** Org-wide milestones (already filtered to alive projects). */
  milestones: Milestone[];
  /** Open risk rows by project, or null when the source is unreadable. */
  risks: Array<{ project_id: string | null; severity: string | null; status: string | null }> | null;
  /** Proposed (pending) decisions by project. */
  pendingDecisions: Array<{ project_id: string | null; impact_area: string | null }>;
  today?: string;
  generatedAt?: string;
}

const ACTIVE_PROJECT_STATUSES = new Set(["active", "planning"]);
const OPEN_RISK_STATUSES = new Set(["open", "mitigating"]);
const HIGH_RISK_SEVERITIES = new Set(["high", "critical"]);

export function buildPortfolioBriefing(input: PortfolioEngineInput): PortfolioBriefing {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const projectName = new Map(input.projects.map((p) => [p.id, p.name]));
  const tasks = input.tasks.filter((t) => !t.deleted_at);
  const activeTasks = tasks.filter((t) => isActiveStatus(t.status));

  // ── Org-wide aggregates (REG-010 rules) ───────────────────────────────────
  const blockerTasks = tasks.filter((t) => hasActiveBlocker(t));
  const blockedCritical = blockerTasks.filter((t) => t.is_critical).length;
  const overdueTasks = activeTasks.filter((t) => t.end_date != null && t.end_date < today);
  const unassignedTasks = activeTasks.filter((t) => isUnassigned(t));

  // Milestone health (computed/live) across the portfolio.
  let atRiskMilestones = 0;
  for (const m of input.milestones) {
    const s = getComputedMilestoneStatus(m, tasks);
    if (s === "at_risk" || s === "blocked") atRiskMilestones++;
  }

  // Risks (null source → reported as a data gap, counts default to 0).
  const risksAvailable = input.risks !== null;
  const openRisks = (input.risks ?? []).filter((r) => r.status != null && OPEN_RISK_STATUSES.has(r.status));
  const openHighRisks = openRisks.filter((r) => r.severity != null && HIGH_RISK_SEVERITIES.has(r.severity));

  const pendingDecisions = input.pendingDecisions.length;

  // ── Per-project ranking (which projects need the PMO most) ────────────────
  const tasksByProject = new Map<string, RoadmapTask[]>();
  for (const t of tasks) {
    const arr = tasksByProject.get(t.project_id) ?? [];
    arr.push(t);
    tasksByProject.set(t.project_id, arr);
  }
  const milestonesByProject = new Map<string, Milestone[]>();
  for (const m of input.milestones) {
    const arr = milestonesByProject.get(m.project_id) ?? [];
    arr.push(m);
    milestonesByProject.set(m.project_id, arr);
  }
  const highRiskByProject = new Map<string, number>();
  for (const r of openHighRisks) {
    if (!r.project_id) continue;
    highRiskByProject.set(r.project_id, (highRiskByProject.get(r.project_id) ?? 0) + 1);
  }

  const topProjects: PortfolioProjectRisk[] = [];
  for (const [projectId, pTasks] of tasksByProject) {
    const pActive = pTasks.filter((t) => isActiveStatus(t.status));
    const pBlockers = pTasks.filter((t) => hasActiveBlocker(t)).length;
    const pOverdue = pActive.filter((t) => t.end_date != null && t.end_date < today).length;
    const pMilestones = milestonesByProject.get(projectId) ?? [];
    const pAtRisk = pMilestones.filter((m) => {
      const s = getComputedMilestoneStatus(m, pTasks);
      return s === "at_risk" || s === "blocked";
    }).length;
    const pHighRisks = highRiskByProject.get(projectId) ?? 0;
    const score = pBlockers * 3 + pAtRisk * 2 + pHighRisks * 2 + pOverdue;
    if (score > 0) {
      topProjects.push({
        projectId,
        name: projectName.get(projectId) ?? "Project",
        activeBlockers: pBlockers,
        overdue: pOverdue,
        atRiskMilestones: pAtRisk,
        highRisks: pHighRisks,
        score,
      });
    }
  }
  topProjects.sort((a, b) => b.score - a.score);
  const projectsNeedingAttention = topProjects.length;

  const activeProjects = input.projects.filter(
    (p) => p.status != null && ACTIVE_PROJECT_STATUSES.has(p.status),
  ).length;

  // ── Data gaps (honesty before findings) ───────────────────────────────────
  const dataGaps: PortfolioDataGapKey[] = [];
  if (input.projects.length === 0) dataGaps.push("no_projects");
  if (activeTasks.length === 0) dataGaps.push("no_active_work");
  if (!risksAvailable) dataGaps.push("risks_unavailable");

  // ── Needs attention ───────────────────────────────────────────────────────
  const attention: PortfolioAttentionItem[] = [];
  if (blockedCritical > 0) attention.push({ key: "blocked_critical", count: blockedCritical, severity: "high" });
  if (blockerTasks.length > 0) attention.push({ key: "active_blockers", count: blockerTasks.length, severity: "high" });
  if (atRiskMilestones > 0) attention.push({ key: "at_risk_milestones", count: atRiskMilestones, severity: "high" });
  if (openHighRisks.length > 0) attention.push({ key: "high_risks", count: openHighRisks.length, severity: "high" });
  if (projectsNeedingAttention > 0) attention.push({ key: "projects_at_risk", count: projectsNeedingAttention, severity: "medium" });
  if (overdueTasks.length > 0) attention.push({ key: "overdue", count: overdueTasks.length, severity: "medium" });
  if (unassignedTasks.length > 0) attention.push({ key: "unassigned", count: unassignedTasks.length, severity: "medium" });
  if (pendingDecisions > 0) attention.push({ key: "pending_decisions", count: pendingDecisions, severity: "medium" });

  // ── What looks good ───────────────────────────────────────────────────────
  const good: PortfolioGoodKey[] = [];
  if (activeTasks.length > 0 && blockerTasks.length === 0) good.push("no_active_blockers");
  if (activeTasks.length > 0 && overdueTasks.length === 0) good.push("no_overdue");
  if (activeTasks.length > 0 && unassignedTasks.length === 0) good.push("all_work_assigned");
  if (risksAvailable && openHighRisks.length === 0) good.push("no_high_risks");
  if (pendingDecisions === 0) good.push("no_pending_decisions");

  // ── Recommended next actions (max 3, severity-ordered) ────────────────────
  const recommended: PortfolioActionKey[] = [];
  if (blockedCritical > 0) recommended.push("review_blocked_critical");
  else if (blockerTasks.length > 0) recommended.push("review_blockers");
  if (openHighRisks.length > 0) recommended.push("review_high_risks");
  if (overdueTasks.length > 0) recommended.push("review_overdue");
  if (unassignedTasks.length > 0) recommended.push("assign_owners");
  if (pendingDecisions > 0) recommended.push("clear_pending_decisions");
  if (recommended.length === 0) recommended.push("open_command_center");

  // ── Overall health band ───────────────────────────────────────────────────
  const healthBand = resolveBand({
    activeTasks: activeTasks.length,
    blockers: blockerTasks.length,
    blockedCritical,
    atRiskMilestones,
    openHighRisks: openHighRisks.length,
    overdue: overdueTasks.length,
    unassigned: unassignedTasks.length,
    pendingDecisions,
  });

  return {
    generatedAt,
    healthBand,
    overview: {
      totalProjects: input.projects.length,
      activeProjects,
      totalActiveTasks: activeTasks.length,
      activeBlockers: blockerTasks.length,
      blockedCritical,
      overdue: overdueTasks.length,
      unassigned: unassignedTasks.length,
      atRiskMilestones,
      openHighRisks: openHighRisks.length,
      pendingDecisions,
      projectsNeedingAttention,
    },
    good,
    attention,
    recommended: recommended.slice(0, 3),
    topProjects: topProjects.slice(0, 4),
    verify: ["command_center", "reports", "projects"],
    dataGaps,
  };
}

function resolveBand(s: {
  activeTasks: number;
  blockers: number;
  blockedCritical: number;
  atRiskMilestones: number;
  openHighRisks: number;
  overdue: number;
  unassigned: number;
  pendingDecisions: number;
}): BriefingHealthBand {
  if (s.activeTasks === 0) return "watch";
  if (s.blockedCritical > 0 || s.blockers > 0 || s.atRiskMilestones > 0 || s.openHighRisks > 0) return "at_risk";
  if (s.overdue > 0 || s.unassigned > 0 || s.pendingDecisions > 0) return "watch";
  return "healthy";
}
