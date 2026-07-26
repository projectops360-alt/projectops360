// ============================================================================
// PMO Portfolio Living Graph — route (CAP-048)
// ============================================================================
// The third dashboard, additive by contract: the PMO Command Center at "/" and
// Process Intelligence at "/process-intelligence" are untouched and remain
// reachable exactly as before.
//
// Server-side gate, same denial pattern as /process-intelligence and /admin:
// the page exists ONLY when PMO_LIVING_GRAPH_ENABLED is on AND the role is
// owner/admin. Everyone else gets 404 — not an empty shell, which would leak
// the module's existence.
//
// SINGLE-DASHBOARD-MODE: when that mode is on this dashboard has moved to "/",
// so this path redirects there instead of rendering a second copy. Redirecting
// rather than 404ing keeps bookmarks, Isabella deep links and sidebar history
// working. The redirect applies only to users who would actually be served the
// dashboard at the root; for anyone else the 404 below is preserved, because a
// redirect would silently swallow a genuine authorization denial.
// ============================================================================

import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { canAccessPmoLivingGraph } from "@/lib/pmo-living-graph/flags";
import { shouldRedirectLegacyIntelligenceRoute } from "@/lib/pmo-living-graph/single-dashboard";
import { PmoIntelligenceCenterView } from "@/components/pmo-living-graph/intelligence-center-view";

export default async function PmoLivingGraphPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  if (shouldRedirectLegacyIntelligenceRoute(org.role)) {
    redirect(locale === "es" ? "/es" : "/");
  }
  if (!canAccessPmoLivingGraph(org.role)) notFound();

  const raw = await searchParams;

  return <PmoIntelligenceCenterView org={org} locale={locale} searchParams={raw} />;
}
