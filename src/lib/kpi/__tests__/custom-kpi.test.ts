// ============================================================================
// CAP-046 F3 Fase 2 — custom KPI definition validation tests.
// Guard id: KPI-ENGINE-CUSTOM-DEFINITIONS — never persist an expression that
// fails the sandbox allow-list; slug/target/precision normalization.
// ============================================================================

import { describe, it, expect } from "vitest";
import { isOnTarget, slugFromName, validateCustomKpiInput } from "../custom";

const base = {
  nameEn: "Critical overdue share",
  nameEs: "Proporción de vencidas críticas",
  expression: "100 * SUM(open_overdue_flag) / COUNT(critical_flag)",
};

describe("KPI-ENGINE-CUSTOM-DEFINITIONS", () => {
  it("accepts a valid definition and derives the slug from the English name", () => {
    const result = validateCustomKpiInput(base);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalized.slug).toBe("critical_overdue_share");
      expect(result.normalized.expression).toBe(base.expression);
    }
  });

  it("REJECTS expressions outside the sandbox allow-list (never persisted)", () => {
    const bad = validateCustomKpiInput({ ...base, expression: "SUM(salaries)" });
    expect(bad.valid).toBe(false);
    if (!bad.valid) expect(bad.error).toContain('"salaries"');

    const evil = validateCustomKpiInput({
      ...base,
      expression: "constructor.constructor('return 1')()",
    });
    expect(evil.valid).toBe(false);
  });

  it("validates slug format, names, precision, unit and target coherence", () => {
    expect(validateCustomKpiInput({ ...base, slug: "9bad" }).valid).toBe(false);
    expect(validateCustomKpiInput({ ...base, nameEn: "ab" }).valid).toBe(false);
    expect(validateCustomKpiInput({ ...base, precision: 7 }).valid).toBe(false);
    expect(validateCustomKpiInput({ ...base, unit: "x".repeat(21) }).valid).toBe(false);
    // A target without direction is ambiguous → rejected.
    expect(validateCustomKpiInput({ ...base, target: 10 }).valid).toBe(false);
    expect(
      validateCustomKpiInput({ ...base, target: 10, targetDirection: "at_or_below" }).valid,
    ).toBe(true);
  });

  it("slugFromName normalizes accents and leading digits", () => {
    expect(slugFromName("Duración Média (p90)")).toBe("duracion_media_p90");
    expect(slugFromName("90th percentile")).toBe("k90th_percentile");
  });

  it("isOnTarget respects direction and returns null without a target", () => {
    expect(isOnTarget(95, 90, "at_or_above")).toBe(true);
    expect(isOnTarget(85, 90, "at_or_above")).toBe(false);
    expect(isOnTarget(3, 5, "at_or_below")).toBe(true);
    expect(isOnTarget(NaN, 5, "at_or_below")).toBeNull();
    expect(isOnTarget(3, null, null)).toBeNull();
  });
});
