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
import { loadPmoPiFlowModel } from "@/lib/pmo-process-intelligence/read-model.server";
import { loadPmoPiFinanceOverlay } from "@/lib/pmo-process-intelligence/financial-read.server";
import { loadPmoPiOverlays } from "@/lib/pmo-process-intelligence/overlays-read.server";
import { buildInsights } from "@/lib/pmo-process-intelligence/insights";
import { CommandCenterShell } from "@/components/pmo-process-intelligence/command-center-shell";
import type { Locale } from "@/types/database";

export default async function ProcessIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { locale } = await params;
  const { project } = await searchParams;
  setRequestLocale(locale);

  const org = await getOrgContext();
  if (!canAccessProcessIntelligence(org.role)) notFound();

  const base = locale === "es" ? "/es" : "";
  const orgName =
    org.organizationName[locale as "en" | "es"] ?? org.organizationName.en ?? org.organizationSlug;

  // Read-only projection over the PEG (RLS-scoped + org barrier). An invalid
  // or foreign ?project= is treated exactly like no access to the module.
  const result = await loadPmoPiFlowModel((locale as Locale) ?? "en", project ?? null);
  if (result.status === "unauthorized") notFound();

  // Financial overlay (M5): read-only cockpit rows for the projects in scope.
  const scopedIds =
    result.status === "ok"
      ? result.focusProject
        ? [result.focusProject.id]
        : result.projects.map((p) => p.id)
      : [];
  const finance = scopedIds.length > 0 ? await loadPmoPiFinanceOverlay(org.organizationId, scopedIds) : null;
  const overlays = scopedIds.length > 0 ? await loadPmoPiOverlays(org, scopedIds) : null;
  const projectNames: Record<string, string> = {};
  if (result.status === "ok") for (const p of result.projects) projectNames[p.id] = p.title;

  // Isabella insights (M7): deterministic rules over the loaded read models.
  const insights = buildInsights({
    flow: result.status === "ok" ? result.model : null,
    finance,
    overlays,
    projectNames,
    generatedAt: result.status === "ok" ? result.model.generatedAt : new Date().toISOString(),
  });

  return (
    <CommandCenterShell
      locale={locale === "es" ? "es" : "en"}
      base={base}
      organizationName={orgName}
      initialFilters={DEFAULT_PMO_PI_FILTERS}
      model={result.status === "ok" ? result.model : null}
      loadFailed={result.status === "error"}
      truncated={result.status === "ok" ? result.truncated : false}
      projects={result.status === "ok" ? result.projects : []}
      focusProject={result.status === "ok" ? result.focusProject : null}
      finance={finance}
      overlays={overlays}
      insights={insights}
      projectNames={projectNames}
    />
  );
}
