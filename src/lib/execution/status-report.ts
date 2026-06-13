// ============================================================================
// ProjectOps360° — Plain-language Project Status Report
// ============================================================================
// Builds a human, story-driven status model for a project: overall progress,
// the milestone "journey" (done / in progress / upcoming), what needs
// attention (blocked work + missing info), and the materials in plain words.
// Pure function — the route fetches data and passes it in; rendered by
// status-report-client and exportable to PDF via the browser print dialog.
// ============================================================================

import type { Milestone, RoadmapTask, TaskDependency, MaterialRequirement, I18nField } from "@/types/database";

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

/** A blocked task, surfaced at the top of the report (problems first). */
export interface BlockerDetail {
  taskTitle: string;
  reason: string | null;
  phaseTitle: string | null;
}

// ── Daily action plan ─────────────────────────────────────────────────────────

/** What kind of action a task needs today. */
export type DailyActionType = "unblock" | "do_now" | "start" | "assign";

export interface DailyAction {
  taskId: string;
  taskTitle: string;
  phaseTitle: string | null;
  action: DailyActionType;
  /** Blocker reason when action is "unblock". */
  reason: string | null;
}

export interface DailyOwner {
  ownerKey: string;
  ownerName: string;
  ownerKind: "person" | "resource" | "unassigned";
  actions: DailyAction[];
}

export interface DailyPlan {
  owners: DailyOwner[];
  totalActions: number;
  /** Actionable tasks waiting only because a predecessor isn't finished. */
  waitingCount: number;
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

  /** Blocked work, surfaced first so the report focuses on problems. */
  blockers: BlockerDetail[];

  /** What to do now and who does it. */
  dailyPlan: DailyPlan;

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
  dependencies: Pick<TaskDependency, "predecessor_id" | "successor_id" | "dependency_type">[];
  /** Display names for assignees: auth user id → name. */
  peopleNames: Record<string, string>;
  /** Display names for assigned resources: resource id → name. */
  resourceNames: Record<string, string>;
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

  // ── Blockers (surfaced first) + attention items ──────────────────────────────
  const blockers: BlockerDetail[] = [];
  const attention: AttentionItem[] = [];
  for (const phase of phases) {
    for (const b of phase.blocked) {
      blockers.push({ taskTitle: b.title, reason: b.reason, phaseTitle: phase.title });
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

  // ── Daily action plan ───────────────────────────────────────────────────────
  const dailyPlan = buildDailyPlan(input, phases);

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
    blockers,
    dailyPlan,
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

// ── Daily plan builder ────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["done", "tested", "cancelled", "deferred"]);
// Ordering deps where the predecessor must finish/start before the successor.
const ORDERING_DEP_TYPES = new Set(["finish_to_start", "start_to_start"]);
const ACTION_RANK: Record<DailyActionType, number> = { unblock: 0, do_now: 1, start: 2, assign: 3 };

/**
 * "What to do now and who does it." Without task dates, today's plan is the
 * actionable frontier: blocked work to resolve + tasks whose predecessors are
 * already complete. Tasks still waiting on a predecessor are counted but not
 * listed (they aren't actionable yet). Grouped by the person/crew responsible.
 */
function buildDailyPlan(input: StatusReportInput, phases: PhaseStatus[]): DailyPlan {
  const phaseTitleById = new Map(phases.map((p) => [p.id, p.title]));
  const doneIds = new Set(
    input.tasks.filter((t) => DONE_STATUSES.has(t.status)).map((t) => t.id),
  );

  // Incomplete ordering predecessors per successor task.
  const incompletePredecessors = new Map<string, number>();
  for (const dep of input.dependencies) {
    if (!ORDERING_DEP_TYPES.has(dep.dependency_type)) continue;
    if (!doneIds.has(dep.predecessor_id)) {
      incompletePredecessors.set(dep.successor_id, (incompletePredecessors.get(dep.successor_id) ?? 0) + 1);
    }
  }

  const ownerMap = new Map<string, DailyOwner>();
  let waitingCount = 0;

  const ownerFor = (task: StatusReportInput["tasks"][number]): { key: string; name: string; kind: DailyOwner["ownerKind"] } => {
    if (task.assigned_to && input.peopleNames[task.assigned_to]) {
      return { key: `u:${task.assigned_to}`, name: input.peopleNames[task.assigned_to], kind: "person" };
    }
    if (task.assigned_resource_id && input.resourceNames[task.assigned_resource_id]) {
      return { key: `r:${task.assigned_resource_id}`, name: input.resourceNames[task.assigned_resource_id], kind: "resource" };
    }
    return { key: "__unassigned__", name: "", kind: "unassigned" };
  };

  for (const task of input.tasks) {
    if (TERMINAL_STATUSES.has(task.status)) continue;

    let action: DailyActionType;
    if (task.status === "blocked") {
      action = "unblock";
    } else if ((incompletePredecessors.get(task.id) ?? 0) > 0) {
      // Waiting on a predecessor — not actionable today.
      waitingCount++;
      continue;
    } else if (STARTED_STATUSES.has(task.status)) {
      action = "do_now";
    } else {
      action = "start";
    }

    const owner = ownerFor(task);
    // Unassigned actionable work becomes an "assign someone" item.
    const finalAction: DailyActionType = owner.kind === "unassigned" && action !== "unblock" ? "assign" : action;

    if (!ownerMap.has(owner.key)) {
      ownerMap.set(owner.key, { ownerKey: owner.key, ownerName: owner.name, ownerKind: owner.kind, actions: [] });
    }
    ownerMap.get(owner.key)!.actions.push({
      taskId: task.id,
      taskTitle: task.title,
      phaseTitle: task.milestone_id ? phaseTitleById.get(task.milestone_id) ?? null : null,
      action: finalAction,
      reason: action === "unblock" ? task.blocker_reason : null,
    });
  }

  // Sort actions within each owner, and owners (unassigned last).
  const owners = [...ownerMap.values()];
  for (const o of owners) {
    o.actions.sort((a, b) => ACTION_RANK[a.action] - ACTION_RANK[b.action]);
  }
  owners.sort((a, b) => {
    if (a.ownerKind === "unassigned") return 1;
    if (b.ownerKind === "unassigned") return -1;
    return a.ownerName.localeCompare(b.ownerName);
  });

  return {
    owners,
    totalActions: owners.reduce((s, o) => s + o.actions.length, 0),
    waitingCount,
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
