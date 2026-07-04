// ============================================================================
// ProjectOps360° — Unified People Directory service (server-only, CAP-044)
// ============================================================================
// Reads the existing person source tables (org-scoped) and hands the PURE engine
// their rows to produce ONE de-duplicated directory. No new table, no data
// mutation — a projection over profiles/organization_members, external_contacts
// and stakeholders. Any assignment screen can reuse this to "select an existing
// person" instead of retyping. RBAC: org scope comes from the trusted session.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { mergeDirectory, mergeAssignableOwners, type AssignableOwner } from "./directory";
import type { PeopleDirectoryResult } from "./types";

/**
 * The unified People Directory for the caller's org (optionally narrowed to the
 * people relevant to a project). Never throws — returns a typed result.
 */
export async function getPeopleDirectory(projectId?: string): Promise<PeopleDirectoryResult> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, reason: "not_authorized" };
  }
  const supabase = createAdminClient();
  const orgId = org.organizationId;

  const [profilesRes, contactsRes, stakeholdersRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("organization_id", orgId),
    supabase
      .from("external_contacts")
      .select("id, name, email, company_name, contact_type")
      .eq("organization_id", orgId)
      .is("deleted_at", null),
    // Stakeholders: org-wide + (when given) this project's. Legacy table kept as a
    // source until it is consolidated into external_contacts (Phase 2).
    projectId
      ? supabase
          .from("stakeholders")
          .select("id, name, email, project_id")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .or(`project_id.is.null,project_id.eq.${projectId}`)
      : supabase
          .from("stakeholders")
          .select("id, name, email, project_id")
          .eq("organization_id", orgId)
          .is("deleted_at", null),
  ]);

  if (profilesRes.error && contactsRes.error && stakeholdersRes.error) {
    return { ok: false, reason: "unavailable" };
  }

  const people = mergeDirectory({
    internal: ((profilesRes.data ?? []) as Array<{ id: string; display_name: string | null }>).map((p) => ({
      id: p.id,
      display_name: p.display_name,
    })),
    external: (contactsRes.data ?? []) as Array<{
      id: string;
      name: string;
      email: string | null;
      company_name: string | null;
      contact_type: string | null;
    }>,
    stakeholders: ((stakeholdersRes.data ?? []) as Array<{ id: string; name: string; email: string | null }>).map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
    })),
  });

  return { ok: true, people };
}

/**
 * Assignable OWNERS for a project — the person-only list an owner dropdown needs
 * (SUBTASK-OWNER-ASSIGNMENT-PERSISTENCE). Same convention as the normal task
 * assignee source: org "Workspace users" (`profiles`) ∪ this project's team
 * members that resolve to a real user (`project_team_members.user_id`), all
 * ORG-scoped (never cross-org) and PROJECT-scoped for the team. RBAC/org come
 * from the trusted session. Never throws — returns a typed result. This is why
 * a project with no explicit team rows still offers assignable people (the
 * workspace users), instead of only "Unassigned".
 */
export async function getAssignableProjectOwners(
  projectId: string,
): Promise<
  | { ok: true; owners: AssignableOwner[] }
  | { ok: false; reason: "not_authorized" | "unavailable" }
> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, reason: "not_authorized" };
  }
  const supabase = createAdminClient();
  const orgId = org.organizationId;

  const [profilesRes, teamRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("organization_id", orgId),
    supabase
      .from("project_team_members")
      .select("user_id, display_name")
      .eq("project_id", projectId)
      .eq("organization_id", orgId)
      .neq("status", "removed"),
  ]);

  if (profilesRes.error && teamRes.error) return { ok: false, reason: "unavailable" };

  const owners = mergeAssignableOwners({
    profiles: (profilesRes.data ?? []) as Array<{ id: string; display_name: string | null }>,
    teamMembers: (teamRes.data ?? []) as Array<{ user_id: string | null; display_name: string | null }>,
  });
  return { ok: true, owners };
}
