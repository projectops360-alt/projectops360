// ============================================================================
// PMO Process Intelligence — financial read adapter (CAP-047 · M5)
// ============================================================================
// Read-only. Reuses the canonical per-project cockpit read model (single
// source of financial truth) for every project in scope, then feeds the pure
// overlay builder. Projects without financial data are simply absent — the
// UI shows an honest empty state, never invented numbers.
// ============================================================================

import "server-only";

import { getFinancialCockpitSummary, type FinancialCockpitSummary } from "@/lib/financial/read-model.server";
import { buildFinanceOverlayModel, type PmoPiFinanceOverlayModel } from "./financial-overlay";

export async function loadPmoPiFinanceOverlay(
  organizationId: string,
  projectIds: readonly string[],
): Promise<PmoPiFinanceOverlayModel> {
  const summaries: FinancialCockpitSummary[] = [];
  for (const projectId of projectIds) {
    const summary = await getFinancialCockpitSummary(organizationId, projectId);
    // Defense in depth: the read model already filters by org, but a row for
    // another tenant must never survive (PMO-PI-TENANT-SCOPE).
    if (summary && summary.organizationId === organizationId) summaries.push(summary);
  }
  return buildFinanceOverlayModel(summaries);
}
