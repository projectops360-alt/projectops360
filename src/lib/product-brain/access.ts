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

export function canViewProductIntelligence(
  role: string | null | undefined,
): boolean {
  return role === "owner" || role === "admin";
}
