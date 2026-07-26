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
// ============================================================================

import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, Network } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { canAccessPmoLivingGraph } from "@/lib/pmo-living-graph/flags";
import { PortfolioGraphShell } from "@/components/pmo-living-graph/portfolio-graph-shell";
import { loadPmoIntelligence } from "@/lib/pmo-intelligence/read-model.server";
import { scopeFromSearchParams } from "@/lib/pmo-intelligence/scope";
import { toDashboardSlice } from "@/lib/pmo-intelligence/dashboard-model";
import type { PmoIntelligenceLayerProps } from "@/components/pmo-intelligence/layer-contract";
import type { Locale } from "@/types/database";

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
  if (!canAccessPmoLivingGraph(org.role)) notFound();

  const t = await getTranslations("pmoLivingGraph");
  const typedLocale: Locale = locale === "es" ? "es" : "en";
  const base = locale === "es" ? "/es" : "";

  // The scope is read from the URL on the server, so the first paint already
  // answers the question the address bar asks. Parsing it on the client instead
  // would render the unfiltered portfolio and then snap to the filtered one.
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  // Organization comes from the session, never from the query string; RLS
  // enforces the same boundary again in the database.
  const scope = scopeFromSearchParams(org.organizationId, flat);

  // One composed read across every source (ADR-012: composes, never computes).
  const intelligenceModel = await loadPmoIntelligence(
    scope,
    typedLocale,
    new Date().toISOString(),
  );
  const model = intelligenceModel.graph;

  const organizationName =
    org.organizationName[typedLocale] ?? org.organizationName.en ?? org.organizationSlug;

  // "Could not read" and "genuinely nothing" are different answers and get
  // different screens. Collapsing them would let a failed query masquerade as a
  // portfolio with no risks.
  if (model.state === "unavailable") {
    return (
      <EmptyState
        tone="warning"
        title={t("unavailable")}
        hint={t("unavailableHint", {
          sources: model.unavailableSources.join(", "),
        })}
      />
    );
  }

  if (model.state === "empty") {
    return <EmptyState tone="neutral" title={t("empty")} hint={t("emptyHint")} />;
  }

  const intelligence: PmoIntelligenceLayerProps = {
    initialScope: scope,
    organizationName,
    // Flattened here, on the server, using the same function the reload action
    // uses. One shape for both paths means the first paint and every subsequent
    // refresh cannot disagree about what a KPI is.
    dashboard: toDashboardSlice(intelligenceModel),
    projects: model.nodes
      .filter((node) => node.kind === "project" && node.projectId != null)
      .map((node) => ({ id: node.projectId as string, label: node.label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    unavailableSources: intelligenceModel.unavailableSources,
    lensData: {
      flow: intelligenceModel.flow
        ? { nodes: intelligenceModel.flow.nodes, edges: intelligenceModel.flow.edges }
        : null,
      risk: intelligenceModel.overlays?.risk ?? null,
      finance: intelligenceModel.finance
        ? {
            rows: intelligenceModel.finance.rows,
            alerts: intelligenceModel.finance.alerts,
          }
        : null,
      // The GENERIC engine produced these rows (lib/capacity, unit: hours).
      // Naming it here is what stops the number being read as headcount —
      // CAP-048 §5, the one integration that must never be ambiguous.
      capacity: intelligenceModel.overlays
        ? { rows: intelligenceModel.overlays.capacity, engine: "generic" }
        : null,
      dependencies: intelligenceModel.overlays?.dependencies ?? null,
      blockedDaysByProject: intelligenceModel.blockedDays?.daysByProject ?? null,
    },
  };

  return (
    <PortfolioGraphShell
      locale={typedLocale === "es" ? "es" : "en"}
      base={base}
      organizationId={org.organizationId}
      userId={org.userId}
      organizationName={organizationName}
      nodes={model.nodes}
      edges={model.edges}
      criticalNodes={model.criticalNodes}
      metrics={model.metrics}
      unavailableSources={model.unavailableSources}
      intelligence={intelligence}
    />
  );
}

function EmptyState({
  tone,
  title,
  hint,
}: {
  tone: "warning" | "neutral";
  title: string;
  hint: string;
}) {
  const warning = tone === "warning";
  const Icon = warning ? AlertTriangle : Network;
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className={`max-w-md rounded-xl border p-6 text-center ${
          warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
        }`}
      >
        <Icon
          className={`mx-auto h-8 w-8 ${warning ? "text-amber-500" : "text-slate-300"}`}
          aria-hidden
        />
        <h1
          className={`mt-3 text-base font-extrabold ${
            warning ? "text-amber-900" : "text-slate-900"
          }`}
        >
          {title}
        </h1>
        <p className={`mt-1 text-sm ${warning ? "text-amber-800" : "text-slate-500"}`}>{hint}</p>
      </div>
    </div>
  );
}
