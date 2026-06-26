// ============================================================================
// ProjectOps360° — Centralized permission layer (server-only)
// ============================================================================
// Single source of truth for "can this user do X?". Mirrors the SQL helpers
// (is_pmo_level / can_access_project) so the application enforces the SAME
// boundaries the database does — necessary because most server actions use the
// service-role admin client, which bypasses RLS.
//
//   Organization level → derived from OrgContext.orgRole.
//   Project level      → getProjectAccess() combines PMO role, PM/creator,
//                        project_team_members (with its can_* flags) and
//                        stakeholder_access.
//
// Usage:
//   const access = await getProjectAccess(org, projectId);
//   if (!access.canView) return { error: "forbidden" };
//   if (canAssignTask(access)) { ... }
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "./org-context";

// ── Organization-level capabilities (pure, from OrgContext) ─────────────────

export function canManageOrganization(org: OrgContext): boolean {
  return org.orgRole === "COMPANY_OWNER" || org.orgRole === "PMO_ADMIN"
    || org.role === "owner" || org.role === "admin";
}

export function canInviteMembers(org: OrgContext): boolean {
  return canManageOrganization(org);
}

export function canManageBilling(org: OrgContext): boolean {
  return org.orgRole === "COMPANY_OWNER" || org.role === "owner";
}

/** PMO/portfolio roles see every project in the org. */
export function canViewAllProjects(org: OrgContext): boolean {
  return org.isPmoLevel;
}

/** Who may create new projects: PMO-level and Project Managers. */
export function canCreateProjects(org: OrgContext): boolean {
  return org.isPmoLevel || org.orgRole === "PROJECT_MANAGER";
}

/** Who may reach the PMO Center (portfolio governance). */
export function canAccessPmoCenter(org: OrgContext): boolean {
  return org.isPmoLevel;
}

/** Who lands in the PM Center (execution home). PMs, plus PMO can opt in. */
export function isPmCenterHome(org: OrgContext): boolean {
  return org.orgRole === "PROJECT_MANAGER";
}

// ── Project-level access ────────────────────────────────────────────────────

export interface ProjectAccess {
  projectId: string;
  /** May see the project at all. */
  canView: boolean;
  /** PMO/portfolio role (full org visibility). */
  isPmo: boolean;
  /** The project's PM or its creator. */
  isManager: boolean;
  /** Active project_team_members row. */
  isMember: boolean;
  /** Active stakeholder_access row. */
  isStakeholder: boolean;
  /** project_team_members.permission_level (null if not a team member). */
  permissionLevel: string | null;
  /** project_team_members can_* flags (all false if not a team member). */
  flags: Record<string, boolean>;
}

const FLAG_KEYS = [
  "can_approve_changes", "can_manage_tasks", "can_view_budget", "can_view_reports",
  "can_access_memory", "can_invite_others", "can_edit_charter", "can_manage_risks",
  "can_manage_changes", "can_manage_team",
] as const;

function emptyFlags(): Record<string, boolean> {
  return Object.fromEntries(FLAG_KEYS.map((k) => [k, false]));
}

/**
 * Resolve the current user's access to a single project. Uses the admin client
 * (service role) so it works regardless of RLS, then applies the same logic as
 * can_access_project() in SQL.
 */
export async function getProjectAccess(org: OrgContext, projectId: string): Promise<ProjectAccess> {
  const base: ProjectAccess = {
    projectId,
    canView: false,
    isPmo: org.isPmoLevel,
    isManager: false,
    isMember: false,
    isStakeholder: false,
    permissionLevel: null,
    flags: emptyFlags(),
  };

  const supabase = createAdminClient();

  // The project must exist and belong to the user's org.
  const { data: project } = await supabase
    .from("projects")
    .select("id, organization_id, project_manager_id, created_by")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) return base;

  // PMO-level → full access.
  if (org.isPmoLevel) {
    return { ...base, canView: true };
  }

  // PM or creator.
  if (project.project_manager_id === org.userId || project.created_by === org.userId) {
    base.isManager = true;
    base.canView = true;
  }

  // Active project team member (with its permission flags).
  const { data: member } = await supabase
    .from("project_team_members")
    .select("permission_level, " + FLAG_KEYS.join(", "))
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .eq("user_id", org.userId)
    .neq("status", "removed")
    .maybeSingle();

  if (member) {
    const m = member as unknown as Record<string, unknown>;
    base.isMember = true;
    base.canView = true;
    base.permissionLevel = (m.permission_level as string) ?? null;
    for (const k of FLAG_KEYS) base.flags[k] = !!m[k];
  }

  // Active stakeholder access (read/limited).
  const { data: sh } = await supabase
    .from("stakeholder_access")
    .select("id")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .eq("user_id", org.userId)
    .eq("status", "active")
    .maybeSingle();

  if (sh) {
    base.isStakeholder = true;
    base.canView = true;
  }

  return base;
}

// ── Project-level capabilities (from a resolved ProjectAccess) ──────────────

export const canViewProject = (a: ProjectAccess): boolean => !!a.canView;

export const canEditProject = (a: ProjectAccess): boolean =>
  !!(a.isPmo || a.isManager || a.flags.can_edit_charter);

export const canManageProjectMembers = (a: ProjectAccess): boolean =>
  !!(a.isPmo || a.isManager || a.flags.can_manage_team || a.flags.can_invite_others);

export const canAssignTask = (a: ProjectAccess): boolean =>
  !!(a.isPmo || a.isManager || a.flags.can_manage_tasks);

export const canManageRisks = (a: ProjectAccess): boolean =>
  !!(a.isPmo || a.isManager || a.flags.can_manage_risks);

export const canViewProjectMemory = (a: ProjectAccess): boolean =>
  !!(a.isPmo || a.isManager || a.flags.can_access_memory);

export const canViewReports = (a: ProjectAccess): boolean =>
  !!(a.isPmo || a.isManager || a.isMember || a.flags.can_view_reports);

// ── Project tab access (PM/PMO full; contributors = execution-only) ─────────

export type ProjectTab =
  | "overview" | "charter" | "delivery" | "team" | "workboard" | "execution-map"
  | "resource-capacity" | "labor-capacity" | "drawing-intelligence" | "memory"
  | "rhythm" | "status" | "settings" | "decisions" | "communications"
  | "documents" | "meetings" | "closeout";

/** Manager tier sees/edits the whole project. */
export function isProjectManagerTier(a: ProjectAccess): boolean {
  return a.isPmo || a.isManager || a.flags.can_manage_team || a.flags.can_invite_others;
}

/**
 * What a given access level may open inside a project.
 *  - Manager (PMO/PM/creator) → everything.
 *  - Contributor (team member) → execution only: Workboard + Status, plus
 *    Project Memory when they have memory access.
 *  - Stakeholder/viewer → read-only Status.
 */
export function canAccessProjectTab(a: ProjectAccess, tab: ProjectTab): boolean {
  if (isProjectManagerTier(a)) return true;
  if (a.isMember) {
    if (tab === "workboard" || tab === "status") return true;
    if (tab === "memory") return !!a.flags.can_access_memory;
    return false;
  }
  if (a.isStakeholder) return tab === "status";
  return false;
}

// ── Accessible project IDs (for list/dashboard scoping) ─────────────────────

/**
 * The set of project IDs the user may see in the active org.
 *   • PMO-level → null  (means "all projects" — callers skip the filter).
 *   • Otherwise → the union of projects they manage, created, are a member of,
 *     or have stakeholder access to.
 */
export async function getAccessibleProjectIds(org: OrgContext): Promise<string[] | null> {
  if (org.isPmoLevel) return null;

  const supabase = createAdminClient();
  const ids = new Set<string>();

  const [managed, created, memberOf, stakeholderOf] = await Promise.all([
    supabase.from("projects").select("id").eq("organization_id", org.organizationId)
      .eq("project_manager_id", org.userId).is("deleted_at", null),
    supabase.from("projects").select("id").eq("organization_id", org.organizationId)
      .eq("created_by", org.userId).is("deleted_at", null),
    supabase.from("project_team_members").select("project_id").eq("organization_id", org.organizationId)
      .eq("user_id", org.userId).neq("status", "removed"),
    supabase.from("stakeholder_access").select("project_id").eq("organization_id", org.organizationId)
      .eq("user_id", org.userId).eq("status", "active"),
  ]);

  for (const r of managed.data ?? []) ids.add((r as { id: string }).id);
  for (const r of created.data ?? []) ids.add((r as { id: string }).id);
  for (const r of memberOf.data ?? []) {
    const pid = (r as { project_id: string | null }).project_id;
    if (pid) ids.add(pid);
  }
  for (const r of stakeholderOf.data ?? []) {
    const pid = (r as { project_id: string | null }).project_id;
    if (pid) ids.add(pid);
  }

  return [...ids];
}
