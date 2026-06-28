// ============================================================================
// ProjectOps360° — Project Export — RBAC (pure, client + server safe)
// ============================================================================
// Export is sensitive. Full Archive carries evidence/transcripts/memory, so it
// is restricted to PMO/Admin/Owner by default. Starter Blueprint is privacy-safe
// (history reset) and is available to PMs as well. Viewers can never export.
// The route handler enforces these server-side; the modal mirrors them for UX.
// ============================================================================

export type OrgRole = "owner" | "admin" | "member" | "viewer";

/** Full Project Archive — evidence-bearing → PMO/Admin/Owner only. */
export function canExportFullArchive(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

/** Starter Blueprint — privacy-safe template → owner/admin/member (PM). Not viewers. */
export function canExportBlueprint(role: OrgRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/** Whether the role may export in the requested mode. */
export function canExport(role: OrgRole, mode: "full_archive" | "starter_blueprint"): boolean {
  return mode === "full_archive" ? canExportFullArchive(role) : canExportBlueprint(role);
}

/**
 * Sensitive Full-Archive options that require an evidence-authorized role.
 * Even if a less-privileged path reached here, these are stripped server-side.
 */
export function canIncludeSensitiveEvidence(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}
