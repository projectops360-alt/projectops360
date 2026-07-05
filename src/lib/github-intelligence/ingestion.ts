// ============================================================================
// GitHub Intelligence — webhook ingestion service
// ============================================================================
// Maps a verified webhook to a connected SOFTWARE project, enforces
// idempotency (GitHub delivery id) and persists normalized evidence + snapshot
// upserts. Written against a small injected store interface so the core routing
// logic is unit-testable WITHOUT a live database or GitHub.
//
// Safety invariants enforced here:
//  • events for repositories not mapped to a project are ignored
//  • events for non-software / deleted projects are ignored (audit warning)
//  • duplicate deliveries are ignored (idempotent)
//  • never mutates canonical task/milestone/risk/decision data
// ============================================================================

import { normalizeEvent } from "./normalizers";
import { isSupportedEvent, type ParsedWebhook } from "./webhooks";
import { isSoftwareProjectType } from "./project-type";

export interface ConnectedRepository {
  id: string;
  organization_id: string;
  project_id: string;
  default_branch: string;
  project_type: string | null;
  project_deleted: boolean;
}

/** Minimal persistence surface the ingestion needs (injected → testable). */
export interface IngestionStore {
  /** Find an active connected repository by its GitHub numeric id. */
  findRepository(githubRepositoryId: number): Promise<ConnectedRepository | null>;
  /** True when an event with this delivery id already exists for the repo. */
  deliveryExists(repositoryId: string, deliveryId: string): Promise<boolean>;
  /** Insert a normalized activity event. */
  insertEvent(row: Record<string, unknown>): Promise<void>;
  /** Upsert a snapshot row (conflict target is provided). */
  upsertSnapshot(table: string, row: Record<string, unknown>, conflict: string): Promise<void>;
  /** Bump repository webhook observability counters. */
  markDelivery(repositoryId: string): Promise<void>;
}

export type IngestOutcome =
  | { handled: true; eventType: string }
  | { handled: false; reason: "unsupported_event" | "repo_not_connected" | "non_software_project" | "duplicate" | "missing_delivery_id" };

export async function ingestWebhookEvent(
  store: IngestionStore,
  parsed: ParsedWebhook,
): Promise<IngestOutcome> {
  if (!isSupportedEvent(parsed.eventType)) {
    return { handled: false, reason: "unsupported_event" };
  }
  if (!parsed.deliveryId) {
    return { handled: false, reason: "missing_delivery_id" };
  }
  if (parsed.repositoryGithubId == null) {
    return { handled: false, reason: "repo_not_connected" };
  }

  const repo = await store.findRepository(parsed.repositoryGithubId);
  if (!repo) {
    return { handled: false, reason: "repo_not_connected" };
  }

  // Hard product rule: only process events for ACTIVE software projects.
  if (repo.project_deleted || !isSoftwareProjectType(repo.project_type)) {
    return { handled: false, reason: "non_software_project" };
  }

  // Idempotency — a re-delivered event must not create duplicates.
  if (await store.deliveryExists(repo.id, parsed.deliveryId)) {
    return { handled: false, reason: "duplicate" };
  }

  const { event, snapshots } = normalizeEvent(
    parsed.eventType,
    parsed.action,
    parsed.payload,
    repo.default_branch || "main",
  );

  const scope = {
    organization_id: repo.organization_id,
    project_id: repo.project_id,
    repository_id: repo.id,
  };

  await store.insertEvent({
    ...scope,
    ...event,
    github_delivery_id: parsed.deliveryId,
  });

  for (const snap of snapshots) {
    await store.upsertSnapshot(snap.table, { ...scope, ...snap.row }, snap.conflict);
  }

  await store.markDelivery(repo.id);

  return { handled: true, eventType: parsed.eventType };
}
