// ============================================================================
// ProjectOps360° — KPI Calculation Engine · pure evaluation core (CAP-046 F3)
// ============================================================================
// Pure: takes a dataset (already loaded) + a catalog slug or ad-hoc expression,
// validates against the allow-list, evaluates in the sandbox, and returns an
// honest result (NaN → explicit "not computable", never a fake 0).
// ============================================================================

import { KPI_DATASET_VARIABLES, findKpiDefinition, type KpiCatalogDefinition } from "./catalog";
import { evaluateKpiExpression, validateKpiExpression } from "./parser";

/** Aligned dataset arrays keyed by allow-listed variable name. */
export type KpiDataset = Record<(typeof KPI_DATASET_VARIABLES)[number], number[]>;

export type KpiEvaluation =
  | {
      status: "ok";
      slug: string | null;
      expression: string;
      value: number;
      formatted: string;
      unit: string | null;
      usedVariables: string[];
    }
  | { status: "not_computable"; slug: string | null; expression: string; reason: string }
  | { status: "invalid"; expression: string; error: string };

function formatValue(value: number, precision: number): string {
  return value.toFixed(precision);
}

/** Evaluate a catalog KPI against a dataset. */
export function evaluateCatalogKpi(definition: KpiCatalogDefinition, dataset: KpiDataset): KpiEvaluation {
  return evaluateExpression(definition.expression, dataset, definition.slug, definition.unit, definition.precision);
}

/** Evaluate a catalog slug OR a custom ad-hoc expression against a dataset. */
export function evaluateKpi(
  input: { kpiSlug?: string; expression?: string },
  dataset: KpiDataset,
): KpiEvaluation {
  if (input.kpiSlug) {
    const definition = findKpiDefinition(input.kpiSlug);
    if (!definition) {
      return { status: "invalid", expression: input.kpiSlug, error: `Unknown KPI slug "${input.kpiSlug}".` };
    }
    return evaluateCatalogKpi(definition, dataset);
  }
  if (input.expression) {
    return evaluateExpression(input.expression, dataset, null, null, 2);
  }
  return { status: "invalid", expression: "", error: "Provide kpi_slug or expression." };
}

function evaluateExpression(
  expression: string,
  dataset: KpiDataset,
  slug: string | null,
  unit: string | null,
  precision: number,
): KpiEvaluation {
  const validation = validateKpiExpression(expression, KPI_DATASET_VARIABLES);
  if (!validation.valid) {
    return { status: "invalid", expression, error: validation.error };
  }
  let value: number;
  try {
    value = evaluateKpiExpression(expression, dataset);
  } catch (err) {
    return {
      status: "invalid",
      expression,
      error: `Evaluation error: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
  if (!Number.isFinite(value)) {
    return {
      status: "not_computable",
      slug,
      expression,
      reason: "Insufficient data for this KPI (empty or non-numeric inputs).",
    };
  }
  return {
    status: "ok",
    slug,
    expression,
    value,
    formatted: formatValue(value, precision),
    unit,
    usedVariables: validation.variables,
  };
}
