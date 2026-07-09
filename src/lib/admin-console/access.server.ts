import "server-only";

// ============================================================================
// ProjectOps360° — Admin Console access gate (SERVER-ONLY, single source)
// ============================================================================
// The Admin Console (/<locale>/admin) is a platform-wide, cross-org surface:
// it reads companies, users, projects and tasks across every tenant. Access
// is a STRICT server-side check — never frontend-only.
//
// Authorization logic (evaluated server-side, case-insensitive, trimmed):
//   1. If `admin_authorized_users` has an active (is_active=true) row for the
//      normalized email → authorized. (Future source of truth; empty/absent
//      table falls through.)
//   2. Else if the email is in the shared platform-admin allowlist resolved by
//      Product Brain (`PRODUCT_BRAIN_ALLOWED_EMAILS` env-var, or its built-in
//      defaults — efrain.pradas@gmail.com + pmo@xxx-demo.io) → authorized.
//      This is the SAME list that gates the Product Brain Control Center, so
//      the platform owners reach both internal surfaces with one config.
//   3. Else if the normalized email equals FALLBACK_ADMIN_EMAIL → authorized
//      (anti-lockout; redundant with #2 but kept so the Console is never
//      locked out even if the env var is unset AND the defaults change).
//   4. Else → denied (the route returns 404 and loads NO data).
//
// Every admin query (page render, server actions) MUST call isPlatformAdmin()
// first and bail before touching any business table. The allowlist itself
// never reaches the client bundle.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { isProductBrainAllowedEmail } from "@/lib/product-brain/access.server";
import { normalizeEmail } from "@/lib/product-brain/access";
import { logAdminEvent } from "./audit";
import type { AuthorizedAdminRow } from "./types";

/**
 * Temporary fallback administrator. Stays authorized even when
 * admin_authorized_users is empty or absent (e.g. migration not yet applied),
// so the Console is never locked out. Remove once the table is the source of
// truth and seeded.
 */
export const FALLBACK_ADMIN_EMAIL = "pmo@xxx-demo.io";

/** Active authorizations from the table (empty array if the table is absent). */
async function activeAuthorizedEmails(): Promise<Set<string>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("admin_authorized_users")
      .select("email")
      .eq("is_active", true);
    if (error) return new Set(); // table absent / query failed → fallback path
    return new Set((data ?? []).map((r) => normalizeEmail(r.email)));
  } catch {
    return new Set(); // service role unset / table missing → fallback path
  }
}

/**
 * THE gate. True iff `email` is authorized to view the Admin Console. Resolves
 * the table allowlist first, then applies the temporary fallback. Never throws.
 */
export async function isPlatformAdmin(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  // 1) Table allowlist (future source of truth; empty/absent → fall through).
  const tableEmails = await activeAuthorizedEmails();
  if (tableEmails.has(normalized)) return true;
  // 2) Shared platform-admin allowlist (Product Brain env-var + defaults).
  //    This is the same list gating the Product Brain Control Center, so the
  //    platform owners reach both internal surfaces with one config.
  if (isProductBrainAllowedEmail(normalized)) return true;
  // 3) Anti-lockout fallback (redundant with #2; kept defensively).
  return normalized === normalizeEmail(FALLBACK_ADMIN_EMAIL);
}

/**
 * Denial helper for server components: returns the email for logging and a
 * boolean. Callers should `notFound()` (which does not reveal the route nor
 * load data) when this returns false. Kept as a boolean so server actions can
 * return a structured 403-style error instead of throwing notFound.
 */
export async function requirePlatformAdmin(
  email: string | null | undefined,
  route?: string,
): Promise<boolean> {
  const ok = await isPlatformAdmin(email);
  if (!ok) {
    logAdminEvent({
      event: "admin_access_denied",
      email: email ?? null,
      route: route ?? null,
      result: "denied",
    });
  }
  return ok;
}

/** Read the authorized-admin rows for the "Admin Access" section (read-only). */
export async function getAuthorizedAdmins(): Promise<AuthorizedAdminRow[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("admin_authorized_users")
      .select("email, role, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => ({
      email: (r as { email: string }).email,
      role: (r as { role: string | null }).role ?? null,
      isActive: (r as { is_active: boolean }).is_active,
      grantedAt: (r as { created_at: string | null }).created_at ?? null,
    }));
  } catch {
    return [];
  }
}