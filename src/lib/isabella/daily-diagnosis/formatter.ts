// ============================================================================
// ProjectOps360° — Isabella Daily Diagnosis · formatter (pure, bilingual)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// Turns a structured diagnosis into a concise Isabella answer. Locale-aware,
// built inline (same convention as the task-report / query-engine formatters).
// Labels verified project data honestly; never invents. Pure.
// ============================================================================

import type { DiagnosisHealthLevel, DiagnosisLanguage, DiagnosisSection, IsabellaDailyProcessDiagnosis } from "./types";

const HEALTH_LABEL: Record<DiagnosisHealthLevel, { en: string; es: string }> = {
  healthy: { en: "Healthy", es: "Saludable" },
  watch: { en: "Watch", es: "En observación" },
  at_risk: { en: "At risk", es: "En riesgo" },
  blocked: { en: "Blocked", es: "Bloqueado" },
  unknown: { en: "Unknown", es: "Desconocido" },
};

export function healthLabel(level: DiagnosisHealthLevel, language: DiagnosisLanguage): string {
  return HEALTH_LABEL[level][language === "es" ? "es" : "en"];
}

function sectionBlock(s: DiagnosisSection, es: boolean): string[] {
  const lines = [`**${s.title}** — ${s.summary}`];
  for (const it of s.items.slice(0, 8)) lines.push(`- ${it.label}: ${it.detail}`);
  return lines;
}

/** Concise, evidence-backed daily diagnosis text for Isabella. */
export function formatDailyDiagnosisForIsabella(
  diagnosis: IsabellaDailyProcessDiagnosis,
  language: DiagnosisLanguage,
): string {
  const es = language === "es";
  const title = es ? "Diagnóstico diario del proyecto" : "Daily Project Diagnosis";

  // Non-ready states → the honest message only.
  if (diagnosis.status !== "ready" && diagnosis.status !== "partial") {
    return `**${title}**\n\n${diagnosis.message ?? diagnosis.executiveSummary}`;
  }

  const status = `${es ? "Estado" : "Status"}: ${healthLabel(diagnosis.overallHealth.level, language)}`;
  const parts: string[] = [`**${title}**`, "", status, "", `${es ? "Resumen" : "Summary"}: ${diagnosis.executiveSummary}`, ""];

  const order: DiagnosisSection[] = [
    diagnosis.sections.blockers,
    diagnosis.sections.progress,
    diagnosis.sections.risksOrAttention,
    diagnosis.sections.milestoneFocus,
    diagnosis.sections.executionGaps,
    diagnosis.sections.todayFocus,
  ];
  for (const s of order) {
    if (s.items.length === 0 && s.status === "ok") continue; // keep it concise
    parts.push(...sectionBlock(s, es), "");
  }

  parts.push(es ? "Fuente: datos verificados del proyecto actual." : "Source: verified project data.");
  if (diagnosis.limitations.length > 0) {
    parts.push("", `${es ? "Limitaciones" : "Limitations"}:`);
    for (const l of diagnosis.limitations.slice(0, 6)) parts.push(`- ${l}`);
  }
  return parts.join("\n");
}
