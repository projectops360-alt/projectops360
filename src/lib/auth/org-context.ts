import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { I18nField } from "@/types/database";

// ---------------------------------------------------------------------------
// OrgContext — the full authenticated + organizational context for a request
// ---------------------------------------------------------------------------
// Fetches auth user → profile → active memberships → selected organization.
//
// Resilience: a brand-new user with neither profile nor membership can be
// auto-healed. An existing user without an active membership is denied.
// ---------------------------------------------------------------------------

export interface OrgContext {
  /** auth.users.id */
  userId: string;
  /** auth.users.email */
  email: string;
  /** profiles.display_name */
  displayName: string | null;
  /** profiles.avatar_url */
  avatarUrl: string | null;
  /** profiles.locale (for UI language preference) */
  locale: string;
  /** The user's role in the organization */
  role: "owner" | "admin" | "member" | "viewer";
  /** organizations.id — the tenant scope for all data queries */
  organizationId: string;
  /** organizations.name_i18n — the localized org name */
  organizationName: I18nField;
  /** organizations.slug — URL-friendly identifier */
  organizationSlug: string;
}

/**
 * Fetch the full org context for the current authenticated user.
 *
 * Uses two scoped queries:
 *   1. profile (with organization_id for scoping)
 *   2. active organization_members (with organizations join for org details)
 *
 * If a brand-new user has no profile or membership, calls ensure_user_org().
 * Existing users without active membership are denied instead of auto-healed.
 *
 * Throws only if the user is not authenticated.
 *
 * Wrapped in React cache() so layouts, pages and components that call it
 * within the same request share one result instead of repeating the
 * auth + profile + membership round trips.
 */
export const getOrgContext = cache(async function getOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  if (user.user_metadata?.must_change_password === true) {
    throw new Error("Password change required");
  }

  const profileResult = await supabase
    .from("profiles")
    .select("display_name, avatar_url, locale, organization_id, default_organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: activeMemberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, organization_id, organizations(id, slug, name_i18n)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(100);

  if (membershipError) {
    throw new Error(`Failed to load organization membership: ${membershipError.message}`);
  }

  const preferredOrganizationId = profileResult.data?.default_organization_id
    ?? profileResult.data?.organization_id
    ?? null;
  const membership = activeMemberships?.find(
    (candidate) => candidate.organization_id === preferredOrganizationId,
  ) ?? activeMemberships?.[0] ?? null;

  // If no membership found, auto-heal via RPC
  if (!membership) {
    // An existing profile with no active membership is suspended/removed or
    // misconfigured. Never create a new organization as an authorization
    // fallback for that state.
    if (profileResult.data) {
      throw new Error("No active organization membership");
    }

    // Call ensure_user_org() which creates org/profile/membership if missing
    const { data: rpcData, error: rpcError } = await supabase.rpc("ensure_user_org");

    if (rpcError || !rpcData) {
      throw new Error(
        `Failed to ensure org membership for user ${user.id}: ${rpcError?.message ?? "unknown error"}`
      );
    }

    const orgData = rpcData as {
      organizationId: string;
      organizationSlug: string;
      organizationName: I18nField;
      role: string;
    };

    // Re-fetch profile since it may have been created by the RPC
    const { data: newProfile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, locale, organization_id, default_organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const profile = newProfile;
    const displayName =
      profile?.display_name ??
      user.user_metadata?.display_name ??
      user.email?.split("@")[0] ??
      null;
    const avatarUrl = profile?.avatar_url ?? null;
    const locale = profile?.locale ?? "en";

    return {
      userId: user.id,
      email: user.email!,
      displayName,
      avatarUrl,
      locale,
      role: orgData.role as OrgContext["role"],
      organizationId: orgData.organizationId,
      organizationName: orgData.organizationName,
      organizationSlug: orgData.organizationSlug,
    };
  }

  // Normal path — membership found
  const org = membership.organizations as unknown as {
    id: string;
    slug: string;
    name_i18n: I18nField;
  };

  // Profile may be null if RLS hasn't caught up yet — use auth metadata as fallback
  const profile = profileResult.data;
  const displayName =
    profile?.display_name ??
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    null;
  const avatarUrl = profile?.avatar_url ?? null;
  const locale = profile?.locale ?? "en";

  return {
    userId: user.id,
    email: user.email!,
    displayName,
    avatarUrl,
    locale,
    role: membership.role as OrgContext["role"],
    organizationId: org.id,
    organizationName: org.name_i18n,
    organizationSlug: org.slug,
  };
});
