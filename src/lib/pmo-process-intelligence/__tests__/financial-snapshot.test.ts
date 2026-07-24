// ============================================================================
// CAP-047 M2 — financial snapshot contract (guard: PMO-PI-FINANCIAL-SNAPSHOT)
// ============================================================================
// Fails if: EVM math stops being delegated to lib/financial, TCPI/ETC/EAC/VAC
// diverge from the canonical formulas, unavailable inputs stop being declared
// honestly, baseline version/status date disappear, or actuals/commitments/
// accruals stop being separate fields (double-counting guard).
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildFinancialSnapshot, type FinancialCockpitInput } from "../financial-snapshot";

const base: FinancialCockpitInput = {
  organizationId: "org-1",
  projectId: "p1",
  currency: "USD",
  baselineVersion: 2,
  statusDate: "2026-07-20",
  originalBudget: 100_000,
  currentBaseline: 120_000,
  authorizedFunding: 120_000,
  releasedFunding: 80_000,
  currentCommitment: 30_000,
  outstandingCommitment: 10_000,
  actualCost: 40_000,
  openAccrual: 5_000,
  remainingReserve: 8_000,
  pv: 50_000,
  ev: 45_000,
};

describe("buildFinancialSnapshot (CAP-047 M2)", () => {
  const s = buildFinancialSnapshot(base);

  it("delegates EVM to the canonical formulas (CPI, SPI, TCPI, ETC, EAC, VAC)", () => {
    expect(s.evm.cpi).toEqual({ status: "available", value: 45_000 / 40_000 });
    expect(s.evm.spi).toEqual({ status: "available", value: 45_000 / 50_000 });
    // TCPI = (BAC − EV) / (BAC − AC) with BAC = current baseline
    expect(s.evm.tcpi.value).toBeCloseTo((120_000 - 45_000) / (120_000 - 40_000), 10);
    // CPI method: ETC = (BAC − EV)/CPI; EAC = AC + ETC; VAC = BAC − EAC
    const cpi = 45_000 / 40_000;
    const etc = (120_000 - 45_000) / cpi;
    expect(s.evm.etc.value).toBeCloseTo(etc, 6);
    expect(s.evm.eac.value).toBeCloseTo(40_000 + etc, 6);
    expect(s.evm.vac.value).toBeCloseTo(120_000 - (40_000 + etc), 6);
  });

  it("uses bottom-up ETC for BOTH etc and eac when supplied", () => {
    const b = buildFinancialSnapshot({ ...base, bottomUpEtc: 70_000 });
    expect(b.evm.etc).toEqual({ status: "available", value: 70_000 });
    expect(b.evm.eac).toEqual({ status: "available", value: 40_000 + 70_000 });
    expect(b.evidence.assumptions).toContain("forecast_uses_bottom_up_etc");
  });

  it("declares unavailable metrics honestly instead of inventing values", () => {
    const noEv = buildFinancialSnapshot({ ...base, ev: null });
    expect(noEv.evm.cpi.status).toBe("unavailable");
    expect(noEv.evm.ev).toMatchObject({ status: "unavailable", reason: "missing_ev_evidence" });
    expect(noEv.evm.vac.status).toBe("unavailable");
  });

  it("keeps actuals, commitments and accruals as separate fields (no pre-summed exposure)", () => {
    expect(s.actualCost).toBe(40_000);
    expect(s.currentCommitment).toBe(30_000);
    expect(s.openAccrual).toBe(5_000);
    // The snapshot exposes no aggregate that adds them together.
    const flat = JSON.stringify(s);
    expect(flat).not.toContain(String(40_000 + 30_000 + 5_000));
    expect(s.evidence.limitations).toContain("actuals_commitments_accruals_are_separate_never_summed");
  });

  it("always carries baseline version, status date and the formulas used", () => {
    expect(s.baselineVersion).toBe(2);
    expect(s.statusDate).toBe("2026-07-20");
    expect(s.evidence.formulas).toContain("CPI = EV / AC");
    expect(s.evidence.formulas).toContain("TCPI = (BAC − EV) / (BAC − AC)");
    expect(s.evidence.projections).toContain("financial_project_cockpit");
  });
});
