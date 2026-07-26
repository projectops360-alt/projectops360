// ============================================================================
// Acronym Intelligence — the registry (CAP-050)
// ============================================================================
// One assembled corpus, one index, one set of lookups. Every surface that
// explains a term goes through here, so a definition cannot diverge between the
// results table, a metric card and a node panel.
//
// The corpus is split across `registry-*.ts` files by category purely so that
// no single file is unreviewable. This module is where they become one thing.
// ============================================================================

import type {
  AcronymCategory,
  AcronymContext,
  AcronymEntry,
  AcronymFormula,
  LocalizedText,
} from "./contracts";
import { EVM_ENTRIES } from "./registry-evm";
import { FORECAST_ENTRIES } from "./registry-forecast";
import { BUDGET_ENTRIES } from "./registry-budget";
import { SCHEDULE_ENTRIES } from "./registry-schedule";
import { RISK_ENTRIES } from "./registry-risk";
import { PROCESS_ENTRIES } from "./registry-process";
import { PORTFOLIO_ENTRIES, SIMULATION_ENTRIES } from "./registry-simulation";

/** Corpus version. Bump when the SHAPE of the registry changes, not per entry. */
export const ACRONYM_REGISTRY_VERSION = "1.0.0";

/** Every entry, in category order. */
export const ACRONYM_ENTRIES: readonly AcronymEntry[] = [
  ...EVM_ENTRIES,
  ...FORECAST_ENTRIES,
  ...BUDGET_ENTRIES,
  ...SCHEDULE_ENTRIES,
  ...RISK_ENTRIES,
  ...PROCESS_ENTRIES,
  ...SIMULATION_ENTRIES,
  ...PORTFOLIO_ENTRIES,
];

/**
 * Case-sensitive index.
 *
 * Deliberately built at module load and frozen: a lookup that could miss
 * because of insertion order would make the tooltip non-deterministic.
 */
const INDEX: ReadonlyMap<string, AcronymEntry> = new Map(
  ACRONYM_ENTRIES.map((entry) => [entry.code, entry]),
);

/**
 * Look up one term.
 *
 * Returns `undefined` for an unknown code rather than throwing. An acronym the
 * corpus has not covered yet must degrade to plain text on screen — a glossary
 * that crashes the dashboard it annotates is worse than no glossary.
 */
export function getAcronym(code: string): AcronymEntry | undefined {
  return INDEX.get(code);
}

export function hasAcronym(code: string): boolean {
  return INDEX.has(code);
}

export function getAcronymsByCategory(category: AcronymCategory): AcronymEntry[] {
  return ACRONYM_ENTRIES.filter((entry) => entry.category === category);
}

/** All codes, for tests and for the reference view. */
export function allAcronymCodes(): string[] {
  return ACRONYM_ENTRIES.map((entry) => entry.code);
}

// ── Locale helpers ──────────────────────────────────────────────────────────

/** Anything not Spanish falls back to English. Both keys always exist. */
export function localize(text: LocalizedText, locale: string): string {
  return locale.startsWith("es") ? text.es : text.en;
}

export function localizeList(
  list: { en: string[]; es: string[] } | undefined,
  locale: string,
): string[] {
  if (!list) return [];
  return locale.startsWith("es") ? list.es : list.en;
}

// ── Formula resolution ──────────────────────────────────────────────────────

/**
 * Decide which formula to present.
 *
 * This is the function that keeps the glossary honest about EAC. The engine
 * (`computeDeterministicForecasts`) can compute five variants and the finance
 * stage picks one; when the caller passes that choice through as
 * `context.formulaId`, the panel shows THAT formula as the one used and the
 * others as alternatives. With no signal it falls back to the entry's default
 * and the UI says so — it never claims a variant was used when it does not know.
 */
export interface ResolvedFormula {
  /** The formula to present as the one that produced the number, if known. */
  used: AcronymFormula | null;
  /** The other variants, always shown so no term looks like it has only one. */
  alternatives: AcronymFormula[];
  /**
   * True when `used` came from an explicit engine signal rather than from the
   * entry default. The UI must label a fallback differently from a fact.
   */
  isConfirmed: boolean;
}

export function resolveFormula(
  entry: AcronymEntry | undefined,
  context?: AcronymContext | null,
): ResolvedFormula {
  const formulas = entry?.formulas ?? [];
  if (formulas.length === 0) return { used: null, alternatives: [], isConfirmed: false };

  const signalled = context?.formulaId
    ? formulas.find((formula) => formula.id === context.formulaId)
    : undefined;

  if (signalled) {
    return {
      used: signalled,
      alternatives: formulas.filter((formula) => formula.id !== signalled.id),
      isConfirmed: true,
    };
  }

  // No signal (or a signal naming a variant this entry does not define, which
  // is a caller bug we degrade rather than crash on): fall back to the default.
  const fallback = formulas.find((formula) => formula.isDefault) ?? formulas[0];
  return {
    used: fallback,
    alternatives: formulas.filter((formula) => formula.id !== fallback.id),
    isConfirmed: false,
  };
}

/** True when the term has more than one standard formula (EAC, TF, ETC, TCPI). */
export function hasMultipleFormulas(entry: AcronymEntry | undefined): boolean {
  return (entry?.formulas?.length ?? 0) > 1;
}

// ── Related terms ───────────────────────────────────────────────────────────

/**
 * Resolve `relatedTerms` to entries, dropping any that do not exist.
 *
 * A test asserts none are dropped, so in a passing build this filter never
 * removes anything — it is here so a bad code in the data renders as a shorter
 * list rather than as a crash in a panel.
 */
export function getRelatedEntries(entry: AcronymEntry | undefined): AcronymEntry[] {
  if (!entry?.relatedTerms) return [];
  return entry.relatedTerms
    .map((code) => INDEX.get(code))
    .filter((related): related is AcronymEntry => related != null);
}
