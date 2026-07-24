// ============================================================================
// PMO Process Intelligence — overlays read adapter (CAP-047 · M6)
// ============================================================================
// Read-only loads for the risk / dependency / capacity overlays. Risks and
// dependencies come from RLS-scoped SELECTs + the org barrier; capacity
// reuses the canonical engine (lib/capacity) per project — no duplicate
// capacity math. Never writes.
// ============================================================================

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { computeResourceCapacity } from "@/lib/capacity/service";
import type { OrgContext } from "@/lib/auth";
import {
  buildRiskOverlay,
  buildDependencyOverlay,
  type PmoPiRiskInput,
  type PmoPiDependencyInput,
  type PmoPiRiskOverlay,
  type PmoPiDependencyOverlay,
  type PmoPiCapacityProjectSummary,
} from "./overlays";
import { scopeToProjects } from "./scope";

export interface PmoPiOverlaysData {
  risk: PmoPiRiskOverlay;
  dependencies: PmoPiDependencyOverlay;
  capacity: PmoPiCapacityProjectSummary[];
}

export async function loadPmoPiOverlays(
  org: OrgContext,
  projectIds: readonly string[],
): Promise<PmoPiOverlaysData | null> {
  if (projectIds.length === 0) {
    return {
      risk: buildRiskOverlay([], []),
      dependencies: buildDependencyOverlay([]),
      capacity: [],
    };
  }
  const supabase = await createClient();

  const [risksRes, depsRes] = await Promise.all([
    supabase
      .from("risks")
      .select("id, project_id, title, category, probability, impact, severity, status, linked_task_id")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds as string[])
      .is("deleted_at", null),
    supabase
      .from("task_dependencies")
      .select("project_id, predecessor_id, successor_id")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds as string[]),
  ]);
  if (risksRes.error || depsRes.error) return null;

  const risks: PmoPiRiskInput[] = scopeToProjects(
    (risksRes.data ?? []).map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      title: r.title as string,
      category: (r.category as string) ?? "other",
      probability: (r.probability as string) ?? "medium",
      impact: (r.impact as string) ?? "medium",
      severity: (r.severity as string) ?? "medium",
      status: (r.status as string) ?? "open",
      linkedTaskId: (r.linked_task_id as string | null) ?? null,
    })),
    projectIds,
  );
  const deps: PmoPiDependencyInput[] = scopeToProjects(
    (depsRes.data ?? []).map((d) => ({
      projectId: d.project_id as string,
      predecessorId: d.predecessor_id as string,
      successorId: d.successor_id as string,
    })),
    projectIds,
  );

  // Capacity: reuse the canonical engine per project (read-only).
  const capacity: PmoPiCapacityProjectSummary[] = [];
  for (const projectId of projectIds) {
    try {
      const result = await computeResourceCapacity(org, projectId);
      capacity.push({
        projectId,
        hasCapacityInputs: result.hasCapacityInputs,
        workforceAvailabilityPercent: result.totals.workforceAvailabilityPercent,
        overallocatedResourceCount: result.totals.overallocatedResourceCount,
        atRiskMilestoneCount: result.totals.atRiskMilestoneCount,
        unassignedCriticalTaskCount: result.totals.unassignedCriticalTaskCount,
      });
    } catch (err) {
      console.error("[pmo-pi] capacity read failed for project", projectId, err);
    }
  }

  return {
    risk: buildRiskOverlay(risks, deps),
    dependencies: buildDependencyOverlay(deps),
    capacity,
  };
}
