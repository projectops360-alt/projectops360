"use server";

// ============================================================================
// PMO Intelligence Center — commands (CAP-048 Phase 2, M5/M6 · ADR-012)
// ============================================================================
// "Commands are re-exported, never reimplemented." (ADR-012 §2)
//
// Every function in this file is a thin, gated wrapper around a command that
// already exists somewhere else in the product. None of them defines a rule,
// computes a figure, or writes a row of its own:
//
//   reloadPmoIntelligenceAction  → loadPmoIntelligence (the composed read model)
//   recordPmoInsightFeedbackAction → recordInsightFeedbackAction (audit_logs)
//   runPmoScopeReportAction      → runReport (@/lib/reports/query-service)
//
// The wrappers exist for two reasons and no others:
//
//   1. The Phase 1 gate. `canAccessPmoLivingGraph` guards the ROUTE; a server
//      action reached directly from a client bundle is a second door into the
//      same data and has to be gated again. Route gates are not action gates.
//   2. Serialisability. The read model contains a `Map` (blocked days per
//      project) and `Set`s inside the graph model, neither of which survives
//      the server-action boundary intact. The reload wrapper returns the exact
//      slices the client layer consumes, already flattened — it does not
//      reshape a number.
//
// The feedback wrapper is deliberately a PASS-THROUGH with no validation of
// its own: `recordInsightFeedbackAction` already validates with zod, gates on
// its own flag, hashes the evidence and writes the audit row. Re-checking any
// of that here would be the second definition ADR-012 exists to prevent, and
// the two copies would drift.
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { canAccessPmoLivingGraph } from "@/lib/pmo-living-graph/flags";
import { recordInsightFeedbackAction } from "@/app/[locale]/(app)/process-intelligence/actions";
import { runReport } from "@/lib/reports/query-service";
import { getPrebuiltReport } from "@/lib/reports/report-library";
import type { Locale } from "@/types/database";
import { loadPmoIntelligence } from "./read-model.server";
import { scopeFromSearchParams, type PmoScope } from "./scope";
import type { PmoDashboardSlice } from "./dashboard-model";
import { toDashboardSlice } from "./dashboard-model";

// ---------------------------------------------------------------------------
// Reload — closes the `reload: undefined` gap left by Milestone 3
// ---------------------------------------------------------------------------

export interface PmoReloadResult {
  error?: "not_authenticated" | "not_authorized" | "unexpected";
  slice?: PmoDashboardSlice;
}

/**
 * Reload the composed read model for a scope.
 *
 * Milestone 3 wired `usePmoScope` with `reload: undefined`, which made the
 * whole client reload path — abort controllers, superseded-response guards,
 * loading state — dead code that had never executed once. This is the loader
 * that path was written for.
 *
 * The scope arrives as a query string rather than an object so it goes through
 * `scopeFromSearchParams`, the same validator the route uses. A client-supplied
 * object would let a malformed date reach the database; the parser drops it at
 * the boundary. The organization is taken from the session and the caller's
 * value is ignored entirely.
 */
export async function reloadPmoIntelligenceAction(input: {
  scopeQuery: string;
  locale: string;
}): Promise<PmoReloadResult> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  // The same gate as the route. An action is a separate entry point into the
  // same data, so it needs the check again — not because the route's is weak,
  // but because nothing about the route's check applies here.
  if (!canAccessPmoLivingGraph(org.role)) return { error: "not_authorized" };

  const typedLocale: Locale = input.locale === "es" ? "es" : "en";
  // Organization from the session, never from the client's string.
  const scope: PmoScope = scopeFromSearchParams(
    org.organizationId,
    new URLSearchParams(input.scopeQuery),
  );

  try {
    const model = await loadPmoIntelligence(scope, typedLocale, new Date().toISOString());
    return { slice: toDashboardSlice(model) };
  } catch {
    // The client keeps the previous model on screen; blanking the dashboard
    // because one refresh failed loses the context the user was working in.
    return { error: "unexpected" };
  }
}

// ---------------------------------------------------------------------------
// Insight feedback — the SAME action Dashboard 2 calls
// ---------------------------------------------------------------------------

/**
 * Accept / reject / defer, delegated verbatim.
 *
 * Dashboard 2's `isabella-panel.tsx` imports `recordInsightFeedbackAction`
 * directly. Dashboard 3 cannot: importing a `"use server"` module from another
 * route segment into a client component that this route renders pulls that
 * segment's module graph in with it. So the call is forwarded from here — one
 * hop, zero logic. The parameter type is imported from the action itself so a
 * change to its contract breaks this file at compile time instead of silently
 * dropping a field.
 */
export async function recordPmoInsightFeedbackAction(
  input: Parameters<typeof recordInsightFeedbackAction>[0],
): Promise<{ error?: string }> {
  // No gate, no validation, no audit write here on purpose: every one of those
  // already happens inside the delegate, and a second copy would be free to
  // disagree with the first.
  return recordInsightFeedbackAction(input);
}

// ---------------------------------------------------------------------------
// Report — the existing generator, aimed at the current scope
// ---------------------------------------------------------------------------

export interface PmoReportResult {
  error?: string;
  report?: {
    id: string;
    name: string;
    columns: { key: string; label: string }[];
    rows: Record<string, unknown>[];
    totalRows: number;
    truncated: boolean;
  };
}

/**
 * Run a prebuilt report over the dashboard's scope.
 *
 * `runReport` accepts a config plus an org/project context, so pointing it at
 * the current scope is the whole implementation. Building a report generator
 * for Dashboard 3 would have produced a second one to keep in sync with the
 * first — CAP-048 §6 names `runReport` as the reuse point precisely to stop
 * that.
 *
 * `QueryContext` carries at most ONE project id. A multi-project scope is
 * therefore run org-wide rather than silently reported as the first selected
 * project, which would be a wrong answer presented confidently.
 */
export async function runPmoScopeReportAction(input: {
  reportId: string;
  projectIds: string[];
}): Promise<PmoReportResult> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!canAccessPmoLivingGraph(org.role)) return { error: "not_authorized" };

  const prebuilt = getPrebuiltReport(input.reportId);
  if (!prebuilt) return { error: "unknown_report" };

  const result = await runReport(
    { datasetId: prebuilt.datasetId, ...prebuilt.config },
    {
      organizationId: org.organizationId,
      projectId: input.projectIds.length === 1 ? input.projectIds[0] : null,
    },
    { page: 1, pageSize: 50 },
  );

  if ("error" in result) return { error: result.error };

  return {
    report: {
      id: prebuilt.id,
      name: prebuilt.name,
      columns: result.columns.map((column) => ({ key: column.key, label: column.label })),
      rows: result.rows,
      totalRows: result.totalRows,
      truncated: result.truncated,
    },
  };
}
