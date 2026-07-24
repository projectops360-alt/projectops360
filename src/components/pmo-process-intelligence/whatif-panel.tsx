"use client";

// ============================================================================
// PMO Process Intelligence — What-if panel (CAP-047 · M7)
// ============================================================================
// Non-persistent scenario UI over the pure simulateWhatIf engine. Simulated
// values are visually AND textually separated from real data ("SIMULATED"
// banner + column label); nothing here calls the server or persists —
// applying a decision requires the normal permissioned flows.
// ============================================================================

import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import {
  EMPTY_SCENARIO,
  simulateWhatIf,
  type WhatIfInputs,
  type WhatIfScenario,
} from "@/lib/pmo-process-intelligence/whatif";

export function WhatIfPanel({
  inputs,
  projectNames,
  locale,
}: {
  inputs: WhatIfInputs;
  projectNames: Record<string, string>;
  locale: "en" | "es";
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const [scenario, setScenario] = useState<WhatIfScenario>(EMPTY_SCENARIO);
  const result = useMemo(() => simulateWhatIf(inputs, scenario), [inputs, scenario]);

  const money = (v: number): string =>
    new Intl.NumberFormat(locale === "es" ? "es" : "en", { maximumFractionDigits: 0 }).format(v);
  const changed = JSON.stringify(scenario) !== JSON.stringify(EMPTY_SCENARIO);

  if (inputs.financeRows.length === 0 && inputs.systemicRisks.length === 0 && inputs.capacity.length === 0) {
    return (
      <p className="px-2 py-16 text-center text-sm text-muted-foreground">
        {tt(
          "What-if needs at least one project with financial, risk or capacity data in scope.",
          "What-if necesita al menos un proyecto con datos financieros, de riesgo o de capacidad en alcance.",
        )}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-900 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-200">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {tt(
            "SIMULATED layer — nothing here changes real data. Applying a decision requires the normal permissioned change flows.",
            "Capa SIMULADA — nada de esto cambia datos reales. Aplicar una decisión requiere los flujos de cambio normales con permisos.",
          )}
        </p>
      </div>

      {/* ── Scenario controls ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("Budget delta per project", "Delta de presupuesto por proyecto")}
          </h3>
          <div className="mt-2 space-y-2">
            {inputs.financeRows.map((r) => (
              <label key={r.projectId} className="flex items-center justify-between gap-2 text-xs">
                <span className="max-w-[140px] truncate text-muted-foreground">{projectNames[r.projectId] ?? r.projectId}</span>
                <input
                  type="number"
                  step={1000}
                  value={scenario.budgetDeltaByProject[r.projectId] ?? 0}
                  onChange={(e) =>
                    setScenario((s) => ({
                      ...s,
                      budgetDeltaByProject: { ...s.budgetDeltaByProject, [r.projectId]: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-28 rounded-md border border-border bg-background px-2 py-1 text-right"
                />
              </label>
            ))}
            {inputs.financeRows.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("Assume risks mitigated", "Asumir riesgos mitigados")}
          </h3>
          <div className="mt-2 space-y-1.5">
            {inputs.systemicRisks.map((r) => (
              <label key={r.riskId} className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={scenario.excludedRiskIds.includes(r.riskId)}
                  onChange={(e) =>
                    setScenario((s) => ({
                      ...s,
                      excludedRiskIds: e.target.checked
                        ? [...s.excludedRiskIds, r.riskId]
                        : s.excludedRiskIds.filter((id) => id !== r.riskId),
                    }))
                  }
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-brand-600"
                />
                <span>[{r.severity}] {r.title}</span>
              </label>
            ))}
            {inputs.systemicRisks.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("Availability delta", "Delta de disponibilidad")}
          </h3>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="range"
              min={-30}
              max={30}
              step={5}
              value={scenario.availabilityDeltaPct}
              onChange={(e) => setScenario((s) => ({ ...s, availabilityDeltaPct: Number(e.target.value) }))}
              className="w-full accent-brand-600"
            />
            <span className="w-12 text-right font-medium text-foreground">
              {scenario.availabilityDeltaPct > 0 ? "+" : ""}{scenario.availabilityDeltaPct}%
            </span>
          </label>
          <button
            type="button"
            onClick={() => setScenario(EMPTY_SCENARIO)}
            disabled={!changed}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            {tt("Reset scenario", "Restablecer escenario")}
          </button>
        </div>
      </div>

      {/* ── Current vs Simulated ── */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2">{tt("Metric", "Métrica")}</th>
            <th className="px-3 py-2">{tt("Current state", "Estado actual")}</th>
            <th className="px-3 py-2 text-purple-700 dark:text-purple-300">{tt("Simulated state", "Estado simulado")}</th>
          </tr>
        </thead>
        <tbody>
          {[
            { k: tt("Total baseline", "Baseline total"), c: money(result.current.totalBaseline), s: money(result.simulated.totalBaseline) },
            { k: "EAC", c: money(result.current.totalEac), s: money(result.simulated.totalEac) },
            { k: "VAC", c: money(result.current.totalVac), s: money(result.simulated.totalVac) },
            { k: tt("Critical risks", "Riesgos críticos"), c: String(result.current.criticalRiskCount), s: String(result.simulated.criticalRiskCount) },
            { k: tt("Systemic risks", "Riesgos sistémicos"), c: String(result.current.systemicRiskCount), s: String(result.simulated.systemicRiskCount) },
            { k: tt("Avg availability", "Disponibilidad media"), c: result.current.avgAvailabilityPct != null ? `${Math.round(result.current.avgAvailabilityPct)}%` : "—", s: result.simulated.avgAvailabilityPct != null ? `${Math.round(result.simulated.avgAvailabilityPct)}%` : "—" },
          ].map((row) => (
            <tr key={row.k} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium text-foreground">{row.k}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.c}</td>
              <td className={`px-3 py-2 ${row.c !== row.s ? "font-semibold text-purple-700 dark:text-purple-300" : "text-muted-foreground"}`}>
                {row.s}{row.c !== row.s ? ` (${tt("simulated", "simulado")})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] text-muted-foreground">
        {tt("Assumptions", "Supuestos")}: {result.assumptions.join(", ")} · {tt("Limitations", "Limitaciones")}: {result.limitations.join(", ")}
      </p>
    </div>
  );
}
