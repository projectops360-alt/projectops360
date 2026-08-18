import type { Locale } from "@/types/database";
import { loadMilestoneFlowProjection } from "@/lib/milestone-flow-ui/load-projection";
import { buildFrictionRadarReadModel } from "./read-model";
import { frictionSignalsFromMpfProjection } from "./mpf-adapter";
import { buildTaskFrictionEvidenceDataset, type TaskFrictionEvidenceRow } from "./task-dataset";
import { frictionSignalsFromTaskEvidence } from "./task-signal-adapter";
import { loadTaskFrictionSourcesFromProduction, type FrictionSourceAudit } from "./load-task-production";
import { mergeFrictionSignals } from "./merge-signals";
import { frictionSignalsFromOperationalEvidence } from "./operational-signal-adapter";
import { partitionEvidenceCompleteSignals } from "./evidence-contract";
import type { FrictionRadarReadModel, FrictionSignal, FrictionSignalGap } from "./types";

export interface FrictionEvidenceTimelineEvent {
  eventId: string;
  eventType: string;
  occurredAt: string | null;
  recordedAt: string | null;
  sequenceNumber: number;
  fromState: string | null;
  toState: string | null;
}

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
      signalGaps: FrictionSignalGap[];
      milestones: Array<{ id: string; title: string }>;
      evidenceEvents: FrictionEvidenceTimelineEvent[];
      rejectedEvidenceCount: number;
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
  const analysisTimestamp = new Date().toISOString();
  const taskEvidence = taskSources.status === "ok"
    ? buildTaskFrictionEvidenceDataset({
        tasks: taskSources.sources.tasks,
        events: taskSources.sources.events,
        timeEntries: taskSources.sources.timeEntries,
        dependencies: taskSources.sources.dependencies,
        resources: taskSources.sources.resources,
        resourceAssignments: taskSources.sources.resourceAssignments,
        resourceProfiles: taskSources.sources.resourceProfiles,
        analysisTimestamp,
      })
    : [];
  const taskSignals = taskSources.status === "ok"
    ? frictionSignalsFromTaskEvidence(
        taskEvidence,
        taskSources.sources.organizationId,
      )
    : [];
  const operational = taskSources.status === "ok"
    ? frictionSignalsFromOperationalEvidence({
        organizationId: taskSources.sources.organizationId,
        projectId,
        tasks: taskEvidence,
        milestones: taskSources.sources.milestones,
        resourceAssignments: taskSources.sources.resourceAssignments,
        resourceWorkloadSnapshots: taskSources.sources.resourceWorkloadSnapshots,
        risks: taskSources.sources.risks,
        decisions: taskSources.sources.decisions,
        budgetItems: taskSources.sources.budgetItems,
        costActuals: taskSources.sources.costActuals,
        financialMeasurements: taskSources.sources.financialMeasurements,
        financialCockpit: taskSources.sources.financialCockpit,
        criticalPathSnapshots: taskSources.sources.criticalPathSnapshots,
        analysisTimestamp,
      })
    : { signals: [], gaps: [] };
  const mergedSignals = mergeFrictionSignals(
    mpfSignals,
    taskSignals,
    operational.signals,
  );
  const evidencePartition = partitionEvidenceCompleteSignals(mergedSignals);
  const signals = evidencePartition.complete;
  const evidenceEventIds = new Set(
    signals.flatMap((signal) =>
      signal.evidenceRefs
        .filter((ref) => ref.kind === "project_event_log")
        .map((ref) => ref.id),
    ),
  );
  const evidenceEvents = taskSources.status === "ok"
    ? taskSources.sources.events
        .filter((event) => evidenceEventIds.has(event.eventId))
        .map((event) => ({
          eventId: event.eventId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          recordedAt: event.recordedAt,
          sequenceNumber: event.sequenceNumber,
          fromState: event.fromState,
          toState: event.toState,
        }))
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    : [];
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
    signalGaps: operational.gaps,
    milestones: taskSources.status === "ok"
      ? taskSources.sources.milestones.map((milestone) => ({ id: milestone.id, title: milestone.title }))
      : [],
    evidenceEvents,
    rejectedEvidenceCount: evidencePartition.rejected.length,
    taskEvidence,
    sourceAudit: taskSources.status === "ok" ? taskSources.sources.sourceAudit : [],
    limitations: [
      ...(mpf.status === "error" ? ["mpf:read_error"] : []),
      ...(taskSources.status === "ok" ? taskSources.sources.limitations : ["task_sources:read_error"]),
      ...evidencePartition.rejected.map(
        (assessment) => `signal:${assessment.signalId}:incomplete_evidence_contract`,
      ),
    ],
    radar,
  };
}
