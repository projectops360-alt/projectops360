// ============================================================================
// ProjectOps360° — Isabella Query Engine · verified report formatter
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// Turns a plan + retrieved rows/groups into a VERIFIED GuideAnswer: scope,
// filters applied, sort, total count, table (or grouped counts), a safe source
// statement — tier `verified`, never a low-confidence label. Pure.
// ============================================================================

import type { Locale, TaskPriority, TaskStatus } from "@/types/database";
import type { GuideAnswer } from "@/lib/knowledge-os/types";
import type { TaskReportRow } from "@/lib/isabella/task-report";
import type { GroupBucket } from "./filter-engine";
import type { IsabellaProjectQueryPlan, QueryFilter } from "./query-plan";

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

const STATUS_LABELS: Record<TaskStatus, { en: string; es: string }> = {
  not_started: { en: "Not Started", es: "Sin iniciar" },
  prompt_ready: { en: "Prompt Ready", es: "Prompt listo" },
  sent_to_ai: { en: "Sent to AI", es: "Enviado a IA" },
  in_progress: { en: "In Progress", es: "En progreso" },
  implemented: { en: "Implemented", es: "Implementado" },
  tested: { en: "Tested", es: "Probado" },
  done: { en: "Done", es: "Hecho" },
  blocked: { en: "Blocked", es: "Bloqueado" },
  deferred: { en: "Deferred", es: "Aplazado" },
};
const PRIORITY_LABELS: Record<TaskPriority, string> = { p1: "P1", p2: "P2", p3: "P3" };

function statusLabel(s: TaskStatus, es: boolean): string {
  return STATUS_LABELS[s]?.[es ? "es" : "en"] ?? s;
}
function cell(v: string): string {
  return v.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim() || "—";
}
function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

const FIELD_LABELS: Record<string, { en: string; es: string }> = {
  title: { en: "title", es: "título" },
  status: { en: "status", es: "estado" },
  milestone: { en: "milestone", es: "hito" },
  priority: { en: "priority", es: "prioridad" },
  owner: { en: "owner", es: "responsable" },
  dueDate: { en: "due date", es: "fecha de entrega" },
  updatedAt: { en: "last updated", es: "última actualización" },
  createdAt: { en: "created", es: "creación" },
  blocked: { en: "blocked", es: "bloqueada" },
  subtask: { en: "subtask", es: "subtarea" },
};

function fieldLabel(field: string, es: boolean): string {
  return FIELD_LABELS[field]?.[es ? "es" : "en"] ?? field;
}

/** Human, deterministic description of a single filter (for the scope line). */
export function describeFilter(f: QueryFilter, es: boolean): string {
  const label = fieldLabel(f.field, es);
  switch (f.operator) {
    case "is_null":
      return es ? `sin ${label}` : `no ${label}`;
    case "is_not_null":
      return es ? `con ${label}` : `has ${label}`;
    case "equals":
      if (f.field === "blocked") return f.value === true ? (es ? "bloqueadas" : "blocked") : es ? "no bloqueadas" : "not blocked";
      if (f.field === "status") return `${label}: ${statusLabel(String(f.value) as TaskStatus, es)}`;
      if (f.field === "priority") return `${label}: ${PRIORITY_LABELS[String(f.value) as TaskPriority] ?? String(f.value)}`;
      return `${label}: ${String(f.value)}`;
    case "not_equals":
      return es ? `${label} ≠ ${String(f.value)}` : `${label} ≠ ${String(f.value)}`;
    case "contains":
      return `${label} ~ "${String(f.value)}"`;
    case "before":
      return f.value === "today" ? (es ? "vencidas" : "overdue") : `${label} < ${String(f.value)}`;
    default:
      return `${label} ${f.operator}`;
  }
}

function describeFilters(plan: IsabellaProjectQueryPlan, es: boolean): string {
  if (plan.filters.length === 0) return es ? "sin filtros" : "no filters";
  return plan.filters.map((f) => describeFilter(f, es)).join(es ? "; " : "; ");
}

function baseAnswer(answer: string, es: boolean, expert: ExpertInfo, followups: string[]): GuideAnswer {
  return {
    answerId: null,
    grounded: true,
    answer,
    steps: [],
    followups,
    tier: "verified",
    confidenceScore: 1,
    language: (es ? "es" : "en") as Locale,
    sources: [
      {
        packageId: "project-tasks-live",
        slug: "project-tasks",
        versionId: "query-engine",
        title: es ? "Tareas del proyecto" : "Project tasks",
        tier: "verified",
      },
    ],
    expert,
  };
}

export interface QueryReportView {
  projectName: string;
  rows: TaskReportRow[];
  total: number;
  displayed: number;
  truncated: boolean;
  groups?: GroupBucket[];
}

function tableFor(rows: TaskReportRow[], es: boolean): string {
  const header = es
    ? "| # | Título | Estado | Hito | Prioridad | Responsable | Vence |"
    : "| # | Title | Status | Milestone | Priority | Owner | Due |";
  const sep = "| --- | --- | --- | --- | --- | --- | --- |";
  const noMilestone = es ? "Sin hito" : "No milestone";
  const body = rows.map((r, i) =>
    `| ${[
      String(i + 1),
      cell(r.title),
      statusLabel(r.status, es),
      r.milestoneTitle ? cell(r.milestoneTitle) : noMilestone,
      PRIORITY_LABELS[r.priority] ?? r.priority,
      cell(r.ownerName ?? "—"),
      dateOnly(r.dueDate),
    ].join(" | ")} |`,
  );
  return [header, sep, ...body].join("\n");
}

/**
 * Build the verified GuideAnswer for an executed query. `list` → intro + table;
 * `grouped_list`/`count` → per-group counts (+ optional compact listing).
 */
export function buildQueryReportAnswer(
  plan: IsabellaProjectQueryPlan,
  view: QueryReportView,
  expert: ExpertInfo,
): GuideAnswer {
  const es = plan.language === "es";
  const filtersText = describeFilters(plan, es);
  const countWord = es ? (view.total === 1 ? "tarea" : "tareas") : view.total === 1 ? "task" : "tasks";
  const followups = es
    ? ["Ese mismo reporte pero agrupado por estado", "Ahora solo las bloqueadas", "Ese pero sin hito"]
    : ["Same report grouped by status", "Now only the blocked ones", "That one but without milestone"];

  if (view.total === 0) {
    return baseAnswer(
      es
        ? `El proyecto **${view.projectName}** no tiene tareas que cumplan: ${filtersText}.`
        : `Project **${view.projectName}** has no tasks matching: ${filtersText}.`,
      es,
      expert,
      followups,
    );
  }

  // Grouped output (counts, and grouped_list adds compact per-group listing).
  if (plan.groupBy && view.groups) {
    const groupField = fieldLabel(plan.groupBy, es);
    const noneLabel = es ? "Sin " + groupField : "No " + groupField;
    const lines = view.groups.map((g) => {
      const label =
        g.key === "__none__"
          ? noneLabel
          : plan.groupBy === "status"
            ? statusLabel(g.key as TaskStatus, es)
            : plan.groupBy === "priority"
              ? PRIORITY_LABELS[g.key as TaskPriority] ?? g.key
              : g.key;
      return `- **${label}**: ${g.rows.length}`;
    });
    const intro = es
      ? `Claro. Resumen de tareas de **${view.projectName}** agrupadas por ${groupField}${plan.filters.length ? ` (${filtersText})` : ""}. Total: ${view.total} ${countWord}.`
      : `Sure. Task summary for **${view.projectName}** grouped by ${groupField}${plan.filters.length ? ` (${filtersText})` : ""}. Total: ${view.total} ${countWord}.`;
    const source = es ? "Fuente: tareas visibles del proyecto actual." : "Source: tasks visible in the current project.";
    return baseAnswer([intro, "", ...lines, "", source].join("\n"), es, expert, followups);
  }

  // Plain list.
  const intro = es
    ? `Claro. Aquí tienes el reporte de tareas de **${view.projectName}** (${filtersText}). Total: ${view.total} ${countWord}.`
    : `Sure. Here is the task report for **${view.projectName}** (${filtersText}). Total: ${view.total} ${countWord}.`;
  const parts = [intro, "", tableFor(view.rows, es)];
  if (view.truncated) {
    parts.push(
      "",
      es
        ? `Mostrando las primeras ${view.displayed} de ${view.total}. Abre el **Workboard** para ver todas.`
        : `Showing the first ${view.displayed} of ${view.total}. Open the **Workboard** to see them all.`,
    );
  }
  parts.push("", es ? "Fuente: tareas visibles del proyecto actual." : "Source: tasks visible in the current project.");
  return baseAnswer(parts.join("\n"), es, expert, followups);
}

/** The clarification answer (verified system state, not a low-confidence guess). */
export function buildClarificationAnswer(plan: IsabellaProjectQueryPlan, expert: ExpertInfo): GuideAnswer {
  const es = plan.language === "es";
  return baseAnswer(plan.clarificationQuestion ?? (es ? "¿Puedes precisar el reporte?" : "Could you clarify the report?"), es, expert, []);
}
