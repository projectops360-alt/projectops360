// ============================================================================
// Acronym Intelligence — Isabella handoff (CAP-050)
// ============================================================================
// The rule this module exists to enforce: Isabella is handed the REGISTRY's own
// definition, not a second copy of it written into a prompt string.
//
// The failure mode is specific and it has happened before in this product. A
// component composes a nice prose prompt — "EAC is the projected final cost,
// usually BAC divided by CPI" — and ships. Six months later the registry entry
// is corrected and the prompt is not, so the panel and Isabella now disagree
// about the same acronym on the same screen. `buildIsabellaAsk` therefore reads
// every definitional field from `getAcronym(code)` at call time. There is no
// path through this file that lets a caller supply alternative definition text.
//
// Scope: this builds a payload from data the caller already holds and passes it
// to `askIsabella`, which dispatches a window event consumed by the Isabella
// widget in the same session. It adds no data source of its own, so it cannot
// widen what the user can see — RLS/RBAC continue to be enforced wherever the
// numbers were originally read (`read-model.server.ts` and friends).
// ============================================================================

import { askIsabella, type IsabellaAskDetail } from "@/lib/isabella/ask-isabella";
import type { AcronymContext } from "./contracts";
import { getAcronym, localize, resolveFormula } from "./registry";

/**
 * The structured payload handed over.
 *
 * Kept as data rather than a formatted string so a test can assert the code and
 * definition came from the registry, and so the widget can decide its own
 * phrasing without this module dictating prose.
 */
export interface IsabellaAcronymPayload {
  code: string;
  fullName: string;
  /** VERBATIM from the registry. Never rewritten by a caller. */
  officialDefinition: string;
  /** The formula presented as used, when the term has one. */
  formula: string | null;
  /** True when an engine signalled the variant; false when it is the default. */
  formulaConfirmed: boolean;
  /** Other standard variants, so Isabella knows the term is not single-valued. */
  alternativeFormulas: string[];
  unit: string | null;
  registryVersion: string;
  /** Only the values the caller already had on screen. */
  context: {
    baseline: number | null;
    simulated: number | null;
    delta: number | null;
    provenance: string | null;
    dataCoverage: { available: string[]; unavailable: string[] } | null;
    confidence: string | null;
    computedAt: string | null;
    inputs: Array<{ label: string; value: number | null; provenance: string | null }>;
  } | null;
  question: string;
}

/**
 * Build the payload for a term.
 *
 * Returns null for an unknown code: asking Isabella about an acronym the
 * product cannot define would invite an invented answer, which is the specific
 * behaviour this corpus exists to prevent.
 */
export function buildIsabellaPayload(
  code: string,
  locale: string,
  question: string,
  context?: AcronymContext | null,
): IsabellaAcronymPayload | null {
  const entry = getAcronym(code);
  if (!entry) return null;

  const resolved = resolveFormula(entry, context);

  return {
    code: entry.code,
    fullName: localize(entry.fullName, locale),
    // Straight from the registry. This line is the whole point of the module.
    officialDefinition: localize(entry.fullDefinition, locale),
    formula: resolved.used?.expression ?? null,
    formulaConfirmed: resolved.isConfirmed,
    alternativeFormulas: resolved.alternatives.map((formula) => formula.expression),
    unit: entry.unit ?? null,
    registryVersion: entry.version,
    context: context
      ? {
          baseline: context.baseline ?? null,
          simulated: context.simulated ?? null,
          delta: context.delta ?? null,
          provenance: context.provenance ?? null,
          dataCoverage: context.dataCoverage ?? null,
          confidence: context.confidence ?? null,
          computedAt: context.computedAt ?? null,
          inputs: (context.inputs ?? []).map((input) => ({
            label: input.label,
            value: input.value,
            provenance: input.provenance ?? null,
          })),
        }
      : null,
    question,
  };
}

/**
 * Render the payload into the single `query` string `askIsabella` accepts.
 *
 * The bridge's `IsabellaAskDetail` carries a query and an entity handle, so the
 * structured payload is serialised into the query. Definitional lines are taken
 * from the payload — which came from the registry — so serialisation cannot
 * introduce a contradiction either.
 *
 * Values are rendered raw rather than locale-formatted: this string is read by
 * a model, not a person, and a thousands separator is noise that invites
 * misparsing.
 */
export function serializeIsabellaQuery(payload: IsabellaAcronymPayload): string {
  const lines: string[] = [
    `${payload.question}`,
    "",
    `Term: ${payload.code} — ${payload.fullName}`,
    `Official definition (ProjectOps360 glossary v${payload.registryVersion}): ${payload.officialDefinition}`,
  ];

  if (payload.formula) {
    lines.push(
      payload.formulaConfirmed
        ? `Formula used by the engine: ${payload.formula}`
        : `Formula (default variant; the engine did not report which it used): ${payload.formula}`,
    );
    if (payload.alternativeFormulas.length > 0) {
      lines.push(`Other standard variants: ${payload.alternativeFormulas.join(" | ")}`);
    }
  }
  if (payload.unit) lines.push(`Unit: ${payload.unit}`);

  const context = payload.context;
  if (context) {
    lines.push("", "Values currently on screen:");
    lines.push(`- Baseline: ${formatForModel(context.baseline)}`);
    lines.push(`- Simulated: ${formatForModel(context.simulated)}`);
    lines.push(`- Delta: ${formatForModel(context.delta)}`);
    if (context.provenance) lines.push(`- Provenance: ${context.provenance}`);
    if (context.confidence) lines.push(`- Confidence: ${context.confidence}`);
    if (context.computedAt) lines.push(`- Computed at: ${context.computedAt}`);
    if (context.dataCoverage) {
      if (context.dataCoverage.available.length > 0) {
        lines.push(`- Data sources available: ${context.dataCoverage.available.join(", ")}`);
      }
      if (context.dataCoverage.unavailable.length > 0) {
        lines.push(`- Data sources unavailable: ${context.dataCoverage.unavailable.join(", ")}`);
      }
    }
    for (const input of context.inputs) {
      lines.push(
        `- Input ${input.label}: ${formatForModel(input.value)}${
          input.provenance ? ` (${input.provenance})` : ""
        }`,
      );
    }
    lines.push(
      "",
      "Use only the definition and values above. Where a value is Data unavailable, say so rather than estimating it.",
    );
  }

  return lines.join("\n");
}

/** Absent values are named, never zeroed. */
function formatForModel(value: number | null): string {
  return value == null ? "Data unavailable" : String(value);
}

/**
 * Open Isabella with the term, its official definition and the on-screen
 * context. No-op for an unknown code.
 */
export function askIsabellaAboutAcronym(
  code: string,
  locale: string,
  question: string,
  context?: AcronymContext | null,
): void {
  const payload = buildIsabellaPayload(code, locale, question, context);
  if (!payload) return;

  const detail: IsabellaAskDetail = {
    query: serializeIsabellaQuery(payload),
    // The entity is the thing the numbers belong to, when the caller knows it,
    // so Isabella can pull its own authorised context. Falls back to the term.
    entity: context?.entity ?? { type: "acronym", id: payload.code, title: payload.fullName },
  };
  askIsabella(detail);
}
