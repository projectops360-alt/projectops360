import type {
  PmoAccessContext,
  PmoHierarchyLevel,
  PmoProjectFact,
  PmoRollupRequest,
} from "./contracts";

export class PmoRollupAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PmoRollupAccessError";
  }
}

export function assertPmoRollupAccess(
  access: PmoAccessContext,
  request: PmoRollupRequest,
): void {
  if (!access.organizationId || access.organizationId !== request.organizationId) {
    throw new PmoRollupAccessError("Cross-organization PMO aggregation is not permitted.");
  }
  if (isAggregateLevel(request.hierarchyLevel) && access.scope !== "admin" && access.scope !== "pmo") {
    throw new PmoRollupAccessError("Organization, portfolio, and program aggregates require PMO or admin scope.");
  }
  if (request.hierarchyLevel === "project") {
    if (!request.entityId || !access.authorizedProjectIds.includes(request.entityId)) {
      throw new PmoRollupAccessError("The requested project is not authorized.");
    }
  }
}

export function filterAuthorizedProjects(
  projects: readonly PmoProjectFact[],
  access: PmoAccessContext,
  organizationId: string,
): PmoProjectFact[] {
  const allowed = new Set(access.authorizedProjectIds);
  return projects.filter((project) =>
    project.organizationId === organizationId && allowed.has(project.projectId));
}

export function canReadPmoFinancials(access: PmoAccessContext): boolean {
  return access.capabilities.includes("financial.view");
}

function isAggregateLevel(level: PmoHierarchyLevel): boolean {
  return level === "organization" || level === "portfolio" || level === "program";
}
