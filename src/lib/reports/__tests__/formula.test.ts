import { describe, it, expect } from "vitest";
import { evaluateFormula, validateFormula } from "../formula";

describe("evaluateFormula", () => {
  const row = { a: 10, b: 4, c: 0, n: null as number | null };

  it("does arithmetic with precedence and parentheses", () => {
    expect(evaluateFormula("a + b * 2", row)).toBe(18);
    expect(evaluateFormula("(a + b) * 2", row)).toBe(28);
    expect(evaluateFormula("a - b", row)).toBe(6);
    expect(evaluateFormula("a / b", row)).toBe(2.5);
    expect(evaluateFormula("-a + 1", row)).toBe(-9);
  });

  it("returns null on divide-by-zero and null operands", () => {
    expect(evaluateFormula("a / c", row)).toBeNull();
    expect(evaluateFormula("a + n", row)).toBeNull();
  });

  it("supports functions round/abs/min/max/coalesce/if", () => {
    expect(evaluateFormula("round(a / 3, 2)", row)).toBe(3.33);
    expect(evaluateFormula("abs(b - a)", row)).toBe(6);
    expect(evaluateFormula("min(a, b, 7)", row)).toBe(4);
    expect(evaluateFormula("max(a, b, 7)", row)).toBe(10);
    expect(evaluateFormula("coalesce(n, b)", row)).toBe(4);
    expect(evaluateFormula("if(a > b, 1, 0)", row)).toBe(1);
    expect(evaluateFormula("if(a < b, 1, 0)", row)).toBe(0);
  });

  it("computes a realistic variance-percent field", () => {
    const r = { estimated_cost: 8400, forecast_cost: 8950 };
    expect(evaluateFormula("(forecast_cost - estimated_cost) / estimated_cost * 100", r)).toBeCloseTo(6.5476, 3);
  });

  it("returns null for malformed input rather than throwing", () => {
    expect(evaluateFormula("a +", row)).toBeNull();
    expect(evaluateFormula("a ** b", row)).toBeNull();
    expect(evaluateFormula("drop table", row)).toBeNull();
  });
});

describe("validateFormula", () => {
  const cols = new Set(["estimated_cost", "forecast_cost", "actual_cost"]);

  it("accepts formulas over known columns", () => {
    expect(validateFormula("forecast_cost - estimated_cost", cols).ok).toBe(true);
    expect(validateFormula("round(actual_cost / estimated_cost * 100, 1)", cols).ok).toBe(true);
  });

  it("rejects unknown columns", () => {
    const v = validateFormula("forecast_cost - ghost_column", cols);
    expect(v.ok).toBe(false);
    expect(v.error).toContain("ghost_column");
  });

  it("rejects unknown functions and bad syntax", () => {
    expect(validateFormula("danger(estimated_cost)", cols).ok).toBe(false);
    expect(validateFormula("estimated_cost +", cols).ok).toBe(false);
  });

  it("reports referenced identifiers", () => {
    const v = validateFormula("forecast_cost - estimated_cost", cols);
    expect(v.identifiers.sort()).toEqual(["estimated_cost", "forecast_cost"]);
  });
});
