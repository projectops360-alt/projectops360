"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAuthEmailCallbackUrl } from "@/lib/auth/email-redirects.server";

export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function signupAction(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;
  // Optional company name → raw_user_meta_data.company_name, consumed by the
  // handle_new_user() trigger to name the new organization (both locales).
  const companyName = ((formData.get("companyName") as string) ?? "").trim();

  const confirmationUrl = await getAuthEmailCallbackUrl();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        ...(companyName ? { company_name: companyName } : {}),
      },
      emailRedirectTo: confirmationUrl,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, email };
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "invalid_email" as const };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await getAuthEmailCallbackUrl("/change-password?recovery=1"),
  });

  if (error) return { error: "delivery_failed" as const };

  return { success: true as const };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
