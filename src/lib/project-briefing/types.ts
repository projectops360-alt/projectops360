// ============================================================================
// ProjectOps360° — Project Health Briefing (REG-013) — shared types
// ============================================================================
// Isabella's proactive, project-aware briefing. The briefing is DETERMINISTIC:
// every number, list and recommendation traces to real project data resolved by
// the canonical engines (REG-010 rollup, roadmap progress, Execution Status
// Engine semantics). Nothing here is invented — if data is missing the briefing
// says so via `dataGaps` instead of guessing.
//
// Pure types, no server imports, safe to import from the client widget.
// ============================================================================

import type { MilestoneStatusDisplay } from "@/types/database";

/** Coarse role scope applied to a briefing (mapped from the org role). */
export type BriefingScope =
  | "full" // owner / admin → full PMO-level briefing
  | "member" // member → execution-focused, no sensitive governance detail
  | "external"; // viewer → external-safe summary only

/** Overall health band for the headline. Mirrors the Command Center bands. */
export type BriefingHealthBand = "healthy" | "watch" | "at_risk";

/** Things that look good — typed so copy stays bilingual and testable. */
export type GoodSignalKey =
  | "no_active_blockers"
  | "no_overdue"
  | "milestones_completed"
  | "critical_path_clear"
  | "all_work_assigned"
  | "recent_decisions_captured";

/** Things that need attention — each carries the deterministic count behind it. */
export type AttentionKey =
  | "active_blockers"
  | "waiting_on_dependency"
  | "overdue"
  | "at_risk_milestones"
  | "unassigned"
  | "missing_estimate"
  | "open_high_risks"
  | "unresolved_actions";

export interface AttentionItem {
  key: AttentionKey;
  count: number;
  severity: "high" | "medium" | "low";
}

/** A recommended next action — resolves to a real in-app destination. */
export type RecommendedActionKey =
  | "review_blockers"
  | "assign_owners"
  | "add_estimates"
  | "review_at_risk_milestones"
  | "review_overdue"
  | "open_resource_capacity"
  | "open_living_graph_critical_path"
  | "review_open_risks"
  | "capture_decisions";

/** A place inside the app where the user can verify a finding. */
export type VerifyTargetKey =
  | "workboard"
  | "living_graph"
  | "resource_capacity"
  | "project_memory"
  | "status_report";

/** Data the briefing could NOT evaluate — drives honest "not enough data" copy. */
export type DataGapKey =
  | "no_tasks"
  | "no_milestones"
  | "capacity_not_evaluable"
  | "risks_unavailable"
  | "memory_unavailable";

export interface BriefingMemoryEntry {
  id: string;
  title: string;
  /** ISO date when available. */
  date: string | null;
  kind: "decision" | "action" | "note";
}

export interface ProjectBriefingOverview {
  percentComplete: number;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  milestonesTotal: number;
  milestonesInProgress: number;
  /** Next milestone (by computed status / order), when one exists. */
  nextMilestone: { title: string; date: string | null } | null;
  milestoneHealth: Record<MilestoneStatusDisplay, number>;
}

export interface ProjectBriefingExecution {
  activeBlockers: number;
  waitingOnDependency: number;
  atRiskMilestones: number;
  overdue: number;
}

export interface ProjectBriefingCapacity {
  /** Active tasks with no owner (capacity warning, not a blocker). */
  unassignedActive: number;
  /** Active tasks with no estimate (forecast warning, not a blocker). */
  missingEstimateActive: number;
  /** False when there is no active work to evaluate capacity over. */
  evaluable: boolean;
}

export interface ProjectBriefingRisks {
  open: number;
  high: number;
  /** False when the risks source could not be read. */
  available: boolean;
}

export interface ProjectBriefingMemory {
  recentDecisions: BriefingMemoryEntry[];
  unresolvedActions: BriefingMemoryEntry[];
  recentNotes: BriefingMemoryEntry[];
  /** False when the memory sources could not be read. */
  available: boolean;
}

/** The full, deterministic briefing. The widget renders bilingual copy from it. */
export interface ProjectBriefing {
  projectId: string;
  projectName: string;
  /** ISO timestamp when the briefing was generated (for "Updated …"). */
  generatedAt: string;
  scope: BriefingScope;
  healthBand: BriefingHealthBand;
  overview: ProjectBriefingOverview;
  execution: ProjectBriefingExecution;
  capacity: ProjectBriefingCapacity;
  risks: ProjectBriefingRisks;
  memory: ProjectBriefingMemory;
  good: GoodSignalKey[];
  attention: AttentionItem[];
  recommended: RecommendedActionKey[];
  verify: VerifyTargetKey[];
  dataGaps: DataGapKey[];
}

/** Result wrapper returned by the server action. */
export type ProjectBriefingResult =
  | { ok: true; briefing: ProjectBriefing }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" };
