// ============================================================================
// Project Import Intelligence — Validation Engine
// ============================================================================
// Validates a canonical import before anything is written: per-entity
// statuses (valid / needs_review / invalid / duplicate), job-level findings
// (info / warning / error / blocker), and post-analysis recommendations.
// Pure functions; bilingual messages.
// ============================================================================

import type {
  CanonicalImport,
  ImportValidationSeverity,
  ImportValidationStatus,
} from "@/types/import-intelligence";
import type { I18nField } from "@/types/database";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidationFinding {
  severity: ImportValidationSeverity;
  validation_type: string;
  message_i18n: I18nField;
  affected_entity_type: string | null;
  affected_source_id: string | null;
  recommended_action_i18n: I18nField | null;
}

export interface EntityValidation {
  entity_type: string;
  source_id: string;
  status: ImportValidationStatus;
  warnings: string[];
}

export interface ImportValidationReport {
  findings: ValidationFinding[];
  entityStatuses: Map<string, EntityValidation>; // key: `${entity_type}:${source_id}`
  hasBlockers: boolean;
  /** True when the critical path can be computed after import. */
  criticalPathReady: boolean;
  tasksMissingDuration: number;
}

const LOW_CONFIDENCE = 0.6;

function key(entityType: string, sourceId: string): string {
  return `${entityType}:${sourceId}`;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export function validateCanonicalImport(canonical: CanonicalImport): ImportValidationReport {
  const findings: ValidationFinding[] = [];
  const entityStatuses = new Map<string, EntityValidation>();

  const setStatus = (
    entityType: string,
    sourceId: string,
    status: ImportValidationStatus,
    warning?: string,
  ) => {
    const k = key(entityType, sourceId);
    const existing = entityStatuses.get(k) ?? { entity_type: entityType, source_id: sourceId, status: "valid" as ImportValidationStatus, warnings: [] };
    // Status escalation: valid < needs_review < duplicate < missing_required_data < invalid
    const rank: Record<ImportValidationStatus, number> = { valid: 0, needs_review: 1, duplicate: 2, missing_required_data: 3, invalid: 4 };
    if (rank[status] > rank[existing.status]) existing.status = status;
    if (warning) existing.warnings.push(warning);
    entityStatuses.set(k, existing);
  };

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const seenTaskNames = new Map<string, string>();
  let missingOwners = 0;
  let missingDurations = 0;

  for (const task of canonical.tasks) {
    setStatus("task", task.source_id, "valid");

    if (!task.name.trim()) {
      setStatus("task", task.source_id, "invalid", "missing_name");
      continue;
    }
    if (!task.assigned_to) {
      missingOwners++;
      setStatus("task", task.source_id, "needs_review", "missing_owner");
    }
    if (task.duration_days == null && !task.planned_finish) {
      missingDurations++;
      setStatus("task", task.source_id, "needs_review", "missing_duration");
    }
    if (task.confidence_score < LOW_CONFIDENCE) {
      setStatus("task", task.source_id, "needs_review", "low_confidence");
    }
    const nameKey = task.name.toLowerCase().trim();
    if (seenTaskNames.has(nameKey)) {
      setStatus("task", task.source_id, "duplicate", "duplicate_name");
      findings.push({
        severity: "warning",
        validation_type: "duplicate_task",
        message_i18n: {
          en: `Duplicate task name: "${task.name}".`,
          es: `Nombre de tarea duplicado: "${task.name}".`,
        },
        affected_entity_type: "task",
        affected_source_id: task.source_id,
        recommended_action_i18n: {
          en: "Review whether both rows should be imported.",
          es: "Revisa si ambas filas deben importarse.",
        },
      });
    } else {
      seenTaskNames.set(nameKey, task.source_id);
    }
  }

  if (missingOwners > 0) {
    findings.push({
      severity: "warning",
      validation_type: "missing_owners",
      message_i18n: {
        en: `${missingOwners} task(s) are missing owners. You can import them as needs review or assign owners now.`,
        es: `${missingOwners} tarea(s) no tienen responsable. Puedes importarlas como "por revisar" o asignar responsables ahora.`,
      },
      affected_entity_type: "task",
      affected_source_id: null,
      recommended_action_i18n: {
        en: "Assign owners after import from the Workboard.",
        es: "Asigna responsables después de importar desde el Workboard.",
      },
    });
  }

  // ── Dependencies ───────────────────────────────────────────────────────────
  const taskIds = new Set(canonical.tasks.map((t) => t.source_id));
  for (const dep of canonical.dependencies) {
    const depKey = `${dep.predecessor_source_id}→${dep.successor_source_id}`;
    setStatus("dependency", depKey, dep.inferred ? "needs_review" : "valid", dep.inferred ? "inferred_from_text" : undefined);
    if (!taskIds.has(dep.predecessor_source_id) || !taskIds.has(dep.successor_source_id)) {
      setStatus("dependency", depKey, "invalid", "unresolved_reference");
    }
  }

  // Circular dependency check (DFS over canonical graph)
  const cycles = findCycle(canonical.dependencies.map((d) => [d.predecessor_source_id, d.successor_source_id]));
  if (cycles) {
    findings.push({
      severity: "blocker",
      validation_type: "circular_dependency",
      message_i18n: {
        en: `Circular dependency detected involving "${cycles.join('" → "')}". Fix the cycle before importing dependencies.`,
        es: `Dependencia circular detectada entre "${cycles.join('" → "')}". Corrige el ciclo antes de importar las dependencias.`,
      },
      affected_entity_type: "dependency",
      affected_source_id: null,
      recommended_action_i18n: {
        en: "Disable one of the dependencies in the cycle.",
        es: "Desactiva una de las dependencias del ciclo.",
      },
    });
  }

  // ── Materials ──────────────────────────────────────────────────────────────
  for (const mat of canonical.materials) {
    setStatus("material", mat.source_id, "valid");
    if (!mat.name.trim()) {
      setStatus("material", mat.source_id, "invalid", "missing_name");
      continue;
    }
    if (mat.quantity != null && !mat.unit) {
      setStatus("material", mat.source_id, "needs_review", "quantity_without_unit");
    }
    if (mat.confidence_score < LOW_CONFIDENCE) {
      setStatus("material", mat.source_id, "needs_review", "low_confidence");
    }
  }

  // ── Budget / risks / resources / milestones ────────────────────────────────
  for (const b of canonical.budget_items) {
    setStatus("budget_item", b.source_id, b.estimated_cost == null ? "needs_review" : "valid", b.estimated_cost == null ? "missing_estimate" : undefined);
  }
  for (const r of canonical.risks) {
    setStatus("risk", r.source_id, r.title.trim() ? "valid" : "invalid");
  }
  for (const r of canonical.resources) {
    setStatus("resource", r.source_id, "valid");
  }
  const seenMilestones = new Set<string>();
  for (const m of canonical.milestones) {
    const mk = m.name.toLowerCase().trim();
    setStatus("milestone", m.source_id, seenMilestones.has(mk) ? "duplicate" : "valid");
    seenMilestones.add(mk);
  }

  // ── Project-level ──────────────────────────────────────────────────────────
  if (canonical.tasks.length === 0 && canonical.milestones.length === 0) {
    findings.push({
      severity: "error",
      validation_type: "no_entities",
      message_i18n: {
        en: "No tasks or milestones could be extracted from this file.",
        es: "No se pudieron extraer tareas ni hitos de este archivo.",
      },
      affected_entity_type: null,
      affected_source_id: null,
      recommended_action_i18n: {
        en: "Check that the file contains a task table with recognizable column headers.",
        es: "Verifica que el archivo contenga una tabla de tareas con encabezados reconocibles.",
      },
    });
  }

  // ── Critical path readiness ────────────────────────────────────────────────
  const criticalPathReady =
    canonical.tasks.length > 0 &&
    missingDurations === 0 &&
    canonical.dependencies.length > 0 &&
    !cycles;
  if (canonical.tasks.length > 0 && missingDurations > 0) {
    findings.push({
      severity: "info",
      validation_type: "critical_path_incomplete",
      message_i18n: {
        en: `Critical path can be calculated after import, but ${missingDurations} task(s) are missing duration estimates.`,
        es: `La ruta crítica puede calcularse después de importar, pero ${missingDurations} tarea(s) no tienen duración estimada.`,
      },
      affected_entity_type: "task",
      affected_source_id: null,
      recommended_action_i18n: {
        en: "Add durations to those tasks for a complete critical path.",
        es: "Agrega duraciones a esas tareas para una ruta crítica completa.",
      },
    });
  }

  return {
    findings,
    entityStatuses,
    hasBlockers: findings.some((f) => f.severity === "blocker"),
    criticalPathReady,
    tasksMissingDuration: missingDurations,
  };
}

// ── Cycle detection ─────────────────────────────────────────────────────────

/** Returns the node path of the first cycle found, or null. */
export function findCycle(edges: [string, string][]): string[] | null {
  const successors = new Map<string, string[]>();
  for (const [from, to] of edges) {
    if (!successors.has(from)) successors.set(from, []);
    successors.get(from)!.push(to);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();

  function dfs(node: string, path: string[]): string[] | null {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      return path.slice(start).concat(node);
    }
    if (done.has(node)) return null;
    visiting.add(node);
    for (const next of successors.get(node) ?? []) {
      const cycle = dfs(next, [...path, node]);
      if (cycle) return cycle;
    }
    visiting.delete(node);
    done.add(node);
    return null;
  }

  for (const node of successors.keys()) {
    const cycle = dfs(node, []);
    if (cycle) return cycle;
  }
  return null;
}

// ── Post-import recommendations (deterministic) ─────────────────────────────

export interface ImportRecommendation {
  type: string;
  message_i18n: I18nField;
}

export function generateImportRecommendations(canonical: CanonicalImport): ImportRecommendation[] {
  const recs: ImportRecommendation[] = [];
  const noOwner = canonical.tasks.filter((t) => !t.assigned_to).length;
  const noDuration = canonical.tasks.filter((t) => t.duration_days == null).length;
  const noDeps = canonical.tasks.length > 1 && canonical.dependencies.length === 0;
  const noBudget = canonical.tasks.length > 0 && canonical.budget_items.length === 0;
  const lowConfidence = canonical.tasks.filter((t) => t.confidence_score < LOW_CONFIDENCE).length;

  if (noOwner > 0) {
    recs.push({
      type: "add_missing_owners",
      message_i18n: {
        en: `Assign owners to ${noOwner} imported task(s) without a responsible person.`,
        es: `Asigna responsables a ${noOwner} tarea(s) importadas sin persona responsable.`,
      },
    });
  }
  if (noDuration > 0) {
    recs.push({
      type: "add_missing_durations",
      message_i18n: {
        en: `Add duration estimates to ${noDuration} task(s) so the critical path is complete.`,
        es: `Agrega duraciones estimadas a ${noDuration} tarea(s) para completar la ruta crítica.`,
      },
    });
  }
  if (noDeps) {
    recs.push({
      type: "add_missing_dependencies",
      message_i18n: {
        en: "No dependencies were detected. Add task dependencies to enable critical path analysis.",
        es: "No se detectaron dependencias. Agrega dependencias entre tareas para habilitar el análisis de ruta crítica.",
      },
    });
  }
  if (noBudget) {
    recs.push({
      type: "add_budget",
      message_i18n: {
        en: "No budget lines were found. Connect imported tasks to budget items.",
        es: "No se encontraron partidas de presupuesto. Conecta las tareas importadas a partidas de presupuesto.",
      },
    });
  }
  if (lowConfidence > 0) {
    recs.push({
      type: "review_low_confidence",
      message_i18n: {
        en: `Review ${lowConfidence} low-confidence extracted task(s).`,
        es: `Revisa ${lowConfidence} tarea(s) extraídas con baja confianza.`,
      },
    });
  }
  recs.push({
    type: "confirm_project_type",
    message_i18n: {
      en: "Confirm the detected project type and enabled modules.",
      es: "Confirma el tipo de proyecto detectado y los módulos habilitados.",
    },
  });
  return recs;
}
