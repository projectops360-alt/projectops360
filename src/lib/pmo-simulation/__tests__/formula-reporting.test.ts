// ============================================================================
// CAP-048 Simulation V1 — the engine reports which formula it used
// Guard: PMO-SIM-FORMULA-REPORTED
// ============================================================================
// EAC accepts four accepted formulas and the engine picks one
// (`AC + (BAC − EV) / CPI`). Before this, the choice existed only as the prose
// assumption "evm_forecast_uses_cpi_based_eac", so the glossary panel had to
// show a default variant and state that the engine did not report its choice —
// telling the user we did not know something we plainly did.
//
// The ids asserted here are a contract between three files. If any of them
// drifts, `resolveFormula` silently falls back to the default and the panel
// quietly starts under-claiming again — a failure with no visible symptom,
// which is exactly the kind this test exists to catch.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAcronym } from "../../acronyms/registry";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

describe("formula reporting (PMO-SIM-FORMULA-REPORTED)", () => {
  const financeStage = source("src/lib/pmo-simulation/stages/finance.ts");

  it("EAC offers several formulas — the glossary never claims there is only one", () => {
    const eac = getAcronym("EAC");
    if (!eac) throw new Error("EAC missing from the registry");
    expect((eac.formulas ?? []).length).toBeGreaterThan(1);
  });

  it("the finance stage tags EAC with the variant it actually read", () => {
    // computeDeterministicForecasts returns four; this stage reads cpiEac.
    expect(financeStage).toContain('formulaId: "eac_cpi"');
  });

  it("the tagged ids exist in the registry", () => {
    // A typo here costs nothing at runtime and everything in meaning: the panel
    // falls back to the default and says the engine did not report a choice.
    const eac = getAcronym("EAC");
    const vac = getAcronym("VAC");
    if (!eac || !vac) throw new Error("EAC or VAC missing from the registry");
    const eacIds = (eac.formulas ?? []).map((formula) => formula.id);
    const vacIds = (vac.formulas ?? []).map((formula) => formula.id);

    expect(eacIds).toContain("eac_cpi");
    expect(vacIds).toContain("vac_standard");
  });

  it("VAC inherits the EAC choice rather than inventing its own", () => {
    expect(financeStage).toContain('formulaId: "vac_standard"');
  });

  it("an unavailable EAC carries no formula — nothing was computed", () => {
    // The unavailable branch returns before the assumption is pushed. Tagging a
    // formula onto a null value would imply a calculation that never ran.
    const unavailableBranch = financeStage.slice(
      0,
      financeStage.indexOf("evm_forecast_uses_cpi_based_eac"),
    );
    expect(unavailableBranch).toContain("no_project_with_changed_budget_has_earned_value");
    expect(unavailableBranch).not.toContain("formulaId");
  });

  it("the results table forwards the id into the acronym context", () => {
    // The engine reporting its choice is useless if the UI drops it in between.
    expect(source("src/components/pmo-simulation/simulation-results.tsx")).toContain(
      "formulaId: metric.formulaId",
    );
  });
});
