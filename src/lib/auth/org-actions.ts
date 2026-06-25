"use server";

// ============================================================================
// ProjectOps360° — Organization switching (multi-org support)
// ============================================================================

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "./org-context";
import type { I18nField } from "@/types/database";

export interface UserOrg {
  id: string;
  name: I18nField;
  slug: string;
  orgRole: string | null;
}

/** All organizations the current user is an active member of. */
export async function getUserOrganizations(): Promise<UserOrg[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("organization_members")
    .select("org_role, organizations(id, slug, name_i18n)")
    .eq("user_id", user.id)
    .neq("status", "removed");

  return ((data ?? []) as unknown as Array<{ org_role?: string | null; organizations: { id: string; slug: string; name_i18n: I18nField } | null }>)
    .map((m) => {
      const o = m.organizations;
      return o ? { id: o.id, name: o.name_i18n, slug: o.slug, orgRole: m.org_role ?? null } : null;
    })
    .filter((o): o is UserOrg => o !== null);
}

/** Switch the active organization. Validates membership before setting the cookie. */
export async function setActiveOrgAction(orgId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .neq("status", "removed")
    .maybeSingle();

  if (!membership) return { error: "not_a_member" };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Also persist as the user's default org so it survives cookie loss.
  await supabase.from("profiles").update({ default_organization_id: orgId }).eq("id", user.id);

  return {};
}
