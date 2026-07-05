// ============================================================================
// ProjectOps360° — GitHub App installation callback (Mode A)
// GET /api/integrations/github/install/callback?installation_id=&setup_action=&state=
// ============================================================================
// GitHub redirects here after the user installs the App. Validates the one-time
// state, records the installation, then sends the user to the repo picker.
// Feature-flag gated. Never trusts callback params without validating state,
// org/project ownership, and expiry.
// ============================================================================

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGitHubIntelligenceFlagEnabled } from "@/lib/env";
import { getInstallationAccount } from "@/lib/github-intelligence/auth";
import { hasEnvAppConfig } from "@/lib/github-intelligence/config";
import { isActiveSoftwareProject } from "@/lib/github-intelligence/software-project-guard";
import { logAudit } from "@/lib/audit";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/en/projects?github_error=${error}`, request.url));
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isGitHubIntelligenceFlagEnabled()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = new URL(request.url);
  const installationIdRaw = url.searchParams.get("installation_id");
  const state = url.searchParams.get("state");
  if (!state || !installationIdRaw || !/^\d+$/.test(installationIdRaw)) {
    return back(request, "missing_params");
  }
  const installationId = Number(installationIdRaw);

  const admin = createAdminClient();

  // Validate the one-time state (must be unconsumed, unexpired, app_installation).
  const { data: st } = await admin
    .from("github_connection_states")
    .select("id, organization_id, project_id, user_id, flow_type, return_path, expires_at, consumed_at")
    .eq("state", state)
    .maybeSingle<{
      id: string; organization_id: string; project_id: string | null; user_id: string;
      flow_type: string; return_path: string | null; expires_at: string; consumed_at: string | null;
    }>();

  if (
    !st || st.consumed_at || new Date(st.expires_at) < new Date() ||
    st.flow_type !== "app_installation" || !st.project_id
  ) {
    return back(request, "invalid_state");
  }

  // The project must still be an active software project.
  if (!(await isActiveSoftwareProject(admin, st.project_id))) {
    await admin.from("github_connection_states").update({ consumed_at: new Date().toISOString() }).eq("id", st.id);
    return back(request, "not_available");
  }

  // Consume the state (single use).
  await admin.from("github_connection_states").update({ consumed_at: new Date().toISOString() }).eq("id", st.id);

  // Look up which account was connected (best-effort; needs env App config).
  let accountLogin: string | null = null;
  let accountType: string | null = null;
  if (hasEnvAppConfig()) {
    try {
      const acc = await getInstallationAccount(installationId);
      accountLogin = acc.accountLogin;
      accountType = acc.accountType;
    } catch (err) {
      console.error("[github-install] account lookup failed:", (err as Error)?.message);
    }
  }

  // Deactivate any prior installation for this project, then record the new one.
  await admin
    .from("github_installations")
    .update({ is_active: false, disconnected_at: new Date().toISOString() })
    .eq("project_id", st.project_id)
    .eq("is_active", true);

  await admin.from("github_installations").insert({
    organization_id: st.organization_id,
    project_id: st.project_id,
    installation_id: installationId,
    account_login: accountLogin,
    account_type: accountType,
    connected_by_user_id: st.user_id,
    is_active: true,
  });

  await logAudit({
    org: { organizationId: st.organization_id, userId: st.user_id },
    projectId: st.project_id,
    action: "create",
    entityType: "github_installation:connected",
    entityId: String(installationId),
    metadata: { accountLogin },
  });

  // Send the user to the repo picker (settings integration page).
  const dest = new URL(
    `/en/projects/${st.project_id}/settings/integrations/github`,
    request.url,
  );
  dest.searchParams.set("installation_id", String(installationId));
  return NextResponse.redirect(dest);
}
