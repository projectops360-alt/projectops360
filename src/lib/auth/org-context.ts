import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { I18nField } from "@/types/database";

/** Cookie holding the user's currently active organization (for org switching). */
export const ACTIVE_ORG_COOKIE = "po360.activeOrg";

// ---------------------------------------------------------------------------
// OrgContext — the full authenticated + organizational context for a request
// ---------------------------------------------------------------------------
// Fetches auth user → profile → membership → org in parallel queries.
//
// MVP-0: assumes one organization per user (the trigger creates exactly one).
// Future: add org switching by querying all memberships and storing the
//         active org ID in a cookie or profile field.
//
// Resilience: if the user has no org membership (e.g., trigger failed or user
// was created before the trigger existed), calls ensure_user_org() RPC which
// creates the missing data and returns it. This makes the app self-healing.
// ---------------------------------------------------------------------------

/** The 8 canonical, enforced organization roles. */
export type OrgRole =
  | "COMPANY_OWNER"
  | "PMO_ADMIN"
  | "PORTFOLIO_MANAGER"
  | "PROJECT_MANAGER"
  | "TEAM_MEMBER"
  | "STAKEHOLDER"
  | "CLIENT"
  | "VIEWER";

/** Roles that see the whole organization (PMO Center, all projects). */
export const PMO_LEVEL_ROLES: OrgRole[] = ["COMPANY_OWNER", "PMO_ADMIN", "PORTFOLIO_MANAGER"];

/** Map the legacy 4-value role onto the canonical enforced role (fallback only). */
export function legacyRoleToOrgRole(role: string | null | undefined): OrgRole {
  switch (role) {
    case "owner":
      return "COMPANY_OWNER";
    case "admin":
      return "PMO_ADMIN";
    case "viewer":
      return "VIEWER";
    default:
      return "TEAM_MEMBER";
  }
}

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
  /** The user's legacy role in the organization (kept for billing/back-compat) */
  role: "owner" | "admin" | "member" | "viewer";
  /** The user's canonical, enforced role — the source of truth for access */
  orgRole: OrgRole;
  /** TRUE when orgRole is PMO/portfolio-level (sees all projects in the org) */
  isPmoLevel: boolean;
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
 * Uses two parallel queries:
 *   1. profile (with organization_id for scoping)
 *   2. organization_members (with organizations join for org details)
 *
 * If no membership is found (e.g., trigger failed or user was created before
 * trigger existed), calls ensure_user_org() RPC to auto-create missing data.
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

  // Query profile and ALL memberships in parallel. A user may belong to more
  // than one organization; we pick the active one from a cookie, falling back to
  // their default org, then the first membership.
  const [profileResult, membershipsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, locale, organization_id, default_organization_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, org_role, organization_id, organizations(id, slug, name_i18n)")
      .eq("user_id", user.id)
      .neq("status", "removed"),
  ]);

  const memberships = (membershipsResult.data ?? []) as unknown as Array<{
    role: string;
    org_role?: string | null;
    organization_id: string;
    organizations: { id: string; slug: string; name_i18n: I18nField } | null;
  }>;

  // Resolve the active membership: cookie → profile.default → first.
  let membership = memberships[0] ?? null;
  if (memberships.length > 1) {
    const cookieStore = await cookies();
    const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    const preferred =
      (cookieOrg && memberships.find((m) => m.organization_id === cookieOrg)) ||
      (profileResult.data?.default_organization_id &&
        memberships.find((m) => m.organization_id === profileResult.data!.default_organization_id)) ||
      null;
    if (preferred) membership = preferred;
  }

  // If no membership found, auto-heal via RPC
  if (!membership) {
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
      .select("display_name, avatar_url, locale, organization_id")
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

    const healedOrgRole = legacyRoleToOrgRole(orgData.role);
    return {
      userId: user.id,
      email: user.email!,
      displayName,
      avatarUrl,
      locale,
      role: orgData.role as OrgContext["role"],
      orgRole: healedOrgRole,
      isPmoLevel: PMO_LEVEL_ROLES.includes(healedOrgRole),
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

  // org_role is the enforced source of truth; fall back to the legacy role for
  // rows created before the RBAC migration backfilled them.
  const rawOrgRole = (membership as { org_role?: string | null }).org_role;
  const orgRole: OrgRole = (PMO_LEVEL_ROLES as string[])
    .concat(["PROJECT_MANAGER", "TEAM_MEMBER", "STAKEHOLDER", "CLIENT", "VIEWER"])
    .includes(rawOrgRole ?? "")
    ? (rawOrgRole as OrgRole)
    : legacyRoleToOrgRole(membership.role);

  return {
    userId: user.id,
    email: user.email!,
    displayName,
    avatarUrl,
    locale,
    role: membership.role as OrgContext["role"],
    orgRole,
    isPmoLevel: PMO_LEVEL_ROLES.includes(orgRole),
    organizationId: org.id,
    organizationName: org.name_i18n,
    organizationSlug: org.slug,
  };
});