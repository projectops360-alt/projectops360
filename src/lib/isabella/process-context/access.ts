// ============================================================================
// ProjectOps360° — Isabella Process Context · access resolution (server-only)
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// Deny-by-default access for a project (Task 1 security contract). Org + user
// come from the TRUSTED SESSION (getOrgContext); the client projectId is only a
// lookup key. The project is gated by org (never a cross-org read), so a denial
// does not disclose whether the project exists. Never throws.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { ISABELLA_SECURITY_RULES } from "@/lib/isabella/process-intelligence/security-contract";
import type { IsabellaAccessResult, IsabellaProjectScope } from "./types";

// Reference the contract so the dependency is explicit (and tree-shake-safe).
void ISABELLA_SECURITY_RULES;

export interface ResolveAccessInput {
  projectId?: string | null;
  locale?: string;
}

function msg(status: IsabellaAccessResult["status"], es: boolean): string {
  switch (status) {
    case "missing_context":
      return es ? "Necesito que abras o selecciones un proyecto." : "I need you to open or select a project.";
    case "unauthorized":
      return es ? "No tienes permiso para ver este proyecto." : "You do not have permission to view this project.";
    case "unavailable":
      return es ? "No pude verificar el acceso en este momento." : "I couldn't verify access right now.";
    default:
      return "";
  }
}

/**
 * Resolve authorized project scope for Isabella. Returns `missing_context` with
 * no project, `unauthorized` for a project outside the caller's org (no
 * existence disclosure), `unavailable` on a read error, else `authorized` with
 * the trusted scope.
 */
export async function resolveIsabellaProjectAccess(input: ResolveAccessInput): Promise<IsabellaAccessResult> {
  const es = input.locale === "es";

  if (!input.projectId) return { status: "missing_context", message: msg("missing_context", es) };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized", message: msg("unauthorized", es) };
  }

  const supabase = createAdminClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { status: "unavailable", message: msg("unavailable", es) };
  if (!project) return { status: "unauthorized", message: msg("unauthorized", es) };

  const scope: IsabellaProjectScope = {
    projectId: input.projectId,
    organizationId: org.organizationId,
    userId: org.userId,
    locale: es ? "es" : "en",
  };
  return { status: "authorized", scope };
}
