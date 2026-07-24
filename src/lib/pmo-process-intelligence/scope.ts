// ============================================================================
// PMO Process Intelligence — tenant scoping (CAP-047 · M2, defense in depth)
// ============================================================================
// RLS on the underlying tables is the primary barrier; this helper is the
// mandatory second barrier: every read-model adapter passes its rows through
// scopeToOrganization before anything reaches a contract shape, so a
// cross-tenant row can never survive even if a query is written wrong.
// (Same pattern as scopeLivingGraphDataToProject — CAP-045 §C.2.)
// ============================================================================

export interface OrgScoped {
  organizationId: string;
}

/** Drops every row that does not belong to the requested organization. */
export function scopeToOrganization<T extends OrgScoped>(
  rows: readonly T[],
  organizationId: string,
): T[] {
  return rows.filter((r) => r.organizationId === organizationId);
}

/** Same guarantee for project-scoped rows inside an allowed project set. */
export function scopeToProjects<T extends { projectId: string }>(
  rows: readonly T[],
  allowedProjectIds: readonly string[],
): T[] {
  if (allowedProjectIds.length === 0) return [...rows];
  const allowed = new Set(allowedProjectIds);
  return rows.filter((r) => allowed.has(r.projectId));
}
