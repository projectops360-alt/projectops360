"use client";

// ============================================================================
// PMO Process Intelligence Command Center — responsive shell (CAP-047 · M3)
// ============================================================================
// Visual foundation only: executive header + one-click return switcher, KPI
// bar, overlay tabs, dominant central canvas region, Isabella panel and a
// tabular fallback. Every region renders HONEST states — with no adapters
// wired yet (they arrive in M4/M5/M8) all metrics declare themselves
// unavailable instead of inventing numbers. Data-first and motion-free by
// design (reduced-motion safe); status is never communicated by color alone.
// ============================================================================

import { useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, Banknote, GitBranch, Landmark, LayoutList,
  Network, ShieldAlert, Sparkles, Table2, Target, Users,
} from "lucide-react";
import type { PmoPiFilters } from "@/lib/pmo-process-intelligence/contracts";

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

const KPIS: { key: string; en: string; es: string }[] = [
  { key: "portfolio_health", en: "Portfolio Health", es: "Salud del Portafolio" },
  { key: "dominant_path_share", en: "Dominant Path", es: "Ruta Dominante" },
  { key: "rework_rate", en: "Rework", es: "Retrabajo" },
  { key: "bottlenecks", en: "Bottlenecks", es: "Cuellos de Botella" },
  { key: "cpi", en: "CPI", es: "CPI" },
  { key: "critical_risks", en: "Critical Risks", es: "Riesgos Críticos" },
];

export function CommandCenterShell({
  locale,
  base,
  organizationName,
  initialFilters,
}: {
  locale: "en" | "es";
  base: string;
  organizationName: string;
  initialFilters: PmoPiFilters;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const [overlay, setOverlay] = useState<OverlayKey>(initialFilters.overlay);
  const [tableView, setTableView] = useState(false);

  const noData = tt("Not available yet — no data adapter in scope.", "Aún no disponible — sin adaptador de datos en alcance.");

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

      {/* ── Executive KPI bar (honest unavailable states until adapters land) ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <div key={k.key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{tt(k.en, k.es)}</p>
            <p className="mt-1 text-2xl font-bold text-muted-foreground/50" aria-label={noData}>—</p>
            <p className="text-[11px] text-muted-foreground">{tt("no data in scope", "sin datos en alcance")}</p>
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
          className="min-h-[420px] rounded-2xl border border-border bg-card p-5"
        >
          {tableView ? (
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
                    <th className="px-3 py-2">{tt("Avg waiting", "Espera media")}</th>
                    <th className="px-3 py-2">{tt("Rework", "Retrabajo")}</th>
                    <th className="px-3 py-2">{tt("Bottleneck", "Cuello de botella")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      {noData}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-2 text-center">
              <Network className="h-10 w-10 text-muted-foreground/50" />
              <p className="max-w-md text-sm text-muted-foreground">
                {overlay === "process"
                  ? tt(
                      "The process map renders here once event data is in scope. No visual is ever decorated by hand.",
                      "El mapa de proceso se renderiza aquí cuando haya eventos en alcance. Ninguna visualización se decora a mano.",
                    )
                  : tt(
                      `The ${OVERLAYS.find((o) => o.key === overlay)?.en} overlay activates on top of the process map when its data adapter is in scope.`,
                      `La capa de ${OVERLAYS.find((o) => o.key === overlay)?.es} se activa sobre el mapa de proceso cuando su adaptador de datos esté en alcance.`,
                    )}
              </p>
            </div>
          )}
        </section>

        {/* Isabella Intelligence panel (recommendations arrive in M7 — until
            then the contract is stated instead of fabricated content) */}
        <aside
          aria-label="Isabella Intelligence"
          className="rounded-2xl border border-border bg-card p-5"
        >
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
