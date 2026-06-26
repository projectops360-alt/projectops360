// ============================================================================
// ProjectOps360° — AI Workforce™ — Expert registry + context routing
// ============================================================================
// One central registry. Every consumer (Knowledge OS generation, the Living
// Guide presentation shell, future agents) resolves experts here, so they all
// agree on persona + presentation. Adding a future expert (Atlas, Sentinel, …)
// is a single entry here plus its persona file — no architectural change.
//
// Pure data + pure functions. Client-safe. No business knowledge.
// ============================================================================

import type { Locale } from "@/types/database";
import type { ExpertProfile } from "./types";
import { toDescriptor } from "./types";
import { ISABELLA } from "./isabella";

export type { ExpertProfile, ExpertDescriptor, ExpertPresentation } from "./types";
export { toDescriptor } from "./types";

/** The default / primary advisor. Always resolvable. */
export const DEFAULT_EXPERT_KEY = "isabella";

/**
 * The AI Workforce registry. Future experts (atlas, sentinel, ledger, nova,
 * orion, scribe) are added here — NOT implemented in this phase.
 */
export const EXPERTS: Record<string, ExpertProfile> = {
  [ISABELLA.key]: ISABELLA,
};

export function getExpert(key: string | null | undefined): ExpertProfile {
  return (key && EXPERTS[key]) || EXPERTS[DEFAULT_EXPERT_KEY];
}

export interface ExpertRoutingInput {
  /** Explicit expert selection wins when valid. */
  expertKey?: string | null;
  /** Current module/domain (from the context payload). */
  module?: string | null;
}

/**
 * Context routing (ADD Phase 1.1):
 *   1. explicit expert_key (if registered)
 *   2. an expert whose domains include the current module
 *   3. default to Isabella
 * In Phase 1.1 this always resolves to Isabella.
 */
export function resolveExpert(input: ExpertRoutingInput): ExpertProfile {
  if (input.expertKey && EXPERTS[input.expertKey]) return EXPERTS[input.expertKey];
  if (input.module) {
    const byDomain = Object.values(EXPERTS).find((e) => e.domains.includes(input.module!));
    if (byDomain) return byDomain;
  }
  return EXPERTS[DEFAULT_EXPERT_KEY];
}

/** Resolve the lightweight descriptor the presentation layer needs. */
export function resolveExpertDescriptor(input: ExpertRoutingInput, locale: Locale) {
  return toDescriptor(resolveExpert(input), locale);
}

/**
 * Build the persona overlay text injected into the Knowledge OS prompt.
 * Base grounding rules live in the prompt template's system prompt; this is the
 * persona layer (identity + tone) for the requested language.
 */
export function buildPersonaOverlay(expert: ExpertProfile, locale: Locale): string {
  const k = locale === "es" ? "es" : "en";
  const tone = expert.toneGuidance[k].map((t) => `- ${t}`).join("\n");
  return `${expert.persona[k]}\n\nYour communication style:\n${tone}`;
}
