// ============================================================================
// GitHub Living Graph — density + focus builder (scales to high-volume repos)
// ============================================================================
// A literal git-graph (one line per branch) breaks past ~10 branches. This
// builder switches to DENSITY + FOCUS:
//  • master = a per-day commit density band + daily merge badges (not N dots).
//  • only LIVE branches (open PR ∪ commits < 72h, ≤8) get individual lanes.
//  • everything else is AGGREGATED (inactive list) — nothing is silently hidden.
//  • an auto-zoom domain (≈P5 of activity → now) kills the empty canvas.
// Pure + framework-free.
// ============================================================================

import type {
  ActivityEventSnapshot,
  BranchSnapshot,
  GitHubGraphBranch,
  GitHubGraphNode,
  GitHubLivingGraphData,
  InactiveBranch,
  PullRequestSnapshot,
  ReleaseSnapshot,
} from "./types";
import { classifyBranch } from "./branch-classification";

/** Safety cap: at most this many drawn lanes per side (packing keeps rows low;
 *  this only guards pathological repos). Kept exported for the renderer. */
export const MAX_LANES = 60;
export const MAX_NODES_PER_BRANCH = 16;
export const LIVE_WINDOW_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const MIN_AUTO_DAYS = 3;

export interface GraphBuildInput {
  repositoryName: string;
  windowLabel: string;
  defaultBranch: string;
  branches: BranchSnapshot[];
  pullRequests: PullRequestSnapshot[];
  releases: ReleaseSnapshot[];
  events: ActivityEventSnapshot[];
  windowDays: number;
  rangeStartAt: string;
  rangeEndAt: string;
}

function ms(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor((p / 100) * sortedAsc.length)));
  return sortedAsc[idx];
}

export function buildGitHubLivingGraph(input: GraphBuildInput): GitHubLivingGraphData {
  const def = input.defaultBranch;
  const now = ms(input.rangeEndAt) || Date.now();
  const fullStart = ms(input.rangeStartAt) || now - input.windowDays * DAY_MS;

  const pushEvents = input.events.filter((e) => e.github_event_type === "push" && e.sha);
  const masterEvents = pushEvents.filter((e) => e.branch_name === def);

  // ── Auto-zoom domain: ~P5 of all activity → now (min 3 days) ────────────────
  const allTimes = pushEvents.map((e) => ms(e.occurred_at)).filter((t) => t > 0).sort((a, b) => a - b);
  let autoStart = allTimes.length ? Math.max(fullStart, percentile(allTimes, 5)) : now - MIN_AUTO_DAYS * DAY_MS;
  const autoEnd = now;
  if (autoEnd - autoStart < MIN_AUTO_DAYS * DAY_MS) {
    autoStart = Math.max(fullStart, autoEnd - MIN_AUTO_DAYS * DAY_MS);
  }

  // ── Raw master commit times (distinct by sha) — bucketed client-side ────────
  const seenSha = new Set<string>();
  const masterCommitTimes: string[] = [];
  for (const e of masterEvents) {
    if (e.sha && !seenSha.has(e.sha)) { seenSha.add(e.sha); masterCommitTimes.push(e.occurred_at); }
  }
  masterCommitTimes.sort();
  const totalMasterCommits = seenSha.size;

  // First commit of the repo in the loaded data (oldest push overall).
  const allCommitTimes = pushEvents.map((e) => ms(e.occurred_at)).filter((t) => t > 0);
  const firstCommitAt = allCommitTimes.length ? new Date(Math.min(...allCommitTimes)).toISOString() : new Date(fullStart).toISOString();

  // ── Raw merged PRs — bucketed client-side by zoom ───────────────────────────
  const mergedPRs = input.pullRequests.filter((p) => p.merged_at);
  const merges = mergedPRs
    .map((p) => ({ number: p.pr_number, title: p.title ?? "", branch: p.source_branch ?? "", mergedAt: p.merged_at! }))
    .sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));

  // ── Every side branch becomes a lane (packed client-side). A branch is drawn
  //    when it has a temporal anchor (a commit or a merge). Anchorless branches
  //    (nothing in the loaded data) go to the inactive side panel. ────────────
  const openPrBranch = new Set(
    input.pullRequests.filter((p) => p.state === "open" && p.source_branch).map((p) => p.source_branch!),
  );
  const sideBranches = input.branches.filter((b) => classifyBranch(b.branch_name, def) !== "main" && b.branch_name !== def);

  const recency = (b: BranchSnapshot) => Math.max(ms(b.last_commit_at), ms(b.merged_at));
  const hasAnchor = (b: BranchSnapshot) => b.last_commit_at != null || b.merged_at != null;

  const eventsByBranch = new Map<string, ActivityEventSnapshot[]>();
  for (const e of pushEvents) {
    if (!e.branch_name) continue;
    const arr = eventsByBranch.get(e.branch_name) ?? [];
    arr.push(e);
    eventsByBranch.set(e.branch_name, arr);
  }

  const drawable = sideBranches.filter(hasAnchor).sort((a, b) => recency(b) - recency(a));

  const branches: GitHubGraphBranch[] = drawable.map((b) => {
    const evs = (eventsByBranch.get(b.branch_name) ?? []).sort((x, y) => ms(x.occurred_at) - ms(y.occurred_at));
    const nodes = collapseCommits(evs, b);
    const nodeTimes = evs.map((e) => ms(e.occurred_at)).filter((t) => t > 0);
    const openPr = b.open_pr_number ?? input.pullRequests.find((p) => p.state === "open" && p.source_branch === b.branch_name)?.pr_number;
    // When per-branch commits weren't ingested, still show how many there were.
    const hiddenCommitCount = Math.max(0, (b.commit_count_window || 0) - nodes.length);
    return {
      id: b.branch_name,
      name: b.branch_name,
      type: classifyBranch(b.branch_name, def),
      status: b.status,
      openPrNumber: openPr ?? undefined,
      mergeSha: b.merged_at ? b.head_sha ?? undefined : undefined,
      nodes,
      hiddenCommitCount,
      startAt: nodeTimes.length ? new Date(Math.min(...nodeTimes)).toISOString() : b.last_commit_at ?? b.merged_at ?? undefined,
      mergedAt: b.merged_at ?? undefined,
      lastCommitAt: b.last_commit_at ?? (nodeTimes.length ? new Date(Math.max(...nodeTimes)).toISOString() : undefined),
    };
  });

  // ── Inactive: anchorless branches (aggregated for the side panel) ───────────
  const inactiveBranches: InactiveBranch[] = sideBranches
    .filter((b) => !hasAnchor(b))
    .map((b) => ({
      name: b.branch_name,
      type: classifyBranch(b.branch_name, def),
      status: b.status,
      mergedAt: b.merged_at ?? undefined,
      lastActivityAt: b.last_commit_at ?? b.merged_at ?? undefined,
      prNumber: b.open_pr_number ?? undefined,
    }))
    .sort((a, b) => ms(b.lastActivityAt) - ms(a.lastActivityAt));

  const tags = input.releases
    .filter((r) => !r.draft && r.published_at)
    .sort((a, b) => (a.published_at! < b.published_at! ? 1 : -1))
    .slice(0, 12)
    .map((r) => ({ label: r.tag_name, sha: r.target_commitish ?? undefined, occurredAt: r.published_at ?? undefined }));

  return {
    repositoryName: input.repositoryName,
    windowLabel: input.windowLabel,
    mainBranch: def,
    windowDays: input.windowDays,
    autoStartAt: new Date(autoStart).toISOString(),
    autoEndAt: new Date(autoEnd).toISOString(),
    fullStartAt: new Date(fullStart).toISOString(),
    fullEndAt: new Date(now).toISOString(),
    firstCommitAt,
    masterCommitTimes,
    totalMasterCommits,
    merges,
    branches,
    inactiveBranches,
    tags,
  };
}

function collapseCommits(events: ActivityEventSnapshot[], b: BranchSnapshot): GitHubGraphNode[] {
  const type = classifyBranch(b.branch_name, b.base_branch ?? "main");
  const toNode = (e: ActivityEventSnapshot, i: number): GitHubGraphNode => ({
    id: `${b.branch_name}:${e.sha ?? i}`,
    label: e.sha ? e.sha.slice(0, 7) : e.title ?? "commit",
    type: "commit",
    branchName: b.branch_name,
    branchType: type,
    occurredAt: e.occurred_at,
    sha: e.sha ?? undefined,
    url: e.url ?? undefined,
  });

  if (events.length <= MAX_NODES_PER_BRANCH) return events.map(toNode);

  const visibleCount = MAX_NODES_PER_BRANCH - 1;
  const hidden = events.slice(0, events.length - visibleCount);
  const visible = events.slice(events.length - visibleCount);
  const marker: GitHubGraphNode = {
    id: `${b.branch_name}:collapsed`,
    label: `+${hidden.length}`,
    type: "commit",
    branchName: b.branch_name,
    branchType: type,
    occurredAt: hidden[hidden.length - 1]?.occurred_at ?? b.last_commit_at ?? new Date(0).toISOString(),
    collapsedCount: hidden.length,
  };
  return [marker, ...visible.map(toNode)];
}
