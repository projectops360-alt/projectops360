// ============================================================================
// ProjectOps360° — Subtasks · Isabella Execution Facts (pure, deterministic)
// ============================================================================
// Builds the DETERMINISTIC, record-backed execution facts Isabella uses to
// explain a task's progress from its subtasks — following the PD-012 pattern
// (provenanceFacts): the server stamps these into the ask context; the model
// must use them verbatim and never invent counts, blockers, or causes.
// Answers: why delayed, what blocks it, what to focus on first, which subtasks
// are overdue, which affect the critical path, why progress moved.
// ============================================================================

import { isSubtaskOverdue, effectiveSubtaskProgress, type Subtask } from "./types";
import { computeParentProgress, deriveParentSignals } from "./progress";

export interface TaskExecutionFactsInput {
  taskTitle: string;
  taskStatus: string;
  manualProgress: number;
  subtasks: readonly Subtask[];
  ownerNames?: Readonly<Record<string, string>>;
  /** Recent progress movement (from the audit/event trail), when available. */
  recentProgressChange?: { from: number; to: number; occurredAt: string } | null;
  asOf: Date;
  language: "en" | "es";
}

const L = {
  en: {
    header: "TASK EXECUTION FACTS (deterministic, record-backed — use verbatim, never invent):",
    progressCalc: (p: number, mode: string, done: number, active: number) =>
      `- Task progress: ${p}% (calculated ${mode}-based from subtasks; ${done} of ${active} active subtasks completed).`,
    progressManual: (p: number) => `- Task progress: ${p}% (manual — this task has no active subtasks).`,
    blocked: (n: number) => `- Blocked subtasks: ${n}.`,
    blockedItem: (title: string, reason: string | null, days: number, owner: string | null, critical: boolean) =>
      `  • "${title}" blocked ${days} day(s)${reason ? ` — reason: ${reason}` : " — no reason recorded"}${owner ? `; owner: ${owner}` : ""}${critical ? "; AFFECTS CRITICAL PATH" : ""}.`,
    overdue: (n: number) => `- Overdue subtasks: ${n}.`,
    overdueItem: (title: string, due: string, owner: string | null) =>
      `  • "${title}" was due ${due}${owner ? `; owner: ${owner}` : ""}.`,
    criticalAtRisk: "- CRITICAL RISK: at least one critical-path subtask is blocked or overdue.",
    noCriticalRisk: "- No critical-path subtask is currently blocked or overdue.",
    hours: (est: number, act: number, variance: number | null) =>
      `- Hours: estimated ${est}, actual ${act}${variance !== null ? `, variance ${variance > 0 ? "+" : ""}${variance}` : ""}.`,
    movement: (from: number, to: number, at: string) =>
      `- Progress moved from ${from}% to ${to}% (recorded ${at}).`,
    cancelled: (n: number) => `- Cancelled subtasks excluded from progress: ${n}.`,
    focus: (title: string) => `- Recommended focus: resolve "${title}" first.`,
    focusReasonBlockedCritical: " It is blocked AND on the critical path.",
    focusReasonBlocked: " It is the oldest blocker.",
    focusReasonOverdue: " It is the most overdue item.",
    noIssues: "- No blockers or overdue subtasks; execution is flowing.",
  },
  es: {
    header: "HECHOS DE EJECUCIÓN DE LA TAREA (deterministas, respaldados por registros — úsalos textualmente, nunca inventes):",
    progressCalc: (p: number, mode: string, done: number, active: number) =>
      `- Progreso de la tarea: ${p}% (calculado desde subtareas en modo ${mode}; ${done} de ${active} subtareas activas completadas).`,
    progressManual: (p: number) => `- Progreso de la tarea: ${p}% (manual — esta tarea no tiene subtareas activas).`,
    blocked: (n: number) => `- Subtareas bloqueadas: ${n}.`,
    blockedItem: (title: string, reason: string | null, days: number, owner: string | null, critical: boolean) =>
      `  • "${title}" bloqueada ${days} día(s)${reason ? ` — motivo: ${reason}` : " — sin motivo registrado"}${owner ? `; responsable: ${owner}` : ""}${critical ? "; AFECTA LA RUTA CRÍTICA" : ""}.`,
    overdue: (n: number) => `- Subtareas vencidas: ${n}.`,
    overdueItem: (title: string, due: string, owner: string | null) =>
      `  • "${title}" vencía el ${due}${owner ? `; responsable: ${owner}` : ""}.`,
    criticalAtRisk: "- RIESGO CRÍTICO: al menos una subtarea de la ruta crítica está bloqueada o vencida.",
    noCriticalRisk: "- Ninguna subtarea de la ruta crítica está bloqueada o vencida actualmente.",
    hours: (est: number, act: number, variance: number | null) =>
      `- Horas: estimadas ${est}, reales ${act}${variance !== null ? `, varianza ${variance > 0 ? "+" : ""}${variance}` : ""}.`,
    movement: (from: number, to: number, at: string) =>
      `- El progreso pasó de ${from}% a ${to}% (registrado ${at}).`,
    cancelled: (n: number) => `- Subtareas canceladas excluidas del progreso: ${n}.`,
    focus: (title: string) => `- Foco recomendado: resolver primero "${title}".`,
    focusReasonBlockedCritical: " Está bloqueada Y en la ruta crítica.",
    focusReasonBlocked: " Es el bloqueo más antiguo.",
    focusReasonOverdue: " Es el elemento más vencido.",
    noIssues: "- Sin bloqueos ni subtareas vencidas; la ejecución fluye.",
  },
} as const;

function ownerName(
  ownerId: string | null,
  names: Readonly<Record<string, string>>,
): string | null {
  return ownerId ? (names[ownerId] ?? null) : null;
}

function blockedDays(s: Subtask, asOf: Date): number {
  const since = s.blocked_at ?? s.updated_at;
  return Math.max(0, Math.floor((asOf.getTime() - new Date(since).getTime()) / 86_400_000));
}

/**
 * Deterministic recommended focus: blocked+critical first, then oldest
 * blocker, then most-overdue. Null when nothing needs attention.
 */
export function recommendFocusSubtask(
  subtasks: readonly Subtask[],
  asOf: Date,
): { subtask: Subtask; reason: "blocked_critical" | "blocked" | "overdue" } | null {
  const blocked = subtasks.filter((s) => s.status === "blocked");
  const blockedCritical = blocked
    .filter((s) => s.is_critical)
    .sort((a, b) => blockedDays(b, asOf) - blockedDays(a, asOf) || a.id.localeCompare(b.id));
  if (blockedCritical.length > 0) return { subtask: blockedCritical[0], reason: "blocked_critical" };
  const oldestBlocked = [...blocked].sort(
    (a, b) => blockedDays(b, asOf) - blockedDays(a, asOf) || a.id.localeCompare(b.id),
  );
  if (oldestBlocked.length > 0) return { subtask: oldestBlocked[0], reason: "blocked" };
  const overdue = subtasks
    .filter((s) => isSubtaskOverdue(s, asOf))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.id.localeCompare(b.id));
  if (overdue.length > 0) return { subtask: overdue[0], reason: "overdue" };
  return null;
}

/** Build the server-stamped execution facts block for Isabella. */
export function buildTaskExecutionFacts(input: TaskExecutionFactsInput): string {
  const t = L[input.language];
  const names = input.ownerNames ?? {};
  const lines: string[] = [t.header];

  const calc = computeParentProgress(input.subtasks);
  const signals = deriveParentSignals(input.subtasks, input.asOf);

  if (calc) {
    lines.push(t.progressCalc(calc.progress, calc.modeUsed, calc.completedCount, calc.activeCount));
  } else {
    lines.push(t.progressManual(input.manualProgress));
  }

  if (input.recentProgressChange) {
    const { from, to, occurredAt } = input.recentProgressChange;
    lines.push(t.movement(from, to, occurredAt.slice(0, 10)));
  }

  const blocked = input.subtasks.filter((s) => s.status === "blocked");
  const overdue = input.subtasks.filter((s) => isSubtaskOverdue(s, input.asOf));

  if (blocked.length > 0) {
    lines.push(t.blocked(blocked.length));
    for (const s of blocked) {
      lines.push(
        t.blockedItem(s.title, s.blocked_reason, blockedDays(s, input.asOf), ownerName(s.owner_id, names), s.is_critical),
      );
    }
  }
  if (overdue.length > 0) {
    lines.push(t.overdue(overdue.length));
    for (const s of overdue) {
      lines.push(t.overdueItem(s.title, s.due_date ?? "", ownerName(s.owner_id, names)));
    }
  }
  if (blocked.length === 0 && overdue.length === 0) lines.push(t.noIssues);

  lines.push(signals.criticalAtRisk ? t.criticalAtRisk : t.noCriticalRisk);

  if (signals.cancelledCount > 0) lines.push(t.cancelled(signals.cancelledCount));
  if (signals.estimatedHours > 0 || signals.actualHours > 0) {
    lines.push(t.hours(signals.estimatedHours, signals.actualHours, signals.varianceHours));
  }

  const focus = recommendFocusSubtask([...input.subtasks], input.asOf);
  if (focus) {
    const reasonText =
      focus.reason === "blocked_critical"
        ? t.focusReasonBlockedCritical
        : focus.reason === "blocked"
          ? t.focusReasonBlocked
          : t.focusReasonOverdue;
    lines.push(t.focus(focus.subtask.title) + reasonText);
  }

  // Per-subtask one-liners so Isabella can answer about any specific node.
  for (const s of input.subtasks) {
    lines.push(
      `  [subtask] "${s.title}" — status: ${s.status}; progress: ${effectiveSubtaskProgress(s)}%` +
        `${s.due_date ? `; due: ${s.due_date}` : ""}${s.is_critical ? "; critical-path" : ""}` +
        `${ownerName(s.owner_id, names) ? `; owner: ${ownerName(s.owner_id, names)}` : ""}`,
    );
  }

  return lines.join("\n");
}
