import "server-only";

// ============================================================================
// ProjectOps360° — Admin Console observability (SERVER-ONLY)
// ============================================================================
// Two layers:
//  1. logAdminEvent — structured server logs for access & read events (the
//     audit_logs table is org-scoped, organization_id NOT NULL, so page-view
//     style platform events stay in logs only).
//  2. recordAdminAudit — PERSISTED rows in public.audit_logs for privilege
//     changes and admin writes (admin_granted / admin_revoked /
//     organization_renamed — CHECK widened by migration 20260841). These are
//     org-scoped: renames attach to the renamed org, grants/revokes to the
//     target user's org (falling back to the actor's org).
// Never throws; never logs sensitive payload bodies.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

export type AdminEvent =
  | "admin_page_viewed"
  | "admin_access_denied"
  | "admin_metrics_loaded"
  | "admin_tasks_loaded"
  | "admin_granted"
  | "admin_revoked"
  | "organization_renamed";

export interface AdminEventContext {
  event: AdminEvent;
  email: string | null;
  userId?: string | null;
  route?: string | null;
  result?: "ok" | "denied" | "error";
  /** Free-form non-sensitive context (counts, page numbers). No PII bodies. */
  extra?: Record<string, unknown>;
}

/**
 * Emit a structured Admin Console event to the server log. Non-throwing.
 * Keep `extra` free of sensitive payloads — counts and identifiers only.
 */
export function logAdminEvent(ctx: AdminEventContext): void {
  try {
    // Single-line JSON so log aggregators can parse it as one record.
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: "info",
        source: "admin-console",
        event: ctx.event,
        email: ctx.email ?? null,
        userId: ctx.userId ?? null,
        route: ctx.route ?? null,
        result: ctx.result ?? "ok",
        ts: new Date().toISOString(),
        ...ctx.extra,
      }),
    );
  } catch {
    // Logging must never break the admin operation.
  }
}

/** Persisted admin audit actions (audit_logs.action CHECK, migration 20260841). */
export type AdminAuditAction =
  | "admin_granted"
  | "admin_revoked"
  | "organization_renamed";

/**
 * Persist a platform-admin write to public.audit_logs (service role). The
 * table is org-scoped, so callers must supply the most meaningful org id
 * (renamed org / target user's org / actor's org). Non-throwing: an audit
 * insert failure is logged but never blocks the admin operation itself.
 */
export async function recordAdminAudit(entry: {
  action: AdminAuditAction;
  organizationId: string;
  actorUserId: string;
  entityType: "organization" | "admin_authorization";
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      organization_id: entry.organizationId,
      actor_user_id: entry.actorUserId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      logAdminEvent({
        event: entry.action,
        email: null,
        result: "error",
        extra: { auditPersistError: error.message },
      });
    }
  } catch {
    // Audit persistence must never break the admin operation.
  }
}