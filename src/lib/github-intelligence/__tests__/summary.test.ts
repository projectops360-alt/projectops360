import { describe, it, expect } from "vitest";
import { buildGitHubSummary } from "../summary";
import { computeReadiness } from "../readiness";
import type { BranchSnapshot, WorkflowRunSnapshot } from "../types";

const goodReadiness = computeReadiness({ branches: [], pullRequests: [], workflowRuns: [{ workflow_run_id: 1, workflow_name: "Deploy", branch_name: "main", status: "completed", conclusion: "success", completed_at: null, html_url: null }], deployments: [{ deployment_id: 1, environment: "prod", ref: "main", state: "success", occurred_at: null }] });

describe("buildGitHubSummary", () => {
  it("reports no activity for an empty window", () => {
    const s = buildGitHubSummary({ branches: [], pullRequests: [], workflowRuns: [], releases: [], commitCount: 0, readiness: goodReadiness });
    expect(s.summary.toLowerCase()).toContain("no recent");
    expect(s.readinessScore).toBe(goodReadiness.score);
  });

  it("surfaces a failing workflow as the primary risk + recommendation", () => {
    const workflowRuns: WorkflowRunSnapshot[] = [
      { workflow_run_id: 1, workflow_name: "Visual Regression", branch_name: "hotfix/login", status: "completed", conclusion: "failure", completed_at: null, html_url: null },
    ];
    const readiness = computeReadiness({ branches: [], pullRequests: [], workflowRuns, deployments: [] });
    const s = buildGitHubSummary({ branches: [], pullRequests: [], workflowRuns, releases: [], commitCount: 5, readiness });
    expect(s.risk).toContain("Visual Regression");
    expect(s.recommendation).toBeTruthy();
  });

  it("mentions an active hotfix branch", () => {
    const branches: BranchSnapshot[] = [
      { branch_name: "hotfix/x", branch_type: "hotfix", head_sha: null, base_branch: "main", last_commit_at: null, commit_count_window: 1, open_pr_number: null, merged_at: null, status: "active" },
    ];
    const readiness = computeReadiness({ branches, pullRequests: [], workflowRuns: [], deployments: [] });
    const s = buildGitHubSummary({ branches, pullRequests: [], workflowRuns: [], releases: [], commitCount: 3, readiness });
    expect(s.summary.toLowerCase()).toContain("hotfix");
  });

  it("supports Spanish output", () => {
    const s = buildGitHubSummary({ branches: [], pullRequests: [], workflowRuns: [], releases: [], commitCount: 0, readiness: goodReadiness, isEs: true });
    expect(s.summary.toLowerCase()).toContain("no hay");
  });

  it("never mutates inputs (read-only)", () => {
    const branches: BranchSnapshot[] = [];
    Object.freeze(branches);
    expect(() =>
      buildGitHubSummary({ branches, pullRequests: [], workflowRuns: [], releases: [], commitCount: 0, readiness: goodReadiness }),
    ).not.toThrow();
  });
});
