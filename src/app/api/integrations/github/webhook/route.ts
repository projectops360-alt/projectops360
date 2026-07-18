// ============================================================================
// ProjectOps360° — GitHub Intelligence webhook endpoint
// POST /api/integrations/github/webhook
// ============================================================================
// Verifies the GitHub HMAC signature, then routes the event to a connected
// SOFTWARE project (idempotently). Fully gated by GITHUB_INTELLIGENCE_ENABLED:
// when OFF the endpoint ignores everything (no processing). Never leaks secrets.
// ============================================================================

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGitHubIntelligenceFlagEnabled } from "@/lib/env";
import { getWebhookSecret } from "@/lib/github-intelligence/config";
import { verifyWebhookSignature, parseWebhookEnvelope } from "@/lib/github-intelligence/webhooks";
import { ingestWebhookEvent, type ConnectedRepository, type IngestionStore } from "@/lib/github-intelligence/ingestion";
import { logAudit } from "@/lib/audit";
import { readLimitedText, RequestBodyError } from "@/lib/http/request-body";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  // Feature flag — when OFF the module is dark; accept-and-ignore so GitHub
  // does not keep retrying, but never process.
  if (!isGitHubIntelligenceFlagEnabled()) {
    return NextResponse.json({ ignored: "feature_disabled" }, { status: 202 });
  }

  const secret = getWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "webhook_not_configured", detail: "GitHub App webhook secret is not configured." },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  let rawBody: string;
  try {
    rawBody = await readLimitedText(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    // Do not reveal whether the signature was missing vs mismatched.
    console.warn("[github-webhook] signature verification failed");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseWebhookEnvelope(
    { event: request.headers.get("x-github-event"), deliveryId: request.headers.get("x-github-delivery") },
    payload,
  );

  const admin = createAdminClient();
  const store = buildIngestionStore(admin);

  try {
    const outcome = await ingestWebhookEvent(store, parsed);

    // Audit non-processed outcomes that matter (no secrets in metadata).
    if (!outcome.handled && parsed.repositoryGithubId != null) {
      if (outcome.reason === "non_software_project") {
        await safeAudit(admin, parsed, "webhook_ignored_non_software");
      } else if (outcome.reason === "duplicate") {
        await safeAudit(admin, parsed, "webhook_duplicate_ignored");
      }
    }

    return NextResponse.json({ handled: outcome.handled }, { status: outcome.handled ? 200 : 202 });
  } catch (err) {
    console.error("[github-webhook] ingestion error:", (err as Error)?.message);
    return NextResponse.json({ error: "ingestion_failed" }, { status: 500 });
  }
}

// ── Supabase-backed ingestion store ──────────────────────────────────────────

function buildIngestionStore(admin: ReturnType<typeof createAdminClient>): IngestionStore {
  return {
    async findRepository(githubRepositoryId: number): Promise<ConnectedRepository | null> {
      const { data: repo } = await admin
        .from("github_repositories")
        .select("id, organization_id, project_id, default_branch")
        .eq("github_repository_id", githubRepositoryId)
        .eq("is_active", true)
        .maybeSingle<{ id: string; organization_id: string; project_id: string; default_branch: string }>();
      if (!repo) return null;

      const { data: project } = await admin
        .from("projects")
        .select("project_type, deleted_at")
        .eq("id", repo.project_id)
        .maybeSingle<{ project_type: string | null; deleted_at: string | null }>();

      return {
        id: repo.id,
        organization_id: repo.organization_id,
        project_id: repo.project_id,
        default_branch: repo.default_branch ?? "main",
        project_type: project?.project_type ?? null,
        project_deleted: Boolean(project?.deleted_at),
      };
    },
    async deliveryExists(repositoryId: string, deliveryId: string): Promise<boolean> {
      const { data } = await admin
        .from("github_activity_events")
        .select("id")
        .eq("repository_id", repositoryId)
        .eq("github_delivery_id", deliveryId)
        .maybeSingle();
      return Boolean(data);
    },
    async insertEvent(row: Record<string, unknown>): Promise<void> {
      // Ignore unique-violation races (idempotency backstop at the DB level).
      await admin.from("github_activity_events").upsert(row, { onConflict: "repository_id,github_delivery_id" });
    },
    async upsertSnapshot(table: string, row: Record<string, unknown>, conflict: string): Promise<void> {
      await admin.from(table).upsert(row, { onConflict: conflict });
    },
    async markDelivery(repositoryId: string): Promise<void> {
      const { data } = await admin
        .from("github_repositories")
        .select("webhook_delivery_count")
        .eq("id", repositoryId)
        .maybeSingle<{ webhook_delivery_count: number }>();
      await admin
        .from("github_repositories")
        .update({
          last_webhook_delivery_at: new Date().toISOString(),
          webhook_delivery_count: (data?.webhook_delivery_count ?? 0) + 1,
        })
        .eq("id", repositoryId);
    },
  };
}

async function safeAudit(
  admin: ReturnType<typeof createAdminClient>,
  parsed: { repositoryGithubId: number | null; eventType: string },
  note: string,
): Promise<void> {
  // Resolve org/project for the audit row without leaking cross-tenant info.
  const { data: repo } = await admin
    .from("github_repositories")
    .select("organization_id, project_id")
    .eq("github_repository_id", parsed.repositoryGithubId ?? -1)
    .maybeSingle<{ organization_id: string; project_id: string }>();
  if (!repo) return;
  await logAudit({
    org: { organizationId: repo.organization_id, userId: "00000000-0000-0000-0000-000000000000" },
    projectId: repo.project_id,
    action: "update",
    entityType: `github_webhook:${note}`,
    entityId: String(parsed.repositoryGithubId ?? "unknown"),
    metadata: { eventType: parsed.eventType, note },
  });
}
