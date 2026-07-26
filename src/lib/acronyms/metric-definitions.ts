// ============================================================================
// Acronym Intelligence — simulation metric ⇄ definition map (CAP-050)
// ============================================================================
// The integration point. Every metric key the simulation engine emits is mapped
// here to the acronym that explains it, so the results table, any metric card
// and the node panel all reach the SAME definition from the same key. Without
// this map each surface would decide for itself what "portfolio_eac" means, and
// they would drift.
//
// A metric may legitimately map to no acronym: `tasks_moved` is a plain count,
// not a term of art, and inventing an entry for it would pad the corpus with
// things nobody needs explained. `definitionId: null` is an explicit decision,
// which is why the map is exhaustive over the engine's keys and a test asserts
// every key appears — the failure mode this prevents is a NEW metric being
// added upstream and silently having no definition.
// ============================================================================

/**
 * Every metric key emitted by `src/lib/pmo-simulation/stages/*`, mapped to the
 * acronym code that defines it — or explicitly to null.
 *
 * `supportingCodes` are terms worth surfacing alongside the metric even though
 * they are not what the number itself is. A user looking at EAC nearly always
 * needs BAC and CPI to interpret it.
 */
export interface MetricDefinitionBinding {
  /** Primary acronym code, or null when the metric is not a term of art. */
  definitionId: string | null;
  /** Related codes the surface may offer next to the primary one. */
  supportingCodes?: string[];
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinitionBinding> = {
  // ── Finance / EVM ─────────────────────────────────────────────────────────
  portfolio_bac: { definitionId: "BAC", supportingCodes: ["PMB", "VAC"] },
  portfolio_eac: { definitionId: "EAC", supportingCodes: ["BAC", "CPI", "ETC", "VAC"] },
  portfolio_vac: { definitionId: "VAC", supportingCodes: ["BAC", "EAC"] },
  portfolio_cpi: { definitionId: "CPI", supportingCodes: ["EV", "AC", "CV"] },

  // Budget totals are plain sums of budget rows, not EVM terms. BAC is offered
  // as supporting context because that is the term users reach for here.
  budget_scope_total: { definitionId: null, supportingCodes: ["BAC", "CB"] },
  budget_contingency: { definitionId: "CR", supportingCodes: ["MR", "PMB"] },

  // ── Schedule ──────────────────────────────────────────────────────────────
  // Finish-date movement is a CPM output, which is exactly the point SV and SPI
  // redirect to. Binding it to CPM keeps that redirection landing somewhere.
  portfolio_finish_days: { definitionId: "CPM", supportingCodes: ["CP", "TF", "SV"] },
  critical_tasks: { definitionId: "CP", supportingCodes: ["CPM", "TF"] },
  tasks_moved: { definitionId: null, supportingCodes: ["CPM", "TF"] },
  tasks_directly_changed: { definitionId: null, supportingCodes: ["CPM"] },

  // ── Risk ──────────────────────────────────────────────────────────────────
  // Two exposure metrics, two different units, two different entries. EMV is
  // the monetary one; RE is the unit-agnostic parent used for the days figure.
  risk_exposure_cost: { definitionId: "EMV", supportingCodes: ["RE", "P", "I", "CR"] },
  risk_exposure_days: { definitionId: "RE", supportingCodes: ["P", "I", "TF"] },
  open_risks: { definitionId: "RAID", supportingCodes: ["P", "I", "RE"] },

  // ── Resource ──────────────────────────────────────────────────────────────
  resource_effective_hours: { definitionId: "FTE", supportingCodes: ["RCI"] },
  resource_utilization: { definitionId: "RCI", supportingCodes: ["FTE", "WIP"] },
  resource_overallocated_hours: { definitionId: "RCI", supportingCodes: ["FTE"] },
  resource_linked_tasks: { definitionId: null, supportingCodes: ["FTE"] },
  resource_status_changed: { definitionId: null },
};

/** The acronym that defines a metric, or null. Unknown keys return null. */
export function definitionIdForMetric(metricKey: string): string | null {
  return METRIC_DEFINITIONS[metricKey]?.definitionId ?? null;
}

export function supportingCodesForMetric(metricKey: string): string[] {
  return METRIC_DEFINITIONS[metricKey]?.supportingCodes ?? [];
}

/** Metric keys the map covers. Used by the coverage test. */
export function definedMetricKeys(): string[] {
  return Object.keys(METRIC_DEFINITIONS);
}
