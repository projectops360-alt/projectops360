import type {
  AggregatedMetricValue,
  PmoProjectFact,
  PmoRollupRequest,
} from "./contracts";
import { buildMetricValue, unavailableMetric } from "./metric-value";
import { average, daysBetween, quantile, ratio } from "./math";

export interface ProjectMetricResult {
  metrics: Record<string, AggregatedMetricValue>;
  scheduleVarianceByProject: Map<string, number>;
  missingProjectIds: string[];
}

export function buildProjectMetrics(
  projects: readonly PmoProjectFact[],
  request: PmoRollupRequest,
): ProjectMetricResult {
  const metrics: Record<string, AggregatedMetricValue> = {};
  const allIds = projects.map((project) => project.projectId);
  const statusMetric = (
    id: string,
    status: PmoProjectFact["status"],
    explanation: string,
  ) => {
    const eligible = projects.filter((project) => project.status === status).map((project) => project.projectId);
    metrics[id] = buildMetricValue({
      metricId: id,
      value: eligible.length,
      request,
      populationCount: projects.length,
      eligibleEntityIds: eligible,
      explanation,
      quality: { sourceReliability: averageReliability(projects) },
    });
  };

  metrics.total_projects = buildMetricValue({
    metricId: "total_projects",
    value: projects.length,
    request,
    populationCount: projects.length,
    eligibleEntityIds: allIds,
    explanation: "Count-distinct of authorized canonical project IDs in scope.",
    quality: { sourceReliability: averageReliability(projects) },
  });
  statusMetric("active_projects", "active", "Count-distinct of active authorized projects.");
  statusMetric("planned_projects", "planning", "Count-distinct of authorized projects in planning.");
  statusMetric("on_hold_projects", "on_hold", "Count-distinct of authorized projects on hold.");
  statusMetric("completed_projects", "completed", "Count-distinct of completed authorized projects.");
  statusMetric("cancelled_projects", "cancelled", "Count-distinct of cancelled authorized projects.");

  const programIds = [...new Set(projects.map((project) => project.programId).filter((id): id is string => Boolean(id)))];
  const projectsWithoutProgram = projects.filter((project) => !project.programId).map((project) => project.projectId);
  metrics.programs = programIds.length === 0
    ? unavailableMetric("programs", request, projects.length, allIds, "No canonical program assignments are available.")
    : buildMetricValue({
        metricId: "programs",
        value: programIds.length,
        request,
        populationCount: projects.length,
        eligibleEntityIds: projects.filter((project) => project.programId).map((project) => project.projectId),
        excludedEntityIds: projectsWithoutProgram,
        explanation: "Count-distinct of governed program IDs attached to authorized projects.",
      });

  const portfolioIds = [...new Set(projects.map((project) => project.portfolioId).filter((id): id is string => Boolean(id)))];
  const projectsWithoutPortfolio = projects.filter((project) => !project.portfolioId).map((project) => project.projectId);
  metrics.portfolios = portfolioIds.length === 0
    ? unavailableMetric("portfolios", request, projects.length, allIds, "No canonical portfolio assignments are available.")
    : buildMetricValue({
        metricId: "portfolios",
        value: portfolioIds.length,
        request,
        populationCount: projects.length,
        eligibleEntityIds: projects.filter((project) => project.portfolioId).map((project) => project.projectId),
        excludedEntityIds: projectsWithoutPortfolio,
        explanation: "Count-distinct of governed portfolio IDs attached to authorized projects.",
      });

  const updated = projects
    .filter((project) => project.updatedAt >= request.periodStart && project.updatedAt <= request.periodEnd)
    .map((project) => project.projectId);
  metrics.projects_updated_in_period = buildMetricValue({
    metricId: "projects_updated_in_period",
    value: updated.length,
    request,
    populationCount: projects.length,
    eligibleEntityIds: updated,
    explanation: "Count-distinct of project facts updated inside the requested period.",
  });

  const calendarType = request.calendarType ?? "business-days";
  const scheduleVarianceByProject = new Map<string, number>();
  const invalidDateIds: string[] = [];
  for (const project of projects) {
    if (!project.baselineFinishDate || !project.forecastFinishDate) {
      invalidDateIds.push(project.projectId);
      continue;
    }
    const variance = daysBetween(project.baselineFinishDate, project.forecastFinishDate, calendarType);
    if (variance === null) invalidDateIds.push(project.projectId);
    else scheduleVarianceByProject.set(project.projectId, variance);
  }

  const scheduleIds = [...scheduleVarianceByProject.keys()];
  const signedVariances = [...scheduleVarianceByProject.values()];
  const lateEntries = [...scheduleVarianceByProject.entries()].filter(([, value]) => value > 0);
  const lateIds = lateEntries.map(([id]) => id);
  const delays = lateEntries.map(([, value]) => value);
  const accumulatedDelay = delays.reduce((sum, value) => sum + value, 0);
  const netVariance = signedVariances.reduce((sum, value) => sum + value, 0);
  const scheduleQuality = {
    baselineAvailability: projects.length === 0 ? 0 : scheduleIds.length / projects.length,
    dateValidity: projects.length === 0 ? 0 : scheduleIds.length / projects.length,
    sourceReliability: averageReliability(projects),
  };

  metrics.accumulated_delay_days = buildMetricValue({
    metricId: "accumulated_delay_days",
    value: scheduleIds.length > 0 ? accumulatedDelay : null,
    request,
    populationCount: projects.length,
    eligibleEntityIds: scheduleIds,
    excludedEntityIds: invalidDateIds,
    explanation: "Σ max(0, signed project schedule variance days). Early projects never cancel late projects.",
    quality: scheduleQuality,
    calendarType,
  });
  metrics.late_project_count = buildMetricValue({
    metricId: "late_project_count",
    value: scheduleIds.length > 0 ? lateIds.length : null,
    request,
    populationCount: projects.length,
    eligibleEntityIds: scheduleIds,
    excludedEntityIds: invalidDateIds,
    explanation: "Count-distinct of eligible projects with positive schedule variance.",
    quality: scheduleQuality,
    calendarType,
  });
  metrics.average_delay_late_projects = buildMetricValue({
    metricId: "average_delay_late_projects",
    value: lateIds.length > 0 ? accumulatedDelay / lateIds.length : scheduleIds.length > 0 ? 0 : null,
    numerator: accumulatedDelay,
    denominator: lateIds.length,
    request,
    populationCount: projects.length,
    eligibleEntityIds: scheduleIds,
    excludedEntityIds: invalidDateIds,
    explanation: "Accumulated positive delay divided by late project count.",
    quality: scheduleQuality,
    calendarType,
  });
  metrics.median_delay_days = scheduleDistributionMetric("median_delay_days", quantile(delays, 0.5), "Median of positive project delay days.");
  metrics.p90_delay_days = scheduleDistributionMetric("p90_delay_days", quantile(delays, 0.9), "90th percentile of positive project delay days.");
  metrics.maximum_project_delay_days = scheduleDistributionMetric("maximum_project_delay_days", delays.length > 0 ? Math.max(...delays) : scheduleIds.length > 0 ? 0 : null, "Maximum positive project delay.");
  metrics.net_schedule_variance_days = buildMetricValue({
    metricId: "net_schedule_variance_days",
    value: scheduleIds.length > 0 ? netVariance : null,
    request,
    populationCount: projects.length,
    eligibleEntityIds: scheduleIds,
    excludedEntityIds: invalidDateIds,
    explanation: "Σ signed schedule variance days. This secondary metric can hide late projects.",
    quality: scheduleQuality,
    calendarType,
  });
  metrics.on_time_delivery_rate = buildMetricValue({
    metricId: "on_time_delivery_rate",
    value: ratio(scheduleIds.length - lateIds.length, scheduleIds.length) === null
      ? null
      : (ratio(scheduleIds.length - lateIds.length, scheduleIds.length) as number) * 100,
    numerator: scheduleIds.length - lateIds.length,
    denominator: scheduleIds.length,
    request,
    populationCount: projects.length,
    eligibleEntityIds: scheduleIds,
    excludedEntityIds: invalidDateIds,
    explanation: "Eligible projects with schedule variance ≤ 0 divided by all schedule-eligible projects.",
    aggregationMethod: "ratio-of-sums",
    quality: scheduleQuality,
  });

  const weightedEntries = projects.flatMap((project) => {
    const delay = scheduleVarianceByProject.get(project.projectId);
    const weight = project.strategicWeight ?? project.complexityWeight ?? null;
    return delay === undefined || weight === null || weight <= 0
      ? []
      : [{ projectId: project.projectId, delay: Math.max(0, delay), weight }];
  });
  const weightedDenominator = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  metrics.weighted_delay_days = buildMetricValue({
    metricId: "weighted_delay_days",
    value: weightedDenominator > 0
      ? weightedEntries.reduce((sum, entry) => sum + entry.delay * entry.weight, 0) / weightedDenominator
      : null,
    denominator: weightedDenominator,
    request,
    populationCount: projects.length,
    eligibleEntityIds: weightedEntries.map((entry) => entry.projectId),
    excludedEntityIds: projects.filter((project) => !weightedEntries.some((entry) => entry.projectId === project.projectId)).map((project) => project.projectId),
    explanation: "Positive project delay weighted by governed strategic or complexity weight.",
    quality: scheduleQuality,
  });
  metrics.dependency_adjusted_portfolio_delay_days = unavailableMetric(
    "dependency_adjusted_portfolio_delay_days",
    request,
    projects.length,
    allIds,
    "No canonical inter-project dependency graph is available; a longest-path delay is not calculable.",
  );

  const missingProjectIds = projects
    .filter((project) => !scheduleVarianceByProject.has(project.projectId) || project.completionPercent == null)
    .map((project) => project.projectId);
  metrics.projects_missing_data = buildMetricValue({
    metricId: "projects_missing_data",
    value: missingProjectIds.length,
    request,
    populationCount: projects.length,
    eligibleEntityIds: missingProjectIds,
    explanation: "Projects missing schedule or progress inputs required by core roll-up metrics.",
  });

  return { metrics, scheduleVarianceByProject, missingProjectIds };

  function scheduleDistributionMetric(
    metricId: string,
    value: number | null,
    explanation: string,
  ): AggregatedMetricValue {
    return buildMetricValue({
      metricId,
      value,
      request,
      populationCount: projects.length,
      eligibleEntityIds: scheduleIds,
      excludedEntityIds: invalidDateIds,
      explanation,
      quality: scheduleQuality,
      calendarType,
    });
  }
}

function averageReliability(projects: readonly PmoProjectFact[]): number {
  return average(projects.map((project) => project.sourceReliability ?? 1)) ?? 0;
}
