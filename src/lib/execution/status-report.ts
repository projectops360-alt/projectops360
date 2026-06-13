// ============================================================================
// ProjectOps360° — Plain-language Project Status Report
// ============================================================================
// Builds a human, story-driven status model for a project: overall progress,
// the milestone "journey" (done / in progress / upcoming), what needs
// attention (blocked work + missing info), and the materials in plain words.
// Pure function — the route fetches data and passes it in; rendered by
// status-report-client and exportable to PDF via the browser print dialog.
// ============================================================================

import type { Milestone, RoadmapTask, MaterialRequirement, I18nField } from "@/types/database";

// ── Types ───────────────────────────────────────────────────────────────────

export type PhaseState = "completed" | "in_progress" | "upcoming" | "empty";

export interface PhaseStatus {
  id: string;
  title: string;
  order: number;
  total: number;
  done: number;
  state: PhaseState;
  /** Plain progress 0..100 by task count. */
  pct: number;
  blocked: { title: string; reason: string | null }[];
}

export type AttentionKind =
  | "blocked"
  | "missing_dates"
  | "missing_budget"
  | "missing_material_detail"
  | "unassigned";

export interface AttentionItem {
  kind: AttentionKind;
  severity: "high" | "medium" | "low";
  message_i18n: I18nField;
}

export interface ReportMaterial {
  name: string;
  status: string;
}

export interface ProjectStatusReport {
  projectTitle: string;
  projectType: string;
  generatedAt: string;
  plannedStart: string | null;
  plannedFinish: string | null;

  totalTasks: number;
  doneTasks: number;
  startedTasks: number;
  notStartedTasks: number;
  blockedTasks: number;
  completionPct: number;
  assignedPct: number;

  headline_i18n: I18nField;

  phases: PhaseStatus[];
  donePhases: PhaseStatus[];
  currentPhase: PhaseStatus | null;
  upcomingPhases: PhaseStatus[];

  attention: AttentionItem[];
  materials: ReportMaterial[];

  hasDates: boolean;
  hasBudget: boolean;
}

export interface StatusReportInput {
  project: Pick<Milestone, never> & {
    title: string;
    project_type: string;
    start_date: string | null;
    target_end_date: string | null;
  };
  milestones: Pick<Milestone, "id" | "title" | "order_index">[];
  tasks: Pick<
    RoadmapTask,
    "id" | "title" | "status" | "milestone_id" | "start_date" | "end_date" | "assigned_to" | "assigned_resource_id" | "blocker_reason"
  >[];
  materials: Pick<MaterialRequirement, "name" | "status" | "quantity">[];
  budgetItemCount: number;
}

// ── Status grouping ─────────────────────────────────────────────────────────

const DONE_STATUSES = new Set(["done", "tested"]);
const STARTED_STATUSES = new Set(["prompt_ready", "sent_to_ai", "in_progress", "implemented"]);

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildStatusReport(input: StatusReportInput): ProjectStatusReport {
  const tasks = input.tasks;
  const total = tasks.length;
  const done = tasks.filter((t) => DONE_STATUSES.has(t.status)).length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const started = tasks.filter((t) => STARTED_STATUSES.has(t.status)).length;
  const notStarted = total - done - blocked - started;
  const assigned = tasks.filter((t) => t.assigned_to || t.assigned_resource_id).length;

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
  const assignedPct = total > 0 ? Math.round((assigned / total) * 100) : 0;

  // ── Phases ────────────────────────────────────────────────────────────────
  const tasksByMilestone = new Map<string | null, typeof tasks>();
  for (const t of tasks) {
    const key = t.milestone_id ?? null;
    if (!tasksByMilestone.has(key)) tasksByMilestone.set(key, []);
    tasksByMilestone.get(key)!.push(t);
  }

  const phases: PhaseStatus[] = [...input.milestones]
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) => {
      const phaseTasks = tasksByMilestone.get(m.id) ?? [];
      const phaseDone = phaseTasks.filter((t) => DONE_STATUSES.has(t.status)).length;
      const phaseBlocked = phaseTasks
        .filter((t) => t.status === "blocked")
        .map((t) => ({ title: t.title, reason: t.blocker_reason }));
      let state: PhaseState;
      if (phaseTasks.length === 0) state = "empty";
      else if (phaseDone === phaseTasks.length) state = "completed";
      else if (phaseDone > 0 || phaseBlocked.length > 0 || phaseTasks.some((t) => STARTED_STATUSES.has(t.status)))
        state = "in_progress";
      else state = "upcoming";
      return {
        id: m.id,
        title: m.title,
        order: m.order_index,
        total: phaseTasks.length,
        done: phaseDone,
        state,
        pct: phaseTasks.length > 0 ? Math.round((phaseDone / phaseTasks.length) * 100) : 0,
        blocked: phaseBlocked,
      };
    });

  const donePhases = phases.filter((p) => p.state === "completed");
  const currentPhase = phases.find((p) => p.state === "in_progress") ?? null;
  const upcomingPhases = phases.filter(
    (p) => p.state === "upcoming" || (p.state === "empty" && p.order > (currentPhase?.order ?? -1)),
  );

  // ── Attention items ─────────────────────────────────────────────────────────
  const attention: AttentionItem[] = [];
  for (const phase of phases) {
    for (const b of phase.blocked) {
      attention.push({
        kind: "blocked",
        severity: "high",
        message_i18n: {
          en: b.reason ? `"${b.title}" is on hold: ${b.reason}` : `"${b.title}" is on hold.`,
          es: b.reason ? `"${b.title}" está en pausa: ${b.reason}` : `"${b.title}" está en pausa.`,
        },
      });
    }
  }

  const hasDates = tasks.some((t) => t.start_date || t.end_date);
  if (!hasDates && total > 0) {
    attention.push({
      kind: "missing_dates",
      severity: "medium",
      message_i18n: {
        en: "The tasks don't have dates yet, so there's no reliable finish date.",
        es: "Las tareas todavía no tienen fechas, así que aún no hay una fecha de entrega confiable.",
      },
    });
  }

  const hasBudget = input.budgetItemCount > 0;
  if (!hasBudget) {
    attention.push({
      kind: "missing_budget",
      severity: "low",
      message_i18n: {
        en: "No budget has been recorded for this project.",
        es: "Todavía no se ha registrado un presupuesto para este proyecto.",
      },
    });
  }

  const materialsMissingDetail = input.materials.filter((m) => m.quantity == null).length;
  if (materialsMissingDetail > 0) {
    attention.push({
      kind: "missing_material_detail",
      severity: "low",
      message_i18n: {
        en: `${materialsMissingDetail} material(s) don't have quantities recorded yet.`,
        es: `${materialsMissingDetail} material(es) aún no tienen cantidades registradas.`,
      },
    });
  }

  const unassigned = total - assigned;
  if (unassigned > 0 && total > 0) {
    attention.push({
      kind: "unassigned",
      severity: "low",
      message_i18n: {
        en: `${unassigned} task(s) don't have anyone assigned yet.`,
        es: `${unassigned} tarea(s) todavía no tienen a nadie asignado.`,
      },
    });
  }

  // ── Headline ──────────────────────────────────────────────────────────────
  const headline_i18n = buildHeadline(done, total, blocked, completionPct);

  return {
    projectTitle: input.project.title,
    projectType: input.project.project_type,
    generatedAt: new Date().toISOString(),
    plannedStart: input.project.start_date,
    plannedFinish: input.project.target_end_date,
    totalTasks: total,
    doneTasks: done,
    startedTasks: started,
    notStartedTasks: Math.max(0, notStarted),
    blockedTasks: blocked,
    completionPct,
    assignedPct,
    headline_i18n,
    phases,
    donePhases,
    currentPhase,
    upcomingPhases,
    attention,
    materials: input.materials.map((m) => ({ name: m.name, status: m.status })),
    hasDates,
    hasBudget,
  };
}

function buildHeadline(done: number, total: number, blocked: number, pct: number): I18nField {
  if (total === 0) {
    return {
      en: "This project doesn't have any tasks yet.",
      es: "Este proyecto todavía no tiene tareas.",
    };
  }
  const half = pct >= 50;
  const enProgress = half
    ? `You're more than halfway: ${done} of ${total} jobs are done.`
    : `You're getting started: ${done} of ${total} jobs are done.`;
  const esProgress = half
    ? `Vas más de la mitad del camino: ${done} de ${total} trabajos están listos.`
    : `Apenas comienzas: ${done} de ${total} trabajos están listos.`;
  if (blocked > 0) {
    return {
      en: `${enProgress} ${blocked === 1 ? "One thing is" : `${blocked} things are`} on hold and need${blocked === 1 ? "s" : ""} your attention.`,
      es: `${esProgress} ${blocked === 1 ? "Una cosa está" : `${blocked} cosas están`} en pausa y necesita${blocked === 1 ? "" : "n"} tu atención.`,
    };
  }
  if (pct === 100) {
    return { en: "Every job is done — the project is complete.", es: "Todos los trabajos están listos — el proyecto está completo." };
  }
  return { en: `${enProgress} Everything is on track.`, es: `${esProgress} Todo va en orden.` };
}
