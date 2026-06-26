// ============================================================================
// ProjectOps360° — Server-action authorization guards (server-only)
// ============================================================================
// Ergonomic guards for server actions. Every project-scoped mutation must call
// one of these BEFORE touching the admin client, because the admin client
// bypasses RLS — these functions are the application-layer enforcement that
// mirrors (and, for role/field rules, exceeds) the database RLS policies.
//
//   requireProjectManager  → PMO / PM / creator / can_manage_team.
//                            Use for governance, charter, approvals, budget,
//                            stakeholders, structural/planning changes.
//   requireProjectContributor → manager tier OR active project team member.
//                            Use for collaborative content (decisions, docs,
//                            communications, meetings, memory, links).
//   requireProjectAccess   → anyone who can view the project (incl. stakeholder).
//                            Use for read-ish actions (summaries, search).
//
// All return a discriminated union so callers can do:
//   const gate = await requireProjectManager(projectId);
//   if (!gate.ok) return { error: gate.error };
//   const { org } = gate;
// ============================================================================

import { getOrgContext, type OrgContext } from "./org-context";
import { getProjectAccess, isProjectManagerTier, canViewProject } from "./permissions";

export type AuthzError = "not_authenticated" | "forbidden";
export type AuthzResult =
  | { ok: true; org: OrgContext }
  | { ok: false; error: AuthzError };

async function authedOrg(): Promise<OrgContext | null> {
  try {
    return await getOrgContext();
  } catch {
    return null;
  }
}

/** Manager tier (PMO / PM / creator / can_manage_team) on the project. */
export async function requireProjectManager(projectId: string): Promise<AuthzResult> {
  const org = await authedOrg();
  if (!org) return { ok: false, error: "not_authenticated" };
  const access = await getProjectAccess(org, projectId);
  if (!isProjectManagerTier(access)) return { ok: false, error: "forbidden" };
  return { ok: true, org };
}

/** Manager tier OR an active project team member (can contribute content). */
export async function requireProjectContributor(projectId: string): Promise<AuthzResult> {
  const org = await authedOrg();
  if (!org) return { ok: false, error: "not_authenticated" };
  const access = await getProjectAccess(org, projectId);
  if (!(isProjectManagerTier(access) || access.isMember)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, org };
}

/** Anyone who can view the project (member, manager, PMO or active stakeholder). */
export async function requireProjectAccess(projectId: string): Promise<AuthzResult> {
  const org = await authedOrg();
  if (!org) return { ok: false, error: "not_authenticated" };
  const access = await getProjectAccess(org, projectId);
  if (!canViewProject(access)) return { ok: false, error: "forbidden" };
  return { ok: true, org };
}
