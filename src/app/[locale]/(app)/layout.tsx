import { getOrgContext } from "@/lib/auth";
import { getUserOrganizations } from "@/lib/auth/org-actions";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";

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

  const organizations = await getUserOrganizations();

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
        orgRole: org.orgRole,
        isPmoLevel: org.isPmoLevel,
        organizations: organizations.map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
      }}
    >
      {children}
    </AppShell>
  );
}