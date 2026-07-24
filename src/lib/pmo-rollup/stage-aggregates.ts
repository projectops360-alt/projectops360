import type {
  PmoExchangeRate,
  PmoFinancialFact,
  PmoProcessCaseFact,
  PmoProjectFact,
  PmoResourcePeriodFact,
  PmoRiskFact,
  PmoRollupRequest,
  PmoStageAggregate,
  PmoStageDefinition,
  PmoStageId,
} from "./contracts";
import { convertMoney } from "./currency";
import { average, quantile, ratio } from "./math";
import { resolveProjectStage } from "./stage-ontology";

export function buildStageAggregates(
  projects: readonly PmoProjectFact[],
  scheduleVarianceByProject: ReadonlyMap<string, number>,
  financialFactsByProject: ReadonlyMap<string, PmoFinancialFact>,
  risks: readonly PmoRiskFact[],
  resourceFacts: readonly PmoResourcePeriodFact[],
  processCases: readonly PmoProcessCaseFact[],
  definitions: readonly PmoStageDefinition[],
  exchangeRates: readonly PmoExchangeRate[],
  request: PmoRollupRequest,
): PmoStageAggregate[] {
  return definitions.map((definition) =>
    buildStageAggregate(definition.id, definition));

  function buildStageAggregate(
    stageId: PmoStageId,
    definition: PmoStageDefinition,
  ): PmoStageAggregate {
    const currentProjects = projects.filter((project) =>
      resolveProjectStage(project, definitions).stageId === stageId);
    const projectIds = currentProjects.map((project) => project.projectId).sort();
    const processForStage = processCases.filter((processCase) =>
      (processCase.stageId ?? "unmapped") === stageId);
    const projectsActiveInPeriod = new Set(processForStage.map((processCase) => processCase.projectId)).size;
    const cycleTimes = processForStage
      .map((processCase) => processCase.cycleTimeDays)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const stageVariances = projectIds
      .map((projectId) => scheduleVarianceByProject.get(projectId))
      .filter((value): value is number => value != null);
    const positiveDelays = stageVariances.filter((value) => value > 0);
    const accumulatedDelayDays = positiveDelays.reduce((sum, value) => sum + value, 0);
    const completedCases = processForStage.filter((processCase) => processCase.status === "completed");
    const reworkCases = completedCases.filter((processCase) => processCase.hasRework);
    const stageRisks = risks.filter((risk) => (risk.stageId ?? "unmapped") === stageId);
    const criticalRisks = stageRisks.filter((risk) =>
      (risk.status === "open" || risk.status === "mitigating") && risk.severity === "critical");
    const expectedRiskDelayEligible = stageRisks.filter((risk) =>
      risk.probability != null && risk.scheduleImpactDays != null);
    const expectedRiskDelayDays = expectedRiskDelayEligible.length > 0
      ? expectedRiskDelayEligible.reduce(
          (sum, risk) => sum + (risk.probability as number) * (risk.scheduleImpactDays as number),
          0,
        )
      : null;
    const expectedRiskCost = sumRiskCost(expectedRiskDelayEligible);

    const stageResources = resourceFacts.filter((fact) => (fact.stageId ?? "unmapped") === stageId);
    const overallocatedResourceIds = [...new Set(
      stageResources
        .filter((fact) => fact.allocatedHours > fact.availableHours)
        .map((fact) => fact.resourceId),
    )];
    const capacity = stageResources.reduce((sum, fact) => sum + Math.max(0, fact.availableHours), 0);
    const allocated = stageResources.reduce((sum, fact) => sum + Math.max(0, fact.allocatedHours), 0);

    const financial = aggregateStageFinancial(stageId);
    const mappingCoverage = projects.length === 0
      ? 0
      : projects.filter((project) => resolveProjectStage(project, definitions).stageId !== "unmapped").length / projects.length;
    const confidenceInputs = [
      projectIds.length > 0 ? 1 : null,
      stageVariances.length > 0 ? stageVariances.length / Math.max(1, projectIds.length) : null,
      cycleTimes.length > 0 ? 1 : null,
      financial.coverage,
      mappingCoverage,
    ].filter((value): value is number => value != null);
    const confidenceScore = average(confidenceInputs) ?? 0;
    const warnings = [...financial.warnings];
    if (stageId === "unmapped" && (projectIds.length > 0 || processForStage.length > 0)) {
      warnings.push("stage_mapping_required");
    }

    const scheduleScore = stageVariances.length > 0
      ? Math.max(0, 100 - average(positiveDelays.map((delay) => Math.min(100, delay)))!)
      : null;
    const riskScore = Math.max(0, 100 - criticalRisks.length * 20);
    const resourceScore = capacity > 0 ? Math.max(0, 100 - Math.max(0, allocated - capacity) / capacity * 100) : null;
    const healthParts = [scheduleScore, riskScore, resourceScore].filter((value): value is number => value != null);

    return {
      stageId,
      definition,
      currentProjectCount: projectIds.length,
      projectsActiveInPeriod,
      averageCycleTimeDays: average(cycleTimes),
      medianCycleTimeDays: quantile(cycleTimes, 0.5),
      p90CycleTimeDays: quantile(cycleTimes, 0.9),
      accumulatedDelayDays,
      averageDelayLateProjects: average(positiveDelays),
      projectsOutsideSla: new Set(
        processForStage.filter((processCase) => processCase.slaViolated === true).map((processCase) => processCase.projectId),
      ).size,
      reworkRate: completedCases.length > 0 ? reworkCases.length / completedCases.length * 100 : null,
      approvedBudget: financial.approvedBudget,
      actualCost: financial.actualCost,
      committedCost: financial.committedCost,
      accruedCost: financial.accruedCost,
      eac: financial.eac,
      forecastVariance:
        financial.approvedBudget != null && financial.eac != null
          ? financial.approvedBudget - financial.eac
          : null,
      criticalRiskCount: criticalRisks.length,
      expectedRiskDelayDays,
      expectedRiskCost,
      overallocatedResourceCount: overallocatedResourceIds.length,
      capacityUtilization: ratio(allocated, capacity) == null ? null : (ratio(allocated, capacity) as number) * 100,
      healthScore: average(healthParts),
      confidenceScore,
      projectIds,
      warnings: [...new Set(warnings)].sort(),
    };
  }

  function aggregateStageFinancial(stageId: PmoStageId) {
    const fields = ["approvedBudget", "actualCost", "committedCost", "accruedCost", "eac"] as const;
    const totals: Record<(typeof fields)[number], number | null> = {
      approvedBudget: null,
      actualCost: null,
      committedCost: null,
      accruedCost: null,
      eac: null,
    };
    const warnings: string[] = [];
    let eligible = 0;
    for (const project of projects) {
      const fact = financialFactsByProject.get(project.projectId);
      const allocation = fact?.stageAllocations?.[stageId];
      if (!allocation) {
        if (fact) warnings.push(`project_financials_not_stage_allocated:${project.projectId}`);
        continue;
      }
      eligible += 1;
      for (const field of fields) {
        const result = convertMoney(
          allocation[field],
          request.reportingCurrency,
          request.organizationId,
          request.asOf,
          exchangeRates,
        );
        if (result.value == null) {
          if (allocation[field]) warnings.push(`stage_financial_missing_exchange_rate:${project.projectId}:${field}`);
          continue;
        }
        totals[field] = (totals[field] ?? 0) + result.value;
      }
    }
    return {
      ...totals,
      coverage: projects.length === 0 ? 0 : eligible / projects.length,
      warnings,
    };
  }

  function sumRiskCost(stageRisks: readonly PmoRiskFact[]): number | null {
    const converted = stageRisks.flatMap((risk) => {
      const result = convertMoney(
        risk.costImpact,
        request.reportingCurrency,
        request.organizationId,
        request.asOf,
        exchangeRates,
      );
      return result.value == null || risk.probability == null
        ? []
        : [result.value * risk.probability];
    });
    return converted.length > 0 ? converted.reduce((sum, value) => sum + value, 0) : null;
  }
}
