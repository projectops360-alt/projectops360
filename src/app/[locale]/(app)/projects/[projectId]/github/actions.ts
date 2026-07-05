"use server";

// ============================================================================
// GitHub Intelligence — project server actions
// ============================================================================
// Every action re-validates the software-project guard server-side (flag +
// software type + tenancy + RBAC). Read-only against GitHub. Never mutates
// canonical task/milestone/risk/decision data.
// ============================================================================

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { assertGitHubIntelligenceAvailable } from "@/lib/github-intelligence/software-project-guard";
import { hasEnvAppConfig, loadEnvAppConfig } from "@/lib/github-intelligence/config";
import { syncRepository } from "@/lib/github-intelligence/sync";
import { buildSampleSnapshots } from "@/lib/github-intelligence/mock-data";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function dashboardPath(projectId: string): string {
  return `/projects/${projectId}/github`;
}

// ── Manual refresh / sync ─────────────────────────────────────────────────────
export async function manualSyncAction(projectId: string, repositoryId: string): Promise<ActionResult> {
  const guard = await assertGitHubIntelligenceAvailable(projectId, { requireManage: true });
  if (!guard.ok) return { ok: false, error: guard.reason };

  await logAudit({
    org: { organizationId: guard.org.organizationId, userId: guard.org.userId },
    projectId,
    action: "update",
    entityType: "github_sync:started",
    entityId: repositoryId,
  });

  const result = await syncRepository(repositoryId);

  await logAudit({
    org: { organizationId: guard.org.organizationId, userId: guard.org.userId },
    projectId,
    action: "update",
    entityType: result.ok ? "github_sync:completed" : "github_sync:failed",
    entityId: repositoryId,
    metadata: { branches: result.branches, pullRequests: result.pullRequests, errorCode: result.errorCode ?? null },
  });

  revalidatePath(dashboardPath(projectId));
  return { ok: result.ok, error: result.ok ? undefined : result.errorCode };
}

// ── Disconnect a repository ───────────────────────────────────────────────────
export async function disconnectRepositoryAction(projectId: string, repositoryId: string): Promise<ActionResult> {
  const guard = await assertGitHubIntelligenceAvailable(projectId, { requireManage: true });
  if (!guard.ok) return { ok: false, error: guard.reason };

  const admin = createAdminClient();
  const { error } = await admin
    .from("github_repositories")
    .update({ is_active: false })
    .eq("id", repositoryId)
    .eq("organization_id", guard.org.organizationId)
    .eq("project_id", projectId);

  if (error) return { ok: false, error: "disconnect_failed" };

  await logAudit({
    org: { organizationId: guard.org.organizationId, userId: guard.org.userId },
    projectId,
    action: "delete",
    entityType: "github_repository:disconnected",
    entityId: repositoryId,
  });

  revalidatePath(dashboardPath(projectId));
  revalidatePath(`/projects/${projectId}/settings/integrations/github`);
  return { ok: true };
}

// ── Start GitHub App installation (Mode A) ────────────────────────────────────
// Creates a one-time state record and returns the GitHub install URL. When no
// GitHub App is configured this returns a not_configured error so the UI shows
// the setup wizard instead.
export async function startInstallationAction(
  projectId: string,
): Promise<ActionResult & { installUrl?: string }> {
  const guard = await assertGitHubIntelligenceAvailable(projectId, { requireManage: true });
  if (!guard.ok) return { ok: false, error: guard.reason };

  const config = loadEnvAppConfig();
  if (!config || !config.slug) {
    return { ok: false, error: "not_configured" };
  }

  const admin = createAdminClient();
  const state = crypto.randomUUID();
  const { error } = await admin.from("github_connection_states").insert({
    organization_id: guard.org.organizationId,
    project_id: projectId,
    user_id: guard.org.userId,
    state,
    flow_type: "app_installation",
    return_path: dashboardPath(projectId),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, error: "state_create_failed" };

  const installUrl = `https://github.com/apps/${config.slug}/installations/new?state=${state}`;
  return { ok: true, installUrl };
}

// ── DEV-SAFE connect (no live GitHub App required) ────────────────────────────
// Behind the feature flag + software guard + manager RBAC. Seeds a synthetic
// repository + sample evidence so the dashboard is demonstrable locally. This
// path is ONLY available when no production GitHub App is configured (so it can
// never shadow a real installation). Clearly synthetic; never calls GitHub.
export async function devConnectSampleRepositoryAction(projectId: string): Promise<ActionResult> {
  const guard = await assertGitHubIntelligenceAvailable(projectId, { requireManage: true });
  if (!guard.ok) return { ok: false, error: guard.reason };
  if (hasEnvAppConfig()) return { ok: false, error: "use_real_install" };

  const admin = createAdminClient();
  const scopeBase = { organization_id: guard.org.organizationId, project_id: projectId };

  const { data: installation, error: instErr } = await admin
    .from("github_installations")
    .insert({
      ...scopeBase,
      installation_id: 0, // synthetic
      account_login: "dev-sample",
      account_type: "Organization",
      connected_by_user_id: guard.org.userId,
    })
    .select("id")
    .single();
  if (instErr || !installation) return { ok: false, error: "install_create_failed" };

  const { data: repo, error: repoErr } = await admin
    .from("github_repositories")
    .insert({
      ...scopeBase,
      github_installation_id: installation.id,
      github_repository_id: Math.floor(Math.random() * 1_000_000) + 1,
      owner: "acme",
      name: "web-app",
      full_name: "acme/web-app",
      default_branch: "main",
      private: true,
      html_url: "https://github.com/acme/web-app",
      last_synced_at: new Date().toISOString(),
      last_sync_status: "success",
    })
    .select("id")
    .single();
  if (repoErr || !repo) return { ok: false, error: "repo_create_failed" };

  const scope = { ...scopeBase, repository_id: repo.id };
  const sample = buildSampleSnapshots(scope);
  await Promise.all([
    admin.from("github_branch_snapshots").upsert(sample.branches, { onConflict: "repository_id,branch_name" }),
    admin.from("github_pull_request_snapshots").upsert(sample.pullRequests, { onConflict: "repository_id,pr_number" }),
    admin.from("github_workflow_run_snapshots").upsert(sample.workflowRuns, { onConflict: "repository_id,workflow_run_id" }),
    admin.from("github_release_snapshots").upsert(sample.releases, { onConflict: "repository_id,tag_name" }),
    admin.from("github_activity_events").upsert(sample.events, { onConflict: "repository_id,github_delivery_id" }),
  ]);

  await logAudit({
    org: { organizationId: guard.org.organizationId, userId: guard.org.userId },
    projectId,
    action: "create",
    entityType: "github_repository:connected_dev_sample",
    entityId: repo.id,
    metadata: { synthetic: true },
  });

  revalidatePath(dashboardPath(projectId));
  revalidatePath(`/projects/${projectId}/settings/integrations/github`);
  return { ok: true };
}
