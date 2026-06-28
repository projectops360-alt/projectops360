// ============================================================================
// ProjectOps360° — Project Health Briefing — bilingual copy (client-safe)
// ============================================================================
// Pure presentation: turns the deterministic briefing's typed keys into the
// bilingual strings Isabella shows. No business logic, no invented findings —
// every string is parameterized by counts the engine already computed.
// ============================================================================

import type { Locale } from "@/types/database";
import type {
  AttentionKey,
  BriefingHealthBand,
  DataGapKey,
  GoodSignalKey,
  ProjectBriefing,
  RecommendedActionKey,
  VerifyTargetKey,
} from "./types";

type K = "en" | "es";
const k = (locale: Locale): K => (locale === "es" ? "es" : "en");

export function briefingTitle(locale: Locale): string {
  return locale === "es" ? "Briefing del Proyecto" : "Project Briefing";
}

export function briefingSubtitle(locale: Locale): string {
  return locale === "es"
    ? "Esto es lo que veo en este proyecto ahora mismo."
    : "Here's what I see in this project right now.";
}

export function healthBandLabel(band: BriefingHealthBand, locale: Locale): string {
  const map: Record<BriefingHealthBand, { en: string; es: string }> = {
    healthy: { en: "Healthy", es: "Saludable" },
    watch: { en: "Watch", es: "En observación" },
    at_risk: { en: "Needs attention", es: "Requiere atención" },
  };
  return map[band][k(locale)];
}

/** The one-line overall status sentence — grounded only in computed numbers. */
export function overallStatusLine(b: ProjectBriefing, locale: Locale): string {
  const o = b.overview;
  const es = locale === "es";
  if (b.overview.totalTasks === 0) {
    return es
      ? `${b.projectName} aún no tiene trabajo registrado, así que todavía no puedo evaluar su avance.`
      : `${b.projectName} has no work recorded yet, so I can't evaluate progress yet.`;
  }
  const attentionCount = b.attention.length;
  if (attentionCount === 0) {
    return es
      ? `${b.projectName} está al ${o.percentComplete}% completado. Todo se ve estable: no detecto bloqueos activos ni problemas críticos de capacidad.`
      : `${b.projectName} is ${o.percentComplete}% complete. Everything looks stable — I don't see active blockers or critical capacity issues.`;
  }
  return es
    ? `${b.projectName} está al ${o.percentComplete}% completado. El avance progresa, pero hay ${attentionCount} ${attentionCount === 1 ? "tema" : "temas"} que merece${attentionCount === 1 ? "" : "n"} tu atención.`
    : `${b.projectName} is ${o.percentComplete}% complete. Work is progressing, but ${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your attention.`;
}

export function goodSignalLabel(key: GoodSignalKey, locale: Locale): string {
  const map: Record<GoodSignalKey, { en: string; es: string }> = {
    no_active_blockers: { en: "No active blockers detected", es: "No se detectan bloqueos activos" },
    no_overdue: { en: "No overdue work", es: "Sin trabajo vencido" },
    milestones_completed: { en: "Milestones already completed", es: "Hitos ya completados" },
    critical_path_clear: { en: "Critical path looks stable", es: "La ruta crítica se ve estable" },
    all_work_assigned: { en: "All active work has an owner", es: "Todo el trabajo activo tiene responsable" },
    recent_decisions_captured: { en: "Recent decisions captured", es: "Decisiones recientes registradas" },
  };
  return map[key][k(locale)];
}

export function attentionLabel(key: AttentionKey, count: number, locale: Locale): string {
  const es = locale === "es";
  const map: Record<AttentionKey, (n: number) => { en: string; es: string }> = {
    active_blockers: (n) => ({
      en: `${n} active blocker${n === 1 ? "" : "s"} (explicit impediment${n === 1 ? "" : "s"})`,
      es: `${n} bloqueo${n === 1 ? "" : "s"} activo${n === 1 ? "" : "s"} (impedimento${n === 1 ? "" : "s"} explícito${n === 1 ? "" : "s"})`,
    }),
    waiting_on_dependency: (n) => ({
      en: `${n} task${n === 1 ? "" : "s"} waiting on a predecessor (not blocked)`,
      es: `${n} tarea${n === 1 ? "" : "s"} esperando un predecesor (no bloqueadas)`,
    }),
    overdue: (n) => ({
      en: `${n} overdue task${n === 1 ? "" : "s"}`,
      es: `${n} tarea${n === 1 ? "" : "s"} vencida${n === 1 ? "" : "s"}`,
    }),
    at_risk_milestones: (n) => ({
      en: `${n} milestone${n === 1 ? "" : "s"} at risk`,
      es: `${n} hito${n === 1 ? "" : "s"} en riesgo`,
    }),
    unassigned: (n) => ({
      en: `${n} active task${n === 1 ? "" : "s"} without an owner`,
      es: `${n} tarea${n === 1 ? "" : "s"} activa${n === 1 ? "" : "s"} sin responsable`,
    }),
    missing_estimate: (n) => ({
      en: `${n} active task${n === 1 ? "" : "s"} without an estimate`,
      es: `${n} tarea${n === 1 ? "" : "s"} activa${n === 1 ? "" : "s"} sin estimación`,
    }),
    open_high_risks: (n) => ({
      en: `${n} high-impact open risk${n === 1 ? "" : "s"}`,
      es: `${n} riesgo${n === 1 ? "" : "s"} abierto${n === 1 ? "" : "s"} de alto impacto`,
    }),
    unresolved_actions: (n) => ({
      en: `${n} unresolved follow-up${n === 1 ? "" : "s"}`,
      es: `${n} acción${n === 1 ? "es" : ""} de seguimiento sin resolver`,
    }),
  };
  const e = map[key](count);
  return es ? e.es : e.en;
}

export function recommendedLabel(key: RecommendedActionKey, locale: Locale): string {
  const map: Record<RecommendedActionKey, { en: string; es: string }> = {
    review_blockers: { en: "Review and clear the active blockers", es: "Revisa y resuelve los bloqueos activos" },
    assign_owners: { en: "Assign owners to unassigned work", es: "Asigna responsables al trabajo sin asignar" },
    add_estimates: { en: "Add estimates to active work", es: "Agrega estimaciones al trabajo activo" },
    review_at_risk_milestones: { en: "Review the at-risk milestones", es: "Revisa los hitos en riesgo" },
    review_overdue: { en: "Review overdue tasks and re-plan", es: "Revisa las tareas vencidas y replanifica" },
    open_resource_capacity: { en: "Open Resource Capacity", es: "Abre Capacidad de Recursos" },
    open_living_graph_critical_path: { en: "Check the Living Graph critical path", es: "Revisa la ruta crítica en el Living Graph" },
    review_open_risks: { en: "Review the open high-impact risks", es: "Revisa los riesgos abiertos de alto impacto" },
    capture_decisions: { en: "Resolve open follow-ups in Project Memory", es: "Resuelve los seguimientos abiertos en la Memoria del Proyecto" },
  };
  return map[key][k(locale)];
}

export function verifyLabel(key: VerifyTargetKey, locale: Locale): string {
  const map: Record<VerifyTargetKey, { en: string; es: string }> = {
    workboard: { en: "Open Workboard", es: "Abrir Workboard" },
    living_graph: { en: "View in Living Graph", es: "Ver en el Living Graph" },
    resource_capacity: { en: "Open Resource Capacity", es: "Abrir Capacidad de Recursos" },
    project_memory: { en: "Open Project Memory", es: "Abrir Memoria del Proyecto" },
    status_report: { en: "Open Status Report", es: "Abrir Reporte de Estado" },
  };
  return map[key][k(locale)];
}

/** The project-relative route for a verify target (locale-prefixing applied by caller). */
export function verifyRoute(key: VerifyTargetKey, projectId: string): string {
  const map: Record<VerifyTargetKey, string> = {
    workboard: `/projects/${projectId}/workboard`,
    living_graph: `/projects/${projectId}/execution-map/living-graph`,
    resource_capacity: `/projects/${projectId}/resource-capacity`,
    project_memory: `/projects/${projectId}/memory`,
    status_report: `/projects/${projectId}/status`,
  };
  return map[key];
}

export function dataGapLabel(key: DataGapKey, locale: Locale): string {
  const map: Record<DataGapKey, { en: string; es: string }> = {
    no_tasks: {
      en: "I don't have enough data to evaluate execution yet — no tasks recorded.",
      es: "Aún no tengo datos suficientes para evaluar la ejecución — no hay tareas registradas.",
    },
    no_milestones: {
      en: "No milestones defined yet, so I can't evaluate milestone health.",
      es: "Aún no hay hitos definidos, así que no puedo evaluar la salud de los hitos.",
    },
    capacity_not_evaluable: {
      en: "No active work, so I can't evaluate capacity right now.",
      es: "No hay trabajo activo, así que no puedo evaluar la capacidad ahora mismo.",
    },
    risks_unavailable: {
      en: "I couldn't read the risk register, so risks are not included.",
      es: "No pude leer el registro de riesgos, así que no se incluyen.",
    },
    memory_unavailable: {
      en: "I couldn't read Project Memory, so recent decisions/follow-ups are not included.",
      es: "No pude leer la Memoria del Proyecto, así que no se incluyen decisiones/seguimientos recientes.",
    },
  };
  return map[key][k(locale)];
}

/** The "everything is stable" line when there is nothing to flag. */
export function allStableLine(locale: Locale): string {
  return locale === "es"
    ? "Todo se ve estable ahora mismo. No veo bloqueos activos ni problemas críticos de capacidad."
    : "Everything looks stable right now. I don't see active blockers or critical capacity issues.";
}
