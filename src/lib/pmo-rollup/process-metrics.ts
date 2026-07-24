import type {
  AggregatedMetricValue,
  PmoProcessCaseFact,
  PmoRollupRequest,
} from "./contracts";
import { selectLatestFacts } from "./facts";
import { buildMetricValue } from "./metric-value";
import { average, calendarDaysBetween, overlaps, quantile, ratio } from "./math";

export interface ProcessMetricResult {
  metrics: Record<string, AggregatedMetricValue>;
  cases: PmoProcessCaseFact[];
  dominantVariantId: string | null;
  bottleneckActivity: string | null;
  warnings: string[];
}

export function buildProcessMetrics(
  facts: readonly PmoProcessCaseFact[],
  scopedProjectIds: readonly string[],
  request: PmoRollupRequest,
): ProcessMetricResult {
  const allowed = new Set(scopedProjectIds);
  const cases = selectLatestFacts(
    facts.filter((fact) =>
      fact.organizationId === request.organizationId
      && allowed.has(fact.projectId)
      && fact.lastEventAt <= request.asOf
      && overlaps(
        fact.startedAt.slice(0, 10),
        (fact.completedAt ?? fact.lastEventAt).slice(0, 10),
        request.periodStart,
        request.periodEnd,
      )),
    (fact) => fact.caseId,
    (fact) => fact.lastEventAt,
    (fact) => fact.factId,
    request.asOf,
  );
  const metrics: Record<string, AggregatedMetricValue> = {};
  const caseIds = cases.map((item) => item.caseId);
  const active = cases.filter((item) => item.status === "active");
  const completed = cases.filter((item) => item.status === "completed");
  const reliability = average(cases.map((item) => item.sourceReliability ?? 1)) ?? 0;
  const bottleneckActivity = mostFrequent(
    cases.map((item) => item.bottleneckActivity).filter((value): value is string => Boolean(value)),
  );

  metrics.total_cases = caseCountMetric("total_cases", cases, "Count-distinct of authorized process cases.");
  metrics.active_cases = caseCountMetric("active_cases", active, "Count-distinct of active process cases.");
  metrics.completed_cases = caseCountMetric("completed_cases", completed, "Count-distinct of completed process cases.");
  metrics.event_count = buildMetricValue({
    metricId: "event_count",
    value: cases.length > 0 ? cases.reduce((sum, item) => sum + Math.max(0, item.eventCount), 0) : null,
    request,
    populationCount: cases.length,
    eligibleEntityIds: caseIds,
    explanation: "Σ canonical event count across distinct authorized process cases.",
    quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
  });

  const variants = new Map<string, string[]>();
  for (const item of cases) {
    if (!item.variantId) continue;
    const list = variants.get(item.variantId) ?? [];
    list.push(item.caseId);
    variants.set(item.variantId, list);
  }
  const dominantVariant = [...variants.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))[0] ?? null;
  metrics.dominant_variant_frequency = buildMetricValue({
    metricId: "dominant_variant_frequency",
    value: dominantVariant && cases.length > 0 ? dominantVariant[1].length / cases.length * 100 : null,
    numerator: dominantVariant?.[1].length,
    denominator: cases.length,
    request,
    populationCount: cases.length,
    eligibleEntityIds: dominantVariant?.[1] ?? [],
    excludedEntityIds: cases.filter((item) => !item.variantId).map((item) => item.caseId),
    explanation: dominantVariant
      ? `Dominant variant ${dominantVariant[0]} case share.`
      : "No governed variant IDs are available.",
    quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
  });

  const cycleCases = completed.filter((item) => item.cycleTimeDays != null && Number.isFinite(item.cycleTimeDays));
  const cycleValues = cycleCases.map((item) => item.cycleTimeDays as number);
  metrics.average_cycle_time_days = distributionMetric("average_cycle_time_days", average(cycleValues), cycleCases, "Average completed-case cycle time.");
  metrics.median_cycle_time_days = distributionMetric("median_cycle_time_days", quantile(cycleValues, 0.5), cycleCases, "Median completed-case cycle time.");
  metrics.p75_cycle_time_days = distributionMetric("p75_cycle_time_days", quantile(cycleValues, 0.75), cycleCases, "75th percentile completed-case cycle time.");
  metrics.p90_cycle_time_days = distributionMetric("p90_cycle_time_days", quantile(cycleValues, 0.9), cycleCases, "90th percentile completed-case cycle time.");

  const leadCases = cases.filter((item) => item.leadTimeDays != null && Number.isFinite(item.leadTimeDays));
  metrics.average_lead_time_days = distributionMetric(
    "average_lead_time_days",
    average(leadCases.map((item) => item.leadTimeDays as number)),
    leadCases,
    "Average explicit lead time across eligible cases.",
  );
  const waitingCases = cases.filter((item) => item.waitingTimeDays != null && Number.isFinite(item.waitingTimeDays));
  metrics.average_waiting_time_days = distributionMetric(
    "average_waiting_time_days",
    average(waitingCases.map((item) => item.waitingTimeDays as number)),
    waitingCases,
    "Average explicit process waiting time. Actual schedule delay and risk exposure are separate metrics.",
  );

  const reworkCases = completed.filter((item) => item.hasRework);
  metrics.rework_cases = caseCountMetric("rework_cases", reworkCases, "Completed cases containing explicit rework.");
  const reworkRate = ratio(reworkCases.length, completed.length);
  metrics.rework_rate = buildMetricValue({
    metricId: "rework_rate",
    value: reworkRate === null ? null : reworkRate * 100,
    numerator: reworkCases.length,
    denominator: completed.length,
    request,
    populationCount: completed.length,
    eligibleEntityIds: completed.map((item) => item.caseId),
    explanation: "Cases with rework / eligible completed cases. Repeated events are not divided by project count.",
    aggregationMethod: "ratio-of-sums",
    quality: { eventContinuity: temporalCoverage(completed), sourceReliability: reliability },
  });

  const conformanceCases = cases.filter((item) => item.conformant != null);
  const conformant = conformanceCases.filter((item) => item.conformant === true);
  const conformanceRate = ratio(conformant.length, conformanceCases.length);
  metrics.conformance_rate = buildMetricValue({
    metricId: "conformance_rate",
    value: conformanceRate === null ? null : conformanceRate * 100,
    numerator: conformant.length,
    denominator: conformanceCases.length,
    request,
    populationCount: cases.length,
    eligibleEntityIds: conformanceCases.map((item) => item.caseId),
    excludedEntityIds: cases.filter((item) => item.conformant == null).map((item) => item.caseId),
    explanation: "Conformant classified cases / cases with a declared-model conformance result.",
    quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
  });

  metrics.skipped_activities = eventPropertyMetric(
    "skipped_activities",
    (item) => item.skippedActivityCount ?? 0,
    "Σ explicit skipped activity occurrences.",
  );
  metrics.repeated_activities = eventPropertyMetric(
    "repeated_activities",
    (item) => item.repeatedActivityCount ?? 0,
    "Σ explicit repeated activity occurrences.",
  );
  const slaCases = cases.filter((item) => item.slaViolated != null);
  const slaViolations = slaCases.filter((item) => item.slaViolated === true);
  metrics.sla_violations = buildMetricValue({
    metricId: "sla_violations",
    value: slaCases.length > 0 ? slaViolations.length : null,
    request,
    populationCount: cases.length,
    eligibleEntityIds: slaCases.map((item) => item.caseId),
    excludedEntityIds: cases.filter((item) => item.slaViolated == null).map((item) => item.caseId),
    explanation: "Count-distinct of cases with an explicit SLA violation result.",
    quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
  });

  const completeTemporal = cases.filter((item) =>
    item.startedAt && item.lastEventAt && item.eventCount > 0);
  const completeness = ratio(completeTemporal.length, cases.length);
  metrics.process_data_completeness = buildMetricValue({
    metricId: "process_data_completeness",
    value: completeness === null ? null : completeness * 100,
    numerator: completeTemporal.length,
    denominator: cases.length,
    request,
    populationCount: cases.length,
    eligibleEntityIds: completeTemporal.map((item) => item.caseId),
    excludedEntityIds: cases.filter((item) => !completeTemporal.includes(item)).map((item) => item.caseId),
    explanation: "Cases with usable temporal evidence and at least one event / total cases.",
    quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
  });
  const latestEvent = cases.map((item) => item.lastEventAt).sort().at(-1);
  metrics.event_freshness_days = buildMetricValue({
    metricId: "event_freshness_days",
    value: latestEvent ? calendarDaysBetween(latestEvent.slice(0, 10), request.asOf.slice(0, 10)) : null,
    request,
    populationCount: cases.length,
    eligibleEntityIds: latestEvent ? caseIds : [],
    explanation: "Calendar days between the latest included process event and the snapshot as-of date.",
    quality: { freshness: freshnessScore(latestEvent, request.asOf), sourceReliability: reliability },
    calendarType: "calendar-days",
  });

  return {
    metrics,
    cases,
    dominantVariantId: dominantVariant?.[0] ?? null,
    bottleneckActivity,
    warnings: cases.some((item) => item.stageId == null) ? ["unmapped_process_stage"] : [],
  };

  function caseCountMetric(
    metricId: string,
    selected: readonly PmoProcessCaseFact[],
    explanation: string,
  ): AggregatedMetricValue {
    return buildMetricValue({
      metricId,
      value: selected.length,
      request,
      populationCount: cases.length,
      eligibleEntityIds: selected.map((item) => item.caseId),
      explanation,
      quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
    });
  }

  function distributionMetric(
    metricId: string,
    value: number | null,
    selected: readonly PmoProcessCaseFact[],
    explanation: string,
  ): AggregatedMetricValue {
    return buildMetricValue({
      metricId,
      value,
      request,
      populationCount: cases.length,
      eligibleEntityIds: selected.map((item) => item.caseId),
      excludedEntityIds: cases.filter((item) => !selected.includes(item)).map((item) => item.caseId),
      explanation,
      quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
      calendarType: "calendar-days",
    });
  }

  function eventPropertyMetric(
    metricId: string,
    valueOf: (item: PmoProcessCaseFact) => number,
    explanation: string,
  ): AggregatedMetricValue {
    return buildMetricValue({
      metricId,
      value: cases.length > 0 ? cases.reduce((sum, item) => sum + Math.max(0, valueOf(item)), 0) : null,
      request,
      populationCount: cases.length,
      eligibleEntityIds: caseIds,
      explanation,
      quality: { eventContinuity: temporalCoverage(cases), sourceReliability: reliability },
    });
  }
}

function mostFrequent(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function temporalCoverage(cases: readonly PmoProcessCaseFact[]): number {
  if (cases.length === 0) return 0;
  return cases.filter((item) => item.startedAt && item.lastEventAt && item.eventCount > 0).length / cases.length;
}

function freshnessScore(latestEvent: string | undefined, asOf: string): number {
  if (!latestEvent) return 0;
  const days = calendarDaysBetween(latestEvent.slice(0, 10), asOf.slice(0, 10));
  if (days == null) return 0;
  if (days <= 7) return 1;
  if (days >= 90) return 0;
  return 1 - (days - 7) / 83;
}
