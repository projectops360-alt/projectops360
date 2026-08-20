import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AdminUserLookupResult =
  | { status: "found"; user: { id: string; email: string | null } }
  | { status: "not_found" }
  | { status: "error"; code: string };

/**
 * Resolve an auth user by exact email without enumerating the Auth Admin API.
 *
 * auth.users is not exposed through PostgREST, so the lookup is performed by
 * the gated SECURITY DEFINER RPC admin_find_user_by_email. Importantly, RPC
 * failures stay distinguishable from a genuine "not found" result.
 */
export async function findAdminUserByEmail(email: string): Promise<AdminUserLookupResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { status: "not_found" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_find_user_by_email", {
    p_email: normalizedEmail,
  });

  if (error) {
    console.error("[admin/user-integrity] user lookup failed", {
      code: error.code ?? "unknown",
      message: error.message,
    });
    return { status: "error", code: error.code ?? "lookup_failed" };
  }

  const rows = (data ?? []) as Array<{ user_id: string; email: string | null }>;
  const row = rows[0];
  if (!row?.user_id) return { status: "not_found" };

  return {
    status: "found",
    user: { id: row.user_id, email: row.email },
  };
}
