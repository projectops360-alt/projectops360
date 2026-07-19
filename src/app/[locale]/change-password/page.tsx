import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/types/database";
import { ChangePasswordForm } from "./change-password-form";

/**
 * Standalone (no app shell) password-change screen. Lives OUTSIDE the (app)
 * route group so the forced-change gate in the app layout can redirect here
 * without a loop. Requires an authenticated session.
 */
export default async function ChangePasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ recovery?: string; invite?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(locale === routing.defaultLocale ? "/login" : `/${locale}/login`);
  }

  const forced = user!.user_metadata?.must_change_password === true;
  const mode = query.recovery === "1" ? "recovery" : query.invite === "1" ? "invite" : undefined;
  return <ChangePasswordForm locale={locale as Locale} forced={forced} mode={mode} />;
}
