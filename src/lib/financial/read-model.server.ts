import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface FinancialCockpitSummary {
  organizationId: string;
  projectId: string;
  currency: string;
  originalBudget: number | null;
  currentBaseline: number | null;
  authorizedFunding: number;
  releasedFunding: number;
  currentCommitment: number;
  outstandingCommitment: number;
  actualCost: number;
  openAccrual: number;
  settledPayments: number;
  remainingReserve: number;
  approvedChangesNotPosted: number;
  latestEac: number | null;
  p50Eac: number | null;
  p80Eac: number | null;
  cpi: number | null;
  spi: number | null;
  qualityStatus: string;
  pendingApprovals: number;
  reconciliationExceptions: number;
  unverifiedActuals: number;
  currencyMismatches: number;
  dataDate: string | null;
}

type FinancialCockpitRow = {
  organization_id: string;
  project_id: string;
  currency: string | null;
  original_budget: number | string | null;
  current_baseline: number | string | null;
  authorized_funding: number | string | null;
  released_funding: number | string | null;
  current_commitment: number | string | null;
  outstanding_commitment: number | string | null;
  actual_cost: number | string | null;
  open_accrual: number | string | null;
  settled_payments: number | string | null;
  remaining_reserve: number | string | null;
  approved_changes_not_posted: number | string | null;
  latest_eac: number | string | null;
  p50_eac: number | string | null;
  p80_eac: number | string | null;
  cpi: number | string | null;
  spi: number | string | null;
  quality_status: string | null;
  pending_approvals: number | string | null;
  reconciliation_exceptions: number | string | null;
  unverified_actuals: number | string | null;
  currency_mismatches: number | string | null;
  data_date: string | null;
};

const numeric = (value: number | string | null | undefined): number =>
  value == null ? 0 : Number(value);
const optionalNumeric = (value: number | string | null | undefined): number | null =>
  value == null ? null : Number(value);

export async function getFinancialCockpitSummary(
  organizationId: string,
  projectId: string,
): Promise<FinancialCockpitSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_project_cockpit")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[financial] cockpit read failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as FinancialCockpitRow;
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    currency: row.currency ?? "USD",
    originalBudget: optionalNumeric(row.original_budget),
    currentBaseline: optionalNumeric(row.current_baseline),
    authorizedFunding: numeric(row.authorized_funding),
    releasedFunding: numeric(row.released_funding),
    currentCommitment: numeric(row.current_commitment),
    outstandingCommitment: numeric(row.outstanding_commitment),
    actualCost: numeric(row.actual_cost),
    openAccrual: numeric(row.open_accrual),
    settledPayments: numeric(row.settled_payments),
    remainingReserve: numeric(row.remaining_reserve),
    approvedChangesNotPosted: numeric(row.approved_changes_not_posted),
    latestEac: optionalNumeric(row.latest_eac),
    p50Eac: optionalNumeric(row.p50_eac),
    p80Eac: optionalNumeric(row.p80_eac),
    cpi: optionalNumeric(row.cpi),
    spi: optionalNumeric(row.spi),
    qualityStatus: row.quality_status ?? "insufficient_inputs",
    pendingApprovals: numeric(row.pending_approvals),
    reconciliationExceptions: numeric(row.reconciliation_exceptions),
    unverifiedActuals: numeric(row.unverified_actuals),
    currencyMismatches: numeric(row.currency_mismatches),
    dataDate: row.data_date,
  };
}
