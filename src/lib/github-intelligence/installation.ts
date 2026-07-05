// ============================================================================
// GitHub Intelligence — installation repository listing (SERVER ONLY)
// ============================================================================
// Lists the repositories an installation can access, via a short-lived
// installation token. Read-only. Used by the repo picker after the GitHub App
// install callback.
// ============================================================================

import "server-only";
import { getInstallationToken } from "./auth";
import { createGitHubReadClient } from "./client";

export interface InstallableRepo {
  githubRepositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string | null;
}

/** List repositories accessible to a GitHub App installation. */
export async function listInstallationRepositories(installationId: number): Promise<InstallableRepo[]> {
  const { token } = await getInstallationToken(installationId);
  const gh = createGitHubReadClient(token);
  const repos = await gh.listInstallationRepositories();
  return repos.map((r) => ({
    githubRepositoryId: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch ?? "main",
    private: r.private,
    htmlUrl: r.html_url ?? null,
  }));
}
