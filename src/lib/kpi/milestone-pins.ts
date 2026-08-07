// ============================================================================
// Resolving a pinned KPI, and reporting one that no longer resolves
// ============================================================================
// A pin stores a slug, not a definition. Two things can hide behind that slug:
// a built-in from the catalog (which lives in code and has no row to point at)
// or a custom KPI the user wrote for this project.
//
// The interesting case is the third one: a slug that resolves to NEITHER,
// because the custom KPI behind it was deleted. Dropping such a pin silently
// would make a card quietly lose a number the PM chose to be measured by, with
// nothing to explain the absence. It is surfaced instead.
// ============================================================================

import { findKpiDefinition, KPI_CATALOG, type KpiCatalogDefinition } from "./catalog";
import { evaluateKpi, type KpiDataset, type KpiEvaluation } from "./evaluate";
import type { CustomKpiDefinition } from "./custom";

/**
 * How many KPIs one milestone may carry. Beyond this a hover card stops being a
 * summary and becomes a report nobody reads at a glance.
 *
 * Lives here rather than beside the action that enforces it because a
 * "use server" module may only export async functions.
 */
export const MAX_PINS_PER_MILESTONE = 8;

/** A KPI that can be pinned, from either source, in one shape. */
export interface PinnableKpi {
  slug: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string | null;
  descriptionEn: string | null;
  expression: string;
  unit: string | null;
  precision: number;
  source: "catalog" | "custom";
  target?: number | null;
  targetDirection?: "at_or_above" | "at_or_below" | null;
}

function fromCatalog(d: KpiCatalogDefinition): PinnableKpi {
  return {
    slug: d.slug,
    nameEs: d.nameEs,
    nameEn: d.nameEn,
    descriptionEs: d.descriptionEs,
    descriptionEn: d.descriptionEn,
    expression: d.expression,
    unit: d.unit,
    precision: d.precision,
    source: "catalog",
  };
}

function fromCustom(d: CustomKpiDefinition): PinnableKpi {
  return {
    slug: d.slug,
    nameEs: d.nameEs,
    nameEn: d.nameEn,
    descriptionEs: d.descriptionEs,
    descriptionEn: d.descriptionEn,
    expression: d.expression,
    unit: d.unit,
    precision: d.precision,
    source: "custom",
    target: d.target,
    targetDirection: d.targetDirection,
  };
}

/**
 * Everything that can be pinned, built-ins first.
 *
 * A custom KPI that reuses a built-in slug does NOT shadow it — the built-in
 * wins. Otherwise a project could redefine `overall_progress` locally and two
 * screens would quietly disagree about what "progress" means, which is the
 * metric drift PD-019 exists to prevent.
 */
export function pinnableKpis(custom: readonly CustomKpiDefinition[]): PinnableKpi[] {
  const catalog = CATALOG_KPIS;
  const taken = new Set(catalog.map((k) => k.slug));
  return [...catalog, ...custom.filter((c) => !taken.has(c.slug)).map(fromCustom)];
}

/** Built-ins, shaped once at module load. */
const CATALOG_KPIS: PinnableKpi[] = KPI_CATALOG.map(fromCatalog);

export function resolvePinnedKpi(
  slug: string,
  custom: readonly CustomKpiDefinition[],
): PinnableKpi | null {
  const builtIn = findKpiDefinition(slug);
  if (builtIn) return fromCatalog(builtIn);
  const own = custom.find((c) => c.slug === slug);
  return own ? fromCustom(own) : null;
}

/** A pinned KPI resolved and evaluated in one milestone's scope. */
export type ResolvedPinnedKpi =
  | {
      status: "ok";
      slug: string;
      nameEs: string;
      nameEn: string;
      unit: string | null;
      /** Already rounded to the KPI's precision. */
      value: number;
      formatted: string;
      expression: string;
      /** Tasks in the milestone — an empty scope explains a missing value. */
      taskCount: number;
      /** Set when the KPI declares a target and the value misses it. */
      offTarget: boolean;
    }
  | {
      /** The expression ran but the data cannot answer it. NOT a zero. */
      status: "not_computable";
      slug: string;
      nameEs: string;
      nameEn: string;
      expression: string;
      taskCount: number;
      reason: string;
    }
  | {
      /** The slug no longer resolves — the custom KPI behind it was deleted. */
      status: "missing";
      slug: string;
    };

function missesTarget(kpi: PinnableKpi, value: number): boolean {
  if (kpi.target == null || kpi.targetDirection == null) return false;
  return kpi.targetDirection === "at_or_above" ? value < kpi.target : value > kpi.target;
}

/**
 * Evaluate one pinned KPI against one milestone's dataset.
 *
 * The dataset is the milestone's own — same shape as the project's, so the
 * expression is untouched. That is the whole trick: the KPI does not know it
 * is being asked about a phase rather than a project.
 */
export function evaluatePinnedKpi(
  slug: string,
  custom: readonly CustomKpiDefinition[],
  dataset: KpiDataset,
  taskCount: number,
): ResolvedPinnedKpi {
  const kpi = resolvePinnedKpi(slug, custom);
  if (!kpi) return { status: "missing", slug };

  const result: KpiEvaluation = evaluateKpi(
    kpi.source === "catalog" ? { kpiSlug: kpi.slug } : { expression: kpi.expression },
    dataset,
  );

  if (result.status === "ok") {
    return {
      status: "ok",
      slug: kpi.slug,
      nameEs: kpi.nameEs,
      nameEn: kpi.nameEn,
      unit: kpi.unit,
      value: result.value,
      formatted: result.formatted,
      expression: kpi.expression,
      taskCount,
      offTarget: missesTarget(kpi, result.value),
    };
  }

  return {
    status: "not_computable",
    slug: kpi.slug,
    nameEs: kpi.nameEs,
    nameEn: kpi.nameEn,
    expression: kpi.expression,
    taskCount,
    reason: result.status === "invalid" ? result.error : result.reason,
  };
}
