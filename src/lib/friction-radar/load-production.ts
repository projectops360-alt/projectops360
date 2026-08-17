import type { Locale } from "@/types/database";
import { loadMilestoneFlowProjection } from "@/lib/milestone-flow-ui/load-projection";
import { buildFrictionRadarReadModel } from "./read-model";
import { frictionSignalsFromMpfProjection } from "./mpf-adapter";
import type { FrictionRadarReadModel } from "./types";

export type FrictionRadarLoadResult =
  | {
      status: "ok";
      projectTitle: string;
      milestoneCount: number;
      eventCount: number;
      signalCount: number;
      radar: FrictionRadarReadModel;
    }
  | { status: "unauthorized" }
  | { status: "error" };

/**
 * Production-safe read path.
 *
 * Reuses the existing authenticated/RLS-scoped MPF loader, which SELECTs the
 * canonical project, milestones, project_event_log and project_event_objects.
 * Friction Radar only consumes the resulting derived MPF projection. No writes,
 * no service-role bypass, no second event store and no canonical mutation.
 */
export async function loadFrictionRadarFromProduction(
  projectId: string,
  locale: Locale,
): Promise<FrictionRadarLoadResult> {
  const mpf = await loadMilestoneFlowProjection(projectId, locale);
  if (mpf.status !== "ok") return mpf;

  const signals = frictionSignalsFromMpfProjection(mpf.projection);
  const radar = buildFrictionRadarReadModel(
    mpf.projection.scope.organizationId,
    mpf.projection.scope.projectId,
    signals,
  );

  return {
    status: "ok",
    projectTitle: mpf.projectTitle,
    milestoneCount: mpf.milestoneCount,
    eventCount: mpf.eventCount,
    signalCount: signals.length,
    radar,
  };
}
