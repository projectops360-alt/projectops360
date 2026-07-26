"use client";

// ============================================================================
// PMO Intelligence Center — what-if controls (CAP-048 Phase 2, gap 9)
// ============================================================================
// `simulateWhatIf` existed, was tested, and was never called from anywhere in
// Dashboard 3 — a complete simulator with no way to reach it. These are the
// three inputs it accepts, and nothing more:
//
//   budgetDeltaByProject  — applied to every project in scope, uniformly
//   excludedRiskIds       — risks assumed mitigated
//   availabilityDeltaPct  — percentage points added to workforce availability
//
// The result is labelled NON-PERSISTENT everywhere it appears. That is not a
// disclaimer, it is the contract: `simulateWhatIf` is pure and writes nothing,
// and a PMO who believes a scenario was saved will make a decision on a number
// that no longer exists after a refresh.
//
// `capacity` is passed as an array by construction (`toDashboardSlice` always
// produces one). The simulator calls `.filter()` on it without a guard, so a
// null would throw inside the engine rather than produce an empty scenario.
// ============================================================================

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FlaskConical, RotateCcw } from "lucide-react";
import { simulateWhatIf, type WhatIfResult } from "@/lib/pmo-process-intelligence/whatif";
import type { PmoDashboardSlice } from "@/lib/pmo-intelligence/dashboard-model";
import type { PmoPiFinanceRow } from "@/lib/pmo-process-intelligence/financial-overlay";
import type { PmoPiCapacityProjectSummary, PmoPiSystemicRisk } from "@/lib/pmo-process-intelligence/overlays";

export interface PmoWhatIfPanelProps {
  whatIf: PmoDashboardSlice["whatIf"];
  locale: "en" | "es";
}

export function PmoWhatIfPanel({ whatIf, locale }: PmoWhatIfPanelProps) {
  const t = useTranslations("pmoIntelligence");
  const [budgetDelta, setBudgetDelta] = useState(0);
  const [availabilityDelta, setAvailabilityDelta] = useState(0);
  const [mitigateRisks, setMitigateRisks] = useState(false);

  const result = useMemo<WhatIfResult | null>(() => {
    if (whatIf.financeRows.length === 0 && whatIf.capacity.length === 0) return null;

    // The delta is applied uniformly across projects in scope. Per-project
    // deltas are what the scenario type supports, but a per-project editor for
    // a portfolio of 40 projects is a spreadsheet, not a dashboard control —
    // and the uniform case is the question a PMO actually asks first.
    const budgetDeltaByProject: Record<string, number> = {};
    if (budgetDelta !== 0) {
      for (const row of whatIf.financeRows) budgetDeltaByProject[row.projectId] = budgetDelta;
    }

    return simulateWhatIf(
      {
        // The slice carries only the fields the simulator reads; the casts
        // narrow to that contract rather than reconstructing rows it ignores.
        financeRows: whatIf.financeRows as unknown as readonly PmoPiFinanceRow[],
        criticalRiskCount: whatIf.criticalRiskCount,
        systemicRisks: whatIf.systemicRisks as unknown as readonly PmoPiSystemicRisk[],
        capacity: whatIf.capacity as unknown as readonly PmoPiCapacityProjectSummary[],
      },
      {
        budgetDeltaByProject,
        excludedRiskIds: mitigateRisks ? whatIf.systemicRisks.map((risk) => risk.riskId) : [],
        availabilityDeltaPct: availabilityDelta,
      },
    );
  }, [whatIf, budgetDelta, availabilityDelta, mitigateRisks]);

  const intl = locale === "es" ? "es-ES" : "en-US";
  const money = (value: number) =>
    value.toLocaleString(intl, { maximumFractionDigits: 0 });

  const untouched = budgetDelta === 0 && availabilityDelta === 0 && !mitigateRisks;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        <FlaskConical className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        {t("whatIfTitle")}
      </h2>

      {/* Stated before the controls, not after the result. */}
      <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
        {t("whatIfNotPersisted")}
      </p>

      {result == null ? (
        <p className="mt-2 text-xs text-slate-500">{t("whatIfNoInputs")}</p>
      ) : (
        <>
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-[10px] font-bold text-slate-600">
                {t("whatIfBudgetDelta")}
              </span>
              <input
                type="number"
                step={1000}
                value={budgetDelta}
                onChange={(event) => setBudgetDelta(Number(event.target.value) || 0)}
                className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-800"
              />
              <span className="text-[9px] text-slate-500">{t("whatIfBudgetDeltaHint")}</span>
            </label>

            <label className="block">
              <span className="text-[10px] font-bold text-slate-600">
                {t("whatIfAvailabilityDelta", { value: availabilityDelta })}
              </span>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={availabilityDelta}
                onChange={(event) => setAvailabilityDelta(Number(event.target.value))}
                className="mt-0.5 w-full"
              />
            </label>

            <label className="flex items-start gap-1.5">
              <input
                type="checkbox"
                checked={mitigateRisks}
                onChange={(event) => setMitigateRisks(event.target.checked)}
                className="mt-0.5 h-3 w-3 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-[10px] font-semibold text-slate-700">
                {t("whatIfMitigateRisks", { count: whatIf.systemicRisks.length })}
              </span>
            </label>

            {!untouched ? (
              <button
                type="button"
                onClick={() => {
                  setBudgetDelta(0);
                  setAvailabilityDelta(0);
                  setMitigateRisks(false);
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-2.5 w-2.5" aria-hidden />
                {t("whatIfReset")}
              </button>
            ) : null}
          </div>

          {/* Current and simulated side by side, both labelled. A single
              "after" column with no "before" invites reading the scenario as
              the state of the portfolio. */}
          <table className="mt-2 w-full text-[10px]">
            <thead>
              <tr className="text-slate-500">
                <th scope="col" className="text-left font-bold">
                  {t("whatIfMetric")}
                </th>
                <th scope="col" className="text-right font-bold">
                  {t("whatIfCurrent")}
                </th>
                <th scope="col" className="text-right font-bold">
                  {t("whatIfSimulated")}
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              <ScenarioRow
                label={t("whatIfBaseline")}
                current={money(result.current.totalBaseline)}
                simulated={money(result.simulated.totalBaseline)}
              />
              <ScenarioRow
                label={t("whatIfEac")}
                current={money(result.current.totalEac)}
                simulated={money(result.simulated.totalEac)}
              />
              <ScenarioRow
                label={t("whatIfVac")}
                current={money(result.current.totalVac)}
                simulated={money(result.simulated.totalVac)}
              />
              <ScenarioRow
                label={t("whatIfCriticalRisks")}
                current={String(result.current.criticalRiskCount)}
                simulated={String(result.simulated.criticalRiskCount)}
              />
              <ScenarioRow
                label={t("whatIfSystemicRisks")}
                current={String(result.current.systemicRiskCount)}
                simulated={String(result.simulated.systemicRiskCount)}
              />
              <ScenarioRow
                label={t("whatIfAvailability")}
                current={
                  result.current.avgAvailabilityPct == null
                    ? t("whatIfNoValue")
                    : `${Math.round(result.current.avgAvailabilityPct)}%`
                }
                simulated={
                  result.simulated.avgAvailabilityPct == null
                    ? t("whatIfNoValue")
                    : `${Math.round(result.simulated.avgAvailabilityPct)}%`
                }
              />
            </tbody>
          </table>

          {/* The engine's own assumptions and limitations, as it stated them. */}
          <p className="mt-1.5 text-[9px] text-slate-500">
            <span className="font-bold">{t("whatIfAssumptions")}:</span>{" "}
            {result.assumptions.join(", ")}
          </p>
          <p className="text-[9px] text-slate-500">
            <span className="font-bold">{t("whatIfLimitations")}:</span>{" "}
            {result.limitations.join(", ")}
          </p>
        </>
      )}
    </section>
  );
}

function ScenarioRow({
  label,
  current,
  simulated,
}: {
  label: string;
  current: string;
  simulated: string;
}) {
  const changed = current !== simulated;
  return (
    <tr>
      <th scope="row" className="py-0.5 text-left font-semibold text-slate-600">
        {label}
      </th>
      <td className="py-0.5 text-right tabular-nums">{current}</td>
      <td
        className={`py-0.5 text-right tabular-nums ${
          changed ? "font-bold text-emerald-700" : "text-slate-400"
        }`}
      >
        {simulated}
      </td>
    </tr>
  );
}
