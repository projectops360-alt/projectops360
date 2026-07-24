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
import {
  buildExecutivePortfolioModel,
} from "@/lib/pmo-process-intelligence/executive-projection";
import { CommandCenterShell } from "@/components/pmo-process-intelligence/command-center-shell";
import type { Locale } from "@/types/database";
import type { PmoPiFinanceOverlayModel } from "@/lib/pmo-process-intelligence/financial-overlay";
import type { PmoPiOverlaysData } from "@/lib/pmo-process-intelligence/overlays-read.server";
import { loadPmoPiHierarchy } from "@/lib/pmo-process-intelligence/hierarchy-read.server";
import type { ProcessGraphHierarchyModel } from "@/lib/pmo-process-intelligence/process-graph.types";

export default async function ProcessIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    project?: string;
    focus?: string;
    view?: string;
    overlay?: string;
  }>;
}) {
  const { locale } = await params;
  const { project, focus, view, overlay } = await searchParams;
  setRequestLocale(locale);

  const org = await getOrgContext();
  if (!canAccessProcessIntelligence(org.role)) notFound();

  const base = locale === "es" ? "/es" : "";
  const orgName =
    org.organizationName[locale as "en" | "es"] ?? org.organizationName.en ?? org.organizationSlug;

  // Read-only projection over the PEG (RLS-scoped + org barrier). An invalid
  // or foreign ?project= is treated exactly like no access to the module.
  const organizationResult = await loadPmoPiFlowModel(
    (locale as Locale) ?? "en",
    null,
  );
  if (organizationResult.status === "unauthorized") notFound();
  const projectResult = project
    ? await loadPmoPiFlowModel((locale as Locale) ?? "en", project)
    : null;
  if (projectResult?.status === "unauthorized") notFound();

  // Financial overlay: always load the authorized organization scope. The
  // selected-project drawer is derived from the same rows, so the organization
  // map remains visible until the user explicitly chooses Focus on Project.
  const scopedIds =
    organizationResult.status === "ok"
      ? organizationResult.projects.map((item) => item.id)
      : [];
  const finance = scopedIds.length > 0 ? await loadPmoPiFinanceOverlay(org.organizationId, scopedIds) : null;
  const overlays = scopedIds.length > 0 ? await loadPmoPiOverlays(org, scopedIds) : null;
  let hierarchy: ProcessGraphHierarchyModel = {
    organizationId: org.organizationId,
    milestones: [],
    activities: [],
    dependencies: [],
    truncated: false,
    limitations: ["hierarchy_projection_unavailable"],
  };
  try {
    hierarchy = await loadPmoPiHierarchy(org, scopedIds);
  } catch {
    // The executive process projection remains available. Drill-down degrades
    // honestly instead of exposing partial or cross-tenant hierarchy rows.
  }
  const projectNames: Record<string, string> = {};
  if (organizationResult.status === "ok") {
    for (const item of organizationResult.projects) {
      projectNames[item.id] = item.title;
    }
  }

  const executiveModel =
    organizationResult.status === "ok"
      ? buildExecutivePortfolioModel({
          cases: organizationResult.cases,
          technicalFlow: organizationResult.model,
          projects: organizationResult.projects,
          finance,
          overlays,
          generatedAt: organizationResult.model.generatedAt,
        })
      : null;
  const selectedProject =
    executiveModel?.projects.find((item) => item.id === project) ?? null;
  const selectedDirectoryProject =
    organizationResult.status === "ok"
      ? organizationResult.projects.find((item) => item.id === project) ?? null
      : null;
  const focusFinance = selectedProject
    ? scopeFinance(finance, selectedProject.id)
    : null;
  const focusOverlays = selectedProject
    ? scopeOverlays(overlays, selectedProject.id)
    : null;
  const focusExecutiveModel =
    projectResult?.status === "ok" && selectedDirectoryProject
      ? buildExecutivePortfolioModel({
          cases: projectResult.cases,
          technicalFlow: projectResult.model,
          projects: [selectedDirectoryProject],
          finance: focusFinance,
          overlays: focusOverlays,
          generatedAt: projectResult.model.generatedAt,
        })
      : null;

  // Isabella insights (M7): deterministic rules over the loaded read models.
  const activeFlow =
    projectResult?.status === "ok"
      ? projectResult.model
      : organizationResult.status === "ok"
        ? organizationResult.model
        : null;
  const insights = buildInsights({
    flow: activeFlow,
    finance: selectedProject ? focusFinance : finance,
    overlays: selectedProject ? focusOverlays : overlays,
    projectNames,
    generatedAt: activeFlow?.generatedAt ?? new Date().toISOString(),
  });

  const overlayOptions = new Set([
    "process",
    "risk",
    "finance",
    "resources",
    "dependencies",
    "benefits",
    "whatif",
  ]);
  const initialFilters = {
    ...DEFAULT_PMO_PI_FILTERS,
    overlay: overlayOptions.has(overlay ?? "")
      ? (overlay as typeof DEFAULT_PMO_PI_FILTERS.overlay)
      : "process",
  };

  return (
    <CommandCenterShell
      locale={locale === "es" ? "es" : "en"}
      base={base}
      organizationName={orgName}
      organizationId={org.organizationId}
      userId={org.userId}
      initialFilters={initialFilters}
      executiveModel={executiveModel}
      organizationModel={
        organizationResult.status === "ok" ? organizationResult.model : null
      }
      focusExecutiveModel={focusExecutiveModel}
      focusModel={projectResult?.status === "ok" ? projectResult.model : null}
      focusProject={selectedProject}
      focusMode={focus === "true" && selectedProject !== null}
      initialTechnicalView={view === "technical"}
      loadFailed={
        organizationResult.status === "error" ||
        projectResult?.status === "error"
      }
      truncated={
        organizationResult.status === "ok"
          ? organizationResult.truncated
          : false
      }
      finance={finance}
      overlays={overlays}
      insights={insights}
      projectNames={projectNames}
      hierarchy={hierarchy}
    />
  );
}

function scopeFinance(
  finance: PmoPiFinanceOverlayModel | null,
  projectId: string,
): PmoPiFinanceOverlayModel | null {
  if (!finance) return null;
  const rows = finance.rows.filter((row) => row.projectId === projectId);
  return {
    ...finance,
    rows,
    alerts: finance.alerts.filter((alert) => alert.projectId === projectId),
    portfolioCpi: rows[0]?.cpi ?? null,
  };
}

function scopeOverlays(
  overlays: PmoPiOverlaysData | null,
  projectId: string,
): PmoPiOverlaysData | null {
  if (!overlays) return null;
  const riskRows = overlays.risk.rows.filter(
    (row) => row.projectId === projectId,
  );
  const systemic = overlays.risk.systemic.filter(
    (risk) => risk.projectId === projectId,
  );
  const dependencyRows = overlays.dependencies.perProject.filter(
    (row) => row.projectId === projectId,
  );
  return {
    risk: {
      ...overlays.risk,
      rows: riskRows,
      systemic,
      criticalOpenCount: riskRows.reduce(
        (sum, row) => sum + row.criticalCount,
        0,
      ),
      totalOpenCount: riskRows.reduce((sum, row) => sum + row.openCount, 0),
    },
    dependencies: {
      ...overlays.dependencies,
      perProject: dependencyRows,
      hubs: overlays.dependencies.hubs.filter(
        (hub) => hub.projectId === projectId,
      ),
      totalDependencies: dependencyRows.reduce(
        (sum, row) => sum + row.dependencyCount,
        0,
      ),
    },
    capacity: overlays.capacity.filter(
      (row) => row.projectId === projectId,
    ),
  };
}
