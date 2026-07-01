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
import { mergeDirectory } from "./directory";
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
