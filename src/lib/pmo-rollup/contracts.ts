export const PMO_ROLLUP_CONTRACT_VERSION = 1;

export type PmoHierarchyLevel =
  | "organization"
  | "portfolio"
  | "program"
  | "project"
  | "workstream"
  | "milestone"
  | "activity";

export type PmoStageId =
  | "initiate"
  | "plan"
  | "execute"
  | "control"
  | "close"
  | "unmapped";

export type PmoMetricDomain =
  | "portfolio"
  | "schedule"
  | "financial"
  | "risk"
  | "resource"
  | "process"
  | "benefit"
  | "strategy"
  | "quality";

export type PmoMetricUnit =
  | "count"
  | "days"
  | "hours"
  | "percent"
  | "currency"
  | "ratio"
  | "score";

export type PmoAggregationMethod =
  | "sum"
  | "count-distinct"
  | "average"
  | "weighted-average"
  | "ratio-of-sums"
  | "minimum"
  | "maximum"
  | "median"
  | "percentile"
  | "derived"
  | "longest-path";

export type PmoMissingDataPolicy =
  | "exclude"
  | "zero"
  | "partial"
  | "not-calculable";

export type PmoMetricDirection =
  | "higher-is-better"
  | "lower-is-better"
  | "target-range";

export type PmoMetricStatus =
  | "complete"
  | "partial"
  | "estimated"
  | "not-calculable";

export type PmoProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export interface PmoStageMappingRule {
  source: "explicit" | "project-status" | "event-type" | "metadata";
  equals: string;
  stageId: PmoStageId;
  priority: number;
}

export interface PmoStageDefinition {
  id: PmoStageId;
  label: string;
  description: string;
  whyItMatters: string;
  includedActivities: string[];
  entryCriteria: string[];
  exitCriteria: string[];
  mappingRules: PmoStageMappingRule[];
  version: string;
}

export interface PmoMetricDefinition {
  id: string;
  name: string;
  description: string;
  domain: PmoMetricDomain;
  unit: PmoMetricUnit;
  aggregationMethod: PmoAggregationMethod;
  sourceGrain: string;
  numeratorMetricId?: string;
  denominatorMetricId?: string;
  weightMetricId?: string;
  deduplicationKey?: string;
  missingDataPolicy: PmoMissingDataPolicy;
  direction: PmoMetricDirection;
  formulaVersion: string;
}

export interface AggregatedMetricValue {
  metricId: string;
  value: number | null;
  unit: PmoMetricUnit;
  numerator?: number;
  denominator?: number;
  populationCount: number;
  eligibleCount: number;
  excludedCount: number;
  coveragePercent: number;
  confidenceScore: number;
  aggregationMethod: PmoAggregationMethod;
  formulaVersion: string;
  asOf: string;
  periodStart?: string;
  periodEnd?: string;
  reportingCurrency?: string;
  calendarType?: "business-days" | "calendar-days";
  status: PmoMetricStatus;
  sourceEntityIds: string[];
  excludedEntityIds?: string[];
  explanation: string;
}

export interface PmoMoneyValue {
  amount: number;
  currency: string;
  sourceId: string;
}

export interface PmoExchangeRate {
  id: string;
  organizationId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string;
}

export interface PmoProjectFact {
  factId: string;
  organizationId: string;
  projectId: string;
  portfolioId?: string | null;
  programId?: string | null;
  workstreamId?: string | null;
  name: string;
  status: PmoProjectStatus;
  currentStageId?: PmoStageId | null;
  stageSource?: "explicit" | "project-status" | "metadata" | null;
  completionPercent?: number | null;
  strategicWeight?: number | null;
  complexityWeight?: number | null;
  benefitValue?: PmoMoneyValue | null;
  baselineFinishDate?: string | null;
  forecastFinishDate?: string | null;
  updatedAt: string;
  effectiveAt: string;
  sourceReliability?: number;
}

export interface PmoFinancialFact {
  factId: string;
  organizationId: string;
  projectId: string;
  dataDate: string;
  originalBaseline?: PmoMoneyValue | null;
  currentBaseline?: PmoMoneyValue | null;
  approvedBudget?: PmoMoneyValue | null;
  bac?: PmoMoneyValue | null;
  committedCost?: PmoMoneyValue | null;
  actualCost?: PmoMoneyValue | null;
  accruedCost?: PmoMoneyValue | null;
  etc?: PmoMoneyValue | null;
  eac?: PmoMoneyValue | null;
  pv?: PmoMoneyValue | null;
  ev?: PmoMoneyValue | null;
  contingencyOriginal?: PmoMoneyValue | null;
  contingencyAvailable?: PmoMoneyValue | null;
  managementReserve?: PmoMoneyValue | null;
  burnRate?: PmoMoneyValue | null;
  cashFlowActual?: PmoMoneyValue | null;
  cashFlowForecast?: PmoMoneyValue | null;
  benefitsRealized?: PmoMoneyValue | null;
  benefitsProjected?: PmoMoneyValue | null;
  stageAllocations?: Partial<Record<PmoStageId, {
    approvedBudget?: PmoMoneyValue | null;
    actualCost?: PmoMoneyValue | null;
    committedCost?: PmoMoneyValue | null;
    accruedCost?: PmoMoneyValue | null;
    eac?: PmoMoneyValue | null;
  }>>;
  formulaVersion: string;
  sourceReliability?: number;
}

export interface PmoRiskFact {
  factId: string;
  organizationId: string;
  riskId: string;
  affectedProjectIds: string[];
  status: "open" | "mitigating" | "accepted" | "resolved" | "closed";
  severity: "critical" | "high" | "medium" | "low";
  probability?: number | null;
  scheduleImpactDays?: number | null;
  costImpact?: PmoMoneyValue | null;
  residualProbability?: number | null;
  residualScheduleImpactDays?: number | null;
  residualCostImpact?: PmoMoneyValue | null;
  stageId?: PmoStageId | null;
  effectiveAt: string;
  sourceReliability?: number;
}

export interface PmoResourcePeriodFact {
  factId: string;
  organizationId: string;
  projectId: string;
  resourceId: string;
  periodStart: string;
  periodEnd: string;
  availableHours: number;
  allocatedHours: number;
  forecastDemandHours?: number | null;
  resourceCost?: PmoMoneyValue | null;
  isVendor?: boolean;
  criticalSkillGap?: boolean;
  stageId?: PmoStageId | null;
  dataDate: string;
  sourceReliability?: number;
}

export interface PmoProcessCaseFact {
  factId: string;
  organizationId: string;
  projectId: string;
  caseId: string;
  stageId?: PmoStageId | null;
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
  bottleneckActivity?: string | null;
  startedAt: string;
  completedAt?: string | null;
  lastEventAt: string;
  sourceReliability?: number;
}

export interface PmoAccessContext {
  organizationId: string;
  scope: "admin" | "pmo" | "pm" | "team";
  authorizedProjectIds: string[];
  capabilities: string[];
}

export interface PmoHealthScoreConfiguration {
  version: string;
  weights: {
    schedule: number;
    financial: number;
    risk: number;
    delivery: number;
    resource: number;
    dataQuality: number;
  };
  thresholds: Record<string, number>;
}

export interface PmoDataQualitySummary {
  completeness: number;
  freshness: number;
  baselineAvailability: number;
  eventContinuity: number;
  sampleSufficiency: number;
  currencyConversionCoverage: number;
  evmCoverage: number;
  dateValidity: number;
  mappingCoverage: number;
  sourceReliability: number;
  overallScore: number;
  status: PmoMetricStatus;
  warnings: string[];
}

export interface PmoAggregationLineage {
  token: string;
  sourceFactIds: string[];
  excludedFactIds: string[];
  sourceTypes: string[];
  formulaVersions: Record<string, string>;
  filters: Record<string, unknown>;
  deduplicationRules: string[];
  exchangeRateIds: string[];
}

export interface PmoAggregateChild {
  hierarchyLevel: PmoHierarchyLevel;
  entityId: string;
  projectIds: string[];
  metricIds: string[];
}

export interface PmoAggregateAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  metricId: string;
  message: string;
  projectIds: string[];
}

export interface PmoStageAggregate {
  stageId: PmoStageId;
  definition: PmoStageDefinition;
  currentProjectCount: number;
  projectsActiveInPeriod: number;
  averageCycleTimeDays: number | null;
  medianCycleTimeDays: number | null;
  p90CycleTimeDays: number | null;
  accumulatedDelayDays: number;
  averageDelayLateProjects: number | null;
  projectsOutsideSla: number;
  reworkRate: number | null;
  approvedBudget: number | null;
  actualCost: number | null;
  committedCost: number | null;
  accruedCost: number | null;
  eac: number | null;
  forecastVariance: number | null;
  criticalRiskCount: number;
  expectedRiskDelayDays: number | null;
  expectedRiskCost: number | null;
  overallocatedResourceCount: number;
  capacityUtilization: number | null;
  healthScore: number | null;
  confidenceScore: number;
  projectIds: string[];
  warnings: string[];
}

export interface PmoHealthScoreResult {
  score: number | null;
  subscores: Record<keyof PmoHealthScoreConfiguration["weights"], number | null>;
  weights: PmoHealthScoreConfiguration["weights"];
  formula: string;
  configVersion: string;
  primaryDrivers: string[];
  previousPeriodChange: number | null;
  confidenceScore: number;
}

export interface PmoAggregateSnapshot {
  contractVersion: number;
  snapshotId: string;
  organizationId: string;
  hierarchyLevel: PmoHierarchyLevel;
  entityId?: string;
  stageId?: PmoStageId;
  asOf: string;
  periodStart: string;
  periodEnd: string;
  reportingCurrency: string;
  metrics: Record<string, AggregatedMetricValue>;
  stageAggregates: PmoStageAggregate[];
  childEntities: PmoAggregateChild[];
  alerts: PmoAggregateAlert[];
  processSummary: {
    dominantVariantId: string | null;
    bottleneckActivity: string | null;
    limitations: string[];
  };
  health: PmoHealthScoreResult;
  dataQuality: PmoDataQualitySummary;
  lineage: PmoAggregationLineage;
  formulaVersions: Record<string, string>;
  generatedAt: string;
}

export interface PmoRollupRequest {
  organizationId: string;
  hierarchyLevel: PmoHierarchyLevel;
  entityId?: string;
  stageId?: PmoStageId;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  reportingCurrency: string;
  calendarType?: "business-days" | "calendar-days";
  activeLayer?: "project-state" | "process-flow";
  filters?: Record<string, unknown>;
}

export interface PmoRollupInput {
  access: PmoAccessContext;
  projects: PmoProjectFact[];
  financialFacts?: PmoFinancialFact[];
  riskFacts?: PmoRiskFact[];
  resourceFacts?: PmoResourcePeriodFact[];
  processCases?: PmoProcessCaseFact[];
  exchangeRates?: PmoExchangeRate[];
  stageDefinitions?: PmoStageDefinition[];
  metricDefinitions?: PmoMetricDefinition[];
  healthConfiguration?: PmoHealthScoreConfiguration;
  minimumEvmCoverage?: number;
}

export interface IsabellaPmoAggregateContext {
  organizationId: string;
  snapshotId: string;
  hierarchyLevel: PmoHierarchyLevel;
  entityId?: string;
  stageId?: PmoStageId;
  visibleProjectCount: number;
  authorizedProjectCount: number;
  metrics: Record<string, AggregatedMetricValue>;
  activeFilters: Record<string, unknown>;
  dataQualityScore: number;
  asOf: string;
  formulaVersions: Record<string, string>;
}

export type IsabellaPmoAggregateFeedbackDecision =
  | "accepted"
  | "rejected"
  | "deferred";

export interface IsabellaPmoAggregateFeedbackRecord {
  feedbackId: string;
  organizationId: string;
  snapshotId: string;
  metricIds: string[];
  formulaVersions: Record<string, string>;
  question: string;
  answer: string;
  evidence: Array<{
    metricId: string;
    value: number | null;
    formulaVersion: string;
    asOf: string;
    explanation: string;
  }>;
  confidence: number;
  decision: IsabellaPmoAggregateFeedbackDecision;
  correction?: string;
  outcome?: string;
  recordedAt: string;
  knowledgeVersion: string;
}
