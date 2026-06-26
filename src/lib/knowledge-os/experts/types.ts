// ============================================================================
// ProjectOps360° — Knowledge OS / AI Workforce™ — Expert profile types
// ============================================================================
// An "expert" is a PERSONA over the shared Knowledge OS. Experts NEVER own
// knowledge, corpora, or vector stores. They differ ONLY by persona, tone,
// specialty, prompt overlay, presentation, and the module/domains they serve.
//
// This module is PURE DATA + pure functions — safe to import on the client
// (the presentation shell resolves the active expert here too). It must NOT
// import server code, and it must NOT contain business knowledge.
// ============================================================================

import type { Locale } from "@/types/database";

/** Presentation hints. Consumed ONLY by the presentation layer, never by retrieval. */
export interface ExpertPresentation {
  /** Accent color (Tailwind-friendly hex) for the avatar/orb. */
  accent: string;
  /** Single-letter monogram shown in the orb until a richer avatar exists. */
  initial: string;
  /** Default avatar mode. 'hologram' is reserved for a future presentation phase. */
  avatarMode: "orb" | "hologram";
  /** Reserved for future voice experiences (TTS voice id). Null until built. */
  voiceId: string | null;
  /** Reserved for future holographic experiences (avatar/rig id). Null until built. */
  hologramId: string | null;
}

export interface ExpertProfile {
  /** Stable machine key, persisted on every answer/event. */
  key: string;
  /** Human name shown to users (e.g. "Isabella"). */
  displayName: string;
  /** Role title, localized. */
  title: { en: string; es: string };
  /** One-line specialty, localized. */
  specialty: { en: string; es: string };
  /**
   * Knowledge OS domains this expert serves (matches knowledge_packages.domain).
   * Used for context routing — NOT for knowledge ownership.
   */
  domains: string[];
  /** Persona description woven into the prompt overlay, localized. */
  persona: { en: string; es: string };
  /** Tone/behavior rules appended to the overlay, localized. */
  toneGuidance: { en: string[]; es: string[] };
  /** Goal-oriented opening line, localized. */
  greeting: { en: string; es: string };
  /** Persona overlay prompt version, e.g. "isabella@1.0.0". Persisted per answer. */
  personaVersion: string;
  /** Default model + sampling for this persona. */
  model: string;
  temperature: number;
  presentation: ExpertPresentation;
}

/** Lightweight descriptor the presentation layer needs (no prompt text). */
export interface ExpertDescriptor {
  key: string;
  displayName: string;
  title: string;
  specialty: string;
  greeting: string;
  presentation: ExpertPresentation;
}

export function toDescriptor(expert: ExpertProfile, locale: Locale): ExpertDescriptor {
  const k = locale === "es" ? "es" : "en";
  return {
    key: expert.key,
    displayName: expert.displayName,
    title: expert.title[k],
    specialty: expert.specialty[k],
    greeting: expert.greeting[k],
    presentation: expert.presentation,
  };
}
