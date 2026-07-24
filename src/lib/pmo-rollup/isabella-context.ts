import type {
  IsabellaPmoAggregateContext,
  PmoAggregateSnapshot,
} from "./contracts";

export interface IsabellaPmoAggregateAnswer {
  snapshotId: string;
  text: string;
  metricIds: string[];
  confidenceScore: number;
  evidence: Array<{
    metricId: string;
    value: number | null;
    formulaVersion: string;
    asOf: string;
    explanation: string;
  }>;
}

export function buildIsabellaPmoAggregateContext(
  snapshot: PmoAggregateSnapshot,
  authorizedProjectCount: number,
): IsabellaPmoAggregateContext {
  return {
    organizationId: snapshot.organizationId,
    snapshotId: snapshot.snapshotId,
    hierarchyLevel: snapshot.hierarchyLevel,
    entityId: snapshot.entityId,
    stageId: snapshot.stageId,
    visibleProjectCount: snapshot.metrics.total_projects?.value ?? 0,
    authorizedProjectCount,
    metrics: snapshot.metrics,
    activeFilters: snapshot.lineage.filters,
    dataQualityScore: snapshot.dataQuality.overallScore,
    asOf: snapshot.asOf,
    formulaVersions: snapshot.formulaVersions,
  };
}

export function answerIsabellaPmoAggregateQuestion(
  question: string,
  context: IsabellaPmoAggregateContext,
  locale: "en" | "es" = "es",
): IsabellaPmoAggregateAnswer {
  const normalized = question.toLocaleLowerCase(locale);
  const metricIds = resolveMetricIds(normalized);
  const selected = metricIds
    .map((metricId) => context.metrics[metricId])
    .filter((metric) => metric != null);
  const evidence = selected.map((metric) => ({
    metricId: metric.metricId,
    value: metric.value,
    formulaVersion: metric.formulaVersion,
    asOf: metric.asOf,
    explanation: metric.explanation,
  }));
  const confidenceScore = selected.length === 0
    ? context.dataQualityScore
    : selected.reduce((sum, metric) => sum + metric.confidenceScore, 0) / selected.length;
  const text = selected.length === 0
    ? noMetricAnswer(context, locale)
    : locale === "es"
      ? spanishAnswer(selected, context)
      : englishAnswer(selected, context);
  return {
    snapshotId: context.snapshotId,
    text,
    metricIds: selected.map((metric) => metric.metricId),
    confidenceScore,
    evidence,
  };
}

function resolveMetricIds(question: string): string[] {
  if (/cu[aá]ntos? proyectos|how many projects/.test(question)) return ["total_projects"];
  if (/cu[aá]ntos? proyectos?.*retras|how many late projects/.test(question)) return ["late_project_count"];
  if (/d[ií]as acumulados|accumulated delay/.test(question)) return ["accumulated_delay_days"];
  if (/promedio.*retras|average delay/.test(question)) return ["average_delay_late_projects"];
  if (/mayor retras|maximum.*delay/.test(question)) return ["maximum_project_delay_days"];
  if (/exposici[oó]n.*riesg.*d[ií]as|risk.*delay/.test(question)) return ["expected_risk_delay_days"];
  if (/presupuesto total|total budget/.test(question)) return ["approved_budget"];
  if (/\beac\b|estimate at completion/.test(question)) return ["estimate_at_completion"];
  if (/exced|overrun/.test(question)) return ["forecast_overrun"];
  if (/cpi/.test(question)) return ["portfolio_cpi"];
  if (/spi/.test(question)) return ["portfolio_spi"];
  if (/confianza|confidence/.test(question)) return ["health_score"];
  if (/faltan|missing data/.test(question)) return ["projects_missing_data"];
  if (/espera.*proceso|process waiting/.test(question)) return ["average_waiting_time_days"];
  if (/retrabajo|rework/.test(question)) return ["rework_rate"];
  if (/utilizaci[oó]n|utilization/.test(question)) return ["capacity_utilization"];
  return [];
}

function spanishAnswer(
  metrics: IsabellaPmoAggregateContext["metrics"][string][],
  context: IsabellaPmoAggregateContext,
): string {
  const values = metrics.map((metric) =>
    `${metric.metricId}: ${format(metric.value, metric.unit, metric.reportingCurrency)}`);
  return `${values.join(" · ")}. Corte ${context.asOf}. Confianza del snapshot ${(context.dataQualityScore * 100).toFixed(0)}%. ` +
    "El retraso real, la exposición futura por riesgo y la espera de proceso permanecen separados.";
}

function englishAnswer(
  metrics: IsabellaPmoAggregateContext["metrics"][string][],
  context: IsabellaPmoAggregateContext,
): string {
  const values = metrics.map((metric) =>
    `${metric.metricId}: ${format(metric.value, metric.unit, metric.reportingCurrency)}`);
  return `${values.join(" · ")}. As of ${context.asOf}. Snapshot confidence ${(context.dataQualityScore * 100).toFixed(0)}%. ` +
    "Actual delay, future risk exposure, and process waiting remain separate.";
}

function noMetricAnswer(
  context: IsabellaPmoAggregateContext,
  locale: "en" | "es",
): string {
  return locale === "es"
    ? `El snapshot ${context.snapshotId} es válido, pero esta pregunta no corresponde todavía a una métrica registrada. Puedo explicar métricas disponibles y datos faltantes sin inventar valores.`
    : `Snapshot ${context.snapshotId} is valid, but this question does not yet map to a registered metric. I can explain available metrics and missing data without inventing values.`;
}

function format(
  value: number | null,
  unit: string,
  currency?: string,
): string {
  if (value == null) return "not calculable";
  if (unit === "currency") return `${currency ?? ""} ${value.toFixed(2)}`.trim();
  if (unit === "percent") return `${value.toFixed(2)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
