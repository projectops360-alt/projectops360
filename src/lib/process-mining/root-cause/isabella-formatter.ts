// ============================================================================
// ProjectOps360° — Root Cause Miner · Isabella formatter (CAP-046 F2)
// ============================================================================
// Pure, deterministic, bilingual compact text. Evidence-only: influence
// scores, rates and examples — never a recommendation, never a person.
// ============================================================================

import type { RootCauseMinerResult, RootCauseProblemType } from "./types";

const PROBLEM_LABELS: Record<RootCauseProblemType, { es: string; en: string }> = {
  delay: { es: "Retraso", en: "Delay" },
  blockage: { es: "Bloqueo", en: "Blockage" },
  rework: { es: "Retrabajo", en: "Rework" },
};

const CONFIDENCE_LABELS: Record<string, { es: string; en: string }> = {
  high: { es: "confianza alta", en: "high confidence" },
  medium: { es: "confianza media", en: "medium confidence" },
  low: { es: "confianza baja", en: "low confidence" },
};

export function formatRootCauseMinerForIsabella(
  result: RootCauseMinerResult,
  projectTitle: string,
  lang: "en" | "es",
): string {
  const es = lang === "es";
  const lines: string[] = [];

  lines.push(
    es
      ? `Minería estadística de causas — "${projectTitle}" (${result.totalTasks} tareas analizadas). Solo evidencia de asociación; no son causas confirmadas ni recomendaciones.`
      : `Statistical root-cause mining — "${projectTitle}" (${result.totalTasks} tasks analyzed). Association evidence only; not confirmed causes, not recommendations.`,
  );

  for (const stats of result.problems) {
    const label = PROBLEM_LABELS[stats.problemType][lang];
    const pct = Math.round(stats.baselineRate * 100);
    lines.push(`${label}: ${stats.problemCount}/${stats.totalTasks} (${pct}%).`);
  }

  if (result.findings.length === 0) {
    lines.push(
      es
        ? "Sin asociaciones adversas relevantes con los datos actuales."
        : "No relevant adverse associations with the current data.",
    );
  } else {
    lines.push(es ? "Principales asociaciones (Influence Score 0–100):" : "Top associations (Influence Score 0–100):");
    for (const finding of result.findings.slice(0, 6)) {
      const confidence = CONFIDENCE_LABELS[finding.confidence][lang];
      lines.push(
        `- [${finding.influenceScore}] ${es ? finding.explanationEs : finding.explanationEn} (${confidence}).`,
      );
    }
  }

  for (const limitation of result.limitations) {
    lines.push((es ? "Limitación: " : "Limitation: ") + limitation);
  }

  return lines.join("\n");
}
