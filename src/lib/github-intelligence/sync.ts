// ============================================================================
// GitHub Intelligence — manual sync orchestration (SERVER ONLY)
// ============================================================================
// Pulls current repository data via the READ-ONLY client and upserts snapshot
// rows using the service-role client. Scoped by org/project/repository. Caller
// MUST pass the software-project guard first (with requireManage as needed).
// Fails gracefully; records last_sync_status on the repository row.
//
// Read-only against GitHub. Never writes to GitHub. Never mutates canonical
// ProjectOps360° task/milestone/risk/decision data.
// ============================================================================

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstallationToken } from "./auth";
import { createGitHubReadClient } from "./client";
import { classifyBranch } from "./branch-classification";

export interface SyncResult {
  ok: boolean;
  branches: number;
  pullRequests: number;
  workflowRuns: number;
  releases: number;
  deployments: number;
  errorCode?: string;
}

interface RepoRow {
  id: string;
  organization_id: string;
  project_id: string;
  owner: string;
  name: string;
  default_branch: string;
  github_installation_id: string | null;
}

export async function syncRepository(repositoryId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const empty: SyncResult = { ok: false, branches: 0, pullRequests: 0, workflowRuns: 0, releases: 0, deployments: 0 };

  const { data: repo } = await admin
    .from("github_repositories")
    .select("id, organization_id, project_id, owner, name, default_branch, github_installation_id")
    .eq("id", repositoryId)
    .eq("is_active", true)
    .maybeSingle<RepoRow>();

  if (!repo) return { ...empty, errorCode: "repository_not_found" };

  const { data: installation } = await admin
    .from("github_installations")
    .select("installation_id")
    .eq("id", repo.github_installation_id ?? "")
    .eq("is_active", true)
    .maybeSingle<{ installation_id: number }>();

  if (!installation) {
    await markSync(admin, repo.id, "error", "no_installation");
    return { ...empty, errorCode: "no_installation" };
  }

  try {
    const { token } = await getInstallationToken(installation.installation_id);
    const gh = createGitHubReadClient(token);
    const scope = { organization_id: repo.organization_id, project_id: repo.project_id, repository_id: repo.id };

    const [branches, pulls, runs, releases, deployments] = await Promise.all([
      gh.listBranches(repo.owner, repo.name),
      gh.listPullRequests(repo.owner, repo.name),
      gh.listWorkflowRuns(repo.owner, repo.name),
      gh.listReleases(repo.owner, repo.name),
      gh.listDeployments(repo.owner, repo.name).catch(() => []),
    ]);

    await Promise.all([
      upsert(admin, "github_branch_snapshots", "repository_id,branch_name",
        branches.map((b) => ({
          ...scope,
          branch_name: b.name,
          branch_type: classifyBranch(b.name, repo.default_branch),
          head_sha: b.commit.sha,
          base_branch: repo.default_branch,
          status: "active",
        }))),
      upsert(admin, "github_pull_request_snapshots", "repository_id,pr_number",
        pulls.map((p) => ({
          ...scope,
          pr_number: p.number,
          title: p.title,
          state: p.merged_at ? "merged" : p.state === "closed" ? "closed" : "open",
          draft: p.draft,
          author_login: p.user?.login ?? null,
          source_branch: p.head.ref,
          target_branch: p.base.ref,
          opened_at: p.created_at,
          updated_at_gh: p.updated_at,
          merged_at: p.merged_at,
          html_url: p.html_url,
        }))),
      upsert(admin, "github_workflow_run_snapshots", "repository_id,workflow_run_id",
        runs.map((r) => ({
          ...scope,
          workflow_run_id: r.id,
          workflow_name: r.name,
          branch_name: r.head_branch,
          head_sha: r.head_sha,
          status: r.status,
          conclusion: r.conclusion,
          run_started_at: r.run_started_at,
          completed_at: r.updated_at,
          html_url: r.html_url,
        }))),
      upsert(admin, "github_release_snapshots", "repository_id,tag_name",
        releases.map((r) => ({
          ...scope,
          tag_name: r.tag_name,
          name: r.name,
          target_commitish: r.target_commitish,
          published_at: r.published_at,
          prerelease: r.prerelease,
          draft: r.draft,
          html_url: r.html_url,
        }))),
      upsert(admin, "github_deployment_snapshots", "repository_id,deployment_id",
        deployments.map((d) => ({
          ...scope,
          deployment_id: d.id,
          environment: d.environment,
          ref: d.ref,
          sha: d.sha,
          occurred_at: d.created_at,
        }))),
    ]);

    await markSync(admin, repo.id, "success", null);
    return {
      ok: true,
      branches: branches.length,
      pullRequests: pulls.length,
      workflowRuns: runs.length,
      releases: releases.length,
      deployments: deployments.length,
    };
  } catch (err) {
    // Never leak tokens/secrets — record a coarse code only.
    console.error("[github-sync] failed for repository", repo.id, (err as Error)?.message);
    await markSync(admin, repo.id, "error", "sync_failed");
    return { ...empty, errorCode: "sync_failed" };
  }
}

async function upsert(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  conflict: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  await admin.from(table).upsert(rows, { onConflict: conflict });
}

async function markSync(
  admin: ReturnType<typeof createAdminClient>,
  repositoryId: string,
  status: "success" | "error",
  errorCode: string | null,
): Promise<void> {
  await admin
    .from("github_repositories")
    .update({ last_synced_at: new Date().toISOString(), last_sync_status: status, last_sync_error_code: errorCode })
    .eq("id", repositoryId);
}
