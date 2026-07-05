// ============================================================================
// GitHub Intelligence — domain + graph model types
// ============================================================================
// Read-only execution-evidence layer for software projects. These types are
// framework-free so pure logic (classification, readiness, graph builder,
// normalizers) can be unit-tested without any Next.js / Supabase imports.
// ============================================================================

export type BranchType = "main" | "feature" | "hotfix" | "release" | "other";

export const SUPPORTED_GITHUB_EVENTS = [
  "push",
  "pull_request",
  "pull_request_review",
  "workflow_run",
  "deployment",
  "release",
  "create",
  "delete",
] as const;
export type GitHubEventType = (typeof SUPPORTED_GITHUB_EVENTS)[number];

// ── Snapshot read shapes (subset of DB rows the read model needs) ────────────

export interface BranchSnapshot {
  branch_name: string;
  branch_type: BranchType;
  head_sha: string | null;
  base_branch: string | null;
  last_commit_at: string | null;
  commit_count_window: number;
  open_pr_number: number | null;
  merged_at: string | null;
  status: "active" | "merged" | "stale" | "blocked";
}

export interface PullRequestSnapshot {
  pr_number: number;
  title: string | null;
  state: "open" | "closed" | "merged";
  draft: boolean;
  author_login: string | null;
  source_branch: string | null;
  target_branch: string | null;
  review_state: string | null;
  checks_state: string | null;
  opened_at: string | null;
  merged_at: string | null;
  html_url: string | null;
}

export interface WorkflowRunSnapshot {
  workflow_run_id: number;
  workflow_name: string | null;
  branch_name: string | null;
  status: string | null;
  conclusion: string | null;
  completed_at: string | null;
  html_url: string | null;
}

export interface ReleaseSnapshot {
  tag_name: string;
  name: string | null;
  target_commitish: string | null;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  html_url: string | null;
}

export interface DeploymentSnapshot {
  deployment_id: number;
  environment: string | null;
  ref: string | null;
  state: string | null;
  occurred_at: string | null;
}

export interface ActivityEventSnapshot {
  github_event_type: string;
  github_action: string | null;
  actor_login: string | null;
  branch_name: string | null;
  sha: string | null;
  title: string | null;
  url: string | null;
  occurred_at: string;
}

// ── Fishbone / Git Living Graph model (consumed by GitHubLivingGraph.tsx) ────

export interface GitHubGraphNode {
  id: string;
  label: string;
  type: "commit" | "merge" | "tag";
  branchName: string;
  branchType: BranchType;
  occurredAt: string;
  sha?: string;
  url?: string;
  /** Present when a dense commit run was collapsed into a single marker. */
  collapsedCount?: number;
}

export interface GitHubGraphBranch {
  id: string;
  name: string;
  type: BranchType;
  sourceSha?: string;
  mergeSha?: string;
  nodes: GitHubGraphNode[];
  status?: "active" | "merged" | "stale" | "blocked";
  openPrNumber?: number;
  /** Commits that existed in the window but were collapsed out of `nodes`. */
  hiddenCommitCount?: number;
  /** ISO time the branch's earliest visible commit occurred (timeline x-start). */
  startAt?: string;
  /** ISO time the branch merged back to main (draws the merge-back curve). */
  mergedAt?: string;
  /** ISO time of the branch's latest commit (timeline x-end when unmerged). */
  lastCommitAt?: string;
}

// ── Density + focus model (high-volume repos) ────────────────────────────────

/** One day of master activity, quantized to a heatmap level (0 = none). */
export interface DensityCell {
  dayStart: string; // ISO day boundary
  count: number;
  level: 0 | 1 | 2 | 3;
}

/** Merges to main grouped by day (spine badges + PR list on interaction). */
export interface DailyMerge {
  dayStart: string;
  count: number;
  prs: Array<{ number: number; title: string; branch: string; mergedAt: string }>;
}

/** A branch that is NOT drawn as a lane — aggregated into the side panel. */
export interface InactiveBranch {
  name: string;
  type: BranchType;
  status: "active" | "merged" | "stale" | "blocked";
  mergedAt?: string;
  lastActivityAt?: string;
  prNumber?: number;
}

export interface GitHubLivingGraphData {
  repositoryName: string;
  windowLabel: string;
  mainBranch: string;
  /** Selected window in days (7/14/30) — the MAX range, not the default domain. */
  windowDays: number;

  /** Auto-zoom domain: ~P5 of activity → now (min 3 days). Default view. */
  autoStartAt: string;
  autoEndAt: string;
  /** Full literal window domain (for the "see full range" toggle). */
  fullStartAt: string;
  fullEndAt: string;

  /** Master commit density per day (covers the full window). */
  densityCells: DensityCell[];
  totalMasterCommits: number;
  /** Merges to main grouped by day. */
  dailyMerges: DailyMerge[];

  /** Branches drawn as individual lanes (open PR ∪ commits < 72h, ≤ 8). */
  liveBranches: GitHubGraphBranch[];
  /** Everything else — aggregated, shown in the side panel. */
  inactiveBranches: InactiveBranch[];

  tags: Array<{ label: string; sha?: string; occurredAt?: string }>;
}

// ── Readiness ────────────────────────────────────────────────────────────────

export type ReadinessBand = "good" | "watch" | "at_risk" | "blocked";

export interface ReadinessDeduction {
  reason: string;
  points: number;
}

export interface ReadinessResult {
  score: number; // clamped 0..100
  band: ReadinessBand;
  deductions: ReadinessDeduction[];
}

// ── Deterministic Isabella-ready summary ─────────────────────────────────────

export interface GitHubIntelligenceSummary {
  summary: string;
  risk: string | null;
  recommendation: string | null;
  readinessScore: number;
  readinessBand: ReadinessBand;
}

// ── Public (client-safe) connection status ───────────────────────────────────

export type GitHubSetupState =
  | "feature_disabled"
  | "not_software_project"
  | "not_configured" // GitHub App not set up (env/manifest)
  | "configured_not_installed"
  | "not_connected" // configured + installable, no repo yet
  | "connected";

export interface GitHubConnectionStatus {
  state: GitHubSetupState;
  appConfigured: boolean;
  appSlug: string | null;
  repositories: Array<{
    id: string;
    fullName: string;
    htmlUrl: string | null;
    lastSyncedAt: string | null;
    lastSyncStatus: string | null;
  }>;
}
