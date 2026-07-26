// ============================================================================
// PMO Portfolio Living Graph — feature flag (CAP-048)
// ============================================================================
// Additive coexistence contract: the PMO Command Center (Dashboard 1) and
// Process Intelligence (Dashboard 2) are untouched and remain reachable exactly
// as before. This flag only decides whether the third dashboard exists for a
// given user. Server-side only, default OFF — read on the server and passed to
// clients as data, never via NEXT_PUBLIC.
// ============================================================================

/** Roles allowed to reach the PMO Living Graph. Portfolio-wide by nature. */
const AUTHORIZED_ROLES = new Set(["owner", "admin"]);

/** True only when the flag is explicitly enabled ("true"). Default OFF. */
export function isPmoLivingGraphEnabled(): boolean {
  return (
    process.env.PMO_LIVING_GRAPH_ENABLED === "true" ||
    process.env.pmo_living_graph_v1 === "true"
  );
}

/**
 * Whether this user may reach the dashboard at all. Requires BOTH the flag and
 * an authorized org role — members and viewers never see it, and the route
 * itself 404s rather than rendering an empty shell.
 */
export function canAccessPmoLivingGraph(role: string): boolean {
  return isPmoLivingGraphEnabled() && AUTHORIZED_ROLES.has(role);
}
