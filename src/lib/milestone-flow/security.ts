// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Security (Phase 3, Task 1)
// ============================================================================
// Deny-by-default access resolution for the MPF Engine. Pure + deterministic
// (no DB): it decides whether a MilestoneFlowAccessContext may read a requested
// scope, and never widens beyond what the caller was granted. Real RBAC row
// resolution stays in the existing auth/RLS layer (src/lib/auth, project RLS);
// this module is the engine-side gate future tasks wire that data into.
//
// Cross-tenant isolation is absolute: an access context for org A can never be
// granted a scope in org B, regardless of scope level (Constitution §23).
// ============================================================================

import type {
  MilestoneFlowAccessContext,
  MilestoneFlowAccessDecision,
  MilestoneFlowScope,
  MilestoneFlowProjectScope,
} from "./types";

function isProjectScope(scope: MilestoneFlowScope): scope is MilestoneFlowProjectScope {
  return typeof (scope as MilestoneFlowProjectScope).projectId === "string";
}

/**
 * Resolve whether `ctx` may read `scope`. Deny-by-default: anything not
 * explicitly authorized is refused, and no scope is granted across organizations.
 */
export function resolveMilestoneFlowAccess(
  ctx: MilestoneFlowAccessContext,
  scope: MilestoneFlowScope,
): MilestoneFlowAccessDecision {
  // Absolute tenant isolation — same org id required, no exceptions.
  if (!ctx.organizationId || ctx.organizationId !== scope.organizationId) {
    return deny("Cross-organization access is not permitted.");
  }

  // Project-level request → the project must be in the caller's authorized set.
  if (isProjectScope(scope)) {
    const authorized = ctx.authorizedProjectIds.includes(scope.projectId);
    if (!authorized) {
      return deny(`Project ${scope.projectId} is not in the caller's authorized set.`);
    }
    // A PM sees only authorized projects; PMO/admin also satisfied by membership.
    return { allowed: true, reason: "", grantedScope: ctx.scope };
  }

  // Aggregate (org/portfolio/program) requests require PMO or admin scope.
  if (ctx.scope === "pm") {
    return deny("PM-level callers cannot request organization/portfolio/program aggregates.");
  }

  return { allowed: true, reason: "", grantedScope: ctx.scope };
}

/**
 * Whether the caller may inspect engine runs / observability (admin surface).
 * Admin scope alone is not enough — the explicit canInspectRuns flag must be set.
 */
export function canInspectMilestoneFlowRuns(ctx: MilestoneFlowAccessContext): boolean {
  return ctx.scope === "admin" && ctx.canInspectRuns === true;
}

/**
 * Filter a set of project ids down to only those the caller may read. Used to
 * prevent aggregate outputs (and evidence packets) from leaking unauthorized
 * projects into a PMO summary.
 */
export function filterAuthorizedProjectIds(
  ctx: MilestoneFlowAccessContext,
  projectIds: readonly string[],
): string[] {
  const allowed = new Set(ctx.authorizedProjectIds);
  return projectIds.filter((id) => allowed.has(id));
}

function deny(reason: string): MilestoneFlowAccessDecision {
  return { allowed: false, reason, grantedScope: null };
}
