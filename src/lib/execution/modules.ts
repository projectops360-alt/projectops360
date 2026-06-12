// ============================================================================
// ProjectOps360° — Project Module Visibility
// ============================================================================
// Project type configures the experience without splitting the architecture:
// every module's tables and services always exist; per type we only decide
// which modules are emphasized, visible, or softened in navigation.
// ============================================================================

import type { ProjectType, ProjectModule } from "@/types/execution";
import type { Project } from "@/types/database";

/** Modules every project type gets, regardless of domain. */
const CORE_MODULES: ProjectModule[] = [
  "overview",
  "scope",
  "milestones",
  "tasks",
  "dependencies",
  "schedule",
  "critical_path",
  "resources",
  "people",
  "budget",
  "risks",
  "documents",
  "living_graph",
  "ai_recommendations",
  "reports",
];

const CONSTRUCTION_MODULES: ProjectModule[] = [
  "materials",
  "equipment",
  "rfis",
  "submittals",
  "inspections",
  "permits",
  "procurement",
  "drawing_intelligence",
  "labor_capacity",
];

/** Default visible modules per project type. */
export const DEFAULT_MODULES: Record<ProjectType, ProjectModule[]> = {
  software_development: [...CORE_MODULES, "materials"], // materials = tools & licenses
  data_center_construction: [...CORE_MODULES, ...CONSTRUCTION_MODULES],
  residential_construction: [...CORE_MODULES, ...CONSTRUCTION_MODULES],
  commercial_construction: [...CORE_MODULES, ...CONSTRUCTION_MODULES],
  infrastructure: [...CORE_MODULES, ...CONSTRUCTION_MODULES],
  industrial: [...CORE_MODULES, ...CONSTRUCTION_MODULES],
  general: [...CORE_MODULES, "materials", "procurement"],
};

/** Resolve the enabled modules for a project: explicit list wins,
 *  otherwise fall back to the project_type defaults. */
export function getEnabledModules(
  project: Pick<Project, "project_type" | "enabled_modules">,
): ProjectModule[] {
  if (project.enabled_modules && project.enabled_modules.length > 0) {
    return project.enabled_modules;
  }
  return DEFAULT_MODULES[project.project_type ?? "general"] ?? DEFAULT_MODULES.general;
}

export function isModuleEnabled(
  project: Pick<Project, "project_type" | "enabled_modules">,
  module: ProjectModule,
): boolean {
  return getEnabledModules(project).includes(module);
}
