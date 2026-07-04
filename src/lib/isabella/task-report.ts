// ============================================================================
// ProjectOps360° — Isabella deterministic Task Report (pure, client-safe)
// ============================================================================
// ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA
//
// A report of the current project's tasks is a DETERMINISTIC project-data
// request, NOT an unknown knowledge question. Isabella must never answer
// "no tengo una respuesta verificada" when the app can produce the data.
//
// This module owns the PURE, testable pieces of that guarantee:
//   • detectTaskReportIntent — recognizes a task-report ask in EN/ES, with
//     imperfect spelling and mixed language, and resolves the requested sort.
//   • sortTaskReportRows — DETERMINISTIC sort (the LLM never sorts): the
//     requested field + direction, case-insensitive, with a stable tie-breaker.
//   • buildTaskReportGuideAnswer — formats a VERIFIED report (or an honest
//     empty/no-project/unauthorized/unavailable state) into a GuideAnswer.
//
// No server imports here: the retrieval (RBAC/org/project scope) lives in the
// server-only companion `task-report-service.ts`, which mirrors the approved
// Project Briefing access path (REG-013). This file is pure so it can be unit
// tested without a database and safely imported anywhere.
// ============================================================================

import type { Locale, TaskPriority, TaskStatus } from "@/types/database";
import type { ConfidenceTier, GuideAnswer } from "@/lib/knowledge-os/types";

// ── Sort vocabulary ─────────────────────────────────────────────────────────

export type TaskReportSortField =
  | "title"
  | "status"
  | "priority"
  | "milestone"
  | "due"
  | "updated"
  | "created";

export type TaskReportSortDirection = "asc" | "desc";

export interface TaskReportIntent {
  sortBy: TaskReportSortField;
  sortDirection: TaskReportSortDirection;
}

/** One authorized task row, projected for the report. No raw DB payloads. */
export interface TaskReportRow {
  id: string;
  title: string;
  status: TaskStatus;
  milestoneId: string | null;
  milestoneTitle: string | null;
  priority: TaskPriority;
  ownerId: string | null;
  /** Resolved display name when authorized (same-org profile); null otherwise. */
  ownerName: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  isBlocked: boolean;
  blockerReason: string | null;
  isSubtask: boolean;
}

export interface TaskReportData {
  projectName: string;
  /** Already sorted + truncated to the display window. */
  rows: TaskReportRow[];
  /** Total authorized tasks in scope (before truncation). */
  total: number;
  /** How many rows are shown in `rows`. */
  displayed: number;
  truncated: boolean;
  sortBy: TaskReportSortField;
  sortDirection: TaskReportSortDirection;
}

/** Discriminated result the server companion returns and the formatter consumes. */
export type TaskReportOutcome =
  | { ok: true; data: TaskReportData }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" };

/** How many rows Isabella lists inline before noting truncation. */
export const DEFAULT_TASK_REPORT_DISPLAY_LIMIT = 50;

// ── Intent detection ─────────────────────────────────────────────────────────

// Combining diacritical marks (U+0300–U+036F) — built via escape so the source
// stays plain ASCII and editor-safe.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/** Lowercase + strip diacritics so "título"/"muéstrame"/"la tareas" all match. */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();
}

const TASK_NOUN = /\btareas?\b|\btasks?\b/;
const REPORT_NOUN = /\b(reportes?|report|listados?|lista|list|tabla|table)\b/;
const ALL_TASKS =
  /\btodas?\s+(las?\s+)?tareas?\b|\ball\s+(the\s+)?tasks?\b|\bevery\s+task\b|\bcada\s+tarea\b/;
const SHOW_VERB =
  /\b(muestrame|muestra|ensename|dame|listame|show|display|list|dime|give)\b/;
const ANY_ALL = /\b(todas?|all)\b/;

/**
 * Detect a task-report request. Conservative: fires only when the ask is clearly
 * "a report/list/table of tasks" or "all tasks …" — NOT for "how do I create a
 * task?" or "show me how tasks work". Handles EN, ES, mixed language and typos.
 * Returns the resolved sort, or null when this is not a task-report ask.
 */
export function detectTaskReportIntent(rawQuery: string): TaskReportIntent | null {
  const q = normalize(rawQuery ?? "");
  if (!q || !TASK_NOUN.test(q)) return null;

  const isReport =
    REPORT_NOUN.test(q) || ALL_TASKS.test(q) || (SHOW_VERB.test(q) && ANY_ALL.test(q));
  if (!isReport) return null;

  return { sortBy: parseSortField(q), sortDirection: parseSortDirection(q) };
}

function parseSortField(q: string): TaskReportSortField {
  if (/\b(titulo|title|nombre|name)\b/.test(q)) return "title";
  if (/\b(estado|status)\b/.test(q)) return "status";
  if (/\b(prioridad|priority)\b/.test(q)) return "priority";
  if (/\b(hito|milestone|fase|phase)\b/.test(q)) return "milestone";
  if (/\b(vencimiento|due|entrega|deadline)\b|fecha limite/.test(q)) return "due";
  if (/\b(actualizad\w*|updated|modificad\w*)\b/.test(q)) return "updated";
  if (/\b(cread\w*|created|creacion|creation)\b/.test(q)) return "created";
  return "title"; // sensible default
}

function parseSortDirection(q: string): TaskReportSortDirection {
  if (/\bdesc\b|descend\w*|descendente|z\s*-?\s*a|invers\w*|mayor a menor|recientes/.test(q)) {
    return "desc";
  }
  if (/\basc\b|ascend\w*|ascendente|a\s*-?\s*z|menor a mayor|antiguos/.test(q)) {
    return "asc";
  }
  return "asc"; // natural default when unspecified
}

// ── Deterministic sorting (the LLM never sorts) ──────────────────────────────

function primaryValue(row: TaskReportRow, field: TaskReportSortField): string | null {
  switch (field) {
    case "title":
      return row.title || null;
    case "status":
      return row.status;
    case "priority":
      return row.priority;
    case "milestone":
      return row.milestoneTitle || null;
    case "due":
      return row.dueDate;
    case "updated":
      return row.updatedAt;
    case "created":
      return row.createdAt;
  }
}

function compareStrings(a: string, b: string): number {
  // Case-insensitive, accent-insensitive, natural numeric ordering.
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/**
 * Sort rows deterministically by the requested field + direction. Missing values
 * always sort last (regardless of direction). Tie-breaker is ALWAYS the same so
 * the report is replay-stable: createdAt DESC (newest first), then id ASC.
 */
export function sortTaskReportRows(
  rows: TaskReportRow[],
  sortBy: TaskReportSortField,
  direction: TaskReportSortDirection,
): TaskReportRow[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = primaryValue(a, sortBy);
    const bv = primaryValue(b, sortBy);
    const aNull = av == null || av === "";
    const bNull = bv == null || bv === "";
    if (!aNull || !bNull) {
      if (aNull) return 1; // nulls last
      if (bNull) return -1;
      const base = compareStrings(av as string, bv as string);
      if (base !== 0) return sign * base;
    }
    // Tie-breaker: createdAt DESC (newest first), nulls last.
    const ac = a.createdAt;
    const bc = b.createdAt;
    if (ac !== bc) {
      if (!ac) return 1;
      if (!bc) return -1;
      const byCreated = compareStrings(bc, ac); // reversed for DESC
      if (byCreated !== 0) return byCreated;
    }
    // Final deterministic key: id ASC.
    return compareStrings(a.id, b.id);
  });
}

// ── Presentation labels ──────────────────────────────────────────────────────

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

const SORT_FIELD_LABELS: Record<TaskReportSortField, { en: string; es: string }> = {
  title: { en: "title", es: "título" },
  status: { en: "status", es: "estado" },
  priority: { en: "priority", es: "prioridad" },
  milestone: { en: "milestone", es: "hito" },
  due: { en: "due date", es: "fecha de entrega" },
  updated: { en: "last updated", es: "última actualización" },
  created: { en: "created date", es: "fecha de creación" },
};

function directionLabel(
  field: TaskReportSortField,
  dir: TaskReportSortDirection,
  lang: "en" | "es",
): string {
  const word =
    lang === "es"
      ? dir === "desc"
        ? "descendente"
        : "ascendente"
      : dir === "desc"
        ? "descending"
        : "ascending";
  if (field === "title") {
    return `${word} (${dir === "desc" ? "Z → A" : "A → Z"})`;
  }
  return word;
}

function statusLabel(status: TaskStatus, lang: "en" | "es"): string {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

/** Keep a value safe inside a markdown table cell (no pipes / newlines). */
function cell(value: string): string {
  return value.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim() || "—";
}

// ── Report → GuideAnswer ─────────────────────────────────────────────────────

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

function baseAnswer(
  answer: string,
  language: "en" | "es",
  expert: ExpertInfo,
  opts: {
    grounded: boolean;
    tier: ConfidenceTier;
    score: number;
    followups?: string[];
    sources?: GuideAnswer["sources"];
  },
): GuideAnswer {
  return {
    answerId: null,
    grounded: opts.grounded,
    answer,
    steps: [],
    followups: opts.followups ?? [],
    tier: opts.tier,
    confidenceScore: opts.score,
    language: language as Locale,
    sources: opts.sources ?? [],
    expert,
  };
}

function buildFollowups(data: TaskReportData, lang: "en" | "es"): string[] {
  const options: Array<{ field: TaskReportSortField; label: { en: string; es: string } }> = [
    {
      field: "status",
      label: { en: "Task report by status (descending)", es: "Reporte de tareas por estado (descendente)" },
    },
    {
      field: "priority",
      label: { en: "Task report by priority", es: "Reporte de tareas por prioridad" },
    },
    {
      field: "title",
      label: { en: "Task report by title ascending", es: "Reporte de tareas por título ascendente" },
    },
    {
      field: "due",
      label: { en: "Task report by due date", es: "Reporte de tareas por fecha de entrega" },
    },
  ];
  return options
    .filter((o) => o.field !== data.sortBy)
    .slice(0, 3)
    .map((o) => o.label[lang]);
}

function buildReportTable(rows: TaskReportRow[], lang: "en" | "es"): string {
  const header =
    lang === "es"
      ? "| # | Título | Estado | Hito | Prioridad | Responsable | Vence |"
      : "| # | Title | Status | Milestone | Priority | Owner | Due |";
  const sep = "| --- | --- | --- | --- | --- | --- | --- |";
  const body = rows.map((r, i) => {
    const cols = [
      String(i + 1),
      cell(r.title),
      statusLabel(r.status, lang),
      cell(r.milestoneTitle ?? "—"),
      PRIORITY_LABELS[r.priority] ?? r.priority,
      cell(r.ownerName ?? "—"),
      dateOnly(r.dueDate),
    ];
    return `| ${cols.join(" | ")} |`;
  });
  return [header, sep, ...body].join("\n");
}

/**
 * Turn a deterministic outcome into a GuideAnswer. A successful (or empty)
 * report is marked VERIFIED project data — never the low-confidence
 * "ai_suggestion" fallback. Honest states (no project / unauthorized / load
 * error) are explicit and never fabricate rows.
 */
export function buildTaskReportGuideAnswer(
  outcome: TaskReportOutcome,
  language: "en" | "es",
  expert: ExpertInfo,
): GuideAnswer {
  const es = language === "es";

  if (!outcome.ok) {
    if (outcome.reason === "no_project") {
      return baseAnswer(
        es
          ? "Necesito que abras o selecciones un proyecto para generar ese reporte de tareas."
          : "I need you to open or select a project to generate that task report.",
        language,
        expert,
        { grounded: false, tier: "verified", score: 1 },
      );
    }
    if (outcome.reason === "not_authorized") {
      return baseAnswer(
        es
          ? "No tienes permiso para ver las tareas de este proyecto."
          : "You do not have permission to view this project's tasks.",
        language,
        expert,
        { grounded: false, tier: "verified", score: 1 },
      );
    }
    // unavailable
    return baseAnswer(
      es
        ? "Encontré el proyecto, pero no pude cargar las tareas en este momento. Inténtalo de nuevo o abre el Workboard."
        : "I found the project but couldn't load the tasks right now. Please try again or open the Workboard.",
      language,
      expert,
      { grounded: false, tier: "verified", score: 1 },
    );
  }

  const { data } = outcome;

  if (data.total === 0) {
    return baseAnswer(
      es
        ? `El proyecto **${data.projectName}** no tiene tareas visibles para ti.`
        : `Project **${data.projectName}** has no tasks visible to you.`,
      language,
      expert,
      { grounded: true, tier: "verified", score: 1 },
    );
  }

  const fieldLabel = SORT_FIELD_LABELS[data.sortBy][es ? "es" : "en"];
  const dirLabel = directionLabel(data.sortBy, data.sortDirection, es ? "es" : "en");
  const countWord = es ? (data.total === 1 ? "tarea" : "tareas") : data.total === 1 ? "task" : "tasks";

  const intro = es
    ? `Aquí tienes el reporte de tareas de **${data.projectName}**, ordenado por ${fieldLabel} en orden ${dirLabel}. Total: ${data.total} ${countWord}.`
    : `Here is the task report for **${data.projectName}**, sorted by ${fieldLabel} ${dirLabel}. Total: ${data.total} ${countWord}.`;

  const table = buildReportTable(data.rows, es ? "es" : "en");

  const parts = [intro, "", table];
  if (data.truncated) {
    parts.push(
      "",
      es
        ? `Mostrando las primeras ${data.displayed} de ${data.total}. Abre el **Workboard** para ver todas.`
        : `Showing the first ${data.displayed} of ${data.total}. Open the **Workboard** to see them all.`,
    );
  }

  const sources: GuideAnswer["sources"] = [
    {
      packageId: "project-tasks-live",
      versionId: `tasks-${data.total}`,
      slug: "project-tasks",
      title: es ? `Tareas del proyecto (${data.total})` : `Project tasks (${data.total})`,
      tier: "verified",
    },
  ];

  return baseAnswer(parts.join("\n"), language, expert, {
    grounded: true,
    tier: "verified",
    score: 1,
    followups: buildFollowups(data, es ? "es" : "en"),
    sources,
  });
}
