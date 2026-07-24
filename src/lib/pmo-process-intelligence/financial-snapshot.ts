// ============================================================================
// PMO Process Intelligence — financial snapshot builder (CAP-047 · M2)
// ============================================================================
// Pure projection from the canonical financial model onto the module's
// executive contract. All EVM math is DELEGATED to lib/financial (single
// source of formulas — CPI, SPI, TCPI, ETC, EAC, VAC); this file only shapes
// results and assembles the mandatory evidence package.
// Double-counting guard: actuals, commitments and accruals stay separate
// fields end-to-end; this module never adds them into one aggregate.
// ============================================================================

import {
  computeEvmSnapshot,
  computeDeterministicForecasts,
  computeTcpi,
} from "@/lib/financial/calculations";
import type { MetricResult } from "@/lib/financial/types";
import type { PmoPiFinancialSnapshot, PmoPiMetric } from "./contracts";
import { PMO_PI_CONTRACT_VERSION } from "./contracts";

/** Cockpit-shaped input (mirrors financial_project_cockpit — adapter maps 1:1). */
export interface FinancialCockpitInput {
  organizationId: string;
  projectId: string;
  currency: string;
  baselineVersion: number | null;
  statusDate: string | null;
  originalBudget: number | null;
  currentBaseline: number | null;
  authorizedFunding: number | null;
  releasedFunding: number | null;
  currentCommitment: number | null;
  outstandingCommitment: number | null;
  actualCost: number | null;
  openAccrual: number | null;
  remainingReserve: number | null;
  /** EVM measurement inputs (from financial_measurement_snapshots). */
  pv: number | null;
  ev: number | null;
  bottomUpEtc?: number | null;
}

const metric = (m: MetricResult): PmoPiMetric =>
  m.status === "available"
    ? { status: "available", value: m.value }
    : { status: "unavailable", value: null, reason: m.reason };

const input = (value: number | null, reason: string): PmoPiMetric =>
  value != null && Number.isFinite(value)
    ? { status: "available", value }
    : { status: "unavailable", value: null, reason };

/** Build the executive snapshot. Pure: no I/O, deterministic. */
export function buildFinancialSnapshot(row: FinancialCockpitInput): PmoPiFinancialSnapshot {
  const bac = row.currentBaseline ?? row.originalBudget;
  const evm = computeEvmSnapshot({ bac, pv: row.pv, ev: row.ev, ac: row.actualCost });
  const forecasts = computeDeterministicForecasts({
    bac,
    pv: row.pv,
    ev: row.ev,
    ac: row.actualCost,
    bottomUpEtc: row.bottomUpEtc ?? null,
  });
  // Preferred forecast: bottom-up when supplied, else CPI-based. ETC and EAC
  // always come from the SAME method (documented in evidence.assumptions).
  const useBottomUp = row.bottomUpEtc != null;
  const etc = useBottomUp
    ? input(row.bottomUpEtc ?? null, "missing_bottom_up_etc")
    : metric(forecasts.cpiEtc);
  const eac = useBottomUp
    ? metric(forecasts.bottomUpEac)
    : metric(forecasts.cpiEac);
  const vac: PmoPiMetric =
    bac != null && eac.status === "available"
      ? { status: "available", value: bac - eac.value! }
      : { status: "unavailable", value: null, reason: "missing_bac_or_eac" };
  const tcpi = computeTcpi(bac, row.ev, row.actualCost, bac);

  return {
    contractVersion: PMO_PI_CONTRACT_VERSION,
    organizationId: row.organizationId,
    projectId: row.projectId,
    currency: row.currency,
    baselineVersion: row.baselineVersion,
    statusDate: row.statusDate,
    originalBudget: row.originalBudget,
    currentBaseline: row.currentBaseline,
    authorizedFunding: row.authorizedFunding,
    releasedFunding: row.releasedFunding,
    currentCommitment: row.currentCommitment,
    outstandingCommitment: row.outstandingCommitment,
    actualCost: row.actualCost,
    openAccrual: row.openAccrual,
    remainingReserve: row.remainingReserve,
    evm: {
      pv: input(row.pv, "missing_pv"),
      ev: input(row.ev, "missing_ev_evidence"),
      ac: input(row.actualCost, "missing_ac"),
      cv: metric(evm.cv),
      sv: metric(evm.sv),
      cpi: metric(evm.cpi),
      spi: metric(evm.spi),
      tcpi: metric(tcpi),
      etc,
      eac,
      vac,
    },
    evidence: {
      sourceEventIds: [],
      formulas: [
        "CV = EV − AC",
        "SV = EV − PV",
        "CPI = EV / AC",
        "SPI = EV / PV",
        "TCPI = (BAC − EV) / (BAC − AC)",
        row.bottomUpEtc != null ? "EAC = AC + bottom-up ETC" : "ETC = (BAC − EV) / CPI; EAC = AC + ETC",
        "VAC = BAC − EAC",
      ],
      projections: ["financial_project_cockpit", "financial_measurement_snapshots"],
      timestamps: [{ statusDate: row.statusDate ?? undefined }],
      assumptions: [
        row.bottomUpEtc != null
          ? "forecast_uses_bottom_up_etc"
          : "forecast_uses_cpi_method",
        "bac_prefers_current_baseline_over_original_budget",
      ],
      limitations: [
        ...evm.limitations,
        "actuals_commitments_accruals_are_separate_never_summed",
      ],
      dataQualityScore: evm.quality === "available" ? 1 : 0.5,
    },
  };
}
