// ============================================================================
// ProjectOps360° — Knowledge OS configuration (tiers, weights, labels)
// ============================================================================
// Bilingual, presentation-agnostic config. Safe to import on the client.
// ============================================================================

import type { ConfidenceTier, GuideIntent } from "./types";

/**
 * Base Knowledge OS prompt version (grounding rules) — persisted on every answer
 * for reproducibility (ADD Q15). The persona overlay version is carried per
 * expert (e.g. isabella@1.0.0) and stored separately in persona_version.
 */
export const KNOWLEDGE_OS_BASE_PROMPT_VERSION = "knowledge-os-base@1.3.0";

/** Embedding model + dims — kept in one place so re-embedding is a config swap. */
export const GUIDE_EMBEDDING_MODEL = "text-embedding-3-small";
export const GUIDE_EMBEDDING_DIMS = 1536;

export interface TierMeta {
  /** Source-trust weight used in the confidence score (ADD §4.1). */
  weight: number;
  label: { en: string; es: string };
  /** Tailwind tone classes for the badge. */
  tone: string;
  /** Whether this tier may ever be auto-generated without review. */
  autoGeneratable: boolean;
}

export const TIER_META: Record<ConfidenceTier, TierMeta> = {
  verified: {
    weight: 1.0,
    label: { en: "Verified", es: "Verificado" },
    tone: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    autoGeneratable: false,
  },
  organization_policy: {
    weight: 0.95,
    label: { en: "Organization policy", es: "Política de la organización" },
    tone: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    autoGeneratable: false,
  },
  best_practice: {
    weight: 0.8,
    label: { en: "Best practice", es: "Buena práctica" },
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
    autoGeneratable: false,
  },
  learned_pattern: {
    weight: 0.55,
    label: { en: "Learned pattern", es: "Patrón aprendido" },
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    autoGeneratable: true,
  },
  ai_suggestion: {
    weight: 0.3,
    label: { en: "AI suggestion", es: "Sugerencia de IA" },
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
    autoGeneratable: true,
  },
};

export function tierLabel(tier: ConfidenceTier, locale: string): string {
  const m = TIER_META[tier] ?? TIER_META.ai_suggestion;
  return locale === "es" ? m.label.es : m.label.en;
}

/** Quick actions shown in the widget. Order matters (primary first). */
export const QUICK_ACTIONS: {
  intent: GuideIntent;
  label: { en: string; es: string };
  icon: string; // lucide name; resolved in the client
}[] = [
  { intent: "explain_screen", label: { en: "Explain this screen", es: "Explica esta pantalla" }, icon: "ScanSearch" },
  { intent: "step_by_step", label: { en: "Guide me step by step", es: "Guíame paso a paso" }, icon: "ListChecks" },
  { intent: "question", label: { en: "Ask a question", es: "Hacer una pregunta" }, icon: "MessageCircleQuestion" },
  { intent: "best_practices", label: { en: "Best practices", es: "Buenas prácticas" }, icon: "Sparkles" },
  { intent: "common_mistakes", label: { en: "Common mistakes", es: "Errores comunes" }, icon: "TriangleAlert" },
];
