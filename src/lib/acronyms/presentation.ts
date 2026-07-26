// ============================================================================
// Acronym Intelligence — presentation logic (CAP-050)
// ============================================================================
// Pure. The components render what these functions return and decide nothing,
// which is what makes "Data unavailable never renders as 0" and "Isabella gets
// the registry's definition, not a paraphrase" testable without a DOM.
// ============================================================================

import type { SimUnit } from "@/lib/pmo-simulation/contracts";
import { formatValue } from "@/lib/pmo-simulation/presentation";
import type {
  AcronymContext,
  AcronymEntry,
  FavorableDirection,
} from "./contracts";
import {
  getAcronym,
  getRelatedEntries,
  localize,
  localizeList,
  resolveFormula,
  type ResolvedFormula,
} from "./registry";

/** What the tooltip needs. Short by construction. */
export interface AcronymTooltipModel {
  code: string;
  fullName: string;
  shortDefinition: string;
  /** Unit name key, e.g. "unitCurrency". Null when the term has no unit. */
  unitKey: string | null;
  /** True when the panel has more to offer, so the hint is worth showing. */
  hasDetail: boolean;
}

export function buildTooltipModel(
  code: string,
  locale: string,
): AcronymTooltipModel | null {
  const entry = getAcronym(code);
  if (!entry) return null;

  return {
    code: entry.code,
    fullName: localize(entry.fullName, locale),
    shortDefinition: localize(entry.shortDefinition, locale),
    unitKey: entry.unit ? unitLabelKey(entry.unit) : null,
    hasDetail: true,
  };
}

/** i18n key for a unit name. Never a hardcoded word. */
export function unitLabelKey(unit: SimUnit): string {
  switch (unit) {
    case "currency":
      return "unitCurrency";
    case "days":
      return "unitDaysLong";
    case "hours":
      return "unitHoursLong";
    case "count":
      return "unitCount";
    case "percent":
      return "unitPercent";
    case "ratio":
      return "unitRatio";
  }
}

/** i18n key for the favourable-direction line. */
export function directionLabelKey(direction: FavorableDirection): string {
  switch (direction) {
    case "higher":
      return "directionHigher";
    case "lower":
      return "directionLower";
    case "target_one":
      return "directionTargetOne";
    case "context_dependent":
      return "directionContextDependent";
  }
}

// ── Scenario context ────────────────────────────────────────────────────────

/**
 * A value formatted for the "In this scenario" section.
 *
 * `display` is null when the number is genuinely absent, and the component
 * renders the "Data unavailable" label for it. This is the same rule the
 * simulation results table already follows — an absent value is never a zero,
 * because a zero is a claim.
 */
export interface ContextValue {
  display: string | null;
  available: boolean;
}

function contextValue(
  value: number | null | undefined,
  unit: SimUnit,
  locale: string,
  options: { signed?: boolean } = {},
): ContextValue {
  if (value == null) return { display: null, available: false };
  const display = formatValue(value, unit, locale, options);
  return { display, available: display != null };
}

/** The "In this scenario" block, fully formatted. */
export interface AcronymScenarioModel {
  baseline: ContextValue;
  simulated: ContextValue;
  delta: ContextValue;
  inputs: Array<{ label: string; value: ContextValue; provenanceKey: string | null }>;
  provenanceKey: string | null;
  engine: string | null;
  computedAt: string | null;
  dataCoverage: { available: string[]; unavailable: string[] } | null;
  confidence: "high" | "medium" | "low" | null;
  /** Whether ANY of the three headline values exists. */
  hasAnyValue: boolean;
}

/**
 * Build the scenario block, or null when there is no context at all.
 *
 * Returning null for "no context" and a model full of unavailable values for
 * "context with gaps" is a deliberate distinction: the first hides the section,
 * the second shows it honestly reporting what is missing.
 */
export function buildScenarioModel(
  entry: AcronymEntry | undefined,
  context: AcronymContext | null | undefined,
  locale: string,
): AcronymScenarioModel | null {
  if (!entry || !context) return null;

  // The context's own unit wins over the entry's: a metric can be measured in a
  // unit the generic term does not fix (risk exposure is currency OR days).
  const unit: SimUnit = context.unit ?? entry.unit ?? "count";

  const baseline = contextValue(context.baseline, unit, locale);
  const simulated = contextValue(context.simulated, unit, locale);
  const delta = contextValue(context.delta, unit, locale, { signed: true });

  return {
    baseline,
    simulated,
    delta,
    inputs: (context.inputs ?? []).map((input) => ({
      label: input.label,
      value: contextValue(input.value, input.unit ?? unit, locale),
      provenanceKey: input.provenance ? provenanceKey(input.provenance) : null,
    })),
    provenanceKey: context.provenance ? provenanceKey(context.provenance) : null,
    engine: context.engine ?? null,
    computedAt: context.computedAt ?? null,
    dataCoverage: context.dataCoverage ?? null,
    confidence: context.confidence ?? null,
    hasAnyValue: baseline.available || simulated.available || delta.available,
  };
}

/**
 * Map a provenance string to its i18n key.
 *
 * Reuses the simulation's own vocabulary rather than defining a parallel one,
 * so a badge in the acronym panel reads identically to the badge in the results
 * table for the same value.
 */
export function provenanceKey(provenance: string): string {
  switch (provenance) {
    case "OBSERVED":
      return "provenanceObserved";
    case "ASSUMED":
      return "provenanceAssumed";
    case "DERIVED_PROXY":
      return "provenanceDerivedProxy";
    case "UNAVAILABLE":
      return "provenanceUnavailable";
    default:
      return "provenanceUnknown";
  }
}

// ── Full panel ──────────────────────────────────────────────────────────────

export interface AcronymPanelModel {
  code: string;
  category: string;
  fullName: string;
  shortDefinition: string;
  fullDefinition: string;
  formula: ResolvedFormula;
  variables: Array<{ symbol: string; meaning: string; code?: string }>;
  unitKey: string | null;
  directionKey: string | null;
  interpretation: string | null;
  caveats: string[];
  example: string | null;
  related: Array<{ code: string; fullName: string }>;
  source: string | null;
  version: string;
  scenario: AcronymScenarioModel | null;
}

export function buildPanelModel(
  code: string,
  locale: string,
  context?: AcronymContext | null,
): AcronymPanelModel | null {
  const entry = getAcronym(code);
  if (!entry) return null;

  return {
    code: entry.code,
    category: entry.category,
    fullName: localize(entry.fullName, locale),
    shortDefinition: localize(entry.shortDefinition, locale),
    fullDefinition: localize(entry.fullDefinition, locale),
    formula: resolveFormula(entry, context),
    variables: (entry.formulaVariables ?? []).map((variable) => ({
      symbol: variable.symbol,
      meaning: localize(variable.meaning, locale),
      code: variable.code,
    })),
    unitKey: entry.unit ? unitLabelKey(entry.unit) : null,
    directionKey: entry.favorableDirection ? directionLabelKey(entry.favorableDirection) : null,
    interpretation: entry.interpretation ? localize(entry.interpretation, locale) : null,
    caveats: localizeList(entry.caveats, locale),
    example: entry.example ? localize(entry.example, locale) : null,
    related: getRelatedEntries(entry).map((related) => ({
      code: related.code,
      fullName: localize(related.fullName, locale),
    })),
    source: entry.source ?? null,
    version: entry.version,
    scenario: buildScenarioModel(entry, context, locale),
  };
}
