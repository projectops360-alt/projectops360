import type {
  PmoAccessContext,
  PmoExchangeRate,
  PmoFinancialFact,
  PmoMoneyValue,
  PmoProcessCaseFact,
  PmoProjectFact,
  PmoResourcePeriodFact,
  PmoRiskFact,
  PmoRollupInput,
  PmoRollupRequest,
} from "../contracts";

export const ORG_A = "org-a";
export const ORG_B = "org-b";

export const BASE_REQUEST: PmoRollupRequest = {
  organizationId: ORG_A,
  hierarchyLevel: "organization",
  periodStart: "2026-01-01",
  periodEnd: "2026-03-31",
  asOf: "2026-03-31T23:59:59.000Z",
  reportingCurrency: "USD",
  calendarType: "business-days",
};

export const PMO_ACCESS: PmoAccessContext = {
  organizationId: ORG_A,
  scope: "pmo",
  authorizedProjectIds: ["p-a", "p-b", "p-c", "p-d"],
  capabilities: ["financial.view"],
};

export function money(
  amount: number,
  currency = "USD",
  sourceId = `${currency}:${amount}`,
): PmoMoneyValue {
  return { amount, currency, sourceId };
}

export function project(
  projectId: string,
  overrides: Partial<PmoProjectFact> = {},
): PmoProjectFact {
  return {
    factId: `project:${projectId}:2026-01-01`,
    organizationId: ORG_A,
    projectId,
    portfolioId: "portfolio-1",
    programId: "program-1",
    name: projectId,
    status: "active",
    completionPercent: 50,
    baselineFinishDate: "2026-01-05",
    forecastFinishDate: "2026-01-05",
    updatedAt: "2026-01-01T00:00:00.000Z",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    sourceReliability: 1,
    ...overrides,
  };
}

export function financial(
  projectId: string,
  overrides: Partial<PmoFinancialFact> = {},
): PmoFinancialFact {
  return {
    factId: `financial:${projectId}:2026-03-01`,
    organizationId: ORG_A,
    projectId,
    dataDate: "2026-03-01",
    approvedBudget: money(100, "USD", `${projectId}:approved`),
    bac: money(100, "USD", `${projectId}:bac`),
    actualCost: money(50, "USD", `${projectId}:actual`),
    pv: money(50, "USD", `${projectId}:pv`),
    ev: money(50, "USD", `${projectId}:ev`),
    formulaVersion: "fixture-evm-1",
    sourceReliability: 1,
    ...overrides,
  };
}

export function scheduleFixture(): PmoRollupInput {
  return {
    access: PMO_ACCESS,
    projects: [
      project("p-a", {
        baselineFinishDate: "2026-01-05",
        forecastFinishDate: "2026-01-19",
      }),
      project("p-b"),
      project("p-c", {
        baselineFinishDate: "2026-01-05",
        forecastFinishDate: "2026-02-02",
      }),
      project("p-d", {
        baselineFinishDate: "2026-01-12",
        forecastFinishDate: "2026-01-05",
      }),
    ],
  };
}

export function cpiFixture(
  equalAverage = false,
): PmoRollupInput {
  const secondEv = equalAverage ? 200 : 90;
  const secondAc = equalAverage ? 100 : 50;
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b"] },
    projects: [project("p-a"), project("p-b")],
    financialFacts: [
      financial("p-a", {
        ev: money(equalAverage ? 50 : 10, "USD", "p-a:ev"),
        actualCost: money(equalAverage ? 100 : 20, "USD", "p-a:ac"),
      }),
      financial("p-b", {
        ev: money(secondEv, "USD", "p-b:ev"),
        actualCost: money(secondAc, "USD", "p-b:ac"),
      }),
    ],
  };
}

export function weightedProgressFixture(): PmoRollupInput {
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b"] },
    projects: [
      project("p-a", { completionPercent: 90 }),
      project("p-b", { completionPercent: 20 }),
    ],
    financialFacts: [
      financial("p-a", { bac: money(100, "USD", "p-a:bac"), ev: null }),
      financial("p-b", { bac: money(900, "USD", "p-b:bac"), ev: null }),
    ],
  };
}

export function sharedRiskFixture(): PmoRollupInput {
  const shared = (projectId: string): PmoRiskFact => ({
    factId: `shared-risk:${projectId}`,
    organizationId: ORG_A,
    riskId: "risk-shared",
    affectedProjectIds: [projectId],
    status: "open",
    severity: "critical",
    probability: 0.5,
    scheduleImpactDays: 20,
    costImpact: money(1_000, "USD", "risk-shared:cost"),
    residualProbability: 0.2,
    residualScheduleImpactDays: 10,
    effectiveAt: "2026-03-01T00:00:00.000Z",
    sourceReliability: 1,
  });
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b", "p-c"] },
    projects: [project("p-a"), project("p-b"), project("p-c")],
    riskFacts: [shared("p-a"), shared("p-b"), shared("p-c")],
  };
}

export function financialSeparationFixture(): PmoRollupInput {
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a"] },
    projects: [project("p-a")],
    financialFacts: [
      financial("p-a", {
        currentBaseline: money(1_000, "USD", "baseline"),
        approvedBudget: money(1_000, "USD", "budget"),
        bac: money(1_000, "USD", "bac"),
        committedCost: money(200, "USD", "commitment"),
        actualCost: money(100, "USD", "actual"),
        accruedCost: money(50, "USD", "accrual"),
        etc: money(600, "USD", "etc"),
        eac: money(700, "USD", "eac"),
        pv: money(300, "USD", "pv"),
        ev: money(250, "USD", "ev"),
      }),
    ],
  };
}

export function multiCurrencyFixture(includeRate = true): PmoRollupInput {
  const rates: PmoExchangeRate[] = includeRate
    ? [{
        id: "fx-eur-usd-2026-03-01",
        organizationId: ORG_A,
        fromCurrency: "EUR",
        toCurrency: "USD",
        rate: 1.2,
        effectiveDate: "2026-03-01",
        source: "fixture",
      }]
    : [];
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b"] },
    projects: [project("p-a"), project("p-b")],
    financialFacts: [
      financial("p-a", {
        approvedBudget: money(100, "USD", "p-a:budget"),
      }),
      financial("p-b", {
        approvedBudget: money(100, "EUR", "p-b:budget"),
        bac: money(100, "EUR", "p-b:bac"),
        actualCost: money(50, "EUR", "p-b:actual"),
        pv: money(50, "EUR", "p-b:pv"),
        ev: money(50, "EUR", "p-b:ev"),
      }),
    ],
    exchangeRates: rates,
  };
}

export function missingDataFixture(): PmoRollupInput {
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b"] },
    projects: [
      project("p-a"),
      project("p-b", { baselineFinishDate: null }),
    ],
  };
}

export function resourceFixture(): PmoRollupInput {
  const resource = (
    factId: string,
    projectId: string,
    resourceId: string,
    availableHours: number,
    allocatedHours: number,
  ): PmoResourcePeriodFact => ({
    factId,
    organizationId: ORG_A,
    projectId,
    resourceId,
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
    availableHours,
    allocatedHours,
    dataDate: "2026-03-15",
    sourceReliability: 1,
  });
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b"] },
    projects: [project("p-a"), project("p-b")],
    resourceFacts: [
      resource("r1-a", "p-a", "r1", 40, 30),
      resource("r1-b", "p-b", "r1", 40, 30),
      resource("r2-a", "p-a", "r2", 40, 20),
    ],
  };
}

export function processFixture(): PmoRollupInput {
  const processCase = (
    caseId: string,
    overrides: Partial<PmoProcessCaseFact> = {},
  ): PmoProcessCaseFact => ({
    factId: `case:${caseId}`,
    organizationId: ORG_A,
    projectId: "p-a",
    caseId,
    stageId: "execute",
    status: "completed",
    variantId: "variant-1",
    eventCount: 5,
    cycleTimeDays: 10,
    leadTimeDays: 12,
    waitingTimeDays: 2,
    hasRework: false,
    repeatedActivityCount: 0,
    skippedActivityCount: 0,
    conformant: true,
    slaViolated: false,
    startedAt: "2026-03-01T00:00:00.000Z",
    completedAt: "2026-03-10T00:00:00.000Z",
    lastEventAt: "2026-03-10T00:00:00.000Z",
    sourceReliability: 1,
    ...overrides,
  });
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a"] },
    projects: [project("p-a")],
    processCases: [
      processCase("c1", { hasRework: true, repeatedActivityCount: 2 }),
      processCase("c2", { variantId: "variant-1" }),
      processCase("c3", {
        status: "active",
        variantId: "variant-2",
        completedAt: null,
        cycleTimeDays: null,
        stageId: null,
      }),
    ],
  };
}

export function hierarchyFixture(): PmoRollupInput {
  return {
    access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-b", "p-c"] },
    projects: [
      project("p-a", { portfolioId: "portfolio-1", programId: "program-1" }),
      project("p-b", { portfolioId: "portfolio-1", programId: "program-1" }),
      project("p-c", { portfolioId: "portfolio-2", programId: "program-2" }),
    ],
    financialFacts: [
      financial("p-a", { approvedBudget: money(100) }),
      financial("p-b", { approvedBudget: money(200) }),
      financial("p-c", { approvedBudget: money(300) }),
    ],
    riskFacts: sharedRiskFixture().riskFacts?.map((risk) => ({
      ...risk,
      affectedProjectIds: risk.factId.endsWith("p-b") ? ["p-c"] : risk.affectedProjectIds,
    })),
  };
}
