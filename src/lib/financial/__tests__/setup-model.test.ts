import { describe, expect, it } from "vitest";
import { calculateFinancialSetupLine, calculateFinancialSetupTotal } from "../setup-model";

describe("financial setup cost model", () => {
  it("calculates total labor from hours and an hourly rate", () => {
    const result = calculateFinancialSetupLine({
      name: "SAP functional consultant",
      costType: "labor",
      resourceName: "SAP functional consultant",
      controlAccountRef: null,
      cbsCode: "LABOR",
      wbsRef: "1.2",
      quantity: 100,
      quantityUnit: "hours",
      rate: 145,
      rateUnit: "hour",
      periodBasis: "month",
      periodCount: 12,
      hoursPerPeriod: 100,
    });

    expect(result.amount).toBe(174000);
    expect(result.plannedHours).toBe(1200);
    expect(result.timePhasedAmounts).toHaveLength(12);
  });

  it("calculates recurring weekly or monthly rates by period count", () => {
    const result = calculateFinancialSetupLine({
      name: "Implementation partner",
      costType: "subcontractor",
      resourceName: "Implementation partner",
      controlAccountRef: null,
      cbsCode: "PARTNER",
      wbsRef: null,
      quantity: 1,
      quantityUnit: "team",
      rate: 12000,
      rateUnit: "month",
      periodBasis: "month",
      periodCount: 6,
      hoursPerPeriod: null,
    });

    expect(result.amount).toBe(72000);
    expect(result.amountPerPeriod).toBe(12000);
  });

  it("converts a weekly rate into a biweekly cadence", () => {
    const result = calculateFinancialSetupLine({
      name: "SAP technical lead",
      costType: "labor",
      resourceName: "SAP technical lead",
      controlAccountRef: null,
      cbsCode: null,
      wbsRef: null,
      quantity: 1,
      quantityUnit: "person",
      rate: 4000,
      rateUnit: "week",
      periodBasis: "biweek",
      periodCount: 4,
      hoursPerPeriod: 80,
    });

    expect(result.amount).toBe(32000);
    expect(result.plannedHours).toBe(320);
  });

  it("sums lines without rounding drift", () => {
    expect(calculateFinancialSetupTotal([
      {
        name: "License",
        costType: "software",
        resourceName: null,
        controlAccountRef: null,
        cbsCode: null,
        wbsRef: null,
        quantity: 3,
        quantityUnit: "units",
        rate: 199.99,
        rateUnit: "unit",
        periodBasis: "one_time",
        periodCount: 1,
        hoursPerPeriod: null,
      },
      {
        name: "Training",
        costType: "labor",
        resourceName: null,
        controlAccountRef: null,
        cbsCode: null,
        wbsRef: null,
        quantity: 2,
        quantityUnit: "weeks",
        rate: 1000,
        rateUnit: "unit",
        periodBasis: "one_time",
        periodCount: 2,
        hoursPerPeriod: null,
      },
    ])).toBe(4599.97);
  });
});
