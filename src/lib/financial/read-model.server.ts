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
  const query = supabase.from as unknown as (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (innerColumn: string, innerValue: string) => {
          maybeSingle: () => Promise<{ data: FinancialCockpitRow | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await query("financial_project_cockpit")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[financial] cockpit read failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    organizationId: data.organization_id,
    projectId: data.project_id,
    currency: data.currency ?? "USD",
    originalBudget: optionalNumeric(data.original_budget),
    currentBaseline: optionalNumeric(data.current_baseline),
    authorizedFunding: numeric(data.authorized_funding),
    releasedFunding: numeric(data.released_funding),
    currentCommitment: numeric(data.current_commitment),
    outstandingCommitment: numeric(data.outstanding_commitment),
    actualCost: numeric(data.actual_cost),
    openAccrual: numeric(data.open_accrual),
    settledPayments: numeric(data.settled_payments),
    remainingReserve: numeric(data.remaining_reserve),
    approvedChangesNotPosted: numeric(data.approved_changes_not_posted),
    latestEac: optionalNumeric(data.latest_eac),
    p50Eac: optionalNumeric(data.p50_eac),
    p80Eac: optionalNumeric(data.p80_eac),
    cpi: optionalNumeric(data.cpi),
    spi: optionalNumeric(data.spi),
    qualityStatus: data.quality_status ?? "insufficient_inputs",
    pendingApprovals: numeric(data.pending_approvals),
    reconciliationExceptions: numeric(data.reconciliation_exceptions),
    unverifiedActuals: numeric(data.unverified_actuals),
    currencyMismatches: numeric(data.currency_mismatches),
    dataDate: data.data_date,
  };
}
