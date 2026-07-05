// ============================================================================
// GitHub Intelligence — software-project-type predicate (PURE, no imports)
// ============================================================================
// Kept framework-free so both the server-only guard and the (test-covered)
// webhook ingestion can share the same canonical rule without pulling in
// `server-only`. Canonical owner of project types: src/types/execution.ts.
// ============================================================================

import type { ProjectType } from "@/types/execution";

/** Canonical software project type. Only this type gets GitHub Intelligence. */
export const SOFTWARE_PROJECT_TYPE: ProjectType = "software_development";

export function isSoftwareProjectType(projectType: string | null | undefined): boolean {
  return projectType === SOFTWARE_PROJECT_TYPE;
}
