"use client";

// ============================================================================
// PMO Process Intelligence — Finance overlay / Budget Command Center (M5)
// ============================================================================
// Executive financial table + explainable alerts over the pure overlay
// model. Every alert shows its formula, observed values, status date and
// source; severity is expressed in text AND icon, never color alone.
// Actuals, commitments and accruals are separate columns by design.
// ============================================================================

import { AlertTriangle, Ban, Info } from "lucide-react";
import type { PmoPiFinanceOverlayModel, PmoPiFinancialAlert } from "@/lib/pmo-process-intelligence/financial-overlay";

const RULE_LABEL: Record<PmoPiFinancialAlert["rule"], { en: string; es: string }> = {
  cpi_below_threshold: { en: "Cost efficiency below threshold", es: "Eficiencia de costo bajo el umbral" },
  spi_below_threshold: { en: "Schedule efficiency below threshold", es: "Eficiencia de cronograma bajo el umbral" },
  eac_exceeds_baseline: { en: "Forecast exceeds baseline (VAC < 0)", es: "Pronóstico excede la baseline (VAC < 0)" },
  reconciliation_exceptions: { en: "Reconciliation exceptions open", es: "Excepciones de conciliación abiertas" },
  unverified_actuals: { en: "Unverified actual costs", es: "Costos reales sin verificar" },
  currency_mismatches: { en: "Currency mismatches", es: "Inconsistencias de moneda" },
};

const SEVERITY_LABEL: Record<PmoPiFinancialAlert["severity"], { en: string; es: string }> = {
  critical: { en: "Critical", es: "Crítico" },
  warning: { en: "Warning", es: "Advertencia" },
  info: { en: "Info", es: "Info" },
};

export function FinanceOverlay({
  model,
  projectNames,
  locale,
}: {
  model: PmoPiFinanceOverlayModel;
  projectNames: Record<string, string>;
  locale: "en" | "es";
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const money = (v: number | null, currency: string): string =>
    v == null ? "—" : new Intl.NumberFormat(locale === "es" ? "es" : "en", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const idx = (v: number | null): string => (v == null ? "—" : v.toFixed(2));

  if (model.rows.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          {tt(
            "No project in scope has financial control data yet. The Budget Command Center activates when a financial baseline exists.",
            "Ningún proyecto en alcance tiene datos de control financiero todavía. El Budget Command Center se activa cuando existe una baseline financiera.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Budget Command Center table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">{tt("Project", "Proyecto")}</th>
              <th className="px-3 py-2">{tt("Baseline", "Baseline")}</th>
              <th className="px-3 py-2">{tt("Committed", "Comprometido")}</th>
              <th className="px-3 py-2">{tt("Actual", "Real")}</th>
              <th className="px-3 py-2">{tt("Accrued", "Devengado")}</th>
              <th className="px-3 py-2">{tt("Reserve", "Reserva")}</th>
              <th className="px-3 py-2">EAC</th>
              <th className="px-3 py-2">P50 / P80</th>
              <th className="px-3 py-2">CPI</th>
              <th className="px-3 py-2">SPI</th>
              <th className="px-3 py-2">TCPI</th>
              <th className="px-3 py-2">VAC</th>
              <th className="px-3 py-2">{tt("Status date", "Fecha de corte")}</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((r) => (
              <tr key={r.projectId} className="border-b border-border last:border-0">
                <td className="max-w-[180px] truncate px-3 py-2 font-medium text-foreground" title={projectNames[r.projectId] ?? r.projectId}>
                  {projectNames[r.projectId] ?? r.projectId}
                </td>
                <td className="px-3 py-2">{money(r.baseline, r.currency)}</td>
                <td className="px-3 py-2">{money(r.currentCommitment, r.currency)}</td>
                <td className="px-3 py-2">{money(r.actualCost, r.currency)}</td>
                <td className="px-3 py-2">{money(r.openAccrual, r.currency)}</td>
                <td className="px-3 py-2">{money(r.remainingReserve, r.currency)}</td>
                <td className="px-3 py-2">{money(r.latestEac, r.currency)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {money(r.p50Eac, r.currency)} / {money(r.p80Eac, r.currency)}
                </td>
                <td className="px-3 py-2">{idx(r.cpi)}</td>
                <td className="px-3 py-2">{idx(r.spi)}</td>
                <td className="px-3 py-2">{idx(r.tcpi)}</td>
                <td className={`px-3 py-2 ${r.vac != null && r.vac < 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                  {money(r.vac, r.currency)}
                  {r.vac != null && r.vac < 0 ? ` (${tt("overrun", "sobrecosto")})` : ""}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.dataDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {tt(
          "Committed, actual and accrued are separate exposure components and are never summed. EV is derived as CPI × AC (declared assumption). Source: financial_project_cockpit.",
          "Comprometido, real y devengado son componentes de exposición separados y nunca se suman. EV se deriva como CPI × AC (supuesto declarado). Fuente: financial_project_cockpit.",
        )}
      </p>

      {/* ── Explainable alerts ── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tt("Financial alerts", "Alertas financieras")} ({model.alerts.length})
        </h3>
        {model.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tt("No rule is currently triggered.", "Ninguna regla está activada actualmente.")}
          </p>
        ) : (
          model.alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                a.severity === "critical"
                  ? "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
                  : a.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              {a.severity === "critical" ? <Ban className="mt-0.5 h-4 w-4 shrink-0" /> : a.severity === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium">
                  [{SEVERITY_LABEL[a.severity][locale]}] {RULE_LABEL[a.rule][locale]} — {projectNames[a.projectId] ?? a.projectId}
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  {a.formula} · {Object.entries(a.observed).map(([k, v]) => `${k}=${typeof v === "number" ? Math.round(v * 100) / 100 : v ?? "—"}`).join(" · ")}
                </p>
                <p className="text-[10px] opacity-70">
                  {tt("Status date", "Fecha de corte")}: {a.statusDate ?? "—"} · {tt("Source", "Fuente")}: {a.source}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
