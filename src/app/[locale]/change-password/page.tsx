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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(locale === routing.defaultLocale ? "/login" : `/${locale}/login`);
  }

  const forced = user!.user_metadata?.must_change_password === true;
  return <ChangePasswordForm locale={locale as Locale} forced={forced} />;
}
