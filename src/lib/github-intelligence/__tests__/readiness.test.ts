import { describe, it, expect } from "vitest";
import { computeReadiness, bandFor } from "../readiness";
import type { BranchSnapshot, WorkflowRunSnapshot, DeploymentSnapshot } from "../types";

function branch(p: Partial<BranchSnapshot>): BranchSnapshot {
  return {
    branch_name: "b", branch_type: "feature", head_sha: null, base_branch: "main",
    last_commit_at: null, commit_count_window: 0, open_pr_number: null, merged_at: null, status: "active", ...p,
  };
}
function run(p: Partial<WorkflowRunSnapshot>): WorkflowRunSnapshot {
  return { workflow_run_id: 1, workflow_name: "CI", branch_name: "main", status: "completed", conclusion: "success", completed_at: null, html_url: null, ...p };
}
const noDeploys: DeploymentSnapshot[] = [];

describe("computeReadiness", () => {
  it("passing workflows with a deploy signal score high", () => {
    const r = computeReadiness({
      branches: [branch({ branch_type: "main", status: "active" })],
      pullRequests: [],
      workflowRuns: [run({ conclusion: "success", workflow_name: "Deploy" })],
      deployments: [{ deployment_id: 1, environment: "prod", ref: "main", state: "success", occurred_at: null }],
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("good");
  });

  it("failed workflow reduces score by 20", () => {
    const r = computeReadiness({
      branches: [branch({ branch_type: "main" })],
      pullRequests: [],
      workflowRuns: [run({ conclusion: "failure", workflow_name: "Deploy" })],
      deployments: [{ deployment_id: 1, environment: "prod", ref: "main", state: "success", occurred_at: null }],
    });
    expect(r.score).toBe(80);
    expect(r.deductions.map((d) => d.reason)).toContain("workflow_failure");
  });

  it("active hotfix reduces score", () => {
    const r = computeReadiness({
      branches: [branch({ branch_type: "hotfix", status: "active" })],
      pullRequests: [],
      workflowRuns: [run({ conclusion: "success", workflow_name: "Deploy" })],
      deployments: [{ deployment_id: 1, environment: "prod", ref: "main", state: "success", occurred_at: null }],
    });
    expect(r.deductions.map((d) => d.reason)).toContain("active_hotfix");
    expect(r.score).toBe(90);
  });

  it("missing deployment signal reduces score by exactly 5", () => {
    const r = computeReadiness({
      branches: [branch({ branch_type: "main" })],
      pullRequests: [],
      workflowRuns: [run({ conclusion: "success", workflow_name: "CI" })],
      deployments: noDeploys,
    });
    expect(r.deductions).toEqual([{ reason: "no_deployment_signal", points: 5 }]);
    expect(r.score).toBe(95);
  });

  it("clamps between 0 and 100", () => {
    const r = computeReadiness({
      branches: [
        branch({ branch_type: "hotfix", status: "active" }),
        branch({ branch_type: "feature", status: "active", commit_count_window: 3, open_pr_number: null }),
        branch({ branch_type: "release", branch_name: "release/1", status: "active" }),
      ],
      pullRequests: [{ pr_number: 1, title: "x", state: "open", draft: false, author_login: null, source_branch: "f", target_branch: "main", review_state: "changes_requested", checks_state: null, opened_at: null, merged_at: null, html_url: null }],
      workflowRuns: [run({ conclusion: "failure" })],
      deployments: noDeploys,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("bandFor maps thresholds", () => {
    expect(bandFor(90)).toBe("good");
    expect(bandFor(70)).toBe("watch");
    expect(bandFor(50)).toBe("at_risk");
    expect(bandFor(10)).toBe("blocked");
  });
});
