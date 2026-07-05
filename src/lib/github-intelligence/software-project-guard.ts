// ============================================================================
// GitHub Intelligence — software-project availability guard (SERVER ONLY)
// ============================================================================
// Single source of truth for "is GitHub Intelligence available here?". Used by
// every route, server action, data loader and the Isabella context provider.
// Enforces BOTH conditions from the product spec:
//   (a) GITHUB_INTELLIGENCE_ENABLED = true
//   (b) project_type = 'software_development'  (canonical: src/types/execution.ts)
// plus tenancy (project belongs to org) and RBAC (viewer read / manager write).
//
// Never leaks whether a repository exists for another project or org.
// ============================================================================

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { isGitHubIntelligenceFlagEnabled } from "@/lib/env";
import type { ProjectType } from "@/types/execution";
// Canonical software-type predicate lives in a pure module so ingestion/tests
// can share it without importing `server-only`.
import { SOFTWARE_PROJECT_TYPE, isSoftwareProjectType } from "./project-type";

export { SOFTWARE_PROJECT_TYPE, isSoftwareProjectType };

export type GuardReason =
  | "feature_disabled"
  | "not_authenticated"
  | "project_not_found"
  | "not_software_project"
  | "forbidden";

export type GuardResult =
  | { ok: true; org: OrgContext; projectId: string; projectType: ProjectType; canManage: boolean }
  | { ok: false; reason: GuardReason };

interface AssertOptions {
  /** Require project owner/admin/manager (connect/disconnect/app config). */
  requireManage?: boolean;
}

/**
 * Assert GitHub Intelligence is available for `projectId` for the current user.
 * Returns a discriminated result (never throws for expected denials) so callers
 * can map cleanly to notFound()/403/unavailable states without leaking data.
 */
export async function assertGitHubIntelligenceAvailable(
  projectId: string,
  options: AssertOptions = {},
): Promise<GuardResult> {
  // (a) Feature flag — when OFF the module is fully dark.
  if (!isGitHubIntelligenceFlagEnabled()) {
    return { ok: false, reason: "feature_disabled" };
  }

  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, reason: "not_authenticated" };
  }

  const supabase = await createClient();
  // RLS + explicit org scope: a project from another org is simply not found.
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) {
    return { ok: false, reason: "project_not_found" };
  }

  // (b) Software-only. Non-software projects are unavailable, not forbidden —
  // the module simply does not exist for them.
  if (!isSoftwareProjectType(project.project_type)) {
    return { ok: false, reason: "not_software_project" };
  }

  // RBAC: viewers can read; connect/disconnect/config require manager+.
  const canManage = org.role === "owner" || org.role === "admin" || org.role === "member";
  if (options.requireManage && !canManage) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    org,
    projectId,
    projectType: project.project_type as ProjectType,
    canManage,
  };
}

/**
 * Webhook-path check (no user session): confirm a project is an active software
 * project using a privileged client. Used to ignore events mapped to
 * non-software or deleted projects safely.
 */
export async function isActiveSoftwareProject(
  adminClient: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  projectId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("projects")
    .select("project_type, deleted_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return false;
  if (data.deleted_at) return false;
  return isSoftwareProjectType(data.project_type);
}
