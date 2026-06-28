// ============================================================================
// ProjectOps360° — Closeout record-backed criteria (REG-017) — pure, client-safe
// ============================================================================
// A closeout blocking requirement must be traceable to the EXACT records counted.
// "A count without visible records is not intelligence." This module owns the
// canonical risk-status semantics for closeout, the count↔record reconciliation
// guard, the dev diagnostics shape, and the Isabella-facing explanation — all as
// pure functions with NO server imports, so both the server (closeout.ts) and the
// client (closeout-client.tsx) can use them without leaking the admin client into
// the browser bundle.
//
// Root cause of REG-017: Closeout showed "2 open risk(s)" as a blocking count but
// the Resolve action routed to /execution-map, which has no risk view — so the
// user could never see the 2 risks. The count was an aggregate with no record IDs.
// Fix: every blocking count is derived FROM a list of records, and the count can
// never disagree with the records it is built from.
// ============================================================================

import type { Locale } from "@/types/database";

// ── Canonical risk-status semantics for closeout ────────────────────────────
// RiskStatus is "open" | "mitigating" | "accepted" | "resolved" | "closed".
// A risk is "open for closeout" only when it is still ACTIVE/UNRESOLVED. We also
// tolerate the legacy/imported "identified" value (some imported plans use it).
// "accepted" is a deliberate risk-response disposition — the team chose to accept
// the risk — so it does NOT block closeout, alongside "resolved"/"closed".

export const OPEN_RISK_STATUSES = ["open", "identified", "mitigating"] as const;
export const RESOLVED_RISK_STATUSES = ["resolved", "closed", "accepted"] as const;

/** True when a risk status is active/unresolved and therefore blocks closeout. */
export function isOpenRiskStatus(status: string | null | undefined): boolean {
  return !!status && (OPEN_RISK_STATUSES as readonly string[]).includes(status);
}

/** Human reason a risk record was EXCLUDED from the open-risk count (for diagnostics). */
export function riskExclusionReason(status: string | null | undefined): string {
  if (isOpenRiskStatus(status)) return ""; // not excluded
  if (status && (RESOLVED_RISK_STATUSES as readonly string[]).includes(status)) return `status=${status} (resolved/closed/accepted)`;
  return `status=${status ?? "null"} (not an open status)`;
}

// ── Record-backed criterion shapes ──────────────────────────────────────────

export interface CloseoutRiskRecord {
  id: string;
  title: string;
  status: string;
  severity: string;
  ownerUserId: string | null;
  ownerName: string | null;
}

export interface CloseoutCriterionDiagnostics {
  /** The function that produced this criterion's records. */
  source: string;
  includedIds: string[];
  excluded: { id: string; status: string; reason: string }[];
  count: number;
  resolveRoute: string | null;
  generatedAt: string;
}

/**
 * Reconcile a declared count against the records it claims to represent.
 * The whole point of REG-017: if these disagree, the count is NOT trustworthy.
 */
export function reconcileRecordCount(count: number, recordIds: string[]): boolean {
  return count === recordIds.length;
}

// ── Isabella-facing explanation (record-backed, mismatch-aware) ──────────────
// Isabella must NOT simply repeat the closeout count. When records back the count
// she explains the blocker and where to resolve it; when the count and records
// disagree she flags a data-consistency issue instead of asserting a fake number.

export interface CloseoutRiskContext {
  count: number;
  recordIds: string[];
  records: { title: string; status: string }[];
  /** Whether the current user may see the underlying risk titles. */
  canSeeRecords: boolean;
}

/**
 * The single sentence Isabella should say about open risks blocking closeout.
 * Pure + unit-tested so her behavior is deterministic and cannot drift.
 */
export function isabellaCloseoutRiskExplanation(ctx: CloseoutRiskContext, locale: Locale): string {
  const isEs = locale === "es";
  const consistent = reconcileRecordCount(ctx.count, ctx.recordIds);

  // Mismatch → flag a data inconsistency, never assert the count as fact.
  if (!consistent) {
    return isEs
      ? `El cierre indica ${ctx.count} riesgo(s) abierto(s), pero no encuentro los registros de riesgo correspondientes (${ctx.recordIds.length} visible(s)). Esto parece una inconsistencia de datos entre Cierre y la gestión de riesgos.`
      : `Closeout shows ${ctx.count} open risk(s), but I cannot find the matching risk records (${ctx.recordIds.length} visible). This looks like a data consistency issue between Closeout and Risk Management.`;
  }

  if (ctx.count === 0) {
    return isEs
      ? "No hay riesgos abiertos que bloqueen el cierre."
      : "There are no open risks blocking closeout.";
  }

  if (!ctx.canSeeRecords) {
    return isEs
      ? `Hay ${ctx.count} riesgo(s) abierto(s) que bloquean el cierre, pero no tienes permiso para ver los detalles.`
      : `${ctx.count} open risk(s) are blocking closeout, but you do not have permission to view the details.`;
  }

  const titles = ctx.records.map((r) => r.title).filter(Boolean).slice(0, 5);
  const list = titles.length ? (isEs ? ` (${titles.join("; ")})` : ` (${titles.join("; ")})`) : "";
  return isEs
    ? `El cierre no está listo porque quedan ${ctx.count} riesgo(s) abierto(s)${list}. Puedes resolverlos desde la fila “Riesgos resueltos” del Reporte de Cierre, que lista esos riesgos exactos.`
    : `Closeout is not ready because ${ctx.count} open risk(s) remain${list}. You can resolve them from the "Risks resolved" row of the Closeout Report, which lists those exact risks.`;
}
