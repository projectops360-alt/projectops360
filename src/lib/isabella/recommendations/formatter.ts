// ============================================================================
// ProjectOps360° — Isabella Recommendation · formatter (pure, bilingual)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Concise Isabella answer: ranked next-best actions with priority, urgency,
// expected impact, rationale, evidence/confidence, and explicit "requires human
// approval / not executed automatically" language. NEVER says "I changed /
// assigned / moved / fixed" and NEVER guarantees an outcome. Pure, locale-aware.
// ============================================================================

import type {
  IsabellaRecommendation,
  IsabellaRecommendationPlan,
  RecommendationLanguage,
  RecommendationPriority,
  RecommendationUrgency,
} from "./types";

const PRIORITY_LABEL: Record<RecommendationPriority, { en: string; es: string }> = {
  critical: { en: "Critical", es: "Crítica" },
  high: { en: "High", es: "Alta" },
  medium: { en: "Medium", es: "Media" },
  low: { en: "Low", es: "Baja" },
};
const URGENCY_LABEL: Record<RecommendationUrgency, { en: string; es: string }> = {
  now: { en: "Now", es: "Ahora" },
  today: { en: "Today", es: "Hoy" },
  this_week: { en: "This week", es: "Esta semana" },
  later: { en: "Later", es: "Después" },
  unknown: { en: "Unknown", es: "Desconocida" },
};

export function priorityLabel(p: RecommendationPriority, language: RecommendationLanguage): string {
  return PRIORITY_LABEL[p][language === "es" ? "es" : "en"];
}

function impactLabel(r: IsabellaRecommendation, es: boolean): string {
  const map: Record<string, { en: string; es: string }> = {
    unblock_execution: { en: "unblock execution", es: "desbloquear ejecución" },
    reduce_risk: { en: "reduce risk", es: "reducir riesgo" },
    improve_accountability: { en: "improve accountability", es: "mejorar accountability" },
    restore_sequence: { en: "restore sequence", es: "restaurar secuencia" },
    increase_clarity: { en: "increase clarity", es: "aumentar claridad" },
    reduce_uncertainty: { en: "reduce uncertainty", es: "reducir incertidumbre" },
    unknown: { en: "clarify next steps", es: "aclarar próximos pasos" },
  };
  return map[r.expectedImpact][es ? "es" : "en"];
}

/** Concise, evidence-backed next-best-action text for Isabella. */
export function formatRecommendationPlanForIsabella(plan: IsabellaRecommendationPlan, language: RecommendationLanguage): string {
  const es = language === "es";
  const title = es ? "Recomendaciones de siguiente mejor acción" : "Next-Best-Action Recommendations";

  if (plan.status !== "ready" && plan.status !== "partial") {
    return `**${title}**\n\n${plan.message ?? plan.summary}`;
  }

  const parts: string[] = [
    `**${title}**`,
    "",
    `${es ? "Resumen" : "Summary"}: ${plan.summary}`,
    "",
    `**${es ? "Top acciones" : "Top actions"}**`,
  ];

  plan.recommendations.slice(0, 8).forEach((r, i) => {
    parts.push(`${i + 1}. ${priorityLabel(r.priority, language)} — ${r.title}`);
    parts.push(`   ${es ? "Por qué" : "Why"}: ${r.rationale}`);
    parts.push(`   ${es ? "Impacto esperado" : "Expected impact"}: ${impactLabel(r, es)}.`);
    parts.push(`   ${es ? "Urgencia" : "Urgency"}: ${URGENCY_LABEL[r.urgency][es ? "es" : "en"]} · ${es ? "Confianza" : "Confidence"}: ${r.confidence}`);
    if ((r.missingEvidence ?? []).length > 0) parts.push(`   ${es ? "Evidencia faltante" : "Missing evidence"}: ${(r.missingEvidence ?? [])[0]}`);
    parts.push(`   ${es ? "Requiere aprobación humana: sí" : "Requires human approval: yes"}`);
  });

  if (plan.limitations.length > 0) {
    parts.push("", `**${es ? "Limitaciones" : "Limitations"}**`);
    for (const l of plan.limitations.slice(0, 5)) parts.push(`- ${l}`);
  }

  parts.push("", es ? "Fuente: datos verificados del proyecto actual." : "Source: verified project data.");
  parts.push(es ? "Nota: estas recomendaciones no se ejecutaron automáticamente." : "Note: these recommendations were not executed automatically.");
  return parts.join("\n");
}
