// ============================================================================
// ProjectOps360° — Backfill Runner access control (RBAC)
// ============================================================================
// Only authorized administrators may execute the Historical Backfill. Backfill
// permanently enriches organizational memory (the Project Event Graph), so it is
// gated to org owners/admins or a platform-admin email allowlist. PMO / PM /
// member / viewer roles must NOT execute it unless explicitly allowlisted.
// Pure + deterministic (env-driven). See historical-backfill-service.md.
// ============================================================================

export interface BackfillActor {
  role: "owner" | "admin" | "member" | "viewer";
  email: string;
}

function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.BACKFILL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when the actor may run the Backfill Runner. */
export function canRunBackfill(actor: BackfillActor): boolean {
  if (actor.role === "owner" || actor.role === "admin") return true;
  return platformAdminEmails().has(actor.email.trim().toLowerCase());
}

/** Human-readable denial reason (for logs / UI). */
export function backfillDenialReason(actor: BackfillActor): string {
  return `Backfill requires an organization owner/admin or a platform-admin allowlisted account (role=${actor.role}).`;
}
