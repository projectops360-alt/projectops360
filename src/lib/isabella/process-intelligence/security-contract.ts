// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · RBAC / security contract
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// The access rules every retrieval/engine in Phase 5 MUST honor. Deny-by-default:
// org+project scope comes from the TRUSTED SESSION, never client-claimed ids;
// unclear scope asks for context; unauthorized denies WITHOUT revealing whether
// the entity exists. Pure declaration + a deterministic access resolver.
// ============================================================================

export interface IsabellaSecurityRule {
  id: string;
  rule: string;
}

export const ISABELLA_SECURITY_RULES = [
  { id: "server_side_authorization", rule: "All project-data retrieval is authorized server-side from the trusted session; client-side filtering is never sufficient." },
  { id: "org_project_scope", rule: "Every read is scoped to the caller's organization and the current project; the client projectId is only a lookup key." },
  { id: "no_cross_tenant_leak", rule: "Cross-project and cross-org tasks/subtasks/team members/evidence must never leak." },
  { id: "no_existence_disclosure", rule: "Denials must not reveal whether an unauthorized entity exists (deny == not-found from the caller's view)." },
  { id: "pre_sanitized_evidence", rule: "Evidence packets are pre-sanitized: no raw payloads, no secrets, no unscoped fields." },
  { id: "no_raw_event_log", rule: "Raw project_event_log rows are never exposed to UI/LLM — only approved event summaries/projections." },
  { id: "no_raw_realtime_payload", rule: "Raw Supabase realtime payloads are never exposed; only stale/fresh/degraded state." },
  { id: "ask_when_unclear", rule: "When scope/authorization is unclear or no project is selected, ask for context rather than guessing." },
  { id: "read_only", rule: "Isabella intelligence is read-only: it never mutates canonical truth, project_event_log, process_nodes, or process_edges." },
] as const satisfies readonly IsabellaSecurityRule[];

/** The minimal authorization context a retrieval must resolve from the session. */
export interface IsabellaAccessRequest {
  /** Resolved from the trusted session (getOrgContext), never the client. */
  sessionOrganizationId: string | null;
  /** The project the caller is currently scoped to (from the trusted session/route re-validation). */
  authorizedProjectId: string | null;
  /** The project the request is about (client-supplied lookup key). */
  requestedProjectId: string | null;
  /** The org that owns the requested project, as resolved server-side. */
  requestedProjectOrganizationId: string | null;
}

export type IsabellaAccessDecision = "authorized" | "denied" | "needs_context";

/**
 * Deny-by-default access resolver. `needs_context` when there is no project to
 * work with; `denied` on any org/project mismatch (never disclosing existence);
 * `authorized` only when the requested project belongs to the session org and
 * matches the caller's authorized project scope.
 */
export function resolveIsabellaAccess(req: IsabellaAccessRequest): IsabellaAccessDecision {
  if (!req.sessionOrganizationId) return "denied";
  if (!req.requestedProjectId && !req.authorizedProjectId) return "needs_context";
  if (!req.requestedProjectId) return "needs_context";
  // The requested project must be resolvable within the session org…
  if (req.requestedProjectOrganizationId == null) return "denied";
  if (req.requestedProjectOrganizationId !== req.sessionOrganizationId) return "denied";
  // …and must match the caller's authorized project scope when one is set.
  if (req.authorizedProjectId && req.authorizedProjectId !== req.requestedProjectId) return "denied";
  return "authorized";
}
