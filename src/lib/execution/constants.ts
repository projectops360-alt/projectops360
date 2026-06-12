// ============================================================================
// ProjectOps360° — Universal Execution Constants
// ============================================================================
// Single source of truth for project types and universal status mapping.
// Module-specific statuses (TaskStatus, MaterialStatus, …) map into the
// universal set so health, reporting, and the Living Graph speak one language.
// ============================================================================

import type { TaskStatus, MilestoneStatusDisplay } from "@/types/database";
import type {
  ProjectType,
  UniversalStatus,
  MaterialStatus,
  RfiStatus,
  SubmittalStatus,
} from "@/types/execution";
import type { I18nField } from "@/types/database";

// ── Project types ───────────────────────────────────────────────────────────

export const PROJECT_TYPES: ProjectType[] = [
  "software_development",
  "data_center_construction",
  "residential_construction",
  "commercial_construction",
  "infrastructure",
  "industrial",
  "general",
];

export const PROJECT_TYPE_LABELS: Record<ProjectType, I18nField> = {
  software_development: { en: "Software Development", es: "Desarrollo de Software" },
  data_center_construction: { en: "Data Center Construction", es: "Construcción de Centro de Datos" },
  residential_construction: { en: "Residential Construction", es: "Construcción Residencial" },
  commercial_construction: { en: "Commercial Construction", es: "Construcción Comercial" },
  infrastructure: { en: "Infrastructure", es: "Infraestructura" },
  industrial: { en: "Industrial", es: "Industrial" },
  general: { en: "General", es: "General" },
};

/** Terminology hint: what "materials" means per project type. */
export const MATERIALS_TERMINOLOGY: Record<ProjectType, I18nField> = {
  software_development: { en: "Tools & Licenses", es: "Herramientas y Licencias" },
  data_center_construction: { en: "Materials & Equipment", es: "Materiales y Equipos" },
  residential_construction: { en: "Materials", es: "Materiales" },
  commercial_construction: { en: "Materials", es: "Materiales" },
  infrastructure: { en: "Materials", es: "Materiales" },
  industrial: { en: "Materials", es: "Materiales" },
  general: { en: "Materials & Resources", es: "Materiales y Recursos" },
};

// ── Universal status mapping ────────────────────────────────────────────────

/** Map AI-execution task statuses into universal project states.
 *  Per app convention "tested" counts as completed (DEPENDENCY_COMPLETE_STATUSES). */
export const TASK_TO_UNIVERSAL_STATUS: Record<TaskStatus, UniversalStatus> = {
  not_started: "planned",
  prompt_ready: "ready",
  sent_to_ai: "in_progress",
  in_progress: "in_progress",
  implemented: "in_progress",
  tested: "completed",
  done: "completed",
  blocked: "blocked",
  deferred: "deferred",
};

export const MILESTONE_TO_UNIVERSAL_STATUS: Record<MilestoneStatusDisplay, UniversalStatus> = {
  planned: "planned",
  in_progress: "in_progress",
  completed: "completed",
  blocked: "blocked",
  deferred: "deferred",
  at_risk: "at_risk",
};

export const MATERIAL_TO_UNIVERSAL_STATUS: Record<MaterialStatus, UniversalStatus> = {
  planned: "planned",
  required: "ready",
  requested: "in_progress",
  quoted: "in_progress",
  ordered: "in_progress",
  partially_delivered: "in_progress",
  delivered: "completed",
  installed: "completed",
  unavailable: "blocked",
  delayed: "at_risk",
  cancelled: "cancelled",
};

/** RFI statuses that block dependent work. */
export const RFI_BLOCKING_STATUSES: RfiStatus[] = ["draft", "open"];

/** Submittal statuses that satisfy a "required before task" gate. */
export const SUBMITTAL_APPROVED_STATUSES: SubmittalStatus[] = [
  "approved",
  "approved_as_noted",
  "closed",
];

/** Material statuses that satisfy a task material prerequisite. */
export const MATERIAL_AVAILABLE_STATUSES: MaterialStatus[] = [
  "delivered",
  "installed",
];

/** Material statuses that count as "on the way" (acceptable if it arrives in time). */
export const MATERIAL_IN_FLIGHT_STATUSES: MaterialStatus[] = [
  "ordered",
  "partially_delivered",
];

export function taskToUniversalStatus(status: TaskStatus): UniversalStatus {
  return TASK_TO_UNIVERSAL_STATUS[status] ?? "planned";
}
