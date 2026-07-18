"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Change the CURRENT user's own password and clear the must_change_password
 * flag. Uses the user's own session (not the service role): a user can only
 * ever change their own password. Used by the forced-change-on-first-login flow
 * and for voluntary password changes.
 */
export async function changeOwnPasswordAction(input: { password: string }): Promise<{ ok: boolean; error?: string }> {
  const password = input.password ?? "";
  if (password.length < 12) return { ok: false, error: "weak_password" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.auth.updateUser({
    password,
    data: { ...(user.user_metadata ?? {}), must_change_password: false },
  });
  if (error) {
    // Supabase rejects reusing the same password, weak passwords, etc.
    return { ok: false, error: error.message.toLowerCase().includes("different") ? "same_password" : "update_failed" };
  }
  return { ok: true };
}
