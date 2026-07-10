// ============================================================================
// ProjectOps360° — Isabella Executive Brief · answer formatter (pure)
// ============================================================================
// REG-023 / ISABELLA-EXECUTIVE-BRIEF
//
// Deterministic ProjectBriefing (+ registered-risk detail) → an executive,
// bilingual, evidence-based answer. Result semantics are explicit:
//   • empty is "no registered risks", NEVER "I can't" —
//   • unevaluable sources are named as data gaps —
//   • REGISTERED risks vs DETECTED operational signals are separate sections —
//   • the recommended priority is derived from the same deterministic signals.
// Pure: no I/O, fully unit-testable.
// ============================================================================

import type { ProjectBriefing } from "@/lib/project-briefing/types";
import type { GuideAnswer } from "@/lib/knowledge-os/types";
import type { Locale } from "@/types/database";
import type { ExecutiveIntents } from "./intent";
import type { ExecutiveBriefData, RiskSignal } from "./types";

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

const HEALTH_LABEL: Record<ProjectBriefing["healthBand"], { en: string; es: string }> = {
  healthy: { en: "healthy", es: "saludable" },
  watch: { en: "needs watching", es: "requiere seguimiento" },
  at_risk: { en: "at risk", es: "en riesgo" },
};

const LEVEL_LABEL: Record<string, { en: string; es: string }> = {
  low: { en: "low", es: "baja" },
  medium: { en: "medium", es: "media" },
  high: { en: "high", es: "alta" },
  critical: { en: "critical", es: "crítica" },
};

function level(value: string, es: boolean): string {
  const l = LEVEL_LABEL[value];
  return l ? (es ? l.es : l.en) : value;
}

/** Deterministic operational risk signals from the briefing. */
export function collectRiskSignals(briefing: ProjectBriefing): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (briefing.execution.activeBlockers > 0) signals.push({ key: "active_blockers", count: briefing.execution.activeBlockers });
  if (briefing.execution.overdue > 0) signals.push({ key: "overdue", count: briefing.execution.overdue });
  if (briefing.execution.atRiskMilestones > 0) signals.push({ key: "at_risk_milestones", count: briefing.execution.atRiskMilestones });
  if (briefing.capacity.evaluable && briefing.capacity.unassignedActive > 0)
    signals.push({ key: "unassigned_active", count: briefing.capacity.unassignedActive });
  if (briefing.memory.available && briefing.memory.unresolvedActions.length > 0)
    signals.push({ key: "unresolved_actions", count: briefing.memory.unresolvedActions.length });
  return signals;
}

function signalLine(s: RiskSignal, es: boolean): string {
  const n = s.count;
  switch (s.key) {
    case "active_blockers":
      return es ? `${n} tarea(s) bloqueada(s) activas.` : `${n} active blocked task(s).`;
    case "overdue":
      return es ? `${n} tarea(s) vencida(s).` : `${n} overdue task(s).`;
    case "at_risk_milestones":
      return es ? `${n} hito(s) en riesgo.` : `${n} milestone(s) at risk.`;
    case "unassigned_active":
      return es ? `${n} tarea(s) activa(s) sin responsable.` : `${n} active task(s) without an owner.`;
    case "unresolved_actions":
      return es ? `${n} acuerdo(s)/acción(es) de reuniones sin resolver.` : `${n} unresolved meeting action item(s).`;
  }
}

function gapLine(gap: ProjectBriefing["dataGaps"][number], es: boolean): string {
  switch (gap) {
    case "no_tasks":
      return es ? "el proyecto aún no tiene tareas" : "the project has no tasks yet";
    case "no_milestones":
      return es ? "no hay hitos definidos" : "no milestones are defined";
    case "capacity_not_evaluable":
      return es ? "no hay trabajo activo para evaluar capacidad" : "there is no active work to evaluate capacity";
    case "risks_unavailable":
      return es ? "la fuente de riesgos no se pudo leer" : "the risks source could not be read";
    case "memory_unavailable":
      return es ? "la Memoria del Proyecto no se pudo leer" : "Project Memory could not be read";
  }
}

/** Deterministic risk-exposure headline (never invented). */
export function riskExposure(
  briefing: ProjectBriefing,
  registeredCount: number,
  signals: RiskSignal[],
): "high" | "moderate" | "low" {
  const highRegistered = briefing.risks.available && briefing.risks.high > 0;
  const blockers = briefing.execution.activeBlockers > 0;
  const atRiskMilestones = briefing.execution.atRiskMilestones > 0;
  if ((highRegistered && (blockers || atRiskMilestones)) || (blockers && atRiskMilestones)) return "high";
  if (highRegistered || registeredCount > 0 || signals.length > 0) return "moderate";
  return "low";
}

/** Deterministic recommended priority derived from the strongest signal. */
function priorityLine(briefing: ProjectBriefing, registeredHigh: number, es: boolean): string | null {
  if (briefing.execution.activeBlockers > 0) {
    return es
      ? `La prioridad recomendada es resolver ${briefing.execution.activeBlockers === 1 ? "el bloqueo activo" : `los ${briefing.execution.activeBlockers} bloqueos activos`}, porque detienen trabajo dependiente.`
      : `The recommended priority is resolving ${briefing.execution.activeBlockers === 1 ? "the active blocker" : `the ${briefing.execution.activeBlockers} active blockers`}, because they stop dependent work.`;
  }
  if (registeredHigh > 0) {
    return es
      ? "La prioridad recomendada es revisar los riesgos registrados de severidad alta y su plan de mitigación."
      : "The recommended priority is reviewing the high-severity registered risks and their mitigation plans.";
  }
  if (briefing.execution.atRiskMilestones > 0) {
    return es
      ? "La prioridad recomendada es revisar los hitos en riesgo y sus tareas vencidas."
      : "The recommended priority is reviewing the at-risk milestones and their overdue tasks.";
  }
  if (briefing.execution.overdue > 0) {
    return es
      ? "La prioridad recomendada es reprogramar o cerrar las tareas vencidas."
      : "The recommended priority is rescheduling or closing the overdue tasks.";
  }
  if (briefing.capacity.evaluable && briefing.capacity.unassignedActive > 0) {
    return es
      ? "La prioridad recomendada es asignar responsables a las tareas activas sin dueño."
      : "The recommended priority is assigning owners to the active unowned tasks.";
  }
  return null;
}

/**
 * Build the executive GuideAnswer. `intents` selects the sections; a
 * multi-intent question gets both in ONE answer.
 */
export function formatExecutiveBriefAnswer(
  data: ExecutiveBriefData,
  intents: ExecutiveIntents,
  locale: Locale,
  expert: ExpertInfo,
): GuideAnswer {
  const es = locale === "es";
  const b = data.briefing;
  const signals = collectRiskSignals(b);
  const registered = data.registeredRisks;
  const registeredCount = registered?.length ?? (b.risks.available ? b.risks.open : 0);
  const registeredHigh = registered
    ? registered.filter((r) => r.severity === "high" || r.severity === "critical").length
    : b.risks.available
      ? b.risks.high
      : 0;

  const parts: string[] = [];

  // ── Project summary section ─────────────────────────────────────────────────
  if (intents.projectSummary) {
    const health = es ? HEALTH_LABEL[b.healthBand].es : HEALTH_LABEL[b.healthBand].en;
    parts.push(
      es
        ? `**${b.projectName}** está **${health}**: ${b.overview.percentComplete}% completado (${b.overview.completedTasks}/${b.overview.totalTasks} tareas, ${b.overview.inProgressTasks} en progreso).`
        : `**${b.projectName}** is **${health}**: ${b.overview.percentComplete}% complete (${b.overview.completedTasks}/${b.overview.totalTasks} tasks, ${b.overview.inProgressTasks} in progress).`,
    );
    if (b.overview.nextMilestone) {
      const nm = b.overview.nextMilestone;
      parts.push(
        es
          ? `Próximo hito: **${nm.title}**${nm.date ? ` (${nm.date})` : ""}.`
          : `Next milestone: **${nm.title}**${nm.date ? ` (${nm.date})` : ""}.`,
      );
    }
    if (intents.projectSummary && b.memory.available && b.memory.recentDecisions.length > 0) {
      const d = b.memory.recentDecisions[0];
      parts.push(
        es ? `Última decisión registrada: **${d.title}**${d.date ? ` (${d.date})` : ""}.` : `Latest recorded decision: **${d.title}**${d.date ? ` (${d.date})` : ""}.`,
      );
    }
  }

  // ── Risk outlook section ────────────────────────────────────────────────────
  if (intents.riskOutlook) {
    const exposure = riskExposure(b, registeredCount, signals);
    const expLabel = es
      ? { high: "alta", moderate: "moderada", low: "baja" }[exposure]
      : exposure;
    parts.push(
      es
        ? `La exposición de riesgo del proyecto es **${expLabel}**.`
        : `The project's risk exposure is **${exposure === "moderate" ? "moderate" : expLabel}**.`,
    );

    // Registered risks — record-backed, or the honest empty state.
    if (registered && registered.length > 0) {
      const lines = registered
        .slice(0, 5)
        .map(
          (r) =>
            `- ${r.title} — ${es ? "severidad" : "severity"} ${level(r.severity, es)}, ${es ? "probabilidad" : "probability"} ${level(r.probability, es)}, ${es ? "impacto" : "impact"} ${level(r.impact, es)}`,
        );
      parts.push((es ? `**Riesgos registrados (${registeredCount}):**\n` : `**Registered risks (${registeredCount}):**\n`) + lines.join("\n"));
    } else if (registered && registered.length === 0) {
      parts.push(
        es
          ? "No hay riesgos formalmente registrados en este proyecto."
          : "There are no formally registered risks in this project.",
      );
    } else {
      parts.push(
        es
          ? "No pude leer el registro de riesgos en este momento, así que no puedo confirmar los riesgos formalmente registrados."
          : "I couldn't read the risk register right now, so I can't confirm the formally registered risks.",
      );
    }

    // Detected operational signals — clearly separated from registered records.
    if (signals.length > 0) {
      parts.push(
        (es ? "**Señales operativas detectadas:**\n" : "**Detected operational signals:**\n") +
          signals.map((s) => `- ${signalLine(s, es)}`).join("\n"),
      );
    } else {
      parts.push(
        es
          ? "No detecté señales operativas de riesgo en las tareas, hitos y dependencias actuales."
          : "I detected no operational risk signals in the current tasks, milestones, and dependencies.",
      );
    }

    const priority = priorityLine(b, registeredHigh, es);
    if (priority) parts.push(priority);
  }

  // ── Honest data gaps (both sections) ────────────────────────────────────────
  if (b.dataGaps.length > 0) {
    parts.push(
      (es ? "**Datos no evaluables:** " : "**Data I could not evaluate:** ") +
        b.dataGaps.map((g) => gapLine(g, es)).join("; ") +
        ".",
    );
  }

  // Evidence base — traceability line.
  parts.push(
    es
      ? `_Basado en las tareas, hitos, dependencias, riesgos y memoria actuales de **${b.projectName}**._`
      : `_Based on the current tasks, milestones, dependencies, risks, and memory of **${b.projectName}**._`,
  );

  return {
    answerId: null,
    grounded: true,
    answer: parts.join("\n\n"),
    steps: [],
    followups: es
      ? ["¿Qué tareas están bloqueadas?", "¿Qué debería resolver primero?"]
      : ["Which tasks are blocked?", "What should I resolve first?"],
    tier: "verified",
    confidenceScore: 1,
    language: locale,
    sources: [],
    expert,
  };
}
