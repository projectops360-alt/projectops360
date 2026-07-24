"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Banknote,
  ChevronRight,
  GitBranch,
  Home,
  LayoutList,
  Network,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";
import type {
  PmoPiFilters,
  PmoPiFlowModel,
} from "@/lib/pmo-process-intelligence/contracts";
import type { PmoPiFinanceOverlayModel } from "@/lib/pmo-process-intelligence/financial-overlay";
import type { PmoPiOverlaysData } from "@/lib/pmo-process-intelligence/overlays-read.server";
import type { PmoPiInsight } from "@/lib/pmo-process-intelligence/insights";
import type { WhatIfInputs } from "@/lib/pmo-process-intelligence/whatif";
import type { ProcessGraphHierarchyModel } from "@/lib/pmo-process-intelligence/process-graph.types";
import {
  EXECUTIVE_STAGE_ORDER,
  executiveStageLabel,
  type PmoPiExecutivePortfolioModel,
  type PmoPiExecutiveProject,
} from "@/lib/pmo-process-intelligence/executive-projection";
import { FinanceOverlay } from "./finance-overlay";
import {
  BenefitsPanel,
  DependenciesPanel,
  ResourcesPanel,
  RiskPanel,
} from "./overlays-panels";
import { IsabellaPanel } from "./isabella-panel";
import { WhatIfPanel } from "./whatif-panel";
import { RealtimeRefresh } from "./realtime-refresh";
import { TechnicalEventExplorer } from "./technical-event-explorer";
import { ProcessIntelligenceCanvas } from "./process-intelligence-canvas";

type OverlayKey = PmoPiFilters["overlay"];

const OVERLAYS: {
  key: OverlayKey;
  icon: React.ReactNode;
  en: string;
  es: string;
}[] = [
  { key: "process", icon: <Network className="h-4 w-4" />, en: "Process", es: "Proceso" },
  { key: "risk", icon: <ShieldAlert className="h-4 w-4" />, en: "Risk", es: "Riesgo" },
  { key: "finance", icon: <Banknote className="h-4 w-4" />, en: "Finance", es: "Finanzas" },
  { key: "resources", icon: <Users className="h-4 w-4" />, en: "Resources", es: "Recursos" },
  { key: "dependencies", icon: <GitBranch className="h-4 w-4" />, en: "Dependencies", es: "Dependencias" },
  { key: "benefits", icon: <Target className="h-4 w-4" />, en: "Benefits", es: "Beneficios" },
  { key: "whatif", icon: <Activity className="h-4 w-4" />, en: "What-if", es: "What-if" },
];

export function deriveKpis(model: PmoPiFlowModel | null): {
  dominantSharePct: number | null;
  reworkPct: number | null;
  bottleneckCount: number | null;
} {
  if (!model || model.nodes.length === 0) {
    return {
      dominantSharePct: null,
      reworkPct: null,
      bottleneckCount: null,
    };
  }
  const top = [...model.variants.variants].sort(
    (left, right) => right.caseCount - left.caseCount,
  )[0] ?? null;
  const totalEdgeFrequency = model.edges.reduce(
    (sum, edge) => sum + edge.frequency,
    0,
  );
  const reworkFrequency = model.edges
    .filter((edge) => edge.isRework)
    .reduce((sum, edge) => sum + edge.frequency, 0);
  return {
    dominantSharePct: top ? Math.round(top.frequencyPct) : null,
    reworkPct:
      totalEdgeFrequency > 0
        ? Math.round((reworkFrequency / totalEdgeFrequency) * 100)
        : null,
    bottleneckCount: model.nodes.filter(
      (node) => node.bottleneckScore >= 0.7,
    ).length,
  };
}

function emptyExecutiveModel(
  technicalModel: PmoPiFlowModel | null,
): PmoPiExecutivePortfolioModel {
  return {
    stages: EXECUTIVE_STAGE_ORDER.map((key) => ({
      key,
      projectIds: [],
      projectCount: 0,
      activeProjectCount: 0,
      averageCycleTimeMs: null,
      targetCycleTimeMs: null,
      outsideSlaProjectCount: null,
      reworkOccurrences: 0,
      baselineBudget: 0,
      actualCost: 0,
      eac: 0,
      forecastVariance: 0,
      activeRisks: 0,
      overallocatedResources: 0,
      trend: "unavailable" as const,
      status: "insufficient" as const,
    })),
    connections: [],
    variants: [],
    bottlenecks: [],
    reworkLoops: [],
    projects: [],
    portfolioHealthScore: null,
    generatedAt: technicalModel?.generatedAt ?? new Date(0).toISOString(),
    dataQualityScore: technicalModel?.quality.dataQualityScore ?? 0,
    limitations: ["executive_projection_unavailable"],
  };
}

interface CommandCenterShellProps {
  locale: "en" | "es";
  base: string;
  organizationName: string;
  organizationId: string;
  userId: string;
  initialFilters: PmoPiFilters;
  executiveModel?: PmoPiExecutivePortfolioModel | null;
  organizationModel?: PmoPiFlowModel | null;
  focusExecutiveModel?: PmoPiExecutivePortfolioModel | null;
  focusModel?: PmoPiFlowModel | null;
  focusProject?: PmoPiExecutiveProject | null;
  focusMode?: boolean;
  initialTechnicalView?: boolean;
  model?: PmoPiFlowModel | null;
  loadFailed?: boolean;
  truncated?: boolean;
  projects?: { id: string; title: string }[];
  finance?: PmoPiFinanceOverlayModel | null;
  overlays?: PmoPiOverlaysData | null;
  insights?: PmoPiInsight[];
  projectNames?: Record<string, string>;
  hierarchy: ProcessGraphHierarchyModel;
}

export function CommandCenterShell({
  locale,
  base,
  organizationName,
  organizationId,
  userId,
  initialFilters,
  executiveModel,
  organizationModel,
  focusExecutiveModel = null,
  focusModel = null,
  focusProject = null,
  focusMode = false,
  initialTechnicalView = false,
  model,
  loadFailed = false,
  truncated = false,
  finance = null,
  overlays = null,
  insights = [],
  projectNames = {},
  hierarchy,
}: CommandCenterShellProps) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const technicalModel = organizationModel ?? model ?? null;
  const organizationExecutive =
    executiveModel ?? emptyExecutiveModel(technicalModel);
  const activeExecutive =
    focusMode && focusExecutiveModel ? focusExecutiveModel : organizationExecutive;
  const activeTechnical = focusMode && focusModel ? focusModel : technicalModel;
  const [overlay, setOverlay] = useState<OverlayKey>(initialFilters.overlay);
  const [tableView, setTableView] = useState(false);
  const [technicalView, setTechnicalView] = useState(initialTechnicalView);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    focusMode ? null : focusProject?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialFilters.dateTo ?? "");

  const storageKey = `pmo-pi-executive-view:${organizationName}`;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(storageKey);
        if (!saved) return;
        const parsed = JSON.parse(saved) as {
          overlay?: OverlayKey;
          dateFrom?: string;
          dateTo?: string;
        };
        if (parsed.overlay) setOverlay(parsed.overlay);
        if (parsed.dateFrom) setDateFrom(parsed.dateFrom);
        if (parsed.dateTo) setDateTo(parsed.dateTo);
      } catch {
        // Session state is optional presentation context.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ overlay, dateFrom, dateTo }),
      );
    } catch {
      // Session state is optional presentation context.
    }
  }, [storageKey, overlay, dateFrom, dateTo]);

  const visibleProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return activeExecutive.projects.filter((project) => {
      return (
        normalizedSearch.length === 0 ||
        project.title.toLocaleLowerCase(locale).includes(normalizedSearch)
      );
    });
  }, [
    activeExecutive.projects,
    locale,
    search,
  ]);

  const route = `${base}/process-intelligence`;

  function resetView() {
    setOverlay("process");
    setTableView(false);
    setTechnicalView(false);
    setSelectedProjectId(null);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Optional presentation state.
    }
  }

  return (
    <div className="space-y-4 bg-slate-50/40 text-slate-950">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {tt(
                  "Executive Portfolio Flow",
                  "Flujo Ejecutivo del Portafolio",
                )}
              </h1>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                Beta
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              {tt(
                `A ten-second executive view of how ${organizationName} is moving, where pressure is accumulating and what requires action.`,
                `Una lectura ejecutiva en diez segundos de cómo avanza ${organizationName}, dónde se concentra la presión y qué requiere acción.`,
              )}
            </p>
            <div className="mt-3 inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 p-1 text-xs font-semibold">
              <Link
                href={base || "/"}
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-white hover:text-slate-950"
              >
                {tt("Current Dashboard", "Dashboard Actual")}
              </Link>
              <span
                aria-current="page"
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-white"
              >
                Process Intelligence Beta
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTechnicalView(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {tt(
                "Advanced · Technical Events",
                "Avanzado · Eventos técnicos",
              )}
            </button>
            <button
              type="button"
              onClick={resetView}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              {tt("Reset View", "Restablecer vista")}
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label={tt("Scope breadcrumbs", "Ruta de alcance")}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
      >
        <Link
          href={route}
          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
        >
          <Home className="h-4 w-4" />
          Global PMO
        </Link>
        <ChevronRight className="h-4 w-4 text-slate-400" />
        <span className="text-slate-600">
          {tt("All portfolios", "Todos los portafolios")}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400" />
        <span className="text-slate-600">
          {tt("All programs", "Todos los programas")}
        </span>
        {focusProject ? (
          <>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-950">
              {focusProject.title}
            </span>
          </>
        ) : null}
        {focusMode ? (
          <Link
            href={route}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tt("Back to Organization", "Volver a la organización")}
          </Link>
        ) : null}
      </nav>

      <section
        aria-label={tt("Portfolio filters", "Filtros del portafolio")}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]"
      >
        <label className="relative">
          <span className="sr-only">{tt("Global Search", "Búsqueda global")}</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tt(
              "Search projects…",
              "Buscar proyectos…",
            )}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <select
          aria-label={tt("Portfolio", "Portafolio")}
          disabled
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
        >
          <option>{tt("All portfolios", "Todos los portafolios")}</option>
        </select>
        <select
          aria-label={tt("Program", "Programa")}
          disabled
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
        >
          <option>{tt("All programs", "Todos los programas")}</option>
        </select>
        <select
          aria-label={tt("Project", "Proyecto")}
          value={selectedProjectId ?? ""}
          onChange={(event) =>
            setSelectedProjectId(event.target.value || null)
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">{tt("All projects", "Todos los proyectos")}</option>
          {organizationExecutive.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label={tt("From date", "Fecha desde")}
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          aria-label={tt("To date", "Fecha hasta")}
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </section>

      {truncated ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tt(
            "The event window reached 20,000 records. The dashboard remains usable, but older history is not included.",
            "La ventana alcanzó 20.000 eventos. El dashboard sigue disponible, pero la historia más antigua no está incluida.",
          )}
        </p>
      ) : null}

      {technicalView ? (
        activeTechnical ? (
          <TechnicalEventExplorer
            model={activeTechnical}
            locale={locale}
            tableView={tableView}
            onToggleTable={() => setTableView((current) => !current)}
            onBack={() => setTechnicalView(false)}
          />
        ) : (
          <EmptyState
            text={tt(
              "No technical event projection is available.",
              "No hay una proyección técnica de eventos disponible.",
            )}
          />
        )
      ) : (
        <>
          <div
            role="tablist"
            aria-label={tt("Analytical overlays", "Capas analíticas")}
            className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2"
          >
            {OVERLAYS.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={overlay === item.key}
                onClick={() => {
                  setOverlay(item.key);
                  setTableView(false);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold ${
                  overlay === item.key
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-600 hover:text-slate-950"
                }`}
              >
                {item.icon}
                {tt(item.en, item.es)}
              </button>
            ))}
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <main
              aria-label={tt(
                "Process Intelligence executive view",
                "Vista ejecutiva de Process Intelligence",
              )}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2 sm:p-5"
            >
              {loadFailed ? (
                <EmptyState
                  text={tt(
                    "The executive projection could not be loaded. No partial analytical data was displayed.",
                    "La proyección ejecutiva no pudo cargarse. No se mostraron datos analíticos parciales.",
                  )}
                />
              ) : overlay !== "whatif" && tableView ? (
                <ExecutiveTable
                  projects={visibleProjects}
                  locale={locale}
                  onSelectProject={setSelectedProjectId}
                />
              ) : overlay !== "whatif" ? (
                <>
                  <ProcessIntelligenceCanvas
                    locale={locale}
                    base={base}
                    route={route}
                    organizationId={organizationId}
                    userId={userId}
                    organizationName={organizationName}
                    executiveModel={activeExecutive}
                    hierarchy={hierarchy}
                    layer={overlay}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    search={search}
                    projectFilterIds={[]}
                    focusProjectId={
                      focusMode
                        ? focusProject?.id ?? null
                        : selectedProjectId
                    }
                    onOpenTechnicalEvents={() => setTechnicalView(true)}
                  />
                  {overlay !== "process" ? (
                    <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                        {tt(
                          "Open analytical detail for this overlay",
                          "Abrir detalle analítico de esta capa",
                        )}
                      </summary>
                      <div className="border-t border-slate-200 bg-white p-4">
                        {overlay === "finance" && finance ? (
                          <FinanceOverlay
                            model={finance}
                            projectNames={projectNames}
                            locale={locale}
                          />
                        ) : overlay === "risk" && overlays ? (
                          <RiskPanel
                            overlay={overlays.risk}
                            projectNames={projectNames}
                            locale={locale}
                          />
                        ) : overlay === "resources" && overlays ? (
                          <ResourcesPanel
                            capacity={overlays.capacity}
                            projectNames={projectNames}
                            locale={locale}
                          />
                        ) : overlay === "dependencies" && overlays ? (
                          <DependenciesPanel
                            overlay={overlays.dependencies}
                            projectNames={projectNames}
                            locale={locale}
                          />
                        ) : overlay === "benefits" ? (
                          <BenefitsPanel locale={locale} />
                        ) : (
                          <EmptyState
                            text={tt(
                              "No detail is available for this analytical layer.",
                              "No hay detalle disponible para esta capa analítica.",
                            )}
                          />
                        )}
                      </div>
                    </details>
                  ) : null}
                </>
              ) : overlay === "whatif" ? (
                <WhatIfPanel
                  inputs={{
                    financeRows: finance?.rows ?? [],
                    criticalRiskCount:
                      overlays?.risk.criticalOpenCount ?? 0,
                    systemicRisks: overlays?.risk.systemic ?? [],
                    capacity: overlays?.capacity ?? [],
                  } satisfies WhatIfInputs}
                  projectNames={projectNames}
                  locale={locale}
                />
              ) : (
                <EmptyState
                  text={tt(
                    "No data is available for this analytical layer.",
                    "No hay datos disponibles para esta capa analítica.",
                  )}
                />
              )}

              {overlay !== "whatif" ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <p className="text-xs text-slate-600">
                    {visibleProjects.length}{" "}
                    {tt("projects in the current view", "proyectos en la vista actual")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTableView((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {tableView ? (
                      <Network className="h-4 w-4" />
                    ) : (
                      <LayoutList className="h-4 w-4" />
                    )}
                    {tableView
                      ? tt("Executive flow", "Flujo ejecutivo")
                      : tt("Accessible table", "Tabla accesible")}
                  </button>
                </div>
              ) : null}
            </main>

            <IsabellaPanel
              insights={insights}
              locale={locale}
              scopeLabel={
                focusProject
                  ? focusProject.title
                  : tt("Organization", "Organización")
              }
              onOpenInMap={() => {
                setOverlay("process");
                setTableView(false);
                setTechnicalView(false);
              }}
              onSimulate={() => setOverlay("whatif")}
            />
          </div>
        </>
      )}

      <div className="flex justify-end">
        <RealtimeRefresh
          focusProjectId={focusMode ? focusProject?.id ?? null : null}
          locale={locale}
        />
      </div>

    </div>
  );
}

function ExecutiveTable({
  projects,
  locale,
  onSelectProject,
}: {
  projects: PmoPiExecutiveProject[];
  locale: "en" | "es";
  onSelectProject: (projectId: string) => void;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  return (
    <div className="overflow-x-auto">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-950">
          {tt("Projects in scope", "Proyectos en alcance")}
        </h2>
        <p className="text-sm text-slate-600">
          {tt(
            "Keyboard-accessible fallback with the same executive facts.",
            "Fallback accesible por teclado con los mismos datos ejecutivos.",
          )}
        </p>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2">{tt("Project", "Proyecto")}</th>
            <th className="px-3 py-2">{tt("Stage", "Etapa")}</th>
            <th className="px-3 py-2">{tt("Health", "Salud")}</th>
            <th className="px-3 py-2">EAC</th>
            <th className="px-3 py-2">{tt("Critical risks", "Riesgos críticos")}</th>
            <th className="px-3 py-2">{tt("Resources", "Recursos")}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-t border-slate-200">
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  {project.title}
                </button>
              </td>
              <td className="px-3 py-2 text-slate-700">
                {executiveStageLabel(project.currentStage, locale)}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {project.healthScore}/100
              </td>
              <td className="px-3 py-2 text-slate-700">
                {project.eac == null
                  ? "—"
                  : new Intl.NumberFormat(
                      locale === "es" ? "es-US" : "en-US",
                      {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      },
                    ).format(project.eac)}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {project.criticalRisks}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {project.overallocatedResources}
              </td>
            </tr>
          ))}
          {projects.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-3 py-10 text-center text-sm text-slate-500"
              >
                {tt(
                  "No projects match the current filters.",
                  "Ningún proyecto coincide con los filtros actuales.",
                )}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="max-w-lg text-sm text-slate-600">{text}</p>
    </div>
  );
}
