"use server";

import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/admin-console/access.server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRESETS = {
  team_member: {
    role: "member",
    org_role: "TEAM_MEMBER",
    workspace_role: "Team Member",
    billing_seat_type: "contributor_seat",
  },
  project_manager: {
    role: "member",
    org_role: "PROJECT_MANAGER",
    workspace_role: "Project Manager",
    billing_seat_type: "full_seat",
  },
  admin: {
    role: "admin",
    org_role: "TEAM_MEMBER",
    workspace_role: null,
    billing_seat_type: "admin",
  },
} as const;

export async function repairUserOrganizationAction(formData: FormData) {
  const ctx = await getOrgContext().catch(() => null);
  const locale = String(formData.get("locale") || "en");
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin/user-integrity"))) {
    redirect(`/${locale}/admin/user-integrity?error=not_authorized`);
  }

  const userId = String(formData.get("userId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const organizationId = String(formData.get("organizationId") || "").trim();
  const presetKey = String(formData.get("preset") || "team_member") as keyof typeof PRESETS;
  const preset = PRESETS[presetKey] ?? PRESETS.team_member;

  if (!userId || !organizationId || !email) {
    redirect(`/${locale}/admin/user-integrity?q=${encodeURIComponent(email)}&error=missing_fields`);
  }

  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    redirect(`/${locale}/admin/user-integrity?q=${encodeURIComponent(email)}&error=membership_lookup`);
  }

  const memberPayload = {
    role: preset.role,
    org_role: preset.org_role,
    workspace_role: preset.workspace_role,
    billing_seat_type: preset.billing_seat_type,
    status: "active",
    joined_at: new Date().toISOString(),
  };

  const membershipResult = existing
    ? await admin.from("organization_members").update(memberPayload).eq("id", existing.id)
    : await admin.from("organization_members").insert({
        organization_id: organizationId,
        user_id: userId,
        ...memberPayload,
      });

  if (membershipResult.error) {
    redirect(`/${locale}/admin/user-integrity?q=${encodeURIComponent(email)}&error=membership_write`);
  }

  // profiles.organization_id is intentionally protected by a DB trigger. The
  // supported repair is to set default_organization_id so getOrgContext picks
  // the repaired active membership on the next login/request.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ default_organization_id: organizationId, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) {
    redirect(`/${locale}/admin/user-integrity?q=${encodeURIComponent(email)}&error=default_org_write`);
  }

  console.info("[admin-user-integrity] repaired", {
    actor: ctx.email,
    targetEmail: email,
    organizationId,
    preset: presetKey,
  });

  redirect(`/${locale}/admin/user-integrity?q=${encodeURIComponent(email)}&fixed=1`);
}
