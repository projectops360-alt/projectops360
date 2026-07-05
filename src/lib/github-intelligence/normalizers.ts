// ============================================================================
// GitHub Intelligence — payload normalizers
// ============================================================================
// Pure functions that turn a GitHub webhook/API payload into (a) a normalized
// activity event and (b) an optional snapshot upsert. Callers inject the tenant
// scope (org_id / project_id / repository_id); normalizers stay framework-free
// and store only safe summaries (never raw secrets/tokens).
// ============================================================================

import type { GitHubEventType } from "./types";
import { classifyBranch, refToBranchName } from "./branch-classification";

export interface NormalizedEvent {
  github_event_type: string;
  github_action: string | null;
  github_node_id: string | null;
  github_numeric_id: number | null;
  actor_login: string | null;
  ref: string | null;
  branch_name: string | null;
  sha: string | null;
  title: string | null;
  url: string | null;
  occurred_at: string;
  payload_summary: Record<string, unknown>;
}

export type SnapshotUpsert =
  | { table: "github_branch_snapshots"; row: Record<string, unknown>; conflict: string }
  | { table: "github_pull_request_snapshots"; row: Record<string, unknown>; conflict: string }
  | { table: "github_workflow_run_snapshots"; row: Record<string, unknown>; conflict: string }
  | { table: "github_release_snapshots"; row: Record<string, unknown>; conflict: string }
  | { table: "github_deployment_snapshots"; row: Record<string, unknown>; conflict: string };

export interface NormalizeResult {
  event: NormalizedEvent;
  snapshots: SnapshotUpsert[];
}

type Payload = Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

function pick<T = unknown>(obj: unknown, key: string): T | null {
  if (obj && typeof obj === "object" && key in obj) return (obj as Record<string, T>)[key];
  return null;
}

/**
 * Normalize a supported GitHub event into an activity event + snapshot upserts.
 * `defaultBranch` is used for branch classification. Unknown events fall back
 * to a bare activity event with no snapshot side effects.
 */
export function normalizeEvent(
  eventType: GitHubEventType | string,
  action: string | null,
  payload: Payload,
  defaultBranch: string,
): NormalizeResult {
  const sender = pick<{ login?: string }>(payload, "sender");
  const actor = sender?.login ?? null;

  const base: NormalizedEvent = {
    github_event_type: eventType,
    github_action: action,
    github_node_id: null,
    github_numeric_id: null,
    actor_login: actor,
    ref: null,
    branch_name: null,
    sha: null,
    title: null,
    url: null,
    occurred_at: nowIso(),
    payload_summary: {},
  };

  switch (eventType) {
    case "push":
      return normalizePush(base, payload, defaultBranch);
    case "pull_request":
      return normalizePullRequest(base, action, payload, defaultBranch);
    case "pull_request_review":
      return normalizePullRequestReview(base, action, payload);
    case "workflow_run":
      return normalizeWorkflowRun(base, payload);
    case "release":
      return normalizeRelease(base, action, payload);
    case "deployment":
      return normalizeDeployment(base, payload);
    case "create":
    case "delete":
      return normalizeCreateDelete(base, eventType, payload, defaultBranch);
    default:
      return { event: base, snapshots: [] };
  }
}

// ── push ─────────────────────────────────────────────────────────────────────
function normalizePush(base: NormalizedEvent, payload: Payload, defaultBranch: string): NormalizeResult {
  const ref = pick<string>(payload, "ref");
  const branch = refToBranchName(ref);
  const after = pick<string>(payload, "after");
  const commits = (pick<unknown[]>(payload, "commits") ?? []) as Array<{ message?: string; timestamp?: string }>;
  const headCommit = pick<{ message?: string; timestamp?: string; url?: string }>(payload, "head_commit");
  const branchType = branch ? classifyBranch(branch, defaultBranch) : "other";

  const event: NormalizedEvent = {
    ...base,
    ref,
    branch_name: branch,
    sha: after,
    title: headCommit?.message?.split("\n")[0] ?? null,
    url: headCommit?.url ?? null,
    occurred_at: headCommit?.timestamp ?? base.occurred_at,
    payload_summary: { commitCount: commits.length, branchType },
  };

  const snapshots: SnapshotUpsert[] = branch
    ? [
        {
          table: "github_branch_snapshots",
          conflict: "repository_id,branch_name",
          row: {
            branch_name: branch,
            branch_type: branchType,
            head_sha: after,
            base_branch: defaultBranch,
            last_commit_at: event.occurred_at,
            commit_count_window: commits.length,
            status: "active",
          },
        },
      ]
    : [];

  return { event, snapshots };
}

// ── pull_request ───────────────────────────────────────────────────────────
function normalizePullRequest(
  base: NormalizedEvent,
  action: string | null,
  payload: Payload,
  defaultBranch: string,
): NormalizeResult {
  const pr = pick<Payload>(payload, "pull_request") ?? {};
  const number = pick<number>(payload, "number") ?? pick<number>(pr, "number");
  const head = pick<{ ref?: string }>(pr, "head");
  const baseRef = pick<{ ref?: string }>(pr, "base");
  const merged = pick<boolean>(pr, "merged") ?? false;
  const stateRaw = pick<string>(pr, "state") ?? "open";
  const state = merged ? "merged" : stateRaw === "closed" ? "closed" : "open";

  const event: NormalizedEvent = {
    ...base,
    github_node_id: pick<string>(pr, "node_id"),
    github_numeric_id: number,
    branch_name: head?.ref ?? null,
    title: pick<string>(pr, "title"),
    url: pick<string>(pr, "html_url"),
    payload_summary: { prNumber: number, state, targetBranch: baseRef?.ref ?? defaultBranch },
  };

  const snapshots: SnapshotUpsert[] = number
    ? [
        {
          table: "github_pull_request_snapshots",
          conflict: "repository_id,pr_number",
          row: {
            pr_number: number,
            title: pick<string>(pr, "title"),
            state,
            draft: pick<boolean>(pr, "draft") ?? false,
            author_login: pick<{ login?: string }>(pr, "user")?.login ?? null,
            source_branch: head?.ref ?? null,
            target_branch: baseRef?.ref ?? defaultBranch,
            opened_at: pick<string>(pr, "created_at"),
            updated_at_gh: pick<string>(pr, "updated_at"),
            merged_at: pick<string>(pr, "merged_at"),
            files_changed: pick<number>(pr, "changed_files"),
            additions: pick<number>(pr, "additions"),
            deletions: pick<number>(pr, "deletions"),
            html_url: pick<string>(pr, "html_url"),
          },
        },
      ]
    : [];

  return { event, snapshots };
}

// ── pull_request_review ──────────────────────────────────────────────────────
function normalizePullRequestReview(base: NormalizedEvent, action: string | null, payload: Payload): NormalizeResult {
  const pr = pick<Payload>(payload, "pull_request") ?? {};
  const review = pick<Payload>(payload, "review") ?? {};
  const number = pick<number>(pr, "number");
  const stateRaw = (pick<string>(review, "state") ?? "").toLowerCase();
  // GitHub review states: approved | changes_requested | commented | dismissed
  const reviewState = stateRaw || null;

  const event: NormalizedEvent = {
    ...base,
    github_numeric_id: number,
    branch_name: pick<{ ref?: string }>(pr, "head")?.ref ?? null,
    title: pick<string>(pr, "title"),
    url: pick<string>(pr, "html_url"),
    payload_summary: { prNumber: number, reviewState },
  };

  const snapshots: SnapshotUpsert[] = number
    ? [
        {
          table: "github_pull_request_snapshots",
          conflict: "repository_id,pr_number",
          row: { pr_number: number, review_state: reviewState },
        },
      ]
    : [];

  return { event, snapshots };
}

// ── workflow_run ─────────────────────────────────────────────────────────────
function normalizeWorkflowRun(base: NormalizedEvent, payload: Payload): NormalizeResult {
  const run = pick<Payload>(payload, "workflow_run") ?? {};
  const runId = pick<number>(run, "id");
  const branch = pick<string>(run, "head_branch");
  const conclusion = pick<string>(run, "conclusion");
  const status = pick<string>(run, "status");

  const event: NormalizedEvent = {
    ...base,
    github_numeric_id: runId,
    branch_name: branch,
    sha: pick<string>(run, "head_sha"),
    title: pick<string>(run, "name"),
    url: pick<string>(run, "html_url"),
    occurred_at: pick<string>(run, "updated_at") ?? base.occurred_at,
    payload_summary: { runId, status, conclusion, workflow: pick<string>(run, "name") },
  };

  const snapshots: SnapshotUpsert[] = runId
    ? [
        {
          table: "github_workflow_run_snapshots",
          conflict: "repository_id,workflow_run_id",
          row: {
            workflow_run_id: runId,
            workflow_name: pick<string>(run, "name"),
            branch_name: branch,
            head_sha: pick<string>(run, "head_sha"),
            status,
            conclusion,
            run_started_at: pick<string>(run, "run_started_at"),
            completed_at: pick<string>(run, "updated_at"),
            html_url: pick<string>(run, "html_url"),
          },
        },
      ]
    : [];

  return { event, snapshots };
}

// ── release ──────────────────────────────────────────────────────────────────
function normalizeRelease(base: NormalizedEvent, action: string | null, payload: Payload): NormalizeResult {
  const rel = pick<Payload>(payload, "release") ?? {};
  const tag = pick<string>(rel, "tag_name");

  const event: NormalizedEvent = {
    ...base,
    github_node_id: pick<string>(rel, "node_id"),
    title: pick<string>(rel, "name") ?? tag,
    url: pick<string>(rel, "html_url"),
    occurred_at: pick<string>(rel, "published_at") ?? base.occurred_at,
    payload_summary: { tag, prerelease: pick<boolean>(rel, "prerelease") ?? false },
  };

  const snapshots: SnapshotUpsert[] = tag
    ? [
        {
          table: "github_release_snapshots",
          conflict: "repository_id,tag_name",
          row: {
            tag_name: tag,
            name: pick<string>(rel, "name"),
            target_commitish: pick<string>(rel, "target_commitish"),
            published_at: pick<string>(rel, "published_at"),
            prerelease: pick<boolean>(rel, "prerelease") ?? false,
            draft: pick<boolean>(rel, "draft") ?? false,
            html_url: pick<string>(rel, "html_url"),
          },
        },
      ]
    : [];

  return { event, snapshots };
}

// ── deployment ───────────────────────────────────────────────────────────────
function normalizeDeployment(base: NormalizedEvent, payload: Payload): NormalizeResult {
  const dep = pick<Payload>(payload, "deployment") ?? {};
  const depId = pick<number>(dep, "id");
  const env = pick<string>(dep, "environment");

  const event: NormalizedEvent = {
    ...base,
    github_numeric_id: depId,
    ref: pick<string>(dep, "ref"),
    sha: pick<string>(dep, "sha"),
    title: env,
    occurred_at: pick<string>(dep, "created_at") ?? base.occurred_at,
    payload_summary: { deploymentId: depId, environment: env },
  };

  const snapshots: SnapshotUpsert[] = depId
    ? [
        {
          table: "github_deployment_snapshots",
          conflict: "repository_id,deployment_id",
          row: {
            deployment_id: depId,
            environment: env,
            ref: pick<string>(dep, "ref"),
            sha: pick<string>(dep, "sha"),
            state: pick<string>(dep, "state"),
            occurred_at: pick<string>(dep, "created_at"),
          },
        },
      ]
    : [];

  return { event, snapshots };
}

// ── create / delete (branches & tags) ────────────────────────────────────────
function normalizeCreateDelete(
  base: NormalizedEvent,
  eventType: "create" | "delete",
  payload: Payload,
  defaultBranch: string,
): NormalizeResult {
  const refType = pick<string>(payload, "ref_type"); // "branch" | "tag"
  const ref = pick<string>(payload, "ref");
  const branch = refType === "branch" ? ref : null;
  const branchType = branch ? classifyBranch(branch, defaultBranch) : "other";

  const event: NormalizedEvent = {
    ...base,
    ref,
    branch_name: branch,
    title: `${eventType} ${refType ?? ""} ${ref ?? ""}`.trim(),
    payload_summary: { refType, ref, branchType },
  };

  // A deleted branch is marked stale; a created branch becomes an active lane.
  const snapshots: SnapshotUpsert[] =
    branch && refType === "branch"
      ? [
          {
            table: "github_branch_snapshots",
            conflict: "repository_id,branch_name",
            row: {
              branch_name: branch,
              branch_type: branchType,
              base_branch: defaultBranch,
              status: eventType === "delete" ? "stale" : "active",
            },
          },
        ]
      : [];

  return { event, snapshots };
}
