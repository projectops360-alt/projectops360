import type {
  PmoFinancialFact,
  PmoMoneyValue,
  PmoProcessCaseFact,
  PmoProjectFact,
  PmoResourcePeriodFact,
  PmoRiskFact,
  PmoStageId,
} from "./contracts";

export interface CanonicalProjectRow {
  id: string;
  organization_id: string;
  name: string;
  status: PmoProjectFact["status"];
  updated_at: string;
  created_at?: string | null;
  target_end_date?: string | null;
  portfolio_id?: string | null;
  program_id?: string | null;
  workstream_id?: string | null;
  current_stage_id?: PmoStageId | null;
  completion_percent?: number | null;
  strategic_weight?: number | null;
  baseline_finish_date?: string | null;
  forecast_finish_date?: string | null;
}

export interface FinancialCockpitAdapterRow {
  organization_id: string;
  project_id: string;
  currency: string | null;
  data_date: string | null;
  original_budget: number | string | null;
  current_baseline: number | string | null;
  authorized_funding: number | string | null;
  current_commitment: number | string | null;
  actual_cost: number | string | null;
  open_accrual: number | string | null;
  remaining_reserve: number | string | null;
  latest_eac: number | string | null;
}

export interface FinancialMeasurementAdapterRow {
  id: string;
  organization_id: string;
  project_id: string;
  data_date: string;
  formula_version: string;
  currency: string;
  bac: number | string | null;
  pv: number | string | null;
  ev: number | string | null;
  ac: number | string | null;
}

export function adaptProjectRows(rows: readonly CanonicalProjectRow[]): PmoProjectFact[] {
  return rows.map((row) => ({
    factId: `project:${row.id}:${row.updated_at}`,
    organizationId: row.organization_id,
    projectId: row.id,
    portfolioId: row.portfolio_id ?? null,
    programId: row.program_id ?? null,
    workstreamId: row.workstream_id ?? null,
    name: row.name,
    status: row.status,
    currentStageId: row.current_stage_id ?? null,
    stageSource: row.current_stage_id ? "explicit" : "project-status",
    completionPercent: row.completion_percent ?? null,
    strategicWeight: row.strategic_weight ?? null,
    baselineFinishDate: row.baseline_finish_date ?? null,
    forecastFinishDate: row.forecast_finish_date ?? row.target_end_date ?? null,
    updatedAt: row.updated_at,
    effectiveAt: row.updated_at,
    sourceReliability: 1,
  }));
}

export function adaptFinancialRows(
  cockpitRows: readonly FinancialCockpitAdapterRow[],
  measurements: readonly FinancialMeasurementAdapterRow[],
  asOf?: string,
): PmoFinancialFact[] {
  const cutoff = asOf?.slice(0, 10);
  const cockpitByProject = new Map(
    cockpitRows
      .filter((row) => !cutoff || (row.data_date != null && row.data_date <= cutoff))
      .map((row) => [row.project_id, row]),
  );
  const latestMeasurementByProject = new Map<string, FinancialMeasurementAdapterRow>();
  for (const measurement of measurements) {
    if (cutoff && measurement.data_date > cutoff) continue;
    const existing = latestMeasurementByProject.get(measurement.project_id);
    if (
      !existing
      || measurement.data_date > existing.data_date
      || (measurement.data_date === existing.data_date && measurement.id > existing.id)
    ) {
      latestMeasurementByProject.set(measurement.project_id, measurement);
    }
  }
  const projects = new Set([
    ...cockpitByProject.keys(),
    ...latestMeasurementByProject.keys(),
  ]);
  const output: PmoFinancialFact[] = [];

  for (const projectId of projects) {
    const cockpit = cockpitByProject.get(projectId);
    const measurement = latestMeasurementByProject.get(projectId);
    const organizationId = measurement?.organization_id ?? cockpit?.organization_id;
    if (!organizationId) continue;
    const currency = measurement?.currency ?? cockpit?.currency ?? "USD";
    const dataDate = [measurement?.data_date, cockpit?.data_date]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? "1970-01-01";
    output.push({
      factId: measurement?.id ?? `financial-cockpit:${projectId}:${dataDate}`,
      organizationId,
      projectId,
      dataDate,
      originalBaseline: money(cockpit?.original_budget, cockpit?.currency, `${projectId}:original-baseline`),
      currentBaseline: money(cockpit?.current_baseline, cockpit?.currency, `${projectId}:current-baseline`),
      approvedBudget: money(cockpit?.current_baseline, cockpit?.currency, `${projectId}:approved-budget`),
      bac: money(measurement?.bac, currency, `${projectId}:bac:${dataDate}`),
      committedCost: money(cockpit?.current_commitment, cockpit?.currency, `${projectId}:commitment`),
      actualCost: money(measurement?.ac ?? cockpit?.actual_cost, currency, `${projectId}:actual:${dataDate}`),
      accruedCost: money(cockpit?.open_accrual, cockpit?.currency, `${projectId}:accrual`),
      eac: money(cockpit?.latest_eac, cockpit?.currency, `${projectId}:eac`),
      pv: money(measurement?.pv, currency, `${projectId}:pv:${dataDate}`),
      ev: money(measurement?.ev, currency, `${projectId}:ev:${dataDate}`),
      managementReserve: money(cockpit?.remaining_reserve, cockpit?.currency, `${projectId}:reserve`),
      formulaVersion: measurement?.formula_version ?? "financial-cockpit-v1",
      sourceReliability: measurement ? 1 : 0.8,
    });
  }
  return output;
}

export function adaptRiskRows(rows: readonly {
  id: string;
  organization_id: string;
  project_id: string;
  status: PmoRiskFact["status"];
  severity: PmoRiskFact["severity"];
  probability?: string | number | null;
  confidence_score?: number | string | null;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
}[]): PmoRiskFact[] {
  return rows.map((row) => {
    const metadata = row.metadata ?? {};
    const affectedProjectIds = stringArray(metadata.affected_project_ids);
    return {
      factId: `risk:${row.id}:${row.project_id}:${row.updated_at}`,
      organizationId: row.organization_id,
      riskId: row.id,
      affectedProjectIds: [...new Set([row.project_id, ...affectedProjectIds])],
      status: row.status,
      severity: row.severity,
      probability: probability(row.probability),
      scheduleImpactDays: finite(metadata.schedule_impact_days),
      costImpact: money(metadata.cost_impact, string(metadata.currency), `risk:${row.id}:cost`),
      residualProbability: finite(metadata.residual_probability),
      residualScheduleImpactDays: finite(metadata.residual_schedule_impact_days),
      residualCostImpact: money(
        metadata.residual_cost_impact,
        string(metadata.currency),
        `risk:${row.id}:residual-cost`,
      ),
      stageId: stage(metadata.stage_id),
      effectiveAt: row.updated_at,
      sourceReliability: finite(row.confidence_score) ?? 0.8,
    };
  });
}

export function adaptResourceRows(rows: readonly {
  id: string;
  organization_id: string;
  project_id: string;
  resource_profile_id: string | null;
  resource_key: string | null;
  period_start: string;
  period_end: string;
  effective_capacity_hours: number | string;
  assigned_work_hours: number | string;
  overallocated_hours?: number | string | null;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
}[]): PmoResourcePeriodFact[] {
  return rows.map((row) => ({
    factId: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    resourceId: row.resource_profile_id ?? row.resource_key ?? row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    availableHours: finite(row.effective_capacity_hours) ?? 0,
    allocatedHours: finite(row.assigned_work_hours) ?? 0,
    forecastDemandHours: finite(row.metadata?.forecast_demand_hours),
    isVendor: row.metadata?.resource_type === "vendor",
    criticalSkillGap: row.metadata?.critical_skill_gap === true,
    stageId: stage(row.metadata?.stage_id),
    dataDate: row.updated_at,
    sourceReliability: 1,
  }));
}

export function adaptProcessCases(rows: readonly {
  factId: string;
  organizationId: string;
  projectId: string;
  caseId: string;
  stageId?: string | null;
  status: "active" | "completed";
  variantId?: string | null;
  eventCount: number;
  cycleTimeDays?: number | null;
  leadTimeDays?: number | null;
  waitingTimeDays?: number | null;
  hasRework: boolean;
  repeatedActivityCount?: number;
  skippedActivityCount?: number;
  conformant?: boolean | null;
  slaViolated?: boolean | null;
  startedAt: string;
  completedAt?: string | null;
  lastEventAt: string;
}[]): PmoProcessCaseFact[] {
  return rows.map((row) => ({
    ...row,
    stageId: stage(row.stageId),
    sourceReliability: 1,
  }));
}

function money(
  value: unknown,
  currencyValue: string | null | undefined,
  sourceId: string,
): PmoMoneyValue | null {
  const amount = finite(value);
  return amount == null
    ? null
    : { amount, currency: currencyValue || "USD", sourceId };
}

function finite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function probability(value: unknown): number | null {
  const numeric = finite(value);
  if (numeric != null) return numeric > 1 ? numeric / 100 : numeric;
  if (value === "low") return 0.25;
  if (value === "medium") return 0.5;
  if (value === "high") return 0.75;
  return null;
}

function stage(value: unknown): PmoStageId | null {
  return ["initiate", "plan", "execute", "control", "close", "unmapped"].includes(String(value))
    ? value as PmoStageId
    : null;
}
