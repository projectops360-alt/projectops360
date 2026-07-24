// ============================================================================
// PMO Process Intelligence Command Center — feature flag (CAP-047)
// ============================================================================
// Non-destructive coexistence contract: the current PMO Command Center
// dashboard remains the default view. This flag only decides whether the
// "Process Intelligence Beta" switcher and its lazily loaded module are
// offered to authorized users. Server-side only, default OFF — the value is
// read on the server and passed to clients as data, never via NEXT_PUBLIC.
// ============================================================================

/** Roles allowed to see the Process Intelligence Beta switcher. */
const AUTHORIZED_ROLES = new Set(["owner", "admin"]);

/** True only when the flag is explicitly enabled ("true"). Default OFF. */
export function isPmoProcessIntelligenceEnabled(): boolean {
  return process.env.pmo_process_intelligence_dashboard === "true";
}

/**
 * Whether the Current/Beta dashboard switcher should be rendered for this
 * user. Requires BOTH the flag and an authorized org role — viewers and
 * members never see the beta entry point.
 */
export function canAccessProcessIntelligence(role: string): boolean {
  return isPmoProcessIntelligenceEnabled() && AUTHORIZED_ROLES.has(role);
}
