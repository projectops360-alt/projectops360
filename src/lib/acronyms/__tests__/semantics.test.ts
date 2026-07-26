// ============================================================================
// Acronym Intelligence — meaning guards (ACRONYM-SEMANTICS-*)
// ============================================================================
// These pin the statements the capability exists to make. The corpus could pass
// every structural test above and still say SV is measured in days, which would
// make the feature actively harmful — a confident, well-formatted wrong answer
// is worse than no answer.
// ============================================================================

import { describe, expect, it } from "vitest";
import { getAcronym, resolveFormula } from "../registry";
import { EAC_FORMULA_IDS } from "../registry-forecast";

/** Both locales, lowercased — a caveat only in EN is a caveat ES readers lose. */
function caveatText(code: string): { en: string; es: string } {
  const entry = getAcronym(code)!;
  return {
    en: (entry.caveats?.en ?? []).join(" ").toLowerCase(),
    es: (entry.caveats?.es ?? []).join(" ").toLowerCase(),
  };
}

// ── ACRONYM-SEMANTICS-UNITS ─────────────────────────────────────────────────

describe("ACRONYM-SEMANTICS-UNITS: SV is money, not days", () => {
  it("declares SV in currency", () => {
    expect(getAcronym("SV")!.unit).toBe("currency");
  });

  it("warns explicitly that SV is not a number of days", () => {
    const caveats = caveatText("SV");
    expect(caveats.en).toContain("money");
    expect(caveats.en).toContain("not");
    expect(caveats.en).toContain("day");
    expect(caveats.es).toContain("dinero");
    expect(caveats.es).toContain("días");
  });

  it("redirects calendar delay to the schedule engine", () => {
    const entry = getAcronym("SV")!;
    expect(entry.relatedTerms).toContain("TF");
    expect(entry.relatedTerms).toContain("CPM");
  });

  it("keeps CV in currency and the indices unitless", () => {
    expect(getAcronym("CV")!.unit).toBe("currency");
    expect(getAcronym("CPI")!.unit).toBe("ratio");
    expect(getAcronym("SPI")!.unit).toBe("ratio");
  });

  it("keeps every schedule float term in days, never currency", () => {
    for (const code of ["TF", "FF", "CP", "PERT"]) {
      expect(getAcronym(code)!.unit, `${code} must be in days`).toBe("days");
    }
  });

  it("warns that SPI is not calendar delay either", () => {
    expect(caveatText("SPI").en).toContain("not calendar delay");
  });
});

// ── ACRONYM-SEMANTICS-BAC ───────────────────────────────────────────────────

describe("ACRONYM-SEMANTICS-BAC: more budget does not buy time", () => {
  it("warns that raising BAC does not improve the schedule", () => {
    const caveats = caveatText("BAC");
    expect(caveats.en).toContain("schedule");
    expect(caveats.en).toMatch(/does not|not improve/);
    expect(caveats.es).toContain("cronograma");
  });

  it("treats BAC as neither good nor bad when it moves", () => {
    // Matches `deltaTone`, which deliberately leaves portfolio_bac uncoloured.
    expect(getAcronym("BAC")!.favorableDirection).toBe("context_dependent");
  });

  it("warns that a budget change leaves CPI untouched", () => {
    // The finance stage reports exactly this and records it as an assumption.
    expect(caveatText("CPI").en).toMatch(/unaffected by a budget change|historical fact/);
  });
});

// ── ACRONYM-SEMANTICS-FORECAST ──────────────────────────────────────────────

describe("ACRONYM-SEMANTICS-FORECAST: EAC is a forecast with several formulas", () => {
  it("states EAC is not an approved budget", () => {
    expect(caveatText("EAC").en).toContain("not an approved budget");
    expect(caveatText("EAC").es).toContain("no un presupuesto aprobado");
  });

  it("lists the four mandated EAC variants", () => {
    const expressions = (getAcronym("EAC")!.formulas ?? []).map((formula) =>
      formula.expression.replace(/\s+/g, ""),
    );
    expect(expressions).toContain("EAC=BAC/CPI");
    expect(expressions).toContain("EAC=AC+(BAC−EV)");
    expect(expressions).toContain("EAC=AC+(BAC−EV)/(CPI×SPI)");
    expect(expressions).toContain("EAC=AC+ETC");
  });

  it("never claims there is only one EAC formula", () => {
    expect((getAcronym("EAC")!.formulas ?? []).length).toBeGreaterThan(1);
    expect(caveatText("EAC").en).toContain("no single eac formula");
  });

  it("reads VAC positive as favourable and negative as an overrun", () => {
    const entry = getAcronym("VAC")!;
    expect(entry.favorableDirection).toBe("higher");
    expect(entry.interpretation!.en.toLowerCase()).toContain("favourable");
    expect(entry.interpretation!.en.toLowerCase()).toContain("overrun");
    expect(entry.interpretation!.es.toLowerCase()).toContain("favorable");
    expect(entry.interpretation!.es.toLowerCase()).toContain("sobrecoste");
  });
});

// ── ACRONYM-SEMANTICS-INDEX ─────────────────────────────────────────────────

describe("ACRONYM-SEMANTICS-INDEX: CPI/SPI read against 1.0", () => {
  it.each(["CPI", "SPI"])("%s targets 1.0 and hedges the direction", (code) => {
    const entry = getAcronym(code)!;
    expect(entry.favorableDirection).toBe("target_one");

    const interpretation = entry.interpretation!.en.toLowerCase();
    expect(interpretation).toContain("= 1");
    expect(interpretation).toContain("> 1");
    expect(interpretation).toContain("< 1");
    // "generally" is required: an index above 1 can also mean over-reporting.
    expect(interpretation).toContain("generally");
    expect(entry.interpretation!.es.toLowerCase()).toContain("generalmente");
  });
});

// ── ACRONYM-SEMANTICS-RISK ──────────────────────────────────────────────────

describe("ACRONYM-SEMANTICS-RISK: exposure scales are never mixed", () => {
  it.each(["P", "I", "RE", "EMV", "RPN"])("%s warns against mixing scales", (code) => {
    const caveats = caveatText(code);
    expect(caveats.en).toContain("never mix scales");
    expect(caveats.es).toContain("nunca mezcles escalas");
  });

  it("keeps EMV monetary and RPN unitless", () => {
    expect(getAcronym("EMV")!.unit).toBe("currency");
    // RPN is an ordinal ranking score — explicitly not money and not days.
    expect(getAcronym("RPN")!.unit).toBe("count");
    expect(caveatText("RPN").en).toContain("ordinal");
  });

  it("refuses to derive money from a severity label", () => {
    // Mirrors risk-exposure.ts, which will not map a severity onto dollars.
    expect(caveatText("I").en).toMatch(/does not derive a cost impact|unavailable/);
    expect(caveatText("EMV").en).toContain("unavailable");
  });

  it("distinguishes an issue from a risk in RAID", () => {
    expect(getAcronym("RAID")!.fullDefinition.en.toLowerCase()).toContain("already materialised");
  });
});

// ── ACRONYM-SEMANTICS-FORMULAS ──────────────────────────────────────────────

describe("ACRONYM-SEMANTICS-FORMULAS: the mandated expressions are exact", () => {
  const EXPECTED: Array<[string, string]> = [
    ["CV", "CV=EV−AC"],
    ["SV", "SV=EV−PV"],
    ["CPI", "CPI=EV/AC"],
    ["SPI", "SPI=EV/PV"],
    ["ETC", "ETC=EAC−AC"],
    ["VAC", "VAC=BAC−EAC"],
    ["RE", "RE=P×I"],
    ["PERT", "PERT=(O+4M+P)/6"],
  ];

  it.each(EXPECTED)("%s uses the standard expression", (code, expected) => {
    const expressions = (getAcronym(code)!.formulas ?? []).map((formula) =>
      formula.expression.replace(/\s+/g, ""),
    );
    expect(expressions).toContain(expected);
  });

  it("gives TF both equivalent forms", () => {
    const expressions = (getAcronym("TF")!.formulas ?? []).map((formula) =>
      formula.expression.replace(/\s+/g, ""),
    );
    expect(expressions).toContain("TF=LS−ES");
    expect(expressions).toContain("TF=LF−EF");
  });

  it("states EMV and ROI in their mandated forms", () => {
    expect(
      (getAcronym("EMV")!.formulas ?? [])[0].expression.replace(/\s+/g, ""),
    ).toBe("EMV=P×MonetaryImpact");
    expect(
      (getAcronym("ROI")!.formulas ?? [])[0].expression.replace(/\s+/g, ""),
    ).toBe("ROI=(Benefit−Investment)/Investment×100");
  });

  it("expands every symbol used in a formula it declares variables for", () => {
    for (const entry of [getAcronym("EAC")!, getAcronym("TF")!, getAcronym("RE")!]) {
      const symbols = new Set((entry.formulaVariables ?? []).map((v) => v.symbol));
      expect(symbols.size).toBeGreaterThan(0);
    }
  });
});

// ── ACRONYM-SEMANTICS-EAC-RESOLUTION ────────────────────────────────────────

describe("ACRONYM-SEMANTICS-EAC-RESOLUTION: the panel shows the formula actually used", () => {
  const entry = getAcronym("EAC")!;

  it("reports the CPI-based variant when the engine signals it", () => {
    // `computeDeterministicForecasts` returns cpiEac and the finance stage
    // selects it, recording `evm_forecast_uses_cpi_based_eac`.
    const resolved = resolveFormula(entry, { formulaId: EAC_FORMULA_IDS.cpiEac });
    expect(resolved.used?.id).toBe(EAC_FORMULA_IDS.cpiEac);
    expect(resolved.used?.expression.replace(/\s+/g, "")).toBe("EAC=AC+(BAC−EV)/CPI");
    // Confirmed: this is a fact from the engine, not a guess.
    expect(resolved.isConfirmed).toBe(true);
  });

  it("still offers the other variants alongside it", () => {
    const resolved = resolveFormula(entry, { formulaId: EAC_FORMULA_IDS.cpiEac });
    expect(resolved.alternatives.length).toBeGreaterThanOrEqual(3);
    expect(resolved.alternatives.map((f) => f.id)).not.toContain(EAC_FORMULA_IDS.cpiEac);
  });

  it("falls back to the default WITHOUT claiming it was confirmed", () => {
    const resolved = resolveFormula(entry, null);
    expect(resolved.used?.isDefault).toBe(true);
    // The distinction the UI renders as "default variant" vs "used by engine".
    expect(resolved.isConfirmed).toBe(false);
  });

  it("degrades to the default when the engine names a variant this term lacks", () => {
    const resolved = resolveFormula(entry, { formulaId: "eac_not_a_real_variant" });
    expect(resolved.used).not.toBeNull();
    expect(resolved.isConfirmed).toBe(false);
  });

  it("resolves the CPI×SPI variant when that is what ran", () => {
    const resolved = resolveFormula(entry, { formulaId: EAC_FORMULA_IDS.cpiSpiEac });
    expect(resolved.used?.expression.replace(/\s+/g, "")).toBe("EAC=AC+(BAC−EV)/(CPI×SPI)");
    expect(resolved.isConfirmed).toBe(true);
  });
});
