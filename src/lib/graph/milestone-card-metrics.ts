// ============================================================================
// What a milestone card shows — chosen by the user, not by us
// ============================================================================
// The cost rollup answers "what did this phase cost in time, money and effort".
// Which of those answers belongs on the card is not a question the product can
// settle: a PM tracking budget wants money, a delivery lead wants effort, and
// an executive wants neither on twelve cards at once.
//
// So this is a CATALOGUE, not a layout. Each metric knows how to derive itself
// from the rollup and how to render itself; the card renders whatever the user
// picked and nothing else. Adding a metric here makes it available everywhere
// the picker is shown, with no change to any component.
// ============================================================================

import type { MilestoneCostRollup } from "@/lib/roadmap/milestone-cost-rollup";

export type MilestoneMetricGroup = "effort" | "time" | "money" | "scope";
export type MilestoneMetricFormat = "hours" | "days" | "money" | "count" | "percent";
/** How a value reads at a glance. Never decoration — it encodes a judgement. */
export type MilestoneMetricTone = "neutral" | "good" | "warn" | "danger";

export interface MilestoneCardMetric {
  id: string;
  group: MilestoneMetricGroup;
  /** Full name, shown in the picker. */
  es: string;
  en: string;
  /** Two or three characters, shown on the card beside the number. */
  esShort: string;
  enShort: string;
  format: MilestoneMetricFormat;
  /**
   * The number, or null when the data cannot support it. Null is rendered as
   * "—", never as 0: a phase with no budget line did not cost nothing.
   */
  value: (r: MilestoneCostRollup) => number | null;
  /** Optional judgement on the value. Default is neutral. */
  tone?: (value: number, r: MilestoneCostRollup) => MilestoneMetricTone;
}

/** Money actually consumed so far: labour done plus materials committed. */
function spendToDate(r: MilestoneCostRollup): number | null {
  const parts = [r.labourCost, r.materialCost].filter((c): c is number => c != null);
  return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
}

export const MILESTONE_CARD_METRICS: MilestoneCardMetric[] = [
  // ── Effort ────────────────────────────────────────────────────────────────
  {
    id: "estimatedHours",
    group: "effort",
    es: "Horas estimadas",
    en: "Estimated hours",
    esShort: "est",
    enShort: "est",
    format: "hours",
    value: (r) => (r.taskCount > 0 ? r.estimatedHours : null),
  },
  {
    id: "actualHours",
    group: "effort",
    es: "Horas reales",
    en: "Actual hours",
    esShort: "real",
    enShort: "actual",
    format: "hours",
    value: (r) => (r.taskCount > 0 ? r.actualHours : null),
  },
  {
    id: "varianceHours",
    group: "effort",
    es: "Desviación de horas",
    en: "Hours variance",
    esShort: "desv",
    enShort: "var",
    format: "hours",
    // Only meaningful once there are both an estimate and logged work.
    value: (r) => (r.estimatedHours > 0 && r.actualHours > 0 ? r.varianceHours : null),
    // Positive means it took longer than planned (CAP-051 §10).
    tone: (v) => (v > 0 ? "danger" : v < 0 ? "good" : "neutral"),
  },
  {
    id: "effortUsedPct",
    group: "effort",
    es: "Esfuerzo consumido",
    en: "Effort consumed",
    esShort: "esf",
    enShort: "eff",
    format: "percent",
    value: (r) =>
      r.estimatedHours > 0 ? Math.round((r.actualHours / r.estimatedHours) * 100) : null,
    tone: (v) => (v > 100 ? "danger" : v >= 90 ? "warn" : "neutral"),
  },

  // ── Time ──────────────────────────────────────────────────────────────────
  {
    id: "plannedDurationDays",
    group: "time",
    es: "Duración planificada",
    en: "Planned duration",
    esShort: "días",
    enShort: "days",
    format: "days",
    value: (r) => r.plannedDurationDays,
  },

  // ── Money ─────────────────────────────────────────────────────────────────
  {
    id: "budget",
    group: "money",
    es: "Presupuesto",
    en: "Budget",
    esShort: "ppto",
    enShort: "budget",
    format: "money",
    value: (r) => r.budget,
  },
  {
    id: "labourCost",
    group: "money",
    es: "Coste de mano de obra",
    en: "Labour cost",
    esShort: "m.o.",
    enShort: "labour",
    format: "money",
    value: (r) => r.labourCost,
  },
  {
    id: "materialCost",
    group: "money",
    es: "Coste de materiales",
    en: "Material cost",
    esShort: "mat",
    enShort: "mat",
    format: "money",
    value: (r) => r.materialCost,
  },
  {
    id: "spendToDate",
    group: "money",
    es: "Gasto a la fecha",
    en: "Spend to date",
    esShort: "gasto",
    enShort: "spend",
    format: "money",
    value: spendToDate,
  },
  {
    id: "budgetRemaining",
    group: "money",
    es: "Presupuesto restante",
    en: "Budget remaining",
    esShort: "resta",
    enShort: "left",
    format: "money",
    value: (r) => {
      const spent = spendToDate(r);
      return r.budget != null && spent != null ? r.budget - spent : null;
    },
    tone: (v) => (v < 0 ? "danger" : "neutral"),
  },
  {
    id: "budgetUsedPct",
    group: "money",
    es: "Presupuesto consumido",
    en: "Budget consumed",
    esShort: "ppto",
    enShort: "budget",
    format: "percent",
    value: (r) => {
      const spent = spendToDate(r);
      return r.budget != null && r.budget > 0 && spent != null
        ? Math.round((spent / r.budget) * 100)
        : null;
    },
    tone: (v) => (v > 100 ? "danger" : v >= 90 ? "warn" : "neutral"),
  },

  // ── Scope ─────────────────────────────────────────────────────────────────
  {
    id: "taskCount",
    group: "scope",
    es: "Tareas totales",
    en: "Total tasks",
    esShort: "tareas",
    enShort: "tasks",
    format: "count",
    value: (r) => r.taskCount,
  },
  {
    id: "tasksRemaining",
    group: "scope",
    es: "Tareas pendientes",
    en: "Open tasks",
    esShort: "pend",
    enShort: "open",
    format: "count",
    value: (r) => r.taskCount - r.tasksDone,
  },
];

const BY_ID = new Map(MILESTONE_CARD_METRICS.map((m) => [m.id, m]));

/**
 * How many metrics a card may show at once.
 *
 * Not an arbitrary limit: the cards sit 130px apart vertically, and each row of
 * chips adds ~22px. Four metrics in a 2×2 grid grow the card by ~48px, well
 * inside that gap, so the serpentine layout never has to be recomputed and
 * cards can never overlap. Raising this without revisiting SNAKE_GAP_Y would
 * make cards collide at the bottom of each row.
 */
export const MAX_MILESTONE_CARD_METRICS = 4;

/**
 * Nothing is shown until the user asks for it.
 *
 * An empty default is deliberate: turning this on for everyone would silently
 * change every existing card, which is the failure this codebase keeps writing
 * rules against. The picker is discoverable; the change is opt-in.
 */
export const DEFAULT_MILESTONE_CARD_METRIC_IDS: string[] = [];

export function getMilestoneCardMetric(id: string): MilestoneCardMetric | undefined {
  return BY_ID.get(id);
}

/**
 * Clean a stored selection.
 *
 * Preferences outlive releases: a selection saved months ago may name a metric
 * that has since been renamed or dropped. Unknown ids are discarded rather than
 * crashing the card, duplicates collapse, and the cap is enforced here so no
 * caller can exceed it by writing storage directly.
 */
export function sanitizeMetricSelection(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_MILESTONE_CARD_METRICS) break;
  }
  return out;
}

/**
 * Add or remove a metric. At the cap, adding drops the OLDEST selection rather
 * than refusing: a picker that silently ignores a click reads as broken, and
 * the user's newest choice is the one they care about.
 */
export function toggleMetricSelection(current: string[], id: string): string[] {
  if (!BY_ID.has(id)) return current;
  if (current.includes(id)) return current.filter((x) => x !== id);
  const next = [...current, id];
  return next.slice(Math.max(0, next.length - MAX_MILESTONE_CARD_METRICS));
}

export interface ResolvedMilestoneMetric {
  id: string;
  label: string;
  /** Formatted value, or "—" when the data cannot support it. */
  text: string;
  tone: MilestoneMetricTone;
  /** False when there is no value — the card dims it instead of hiding it. */
  hasValue: boolean;
}

export interface FormatMetricOptions {
  locale: string;
  currency?: string;
}

/** Compact money: 1.296.000 → "1,3 M". Cards have no room for eight digits. */
function formatMoney(value: number, locale: string, currency: string): string {
  const abs = Math.abs(value);
  const compact = abs >= 10_000;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

function formatNumber(value: number, locale: string): string {
  const rounded = Math.round(value);
  return new Intl.NumberFormat(locale, {
    notation: Math.abs(rounded) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(rounded);
}

export function formatMetricValue(
  metric: MilestoneCardMetric,
  value: number | null,
  { locale, currency = "USD" }: FormatMetricOptions,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  switch (metric.format) {
    case "money":
      return formatMoney(value, locale, currency);
    case "percent":
      return `${Math.round(value)}%`;
    case "hours":
      // Sign is meaningful on a variance: "+120 h" reads as an overrun.
      return `${value > 0 && metric.id === "varianceHours" ? "+" : ""}${formatNumber(value, locale)} h`;
    case "days":
      return `${formatNumber(value, locale)} d`;
    case "count":
    default:
      return formatNumber(value, locale);
  }
}

/**
 * Turn the user's selection plus a rollup into what the card renders.
 * Pure — the card does no arithmetic and makes no decisions of its own.
 */
export function resolveMilestoneCardMetrics(
  selectedIds: string[],
  rollup: MilestoneCostRollup | undefined,
  options: FormatMetricOptions & { isEs: boolean },
): ResolvedMilestoneMetric[] {
  const { isEs } = options;
  return sanitizeMetricSelection(selectedIds).map((id) => {
    const metric = BY_ID.get(id)!;
    const value = rollup ? metric.value(rollup) : null;
    return {
      id,
      label: isEs ? metric.esShort : metric.enShort,
      text: formatMetricValue(metric, value, options),
      tone: value != null && metric.tone ? metric.tone(value, rollup!) : "neutral",
      hasValue: value != null,
    };
  });
}
