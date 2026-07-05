import { describe, it, expect } from "vitest";
import { buildGitHubLivingGraph, type GraphBuildInput } from "../graph-builder";
import type { BranchSnapshot, ActivityEventSnapshot, PullRequestSnapshot } from "../types";

const NOW = Date.parse("2026-07-05T12:00:00Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

function branch(name: string, type: BranchSnapshot["branch_type"], p: Partial<BranchSnapshot> = {}): BranchSnapshot {
  return {
    branch_name: name, branch_type: type, head_sha: "abc1234", base_branch: "main",
    last_commit_at: iso(1), commit_count_window: 1, open_pr_number: null, merged_at: null, status: "active", ...p,
  };
}
function pushEvent(branch: string, sha: string, daysAgo: number): ActivityEventSnapshot {
  return { github_event_type: "push", github_action: null, actor_login: "d", branch_name: branch, sha, title: "c", url: null, occurred_at: iso(daysAgo) };
}

function input(over: Partial<GraphBuildInput> = {}): GraphBuildInput {
  return {
    repositoryName: "acme/app", windowLabel: "Last 30 days", defaultBranch: "main",
    branches: [], pullRequests: [], releases: [], events: [],
    windowDays: 30, rangeStartAt: iso(30), rangeEndAt: iso(0), ...over,
  };
}

describe("buildGitHubLivingGraph — density + focus", () => {
  it("handles empty data", () => {
    const g = buildGitHubLivingGraph(input());
    expect(g.branches).toEqual([]);
    expect(g.inactiveBranches).toEqual([]);
    expect(g.masterCommitTimes).toEqual([]);
    expect(g.totalMasterCommits).toBe(0);
  });

  it("emits distinct master commit times + KPI count (adjustment 4)", () => {
    const events = [
      pushEvent("main", "m1", 2), pushEvent("main", "m2", 2), pushEvent("main", "m3", 1), pushEvent("main", "m3", 1), // dup sha
    ];
    const g = buildGitHubLivingGraph(input({ branches: [branch("main", "main")], events }));
    expect(g.totalMasterCommits).toBe(3); // distinct shas
    expect(g.masterCommitTimes.length).toBe(3);
  });

  it("auto-zoom domain focuses on the active window (not the full 30 days)", () => {
    // all activity in the last 3 days
    const events = [pushEvent("main", "a", 3), pushEvent("main", "b", 2), pushEvent("main", "c", 1)];
    const g = buildGitHubLivingGraph(input({ branches: [branch("main", "main")], events }));
    const autoSpanDays = (Date.parse(g.autoEndAt) - Date.parse(g.autoStartAt)) / 86_400_000;
    expect(autoSpanDays).toBeLessThan(30);
    expect(autoSpanDays).toBeGreaterThanOrEqual(3); // min 3 days
  });

  it("draws EVERY branch with a temporal anchor as a lane (recent, open, merged, stale)", () => {
    const branches: BranchSnapshot[] = [
      branch("feature/live-recent", "feature", { last_commit_at: iso(1) }),
      branch("feature/open-pr", "feature", { last_commit_at: iso(10), open_pr_number: 7 }),
      branch("feature/old-merged", "feature", { last_commit_at: iso(20), merged_at: iso(19), status: "merged" }),
      branch("feat/stale", "feature", { last_commit_at: iso(25) }),
    ];
    const g = buildGitHubLivingGraph(input({ branches: [branch("main", "main"), ...branches] }));
    const names = g.branches.map((b) => b.name);
    expect(names).toEqual(expect.arrayContaining(["feature/live-recent", "feature/open-pr", "feature/old-merged", "feat/stale"]));
    expect(g.inactiveBranches).toEqual([]); // all anchored → nothing hidden
  });

  it("sends anchorless branches (no commit, no merge) to the inactive panel", () => {
    const g = buildGitHubLivingGraph(input({ branches: [
      branch("main", "main"),
      branch("feature/ghost", "feature", { last_commit_at: null, merged_at: null }),
    ] }));
    expect(g.branches.map((b) => b.name)).not.toContain("feature/ghost");
    expect(g.inactiveBranches.map((b) => b.name)).toContain("feature/ghost");
  });

  it("draws all branches with no ≤8 cap (high-volume repos included)", () => {
    const many: BranchSnapshot[] = [branch("main", "main")];
    for (let i = 0; i < 14; i++) many.push(branch(`feature/f${i}`, "feature", { last_commit_at: iso(1), open_pr_number: i }));
    const g = buildGitHubLivingGraph(input({ branches: many }));
    expect(g.branches.length).toBe(14);
  });

  it("groups merges by day with the PR list", () => {
    const prs: PullRequestSnapshot[] = [
      { pr_number: 10, title: "A", state: "merged", draft: false, author_login: null, source_branch: "feat/a", target_branch: "main", review_state: null, checks_state: null, opened_at: iso(3), merged_at: iso(1), html_url: null },
      { pr_number: 11, title: "B", state: "merged", draft: false, author_login: null, source_branch: "feat/b", target_branch: "main", review_state: null, checks_state: null, opened_at: iso(3), merged_at: iso(1), html_url: null },
    ];
    const g = buildGitHubLivingGraph(input({ pullRequests: prs }));
    expect(g.merges.length).toBe(2);
    expect(g.merges.map((p) => p.number)).toEqual(expect.arrayContaining([10, 11]));
  });
});
