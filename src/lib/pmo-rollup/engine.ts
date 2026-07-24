import type {
  AggregatedMetricValue,
  PmoAggregateAlert,
  PmoAggregateChild,
  PmoAggregateSnapshot,
  PmoProjectFact,
  PmoRollupInput,
  PmoRollupRequest,
} from "./contracts";
import { PMO_ROLLUP_CONTRACT_VERSION } from "./contracts";
import { selectLatestFacts } from "./facts";
import { buildFinancialMetrics } from "./financial-metrics";
import { buildHealthScore } from "./health";
import { PMO_METRIC_REGISTRY } from "./metric-registry";
import { buildMetricValue } from "./metric-value";
import { average, clamp, stableHash } from "./math";
import { buildProcessMetrics } from "./process-metrics";
import { buildProjectMetrics } from "./project-metrics";
import { buildDataQualitySummary } from "./quality";
import { buildResourceMetrics } from "./resource-metrics";
import { buildRiskMetrics } from "./risk-metrics";
import {
  assertPmoRollupAccess,
  filterAuthorizedProjects,
  PmoRollupAccessError,
} from "./security";
import { buildStageAggregates } from "./stage-aggregates";
import {
  DEFAULT_PMO_STAGE_ONTOLOGY,
  resolveProjectStage,
} from "./stage-ontology";

export class PmoRollupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PmoRollupInputError";
  }
}

export function getPmoAggregateSnapshot(
  request: PmoRollupRequest,
  input: PmoRollupInput,
): PmoAggregateSnapshot {
  validateRequest(request);
  assertPmoRollupAccess(input.access, request);

  const stageDefinitions = input.stageDefinitions ?? [...DEFAULT_PMO_STAGE_ONTOLOGY];
  const authorizedVersions = filterAuthorizedProjects(
    input.projects,
    input.access,
    request.organizationId,
  );
  const latestProjects = selectLatestFacts(
    authorizedVersions,
    (project) => project.projectId,
    (project) => project.effectiveAt,
    (project) => project.factId,
    request.asOf,
  ).map((project) => ({
    ...project,
    currentStageId: resolveProjectStage(project, stageDefinitions).stageId,
  }));
  const projects = scopeProjects(latestProjects, request);
  const projectIds = projects.map((project) => project.projectId);
  const projectIdSet = new Set(projectIds);
  const exchangeRates = (input.exchangeRates ?? []).filter((rate) =>
    rate.organizationId === request.organizationId && rate.effectiveDate <= request.asOf);

  const projectResult = buildProjectMetrics(projects, request);
  const financialResult = buildFinancialMetrics(
    projects,
    input.financialFacts ?? [],
    exchangeRates,
    input.access,
    request,
    input.minimumEvmCoverage,
  );
  const riskResult = buildRiskMetrics(
    input.riskFacts ?? [],
    projectIds,
    exchangeRates,
    request,
  );
  const resourceResult = buildResourceMetrics(
    input.resourceFacts ?? [],
    projectIds,
    exchangeRates,
    request,
  );
  const processResult = buildProcessMetrics(
    input.processCases ?? [],
    projectIds,
    request,
  );

  const metrics: Record<string, AggregatedMetricValue> = {
    ...projectResult.metrics,
    ...financialResult.metrics,
    ...riskResult.metrics,
    ...resourceResult.metrics,
    ...processResult.metrics,
  };
  const budgetWeightedDelay = buildBudgetWeightedDelay(
    projects,
    projectResult.scheduleVarianceByProject,
    financialResult.approvedBudgetByProject,
    request,
  );
  if (budgetWeightedDelay) metrics.weighted_delay_days = budgetWeightedDelay;
  const warnings = [
    ...financialResult.warnings,
    ...riskResult.warnings,
    ...resourceResult.warnings,
    ...processResult.warnings,
  ];
  const mappingCoverage = projects.length === 0
    ? 0
    : projects.filter((project) => project.currentStageId !== "unmapped").length / projects.length;
  const baselineAvailability = projects.length === 0
    ? 0
    : metrics.accumulated_delay_days.eligibleCount / projects.length;
  const freshness = freshnessFromMetrics(metrics);
  const calculableMetrics = Object.values(metrics).filter((metric) => metric.status !== "not-calculable");
  const completeness = calculableMetrics.length === 0
    ? 0
    : average(calculableMetrics.map((metric) => metric.coveragePercent / 100)) ?? 0;
  const sourceReliability = average([
    ...projects.map((fact) => fact.sourceReliability ?? 1),
    ...riskResult.risks.map((fact) => fact.sourceReliability ?? 1),
    ...(input.resourceFacts ?? [])
      .filter((fact) =>
        fact.organizationId === request.organizationId && projectIdSet.has(fact.projectId))
      .map((fact) => fact.sourceReliability ?? 1),
    ...processResult.cases.map((fact) => fact.sourceReliability ?? 1),
  ]) ?? 0;
  const currencyCoverages = [
    financialResult.currencyCoverage,
    riskResult.currencyCoverage,
    resourceResult.currencyCoverage,
  ].filter((coverage) => coverage > 0);
  const dataQuality = buildDataQualitySummary(
    {
      completeness,
      freshness,
      baselineAvailability,
      eventContinuity: metricPercent(metrics.process_data_completeness),
      sampleSufficiency: clamp(projects.length / 5),
      currencyConversionCoverage: average(currencyCoverages) ?? 0,
      evmCoverage: financialResult.evmCoverage,
      dateValidity: baselineAvailability,
      mappingCoverage,
      sourceReliability,
    },
    [
      ...warnings,
      ...(mappingCoverage < 1 ? ["project_stage_mapping_incomplete"] : []),
      ...(baselineAvailability < 1 ? ["schedule_baseline_or_forecast_missing"] : []),
      ...(financialResult.evmCoverage < (input.minimumEvmCoverage ?? 0.8)
        ? ["evm_coverage_below_preferred_threshold"]
        : []),
    ],
  );

  const health = buildHealthScore(
    metrics,
    dataQuality,
    request,
    input.healthConfiguration,
  );
  metrics.health_score = health.metric;

  const scopedResourceFacts = (input.resourceFacts ?? []).filter((fact) =>
    fact.organizationId === request.organizationId
    && projectIdSet.has(fact.projectId)
    && fact.dataDate <= request.asOf);
  const stageAggregates = buildStageAggregates(
    projects,
    projectResult.scheduleVarianceByProject,
    financialResult.factsByProject,
    riskResult.risks,
    scopedResourceFacts,
    processResult.cases,
    stageDefinitions,
    exchangeRates,
    request,
  );
  const formulaVersions = Object.fromEntries(
    Object.entries(metrics).map(([metricId, metric]) => [metricId, metric.formulaVersion]),
  );
  const sourceFactIds = [
    ...projects.map((project) => project.factId),
    ...[...financialResult.factsByProject.values()].map((fact) => fact.factId),
    ...riskResult.risks.flatMap((risk) => risk.contributingFactIds),
    ...resourceResult.groups.flatMap((group) => group.factIds),
    ...processResult.cases.map((processCase) => processCase.factId),
  ];
  const lineageSeed = {
    request,
    projectIds,
    sourceFactIds: [...new Set(sourceFactIds)].sort(),
    formulaVersions,
  };
  const lineageToken = `pmo-lineage-${stableHash(lineageSeed)}`;
  const childEntities = buildChildren(projects, request);
  const alerts = buildAlerts(metrics);
  const snapshotSeed = {
    contractVersion: PMO_ROLLUP_CONTRACT_VERSION,
    request,
    metrics: Object.fromEntries(
      Object.entries(metrics).sort(([left], [right]) => left.localeCompare(right)).map(
        ([id, metric]) => [id, {
          value: metric.value,
          status: metric.status,
          sourceEntityIds: metric.sourceEntityIds,
          formulaVersion: metric.formulaVersion,
        }],
      ),
    ),
    stageAggregates: stageAggregates.map((stage) => ({
      stageId: stage.stageId,
      projectIds: stage.projectIds,
      confidenceScore: stage.confidenceScore,
    })),
  };

  return {
    contractVersion: PMO_ROLLUP_CONTRACT_VERSION,
    snapshotId: `pmo-snapshot-${stableHash(snapshotSeed)}`,
    organizationId: request.organizationId,
    hierarchyLevel: request.hierarchyLevel,
    entityId: request.entityId,
    stageId: request.stageId,
    asOf: request.asOf,
    periodStart: request.periodStart,
    periodEnd: request.periodEnd,
    reportingCurrency: request.reportingCurrency,
    metrics,
    stageAggregates,
    childEntities,
    alerts,
    processSummary: {
      dominantVariantId: processResult.dominantVariantId,
      bottleneckActivity: processResult.bottleneckActivity,
      limitations: [
        ...(processResult.bottleneckActivity ? [] : ["bottleneck_activity_unavailable"]),
        ...(processResult.dominantVariantId ? [] : ["dominant_variant_unavailable"]),
      ],
    },
    health: health.result,
    dataQuality,
    lineage: {
      token: lineageToken,
      sourceFactIds: [...new Set(sourceFactIds)].sort(),
      excludedFactIds: excludedAuthorizedFactIds(input, request, projectIdSet),
      sourceTypes: [
        "projects",
        "financial_project_cockpit",
        "financial_measurement_snapshots",
        "risks",
        "resource_workload_snapshots",
        "project_event_log",
      ],
      formulaVersions,
      filters: {
        hierarchyLevel: request.hierarchyLevel,
        entityId: request.entityId ?? null,
        stageId: request.stageId ?? null,
        activeLayer: request.activeLayer ?? "project-state",
        periodStart: request.periodStart,
        periodEnd: request.periodEnd,
        asOf: request.asOf,
        reportingCurrency: request.reportingCurrency,
        ...request.filters,
      },
      deduplicationRules: [
        "project_id",
        "risk_id",
        "resource_id+period_start+period_end",
        "case_id",
      ],
      exchangeRateIds: [...new Set([
        ...financialResult.exchangeRateIds,
        ...riskResult.exchangeRateIds,
        ...resourceResult.exchangeRateIds,
      ])].sort(),
    },
    formulaVersions,
    generatedAt: request.asOf,
  };
}

function buildBudgetWeightedDelay(
  projects: readonly PmoProjectFact[],
  scheduleVarianceByProject: ReadonlyMap<string, number>,
  approvedBudgetByProject: ReadonlyMap<string, number>,
  request: PmoRollupRequest,
): AggregatedMetricValue | null {
  const entries = projects.flatMap((project) => {
    const delay = scheduleVarianceByProject.get(project.projectId);
    const budget = approvedBudgetByProject.get(project.projectId);
    return delay == null || budget == null || budget <= 0
      ? []
      : [{ projectId: project.projectId, delay: Math.max(0, delay), budget }];
  });
  if (entries.length === 0) return null;
  const denominator = entries.reduce((sum, entry) => sum + entry.budget, 0);
  return buildMetricValue({
    metricId: "weighted_delay_days",
    value: entries.reduce((sum, entry) => sum + entry.delay * entry.budget, 0) / denominator,
    denominator,
    request,
    populationCount: projects.length,
    eligibleEntityIds: entries.map((entry) => entry.projectId),
    excludedEntityIds: projects.filter((project) => !entries.some((entry) => entry.projectId === project.projectId)).map((project) => project.projectId),
    explanation: "Σ(positive project delay × converted approved budget) / Σ approved budget.",
    aggregationMethod: "weighted-average",
    quality: { currencyConversionCoverage: 1 },
  });
}

function validateRequest(request: PmoRollupRequest): void {
  if (!request.organizationId) throw new PmoRollupInputError("organizationId is required.");
  if (!request.asOf || !request.periodStart || !request.periodEnd) {
    throw new PmoRollupInputError("asOf, periodStart, and periodEnd are required.");
  }
  if (request.periodStart > request.periodEnd) {
    throw new PmoRollupInputError("periodStart must be on or before periodEnd.");
  }
  if (request.periodEnd > request.asOf.slice(0, 10)) {
    throw new PmoRollupInputError("periodEnd cannot be after the as-of date.");
  }
  if (!request.reportingCurrency) throw new PmoRollupInputError("reportingCurrency is required.");
  if (
    ["portfolio", "program", "project", "workstream", "milestone", "activity"].includes(request.hierarchyLevel)
    && !request.entityId
  ) {
    throw new PmoRollupInputError(`${request.hierarchyLevel} snapshots require entityId.`);
  }
  if (request.hierarchyLevel === "milestone" || request.hierarchyLevel === "activity") {
    throw new PmoRollupInputError(
      `${request.hierarchyLevel} roll-up requires a canonical hierarchy adapter that is not yet available.`,
    );
  }
}

function scopeProjects(
  projects: readonly PmoProjectFact[],
  request: PmoRollupRequest,
): PmoProjectFact[] {
  const scoped = projects.filter((project) => {
    if (request.hierarchyLevel === "portfolio") return project.portfolioId === request.entityId;
    if (request.hierarchyLevel === "program") return project.programId === request.entityId;
    if (request.hierarchyLevel === "project") return project.projectId === request.entityId;
    if (request.hierarchyLevel === "workstream") return project.workstreamId === request.entityId;
    return true;
  });
  return request.stageId
    ? scoped.filter((project) => project.currentStageId === request.stageId)
    : scoped;
}

function buildChildren(
  projects: readonly PmoProjectFact[],
  request: PmoRollupRequest,
): PmoAggregateChild[] {
  if (request.hierarchyLevel === "organization") {
    const portfolios = groupChildren(projects, "portfolioId", "portfolio");
    return portfolios.length > 0
      ? portfolios
      : projects.map((project) => projectChild(project));
  }
  if (request.hierarchyLevel === "portfolio") {
    const programs = groupChildren(projects, "programId", "program");
    return programs.length > 0
      ? programs
      : projects.map((project) => projectChild(project));
  }
  if (request.hierarchyLevel === "program") {
    return projects.map((project) => projectChild(project));
  }
  return [];
}

function groupChildren(
  projects: readonly PmoProjectFact[],
  key: "portfolioId" | "programId",
  level: "portfolio" | "program",
): PmoAggregateChild[] {
  const groups = new Map<string, string[]>();
  for (const project of projects) {
    const entityId = project[key];
    if (!entityId) continue;
    const list = groups.get(entityId) ?? [];
    list.push(project.projectId);
    groups.set(entityId, list);
  }
  return [...groups.entries()]
    .map(([entityId, projectIds]) => ({
      hierarchyLevel: level,
      entityId,
      projectIds: [...new Set(projectIds)].sort(),
      metricIds: PMO_METRIC_REGISTRY.map((definition) => definition.id),
    }))
    .sort((left, right) => left.entityId.localeCompare(right.entityId));
}

function projectChild(project: PmoProjectFact): PmoAggregateChild {
  return {
    hierarchyLevel: "project",
    entityId: project.projectId,
    projectIds: [project.projectId],
    metricIds: PMO_METRIC_REGISTRY.map((definition) => definition.id),
  };
}

function buildAlerts(metrics: Record<string, AggregatedMetricValue>): PmoAggregateAlert[] {
  const alerts: PmoAggregateAlert[] = [];
  add("accumulated_delay_days", "warning", "Authorized projects have accumulated actual schedule delay.", (value) => value > 0);
  add("portfolio_cpi", "critical", "Portfolio CPI is below 0.90.", (value) => value < 0.9);
  add("critical_risks", "critical", "Open critical risks require attention.", (value) => value > 0);
  add("overallocated_hours", "warning", "Resource demand exceeds deduplicated capacity.", (value) => value > 0);
  add("projects_missing_data", "warning", "Some projects are excluded from one or more calculations.", (value) => value > 0);
  return alerts;

  function add(
    metricId: string,
    severity: PmoAggregateAlert["severity"],
    message: string,
    predicate: (value: number) => boolean,
  ) {
    const metric = metrics[metricId];
    if (metric?.value == null || !predicate(metric.value)) return;
    alerts.push({
      id: `${metricId}-${stableHash({ value: metric.value, asOf: metric.asOf })}`,
      severity,
      metricId,
      message,
      projectIds: metric.sourceEntityIds,
    });
  }
}

function metricPercent(metric: AggregatedMetricValue | undefined): number {
  return metric?.value == null ? 0 : clamp(metric.value / 100);
}

function freshnessFromMetrics(metrics: Record<string, AggregatedMetricValue>): number {
  const days = metrics.event_freshness_days?.value;
  if (days == null) return 0;
  if (days <= 7) return 1;
  if (days >= 90) return 0;
  return 1 - (days - 7) / 83;
}

function excludedAuthorizedFactIds(
  input: PmoRollupInput,
  request: PmoRollupRequest,
  includedProjectIds: ReadonlySet<string>,
): string[] {
  const authorized = new Set(input.access.authorizedProjectIds);
  const ids = [
    ...input.projects
      .filter((fact) =>
        fact.organizationId === request.organizationId
        && authorized.has(fact.projectId)
        && (!includedProjectIds.has(fact.projectId) || fact.effectiveAt > request.asOf))
      .map((fact) => fact.factId),
    ...(input.financialFacts ?? [])
      .filter((fact) =>
        fact.organizationId === request.organizationId
        && authorized.has(fact.projectId)
        && (!includedProjectIds.has(fact.projectId) || fact.dataDate > request.asOf))
      .map((fact) => fact.factId),
  ];
  return [...new Set(ids)].sort();
}

export { PmoRollupAccessError };
