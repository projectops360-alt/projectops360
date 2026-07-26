// ============================================================================
// PMO Simulation — presentation logic (CAP-049 §6)
// ============================================================================
// Pure formatting and classification. Components render what these functions
// return and decide nothing themselves — ADR-012, and the reason the unit rules
// are testable at all.
//
// The formatter is where the "never mix units" rule becomes visible: a value is
// only ever rendered through the unit its own metric declares, and there is no
// function here that accepts two metrics and combines them.
// ============================================================================

import type {
  SimMetric,
  SimProvenance,
  SimResult,
  SimUnit,
} from "./contracts";

/** Whether a delta is good news, bad news, or neither. */
export type DeltaTone = "improved" | "worsened" | "neutral" | "unknown";

/**
 * Metrics where a HIGHER number is worse. Everything not listed is treated as
 * neutral unless explicitly marked, because guessing the direction of an
 * unknown metric is how a tool ends up colouring a bad outcome green.
 */
const HIGHER_IS_WORSE = new Set([
  "portfolio_finish_days",
  "portfolio_eac",
  "critical_tasks",
  "tasks_moved",
  "risk_exposure_cost",
  "risk_exposure_days",
  "open_risks",
  "resource_overallocated_hours",
  "resource_utilization",
]);

/** Metrics where a HIGHER number is better. */
const HIGHER_IS_BETTER = new Set([
  "portfolio_vac",
  "portfolio_cpi",
  "resource_effective_hours",
]);

/**
 * Classify a delta.
 *
 * `portfolio_bac` is deliberately in neither set. A bigger budget is not
 * self-evidently good or bad — it is the user's own decision, and painting it
 * green would editorialise. It reads as neutral and the VAC line next to it
 * carries the judgement.
 */
export function deltaTone(metric: SimMetric): DeltaTone {
  if (metric.delta == null || metric.baseline == null || metric.simulated == null) return "unknown";
  if (metric.delta === 0) return "neutral";

  const worseWhenUp = HIGHER_IS_WORSE.has(metric.key);
  const betterWhenUp = HIGHER_IS_BETTER.has(metric.key);
  if (!worseWhenUp && !betterWhenUp) return "neutral";

  const up = metric.delta > 0;
  return up === betterWhenUp ? "improved" : "worsened";
}

/**
 * Format a value in its own unit. Returns null when the value is unavailable,
 * so the caller renders an explicit "unavailable" instead of "0".
 */
export function formatValue(
  value: number | null,
  unit: SimUnit,
  locale: string,
  options: { signed?: boolean } = {},
): string | null {
  if (value == null || !Number.isFinite(value)) return null;

  const sign = options.signed && value > 0 ? "+" : "";
  const intl = locale === "es" ? "es-ES" : "en-US";

  switch (unit) {
    case "currency":
      return `${sign}${new Intl.NumberFormat(intl, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value)}`;
    case "percent":
      return `${sign}${round(value, 1)}%`;
    case "ratio":
      return `${sign}${round(value, 2)}`;
    case "days":
    case "hours":
    case "count":
      return `${sign}${round(value, value % 1 === 0 ? 0 : 1)}`;
  }
}

/**
 * The unit suffix shown next to a formatted number, e.g. "12 days".
 * Currency, percent and ratio carry their own marker already.
 */
export function unitSuffix(unit: SimUnit, labels: { days: string; hours: string }): string | null {
  if (unit === "days") return labels.days;
  if (unit === "hours") return labels.hours;
  return null;
}

/** i18n key for a metric, so the table never renders a raw engine key. */
export function metricLabelKey(key: string): string {
  const camel = key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  return `metric${camel.charAt(0).toUpperCase()}${camel.slice(1)}`;
}

/** i18n key for a provenance badge. */
export function provenanceLabelKey(provenance: SimProvenance): string {
  switch (provenance) {
    case "OBSERVED":
      return "provenanceObserved";
    case "ASSUMED":
      return "provenanceAssumed";
    case "DERIVED_PROXY":
      return "provenanceDerivedProxy";
    case "UNAVAILABLE":
      return "provenanceUnavailable";
  }
}

/**
 * i18n key for a server action error.
 *
 * The panel used to render the raw code, so a user saw the literal word
 * "unexpected" in a red box — a string written for a developer, shown to
 * someone who can only conclude that the product broke without saying how.
 * Unknown codes fall back to the generic message rather than leaking whatever
 * new identifier a future action invents.
 */
export function actionErrorKey(code: string | null | undefined): string {
  switch (code) {
    case "not_authenticated":
      return "errors.notAuthenticated";
    case "not_authorized":
      return "errors.notAuthorized";
    case "not_found":
      return "errors.notFound";
    case "invalid_input":
      return "errors.invalidInput";
    default:
      return "errors.unexpected";
  }
}

export function engineLabelKey(engine: SimMetric["engine"]): string {
  switch (engine) {
    case "cpm":
      return "engineCpm";
    case "evm":
      return "engineEvm";
    case "capacity_generic":
      return "engineCapacity";
    case "risk_policy":
      return "engineRisk";
    case "projection":
      return "engineProjection";
  }
}

/** One rendered results row. All formatting already applied. */
export interface ResultRow {
  key: string;
  labelKey: string;
  unit: SimUnit;
  baseline: string | null;
  simulated: string | null;
  delta: string | null;
  tone: DeltaTone;
  provenance: SimProvenance;
  provenanceKey: string;
  engineKey: string;
  unavailableReason: string | null;
  /** True when the figure is the user's assumption or a derived proxy. */
  needsCaveat: boolean;
}

export function buildResultRows(
  metrics: readonly SimMetric[],
  locale: string,
): ResultRow[] {
  return metrics.map((metric) => ({
    key: metric.key,
    labelKey: metricLabelKey(metric.key),
    unit: metric.unit,
    baseline: formatValue(metric.baseline, metric.unit, locale),
    simulated: formatValue(metric.simulated, metric.unit, locale),
    delta: formatValue(metric.delta, metric.unit, locale, { signed: true }),
    tone: deltaTone(metric),
    provenance: metric.provenance,
    provenanceKey: provenanceLabelKey(metric.provenance),
    engineKey: engineLabelKey(metric.engine),
    unavailableReason: metric.unavailableReason,
    needsCaveat: metric.provenance === "ASSUMED" || metric.provenance === "DERIVED_PROXY",
  }));
}

// ── Graph compare mode ──────────────────────────────────────────────────────

export type GraphViewMode = "baseline" | "simulated" | "compare";

/** Node state in Compare mode. Maps to the agreed colour vocabulary. */
export type CompareState =
  | "improved"        // green
  | "worsened"        // red
  | "new_risk"        // orange
  | "resource_change" // blue
  | "unchanged";      // grey

export const COMPARE_COLORS: Record<CompareState, string> = {
  improved: "#16a34a",
  worsened: "#dc2626",
  new_risk: "#ea580c",
  resource_change: "#2563eb",
  unchanged: "#94a3b8",
};

/**
 * Classify every node for Compare mode.
 *
 * A node is only coloured when the simulation actually touched it. Nodes the
 * scenario never reached stay grey — an unchanged node rendered as "improved"
 * because its neighbour moved would misrepresent the blast radius, which is the
 * one thing Compare mode exists to show accurately.
 */
export function classifyNodesForCompare(result: SimResult): Map<string, CompareState> {
  const states = new Map<string, CompareState>();
  const affected = new Set(result.affectedNodeIds);

  for (const outcome of result.outcomes) {
    if (!outcome.computable) continue;

    for (const nodeId of outcome.affectedNodeIds) {
      // Resource changes have their own colour, and they do not override a
      // schedule or risk verdict already recorded for the same node.
      if (outcome.kind === "resource") {
        if (!states.has(nodeId)) states.set(nodeId, "resource_change");
        continue;
      }

      if (outcome.kind === "risk") {
        const materialized = outcome.metrics.some(
          (metric) => metric.key === "open_risks" && (metric.delta ?? 0) > 0,
        );
        const exposureUp = outcome.metrics.some(
          (metric) =>
            (metric.key === "risk_exposure_cost" || metric.key === "risk_exposure_days") &&
            (metric.delta ?? 0) > 0,
        );
        states.set(nodeId, materialized || exposureUp ? "new_risk" : "improved");
        continue;
      }

      // Budget and schedule: the worst tone among this outcome's metrics wins,
      // so a node that improves on one axis and degrades on another reads as
      // degraded rather than quietly averaging out.
      const tones = outcome.metrics.map(deltaTone);
      const state: CompareState = tones.includes("worsened")
        ? "worsened"
        : tones.includes("improved")
          ? "improved"
          : "unchanged";
      const existing = states.get(nodeId);
      if (existing === "worsened" || existing === "new_risk") continue;
      states.set(nodeId, state);
    }
  }

  for (const nodeId of affected) {
    if (!states.has(nodeId)) states.set(nodeId, "unchanged");
  }

  return states;
}

/** Edge style per view mode: solid baseline, dashed simulated. */
export function edgeDashArray(mode: GraphViewMode): string | undefined {
  return mode === "simulated" ? "6 3" : undefined;
}

/**
 * Nodes to centre when a metric or intervention is selected.
 * Returns an empty array when the selection touched nothing, so the caller can
 * say "no affected nodes" rather than zooming to an arbitrary place.
 */
export function nodesForSelection(
  result: SimResult,
  selection: { kind: "intervention" | "metric"; id: string } | null,
): string[] {
  if (!selection) return result.affectedNodeIds;

  if (selection.kind === "intervention") {
    return result.outcomes.find((o) => o.interventionId === selection.id)?.affectedNodeIds ?? [];
  }

  // A metric maps back to every intervention that produced it.
  const ids = new Set<string>();
  for (const outcome of result.outcomes) {
    if (!outcome.metrics.some((metric) => metric.key === selection.id)) continue;
    for (const nodeId of outcome.affectedNodeIds) ids.add(nodeId);
  }
  return [...ids];
}

function round(value: number, digits: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
