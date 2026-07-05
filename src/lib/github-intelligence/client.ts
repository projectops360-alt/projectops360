// ============================================================================
// GitHub Intelligence — READ-ONLY GitHub REST client (SERVER ONLY)
// ============================================================================
// Encapsulates the *only* GitHub calls this layer is allowed to make. Every
// method is a GET (read). There are intentionally NO write methods here: no
// commit/merge/close/comment/status/dispatch. This is enforced by review + the
// read-only guardrail test (github-readonly.test.ts) which asserts no mutating
// verbs appear in this module.
// ============================================================================

import "server-only";

const GITHUB_API = "https://api.github.com";

export interface GitHubClient {
  listInstallationRepositories(): Promise<GitHubRepo[]>;
  getRepository(owner: string, repo: string): Promise<GitHubRepo>;
  listBranches(owner: string, repo: string): Promise<GitHubBranchRef[]>;
  listCommits(owner: string, repo: string, sha?: string): Promise<GitHubCommit[]>;
  listPullRequests(owner: string, repo: string): Promise<GitHubPull[]>;
  listWorkflowRuns(owner: string, repo: string): Promise<GitHubWorkflowRun[]>;
  listReleases(owner: string, repo: string): Promise<GitHubRelease[]>;
  listDeployments(owner: string, repo: string): Promise<GitHubDeployment[]>;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: { login: string };
}
export interface GitHubBranchRef {
  name: string;
  commit: { sha: string };
}
export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { date?: string } };
  author?: { login?: string } | null;
}
export interface GitHubPull {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged_at: string | null;
  html_url: string;
  user?: { login?: string };
  head: { ref: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
}
export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  run_started_at: string;
  updated_at: string;
  html_url: string;
}
export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  target_commitish: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
}
export interface GitHubDeployment {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  created_at: string;
}

/** GET-only fetch helper. Never used for mutations. */
async function ghGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    // Read model; keep responses fresh but let Next cache short-term.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`GitHub read request failed (${res.status}) for ${path.split("?")[0]}`);
  }
  return (await res.json()) as T;
}

/**
 * Build a read-only client bound to a short-lived installation token.
 * The token is captured in the closure and never returned.
 */
export function createGitHubReadClient(installationToken: string): GitHubClient {
  const token = installationToken;
  return {
    listInstallationRepositories: async () => {
      const data = await ghGet<{ repositories: GitHubRepo[] }>(token, "/installation/repositories?per_page=100");
      return data.repositories;
    },
    getRepository: (owner, repo) => ghGet<GitHubRepo>(token, `/repos/${owner}/${repo}`),
    listBranches: (owner, repo) => ghGet<GitHubBranchRef[]>(token, `/repos/${owner}/${repo}/branches?per_page=50`),
    listCommits: (owner, repo, sha) =>
      ghGet<GitHubCommit[]>(token, `/repos/${owner}/${repo}/commits?per_page=30${sha ? `&sha=${sha}` : ""}`),
    listPullRequests: (owner, repo) =>
      ghGet<GitHubPull[]>(token, `/repos/${owner}/${repo}/pulls?state=all&per_page=30&sort=updated&direction=desc`),
    listWorkflowRuns: (owner, repo) =>
      ghGet<{ workflow_runs: GitHubWorkflowRun[] }>(token, `/repos/${owner}/${repo}/actions/runs?per_page=30`).then(
        (d) => d.workflow_runs,
      ),
    listReleases: (owner, repo) => ghGet<GitHubRelease[]>(token, `/repos/${owner}/${repo}/releases?per_page=20`),
    listDeployments: (owner, repo) => ghGet<GitHubDeployment[]>(token, `/repos/${owner}/${repo}/deployments?per_page=20`),
  };
}
