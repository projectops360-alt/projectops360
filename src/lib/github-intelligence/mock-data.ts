// ============================================================================
// GitHub Intelligence — dev-safe sample evidence
// ============================================================================
// Deterministic sample snapshots for the DEV-SAFE connect path (behind the
// feature flag, no live GitHub App required) and for UI smoke tests. This is
// clearly-labelled synthetic data — it never touches GitHub and never mutates
// canonical ProjectOps360° data.
// ============================================================================

import type { GraphBuildInput } from "./graph-builder";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export interface SampleSnapshotRows {
  branches: Record<string, unknown>[];
  pullRequests: Record<string, unknown>[];
  workflowRuns: Record<string, unknown>[];
  releases: Record<string, unknown>[];
  events: Record<string, unknown>[];
}

/**
 * Sample snapshot rows for a connected repository. Callers inject the tenant
 * scope (organization_id / project_id / repository_id).
 */
export function buildSampleSnapshots(scope: {
  organization_id: string;
  project_id: string;
  repository_id: string;
}): SampleSnapshotRows {
  const branches = [
    { branch_name: "main", branch_type: "main", head_sha: "a1b2c3d", base_branch: "main", last_commit_at: daysAgo(1), commit_count_window: 6, status: "active" },
    { branch_name: "feature/checkout-v2", branch_type: "feature", head_sha: "f1e2d3c", base_branch: "main", last_commit_at: daysAgo(2), commit_count_window: 4, open_pr_number: 42, status: "active" },
    { branch_name: "feature/search", branch_type: "feature", head_sha: "9a8b7c6", base_branch: "main", last_commit_at: daysAgo(3), commit_count_window: 3, status: "active" },
    { branch_name: "hotfix/login-redirect", branch_type: "hotfix", head_sha: "5d4c3b2", base_branch: "main", last_commit_at: daysAgo(1), commit_count_window: 2, status: "active" },
    { branch_name: "release/1.4.0", branch_type: "release", head_sha: "0f9e8d7", base_branch: "main", last_commit_at: daysAgo(2), commit_count_window: 1, status: "active" },
  ].map((b) => ({ ...scope, ...b }));

  const pullRequests = [
    { pr_number: 42, title: "Checkout v2", state: "open", draft: false, author_login: "dev-a", source_branch: "feature/checkout-v2", target_branch: "main", review_state: "approved", html_url: "#" },
    { pr_number: 40, title: "Search relevance", state: "merged", draft: false, author_login: "dev-b", source_branch: "feature/search", target_branch: "main", merged_at: daysAgo(4), html_url: "#" },
  ].map((p) => ({ ...scope, ...p }));

  const workflowRuns = [
    { workflow_run_id: 1001, workflow_name: "CI", branch_name: "main", head_sha: "a1b2c3d", status: "completed", conclusion: "success", completed_at: daysAgo(1), html_url: "#" },
    { workflow_run_id: 1002, workflow_name: "Visual Regression", branch_name: "hotfix/login-redirect", head_sha: "5d4c3b2", status: "completed", conclusion: "failure", completed_at: daysAgo(1), html_url: "#" },
    { workflow_run_id: 1003, workflow_name: "Deploy Staging", branch_name: "main", head_sha: "a1b2c3d", status: "completed", conclusion: "success", completed_at: daysAgo(1), html_url: "#" },
  ].map((w) => ({ ...scope, ...w }));

  const releases = [
    { tag_name: "v1.3.2", name: "v1.3.2", target_commitish: "main", published_at: daysAgo(6), prerelease: false, draft: false, html_url: "#" },
  ].map((r) => ({ ...scope, ...r }));

  const events: Record<string, unknown>[] = [];
  for (const b of branches) {
    const count = (b.commit_count_window as number) ?? 0;
    for (let i = 0; i < count; i++) {
      events.push({
        ...scope,
        github_event_type: "push",
        github_delivery_id: `sample-${b.branch_name}-${i}`,
        branch_name: b.branch_name,
        sha: `${(b.head_sha as string).slice(0, 6)}${i}`,
        title: `commit ${i + 1} on ${b.branch_name}`,
        occurred_at: daysAgo((count - i) as number),
        payload_summary: { commitCount: 1, branchType: b.branch_type },
      });
    }
  }

  return { branches, pullRequests, workflowRuns, releases, events };
}

/** Sample graph-builder input for UI smoke tests / storybook-style previews. */
export function buildSampleGraphInput(): GraphBuildInput {
  return {
    repositoryName: "acme/web-app",
    windowLabel: "Last 14 days",
    defaultBranch: "main",
    branches: [
      { branch_name: "main", branch_type: "main", head_sha: "a1b2c3d", base_branch: "main", last_commit_at: daysAgo(1), commit_count_window: 6, open_pr_number: null, merged_at: null, status: "active" },
      { branch_name: "feature/checkout-v2", branch_type: "feature", head_sha: "f1e2d3c", base_branch: "main", last_commit_at: daysAgo(2), commit_count_window: 4, open_pr_number: 42, merged_at: null, status: "active" },
      { branch_name: "hotfix/login-redirect", branch_type: "hotfix", head_sha: "5d4c3b2", base_branch: "main", last_commit_at: daysAgo(1), commit_count_window: 2, open_pr_number: null, merged_at: null, status: "active" },
      { branch_name: "release/1.4.0", branch_type: "release", head_sha: "0f9e8d7", base_branch: "main", last_commit_at: daysAgo(2), commit_count_window: 1, open_pr_number: null, merged_at: null, status: "active" },
    ],
    pullRequests: [
      { pr_number: 42, title: "Checkout v2", state: "open", draft: false, author_login: "dev-a", source_branch: "feature/checkout-v2", target_branch: "main", review_state: "approved", checks_state: null, merged_at: null, html_url: "#" },
    ],
    releases: [
      { tag_name: "v1.3.2", name: "v1.3.2", target_commitish: "main", published_at: daysAgo(6), prerelease: false, draft: false, html_url: "#" },
    ],
    events: [
      { github_event_type: "push", github_action: null, actor_login: "dev-a", branch_name: "feature/checkout-v2", sha: "f1e2d31", title: "wip", url: "#", occurred_at: daysAgo(2) },
      { github_event_type: "push", github_action: null, actor_login: "dev-a", branch_name: "main", sha: "a1b2c31", title: "merge", url: "#", occurred_at: daysAgo(1) },
    ],
  };
}
