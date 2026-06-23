// ============================================================================
// ProjectOps360° — Predictive refinement-risk detection (pure function)
// ============================================================================
// Flags work items that are likely to stall or arrive at execution unready:
// high-value-but-unready, blocked by unresolved dependencies, oversized and
// not split, unowned, stale, or inconsistently marked ready. Deterministic and
// explainable (bilingual reasons), so the PM can act before the work moves.
// ============================================================================

export type RiskSeverity = "high" | "medium" | "low";

export interface RefinementRisk { severity: RiskSeverity; es: string; en: string; }

export interface RiskItemLike {
  refinement_status?: string | null;
  readiness_score?: number | string | null;
  priority?: string | null;
  risk_level?: string | null;
  owner_id?: string | null;
  estimation_method?: string | null;
  estimate_value?: number | string | null;
  updated_at?: string | null;
}

const num = (v: unknown): number => { const n = Number(v); return Number.isNaN(n) ? 0 : n; };
const SEV_ORDER: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };

/**
 * Detect refinement risks for one item.
 * @param item            the work item row
 * @param unresolvedDeps  count of predecessors not yet refined/planned
 * @param now             reference time (defaults to Date.now()), for staleness
 */
export function detectRefinementRisks(item: RiskItemLike, unresolvedDeps = 0, now: number = Date.now()): RefinementRisk[] {
  const out: RefinementRisk[] = [];
  const status = String(item.refinement_status ?? "new");
  const readiness = num(item.readiness_score);
  const priority = String(item.priority ?? "");
  const isHigh = priority === "High";
  const aimingReady = status === "refined" || status === "ready_for_planning";
  const terminal = status === "rejected" || status === "deferred" || status === "planned" || status === "in_execution" || status === "done";
  if (terminal) return out;

  // High value but not ready.
  if (isHigh && readiness < 40 && item.readiness_score != null) {
    out.push({ severity: "high", es: "Prioridad alta pero readiness bajo", en: "High priority but low readiness" });
  }

  // Unresolved dependencies.
  if (unresolvedDeps > 0) {
    out.push({
      severity: aimingReady ? "high" : "medium",
      es: `${unresolvedDeps} dependencia(s) sin resolver`,
      en: `${unresolvedDeps} unresolved dependency(ies)`,
    });
  }

  // Critical risk on an item that's being marked ready.
  if (String(item.risk_level) === "critical" && status !== "ready_for_planning") {
    out.push({ severity: "high", es: "Riesgo crítico sin mitigar", en: "Critical risk not mitigated" });
  }

  // Oversized and not split (story points ≥ 13 or complexity 5).
  const est = num(item.estimate_value);
  const oversized = (item.estimation_method === "story_points" && est >= 13) || (item.estimation_method === "complexity" && est >= 5);
  if (oversized && status !== "split_required") {
    out.push({ severity: "medium", es: "Demasiado grande: considera dividirlo", en: "Too large: consider splitting" });
  }

  // Unowned high-priority work.
  if (isHigh && !item.owner_id) {
    out.push({ severity: "medium", es: "Prioridad alta sin owner", en: "High priority without an owner" });
  }

  // Marked ready but no estimate.
  const hasEstimate = item.estimation_method === "three_point" ? true : est > 0 || !!item.estimation_method;
  if (aimingReady && !hasEstimate) {
    out.push({ severity: "medium", es: "Marcado listo sin estimación", en: "Marked ready without an estimate" });
  }

  // Stale: untouched for >14 days while still early.
  if (item.updated_at && (status === "new" || status === "needs_clarification" || status === "in_refinement")) {
    const days = (now - new Date(item.updated_at).getTime()) / 86_400_000;
    if (days > 14) out.push({ severity: "low", es: `Sin avance hace ${Math.round(days)} días`, en: `No progress for ${Math.round(days)} days` });
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

/** The most severe risk in a list (for sorting/badges). null = no risk. */
export function topSeverity(risks: RefinementRisk[]): RiskSeverity | null {
  if (risks.length === 0) return null;
  return risks.slice().sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])[0].severity;
}
