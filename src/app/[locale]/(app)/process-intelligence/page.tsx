// ============================================================================
// PMO Process Intelligence Command Center — route (CAP-047 · M3)
// ============================================================================
// Independent module route. Server-side gate: the page exists ONLY when the
// PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED flag is on AND the role is
// owner/admin — everyone else gets 404 (same denial pattern as /admin).
// The current PMO Command Center at "/" remains the default dashboard; this
// route is reached exclusively through its comparison switcher and links
// back with one click. Route-level code splitting keeps it lazy.
// ============================================================================

import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { canAccessProcessIntelligence } from "@/lib/pmo-process-intelligence/flags";
import { DEFAULT_PMO_PI_FILTERS } from "@/lib/pmo-process-intelligence/contracts";
import { CommandCenterShell } from "@/components/pmo-process-intelligence/command-center-shell";

export default async function ProcessIntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  if (!canAccessProcessIntelligence(org.role)) notFound();

  const base = locale === "es" ? "/es" : "";
  const orgName =
    org.organizationName[locale as "en" | "es"] ?? org.organizationName.en ?? org.organizationSlug;

  return (
    <CommandCenterShell
      locale={locale === "es" ? "es" : "en"}
      base={base}
      organizationName={orgName}
      initialFilters={DEFAULT_PMO_PI_FILTERS}
    />
  );
}
