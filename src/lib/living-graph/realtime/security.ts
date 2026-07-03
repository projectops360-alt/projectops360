// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Security (Phase 4, Task 1)
// ============================================================================
// Deny-by-default authorization for realtime graph access. Pure functions —
// the caller resolves the access context (session, org membership, project
// authorization) server-side and passes it in; RLS on the underlying tables
// remains the outer wall. A subscription or delta is NEVER attached/served
// without an allow decision here first (mirrors src/lib/milestone-flow/security.ts).
// ============================================================================

import { LGRE_ACCESS_SCOPE_SET } from "./constants";
import type {
  LivingGraphRealtimeAccessContext,
  LivingGraphRealtimeAccessDecision,
  LivingGraphRealtimeScope,
} from "./types";

function deny(reason: string): LivingGraphRealtimeAccessDecision {
  return { allowed: false, reason };
}

function allow(reason: string): LivingGraphRealtimeAccessDecision {
  return { allowed: true, reason };
}

/**
 * Authorize realtime access to a scope. Rules:
 * - Absolute tenant isolation: organization mismatch is always denied.
 * - Unknown/unregistered access scopes are denied (deny-by-default).
 * - Project-level realtime requires the project in `authorizedProjectIds`
 *   (team/pm/pmo/admin). Viewers/clients have no realtime access (doc 12 §8).
 * - Org/portfolio-level (no projectId) is the FUTURE PMO/Portfolio extension:
 *   reserved to pmo/admin; team/pm callers are denied aggregates.
 */
export function resolveLivingGraphRealtimeAccess(
  access: LivingGraphRealtimeAccessContext,
  scope: LivingGraphRealtimeScope,
): LivingGraphRealtimeAccessDecision {
  if (!scope.organizationId) return deny("missing_organization_scope");
  if (access.organizationId !== scope.organizationId) return deny("cross_organization_denied");
  if (!LGRE_ACCESS_SCOPE_SET.has(access.scope)) return deny("unregistered_access_scope");

  if (scope.projectId) {
    if (!access.authorizedProjectIds.includes(scope.projectId)) {
      return deny("project_not_authorized");
    }
    return allow("project_scope_authorized");
  }

  // Aggregate (org/portfolio) scope — PMO/Portfolio extension path only.
  if (access.scope === "pmo" || access.scope === "admin") {
    return allow("aggregate_scope_authorized");
  }
  return deny("aggregate_scope_requires_pmo_or_admin");
}

/** Strip any project not in the caller's authorized set from an aggregate (no leakage). */
export function filterAuthorizedProjectIds(
  access: LivingGraphRealtimeAccessContext,
  projectIds: readonly string[],
): string[] {
  const authorized = new Set(access.authorizedProjectIds);
  return projectIds.filter((id) => authorized.has(id));
}
