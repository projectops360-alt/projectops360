// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · quick actions (pure)
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// The bilingual quick-action chips surfaced in Isabella (behind the UI flag).
// Each chip's `prompt` is a natural-language question that the deterministic
// router maps to the right engine — the chip carries no privileged access. Pure.
// "Explain this node" is included only when a node is selected. Labels come from
// i18n keys (see messages/{en,es}.json → isabella.quickActions.*).
// ============================================================================

import type { RuntimeLanguage } from "./types";

export interface IsabellaQuickAction {
  id: "daily_diagnosis" | "attention" | "root_cause" | "recommend" | "explain_node";
  labelKey: string;
  label: string;
  prompt: string;
}

const CHIPS: Record<IsabellaQuickAction["id"], { en: { label: string; prompt: string }; es: { label: string; prompt: string } }> = {
  daily_diagnosis: {
    en: { label: "Daily diagnosis", prompt: "What is happening in this project today?" },
    es: { label: "Diagnóstico diario", prompt: "¿Qué está pasando en este proyecto hoy?" },
  },
  attention: {
    en: { label: "What needs attention?", prompt: "What needs my attention?" },
    es: { label: "¿Qué necesita atención?", prompt: "¿Qué necesita mi atención?" },
  },
  root_cause: {
    en: { label: "Analyze root cause", prompt: "Why is this at risk? Analyze the root cause." },
    es: { label: "Analizar causa raíz", prompt: "¿Por qué está en riesgo? Analiza la causa raíz." },
  },
  recommend: {
    en: { label: "Recommend next actions", prompt: "What should I do next?" },
    es: { label: "Recomendar próximas acciones", prompt: "¿Qué debo hacer ahora?" },
  },
  explain_node: {
    en: { label: "Explain this node", prompt: "Explain and analyze this item." },
    es: { label: "Explicar este nodo", prompt: "Explica y analiza este elemento." },
  },
};

/** Ordered chips for the current locale; `explain_node` only with a selection. */
export function getIsabellaQuickActions(language: RuntimeLanguage, opts?: { hasSelectedNode?: boolean }): IsabellaQuickAction[] {
  const order: IsabellaQuickAction["id"][] = ["daily_diagnosis", "attention", "root_cause", "recommend"];
  if (opts?.hasSelectedNode) order.push("explain_node");
  return order.map((id) => {
    const c = CHIPS[id][language === "es" ? "es" : "en"];
    return { id, labelKey: `isabella.quickActions.${id}`, label: c.label, prompt: c.prompt };
  });
}
