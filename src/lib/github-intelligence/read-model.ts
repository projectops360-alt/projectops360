// ============================================================================
// GitHub Intelligence — dashboard read model (SERVER ONLY)
// ============================================================================
// Loads snapshot rows for a connected repository (scoped by org_id + project_id
// via RLS AND explicit filters) and assembles the dashboard payload: metric
// cards, fishbone graph data, activity summary, readiness and the deterministic
// Isabella summary. Read-only; never mutates canonical data.
// ============================================================================

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrgContext } from "@/lib/auth";
import { buildGitHubLivingGraph } from "./graph-builder";
import { computeReadiness } from "./readiness";
import { buildGitHubSummary } from "./summary";
import type {
  ActivityEventSnapshot,
  BranchSnapshot,
  DeploymentSnapshot,
  GitHubConnectionStatus,
  GitHubIntelligenceSummary,
  GitHubLivingGraphData,
  PullRequestSnapshot,
  ReadinessResult,
  ReleaseSnapshot,
  WorkflowRunSnapshot,
} from "./types";

export type DateWindow = 7 | 14 | 30;

export interface RepositoryRef {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  htmlUrl: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
}

export interface DashboardMetrics {
  commitCount: number;
  activeBranchCount: number;
  openPrCount: number;
  mergedPrCount: number;
  failedWorkflowCount: number;
  successWorkflowCount: number;
  releaseCount: number;
  deploymentCount: number;
}

export interface GitHubDashboardData {
  repository: RepositoryRef | null;
  windowDays: DateWindow;
  metrics: DashboardMetrics;
  graph: GitHubLivingGraphData;
  readiness: ReadinessResult;
  summary: GitHubIntelligenceSummary;
  recentActivity: ActivityEventSnapshot[];
}

/** List the active repositories connected to a software project. */
export async function listProjectRepositories(
  org: OrgContext,
  projectId: string,
): Promise<RepositoryRef[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("github_repositories")
    .select("id, full_name, owner, name, default_branch, html_url, last_synced_at, last_sync_status")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    owner: r.owner,
    name: r.name,
    defaultBranch: r.default_branch ?? "main",
    htmlUrl: r.html_url,
    lastSyncedAt: r.last_synced_at,
    lastSyncStatus: r.last_sync_status,
  }));
}

/** Public connection status for the settings UI (software project, flag ON). */
export async function getConnectionStatus(
  org: OrgContext,
  projectId: string,
  appConfigured: boolean,
  appSlug: string | null,
): Promise<GitHubConnectionStatus> {
  const repos = await listProjectRepositories(org, projectId);
  const state: GitHubConnectionStatus["state"] = repos.length > 0
    ? "connected"
    : appConfigured
      ? "not_connected"
      : "not_configured";

  return {
    state,
    appConfigured,
    appSlug,
    repositories: repos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      htmlUrl: r.htmlUrl,
      lastSyncedAt: r.lastSyncedAt,
      lastSyncStatus: r.lastSyncStatus,
    })),
  };
}

const WINDOW_LABELS: Record<DateWindow, { en: string; es: string }> = {
  7: { en: "Last 7 days", es: "Últimos 7 días" },
  14: { en: "Last 14 days", es: "Últimos 14 días" },
  30: { en: "Last 30 days", es: "Últimos 30 días" },
};

/**
 * Assemble the dashboard payload for a repository within a date window.
 * Caller MUST have passed the software-project guard first.
 */
export async function loadDashboardData(
  org: OrgContext,
  projectId: string,
  options: { repositoryId?: string; windowDays?: DateWindow; isEs?: boolean } = {},
): Promise<GitHubDashboardData> {
  const windowDays: DateWindow = options.windowDays ?? 14;
  const isEs = options.isEs ?? false;
  const supabase = await createClient();

  // Time-ruler domain: [now − windowDays, now]. Used by the graph timeline.
  const rangeEndAt = new Date().toISOString();
  const rangeStartAt = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const repos = await listProjectRepositories(org, projectId);
  const repository = options.repositoryId
    ? repos.find((r) => r.id === options.repositoryId) ?? repos[0] ?? null
    : repos[0] ?? null;

  const emptyGraph: GitHubLivingGraphData = {
    repositoryName: repository?.fullName ?? "",
    windowLabel: isEs ? WINDOW_LABELS[windowDays].es : WINDOW_LABELS[windowDays].en,
    mainBranch: repository?.defaultBranch ?? "main",
    branches: [],
    tags: [],
    hiddenBranchCount: 0,
    windowDays,
    rangeStartAt,
    rangeEndAt,
  };

  if (!repository) {
    const readiness = computeReadiness({ branches: [], pullRequests: [], workflowRuns: [], deployments: [] });
    return {
      repository: null,
      windowDays,
      metrics: emptyMetrics(),
      graph: emptyGraph,
      readiness,
      summary: buildGitHubSummary({
        branches: [], pullRequests: [], workflowRuns: [], releases: [], commitCount: 0, readiness, isEs,
      }),
      recentActivity: [],
    };
  }

  const sinceIso = rangeStartAt;
  const scope = { org: org.organizationId, project: projectId, repo: repository.id };

  const [branches, pulls, workflows, releases, deployments, events] = await Promise.all([
    fetchScoped<BranchSnapshot>(supabase, "github_branch_snapshots", scope,
      "branch_name, branch_type, head_sha, base_branch, last_commit_at, commit_count_window, open_pr_number, merged_at, status"),
    fetchScoped<PullRequestSnapshot>(supabase, "github_pull_request_snapshots", scope,
      "pr_number, title, state, draft, author_login, source_branch, target_branch, review_state, checks_state, merged_at, html_url"),
    fetchScoped<WorkflowRunSnapshot>(supabase, "github_workflow_run_snapshots", scope,
      "workflow_run_id, workflow_name, branch_name, status, conclusion, completed_at, html_url"),
    fetchScoped<ReleaseSnapshot>(supabase, "github_release_snapshots", scope,
      "tag_name, name, target_commitish, published_at, prerelease, draft, html_url"),
    fetchScoped<DeploymentSnapshot>(supabase, "github_deployment_snapshots", scope,
      "deployment_id, environment, ref, state, occurred_at"),
    fetchEventsSince(supabase, scope, sinceIso),
  ]);

  const metrics = computeMetrics(branches, pulls, workflows, releases, deployments, events, repository.defaultBranch);
  const readiness = computeReadiness({ branches, pullRequests: pulls, workflowRuns: workflows, deployments });

  const graph = buildGitHubLivingGraph({
    repositoryName: repository.fullName,
    windowLabel: isEs ? WINDOW_LABELS[windowDays].es : WINDOW_LABELS[windowDays].en,
    defaultBranch: repository.defaultBranch,
    branches,
    pullRequests: pulls,
    releases,
    events,
    windowDays,
    rangeStartAt,
    rangeEndAt,
  });

  const summary = buildGitHubSummary({
    branches, pullRequests: pulls, workflowRuns: workflows, releases, commitCount: metrics.commitCount, readiness, isEs,
  });

  return { repository, windowDays, metrics, graph, readiness, summary, recentActivity: events.slice(0, 15) };
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface Scope { org: string; project: string; repo: string }

async function fetchScoped<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  scope: Scope,
  columns: string,
): Promise<T[]> {
  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq("organization_id", scope.org)
    .eq("project_id", scope.project)
    .eq("repository_id", scope.repo);
  return (data ?? []) as unknown as T[];
}

async function fetchEventsSince(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: Scope,
  sinceIso: string,
): Promise<ActivityEventSnapshot[]> {
  const { data } = await supabase
    .from("github_activity_events")
    .select("github_event_type, github_action, actor_login, branch_name, sha, title, url, occurred_at, payload_summary")
    .eq("organization_id", scope.org)
    .eq("project_id", scope.project)
    .eq("repository_id", scope.repo)
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as ActivityEventSnapshot[];
}

function emptyMetrics(): DashboardMetrics {
  return {
    commitCount: 0, activeBranchCount: 0, openPrCount: 0, mergedPrCount: 0,
    failedWorkflowCount: 0, successWorkflowCount: 0, releaseCount: 0, deploymentCount: 0,
  };
}

function computeMetrics(
  branches: BranchSnapshot[],
  pulls: PullRequestSnapshot[],
  workflows: WorkflowRunSnapshot[],
  releases: ReleaseSnapshot[],
  deployments: DeploymentSnapshot[],
  events: ActivityEventSnapshot[],
  defaultBranch: string,
): DashboardMetrics {
  // Commits KPI = real commits on the default branch in the window (matches
  // GitHub Insights "commits" for the range) — not raw push webhook events.
  const commitCount = new Set(
    events
      .filter((e) => e.github_event_type === "push" && e.branch_name === defaultBranch && e.sha)
      .map((e) => e.sha),
  ).size;

  return {
    commitCount: commitCount || events.filter((e) => e.sha).length,
    activeBranchCount: branches.filter((b) => b.status === "active").length,
    openPrCount: pulls.filter((p) => p.state === "open").length,
    mergedPrCount: pulls.filter((p) => p.state === "merged").length,
    failedWorkflowCount: workflows.filter((w) => w.conclusion === "failure").length,
    successWorkflowCount: workflows.filter((w) => w.conclusion === "success").length,
    releaseCount: releases.filter((r) => !r.draft).length,
    deploymentCount: deployments.length,
  };
}
