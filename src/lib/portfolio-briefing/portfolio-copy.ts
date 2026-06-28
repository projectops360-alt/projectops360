// ============================================================================
// ProjectOps360° — Portfolio Health Briefing — bilingual copy (client-safe)
// ============================================================================
// Pure presentation for the PMO portfolio briefing. Every string is
// parameterized by counts the engine already computed — nothing invented.
// ============================================================================

import type { Locale } from "@/types/database";
import type {
  PortfolioActionKey,
  PortfolioAttentionKey,
  PortfolioBriefing,
  PortfolioDataGapKey,
  PortfolioGoodKey,
  PortfolioVerifyKey,
} from "./types";

type K = "en" | "es";
const k = (locale: Locale): K => (locale === "es" ? "es" : "en");

export function portfolioTitle(locale: Locale): string {
  return locale === "es" ? "Briefing del Portafolio" : "Portfolio Briefing";
}

export function portfolioSubtitle(locale: Locale): string {
  return locale === "es"
    ? "Así va tu portafolio de proyectos ahora mismo."
    : "Here's how your portfolio is doing right now.";
}

export function portfolioOverallLine(b: PortfolioBriefing, locale: Locale): string {
  const es = locale === "es";
  const o = b.overview;
  if (o.totalProjects === 0) {
    return es
      ? "Aún no tienes proyectos en este workspace, así que no hay portafolio que evaluar todavía."
      : "You don't have any projects in this workspace yet, so there's no portfolio to evaluate.";
  }
  if (o.totalActiveTasks === 0) {
    return es
      ? `Tienes ${o.activeProjects} proyecto(s) activo(s), pero aún no hay trabajo activo registrado para evaluar la ejecución.`
      : `You have ${o.activeProjects} active project(s), but there's no active work recorded yet to evaluate execution.`;
  }
  if (b.attention.length === 0) {
    return es
      ? `Tu portafolio de ${o.activeProjects} proyecto(s) activo(s) se ve estable: no detecto bloqueos activos ni riesgos críticos.`
      : `Your portfolio of ${o.activeProjects} active project(s) looks stable — I don't see active blockers or critical risks.`;
  }
  return es
    ? `Tienes ${o.activeProjects} proyecto(s) activo(s); ${o.projectsNeedingAttention} requiere${o.projectsNeedingAttention === 1 ? "" : "n"} tu atención.`
    : `You have ${o.activeProjects} active project(s); ${o.projectsNeedingAttention} need${o.projectsNeedingAttention === 1 ? "s" : ""} your attention.`;
}

export function portfolioGoodLabel(key: PortfolioGoodKey, locale: Locale): string {
  const map: Record<PortfolioGoodKey, { en: string; es: string }> = {
    no_active_blockers: { en: "No active blockers across the portfolio", es: "Sin bloqueos activos en el portafolio" },
    no_overdue: { en: "No overdue work", es: "Sin trabajo vencido" },
    all_work_assigned: { en: "All active work has an owner", es: "Todo el trabajo activo tiene responsable" },
    no_high_risks: { en: "No open high-impact risks", es: "Sin riesgos abiertos de alto impacto" },
    no_pending_decisions: { en: "No decisions waiting on you", es: "No hay decisiones esperándote" },
  };
  return map[key][k(locale)];
}

export function portfolioAttentionLabel(key: PortfolioAttentionKey, count: number, locale: Locale): string {
  const es = locale === "es";
  const map: Record<PortfolioAttentionKey, (n: number) => { en: string; es: string }> = {
    blocked_critical: (n) => ({
      en: `${n} critical-path task${n === 1 ? "" : "s"} blocked`,
      es: `${n} tarea${n === 1 ? "" : "s"} de ruta crítica bloqueada${n === 1 ? "" : "s"}`,
    }),
    active_blockers: (n) => ({
      en: `${n} active blocker${n === 1 ? "" : "s"} across projects`,
      es: `${n} bloqueo${n === 1 ? "" : "s"} activo${n === 1 ? "" : "s"} entre proyectos`,
    }),
    overdue: (n) => ({
      en: `${n} overdue task${n === 1 ? "" : "s"}`,
      es: `${n} tarea${n === 1 ? "" : "s"} vencida${n === 1 ? "" : "s"}`,
    }),
    unassigned: (n) => ({
      en: `${n} active task${n === 1 ? "" : "s"} without an owner`,
      es: `${n} tarea${n === 1 ? "" : "s"} activa${n === 1 ? "" : "s"} sin responsable`,
    }),
    at_risk_milestones: (n) => ({
      en: `${n} milestone${n === 1 ? "" : "s"} at risk`,
      es: `${n} hito${n === 1 ? "" : "s"} en riesgo`,
    }),
    high_risks: (n) => ({
      en: `${n} high-impact open risk${n === 1 ? "" : "s"}`,
      es: `${n} riesgo${n === 1 ? "" : "s"} abierto${n === 1 ? "" : "s"} de alto impacto`,
    }),
    pending_decisions: (n) => ({
      en: `${n} decision${n === 1 ? "" : "s"} pending approval`,
      es: `${n} decisión${n === 1 ? "" : "es"} pendiente${n === 1 ? "" : "s"} de aprobación`,
    }),
    projects_at_risk: (n) => ({
      en: `${n} project${n === 1 ? "" : "s"} need attention`,
      es: `${n} proyecto${n === 1 ? "" : "s"} requiere${n === 1 ? "" : "n"} atención`,
    }),
  };
  const e = map[key](count);
  return es ? e.es : e.en;
}

export function portfolioRecommendedLabel(key: PortfolioActionKey, locale: Locale): string {
  const map: Record<PortfolioActionKey, { en: string; es: string }> = {
    review_blocked_critical: { en: "Resolve blocked critical-path work first", es: "Resuelve primero el trabajo bloqueado de ruta crítica" },
    review_blockers: { en: "Review and clear active blockers", es: "Revisa y resuelve los bloqueos activos" },
    review_high_risks: { en: "Review the high-impact open risks", es: "Revisa los riesgos abiertos de alto impacto" },
    review_overdue: { en: "Review overdue work and re-plan", es: "Revisa el trabajo vencido y replanifica" },
    assign_owners: { en: "Assign owners to unassigned work", es: "Asigna responsables al trabajo sin asignar" },
    clear_pending_decisions: { en: "Clear the decisions waiting on you", es: "Resuelve las decisiones que te esperan" },
    open_command_center: { en: "Open the Command Center for the full picture", es: "Abre el Command Center para el panorama completo" },
  };
  return map[key][k(locale)];
}

export function portfolioVerifyLabel(key: PortfolioVerifyKey, locale: Locale): string {
  const map: Record<PortfolioVerifyKey, { en: string; es: string }> = {
    command_center: { en: "Open Command Center", es: "Abrir Command Center" },
    reports: { en: "Open Reports", es: "Abrir Reportes" },
    projects: { en: "Open Projects", es: "Abrir Proyectos" },
  };
  return map[key][k(locale)];
}

export function portfolioVerifyRoute(key: PortfolioVerifyKey): string {
  const map: Record<PortfolioVerifyKey, string> = {
    command_center: "/",
    reports: "/reports",
    projects: "/projects",
  };
  return map[key];
}

export function portfolioDataGapLabel(key: PortfolioDataGapKey, locale: Locale): string {
  const map: Record<PortfolioDataGapKey, { en: string; es: string }> = {
    no_projects: {
      en: "No projects yet, so there's nothing to evaluate.",
      es: "Aún no hay proyectos, así que no hay nada que evaluar.",
    },
    no_active_work: {
      en: "No active work across projects yet.",
      es: "Aún no hay trabajo activo en los proyectos.",
    },
    risks_unavailable: {
      en: "I couldn't read the risk register, so risks are not included.",
      es: "No pude leer el registro de riesgos, así que no se incluyen.",
    },
  };
  return map[key][k(locale)];
}

export function portfolioStableLine(locale: Locale): string {
  return locale === "es"
    ? "Todo se ve estable en el portafolio. No veo bloqueos activos ni riesgos críticos."
    : "The portfolio looks stable. I don't see active blockers or critical risks.";
}
