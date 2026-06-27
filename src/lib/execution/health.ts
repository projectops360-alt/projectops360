// ============================================================================
// ProjectOps360° — Project Health Engine
// ============================================================================
// Derives schedule / budget / resource / material / risk / dependency health
// from real connected data, with bilingual evidence-backed explanations.
// Pure functions — callers batch-load project data and pass it in.
// ============================================================================

import type {
  RoadmapTask,
  Milestone,
  TaskDependency,
  BudgetItem,
  MaterialRequirement,
  Risk,
  Rfi,
  Submittal,
  Resource,
  I18nField,
} from "@/types/database";
import type { CriticalPathResult } from "./critical-path";
import { calculateTaskReadiness, type TaskReadinessContext } from "./readiness";
import { MATERIAL_AVAILABLE_STATUSES, RFI_BLOCKING_STATUSES } from "./constants";
import { hasActiveBlocker } from "./task-activity";

// ── Types ───────────────────────────────────────────────────────────────────

export type HealthLevel = "healthy" | "at_risk" | "critical" | "unknown";

export type HealthDimension =
  | "schedule"
  | "budget"
  | "resources"
  | "materials"
  | "risks"
  | "dependencies"
  | "critical_path";

export interface HealthFinding {
  dimension: HealthDimension;
  level: HealthLevel;
  message_i18n: I18nField;
  /** Entity ids that support this finding (evidence-first). */
  evidence_entity_ids: string[];
}

export interface DimensionHealth {
  dimension: HealthDimension;
  level: HealthLevel;
  score: number; // 0..100
  findings: HealthFinding[];
}

export interface ProjectHealth {
  overall_level: HealthLevel;
  overall_score: number;
  dimensions: DimensionHealth[];
  findings: HealthFinding[];
}

export interface ProjectHealthInput {
  tasks: RoadmapTask[];
  milestones: Milestone[];
  dependencies: TaskDependency[];
  budgetItems?: BudgetItem[];
  materials?: MaterialRequirement[];
  risks?: Risk[];
  rfis?: Rfi[];
  submittals?: Submittal[];
  resources?: Resource[];
  criticalPath?: CriticalPathResult;
  /** Project target end date (ISO). */
  targetEndDate?: string | null;
  /** Reference "today" for date math (ISO). Defaults to current date. */
  today?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function levelFromScore(score: number): HealthLevel {
  if (score >= 75) return "healthy";
  if (score >= 45) return "at_risk";
  return "critical";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Engine ──────────────────────────────────────────────────────────────────

export function calculateProjectHealth(input: ProjectHealthInput): ProjectHealth {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const activeTasks = input.tasks.filter((t) => !t.deleted_at);
  const dimensions: DimensionHealth[] = [];

  // ── Schedule health ───────────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;

    // REG-010: a completed/terminal task is NEVER a blocker (a stale is_blocked
    // flag on a Done task must not inflate Executive Insights). Single source of
    // truth: hasActiveBlocker() — same rule the Living Graph header uses.
    const blocked = activeTasks.filter((t) => hasActiveBlocker(t));
    if (blocked.length > 0) {
      score -= Math.min(40, blocked.length * 10);
      findings.push({
        dimension: "schedule",
        level: blocked.length > 2 ? "critical" : "at_risk",
        evidence_entity_ids: blocked.map((t) => t.id),
        message_i18n: {
          en: `${blocked.length} task(s) are blocked.`,
          es: `${blocked.length} tarea(s) están bloqueadas.`,
        },
      });
    }

    const overdue = activeTasks.filter(
      (t) => t.end_date && t.end_date < today && !["done", "tested"].includes(t.status),
    );
    if (overdue.length > 0) {
      score -= Math.min(30, overdue.length * 8);
      findings.push({
        dimension: "schedule",
        level: "at_risk",
        evidence_entity_ids: overdue.map((t) => t.id),
        message_i18n: {
          en: `${overdue.length} task(s) are past their planned finish date.`,
          es: `${overdue.length} tarea(s) superaron su fecha planificada de fin.`,
        },
      });
    }

    if (input.criticalPath && input.targetEndDate) {
      if (input.criticalPath.projectEarliestFinishDate > input.targetEndDate) {
        score -= 30;
        findings.push({
          dimension: "schedule",
          level: "critical",
          evidence_entity_ids: input.criticalPath.criticalTaskIds,
          message_i18n: {
            en: `Critical path finishes ${input.criticalPath.projectEarliestFinishDate}, after the project target ${input.targetEndDate}.`,
            es: `La ruta crítica termina el ${input.criticalPath.projectEarliestFinishDate}, después del objetivo del proyecto (${input.targetEndDate}).`,
          },
        });
      }
    }

    dimensions.push({
      dimension: "schedule",
      score: clampScore(score),
      level: activeTasks.length === 0 ? "unknown" : levelFromScore(clampScore(score)),
      findings,
    });
  }

  // ── Budget health ─────────────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;
    const items = (input.budgetItems ?? []).filter((b) => !b.deleted_at);

    if (items.length === 0) {
      dimensions.push({ dimension: "budget", score: 0, level: "unknown", findings });
    } else {
      const estimated = items.reduce((s, b) => s + (b.estimated_cost ?? 0), 0);
      const actual = items.reduce((s, b) => s + (b.actual_cost ?? 0), 0);
      const forecast = items.reduce((s, b) => s + (b.forecast_cost ?? b.actual_cost ?? 0), 0);

      const overruns = items.filter(
        (b) => b.estimated_cost > 0 && (b.forecast_cost ?? b.actual_cost) > b.estimated_cost,
      );
      if (overruns.length > 0) {
        score -= Math.min(40, overruns.length * 12);
        findings.push({
          dimension: "budget",
          level: "at_risk",
          evidence_entity_ids: overruns.map((b) => b.id),
          message_i18n: {
            en: `${overruns.length} budget item(s) forecast above estimate.`,
            es: `${overruns.length} partida(s) de presupuesto pronostican sobrecosto.`,
          },
        });
      }
      if (estimated > 0 && forecast > estimated * 1.1) {
        score -= 30;
        findings.push({
          dimension: "budget",
          level: "critical",
          evidence_entity_ids: [],
          message_i18n: {
            en: `Total forecast (${forecast.toFixed(0)}) exceeds estimate (${estimated.toFixed(0)}) by more than 10%.`,
            es: `El pronóstico total (${forecast.toFixed(0)}) supera el estimado (${estimated.toFixed(0)}) en más del 10%.`,
          },
        });
      }
      if (estimated > 0 && actual > estimated) {
        score -= 20;
      }

      const tasksWithoutBudget = activeTasks.filter(
        (t) => !t.budget_item_id && !["done", "tested"].includes(t.status),
      );
      if (items.length > 0 && tasksWithoutBudget.length > activeTasks.length * 0.5 && activeTasks.length > 0) {
        score -= 10;
        findings.push({
          dimension: "budget",
          level: "at_risk",
          evidence_entity_ids: tasksWithoutBudget.slice(0, 10).map((t) => t.id),
          message_i18n: {
            en: `${tasksWithoutBudget.length} open task(s) have no budget item connected.`,
            es: `${tasksWithoutBudget.length} tarea(s) abiertas no tienen partida de presupuesto conectada.`,
          },
        });
      }

      dimensions.push({
        dimension: "budget",
        score: clampScore(score),
        level: levelFromScore(clampScore(score)),
        findings,
      });
    }
  }

  // ── Resource health ───────────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;
    const openTasks = activeTasks.filter((t) => !["done", "tested", "deferred"].includes(t.status));

    const unassigned = openTasks.filter((t) => !t.assigned_to && !t.assigned_resource_id);
    if (openTasks.length > 0 && unassigned.length > 0) {
      const ratio = unassigned.length / openTasks.length;
      score -= Math.min(40, Math.round(ratio * 60));
      findings.push({
        dimension: "resources",
        level: ratio > 0.5 ? "at_risk" : "healthy",
        evidence_entity_ids: unassigned.slice(0, 10).map((t) => t.id),
        message_i18n: {
          en: `${unassigned.length} of ${openTasks.length} open task(s) have no owner.`,
          es: `${unassigned.length} de ${openTasks.length} tarea(s) abiertas no tienen responsable.`,
        },
      });
    }

    const unavailable = (input.resources ?? []).filter(
      (r) => !r.deleted_at && r.status === "unavailable",
    );
    if (unavailable.length > 0) {
      score -= Math.min(30, unavailable.length * 10);
      findings.push({
        dimension: "resources",
        level: "at_risk",
        evidence_entity_ids: unavailable.map((r) => r.id),
        message_i18n: {
          en: `${unavailable.length} resource(s) are unavailable.`,
          es: `${unavailable.length} recurso(s) no están disponibles.`,
        },
      });
    }

    dimensions.push({
      dimension: "resources",
      score: clampScore(score),
      level: openTasks.length === 0 ? "unknown" : levelFromScore(clampScore(score)),
      findings,
    });
  }

  // ── Material health ───────────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;
    const mats = (input.materials ?? []).filter((m) => !m.deleted_at);

    if (mats.length === 0) {
      dimensions.push({ dimension: "materials", score: 0, level: "unknown", findings });
    } else {
      const problematic = mats.filter((m) => m.status === "unavailable" || m.status === "delayed");
      if (problematic.length > 0) {
        score -= Math.min(50, problematic.length * 15);
        findings.push({
          dimension: "materials",
          level: "at_risk",
          evidence_entity_ids: problematic.map((m) => m.id),
          message_i18n: {
            en: `${problematic.length} material requirement(s) are delayed or unavailable.`,
            es: `${problematic.length} requerimiento(s) de material están retrasados o no disponibles.`,
          },
        });
      }

      const lateForTask = mats.filter(
        (m) =>
          m.required_by_date &&
          m.required_by_date < today &&
          !MATERIAL_AVAILABLE_STATUSES.includes(m.status),
      );
      if (lateForTask.length > 0) {
        score -= Math.min(40, lateForTask.length * 15);
        findings.push({
          dimension: "materials",
          level: "critical",
          evidence_entity_ids: lateForTask.map((m) => m.id),
          message_i18n: {
            en: `${lateForTask.length} material(s) missed their required-by date.`,
            es: `${lateForTask.length} material(es) incumplieron su fecha requerida.`,
          },
        });
      }

      dimensions.push({
        dimension: "materials",
        score: clampScore(score),
        level: levelFromScore(clampScore(score)),
        findings,
      });
    }
  }

  // ── Risk health ───────────────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;
    const open = (input.risks ?? []).filter(
      (r) => !r.deleted_at && (r.status === "open" || r.status === "mitigating"),
    );
    const critical = open.filter((r) => r.severity === "critical");
    const high = open.filter((r) => r.severity === "high");

    score -= critical.length * 25 + high.length * 10 + (open.length - critical.length - high.length) * 3;
    if (critical.length > 0 || high.length > 0) {
      findings.push({
        dimension: "risks",
        level: critical.length > 0 ? "critical" : "at_risk",
        evidence_entity_ids: [...critical, ...high].map((r) => r.id),
        message_i18n: {
          en: `${critical.length} critical and ${high.length} high severity risk(s) are open.`,
          es: `Hay ${critical.length} riesgo(s) críticos y ${high.length} altos abiertos.`,
        },
      });
    }

    dimensions.push({
      dimension: "risks",
      score: clampScore(score),
      level: (input.risks ?? []).length === 0 ? "unknown" : levelFromScore(clampScore(score)),
      findings,
    });
  }

  // ── Dependency health ─────────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;

    const blockingRfis = (input.rfis ?? []).filter(
      (r) => !r.deleted_at && r.blocks_task_id && RFI_BLOCKING_STATUSES.includes(r.status),
    );
    if (blockingRfis.length > 0) {
      score -= Math.min(40, blockingRfis.length * 15);
      findings.push({
        dimension: "dependencies",
        level: "at_risk",
        evidence_entity_ids: blockingRfis.map((r) => r.id),
        message_i18n: {
          en: `${blockingRfis.length} open RFI(s) block tasks.`,
          es: `${blockingRfis.length} RFI(s) abiertos bloquean tareas.`,
        },
      });
    }

    if (input.criticalPath && input.criticalPath.cycleTaskIds.length > 0) {
      score -= 30;
      findings.push({
        dimension: "dependencies",
        level: "critical",
        evidence_entity_ids: input.criticalPath.cycleTaskIds,
        message_i18n: {
          en: `${input.criticalPath.cycleTaskIds.length} task(s) form a dependency cycle.`,
          es: `${input.criticalPath.cycleTaskIds.length} tarea(s) forman un ciclo de dependencias.`,
        },
      });
    }

    dimensions.push({
      dimension: "dependencies",
      score: clampScore(score),
      level: levelFromScore(clampScore(score)),
      findings,
    });
  }

  // ── Critical path health ──────────────────────────────────────────────────
  {
    const findings: HealthFinding[] = [];
    let score = 100;
    if (!input.criticalPath) {
      dimensions.push({ dimension: "critical_path", score: 0, level: "unknown", findings });
    } else {
      const cp = input.criticalPath;
      const criticalBlocked = activeTasks.filter(
        (t) => cp.criticalTaskIds.includes(t.id) && (t.status === "blocked" || t.is_blocked),
      );
      if (criticalBlocked.length > 0) {
        score -= 60;
        findings.push({
          dimension: "critical_path",
          level: "critical",
          evidence_entity_ids: criticalBlocked.map((t) => t.id),
          message_i18n: {
            en: `${criticalBlocked.length} task(s) on the critical path are blocked.`,
            es: `${criticalBlocked.length} tarea(s) en la ruta crítica están bloqueadas.`,
          },
        });
      }
      const nearCritical = [...cp.tasks.values()].filter((t) => t.isNearCritical);
      if (nearCritical.length > 3) {
        score -= 15;
        findings.push({
          dimension: "critical_path",
          level: "at_risk",
          evidence_entity_ids: nearCritical.map((t) => t.taskId),
          message_i18n: {
            en: `${nearCritical.length} task(s) are near-critical (≤3 days of float).`,
            es: `${nearCritical.length} tarea(s) están casi críticas (≤3 días de holgura).`,
          },
        });
      }
      dimensions.push({
        dimension: "critical_path",
        score: clampScore(score),
        level: levelFromScore(clampScore(score)),
        findings,
      });
    }
  }

  // ── Overall ───────────────────────────────────────────────────────────────
  const known = dimensions.filter((d) => d.level !== "unknown");
  const overallScore =
    known.length > 0
      ? clampScore(known.reduce((s, d) => s + d.score, 0) / known.length)
      : 0;

  return {
    overall_level: known.length === 0 ? "unknown" : levelFromScore(overallScore),
    overall_score: overallScore,
    dimensions,
    findings: dimensions.flatMap((d) => d.findings),
  };
}

// ── Re-export readiness for service-level convenience ───────────────────────

export { calculateTaskReadiness };
export type { TaskReadinessContext };
