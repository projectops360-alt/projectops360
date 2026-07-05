// ============================================================================
// GitHub Intelligence — fishbone / Git Living Graph data builder
// ============================================================================
// Turns branch/PR/release/activity snapshots into a bounded graph model. The
// point is a POLISHED, READABLE fishbone timeline — never a crowded hairball.
// Overcrowding guardrails are enforced HERE (tested), not in the SVG.
//
// Pure + framework-free.
// ============================================================================

import type {
  ActivityEventSnapshot,
  BranchSnapshot,
  GitHubGraphBranch,
  GitHubGraphNode,
  GitHubLivingGraphData,
  PullRequestSnapshot,
  ReleaseSnapshot,
} from "./types";
import { classifyBranch } from "./branch-classification";

export const MAX_BRANCHES = 6;
export const MAX_NODES_PER_BRANCH = 16;

export interface GraphBuildInput {
  repositoryName: string;
  windowLabel: string;
  defaultBranch: string;
  branches: BranchSnapshot[];
  pullRequests: PullRequestSnapshot[];
  releases: ReleaseSnapshot[];
  /** Recent activity events used to place commit nodes on each branch lane. */
  events: ActivityEventSnapshot[];
  /** Selected window in days (7/14/30) — for the time ruler. */
  windowDays: number;
  /** ISO window start (domain start) and end (≈ now). */
  rangeStartAt: string;
  rangeEndAt: string;
}

/** Relevance rank — lower sorts first. Priority order per product spec:
 *  active hotfix → open-PR branch → release → recent feature → main. */
function branchPriority(b: BranchSnapshot): number {
  if (b.branch_type === "hotfix" && b.status === "active") return 0;
  if (b.open_pr_number != null && b.status === "active") return 1;
  if (b.branch_type === "release") return 2;
  if (b.branch_type === "feature") return 3;
  if (b.branch_type === "main") return 5; // main is the spine — always kept, ranked late
  return 4;
}

/** Real recency = most recent of last commit / merge (adjustment: merged
 *  branches with no in-window last_commit_at still rank by their merge time). */
function recencyTime(b: BranchSnapshot): number {
  const lc = b.last_commit_at ? new Date(b.last_commit_at).getTime() : 0;
  const mg = b.merged_at ? new Date(b.merged_at).getTime() : 0;
  return Math.max(lc, mg);
}

export function buildGitHubLivingGraph(input: GraphBuildInput): GitHubLivingGraphData {
  const { defaultBranch } = input;

  // Normalize branch_type against the actual default branch (defensive: old
  // snapshots may predate a default-branch rename).
  const normalized = input.branches.map((b) => ({
    ...b,
    branch_type: b.branch_type === "main" ? "main" : classifyBranch(b.branch_name, defaultBranch),
  }));

  const mainBranch =
    normalized.find((b) => b.branch_type === "main") ??
    normalized.find((b) => b.branch_name === defaultBranch);

  const others = normalized.filter((b) => b !== mainBranch);

  // Rank non-main branches, keep the most relevant up to the budget.
  const ranked = [...others].sort((a, b) => {
    const pa = branchPriority(a);
    const pb = branchPriority(b);
    if (pa !== pb) return pa - pb;
    return recencyTime(b) - recencyTime(a); // most recent activity first
  });

  const budgetForOthers = mainBranch ? MAX_BRANCHES - 1 : MAX_BRANCHES;
  const kept = ranked.slice(0, budgetForOthers);
  const hiddenBranchCount = Math.max(0, ranked.length - kept.length);

  const selected = mainBranch ? [mainBranch, ...kept] : kept;

  // Index events by branch for commit-node placement.
  const eventsByBranch = new Map<string, ActivityEventSnapshot[]>();
  for (const ev of input.events) {
    if (!ev.branch_name) continue;
    const arr = eventsByBranch.get(ev.branch_name) ?? [];
    arr.push(ev);
    eventsByBranch.set(ev.branch_name, arr);
  }

  const branches: GitHubGraphBranch[] = selected.map((b) => {
    const branchEvents = (eventsByBranch.get(b.branch_name) ?? [])
      .filter((e) => e.github_event_type === "push" || e.sha)
      .sort((a, b2) => new Date(a.occurred_at).getTime() - new Date(b2.occurred_at).getTime());

    const nodes: GitHubGraphNode[] = collapseCommits(branchEvents, b);

    const openPr =
      b.open_pr_number ??
      input.pullRequests.find(
        (p) => p.state === "open" && p.source_branch === b.branch_name,
      )?.pr_number;

    const nodeTimes = branchEvents.map((e) => new Date(e.occurred_at).getTime()).filter((t) => t > 0);
    const startAt = nodeTimes.length ? new Date(Math.min(...nodeTimes)).toISOString() : b.last_commit_at ?? undefined;
    const lastCommitAt = b.last_commit_at ?? (nodeTimes.length ? new Date(Math.max(...nodeTimes)).toISOString() : undefined);

    return {
      id: b.branch_name,
      name: b.branch_name,
      type: b.branch_type,
      status: b.status,
      openPrNumber: openPr ?? undefined,
      mergeSha: b.merged_at ? b.head_sha ?? undefined : undefined,
      nodes,
      hiddenCommitCount: Math.max(0, b.commit_count_window - nodes.length),
      startAt: startAt ?? undefined,
      mergedAt: b.merged_at ?? undefined,
      lastCommitAt: lastCommitAt ?? undefined,
    };
  });

  const tags = input.releases
    .filter((r) => !r.draft)
    .slice(0, 8)
    .map((r) => ({
      label: r.tag_name,
      sha: r.target_commitish ?? undefined,
      occurredAt: r.published_at ?? undefined,
    }));

  return {
    repositoryName: input.repositoryName,
    windowLabel: input.windowLabel,
    mainBranch: mainBranch?.branch_name ?? defaultBranch,
    branches,
    tags,
    hiddenBranchCount,
    windowDays: input.windowDays,
    rangeStartAt: input.rangeStartAt,
    rangeEndAt: input.rangeEndAt,
  };
}

/**
 * Collapse a chronological commit list into at most MAX_NODES_PER_BRANCH nodes.
 * When there are more commits than the budget, the OLDEST are folded into a
 * single leading "+N commits" marker so the newest commits stay individually
 * visible (progressive disclosure).
 */
function collapseCommits(events: ActivityEventSnapshot[], b: BranchSnapshot): GitHubGraphNode[] {
  const toNode = (e: ActivityEventSnapshot, i: number): GitHubGraphNode => ({
    id: `${b.branch_name}:${e.sha ?? i}`,
    label: e.sha ? e.sha.slice(0, 7) : e.title ?? "commit",
    type: "commit",
    branchName: b.branch_name,
    branchType: b.branch_type,
    occurredAt: e.occurred_at,
    sha: e.sha ?? undefined,
    url: e.url ?? undefined,
  });

  if (events.length <= MAX_NODES_PER_BRANCH) {
    return events.map(toNode);
  }

  const visibleCount = MAX_NODES_PER_BRANCH - 1; // reserve one lane for the marker
  const hidden = events.slice(0, events.length - visibleCount);
  const visible = events.slice(events.length - visibleCount);

  const marker: GitHubGraphNode = {
    id: `${b.branch_name}:collapsed`,
    label: `+${hidden.length}`,
    type: "commit",
    branchName: b.branch_name,
    branchType: b.branch_type,
    occurredAt: hidden[hidden.length - 1]?.occurred_at ?? b.last_commit_at ?? new Date(0).toISOString(),
    collapsedCount: hidden.length,
  };

  return [marker, ...visible.map(toNode)];
}
