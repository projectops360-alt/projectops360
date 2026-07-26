// ============================================================================
// Acronym Intelligence — data contracts (CAP-050)
// ============================================================================
// The PMO dashboards render EVM, CPM and risk vocabulary as bare capitals: a
// column reads "SV", a card reads "EAC", a node panel reads "TF". Every one of
// those is a term of art with a formula, a unit, a favourable direction and at
// least one way to misread it. Today the product asserts the letters and leaves
// the meaning to the reader.
//
// This module is the single definitional source for those terms. Three rules
// are encoded in the types, because each one is a specific way the feature
// could quietly turn into misinformation:
//
//   1. A definition is BILINGUAL BY CONSTRUCTION. `LocalizedText` has required
//      `en` and `es`, so an entry cannot ship half-translated and fall back to
//      English in a Spanish session (UX-012, "No Spanglish"). Definitions live
//      here rather than in messages/{en,es}.json because a definition is
//      structured data — formula, variables, unit, direction, caveats — not a
//      display string, and splitting it across two dictionaries is how the ES
//      caveat for SV goes missing while the EN one stays.
//
//   2. A term can declare MORE THAN ONE FORMULA. `formulas` is an array. EAC
//      has four standard variants that give materially different numbers, and
//      the repo's own engine computes five (`computeDeterministicForecasts`).
//      A glossary that prints one formula as "the" formula would contradict the
//      engine that produced the number on screen — see `resolveFormula`.
//
//   3. UNIT AND DIRECTION ARE DATA, never prose. `unit` reuses `SimUnit` from
//      the simulation contracts rather than defining a parallel vocabulary, and
//      `favorableDirection` is an enum. This is what lets a test assert that SV
//      is currency and not days, which is the single most common EVM error.
//
// This module is PURE and client-safe: no DB, no network, no React. V1 adds no
// table — the corpus is small, versioned in code, and reviewable in a diff.
// ============================================================================

import type { SimUnit } from "@/lib/pmo-simulation/contracts";

/**
 * Text that must exist in both locales.
 *
 * Both fields are required. An optional `es` would compile, and then the first
 * entry added in a hurry would render English inside a Spanish panel.
 */
export interface LocalizedText {
  en: string;
  es: string;
}

/** A bilingual list, e.g. caveats. Same rule: both locales or it does not build. */
export interface LocalizedList {
  en: string[];
  es: string[];
}

/** The domains the corpus covers. Used to group the reference and to filter. */
export const ACRONYM_CATEGORIES = [
  "evm",
  "budget",
  "schedule",
  "risk",
  "resource",
  "simulation",
  "portfolio",
] as const;
export type AcronymCategory = (typeof ACRONYM_CATEGORIES)[number];

/**
 * Which way is "good".
 *
 * `context_dependent` is a real answer, not a cop-out: BAC going up is neither
 * good nor bad on its own, and `deltaTone` in the simulation already refuses to
 * colour it. The glossary must not contradict the renderer.
 */
export type FavorableDirection = "higher" | "lower" | "target_one" | "context_dependent";

/**
 * One named way to compute a term.
 *
 * `id` is stable and machine-readable so an engine can say which variant it
 * actually used (`resolveFormula`). `expression` is plain text on purpose — no
 * KaTeX, no MathJax. "EAC = AC + (BAC − EV) / CPI" is unambiguous at a glance
 * and costs nothing to ship.
 */
export interface AcronymFormula {
  id: string;
  expression: string;
  /** When a term has several variants, what distinguishes this one. */
  label?: LocalizedText;
  /** When true, this is the variant used absent any engine signal. */
  isDefault?: boolean;
}

/** A symbol appearing in a formula, expanded so the expression is readable alone. */
export interface AcronymVariable {
  symbol: string;
  meaning: LocalizedText;
  /** The acronym entry that defines this symbol, when one exists. */
  code?: string;
}

/**
 * One term.
 *
 * `shortDefinition` feeds the tooltip and is held to one or two lines by test.
 * `fullDefinition` feeds the panel. They are separate fields rather than a
 * truncation of one another because a truncated definition is how a tooltip
 * ends up saying "SV is the difference between…" and stopping before the part
 * that matters.
 */
export interface AcronymEntry {
  /** Unique, uppercase, the literal string rendered in the UI. */
  code: string;
  category: AcronymCategory;
  fullName: LocalizedText;
  /** 1–2 lines. Tooltip copy. */
  shortDefinition: LocalizedText;
  /** The panel body. */
  fullDefinition: LocalizedText;
  /** Zero, one, or several. Several is normal and correct for EAC. */
  formulas?: AcronymFormula[];
  formulaVariables?: AcronymVariable[];
  /** Reuses the simulation's unit vocabulary — never a parallel one. */
  unit?: SimUnit;
  favorableDirection?: FavorableDirection;
  /** How to read the number once you have it. */
  interpretation?: LocalizedText;
  /** The ways this term is misread. Rendered prominently, not as a footnote. */
  caveats?: LocalizedList;
  /** A worked example with INVENTED round numbers — never project data. */
  example?: LocalizedText;
  /** Codes of related entries. Validated to exist by test. */
  relatedTerms?: string[];
  /** Standard or internal doc the definition follows. */
  source?: string;
  /** Bumped when the meaning changes, so a cached answer can be detected as stale. */
  version: string;
}

/**
 * Live values for the term being explained, when the caller has them.
 *
 * Every field is optional and nullable because "we do not know" is the common
 * case and must render as "Data unavailable" rather than as zero. This mirrors
 * the `UNAVAILABLE` provenance rule the simulation already enforces.
 */
export interface AcronymContext {
  baseline?: number | null;
  simulated?: number | null;
  delta?: number | null;
  unit?: SimUnit;
  /** Which formula variant the engine actually used, by `AcronymFormula.id`. */
  formulaId?: string | null;
  /** Named inputs that fed the number, each with its own provenance. */
  inputs?: AcronymContextInput[];
  /** Reuses `SimProvenance` values. Typed as string to keep this module free of
   *  a hard dependency on the simulation's const tuple at runtime. */
  provenance?: string | null;
  dataCoverage?: { available: string[]; unavailable: string[] } | null;
  confidence?: "high" | "medium" | "low" | null;
  computedAt?: string | null;
  /** Engine key, e.g. "evm" — displayed so hours ≠ headcount stays visible. */
  engine?: string | null;
  /** Scenario/project the numbers belong to, for the Isabella entity handle. */
  entity?: { type: string; id: string; title?: string } | null;
}

export interface AcronymContextInput {
  label: string;
  value: number | null;
  unit?: SimUnit;
  provenance?: string | null;
}
