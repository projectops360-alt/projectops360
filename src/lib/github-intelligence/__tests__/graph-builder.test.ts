import { describe, it, expect } from "vitest";
import { buildGitHubLivingGraph, MAX_BRANCHES, MAX_NODES_PER_BRANCH, type GraphBuildInput } from "../graph-builder";
import type { BranchSnapshot, ActivityEventSnapshot } from "../types";

function branch(name: string, type: BranchSnapshot["branch_type"], p: Partial<BranchSnapshot> = {}): BranchSnapshot {
  return {
    branch_name: name, branch_type: type, head_sha: "abc1234", base_branch: "main",
    last_commit_at: new Date().toISOString(), commit_count_window: 1, open_pr_number: null, merged_at: null, status: "active", ...p,
  };
}

function baseInput(branches: BranchSnapshot[], events: ActivityEventSnapshot[] = []): GraphBuildInput {
  return {
    repositoryName: "acme/app", windowLabel: "Last 14 days", defaultBranch: "main",
    branches, pullRequests: [], releases: [], events,
    windowDays: 14, rangeStartAt: "2026-01-01T00:00:00Z", rangeEndAt: "2026-01-15T00:00:00Z",
  };
}

describe("buildGitHubLivingGraph", () => {
  it("handles empty data", () => {
    const g = buildGitHubLivingGraph(baseInput([]));
    expect(g.branches).toEqual([]);
    expect(g.hiddenBranchCount).toBe(0);
    expect(g.mainBranch).toBe("main");
  });

  it("keeps main as the spine and classifies lanes", () => {
    const g = buildGitHubLivingGraph(
      baseInput([
        branch("main", "main"),
        branch("feature/x", "feature"),
        branch("hotfix/y", "hotfix"),
        branch("release/1", "release"),
      ]),
    );
    expect(g.mainBranch).toBe("main");
    const types = Object.fromEntries(g.branches.map((b) => [b.name, b.type]));
    expect(types["feature/x"]).toBe("feature");
    expect(types["hotfix/y"]).toBe("hotfix");
    expect(types["release/1"]).toBe("release");
  });

  it("caps rendered branches and reports hidden count", () => {
    const many: BranchSnapshot[] = [branch("main", "main")];
    for (let i = 0; i < 12; i++) many.push(branch(`feature/f${i}`, "feature"));
    const g = buildGitHubLivingGraph(baseInput(many));
    expect(g.branches.length).toBeLessThanOrEqual(MAX_BRANCHES);
    expect(g.hiddenBranchCount).toBeGreaterThan(0);
    expect(g.branches.length + g.hiddenBranchCount).toBe(many.length);
  });

  it("prioritizes active hotfix and open-PR branches when overcrowded", () => {
    const many: BranchSnapshot[] = [branch("main", "main")];
    for (let i = 0; i < 8; i++) many.push(branch(`feature/f${i}`, "feature"));
    many.push(branch("hotfix/critical", "hotfix", { status: "active" }));
    many.push(branch("feature/with-pr", "feature", { open_pr_number: 99 }));
    const g = buildGitHubLivingGraph(baseInput(many));
    const names = g.branches.map((b) => b.name);
    expect(names).toContain("hotfix/critical");
    expect(names).toContain("feature/with-pr");
  });

  it("collapses dense commit sequences instead of overcrowding", () => {
    const b = branch("feature/dense", "feature", { commit_count_window: 20 });
    const events: ActivityEventSnapshot[] = [];
    for (let i = 0; i < 20; i++) {
      events.push({
        github_event_type: "push", github_action: null, actor_login: "d", branch_name: "feature/dense",
        sha: `sha${i}`, title: `c${i}`, url: null, occurred_at: new Date(Date.now() - i * 1000).toISOString(),
      });
    }
    const g = buildGitHubLivingGraph(baseInput([branch("main", "main"), b], events));
    const dense = g.branches.find((x) => x.name === "feature/dense")!;
    expect(dense.nodes.length).toBeLessThanOrEqual(MAX_NODES_PER_BRANCH);
    const collapsed = dense.nodes.find((n) => n.collapsedCount && n.collapsedCount > 0);
    expect(collapsed).toBeTruthy();
    expect(collapsed!.label.startsWith("+")).toBe(true);
  });
});
