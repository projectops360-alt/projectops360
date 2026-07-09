import "server-only";

// ============================================================================
// ProjectOps360° — Admin Console observability (SERVER-ONLY)
// ============================================================================
// Lightweight structured logging for Admin Console access & data events. The
// existing audit_logs table is org-scoped (organization_id NOT NULL) and its
// `action` column is CHECK-constrained to task/project lifecycle values — it
// cannot host platform-wide events like admin_page_viewed without polluting
// an org's audit trail and widening the CHECK constraint (out of scope here).
//
// Until a dedicated platform_audit_logs table lands, we emit structured
// server logs only. Never throws; never logs sensitive payload bodies.
// TODO: persist these events to a future public.platform_audit_logs table.
// ============================================================================

export type AdminEvent =
  | "admin_page_viewed"
  | "admin_access_denied"
  | "admin_metrics_loaded"
  | "admin_tasks_loaded";

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