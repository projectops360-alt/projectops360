// ============================================================================
// ProjectOps360° — Product Intelligence Center access control (single source)
// ============================================================================
// Pure role gate, importable from both server (page) and the layout that gates
// the sidebar item. On `master` the role model is owner | admin | member |
// viewer (see lib/auth/org-context). Product Intelligence is internal strategy:
// only owners/admins may read it. (When the richer PMO/PM RBAC lands — see
// Product Intelligence DEBT-002 — extend this in ONE place.)
// ============================================================================

export const PRODUCT_INTELLIGENCE_ALLOWED_ROLES = ["owner", "admin"] as const;

/**
 * @deprecated Role is NOT sufficient for the Product Brain Control Center.
 * Access is now a strict EMAIL allowlist (see access.server.ts / TASK 10A).
 * Kept only for any legacy caller; new gates must use the email allowlist.
 */
export function canViewProductIntelligence(
  role: string | null | undefined,
): boolean {
  return role === "owner" || role === "admin";
}

// ── Pure email-allowlist matching (client-safe; NO emails embedded here) ─────
// The actual allowlist lives in access.server.ts (server-only) so the addresses
// never reach the client bundle. These helpers are pure and unit-tested.

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * True iff `email` is present in `allowlist` (case-insensitive, trimmed). Empty
 * / missing emails are always denied. An empty allowlist denies everyone.
 */
export function emailInAllowlist(
  email: string | null | undefined,
  allowlist: readonly string[],
): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  return allowlist.some((a) => normalizeEmail(a) === e);
}

/**
 * Resolve the effective allowlist from a comma-separated env value, falling back
 * to `defaults` when env is empty/unset. Normalized + de-duped. Pure (the env
 * value is passed in by the server wrapper) so it is unit-testable.
 */
export function resolveAllowlist(
  envValue: string | null | undefined,
  defaults: readonly string[],
): string[] {
  const fromEnv = (envValue ?? "")
    .split(",")
    .map((s) => normalizeEmail(s))
    .filter(Boolean);
  const source = fromEnv.length > 0 ? fromEnv : defaults;
  return Array.from(new Set(source.map((s) => normalizeEmail(s))));
}
