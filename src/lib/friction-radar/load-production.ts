import type { Locale } from "@/types/database";
import { loadMilestoneFlowProjection } from "@/lib/milestone-flow-ui/load-projection";
import { buildFrictionRadarReadModel } from "./read-model";
import { frictionSignalsFromMpfProjection } from "./mpf-adapter";
import { buildTaskFrictionEvidenceDataset, type TaskFrictionEvidenceRow } from "./task-dataset";
import { frictionSignalsFromTaskEvidence } from "./task-signal-adapter";
import { loadTaskFrictionSourcesFromProduction, type FrictionSourceAudit } from "./load-task-production";
import { mergeFrictionSignals } from "./merge-signals";
import type { FrictionRadarReadModel, FrictionSignal } from "./types";

export type FrictionRadarLoadResult =
  | {
      status: "ok";
      projectTitle: string;
      milestoneCount: number;
      eventCount: number;
      taskCount: number;
      dependencyCount: number;
      timeEntryCount: number;
      signalCount: number;
      signals: FrictionSignal[];
      taskEvidence: TaskFrictionEvidenceRow[];
      sourceAudit: FrictionSourceAudit[];
      limitations: string[];
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
  const [mpf, taskSources] = await Promise.all([
    loadMilestoneFlowProjection(projectId, locale),
    loadTaskFrictionSourcesFromProduction(projectId),
  ]);
  if (mpf.status === "unauthorized" || taskSources.status === "unauthorized") {
    return { status: "unauthorized" };
  }
  if (mpf.status !== "ok" && taskSources.status !== "ok") {
    return { status: "error" };
  }

  const mpfSignals = mpf.status === "ok"
    ? frictionSignalsFromMpfProjection(mpf.projection)
    : [];
  const taskEvidence = taskSources.status === "ok"
    ? buildTaskFrictionEvidenceDataset({
        tasks: taskSources.sources.tasks,
        events: taskSources.sources.events,
        timeEntries: taskSources.sources.timeEntries,
        dependencies: taskSources.sources.dependencies,
        resources: taskSources.sources.resources,
        resourceAssignments: taskSources.sources.resourceAssignments,
        resourceProfiles: taskSources.sources.resourceProfiles,
        analysisTimestamp: new Date().toISOString(),
      })
    : [];
  const taskSignals = taskSources.status === "ok"
    ? frictionSignalsFromTaskEvidence(
        taskEvidence,
        taskSources.sources.organizationId,
      )
    : [];
  const signals = mergeFrictionSignals(mpfSignals, taskSignals);
  const organizationId = taskSources.status === "ok"
    ? taskSources.sources.organizationId
    : mpf.status === "ok"
      ? mpf.projection.scope.organizationId
      : "";
  const radar = buildFrictionRadarReadModel(
    organizationId,
    projectId,
    signals,
  );

  return {
    status: "ok",
    projectTitle: mpf.status === "ok"
      ? mpf.projectTitle
      : taskSources.status === "ok"
        ? taskSources.sources.projectTitle
        : projectId,
    milestoneCount: mpf.status === "ok" ? mpf.milestoneCount : 0,
    eventCount: taskSources.status === "ok"
      ? taskSources.sources.events.length
      : mpf.status === "ok"
        ? mpf.eventCount
        : 0,
    taskCount: taskSources.status === "ok" ? taskSources.sources.tasks.length : 0,
    dependencyCount: taskSources.status === "ok"
      ? taskSources.sources.dependencies.length
      : 0,
    timeEntryCount: taskSources.status === "ok"
      ? taskSources.sources.timeEntries.length
      : 0,
    signalCount: signals.length,
    signals,
    taskEvidence,
    sourceAudit: taskSources.status === "ok" ? taskSources.sources.sourceAudit : [],
    limitations: [
      ...(mpf.status === "error" ? ["mpf:read_error"] : []),
      ...(taskSources.status === "ok" ? taskSources.sources.limitations : ["task_sources:read_error"]),
    ],
    radar,
  };
}
