// ============================================================================
// ProjectOps360° — Universal Task Readiness
// ============================================================================
// A task is ready only if its predecessors, owner, materials, RFIs,
// submittals, inspections, permits, and budget allow it to start.
// Works for every project type: a missing API key and a missing HVAC unit
// are both "material" blockers; an unstaffed task is an "assignment" blocker.
//
// Pure function over already-fetched data — callers batch-load per project.
// ============================================================================

import type {
  RoadmapTask,
  TaskDependency,
  MaterialRequirement,
  Rfi,
  Submittal,
  Inspection,
  Permit,
  ResourceAssignment,
  Resource,
  I18nField,
} from "@/types/database";
import { DEPENDENCY_COMPLETE_STATUSES } from "@/lib/roadmap/status-mappings";
import {
  RFI_BLOCKING_STATUSES,
  SUBMITTAL_APPROVED_STATUSES,
  MATERIAL_AVAILABLE_STATUSES,
  MATERIAL_IN_FLIGHT_STATUSES,
} from "./constants";

// ── Types ───────────────────────────────────────────────────────────────────

export type ReadinessBlockerType =
  | "predecessor"
  | "assignment"
  | "material"
  | "rfi"
  | "submittal"
  | "inspection"
  | "permit"
  | "budget"
  | "resource_unavailable";

export type BlockerSeverity = "low" | "medium" | "high" | "critical";

export interface ReadinessBlocker {
  type: ReadinessBlockerType;
  message_i18n: I18nField;
  severity: BlockerSeverity;
  linked_entity_id: string | null;
}

export interface RecommendedAction {
  action_i18n: I18nField;
  blocker_type: ReadinessBlockerType;
}

export interface TaskReadiness {
  task_id: string;
  readiness_score: number; // 0..1
  is_ready: boolean;
  blockers: ReadinessBlocker[];
  recommended_actions: RecommendedAction[];
}

export interface TaskReadinessContext {
  allTasks: Pick<RoadmapTask, "id" | "title" | "status">[];
  dependencies: Pick<TaskDependency, "predecessor_id" | "successor_id">[];
  materials?: Pick<
    MaterialRequirement,
    "id" | "name" | "status" | "required_by_task_id" | "required_by_date"
  >[];
  rfis?: Pick<Rfi, "id" | "subject" | "status" | "blocks_task_id">[];
  submittals?: Pick<Submittal, "id" | "title" | "status" | "required_before_task_id">[];
  inspections?: Pick<Inspection, "id" | "title" | "status" | "linked_task_id">[];
  permits?: Pick<Permit, "id" | "name" | "status" | "linked_task_id">[];
  assignments?: Pick<ResourceAssignment, "id" | "task_id" | "resource_id">[];
  resources?: Pick<Resource, "id" | "name" | "status">[];
}

// ── Checks ──────────────────────────────────────────────────────────────────

/** Each unmet check removes weight from the readiness score. */
const CHECK_WEIGHTS: Record<ReadinessBlockerType, number> = {
  predecessor: 0.25,
  assignment: 0.15,
  material: 0.2,
  rfi: 0.15,
  submittal: 0.1,
  inspection: 0.05,
  permit: 0.05,
  budget: 0.05,
  resource_unavailable: 0.15,
};

export function calculateTaskReadiness(
  task: Pick<
    RoadmapTask,
    "id" | "title" | "status" | "assigned_to" | "assigned_resource_id" | "budget_item_id" | "estimated_labor_hours"
  >,
  ctx: TaskReadinessContext,
): TaskReadiness {
  const blockers: ReadinessBlocker[] = [];
  const actions: RecommendedAction[] = [];
  const taskById = new Map(ctx.allTasks.map((t) => [t.id, t]));

  // 1. Predecessors complete
  for (const dep of ctx.dependencies) {
    if (dep.successor_id !== task.id) continue;
    const pred = taskById.get(dep.predecessor_id);
    if (pred && !DEPENDENCY_COMPLETE_STATUSES.includes(pred.status)) {
      blockers.push({
        type: "predecessor",
        severity: "high",
        linked_entity_id: pred.id,
        message_i18n: {
          en: `Predecessor "${pred.title}" is not complete (${pred.status}).`,
          es: `La tarea predecesora "${pred.title}" no está completa (${pred.status}).`,
        },
      });
    }
  }
  if (blockers.some((b) => b.type === "predecessor")) {
    actions.push({
      blocker_type: "predecessor",
      action_i18n: {
        en: "Complete or re-sequence the incomplete predecessor tasks.",
        es: "Completar o re-secuenciar las tareas predecesoras incompletas.",
      },
    });
  }

  // 2. Owner / assigned group exists
  const hasAssignment =
    !!task.assigned_to ||
    !!task.assigned_resource_id ||
    (ctx.assignments ?? []).some((a) => a.task_id === task.id);
  if (!hasAssignment) {
    blockers.push({
      type: "assignment",
      severity: "medium",
      linked_entity_id: null,
      message_i18n: {
        en: "Task has no owner or assigned group.",
        es: "La tarea no tiene responsable ni grupo asignado.",
      },
    });
    actions.push({
      blocker_type: "assignment",
      action_i18n: {
        en: "Assign an owner, team, or crew to this task.",
        es: "Asignar un responsable, equipo o cuadrilla a esta tarea.",
      },
    });
  }

  // 3. Assigned resources are available
  const resourceById = new Map((ctx.resources ?? []).map((r) => [r.id, r]));
  const assignedResourceIds = new Set<string>(
    (ctx.assignments ?? []).filter((a) => a.task_id === task.id).map((a) => a.resource_id),
  );
  if (task.assigned_resource_id) assignedResourceIds.add(task.assigned_resource_id);
  for (const rid of assignedResourceIds) {
    const res = resourceById.get(rid);
    if (res && (res.status === "unavailable" || res.status === "retired")) {
      blockers.push({
        type: "resource_unavailable",
        severity: "high",
        linked_entity_id: res.id,
        message_i18n: {
          en: `Assigned resource "${res.name}" is ${res.status}.`,
          es: `El recurso asignado "${res.name}" está ${res.status === "unavailable" ? "no disponible" : "retirado"}.`,
        },
      });
    }
  }

  // 4. Materials available or ordered in time
  for (const mat of ctx.materials ?? []) {
    if (mat.required_by_task_id !== task.id) continue;
    if (MATERIAL_AVAILABLE_STATUSES.includes(mat.status)) continue;
    if (MATERIAL_IN_FLIGHT_STATUSES.includes(mat.status)) continue; // on the way — soft ok
    blockers.push({
      type: "material",
      severity: mat.status === "unavailable" || mat.status === "delayed" ? "high" : "medium",
      linked_entity_id: mat.id,
      message_i18n: {
        en: `Required material "${mat.name}" is ${mat.status.replace(/_/g, " ")}.`,
        es: `El material requerido "${mat.name}" está en estado ${mat.status.replace(/_/g, " ")}.`,
      },
    });
  }
  if (blockers.some((b) => b.type === "material")) {
    actions.push({
      blocker_type: "material",
      action_i18n: {
        en: "Expedite procurement or adjust the task start date.",
        es: "Acelerar la compra o ajustar la fecha de inicio de la tarea.",
      },
    });
  }

  // 5. RFIs resolved
  for (const rfi of ctx.rfis ?? []) {
    if (rfi.blocks_task_id !== task.id) continue;
    if (!RFI_BLOCKING_STATUSES.includes(rfi.status)) continue;
    blockers.push({
      type: "rfi",
      severity: "high",
      linked_entity_id: rfi.id,
      message_i18n: {
        en: `Open RFI blocks this task: "${rfi.subject}".`,
        es: `Un RFI abierto bloquea esta tarea: "${rfi.subject}".`,
      },
    });
  }

  // 6. Submittals approved
  for (const sub of ctx.submittals ?? []) {
    if (sub.required_before_task_id !== task.id) continue;
    if (SUBMITTAL_APPROVED_STATUSES.includes(sub.status)) continue;
    blockers.push({
      type: "submittal",
      severity: "medium",
      linked_entity_id: sub.id,
      message_i18n: {
        en: `Submittal "${sub.title}" is not approved (${sub.status.replace(/_/g, " ")}).`,
        es: `El submittal "${sub.title}" no está aprobado (${sub.status.replace(/_/g, " ")}).`,
      },
    });
  }

  // 7. Inspections / permits
  for (const insp of ctx.inspections ?? []) {
    if (insp.linked_task_id !== task.id) continue;
    if (insp.status === "passed" || insp.status === "waived" || insp.status === "cancelled") continue;
    blockers.push({
      type: "inspection",
      severity: insp.status === "failed" ? "high" : "low",
      linked_entity_id: insp.id,
      message_i18n: {
        en: `Inspection "${insp.title}" is ${insp.status}.`,
        es: `La inspección "${insp.title}" está en estado ${insp.status}.`,
      },
    });
  }
  for (const permit of ctx.permits ?? []) {
    if (permit.linked_task_id !== task.id) continue;
    if (permit.status === "approved" || permit.status === "not_required") continue;
    blockers.push({
      type: "permit",
      severity: permit.status === "rejected" || permit.status === "expired" ? "critical" : "medium",
      linked_entity_id: permit.id,
      message_i18n: {
        en: `Permit "${permit.name}" is ${permit.status}.`,
        es: `El permiso "${permit.name}" está en estado ${permit.status}.`,
      },
    });
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  let score = 1;
  const seenTypes = new Set<ReadinessBlockerType>();
  for (const b of blockers) {
    if (seenTypes.has(b.type)) continue; // weight each failing check once
    seenTypes.add(b.type);
    score -= CHECK_WEIGHTS[b.type];
  }
  score = Math.max(0, Math.round(score * 100) / 100);

  return {
    task_id: task.id,
    readiness_score: score,
    is_ready: blockers.length === 0,
    blockers,
    recommended_actions: actions,
  };
}
