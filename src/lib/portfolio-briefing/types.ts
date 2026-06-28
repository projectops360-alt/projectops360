// ============================================================================
// ProjectOps360° — Portfolio Health Briefing (PMO) — shared types
// ============================================================================
// The PMO-level counterpart of the per-project briefing (REG-013). When Isabella
// opens OUTSIDE a project for a PMO (owner/admin) she proactively summarizes the
// whole portfolio: how every project is doing, what needs attention, and the top
// recommended actions — deterministically, reusing the REG-010 task-activity
// rules so counts agree with the Command Center.
//
// Pure types, client-safe.
// ============================================================================

import type { BriefingHealthBand } from "@/lib/project-briefing/types";

export type PortfolioGoodKey =
  | "no_active_blockers"
  | "no_overdue"
  | "all_work_assigned"
  | "no_high_risks"
  | "no_pending_decisions";

export type PortfolioAttentionKey =
  | "blocked_critical"
  | "active_blockers"
  | "overdue"
  | "unassigned"
  | "at_risk_milestones"
  | "high_risks"
  | "pending_decisions"
  | "projects_at_risk";

export interface PortfolioAttentionItem {
  key: PortfolioAttentionKey;
  count: number;
  severity: "high" | "medium" | "low";
}

export type PortfolioActionKey =
  | "review_blocked_critical"
  | "review_blockers"
  | "review_high_risks"
  | "review_overdue"
  | "assign_owners"
  | "clear_pending_decisions"
  | "open_command_center";

export type PortfolioVerifyKey = "command_center" | "reports" | "projects";

export type PortfolioDataGapKey = "no_projects" | "no_active_work" | "risks_unavailable";

/** One project that needs the PMO's attention, with a link to drill in. */
export interface PortfolioProjectRisk {
  projectId: string;
  name: string;
  activeBlockers: number;
  overdue: number;
  atRiskMilestones: number;
  highRisks: number;
  /** Deterministic priority score (blockers/at-risk weighted). */
  score: number;
}

export interface PortfolioBriefingOverview {
  totalProjects: number;
  activeProjects: number;
  totalActiveTasks: number;
  activeBlockers: number;
  blockedCritical: number;
  overdue: number;
  unassigned: number;
  atRiskMilestones: number;
  openHighRisks: number;
  pendingDecisions: number;
  projectsNeedingAttention: number;
}

export interface PortfolioBriefing {
  generatedAt: string;
  healthBand: BriefingHealthBand;
  overview: PortfolioBriefingOverview;
  good: PortfolioGoodKey[];
  attention: PortfolioAttentionItem[];
  recommended: PortfolioActionKey[];
  topProjects: PortfolioProjectRisk[];
  verify: PortfolioVerifyKey[];
  dataGaps: PortfolioDataGapKey[];
}

export type PortfolioBriefingResult =
  | { ok: true; briefing: PortfolioBriefing }
  | { ok: false; reason: "not_authorized" | "unavailable" };
