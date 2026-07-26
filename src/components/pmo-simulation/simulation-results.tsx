"use client";

// ============================================================================
// PMO Simulation — results table (CAP-049 §6)
// ============================================================================
// Renders what `buildResultRows` returns and decides nothing. Every value is
// already formatted in its own unit by the pure layer, so this component cannot
// accidentally print days through a currency formatter.
//
// Two things are shown that a prettier table would hide, and both are the point
// of the feature: a value that is a user assumption or a derived proxy carries a
// visible badge, and a metric with no data says "unavailable" instead of
// rendering a zero.
// ============================================================================

import { useTranslations } from "next-intl";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";
import type { SimResult } from "@/lib/pmo-simulation/contracts";
import {
  buildResultRows,
  type DeltaTone,
  type ResultRow,
} from "@/lib/pmo-simulation/presentation";
import { AcronymTerm } from "@/components/acronyms/acronym-term";
import { definitionIdForMetric } from "@/lib/acronyms/metric-definitions";
import type { AcronymContext } from "@/lib/acronyms/contracts";

const TONE_CLASS: Record<DeltaTone, string> = {
  improved: "text-emerald-700",
  worsened: "text-red-700",
  neutral: "text-slate-700",
  unknown: "text-slate-400",
};

export function SimulationResults({
  result,
  locale,
  onSelectMetric,
  selectedMetricKey,
}: {
  result: SimResult;
  locale: string;
  onSelectMetric?: (key: string | null) => void;
  selectedMetricKey?: string | null;
}) {
  const t = useTranslations("pmoSimulation");
  const rows = buildResultRows(result.metrics, locale);

  const conflicts = result.issues.filter((issue) => issue.severity === "conflict");
  const warnings = result.issues.filter((issue) => issue.severity !== "conflict");
  const notComputable = result.outcomes.filter((outcome) => !outcome.computable);

  return (
    <div className="flex flex-col gap-3">
      {/* Conflicts first: a contradictory scenario has no trustworthy answer,
          so it must not be read as if it did. */}
      {conflicts.length > 0 ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {t("warnings")}
          </h3>
          <ul className="mt-1.5 space-y-1">
            {conflicts.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="text-[11px] text-red-800">
                {issue.code}
                {issue.detail ? <span className="text-red-600"> — {issue.detail}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
          {t("noResults")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2.5 py-1.5 font-bold text-slate-600">{t("metric")}</th>
                <th className="px-2.5 py-1.5 text-right font-bold text-slate-600">{t("baseline")}</th>
                <th className="px-2.5 py-1.5 text-right font-bold text-slate-600">{t("simulated")}</th>
                <th className="px-2.5 py-1.5 text-right font-bold text-slate-600">{t("delta")}</th>
                <th className="px-2.5 py-1.5 font-bold text-slate-600">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <MetricRow
                  key={row.key}
                  row={row}
                  metric={result.metrics.find((entry) => entry.key === row.key) ?? null}
                  ranAt={result.ranAt}
                  coverage={result.coverage}
                  selected={selectedMetricKey === row.key}
                  onSelect={onSelectMetric}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* An intervention that could not be calculated is KEPT and explained.
          Dropping it would read as "this change had no effect". */}
      {notComputable.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            {t("notComputable")}
          </h3>
          <p className="mt-1 text-[11px] text-amber-800">{t("notComputableHint")}</p>
          <ul className="mt-1.5 space-y-1">
            {notComputable.map((outcome) => (
              <li key={outcome.interventionId} className="text-[11px] text-amber-800">
                <span className="font-semibold">{t(kindKey(outcome.kind))}</span>
                {" — "}
                {outcome.notComputableReason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-extrabold text-slate-700">{t("warnings")}</h3>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="text-[11px] text-slate-600">
                {issue.code}
                {issue.detail ? <span className="text-slate-400"> — {issue.detail}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.assumptions.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
            <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {t("assumptions")}
          </h3>
          <ul className="mt-1.5 space-y-1">
            {result.assumptions.map((assumption) => (
              <li key={assumption} className="text-[11px] text-slate-600">
                {assumption}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(result.coverage.unavailableSources.length > 0 ||
        result.coverage.unresolvedTargets.length > 0) ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-extrabold text-slate-700">{t("dataCoverage")}</h3>
          {result.coverage.unavailableSources.length > 0 ? (
            <p className="mt-1 text-[11px] text-slate-600">
              {t("sourcesUnavailable")} {result.coverage.unavailableSources.join(", ")}
            </p>
          ) : null}
          {result.coverage.unresolvedTargets.length > 0 ? (
            <p className="mt-1 text-[11px] text-slate-600">
              {t("unresolvedTargets")}{" "}
              {result.coverage.unresolvedTargets
                .map((target) => `${target.kind}:${target.id.slice(0, 8)}`)
                .join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {t("neverModifies")}
      </p>
    </div>
  );
}

function MetricRow({
  row,
  metric,
  ranAt,
  coverage,
  selected,
  onSelect,
  t,
}: {
  row: ResultRow;
  metric: SimResult["metrics"][number] | null;
  ranAt: string;
  coverage: SimResult["coverage"];
  selected: boolean;
  onSelect?: (key: string | null) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const unavailable = row.simulated == null && row.baseline == null;

  // The metric's own definition, resolved from the ONE central map so this
  // table cannot disagree with a card or a node panel about what EAC means.
  const definitionId = definitionIdForMetric(row.key);

  // Raw numbers, not the formatted strings: the panel formats them itself in
  // the reader's locale, and a null must survive as a null so it renders
  // "Data unavailable" rather than being parsed back out of an em dash.
  const acronymContext: AcronymContext | null = metric
    ? {
        baseline: metric.baseline,
        simulated: metric.simulated,
        delta: metric.delta,
        unit: metric.unit,
        provenance: metric.provenance,
        engine: metric.engine,
        // Which formula variant the engine actually used, when it reported one.
        // EAC accepts four; without this the panel can only show a default and
        // admit it does not know — understating what the engine plainly told us.
        formulaId: metric.formulaId ?? null,
        computedAt: ranAt,
        dataCoverage: {
          available: coverage.availableSources,
          unavailable: coverage.unavailableSources,
        },
      }
    : null;

  return (
    <tr
      className={`border-b border-slate-100 last:border-0 ${
        selected ? "bg-blue-50" : "hover:bg-slate-50"
      } ${onSelect ? "cursor-pointer" : ""}`}
      onClick={onSelect ? () => onSelect(selected ? null : row.key) : undefined}
    >
      <td className="px-2.5 py-1.5">
        {/* The click that opens a definition must not also select the metric
            and re-focus the graph — two different intents on one control. */}
        <span
          className="font-semibold text-slate-800"
          onClick={(event) => event.stopPropagation()}
        >
          {definitionId ? (
            <AcronymTerm code={definitionId} context={acronymContext}>
              {t(row.labelKey)}
            </AcronymTerm>
          ) : (
            t(row.labelKey)
          )}
        </span>
        <span className="ml-1.5 text-[10px] text-slate-400">{t(row.engineKey)}</span>
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-600">
        {row.baseline ?? "—"}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-slate-800">
        {row.simulated ?? "—"}
      </td>
      <td className={`px-2.5 py-1.5 text-right tabular-nums font-bold ${TONE_CLASS[row.tone]}`}>
        {row.delta ?? "—"}
        {row.delta != null && (row.unit === "days" || row.unit === "hours") ? (
          <span className="ml-1 text-[10px] font-medium text-slate-400">
            {t(row.unit === "days" ? "unitDays" : "unitHours")}
          </span>
        ) : null}
      </td>
      <td className="px-2.5 py-1.5">
        {unavailable ? (
          <span
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
            title={row.unavailableReason ?? undefined}
          >
            {t("provenanceUnavailable")}
          </span>
        ) : (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              row.needsCaveat ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
            }`}
            title={row.needsCaveat ? t("proxyHint") : undefined}
          >
            {t(row.provenanceKey)}
          </span>
        )}
      </td>
    </tr>
  );
}

function kindKey(kind: string): string {
  switch (kind) {
    case "budget":
      return "kindBudget";
    case "schedule":
      return "kindSchedule";
    case "resource":
      return "kindResource";
    default:
      return "kindRisk";
  }
}
