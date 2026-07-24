import type {
  AggregatedMetricValue,
  PmoExchangeRate,
  PmoResourcePeriodFact,
  PmoRollupRequest,
} from "./contracts";
import { convertMoney } from "./currency";
import { selectLatestFacts } from "./facts";
import { buildMetricValue } from "./metric-value";
import { average, overlaps, ratio } from "./math";

export interface ResourcePeriodAggregate {
  key: string;
  resourceId: string;
  periodStart: string;
  periodEnd: string;
  projectIds: string[];
  availableHours: number;
  allocatedHours: number;
  forecastDemandHours: number;
  overallocatedHours: number;
  isVendor: boolean;
  factIds: string[];
}

export interface ResourceMetricResult {
  metrics: Record<string, AggregatedMetricValue>;
  groups: ResourcePeriodAggregate[];
  exchangeRateIds: string[];
  currencyCoverage: number;
  warnings: string[];
}

export function buildResourceMetrics(
  facts: readonly PmoResourcePeriodFact[],
  scopedProjectIds: readonly string[],
  exchangeRates: readonly PmoExchangeRate[],
  request: PmoRollupRequest,
): ResourceMetricResult {
  const allowed = new Set(scopedProjectIds);
  const scoped = selectLatestFacts(
    facts.filter((fact) =>
      fact.organizationId === request.organizationId
      && allowed.has(fact.projectId)
      && fact.dataDate <= request.asOf
      && overlaps(fact.periodStart, fact.periodEnd, request.periodStart, request.periodEnd)),
    (fact) => `${fact.resourceId}:${fact.projectId}:${fact.periodStart}:${fact.periodEnd}`,
    (fact) => fact.dataDate,
    (fact) => fact.factId,
    request.asOf,
  );

  const grouped = new Map<string, PmoResourcePeriodFact[]>();
  for (const fact of scoped) {
    const key = `${fact.resourceId}:${fact.periodStart}:${fact.periodEnd}`;
    const list = grouped.get(key) ?? [];
    list.push(fact);
    grouped.set(key, list);
  }

  const groups: ResourcePeriodAggregate[] = [...grouped.entries()]
    .map(([key, rows]) => {
      const availableHours = Math.max(0, ...rows.map((row) => row.availableHours));
      const allocatedHours = rows.reduce((sum, row) => sum + Math.max(0, row.allocatedHours), 0);
      return {
        key,
        resourceId: rows[0]?.resourceId ?? key,
        periodStart: rows[0]?.periodStart ?? request.periodStart,
        periodEnd: rows[0]?.periodEnd ?? request.periodEnd,
        projectIds: [...new Set(rows.map((row) => row.projectId))].sort(),
        availableHours,
        allocatedHours,
        forecastDemandHours: rows.reduce((sum, row) => sum + Math.max(0, row.forecastDemandHours ?? 0), 0),
        overallocatedHours: Math.max(0, allocatedHours - availableHours),
        isVendor: rows.some((row) => row.isVendor === true),
        factIds: rows.map((row) => row.factId).sort(),
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));

  const metrics: Record<string, AggregatedMetricValue> = {};
  const groupKeys = groups.map((group) => group.key);
  const reliability = average(scoped.map((fact) => fact.sourceReliability ?? 1)) ?? 0;
  const totalCapacity = groups.reduce((sum, group) => sum + group.availableHours, 0);
  const allocatedCapacity = groups.reduce((sum, group) => sum + group.allocatedHours, 0);
  const remainingCapacity = groups.reduce(
    (sum, group) => sum + Math.max(0, group.availableHours - group.allocatedHours),
    0,
  );
  const overallocatedHours = groups.reduce((sum, group) => sum + group.overallocatedHours, 0);
  const utilization = ratio(allocatedCapacity, totalCapacity);

  metrics.total_resource_capacity = groupMetric(
    "total_resource_capacity",
    totalCapacity,
    "Σ deduplicated available hours by resource and period. Capacity is not repeated per project.",
  );
  metrics.allocated_capacity = groupMetric(
    "allocated_capacity",
    allocatedCapacity,
    "Σ authorized project allocations by resource and period.",
  );
  metrics.available_capacity = groupMetric(
    "available_capacity",
    remainingCapacity,
    "Σ max(0, deduplicated available hours - allocated hours) by resource and period.",
  );
  metrics.capacity_utilization = buildMetricValue({
    metricId: "capacity_utilization",
    value: utilization === null ? null : utilization * 100,
    numerator: allocatedCapacity,
    denominator: totalCapacity,
    request,
    populationCount: groups.length,
    eligibleEntityIds: groupKeys,
    explanation: "Σ allocated hours / Σ deduplicated resource-period capacity.",
    aggregationMethod: "ratio-of-sums",
    quality: { sourceReliability: reliability },
  });
  metrics.overallocated_hours = groupMetric(
    "overallocated_hours",
    overallocatedHours,
    "Σ max(0, allocated hours - available hours) after resource-period deduplication.",
  );

  const overallocatedResources = [...new Set(
    groups.filter((group) => group.overallocatedHours > 0).map((group) => group.resourceId),
  )].sort();
  metrics.overallocated_people = buildMetricValue({
    metricId: "overallocated_people",
    value: overallocatedResources.length,
    request,
    populationCount: new Set(groups.map((group) => group.resourceId)).size,
    eligibleEntityIds: overallocatedResources,
    explanation: "Count-distinct of resources overallocated in at least one included period.",
    quality: { sourceReliability: reliability },
  });

  const shared = [...new Set(
    groups.filter((group) => group.projectIds.length > 1).map((group) => group.resourceId),
  )].sort();
  metrics.shared_resources = buildMetricValue({
    metricId: "shared_resources",
    value: shared.length,
    request,
    populationCount: new Set(groups.map((group) => group.resourceId)).size,
    eligibleEntityIds: shared,
    explanation: "Count-distinct of resources allocated to more than one authorized project.",
    quality: { sourceReliability: reliability },
  });

  const skillGapRows = scoped.filter((fact) => fact.criticalSkillGap === true);
  metrics.critical_skill_gaps = buildMetricValue({
    metricId: "critical_skill_gaps",
    value: new Set(skillGapRows.map((fact) => `${fact.resourceId}:${fact.projectId}`)).size,
    request,
    populationCount: scoped.length,
    eligibleEntityIds: skillGapRows.map((fact) => fact.factId),
    explanation: "Count-distinct of explicit resource-project critical skill gaps.",
    quality: { sourceReliability: reliability },
  });

  const vendorGroups = groups.filter((group) => group.isVendor);
  metrics.vendor_capacity = buildMetricValue({
    metricId: "vendor_capacity",
    value: vendorGroups.length > 0
      ? vendorGroups.reduce((sum, group) => sum + group.availableHours, 0)
      : null,
    request,
    populationCount: groups.length,
    eligibleEntityIds: vendorGroups.map((group) => group.key),
    excludedEntityIds: groups.filter((group) => !group.isVendor).map((group) => group.key),
    explanation: "Σ deduplicated available capacity for explicitly classified vendor resources.",
    quality: { sourceReliability: reliability },
  });
  metrics.forecast_resource_demand = groupMetric(
    "forecast_resource_demand",
    groups.length > 0 ? groups.reduce((sum, group) => sum + group.forecastDemandHours, 0) : null,
    "Σ forecast demand hours across authorized resource-project-period facts.",
  );

  const warnings: string[] = [];
  const exchangeRateIds = new Set<string>();
  let requestedConversions = 0;
  let successfulConversions = 0;
  const costRows: Array<{ factId: string; value: number }> = [];
  for (const fact of scoped) {
    if (!fact.resourceCost) continue;
    requestedConversions += 1;
    const converted = convertMoney(
      fact.resourceCost,
      request.reportingCurrency,
      request.organizationId,
      request.asOf,
      exchangeRates,
    );
    if (converted.value === null) {
      warnings.push(`resource_cost:missing_exchange_rate:${fact.factId}`);
      continue;
    }
    successfulConversions += 1;
    if (converted.exchangeRateId) exchangeRateIds.add(converted.exchangeRateId);
    costRows.push({ factId: fact.factId, value: converted.value });
  }
  const currencyCoverage = requestedConversions === 0 ? scoped.length > 0 ? 1 : 0 : successfulConversions / requestedConversions;
  metrics.resource_cost = buildMetricValue({
    metricId: "resource_cost",
    value: costRows.length > 0 ? costRows.reduce((sum, row) => sum + row.value, 0) : null,
    request,
    populationCount: scoped.length,
    eligibleEntityIds: costRows.map((row) => row.factId),
    excludedEntityIds: scoped.filter((fact) => fact.resourceCost && !costRows.some((row) => row.factId === fact.factId)).map((fact) => fact.factId),
    explanation: "Σ converted resource-project-period cost facts.",
    quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
    reportingCurrency: request.reportingCurrency,
  });

  return {
    metrics,
    groups,
    exchangeRateIds: [...exchangeRateIds].sort(),
    currencyCoverage,
    warnings: [...new Set(warnings)].sort(),
  };

  function groupMetric(
    metricId: string,
    value: number | null,
    explanation: string,
  ): AggregatedMetricValue {
    return buildMetricValue({
      metricId,
      value: groups.length > 0 ? value : null,
      request,
      populationCount: groups.length,
      eligibleEntityIds: groupKeys,
      explanation,
      quality: { sourceReliability: reliability },
    });
  }
}
