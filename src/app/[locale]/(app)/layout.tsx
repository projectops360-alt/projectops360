import { getOrgContext } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LivingGuideWidget } from "@/components/living-guide";
import type { Locale } from "@/types/database";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetch full auth + org context in one call.
  // Redirects to login if unauthenticated or no org membership found.
  let org;
  try {
    org = await getOrgContext();
  } catch {
    redirect(locale === routing.defaultLocale ? "/login" : `/${locale}/login`);
  }

  // Force a password change on first login (members created with a temporary
  // password). Redirects to the standalone /change-password screen until done.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.user_metadata?.must_change_password === true) {
    redirect(locale === routing.defaultLocale ? "/change-password" : `/${locale}/change-password`);
  }

  return (
    <AppShell
      user={{
        displayName: org.displayName,
        email: org.email,
        avatarUrl: org.avatarUrl,
      }}
      org={{
        id: org.organizationId,
        name: org.organizationName,
        slug: org.organizationSlug,
        role: org.role,
      }}
    >
      {children}
      {/* Isabella is present app-wide, so she persists across navigation and her
          guided "Open <X>" links can actually take the user there and continue.
          Screen is resolved client-side from the route. */}
      <LivingGuideWidget
        locale={locale as Locale}
        context={{
          module: "",
          role: org.role,
          userId: org.userId,
          organizationId: org.organizationId,
        }}
      />
    </AppShell>
  );
}