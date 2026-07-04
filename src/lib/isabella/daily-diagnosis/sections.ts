// ============================================================================
// ProjectOps360° — Isabella Daily Diagnosis · section builders (pure)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// Each section is built deterministically from the Task 2 context: symptoms +
// attention signals + evidence refs only. NO root causes, NO recommendations
// ("focus areas", never a plan). Pure.
// ============================================================================

import type { IsabellaProcessContext, IsabellaTaskSummary } from "@/lib/isabella/process-context/types";
import type { IsabellaConfidence } from "@/lib/isabella/process-intelligence/types";
import { computeDiagnosisSignals } from "./metrics";
import type { DiagnosisItem, DiagnosisLanguage, DiagnosisSection } from "./types";

const TERMINAL = new Set(["done", "tested", "completed"]);

function tt(es: boolean, en: string, esT: string): string {
  return es ? esT : en;
}
function taskRefs(context: IsabellaProcessContext, type: "task" | "subtask" | "milestone" | "blocker"): string[] {
  return context.evidencePackets
    .filter((p) => p.evidenceType === type)
    .map((p) => p.citationRef ?? p.evidenceId)
    .filter(Boolean)
    .slice(0, 12) as string[];
}

// ── Progress ─────────────────────────────────────────────────────────────────
export function buildProgressSection(context: IsabellaProcessContext, language: DiagnosisLanguage): DiagnosisSection {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const conf: IsabellaConfidence = context.status === "ready" ? "verified" : "medium";
  const items: DiagnosisItem[] = [];
  if (s.hasTaskData) {
    items.push({
      label: tt(es, "Completed", "Completadas"),
      detail: `${s.doneTasks}/${s.totalTasks}`,
      severity: "info",
      confidence: conf,
      evidenceRefs: taskRefs(context, "task"),
    });
    items.push({ label: tt(es, "In progress", "En progreso"), detail: `${s.inProgressTasks}`, severity: "info", confidence: conf, evidenceRefs: [] });
    items.push({ label: tt(es, "Not started", "No iniciadas"), detail: `${s.notStartedTasks}`, severity: "info", confidence: conf, evidenceRefs: [] });
  }
  return {
    title: tt(es, "Progress", "Avance"),
    status: s.hasTaskData ? "ok" : "unavailable",
    summary: s.hasTaskData
      ? tt(es, `${s.doneTasks} done, ${s.inProgressTasks} in progress, ${s.notStartedTasks} not started (of ${s.totalTasks}).`, `${s.doneTasks} hechas, ${s.inProgressTasks} en progreso, ${s.notStartedTasks} sin iniciar (de ${s.totalTasks}).`)
      : tt(es, "No task progress data available.", "No hay datos de avance de tareas."),
    items,
    limitations: context.processSignals && !context.processSignals.advancedFindingsAvailable
      ? [tt(es, "Recent time-based movement is not available (no delay/rework findings yet).", "El movimiento reciente por tiempo no está disponible (aún sin hallazgos de delay/rework).")]
      : undefined,
  };
}

// ── Blockers ─────────────────────────────────────────────────────────────────
export function buildBlockersSection(context: IsabellaProcessContext, language: DiagnosisLanguage): DiagnosisSection {
  const es = language === "es";
  const packets = context.processSignals?.packets ?? [];
  const items: DiagnosisItem[] = packets.slice(0, 20).map((p) => ({
    label: p.title,
    detail: p.summary,
    severity: "blocked",
    confidence: p.confidence,
    evidenceRefs: [p.citationRef ?? p.evidenceId].filter(Boolean) as string[],
  }));
  const count = context.processSignals?.blockedCount ?? 0;
  return {
    title: tt(es, "Blockers", "Bloqueos"),
    status: count > 0 ? "blocked" : "ok",
    summary:
      count > 0
        ? tt(es, `${count} blocked task(s) with a recorded impediment.`, `${count} tarea(s) bloqueada(s) con impedimento registrado.`)
        : tt(es, "No active blockers recorded.", "Sin bloqueos activos registrados."),
    items,
    // Blocker cause / root-cause analysis is the NEXT engine, not this one.
    limitations: count > 0 ? [tt(es, "Root-cause analysis of blockers belongs to the next engine.", "El análisis de causa raíz de los bloqueos corresponde al siguiente motor.")] : undefined,
  };
}

// ── Risks / Attention ─────────────────────────────────────────────────────────
export function buildRisksOrAttentionSection(context: IsabellaProcessContext, language: DiagnosisLanguage): DiagnosisSection {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const conf: IsabellaConfidence = context.status === "ready" ? "verified" : "medium";
  const items: DiagnosisItem[] = [];
  if (s.overdueTasks > 0) items.push({ label: tt(es, "Overdue tasks", "Tareas vencidas"), detail: `${s.overdueTasks}`, severity: "at_risk", confidence: conf, evidenceRefs: taskRefs(context, "task") });
  if (s.blockedTasks > 0) items.push({ label: tt(es, "Blocked tasks", "Tareas bloqueadas"), detail: `${s.blockedTasks}`, severity: "blocked", confidence: conf, evidenceRefs: taskRefs(context, "blocker") });
  if (s.withoutMilestoneTasks > 0) items.push({ label: tt(es, "Tasks without milestone", "Tareas sin hito"), detail: `${s.withoutMilestoneTasks}`, severity: "watch", confidence: conf, evidenceRefs: [] });
  if (s.withoutOwnerTasks > 0) items.push({ label: tt(es, "Tasks without owner", "Tareas sin responsable"), detail: `${s.withoutOwnerTasks}`, severity: "watch", confidence: conf, evidenceRefs: [] });

  const sev = items.some((i) => i.severity === "blocked" || i.severity === "at_risk") ? "at_risk" : items.length > 0 ? "watch" : "ok";
  return {
    title: tt(es, "Attention signals", "Señales de atención"),
    status: sev,
    summary:
      items.length > 0
        ? tt(es, `${items.length} attention signal(s) detected.`, `${items.length} señal(es) de atención detectada(s).`)
        : tt(es, "No attention signals detected from available evidence.", "No se detectan señales de atención en la evidencia disponible."),
    items,
    // "Attention signal" ≠ a formal risk record — no risk evidence source exists here.
    limitations: [tt(es, "Formal risk evidence is not available in this context (attention signals only).", "La evidencia formal de riesgos no está disponible en este contexto (solo señales de atención).")],
  };
}

// ── Milestone focus ─────────────────────────────────────────────────────────
function overdue(t: IsabellaTaskSummary, day: string): boolean {
  return !!t.dueDate && t.dueDate.slice(0, 10) < day && !TERMINAL.has(t.status);
}

export function buildMilestoneFocusSection(context: IsabellaProcessContext, language: DiagnosisLanguage): DiagnosisSection {
  const es = language === "es";
  const tc = context.taskContext;
  const mc = context.milestoneContext;
  const conf: IsabellaConfidence = context.status === "ready" ? "verified" : "medium";
  const day = context.snapshotAt.slice(0, 10);
  const items: DiagnosisItem[] = [];

  if (tc && mc) {
    const titleById = new Map(mc.milestones.map((m) => [m.milestoneId, { title: m.title, ref: m.citationRef }]));
    const agg = new Map<string, { blocked: number; overdue: number; notStarted: number }>();
    for (const t of tc.tasks) {
      if (!t.milestoneId) continue;
      const a = agg.get(t.milestoneId) ?? { blocked: 0, overdue: 0, notStarted: 0 };
      if (t.blockedReason) a.blocked += 1;
      if (overdue(t, day)) a.overdue += 1;
      if (t.status === "not_started") a.notStarted += 1;
      agg.set(t.milestoneId, a);
    }
    for (const [mid, a] of [...agg.entries()].sort((x, y) => (y[1].blocked + y[1].overdue) - (x[1].blocked + x[1].overdue))) {
      if (a.blocked === 0 && a.overdue === 0 && a.notStarted < 3) continue;
      const m = titleById.get(mid);
      items.push({
        label: m?.title ?? mid,
        detail: tt(es, `${a.blocked} blocked, ${a.overdue} overdue, ${a.notStarted} not started`, `${a.blocked} bloqueadas, ${a.overdue} vencidas, ${a.notStarted} sin iniciar`),
        severity: a.blocked > 0 ? "blocked" : a.overdue > 0 ? "at_risk" : "watch",
        confidence: conf,
        evidenceRefs: [m?.ref].filter(Boolean) as string[],
      });
    }
  }
  return {
    title: tt(es, "Milestone focus", "Enfoque por milestone"),
    status: items.some((i) => i.severity === "blocked") ? "blocked" : items.some((i) => i.severity === "at_risk") ? "at_risk" : items.length > 0 ? "watch" : mc ? "ok" : "unavailable",
    summary:
      items.length > 0
        ? tt(es, `${items.length} milestone(s) need attention.`, `${items.length} hito(s) requieren atención.`)
        : mc
          ? tt(es, "No milestone shows blocking/overdue attention signals.", "Ningún hito muestra señales de bloqueo/vencimiento.")
          : tt(es, "Milestone evidence is not available.", "La evidencia de hitos no está disponible."),
    items,
  };
}

// ── Execution gaps ─────────────────────────────────────────────────────────
export function buildExecutionGapsSection(context: IsabellaProcessContext, language: DiagnosisLanguage): DiagnosisSection {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const conf: IsabellaConfidence = context.status === "ready" ? "verified" : "medium";
  const items: DiagnosisItem[] = [];
  if (s.withoutOwnerTasks > 0) items.push({ label: tt(es, "Unassigned tasks", "Tareas sin responsable"), detail: `${s.withoutOwnerTasks}`, severity: "watch", confidence: conf, evidenceRefs: [] });
  if (s.withoutMilestoneTasks > 0) items.push({ label: tt(es, "Tasks without milestone", "Tareas sin hito"), detail: `${s.withoutMilestoneTasks}`, severity: "watch", confidence: conf, evidenceRefs: [] });
  return {
    title: tt(es, "Execution gaps", "Gaps de ejecución"),
    status: items.length > 0 ? "watch" : "ok",
    summary:
      items.length > 0
        ? tt(es, `${items.length} execution gap(s) found.`, `${items.length} gap(s) de ejecución encontrado(s).`)
        : tt(es, "No execution gaps found in available evidence.", "No se encontraron gaps de ejecución en la evidencia disponible."),
    items,
    limitations: context.limitations.length > 0 ? context.limitations.slice(0, 6) : undefined,
  };
}

// ── Today focus (FOCUS AREAS — never recommendations) ─────────────────────────
export function buildTodayFocusSection(context: IsabellaProcessContext, language: DiagnosisLanguage): DiagnosisSection {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const items: DiagnosisItem[] = [];
  const area = (label: string, detail: string, severity: DiagnosisItem["severity"], refs: string[] = []) =>
    items.push({ label, detail, severity, confidence: "high", evidenceRefs: refs });

  if (s.blockedTasks > 0) area(tt(es, "Review blocked tasks", "Revisar tareas bloqueadas"), tt(es, `${s.blockedTasks} blocked`, `${s.blockedTasks} bloqueadas`), "blocked", taskRefs(context, "blocker"));
  if (s.overdueTasks > 0) area(tt(es, "Review overdue tasks", "Revisar tareas vencidas"), `${s.overdueTasks}`, "at_risk");
  if (s.withoutOwnerTasks > 0) area(tt(es, "Assign owners to unassigned tasks", "Asignar responsables a tareas sin owner"), `${s.withoutOwnerTasks}`, "watch");
  if (s.withoutMilestoneTasks > 0) area(tt(es, "Validate tasks without milestone", "Validar tareas sin hito"), `${s.withoutMilestoneTasks}`, "watch");

  return {
    title: tt(es, "Today's focus", "Foco de hoy"),
    status: items.some((i) => i.severity === "blocked") ? "blocked" : items.some((i) => i.severity === "at_risk") ? "at_risk" : items.length > 0 ? "watch" : "ok",
    summary:
      items.length > 0
        ? tt(es, "Focus areas to review today.", "Áreas de foco para revisar hoy.")
        : tt(es, "No specific focus area today — execution looks clean.", "Sin área de foco específica hoy — la ejecución se ve limpia."),
    items,
    limitations: [tt(es, "These are focus areas only; prioritized actions belong to the recommendation engine.", "Son solo áreas de foco; las acciones priorizadas corresponden al motor de recomendaciones.")],
  };
}
