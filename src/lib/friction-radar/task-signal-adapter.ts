import { severityFromScore } from "./scoring";
import type { TaskFrictionEvidenceRow } from "./task-dataset";
import type {
  FrictionConfidence,
  FrictionEvidenceRef,
  FrictionSignal,
} from "./types";

const RESOURCE_INTERRUPTION_PATTERN =
  /reposo|m[eé]dic|ausen|vacation|leave|sick|illness|incapacit|resource unavailable/i;

function confidence(
  value: TaskFrictionEvidenceRow["observedStart"]["confidence"],
): FrictionConfidence {
  return value;
}

function evidenceRefs(input: {
  eventIds?: readonly string[];
  records?: readonly { table: string; id: string }[];
}): FrictionEvidenceRef[] {
  const refs = [
    ...(input.eventIds ?? []).map((id) => ({
      kind: "project_event_log",
      id,
    })),
    ...(input.records ?? []).map((record) => ({
      kind: record.table,
      id: record.id,
    })),
  ];
  return [...new Map(refs.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];
}

function signal(input: {
  row: TaskFrictionEvidenceRow;
  organizationId: string;
  suffix: string;
  signalType: string;
  category: FrictionSignal["category"];
  score: number;
  confidence: FrictionConfidence;
  observedValue: string | number | boolean | null;
  expectedOrBaseline: string | number | boolean | null;
  evidenceRefs: FrictionEvidenceRef[];
  evidenceTimestampStart?: string | null;
  evidenceTimestampEnd?: string | null;
  evidenceDescription: string;
  evidenceStatus: "confirmed" | "candidate";
}): FrictionSignal {
  return {
    signalId: `task:${input.row.taskId}:${input.suffix}`,
    organizationId: input.organizationId,
    projectId: input.row.projectId,
    source: "process_mining",
    signalType: input.signalType,
    category: input.category,
    entityType: "task",
    entityId: input.row.taskId,
    taskId: input.row.taskId,
    milestoneId: input.row.milestoneId,
    severity: severityFromScore(input.score),
    confidence: input.confidence,
    magnitude: input.score / 100,
    observedValue: input.observedValue,
    expectedOrBaseline: input.expectedOrBaseline,
    evidenceStatus: input.evidenceStatus,
    occurredAt: input.evidenceTimestampEnd ?? input.evidenceTimestampStart ?? null,
    evidenceTimestampStart: input.evidenceTimestampStart ?? null,
    evidenceTimestampEnd: input.evidenceTimestampEnd ?? null,
    evidenceDescription: input.evidenceDescription,
    evidenceRefs: input.evidenceRefs,
    metadata: {
      signalScore: input.score,
      evidenceStatus: input.evidenceStatus,
    },
  };
}

/**
 * Converts the corrected task evidence dataset into independent, traceable
 * signals. UNKNOWN and not-detected assessments are deliberately not promoted
 * into friction signals; they remain available on the task evidence row.
 */
export function frictionSignalsFromTaskEvidence(
  rows: readonly TaskFrictionEvidenceRow[],
  organizationId: string,
): FrictionSignal[] {
  const signals: FrictionSignal[] = [];

  for (const row of rows) {
    if (
      row.queueFriction.status === "candidate" &&
      row.queueFriction.queueTimeMs != null &&
      row.queueFriction.severityScore != null
    ) {
      signals.push(
        signal({
          row,
          organizationId,
          suffix: "queue",
          signalType: "queue_friction",
          category: "process",
          score: row.queueFriction.severityScore,
          confidence: confidence(row.queueFriction.confidence),
          observedValue: row.queueFriction.queueTimeMs,
          expectedOrBaseline: 8 * 60 * 60 * 1000,
          evidenceRefs: evidenceRefs({
            eventIds: row.queueFriction.evidenceEventIds,
            records: row.queueFriction.evidenceRecords,
          }),
          evidenceTimestampStart: row.plannedStart,
          evidenceTimestampEnd: row.observedStart.timestamp,
          evidenceDescription:
            "Observed work began after the planned-start variance threshold.",
          evidenceStatus: "candidate",
        }),
      );
    }

    if (row.rework.status !== "confirmed") continue;
    const reworkRefs = evidenceRefs({ eventIds: row.rework.evidenceEventIds });
    signals.push(
      signal({
        row,
        organizationId,
        suffix: "completed-reopened",
        signalType: "completed_then_reopened",
        category: "quality",
        score: 100,
        confidence: confidence(row.rework.confidence),
        observedValue: "completed_then_reopened",
        expectedOrBaseline: "completion_remains_terminal",
        evidenceRefs: reworkRefs,
        evidenceTimestampStart: row.rework.completedAt,
        evidenceTimestampEnd: row.rework.reopenedAt,
        evidenceDescription:
          "An explicit TaskCompleted event is followed by TaskReopened.",
        evidenceStatus: "confirmed",
      }),
    );

    if (row.rework.reopenedToState?.trim().toLowerCase() === "blocked") {
      signals.push(
        signal({
          row,
          organizationId,
          suffix: "process-interruption",
          signalType: "process_interruption",
          category: "process",
          score: 100,
          confidence: confidence(row.rework.confidence),
          observedValue: "done_to_blocked",
          expectedOrBaseline: "completion_remains_terminal",
          evidenceRefs: reworkRefs,
          evidenceTimestampStart: row.rework.completedAt,
          evidenceTimestampEnd: row.rework.reopenedAt,
          evidenceDescription:
            "The completed task was explicitly reopened into a blocked state.",
          evidenceStatus: "confirmed",
        }),
      );
    }

    if (
      row.isBlocked &&
      row.blockerReason != null &&
      RESOURCE_INTERRUPTION_PATTERN.test(row.blockerReason)
    ) {
      signals.push(
        signal({
          row,
          organizationId,
          suffix: "resource-interruption",
          signalType: "resource_interruption",
          category: "resource",
          score: 100,
          confidence: "high",
          observedValue: row.blockerReason,
          expectedOrBaseline: "assigned_resource_available",
          evidenceRefs: [
            ...reworkRefs,
            { kind: "roadmap_tasks", id: row.taskId, label: "blocker_reason" },
          ],
          evidenceTimestampStart: row.rework.completedAt,
          evidenceTimestampEnd: row.rework.reopenedAt,
          evidenceDescription:
            "The explicit blocker reason identifies a resource-availability interruption.",
          evidenceStatus: "confirmed",
        }),
      );
    }
  }

  return signals;
}
