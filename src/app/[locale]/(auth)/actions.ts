"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthEmailCallbackUrl } from "@/lib/auth/email-redirects.server";

const SOURCE_CLASSES = new Set(["ai", "search", "social", "referral", "campaign", "direct", "other"]);
const AI_ENGINES = new Set(["chatgpt", "gemini", "claude", "perplexity", "copilot"]);

function field(formData: FormData, key: string, max = 240): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function timestampOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function acquisitionTouch(formData: FormData, prefix: "first" | "last") {
  const sourceClassRaw = field(formData, `${prefix}_source_class`, 24);
  const aiEngineRaw = field(formData, `${prefix}_ai_engine`, 24);
  return {
    sourceClass: SOURCE_CLASSES.has(sourceClassRaw) ? sourceClassRaw : "direct",
    aiEngine: AI_ENGINES.has(aiEngineRaw) ? aiEngineRaw : null,
    source: field(formData, `${prefix}_source`),
    medium: field(formData, `${prefix}_medium`),
    campaign: field(formData, `${prefix}_campaign`),
    content: field(formData, `${prefix}_content`),
    term: field(formData, `${prefix}_term`),
    referrerHost: field(formData, `${prefix}_referrer_host`),
    landingPath: field(formData, `${prefix}_landing_path`, 500),
    touchedAt: timestampOrNull(field(formData, `${prefix}_touch_at`, 80)),
  };
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect("/");
}

export async function signupAction(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;
  const companyName = ((formData.get("companyName") as string) ?? "").trim();
  const first = acquisitionTouch(formData, "first");
  const last = acquisitionTouch(formData, "last");

  const confirmationUrl = await getAuthEmailCallbackUrl();

  const { data: signupData, error } = await supabase.auth.signUp({
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

  if (error) return { error: error.message };

  // Attribution must never make signup fail. The auth insert fires the existing
  // new-user/org trigger synchronously, so the initial organization membership
  // is normally available by the time this block executes.
  if (signupData.user?.id) {
    try {
      const admin = createAdminClient();
      const { data: membership } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", signupData.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { error: attributionError } = await admin
        .from("acquisition_attribution")
        .upsert({
          user_id: signupData.user.id,
          organization_id: membership?.organization_id ?? null,
          first_source_class: first.sourceClass,
          first_ai_engine: first.aiEngine,
          first_source: first.source || null,
          first_medium: first.medium || null,
          first_campaign: first.campaign || null,
          first_content: first.content || null,
          first_term: first.term || null,
          first_referrer_host: first.referrerHost || null,
          first_landing_path: first.landingPath || null,
          first_touch_at: first.touchedAt,
          last_source_class: last.sourceClass,
          last_ai_engine: last.aiEngine,
          last_source: last.source || null,
          last_medium: last.medium || null,
          last_campaign: last.campaign || null,
          last_content: last.content || null,
          last_term: last.term || null,
          last_referrer_host: last.referrerHost || null,
          last_landing_path: last.landingPath || null,
          last_touch_at: last.touchedAt,
          signed_up_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (attributionError) {
        console.error("Failed to persist acquisition attribution:", attributionError.message);
      }
    } catch (attributionError) {
      console.error("Acquisition attribution capture failed:", attributionError);
    }
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
