export const FINANCIAL_SETUP_COST_TYPES = [
  "labor",
  "software",
  "cloud",
  "subcontractor",
  "material",
  "equipment",
  "other",
] as const;

export const FINANCIAL_SETUP_RATE_UNITS = [
  "hour",
  "day",
  "week",
  "month",
  "unit",
  "fixed",
] as const;

export const FINANCIAL_SETUP_PERIOD_BASES = ["week", "biweek", "month", "one_time"] as const;

export type FinancialSetupCostType = (typeof FINANCIAL_SETUP_COST_TYPES)[number];
export type FinancialSetupRateUnit = (typeof FINANCIAL_SETUP_RATE_UNITS)[number];
export type FinancialSetupPeriodBasis = (typeof FINANCIAL_SETUP_PERIOD_BASES)[number];

export interface FinancialSetupLineInput {
  name: string;
  costType: FinancialSetupCostType;
  resourceName: string | null;
  controlAccountRef: string | null;
  cbsCode: string | null;
  wbsRef: string | null;
  quantity: number;
  quantityUnit: string;
  rate: number;
  rateUnit: FinancialSetupRateUnit;
  periodBasis: FinancialSetupPeriodBasis;
  periodCount: number;
  hoursPerPeriod: number | null;
}

export interface CalculatedFinancialSetupLine extends FinancialSetupLineInput {
  amount: number;
  plannedHours: number | null;
  amountPerPeriod: number;
  timePhasedAmounts: { period: number; amount: number }[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const CADENCE_WEEKS: Record<FinancialSetupPeriodBasis, number> = {
  week: 1,
  biweek: 2,
  month: 52 / 12,
  one_time: 1,
};

function rateToCadenceFactor(rateUnit: FinancialSetupRateUnit, periodBasis: FinancialSetupPeriodBasis): number {
  if (rateUnit === "week") return CADENCE_WEEKS[periodBasis];
  if (rateUnit === "month") return CADENCE_WEEKS[periodBasis] / (52 / 12);
  return 1;
}

export function calculateFinancialSetupLine(line: FinancialSetupLineInput): CalculatedFinancialSetupLine {
  const periodCount = Math.max(1, line.periodCount);
  const quantity = Math.max(0, line.quantity);
  const rate = Math.max(0, line.rate);
  const amountPerPeriod = line.rateUnit === "fixed"
    ? rate
    : quantity * rate * rateToCadenceFactor(line.rateUnit, line.periodBasis);
  const amount = line.rateUnit === "fixed" ? rate : amountPerPeriod * periodCount;
  const plannedHours = line.hoursPerPeriod != null
    ? line.hoursPerPeriod * periodCount
    : line.costType === "labor" && line.rateUnit === "hour"
      ? quantity * periodCount
      : null;

  return {
    ...line,
    quantity,
    rate,
    periodCount,
    amount: roundMoney(amount),
    amountPerPeriod: roundMoney(amountPerPeriod),
    plannedHours: plannedHours == null ? null : roundMoney(plannedHours),
    timePhasedAmounts: Array.from({ length: periodCount }, (_, index) => ({
      period: index + 1,
      amount: roundMoney(amountPerPeriod),
    })),
  };
}

export function calculateFinancialSetupTotal(lines: FinancialSetupLineInput[]): number {
  return roundMoney(lines.reduce((total, line) => total + calculateFinancialSetupLine(line).amount, 0));
}
