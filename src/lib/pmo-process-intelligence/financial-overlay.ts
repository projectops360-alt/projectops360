// ============================================================================
// PMO Process Intelligence — financial overlay model + anomaly rules (M5)
// ============================================================================
// Pure derivations over the canonical cockpit projection
// (financial_project_cockpit). Alerts are deterministic rules — every alert
// carries its formula, the observed values, the status date, the source
// projection and a severity that is ALSO expressed in text (never color
// alone). EV/PV may be derived by inverting CPI/SPI (EV = CPI × AC,
// PV = EV / SPI) — always declared as an assumption, never hidden.
// Double-counting guard: actuals, commitments and accruals stay separate.
// ============================================================================

import { computeTcpi } from "@/lib/financial/calculations";
import type { FinancialCockpitSummary } from "@/lib/financial/read-model.server";

export type PmoPiAlertSeverity = "info" | "warning" | "critical";

export interface PmoPiFinancialAlert {
  id: string;
  projectId: string;
  severity: PmoPiAlertSeverity;
  /** Stable rule key — the UI translates it (EN/ES). */
  rule:
    | "cpi_below_threshold"
    | "spi_below_threshold"
    | "eac_exceeds_baseline"
    | "reconciliation_exceptions"
    | "unverified_actuals"
    | "currency_mismatches";
  formula: string;
  observed: Record<string, number | string | null>;
  statusDate: string | null;
  source: string;
}

export interface PmoPiFinanceRow {
  projectId: string;
  currency: string;
  originalBudget: number | null;
  baseline: number | null;
  authorizedFunding: number;
  releasedFunding: number;
  /** Separate exposure components — never pre-summed. */
  currentCommitment: number;
  actualCost: number;
  openAccrual: number;
  remainingReserve: number;
  latestEac: number | null;
  p50Eac: number | null;
  p80Eac: number | null;
  cpi: number | null;
  spi: number | null;
  /** VAC = BAC − EAC; null when either input is missing. */
  vac: number | null;
  /** TCPI derived with EV = CPI × AC (assumption declared). */
  tcpi: number | null;
  qualityStatus: string;
  dataDate: string | null;
}

export interface PmoPiFinanceOverlayModel {
  rows: PmoPiFinanceRow[];
  alerts: PmoPiFinancialAlert[];
  /** Portfolio CPI = ΣEV / ΣAC with EV = CPI × AC per project (declared). */
  portfolioCpi: number | null;
  assumptions: string[];
  source: string;
}

const CPI_FLOOR = 0.9;
const SPI_FLOOR = 0.9;

export function buildFinanceOverlayModel(
  summaries: readonly FinancialCockpitSummary[],
): PmoPiFinanceOverlayModel {
  const rows: PmoPiFinanceRow[] = [];
  const alerts: PmoPiFinancialAlert[] = [];
  let evSum = 0;
  let acSum = 0;
  let evDerivable = false;

  for (const s of summaries) {
    const bac = s.currentBaseline ?? s.originalBudget;
    const ev = s.cpi != null && s.actualCost > 0 ? s.cpi * s.actualCost : null;
    const vac = bac != null && s.latestEac != null ? bac - s.latestEac : null;
    const tcpiResult = computeTcpi(bac, ev, s.actualCost, bac);

    if (ev != null) {
      evSum += ev;
      acSum += s.actualCost;
      evDerivable = true;
    }

    rows.push({
      projectId: s.projectId,
      currency: s.currency,
      originalBudget: s.originalBudget,
      baseline: bac,
      authorizedFunding: s.authorizedFunding,
      releasedFunding: s.releasedFunding,
      currentCommitment: s.currentCommitment,
      actualCost: s.actualCost,
      openAccrual: s.openAccrual,
      remainingReserve: s.remainingReserve,
      latestEac: s.latestEac,
      p50Eac: s.p50Eac,
      p80Eac: s.p80Eac,
      cpi: s.cpi,
      spi: s.spi,
      vac,
      tcpi: tcpiResult.status === "available" ? tcpiResult.value : null,
      qualityStatus: s.qualityStatus,
      dataDate: s.dataDate,
    });

    const push = (
      rule: PmoPiFinancialAlert["rule"],
      severity: PmoPiAlertSeverity,
      formula: string,
      observed: PmoPiFinancialAlert["observed"],
    ) =>
      alerts.push({
        id: `${s.projectId}:${rule}`,
        projectId: s.projectId,
        severity,
        rule,
        formula,
        observed,
        statusDate: s.dataDate,
        source: "financial_project_cockpit",
      });

    if (s.cpi != null && s.cpi < CPI_FLOOR) {
      push("cpi_below_threshold", s.cpi < 0.8 ? "critical" : "warning", "CPI = EV / AC", {
        cpi: s.cpi,
        threshold: CPI_FLOOR,
        actual_cost: s.actualCost,
      });
    }
    if (s.spi != null && s.spi < SPI_FLOOR) {
      push("spi_below_threshold", s.spi < 0.8 ? "critical" : "warning", "SPI = EV / PV", {
        spi: s.spi,
        threshold: SPI_FLOOR,
      });
    }
    if (vac != null && vac < 0) {
      push("eac_exceeds_baseline", "critical", "VAC = BAC − EAC", {
        bac,
        eac: s.latestEac,
        vac,
      });
    }
    if (s.reconciliationExceptions > 0) {
      push("reconciliation_exceptions", "warning", "count(reconciliation_exceptions) > 0", {
        exceptions: s.reconciliationExceptions,
      });
    }
    if (s.unverifiedActuals > 0) {
      push("unverified_actuals", "warning", "count(unverified_actuals) > 0", {
        unverified: s.unverifiedActuals,
      });
    }
    if (s.currencyMismatches > 0) {
      push("currency_mismatches", "critical", "count(currency_mismatches) > 0", {
        mismatches: s.currencyMismatches,
      });
    }
  }

  const severityRank: Record<PmoPiAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));

  return {
    rows,
    alerts,
    portfolioCpi: evDerivable && acSum > 0 ? evSum / acSum : null,
    assumptions: [
      "ev_derived_as_cpi_times_ac",
      "portfolio_cpi_is_sum_ev_over_sum_ac",
      "actuals_commitments_accruals_are_separate_never_summed",
      // The cockpit view exposes baseline amounts + data_date but not the
      // baseline version number; the immutable history lives in
      // financial_baseline_versions (declared, not hidden).
      "baseline_version_not_exposed_by_cockpit_view",
    ],
    source: "financial_project_cockpit",
  };
}
