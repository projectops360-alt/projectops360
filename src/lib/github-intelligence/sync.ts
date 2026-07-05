// ============================================================================
// GitHub Intelligence — repository sync (PR-centric + paginated history)
// ============================================================================
// Read-only. Builds an accurate execution picture:
//  • FULL master history over the window (paginated) → real commit KPI + spine.
//  • Merged PRs (paginated) → branch lines with merged_at, even if the branch was
//    deleted; per-PR commits give real dots + divergence.
//  • Active branches WITHOUT a PR → fallback commits?sha=branch&since (so
//    in-progress work still shows dots).
//  • Incremental: full backfill once (last_backfill_at), then only fetch commits
//    since the last sync to preserve API rate limit.
// Never writes to GitHub; never mutates canonical ProjectOps360° data.
// ============================================================================

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstallationToken } from "./auth";
import { createGitHubReadClient } from "./client";
import { classifyBranch } from "./branch-classification";

const GITHUB_API = "https://api.github.com";
const DAY = 86_400_000;
const BACKFILL_WINDOW_DAYS = 30;
const MASTER_MAX_PAGES = 6; // up to ~600 commits
const PR_MAX_PAGES = 4; // up to ~400 closed PRs
const MAX_DISPLAY_PRS = 30; // per-PR commit fetches (bounded API cost)
const MAX_ACTIVE_FALLBACK = 12; // active branches without PR to backfill
const OVERLAP_MS = 10 * 60 * 1000;

export interface SyncResult {
  ok: boolean;
  branches: number;
  pullRequests: number;
  workflowRuns: number;
  releases: number;
  deployments: number;
  commits?: number;
  mode?: "backfill" | "incremental";
  errorCode?: string;
}

interface RepoRow {
  id: string; organization_id: string; project_id: string;
  owner: string; name: string; default_branch: string;
  github_installation_id: string | null; last_synced_at: string | null; last_backfill_at: string | null;
}

// ── Read-only GitHub fetch helpers (GET-only, Link pagination) ────────────────
async function ghGet<T>(token: string, path: string): Promise<{ ok: boolean; status: number; data: T; link: string | null }> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    next: { revalidate: 0 },
  });
  const data = res.ok ? ((await res.json()) as T) : ([] as unknown as T);
  return { ok: res.ok, status: res.status, data, link: res.headers.get("link") };
}

async function ghPaginate<T>(token: string, path: string, maxPages: number): Promise<T[]> {
  const out: T[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= maxPages; page++) {
    const { ok, data, link } = await ghGet<T[]>(token, `${path}${sep}page=${page}`);
    if (!ok || !Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    if (!link || !link.includes('rel="next"')) break;
  }
  return out;
}

// GitHub payload shapes (subset)
interface GhCommit { sha: string; html_url: string; commit: { message: string; author?: { date?: string } }; author?: { login?: string } | null }
interface GhBranch { name: string; commit: { sha: string } }
interface GhPull { number: number; title: string; draft: boolean; merged_at: string | null; created_at: string; updated_at: string; html_url: string; user?: { login?: string }; head: { ref: string }; base: { ref: string } }

export async function syncRepository(repositoryId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const empty: SyncResult = { ok: false, branches: 0, pullRequests: 0, workflowRuns: 0, releases: 0, deployments: 0 };

  const { data: repo } = await admin
    .from("github_repositories")
    .select("id, organization_id, project_id, owner, name, default_branch, github_installation_id, last_synced_at, last_backfill_at")
    .eq("id", repositoryId).eq("is_active", true).maybeSingle<RepoRow>();
  if (!repo) return { ...empty, errorCode: "repository_not_found" };

  const { data: installation } = await admin
    .from("github_installations").select("installation_id")
    .eq("id", repo.github_installation_id ?? "").eq("is_active", true)
    .maybeSingle<{ installation_id: number }>();
  if (!installation) { await markSync(admin, repo.id, "error", "no_installation"); return { ...empty, errorCode: "no_installation" }; }

  const nowIso = new Date().toISOString();
  const windowStartIso = new Date(Date.now() - BACKFILL_WINDOW_DAYS * DAY).toISOString();
  const incremental = Boolean(repo.last_backfill_at);
  // Commit cursor: full window on first backfill, else since the last sync (with overlap).
  const sinceIso = incremental
    ? new Date(Math.max(new Date(repo.last_synced_at ?? windowStartIso).getTime() - OVERLAP_MS, new Date(windowStartIso).getTime())).toISOString()
    : windowStartIso;

  const scope = { organization_id: repo.organization_id, project_id: repo.project_id, repository_id: repo.id };
  const { owner, name } = repo;
  const def = repo.default_branch || "main";

  // event dedup by delivery id; branch aggregation
  const eventMap = new Map<string, Record<string, unknown>>();
  interface BR { branch_name: string; branch_type: string; base_branch: string; status: string; head_sha?: string | null; last_commit_at: string | null; commit_count_window: number; merged_at: string | null; open_pr_number: number | null }
  const branchRows = new Map<string, BR>();
  const ensureBranch = (n: string, type?: string): BR => {
    let b = branchRows.get(n);
    if (!b) { b = { branch_name: n, branch_type: type ?? classifyBranch(n, def), base_branch: def, status: n === def ? "active" : "active", last_commit_at: null, commit_count_window: 0, merged_at: null, open_pr_number: null }; branchRows.set(n, b); }
    return b;
  };
  const addCommit = (branch: string, c: GhCommit) => {
    const date = c.commit?.author?.date ?? nowIso;
    const key = `commit:${branch}:${c.sha}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, { ...scope, github_event_type: "push", github_delivery_id: key, actor_login: c.author?.login ?? null, branch_name: branch, sha: c.sha, title: (c.commit?.message ?? "").split("\n")[0].slice(0, 200), url: c.html_url ?? null, occurred_at: date, payload_summary: { commitCount: 1 } });
    }
    const b = ensureBranch(branch);
    b.commit_count_window += 1;
    if (!b.last_commit_at || date > b.last_commit_at) b.last_commit_at = date;
  };

  try {
    const token = (await getInstallationToken(installation.installation_id)).token;
    const gh = createGitHubReadClient(token);

    // 1) master history — FULL on the first backfill (no `since`), else since cursor.
    ensureBranch(def, "main");
    const sinceParam = incremental ? `&since=${sinceIso}` : "";
    const masterCommits = await ghPaginate<GhCommit>(token, `/repos/${owner}/${name}/commits?sha=${encodeURIComponent(def)}${sinceParam}&per_page=100`, MASTER_MAX_PAGES);
    for (const c of masterCommits) addCommit(def, c);

    // 2) closed PRs — full history on backfill; incremental stops at the cursor.
    const closed: GhPull[] = [];
    for (let page = 1; page <= PR_MAX_PAGES; page++) {
      const { ok, data } = await ghGet<GhPull[]>(token, `/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);
      if (!ok || !Array.isArray(data) || data.length === 0) break;
      closed.push(...data);
      if (incremental && data[data.length - 1].updated_at < sinceIso) break;
    }
    const mergedPRs = closed.filter((p) => p.merged_at);
    const openPRs = await ghPaginate<GhPull>(token, `/repos/${owner}/${name}/pulls?state=open&sort=updated&direction=desc&per_page=100`, 1);

    // branch lines from merged PRs (robust to deleted branches)
    for (const p of mergedPRs) {
      const br = p.head?.ref; if (!br) continue;
      const b = ensureBranch(br);
      b.status = "merged"; b.merged_at = p.merged_at; b.base_branch = p.base?.ref ?? def;
    }
    for (const p of openPRs) { const br = p.head?.ref; if (br) ensureBranch(br).open_pr_number = p.number; }

    // 3a) per-PR commits for the most recent merged PRs (real dots + divergence)
    const displayMerged = [...mergedPRs].sort((a, b) => (b.merged_at ?? "").localeCompare(a.merged_at ?? "")).slice(0, MAX_DISPLAY_PRS);
    await Promise.all(displayMerged.map(async (p) => {
      const br = p.head?.ref; if (!br) return;
      try {
        const cs = await ghPaginate<GhCommit>(token, `/repos/${owner}/${name}/pulls/${p.number}/commits?per_page=100`, 1);
        for (const c of cs) addCommit(br, c);
      } catch { /* branch/PR commits unavailable — skip */ }
    }));

    // 3b) active branches WITHOUT a PR → fallback commits?sha=branch&since (in-progress work)
    const listBranches = await ghPaginate<GhBranch>(token, `/repos/${owner}/${name}/branches?per_page=100`, 2);
    const prBranchSet = new Set([...mergedPRs, ...openPRs].map((p) => p.head?.ref).filter(Boolean) as string[]);
    const activeNoPr = listBranches.filter((b) => b.name !== def && !prBranchSet.has(b.name)).slice(0, MAX_ACTIVE_FALLBACK);
    await Promise.all(activeNoPr.map(async (b) => {
      ensureBranch(b.name).head_sha = b.commit.sha;
      try {
        const brSince = incremental ? `&since=${sinceIso}` : `&since=${windowStartIso}`;
        const cs = await ghPaginate<GhCommit>(token, `/repos/${owner}/${name}/commits?sha=${encodeURIComponent(b.name)}${brSince}&per_page=100`, 1);
        for (const c of cs) addCommit(b.name, c);
      } catch { /* skip */ }
    }));
    // register remaining existing branches (0 commits) so counts + "+N hidden" are correct
    for (const b of listBranches) { const r = ensureBranch(b.name); if (!r.head_sha) r.head_sha = b.commit.sha; }

    // 4) workflows / releases / deployments (snapshot tables, unchanged shape)
    const [runs, releases, deployments] = await Promise.all([
      gh.listWorkflowRuns(owner, name).catch(() => []),
      gh.listReleases(owner, name).catch(() => []),
      gh.listDeployments(owner, name).catch(() => []),
    ]);

    // ── upserts ──
    await Promise.all([
      upsert(admin, "github_branch_snapshots", "repository_id,branch_name",
        [...branchRows.values()].map((b) => ({ ...scope, ...b }))),
      upsert(admin, "github_pull_request_snapshots", "repository_id,pr_number",
        [...mergedPRs, ...openPRs].map((p) => ({
          ...scope, pr_number: p.number, title: p.title, state: p.merged_at ? "merged" : "open",
          draft: p.draft, author_login: p.user?.login ?? null, source_branch: p.head?.ref ?? null,
          target_branch: p.base?.ref ?? def, opened_at: p.created_at, updated_at_gh: p.updated_at,
          merged_at: p.merged_at, html_url: p.html_url,
        }))),
      upsert(admin, "github_activity_events", "repository_id,github_delivery_id", [...eventMap.values()]),
      upsert(admin, "github_workflow_run_snapshots", "repository_id,workflow_run_id",
        runs.map((r) => ({ ...scope, workflow_run_id: r.id, workflow_name: r.name, branch_name: r.head_branch, head_sha: r.head_sha, status: r.status, conclusion: r.conclusion, run_started_at: r.run_started_at, completed_at: r.updated_at, html_url: r.html_url }))),
      upsert(admin, "github_release_snapshots", "repository_id,tag_name",
        releases.map((r) => ({ ...scope, tag_name: r.tag_name, name: r.name, target_commitish: r.target_commitish, published_at: r.published_at, prerelease: r.prerelease, draft: r.draft, html_url: r.html_url }))),
      upsert(admin, "github_deployment_snapshots", "repository_id,deployment_id",
        deployments.map((d) => ({ ...scope, deployment_id: d.id, environment: d.environment, ref: d.ref, sha: d.sha, occurred_at: d.created_at }))),
    ]);

    await admin.from("github_repositories").update({
      last_synced_at: nowIso, last_sync_status: "success", last_sync_error_code: null,
      ...(incremental ? {} : { last_backfill_at: nowIso }),
    }).eq("id", repo.id);

    return {
      ok: true, branches: branchRows.size, pullRequests: mergedPRs.length + openPRs.length,
      workflowRuns: runs.length, releases: releases.length, deployments: deployments.length,
      commits: eventMap.size, mode: incremental ? "incremental" : "backfill",
    };
  } catch (err) {
    console.error("[github-sync] failed for repository", repo.id, (err as Error)?.message);
    await markSync(admin, repo.id, "error", "sync_failed");
    return { ...empty, errorCode: "sync_failed" };
  }
}

async function upsert(admin: ReturnType<typeof createAdminClient>, table: string, conflict: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  // chunk to avoid oversized payloads on large backfills
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from(table).upsert(rows.slice(i, i + 500), { onConflict: conflict });
  }
}

async function markSync(admin: ReturnType<typeof createAdminClient>, repositoryId: string, status: "success" | "error", errorCode: string | null): Promise<void> {
  await admin.from("github_repositories")
    .update({ last_synced_at: new Date().toISOString(), last_sync_status: status, last_sync_error_code: errorCode })
    .eq("id", repositoryId);
}
