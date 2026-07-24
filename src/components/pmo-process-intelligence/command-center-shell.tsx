"use client";

// ============================================================================
// PMO Process Intelligence Command Center — responsive shell (CAP-047 · M3/M4)
// ============================================================================
// Executive header + one-click return switcher, KPI bar, overlay tabs,
// dominant central canvas (M4 Process Canvas) with drill-down breadcrumbs and
// tabular fallback, Isabella panel. Every region renders HONEST states: KPIs
// without a data source declare themselves unavailable instead of inventing
// numbers. Data-first and motion-free (reduced-motion safe); status is never
// communicated by color alone. Business truth comes exclusively from the
// PmoPiFlowModel contract — this component derives presentation only.
// ============================================================================

import { useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, Banknote, GitBranch, Landmark, LayoutList,
  Network, ShieldAlert, Sparkles, Table2, Target, Users,
} from "lucide-react";
import type { PmoPiFilters, PmoPiFlowModel } from "@/lib/pmo-process-intelligence/contracts";
import type { PmoPiFinanceOverlayModel } from "@/lib/pmo-process-intelligence/financial-overlay";
import { ProcessCanvas, activityLabel } from "./process-canvas";
import { FinanceOverlay } from "./finance-overlay";

type OverlayKey = PmoPiFilters["overlay"];

const OVERLAYS: { key: OverlayKey; icon: React.ReactNode; en: string; es: string }[] = [
  { key: "process", icon: <Network className="h-4 w-4" />, en: "Process", es: "Proceso" },
  { key: "risk", icon: <ShieldAlert className="h-4 w-4" />, en: "Risk", es: "Riesgo" },
  { key: "finance", icon: <Banknote className="h-4 w-4" />, en: "Finance", es: "Finanzas" },
  { key: "resources", icon: <Users className="h-4 w-4" />, en: "Resources", es: "Recursos" },
  { key: "dependencies", icon: <GitBranch className="h-4 w-4" />, en: "Dependencies", es: "Dependencias" },
  { key: "benefits", icon: <Target className="h-4 w-4" />, en: "Benefits", es: "Beneficios" },
  { key: "whatif", icon: <Activity className="h-4 w-4" />, en: "What-if", es: "What-if" },
];

/** Presentation-only KPI derivation from the flow model (no business logic). */
export function deriveKpis(model: PmoPiFlowModel | null): {
  dominantSharePct: number | null;
  reworkPct: number | null;
  bottleneckCount: number | null;
} {
  if (!model || model.nodes.length === 0) {
    return { dominantSharePct: null, reworkPct: null, bottleneckCount: null };
  }
  const top = [...model.variants.variants].sort((a, b) => b.caseCount - a.caseCount)[0] ?? null;
  const totalEdgeFreq = model.edges.reduce((s, e) => s + e.frequency, 0);
  const reworkFreq = model.edges.filter((e) => e.isRework).reduce((s, e) => s + e.frequency, 0);
  return {
    dominantSharePct: top ? Math.round(top.frequencyPct) : null,
    reworkPct: totalEdgeFreq > 0 ? Math.round((reworkFreq / totalEdgeFreq) * 100) : null,
    bottleneckCount: model.nodes.filter((n) => n.bottleneckScore >= 0.7).length,
  };
}

export function CommandCenterShell({
  locale,
  base,
  organizationName,
  initialFilters,
  model,
  loadFailed = false,
  truncated = false,
  projects = [],
  focusProject = null,
  finance = null,
  projectNames = {},
}: {
  locale: "en" | "es";
  base: string;
  organizationName: string;
  initialFilters: PmoPiFilters;
  model?: PmoPiFlowModel | null;
  loadFailed?: boolean;
  truncated?: boolean;
  projects?: { id: string; title: string }[];
  focusProject?: { id: string; title: string } | null;
  finance?: PmoPiFinanceOverlayModel | null;
  projectNames?: Record<string, string>;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const [overlay, setOverlay] = useState<OverlayKey>(initialFilters.overlay);
  const [tableView, setTableView] = useState(false);
  const flow = model ?? null;
  const kpis = deriveKpis(flow);

  const noData = tt("no data in scope", "sin datos en alcance");
  const route = `${base}/process-intelligence`;

  const kpiCards: { key: string; label: string; value: string | null; hint: string }[] = [
    { key: "portfolio_health", label: tt("Portfolio Health", "Salud del Portafolio"), value: null, hint: noData },
    { key: "dominant_path_share", label: tt("Dominant Path", "Ruta Dominante"), value: kpis.dominantSharePct != null ? `${kpis.dominantSharePct}%` : null, hint: tt("of cases follow it", "de los casos la siguen") },
    { key: "rework_rate", label: tt("Rework", "Retrabajo"), value: kpis.reworkPct != null ? `${kpis.reworkPct}%` : null, hint: tt("of transitions are returns", "de las transiciones son retornos") },
    { key: "bottlenecks", label: tt("Bottlenecks", "Cuellos de Botella"), value: kpis.bottleneckCount != null ? String(kpis.bottleneckCount) : null, hint: tt("calculated from waiting", "calculados desde esperas") },
    { key: "cpi", label: "CPI", value: finance?.portfolioCpi != null ? finance.portfolioCpi.toFixed(2) : null, hint: tt("portfolio ΣEV/ΣAC", "portafolio ΣEV/ΣAC") },
    { key: "critical_risks", label: tt("Critical Risks", "Riesgos Críticos"), value: null, hint: noData },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header + one-click return switcher ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Network className="h-6 w-6 text-brand-500" />
            {tt("PMO Process Intelligence", "PMO Process Intelligence")}
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Beta
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {tt(
              `How work actually flows across ${organizationName}: dominant paths, variants, rework, bottlenecks, budget and risk — every number backed by evidence.`,
              `Cómo fluye realmente el trabajo en ${organizationName}: rutas dominantes, variantes, retrabajo, cuellos de botella, presupuesto y riesgo — cada número con evidencia.`,
            )}
          </p>
          <div className="mt-2 inline-flex items-center rounded-lg border border-border p-0.5 text-xs font-medium">
            <Link
              href={base || "/"}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              {tt("Current Dashboard", "Dashboard Actual")}
            </Link>
            <span aria-current="page" className="rounded-md bg-muted px-2.5 py-1 text-foreground">
              {tt("Process Intelligence Beta", "Process Intelligence Beta")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTableView((v) => !v)}
          aria-pressed={tableView}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          {tableView ? <Network className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          {tableView ? tt("Map view", "Vista de mapa") : tt("Table view", "Vista de tabla")}
        </button>
      </div>

      {truncated && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {tt(
            "The event window was truncated at 20,000 events — oldest history is not included in this view.",
            "La ventana de eventos se truncó en 20,000 eventos — la historia más antigua no está incluida en esta vista.",
          )}
        </p>
      )}

      {/* ── Executive KPI bar ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((k) => (
          <div key={k.key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            {k.value != null ? (
              <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
            ) : (
              <p className="mt-1 text-2xl font-bold text-muted-foreground/50" aria-label={noData}>—</p>
            )}
            <p className="text-[11px] text-muted-foreground">{k.value != null ? k.hint : noData}</p>
          </div>
        ))}
      </section>

      {/* ── Overlay tabs ── */}
      <div role="tablist" aria-label={tt("Analytical overlays", "Capas analíticas")} className="flex flex-wrap gap-1 border-b border-border">
        {OVERLAYS.map((o) => (
          <button
            key={o.key}
            role="tab"
            aria-selected={overlay === o.key}
            onClick={() => setOverlay(o.key)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              overlay === o.key
                ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.icon}
            {tt(o.en, o.es)}
          </button>
        ))}
      </div>

      {/* ── Main region: dominant canvas + Isabella panel ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section
          aria-label={tt("Process Intelligence Canvas", "Canvas de Process Intelligence")}
          className="min-h-[460px] rounded-2xl border border-border bg-card p-5"
        >
          {/* Drill-down breadcrumbs: organization → project (filters preserved
              by re-loading the same route with ?project=) */}
          <nav aria-label={tt("Drill-down", "Navegación de detalle")} className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            {focusProject ? (
              <>
                <Link href={route} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                  {organizationName}
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium text-foreground">{focusProject.title}</span>
                <span className="text-muted-foreground">
                  · {tt("cases = object journeys", "casos = recorridos de objetos")}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{organizationName}</span>
                <span className="text-muted-foreground">
                  · {tt("cases = project journeys", "casos = recorridos de proyectos")}
                </span>
                {projects.length > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
                    {tt("Drill into", "Ver detalle de")}
                    <DrillSelect route={route} projects={projects} placeholder={tt("project…", "proyecto…")} />
                  </span>
                )}
              </>
            )}
          </nav>

          {loadFailed ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                {tt(
                  "The process projection could not be loaded. No partial data was displayed.",
                  "La proyección de proceso no pudo cargarse. No se mostraron datos parciales.",
                )}
              </p>
            </div>
          ) : overlay === "finance" ? (
            finance ? (
              <FinanceOverlay model={finance} projectNames={projectNames} locale={locale} />
            ) : (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
                <p className="max-w-md text-sm text-muted-foreground">{noData}</p>
              </div>
            )
          ) : overlay !== "process" ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                {tt(
                  `The ${OVERLAYS.find((o) => o.key === overlay)?.en} overlay activates on top of the process map when its data adapter is in scope.`,
                  `La capa de ${OVERLAYS.find((o) => o.key === overlay)?.es} se activa sobre el mapa de proceso cuando su adaptador de datos esté en alcance.`,
                )}
              </p>
            </div>
          ) : tableView ? (
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <LayoutList className="h-4 w-4" />
                {tt("Tabular view", "Vista tabular")}
              </h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">{tt("Activity", "Actividad")}</th>
                    <th className="px-3 py-2">{tt("Frequency", "Frecuencia")}</th>
                    <th className="px-3 py-2">{tt("Cases", "Casos")}</th>
                    <th className="px-3 py-2">{tt("Rework", "Retrabajo")}</th>
                    <th className="px-3 py-2">{tt("Bottleneck score", "Cuello de botella")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!flow || flow.nodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">{noData}</td>
                    </tr>
                  ) : (
                    flow.nodes.map((n) => (
                      <tr key={n.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{activityLabel(n.activity)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{n.frequency}×</td>
                        <td className="px-3 py-2 text-muted-foreground">{n.caseCount}</td>
                        <td className="px-3 py-2 text-muted-foreground">{n.reworkOccurrences > 0 ? `↩ ×${n.reworkOccurrences}` : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{n.bottleneckScore.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : flow ? (
            <ProcessCanvas model={flow} locale={locale} />
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
              <Network className="h-10 w-10 text-muted-foreground/50" />
              <p className="max-w-md text-sm text-muted-foreground">{noData}</p>
            </div>
          )}
        </section>

        {/* Isabella Intelligence panel (recommendations arrive in M7 — until
            then the contract is stated instead of fabricated content) */}
        <aside aria-label="Isabella Intelligence" className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Isabella Intelligence
          </h2>
          <div className="mt-4 flex flex-col items-center gap-2 py-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground/50" />
            <p className="max-w-[240px] text-sm text-muted-foreground">
              {tt(
                "Recommendations appear here only with linked evidence, confidence and limitations — never without.",
                "Las recomendaciones aparecen aquí solo con evidencia vinculada, confianza y limitaciones — nunca sin ellas.",
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Client-side project drill-down selector (navigates with ?project=). */
function DrillSelect({ route, projects, placeholder }: { route: string; projects: { id: string; title: string }[]; placeholder: string }) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) window.location.assign(`${route}?project=${e.target.value}`);
      }}
      className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
    >
      <option value="">{placeholder}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.title}</option>
      ))}
    </select>
  );
}
