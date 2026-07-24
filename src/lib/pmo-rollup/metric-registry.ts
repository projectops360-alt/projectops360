import type {
  PmoAggregationMethod,
  PmoMetricDefinition,
  PmoMetricDirection,
  PmoMetricDomain,
  PmoMetricUnit,
  PmoMissingDataPolicy,
} from "./contracts";

export const PMO_METRIC_REGISTRY_VERSION = "1.0.0";
const FORMULA_VERSION = "pmo-rollup-1.0.0";

function metric(
  id: string,
  name: string,
  domain: PmoMetricDomain,
  unit: PmoMetricUnit,
  aggregationMethod: PmoAggregationMethod,
  sourceGrain: string,
  description: string,
  options: {
    missingDataPolicy?: PmoMissingDataPolicy;
    direction?: PmoMetricDirection;
    numeratorMetricId?: string;
    denominatorMetricId?: string;
    weightMetricId?: string;
    deduplicationKey?: string;
  } = {},
): PmoMetricDefinition {
  return {
    id,
    name,
    domain,
    unit,
    aggregationMethod,
    sourceGrain,
    description,
    missingDataPolicy: options.missingDataPolicy ?? "exclude",
    direction: options.direction ?? "target-range",
    formulaVersion: FORMULA_VERSION,
    numeratorMetricId: options.numeratorMetricId,
    denominatorMetricId: options.denominatorMetricId,
    weightMetricId: options.weightMetricId,
    deduplicationKey: options.deduplicationKey,
  };
}

export const PMO_METRIC_REGISTRY: readonly PmoMetricDefinition[] = [
  metric("total_projects", "Total Projects", "portfolio", "count", "count-distinct", "project", "Distinct authorized projects.", { deduplicationKey: "project_id" }),
  metric("active_projects", "Active Projects", "portfolio", "count", "count-distinct", "project", "Distinct active projects.", { deduplicationKey: "project_id" }),
  metric("planned_projects", "Planned Projects", "portfolio", "count", "count-distinct", "project", "Distinct projects in planning status.", { deduplicationKey: "project_id" }),
  metric("on_hold_projects", "On-Hold Projects", "portfolio", "count", "count-distinct", "project", "Distinct on-hold projects.", { deduplicationKey: "project_id" }),
  metric("completed_projects", "Completed Projects", "portfolio", "count", "count-distinct", "project", "Distinct completed projects.", { deduplicationKey: "project_id" }),
  metric("cancelled_projects", "Cancelled Projects", "portfolio", "count", "count-distinct", "project", "Distinct cancelled projects.", { deduplicationKey: "project_id" }),
  metric("programs", "Programs", "portfolio", "count", "count-distinct", "program", "Distinct governed programs.", { deduplicationKey: "program_id", missingDataPolicy: "not-calculable" }),
  metric("portfolios", "Portfolios", "portfolio", "count", "count-distinct", "portfolio", "Distinct governed portfolios.", { deduplicationKey: "portfolio_id", missingDataPolicy: "not-calculable" }),
  metric("projects_missing_data", "Projects with Missing Data", "quality", "count", "count-distinct", "project", "Projects missing one or more required calculation inputs.", { deduplicationKey: "project_id", direction: "lower-is-better" }),
  metric("projects_updated_in_period", "Projects Updated in Period", "portfolio", "count", "count-distinct", "project", "Projects whose latest authorized fact changed during the period.", { deduplicationKey: "project_id" }),

  metric("accumulated_delay_days", "Accumulated Delay Days", "schedule", "days", "sum", "project", "Sum of positive project schedule variance days.", { direction: "lower-is-better" }),
  metric("late_project_count", "Late Project Count", "schedule", "count", "count-distinct", "project", "Projects with positive schedule variance.", { direction: "lower-is-better", deduplicationKey: "project_id" }),
  metric("average_delay_late_projects", "Average Delay of Late Projects", "schedule", "days", "derived", "project", "Accumulated delay divided by late project count.", { numeratorMetricId: "accumulated_delay_days", denominatorMetricId: "late_project_count", direction: "lower-is-better" }),
  metric("median_delay_days", "Median Delay", "schedule", "days", "median", "project", "Median positive project delay.", { direction: "lower-is-better" }),
  metric("p90_delay_days", "P90 Delay", "schedule", "days", "percentile", "project", "90th percentile of positive project delay.", { direction: "lower-is-better" }),
  metric("maximum_project_delay_days", "Maximum Project Delay", "schedule", "days", "maximum", "project", "Maximum positive project delay.", { direction: "lower-is-better" }),
  metric("net_schedule_variance_days", "Net Schedule Variance", "schedule", "days", "sum", "project", "Sum of signed project schedule variance; not the primary delay indicator.", { direction: "lower-is-better" }),
  metric("weighted_delay_days", "Weighted Delay", "schedule", "days", "weighted-average", "project", "Positive delay weighted by approved budget, strategic value, complexity, or benefit value.", { weightMetricId: "approved_budget", direction: "lower-is-better" }),
  metric("dependency_adjusted_portfolio_delay_days", "Dependency-Adjusted Portfolio Delay", "schedule", "days", "longest-path", "inter-project dependency", "Longest exposed inter-project dependency path.", { missingDataPolicy: "not-calculable", direction: "lower-is-better" }),
  metric("on_time_delivery_rate", "On-Time Delivery Rate", "schedule", "percent", "ratio-of-sums", "project", "On-time eligible projects divided by eligible projects.", { direction: "higher-is-better" }),
  metric("portfolio_completion", "Portfolio Completion", "portfolio", "percent", "derived", "project", "EV/BAC or a disclosed weighted fallback; never an average of child averages.", { direction: "higher-is-better" }),

  metric("original_baseline", "Original Baseline", "financial", "currency", "sum", "project financial snapshot", "Sum of converted original baselines."),
  metric("current_baseline", "Current Baseline", "financial", "currency", "sum", "project financial snapshot", "Sum of converted current baselines."),
  metric("approved_budget", "Approved Budget", "financial", "currency", "sum", "project financial snapshot", "Sum of converted approved budgets."),
  metric("budget_at_completion", "Budget at Completion", "financial", "currency", "sum", "project EVM snapshot", "Sum of converted BAC."),
  metric("committed_cost", "Committed Cost", "financial", "currency", "sum", "project financial snapshot", "Commitments kept separate from actuals and accruals."),
  metric("actual_cost", "Actual Cost", "financial", "currency", "sum", "project financial snapshot", "Posted actual cost only; commitments and accruals excluded."),
  metric("accrued_cost", "Accrued Cost", "financial", "currency", "sum", "project financial snapshot", "Open accrual exposure kept separate from actual cost."),
  metric("remaining_budget", "Remaining Budget", "financial", "currency", "derived", "project financial snapshot", "Approved budget minus actual cost under the default reconciliation policy.", { numeratorMetricId: "approved_budget", denominatorMetricId: "actual_cost" }),
  metric("estimate_to_complete", "Estimate to Complete", "financial", "currency", "sum", "project forecast", "Sum of converted approved/project forecast ETC."),
  metric("estimate_at_completion", "Estimate at Completion", "financial", "currency", "sum", "project forecast", "Sum of converted project EAC."),
  metric("variance_at_completion", "Variance at Completion", "financial", "currency", "derived", "project forecast", "Sum of BAC minus sum of EAC.", { numeratorMetricId: "budget_at_completion", denominatorMetricId: "estimate_at_completion", direction: "higher-is-better" }),
  metric("planned_value", "Planned Value", "financial", "currency", "sum", "project EVM snapshot", "Sum of converted PV."),
  metric("earned_value", "Earned Value", "financial", "currency", "sum", "project EVM snapshot", "Sum of converted EV."),
  metric("cost_variance", "Cost Variance", "financial", "currency", "derived", "project EVM snapshot", "Sum of EV minus sum of AC.", { numeratorMetricId: "earned_value", denominatorMetricId: "actual_cost", direction: "higher-is-better" }),
  metric("schedule_variance", "Schedule Variance", "financial", "currency", "derived", "project EVM snapshot", "Sum of EV minus sum of PV; not calendar delay.", { numeratorMetricId: "earned_value", denominatorMetricId: "planned_value", direction: "higher-is-better" }),
  metric("portfolio_cpi", "Portfolio CPI", "financial", "ratio", "ratio-of-sums", "project EVM snapshot", "Sum of EV divided by sum of AC.", { numeratorMetricId: "earned_value", denominatorMetricId: "actual_cost", direction: "higher-is-better" }),
  metric("portfolio_spi", "Portfolio SPI", "financial", "ratio", "ratio-of-sums", "project EVM snapshot", "Sum of EV divided by sum of PV.", { numeratorMetricId: "earned_value", denominatorMetricId: "planned_value", direction: "higher-is-better" }),
  metric("portfolio_tcpi", "Portfolio TCPI", "financial", "ratio", "derived", "project EVM snapshot", "(Sum BAC - Sum EV) / (Sum BAC - Sum AC).", { direction: "target-range" }),
  metric("contingency_available", "Contingency Available", "financial", "currency", "sum", "project reserve", "Sum of available contingency."),
  metric("contingency_consumed", "Contingency Consumed", "financial", "currency", "derived", "project reserve", "Original contingency minus available contingency.", { direction: "lower-is-better" }),
  metric("management_reserve", "Management Reserve", "financial", "currency", "sum", "project reserve", "Sum of management reserve."),
  metric("burn_rate", "Burn Rate", "financial", "currency", "sum", "project financial period", "Sum of comparable period burn rates.", { missingDataPolicy: "not-calculable" }),
  metric("cash_flow_actual", "Cash Flow Actual", "financial", "currency", "sum", "project cash period", "Sum of period actual cash flow.", { missingDataPolicy: "not-calculable" }),
  metric("cash_flow_forecast", "Cash Flow Forecast", "financial", "currency", "sum", "project cash period", "Sum of period forecast cash flow.", { missingDataPolicy: "not-calculable" }),
  metric("forecast_overrun", "Forecast Overrun", "financial", "currency", "derived", "project forecast", "Sum of positive EAC minus BAC.", { direction: "lower-is-better" }),
  metric("benefits_realized", "Benefits Realized", "benefit", "currency", "sum", "project benefit", "Sum of converted realized benefits.", { missingDataPolicy: "not-calculable", direction: "higher-is-better" }),
  metric("benefits_projected", "Benefits Projected", "benefit", "currency", "sum", "project benefit", "Sum of converted projected benefits.", { missingDataPolicy: "not-calculable", direction: "higher-is-better" }),
  metric("portfolio_roi", "Portfolio ROI", "benefit", "ratio", "ratio-of-sums", "project benefit", "(Benefits - cost) divided by cost.", { missingDataPolicy: "not-calculable", direction: "higher-is-better" }),
  metric("budget_consumption", "Budget Consumption", "financial", "percent", "ratio-of-sums", "project financial snapshot", "Sum actual cost divided by sum approved budget.", { numeratorMetricId: "actual_cost", denominatorMetricId: "approved_budget", direction: "lower-is-better" }),

  metric("total_open_risks", "Total Open Risks", "risk", "count", "count-distinct", "risk", "Distinct open or mitigating risks.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("critical_risks", "Critical Risks", "risk", "count", "count-distinct", "risk", "Distinct open critical risks.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("high_risks", "High Risks", "risk", "count", "count-distinct", "risk", "Distinct open high risks.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("medium_risks", "Medium Risks", "risk", "count", "count-distinct", "risk", "Distinct open medium risks.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("low_risks", "Low Risks", "risk", "count", "count-distinct", "risk", "Distinct open low risks.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("unique_risks", "Unique Risks", "risk", "count", "count-distinct", "risk", "Risks deduplicated by canonical risk ID.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("projects_with_critical_risks", "Projects with Critical Risks", "risk", "count", "count-distinct", "project-risk relation", "Distinct affected projects with a critical risk.", { deduplicationKey: "project_id", direction: "lower-is-better" }),
  metric("gross_schedule_risk_days", "Gross Schedule Risk Days", "risk", "days", "sum", "unique risk", "Sum of unique risk schedule impact days.", { direction: "lower-is-better" }),
  metric("expected_risk_delay_days", "Expected Risk Delay Days", "risk", "days", "sum", "unique risk", "Sum of probability times schedule impact days.", { direction: "lower-is-better" }),
  metric("mitigated_expected_delay_days", "Mitigated Expected Delay Days", "risk", "days", "sum", "unique risk", "Sum of residual probability times residual schedule impact.", { direction: "lower-is-better" }),
  metric("gross_risk_cost", "Gross Risk Cost", "risk", "currency", "sum", "unique risk", "Sum of unique gross risk cost impacts.", { direction: "lower-is-better" }),
  metric("expected_risk_cost", "Expected Risk Cost", "risk", "currency", "sum", "unique risk", "Sum of probability times converted cost impact.", { direction: "lower-is-better" }),
  metric("residual_risk_exposure", "Residual Risk Exposure", "risk", "currency", "sum", "unique risk", "Sum of residual probability times converted residual cost impact.", { direction: "lower-is-better" }),
  metric("risk_trend", "Risk Trend", "risk", "score", "derived", "risk history", "Change in risk exposure compared with the previous period.", { missingDataPolicy: "not-calculable", direction: "lower-is-better" }),
  metric("risk_concentration", "Risk Concentration", "risk", "percent", "derived", "project-risk relation", "Largest project share of open high/critical risks.", { direction: "lower-is-better" }),
  metric("systemic_risks", "Systemic Risks", "risk", "count", "count-distinct", "risk", "Risks affecting more than one project.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),
  metric("cross_project_risks", "Cross-Project Risks", "risk", "count", "count-distinct", "risk", "Unique risks with multiple affected projects.", { deduplicationKey: "risk_id", direction: "lower-is-better" }),

  metric("total_resource_capacity", "Total Resource Capacity", "resource", "hours", "sum", "resource-period", "Available capacity deduplicated by resource and period."),
  metric("allocated_capacity", "Allocated Capacity", "resource", "hours", "sum", "resource-project-period", "Allocated hours summed once per authorized resource-project-period."),
  metric("available_capacity", "Available Capacity", "resource", "hours", "derived", "resource-period", "Positive capacity remaining after allocation."),
  metric("capacity_utilization", "Capacity Utilization", "resource", "percent", "ratio-of-sums", "resource-period", "Allocated hours divided by deduplicated available capacity.", { direction: "target-range" }),
  metric("overallocated_hours", "Overallocated Hours", "resource", "hours", "sum", "resource-period", "Sum of positive allocated minus available hours after person-period deduplication.", { direction: "lower-is-better" }),
  metric("overallocated_people", "Overallocated People", "resource", "count", "count-distinct", "resource-period", "Distinct resources overallocated in any included period.", { deduplicationKey: "resource_id", direction: "lower-is-better" }),
  metric("shared_resources", "Shared Resources", "resource", "count", "count-distinct", "resource-period", "Distinct resources allocated to multiple projects.", { deduplicationKey: "resource_id" }),
  metric("critical_skill_gaps", "Critical Skill Gaps", "resource", "count", "count-distinct", "resource-project-period", "Distinct critical skill gaps.", { direction: "lower-is-better" }),
  metric("vendor_capacity", "Vendor Capacity", "resource", "hours", "sum", "resource-period", "Deduplicated vendor capacity."),
  metric("resource_cost", "Resource Cost", "resource", "currency", "sum", "resource-project-period", "Converted resource cost."),
  metric("forecast_resource_demand", "Forecast Resource Demand", "resource", "hours", "sum", "resource-project-period", "Forecast demand hours."),

  metric("total_cases", "Total Cases", "process", "count", "count-distinct", "process case", "Distinct process cases.", { deduplicationKey: "case_id" }),
  metric("active_cases", "Active Cases", "process", "count", "count-distinct", "process case", "Distinct active process cases.", { deduplicationKey: "case_id" }),
  metric("completed_cases", "Completed Cases", "process", "count", "count-distinct", "process case", "Distinct completed process cases.", { deduplicationKey: "case_id" }),
  metric("event_count", "Event Count", "process", "count", "sum", "process case", "Canonical business events across eligible cases."),
  metric("dominant_variant_frequency", "Dominant Variant Frequency", "process", "percent", "derived", "process case", "Share of cases following the most common variant."),
  metric("average_cycle_time_days", "Average Cycle Time", "process", "days", "average", "completed process case", "Average completed-case cycle time.", { direction: "lower-is-better" }),
  metric("median_cycle_time_days", "Median Cycle Time", "process", "days", "median", "completed process case", "Median completed-case cycle time.", { direction: "lower-is-better" }),
  metric("p75_cycle_time_days", "P75 Cycle Time", "process", "days", "percentile", "completed process case", "75th percentile completed-case cycle time.", { direction: "lower-is-better" }),
  metric("p90_cycle_time_days", "P90 Cycle Time", "process", "days", "percentile", "completed process case", "90th percentile completed-case cycle time.", { direction: "lower-is-better" }),
  metric("average_lead_time_days", "Average Lead Time", "process", "days", "average", "process case", "Average lead time.", { direction: "lower-is-better" }),
  metric("average_waiting_time_days", "Average Waiting Time", "process", "days", "average", "process case", "Average explicit waiting time.", { direction: "lower-is-better" }),
  metric("rework_cases", "Rework Cases", "process", "count", "count-distinct", "process case", "Completed cases with rework.", { deduplicationKey: "case_id", direction: "lower-is-better" }),
  metric("rework_rate", "Rework Rate", "process", "percent", "ratio-of-sums", "completed process case", "Cases with rework divided by eligible completed cases.", { numeratorMetricId: "rework_cases", denominatorMetricId: "completed_cases", direction: "lower-is-better" }),
  metric("conformance_rate", "Conformance Rate", "process", "percent", "ratio-of-sums", "process case", "Conformant classified cases divided by classified cases.", { direction: "higher-is-better" }),
  metric("skipped_activities", "Skipped Activities", "process", "count", "sum", "process case", "Skipped activity occurrences.", { direction: "lower-is-better" }),
  metric("repeated_activities", "Repeated Activities", "process", "count", "sum", "process case", "Repeated activity occurrences.", { direction: "lower-is-better" }),
  metric("sla_violations", "SLA Violations", "process", "count", "count-distinct", "process case", "Cases with an explicit SLA violation.", { deduplicationKey: "case_id", direction: "lower-is-better" }),
  metric("process_data_completeness", "Process Data Completeness", "quality", "percent", "derived", "process case", "Cases with usable temporal evidence divided by cases.", { direction: "higher-is-better" }),
  metric("event_freshness_days", "Event Freshness", "quality", "days", "derived", "process event", "Days since the latest included process event.", { direction: "lower-is-better" }),
  metric("health_score", "Health Score", "quality", "score", "derived", "aggregate atomic metrics", "Versioned weighted score recalculated from atomic aggregate metrics.", { direction: "higher-is-better" }),
] as const;

export const PMO_METRICS_BY_ID = new Map(
  PMO_METRIC_REGISTRY.map((definition) => [definition.id, definition]),
);

export function getPmoMetricDefinition(id: string): PmoMetricDefinition {
  const definition = PMO_METRICS_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown PMO metric: ${id}`);
  return definition;
}
