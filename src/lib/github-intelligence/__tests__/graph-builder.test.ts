import { describe, it, expect } from "vitest";
import { buildGitHubLivingGraph, MAX_LIVE_LANES, type GraphBuildInput } from "../graph-builder";
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
    expect(g.liveBranches).toEqual([]);
    expect(g.inactiveBranches).toEqual([]);
    expect(g.densityCells.length).toBeGreaterThan(0); // one cell per window day
    expect(g.totalMasterCommits).toBe(0);
  });

  it("density band + KPI count distinct master commits (adjustment 4)", () => {
    const events = [
      pushEvent("main", "m1", 2), pushEvent("main", "m2", 2), pushEvent("main", "m3", 1), pushEvent("main", "m3", 1), // dup sha same day
    ];
    const g = buildGitHubLivingGraph(input({ branches: [branch("main", "main")], events }));
    expect(g.totalMasterCommits).toBe(3); // distinct shas
    const densTotal = g.densityCells.reduce((s, c) => s + c.count, 0);
    expect(densTotal).toBe(3);
  });

  it("auto-zoom domain focuses on the active window (not the full 30 days)", () => {
    // all activity in the last 3 days
    const events = [pushEvent("main", "a", 3), pushEvent("main", "b", 2), pushEvent("main", "c", 1)];
    const g = buildGitHubLivingGraph(input({ branches: [branch("main", "main")], events }));
    const autoSpanDays = (Date.parse(g.autoEndAt) - Date.parse(g.autoStartAt)) / 86_400_000;
    expect(autoSpanDays).toBeLessThan(30);
    expect(autoSpanDays).toBeGreaterThanOrEqual(3); // min 3 days
  });

  it("only LIVE branches get lanes; the rest are aggregated inactive", () => {
    const branches: BranchSnapshot[] = [
      branch("feature/live-recent", "feature", { last_commit_at: iso(1) }), // < 72h → live
      branch("feature/open-pr", "feature", { last_commit_at: iso(10), open_pr_number: 7 }), // open PR → live
      branch("feature/old-merged", "feature", { last_commit_at: iso(20), merged_at: iso(19), status: "merged" }), // inactive
      branch("feat/stale", "feature", { last_commit_at: iso(25) }), // inactive (no PR, old)
    ];
    const g = buildGitHubLivingGraph(input({ branches: [branch("main", "main"), ...branches] }));
    const liveNames = g.liveBranches.map((b) => b.name);
    expect(liveNames).toContain("feature/live-recent");
    expect(liveNames).toContain("feature/open-pr");
    expect(g.inactiveBranches.map((b) => b.name)).toEqual(expect.arrayContaining(["feature/old-merged", "feat/stale"]));
    expect(g.liveBranches.length).toBeLessThanOrEqual(MAX_LIVE_LANES);
  });

  it("caps live lanes at 8", () => {
    const many: BranchSnapshot[] = [branch("main", "main")];
    for (let i = 0; i < 14; i++) many.push(branch(`feature/f${i}`, "feature", { last_commit_at: iso(1), open_pr_number: i }));
    const g = buildGitHubLivingGraph(input({ branches: many }));
    expect(g.liveBranches.length).toBe(MAX_LIVE_LANES);
    expect(g.inactiveBranches.length).toBeGreaterThan(0);
  });

  it("groups merges by day with the PR list", () => {
    const prs: PullRequestSnapshot[] = [
      { pr_number: 10, title: "A", state: "merged", draft: false, author_login: null, source_branch: "feat/a", target_branch: "main", review_state: null, checks_state: null, opened_at: iso(3), merged_at: iso(1), html_url: null },
      { pr_number: 11, title: "B", state: "merged", draft: false, author_login: null, source_branch: "feat/b", target_branch: "main", review_state: null, checks_state: null, opened_at: iso(3), merged_at: iso(1), html_url: null },
    ];
    const g = buildGitHubLivingGraph(input({ pullRequests: prs }));
    const total = g.dailyMerges.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(2);
    expect(g.dailyMerges[0].prs.map((p) => p.number)).toEqual(expect.arrayContaining([10, 11]));
  });
});
