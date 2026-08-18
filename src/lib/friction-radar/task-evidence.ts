// ============================================================================
// ProjectOps360° — Friction Radar task evidence qualification (read-only)
// ============================================================================
// Pure evidence qualification. This module never writes data and never turns
// missing events into operational facts.
// ============================================================================

import type { LivingGraphCanonicalEvent } from "@/types/living-graph";

export type FrictionEvidenceConfidence = "high" | "medium" | "low" | "unknown";
export type EvidenceAssessmentStatus = "not_detected" | "candidate" | "unknown";

export interface QualifiedBusinessTime {
  timestamp: string | null;
  confidence: FrictionEvidenceConfidence;
  durationEligible: boolean;
  reason: string;
}

export type ObservedStartSource =
  | "time_entry_work_date"
  | "event_work_date"
  | "event_business_time"
  | "unknown";

export interface TaskWorkDateEvidence {
  id: string;
  workDate: string;
  deletedAt?: string | null;
}

export interface ObservedTaskStart {
  status: "observed" | "insufficient_evidence";
  timestamp: string | null;
  eventId: string | null;
  eventType: string | null;
  sourceRecordId: string | null;
  source: ObservedStartSource;
  confidence: FrictionEvidenceConfidence;
  reason: string;
}

export interface QueueFrictionAssessment {
  status: EvidenceAssessmentStatus;
  queueTimeMs: number | null;
  severityScore: number | null;
  confidence: FrictionEvidenceConfidence;
  evidenceEventIds: string[];
  evidenceRecords: EvidenceRecordRef[];
  reason: string;
}

export interface EvidenceRecordRef {
  table: "project_event_log" | "subtask_time_entries";
  id: string;
}

export interface TaskTemporalConsistencyAssessment {
  status: "consistent" | "conflict" | "insufficient_evidence";
  confidence: FrictionEvidenceConfidence;
  firstOperationalWorkAt: string | null;
  lastOperationalWorkAt: string | null;
  maxBoundaryGapMs: number | null;
  evidenceEventIds: string[];
  evidenceRecords: EvidenceRecordRef[];
  reason: string;
}

export interface QualifiedElapsedDuration {
  durationMs: number | null;
  status: "qualified" | "temporal_conflict" | "insufficient_evidence";
  reason: string;
}

const MEANINGFUL_WORK_EVENTS = new Set([
  "TaskStarted",
  "TaskImplemented",
  "TaskTested",
  "TaskResumed",
  "TimeLogged",
  "SubtaskStarted",
  "SubtaskCompleted",
  "SubtaskProgressChanged",
]);

const ACTIVE_TASK_STATES = new Set([
  "active",
  "doing",
  "in_progress",
  "in-progress",
  "implemented",
  "testing",
  "review",
  "prompt_ready",
]);

const UNTRUSTED_CAPTURE_METHODS = new Set([
  "import",
  "imported",
  "backfill",
  "backfilled",
  "ai_extracted",
]);

const TRUSTED_CAPTURE_METHODS = new Set(["direct", "system"]);

const DURATION_BOUNDARY_EVENTS = new Set([
  "TaskStarted",
  "TaskResumed",
  "TaskImplemented",
  "TaskTested",
  "TaskCompleted",
  "TaskReopened",
  "TaskStatusChanged",
]);

const DEFAULT_OPERATIONAL_CONFLICT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

function validIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function dateOnlyTimestamp(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function normalizedCaptureMethod(event: LivingGraphCanonicalEvent): string {
  return (event.captureMethod ?? "").trim().toLowerCase();
}

function hasDataQualityFlag(
  event: LivingGraphCanonicalEvent,
  pattern: RegExp,
): boolean {
  return event.dataQualityFlags.some((flag) => pattern.test(flag));
}

function evidenceRecordsForObservedStart(
  observedStart: ObservedTaskStart,
): EvidenceRecordRef[] {
  if (!observedStart.sourceRecordId) return [];
  return [
    {
      table:
        observedStart.source === "time_entry_work_date"
          ? "subtask_time_entries"
          : "project_event_log",
      id: observedStart.sourceRecordId,
    },
  ];
}

/**
 * Qualifies event time for elapsed-duration calculations.
 *
 * occurredAt remains useful for deterministic ordering even when imported, but
 * imported/backfilled timestamps are not accepted as proof of business elapsed
 * time. recordedAt is deliberately never substituted for business time.
 */
export function qualifyEventBusinessTime(
  event: LivingGraphCanonicalEvent,
): QualifiedBusinessTime {
  const payloadWorkDate = event.payload?.work_date ?? event.payload?.workDate;
  if (event.eventType === "TimeLogged" && validDateOnly(payloadWorkDate)) {
    return {
      timestamp: dateOnlyTimestamp(payloadWorkDate),
      confidence: "medium",
      durationEligible: false,
      reason: "event_work_date_requires_current_entry_verification",
    };
  }

  if (!validIso(event.occurredAt)) {
    return {
      timestamp: null,
      confidence: "unknown",
      durationEligible: false,
      reason: "missing_or_invalid_occurred_at",
    };
  }

  const captureMethod = normalizedCaptureMethod(event);
  const isReconstructed =
    event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT" ||
    UNTRUSTED_CAPTURE_METHODS.has(captureMethod) ||
    event.dataQualityFlags.some((flag) =>
      /backfill|import|reconstruct|synthetic|business_time_unknown/i.test(flag),
    );

  if (isReconstructed) {
    return {
      timestamp: event.occurredAt,
      confidence: "low",
      durationEligible: false,
      reason: "capture_time_not_proven_as_business_time",
    };
  }

  if (!TRUSTED_CAPTURE_METHODS.has(captureMethod)) {
    return {
      timestamp: event.occurredAt,
      confidence: "low",
      durationEligible: false,
      reason: "capture_method_missing_or_unqualified",
    };
  }


  if (hasDataQualityFlag(event, /mapping_low_confidence/i)) {
    return {
      timestamp: event.occurredAt,
      confidence: "low",
      durationEligible: false,
      reason: "mapping_low_confidence",
    };
  }

  if (event.lateRecorded) {
    return {
      timestamp: event.occurredAt,
      confidence: "medium",
      durationEligible: false,
      reason: "late_recorded_event_requires_corroborating_business_time",
    };
  }

  return {
    timestamp: event.occurredAt,
    confidence: "high",
    durationEligible: true,
    reason: "native_business_time",
  };
}

export function isMeaningfulTaskWorkEvent(
  event: LivingGraphCanonicalEvent,
): boolean {
  if (MEANINGFUL_WORK_EVENTS.has(event.eventType)) return true;
  return (
    event.eventType === "TaskStatusChanged" &&
    event.toState != null &&
    ACTIVE_TASK_STATES.has(event.toState.trim().toLowerCase())
  );
}

/**
 * Finds the first observable work evidence. Absence of TaskStarted is never
 * interpreted as waiting: any valid work-bearing event may establish a start.
 */
export function deriveObservedTaskStart(
  events: readonly LivingGraphCanonicalEvent[],
  timeEntries: readonly TaskWorkDateEvidence[] = [],
): ObservedTaskStart {
  const currentEntries = timeEntries
    .filter((entry) => entry.deletedAt == null && validDateOnly(entry.workDate))
    .sort(
      (a, b) =>
        Date.parse(dateOnlyTimestamp(a.workDate)) -
          Date.parse(dateOnlyTimestamp(b.workDate)) ||
        a.id.localeCompare(b.id),
    );
  const eventCandidates = events
    .filter(isMeaningfulTaskWorkEvent)
    .map((event) => ({ event, time: qualifyEventBusinessTime(event) }))
    // A current time-entry row supersedes the historical TimeLogged payload.
    // Comparing both would re-introduce corrected/deleted work dates.
    .filter(
      (candidate) =>
        currentEntries.length === 0 || candidate.event.eventType !== "TimeLogged",
    )
    .filter((candidate) => candidate.time.timestamp != null)
    .map((candidate) => ({
      timestamp: candidate.time.timestamp!,
      eventId: candidate.event.eventId,
      eventType: candidate.event.eventType,
      sourceRecordId: candidate.event.eventId,
      source:
        candidate.time.reason ===
        "event_work_date_requires_current_entry_verification"
          ? ("event_work_date" as const)
          : ("event_business_time" as const),
      confidence: candidate.time.confidence,
      reason: candidate.time.reason,
      sequenceNumber: candidate.event.sequenceNumber,
    }));

  const entryCandidates = currentEntries.map((entry) => ({
    timestamp: dateOnlyTimestamp(entry.workDate),
    eventId: null,
    eventType: "TimeLogged",
    sourceRecordId: entry.id,
    source: "time_entry_work_date" as const,
    confidence: "high" as const,
    reason: "current_time_entry_work_date",
    sequenceNumber: Number.MAX_SAFE_INTEGER,
  }));

  const candidates = [...entryCandidates, ...eventCandidates].sort((a, b) => {
    const byTime = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    return byTime || a.sequenceNumber - b.sequenceNumber;
  });

  const first = candidates[0];
  if (!first) {
    return {
      status: "insufficient_evidence",
      timestamp: null,
      eventId: null,
      eventType: null,
      sourceRecordId: null,
      source: "unknown",
      confidence: "unknown",
      reason: "no_meaningful_work_event",
    };
  }

  return {
    status: "observed",
    timestamp: first.timestamp,
    eventId: first.eventId,
    eventType: first.eventType,
    sourceRecordId: first.sourceRecordId,
    source: first.source,
    confidence: first.confidence,
    reason: first.reason,
  };
}

function immediatelyReversedByLowConfidenceMapping(input: {
  observedStart: ObservedTaskStart;
  events: readonly LivingGraphCanonicalEvent[];
  reversalWindowMs?: number;
}): LivingGraphCanonicalEvent | null {
  if (!input.observedStart.eventId || !validIso(input.observedStart.timestamp)) {
    return null;
  }
  const windowMs = input.reversalWindowMs ?? 5 * 60 * 1000;
  const startMs = Date.parse(input.observedStart.timestamp);
  return (
    input.events.find((event) => {
      if (
        event.eventId === input.observedStart.eventId ||
        !validIso(event.occurredAt) ||
        event.eventType !== "TaskStatusChanged" ||
        !hasDataQualityFlag(event, /mapping_low_confidence/i)
      ) {
        return false;
      }
      const elapsed = Date.parse(event.occurredAt) - startMs;
      const fromActive =
        event.fromState != null &&
        ACTIVE_TASK_STATES.has(event.fromState.trim().toLowerCase());
      const toInactive =
        event.toState != null &&
        !ACTIVE_TASK_STATES.has(event.toState.trim().toLowerCase());
      return elapsed >= 0 && elapsed <= windowMs && fromActive && toInactive;
    }) ?? null
  );
}

/**
 * Queue friction is measured against planned start, never task creation time.
 * A low-quality imported timestamp produces UNKNOWN instead of a false signal.
 */
export function assessQueueFriction(input: {
  plannedStart: string | null;
  observedStart: ObservedTaskStart;
  events?: readonly LivingGraphCanonicalEvent[];
  candidateThresholdMs?: number;
}): QueueFrictionAssessment {
  const threshold = input.candidateThresholdMs ?? 8 * 60 * 60 * 1000;
  if (!validIso(input.plannedStart)) {
    return {
      status: "unknown",
      queueTimeMs: null,
      severityScore: null,
      confidence: "unknown",
      evidenceEventIds: input.observedStart.eventId
        ? [input.observedStart.eventId]
        : [],
      evidenceRecords: evidenceRecordsForObservedStart(input.observedStart),
      reason: "planned_start_unavailable",
    };
  }
  if (
    input.observedStart.status !== "observed" ||
    !validIso(input.observedStart.timestamp)
  ) {
    return {
      status: "unknown",
      queueTimeMs: null,
      severityScore: null,
      confidence: "unknown",
      evidenceEventIds: [],
      evidenceRecords: [],
      reason: "observed_start_unavailable",
    };
  }
  const lowConfidenceReversal = immediatelyReversedByLowConfidenceMapping({
    observedStart: input.observedStart,
    events: input.events ?? [],
  });
  if (lowConfidenceReversal) {
    return {
      status: "unknown",
      queueTimeMs: null,
      severityScore: null,
      confidence: "low",
      evidenceEventIds: [
        input.observedStart.eventId!,
        lowConfidenceReversal.eventId,
      ],
      evidenceRecords: [
        ...evidenceRecordsForObservedStart(input.observedStart),
        { table: "project_event_log", id: lowConfidenceReversal.eventId },
      ],
      reason: "observed_start_immediately_reversed_by_low_confidence_mapping",
    };
  }
  if (input.observedStart.confidence !== "high") {
    return {
      status: "unknown",
      queueTimeMs: null,
      severityScore: null,
      confidence: input.observedStart.confidence,
      evidenceEventIds: input.observedStart.eventId
        ? [input.observedStart.eventId]
        : [],
      evidenceRecords: evidenceRecordsForObservedStart(input.observedStart),
      reason: "business_time_insufficiently_proven",
    };
  }

  const queueTimeMs = Math.max(
    0,
    Date.parse(input.observedStart.timestamp) - Date.parse(input.plannedStart),
  );
  const isCandidate = queueTimeMs >= threshold;
  return {
    status: isCandidate ? "candidate" : "not_detected",
    queueTimeMs,
    severityScore: Math.min(100, Math.round((queueTimeMs / threshold) * 25)),
    confidence: "high",
    evidenceEventIds: input.observedStart.eventId
      ? [input.observedStart.eventId]
      : [],
    evidenceRecords: evidenceRecordsForObservedStart(input.observedStart),
    reason: isCandidate
      ? "observed_start_after_planned_start_threshold"
      : "no_material_queue_variance",
  };
}

/**
 * Compares lifecycle boundary timestamps with current operational work dates.
 * A material disagreement invalidates elapsed-duration claims, but never the
 * existence or order of the underlying lifecycle events.
 */
export function assessTaskTemporalConsistency(input: {
  events: readonly LivingGraphCanonicalEvent[];
  timeEntries: readonly TaskWorkDateEvidence[];
  conflictThresholdMs?: number;
}): TaskTemporalConsistencyAssessment {
  const entries = input.timeEntries
    .filter((entry) => entry.deletedAt == null && validDateOnly(entry.workDate))
    .sort(
      (a, b) =>
        Date.parse(dateOnlyTimestamp(a.workDate)) -
          Date.parse(dateOnlyTimestamp(b.workDate)) ||
        a.id.localeCompare(b.id),
    );
  if (entries.length === 0) {
    return {
      status: "insufficient_evidence",
      confidence: "unknown",
      firstOperationalWorkAt: null,
      lastOperationalWorkAt: null,
      maxBoundaryGapMs: null,
      evidenceEventIds: [],
      evidenceRecords: [],
      reason: "no_current_operational_work_dates",
    };
  }

  const firstOperationalWorkAt = dateOnlyTimestamp(entries[0].workDate);
  const lastOperationalWorkAt = dateOnlyTimestamp(entries.at(-1)!.workDate);
  const firstWorkMs = Date.parse(firstOperationalWorkAt);
  const lastWorkMs = Date.parse(lastOperationalWorkAt);
  const threshold =
    input.conflictThresholdMs ?? DEFAULT_OPERATIONAL_CONFLICT_THRESHOLD_MS;
  const boundaries = input.events
    .filter((event) => DURATION_BOUNDARY_EVENTS.has(event.eventType))
    .map((event) => ({ event, time: qualifyEventBusinessTime(event) }))
    .filter(
      (candidate): candidate is typeof candidate & {
        time: QualifiedBusinessTime & { timestamp: string };
      } => candidate.time.durationEligible && candidate.time.timestamp != null,
    );

  if (boundaries.length === 0) {
    return {
      status: "insufficient_evidence",
      confidence: "unknown",
      firstOperationalWorkAt,
      lastOperationalWorkAt,
      maxBoundaryGapMs: null,
      evidenceEventIds: [],
      evidenceRecords: entries.map((entry) => ({
        table: "subtask_time_entries",
        id: entry.id,
      })),
      reason: "no_qualified_lifecycle_boundary",
    };
  }

  const boundaryGaps = boundaries.map(({ event, time }) => {
    const boundaryMs = Date.parse(time.timestamp);
    const gapMs =
      boundaryMs < firstWorkMs
        ? firstWorkMs - boundaryMs
        : boundaryMs > lastWorkMs
          ? boundaryMs - lastWorkMs
          : 0;
    return { event, gapMs };
  });
  const conflicts = boundaryGaps.filter(({ gapMs }) => gapMs > threshold);
  const maxBoundaryGapMs = Math.max(...boundaryGaps.map(({ gapMs }) => gapMs));

  return {
    status: conflicts.length > 0 ? "conflict" : "consistent",
    confidence: "high",
    firstOperationalWorkAt,
    lastOperationalWorkAt,
    maxBoundaryGapMs,
    evidenceEventIds: conflicts.map(({ event }) => event.eventId),
    evidenceRecords: entries.map((entry) => ({
      table: "subtask_time_entries",
      id: entry.id,
    })),
    reason:
      conflicts.length > 0
        ? "lifecycle_boundary_conflicts_with_operational_work_dates"
        : "lifecycle_boundaries_consistent_with_operational_work_dates",
  };
}

/** Only the original TimeLogged fact contributes effort; corrections restate it. */
export function isEffortContributionEvent(
  event: LivingGraphCanonicalEvent,
): boolean {
  return event.eventType === "TimeLogged";
}

/** Duration is valid only when both endpoints have qualified business time. */
export function qualifyElapsedDuration(
  from: LivingGraphCanonicalEvent,
  to: LivingGraphCanonicalEvent,
  operationalWorkDates: readonly TaskWorkDateEvidence[] = [],
): QualifiedElapsedDuration {
  const start = qualifyEventBusinessTime(from);
  const finish = qualifyEventBusinessTime(to);
  if (
    !start.durationEligible ||
    !finish.durationEligible ||
    !start.timestamp ||
    !finish.timestamp
  ) {
    return {
      durationMs: null,
      status: "insufficient_evidence",
      reason: "event_business_time_not_qualified",
    };
  }
  if (operationalWorkDates.length > 0) {
    const temporal = assessTaskTemporalConsistency({
      events: [from, to],
      timeEntries: operationalWorkDates,
    });
    if (temporal.status === "conflict") {
      return {
        durationMs: null,
        status: "temporal_conflict",
        reason: temporal.reason,
      };
    }
  }
  const elapsed = Date.parse(finish.timestamp) - Date.parse(start.timestamp);
  return elapsed >= 0
    ? { durationMs: elapsed, status: "qualified", reason: "qualified_business_time" }
    : {
        durationMs: null,
        status: "insufficient_evidence",
        reason: "negative_elapsed_duration",
      };
}

/** Backwards-compatible scalar helper for consumers that only need duration. */
export function qualifiedElapsedMs(
  from: LivingGraphCanonicalEvent,
  to: LivingGraphCanonicalEvent,
  operationalWorkDates: readonly TaskWorkDateEvidence[] = [],
): number | null {
  return qualifyElapsedDuration(from, to, operationalWorkDates).durationMs;
}


export interface TaskReworkAssessment {
  status: "confirmed" | "not_detected" | "unknown";
  confidence: FrictionEvidenceConfidence;
  completedEventId: string | null;
  reopenedEventId: string | null;
  completedAt: string | null;
  reopenedAt: string | null;
  reopenedToState: string | null;
  evidenceEventIds: string[];
  reason: string;
}

export interface ProjectionConsistencyAssessment {
  status: "consistent" | "inconsistent" | "unknown";
  confidence: FrictionEvidenceConfidence;
  evidenceEventIds: string[];
  reason: string;
}

function orderedEvents(
  events: readonly LivingGraphCanonicalEvent[],
): LivingGraphCanonicalEvent[] {
  return [...events].sort(
    (a, b) =>
      a.sequenceNumber - b.sequenceNumber ||
      (a.occurredAt ?? "").localeCompare(b.occurredAt ?? ""),
  );
}

/** Explicit Completed -> Reopened is rework even when elapsed time is unknown. */
export function detectCompletedThenReopened(
  events: readonly LivingGraphCanonicalEvent[],
): TaskReworkAssessment {
  let completed: LivingGraphCanonicalEvent | null = null;
  for (const event of orderedEvents(events)) {
    if (event.eventType === "TaskCompleted") completed = event;
    if (event.eventType === "TaskReopened" && completed) {
      const reconstructed =
        !qualifyEventBusinessTime(completed).durationEligible ||
        !qualifyEventBusinessTime(event).durationEligible;
      return {
        status: "confirmed",
        confidence: reconstructed ? "medium" : "high",
        completedEventId: completed.eventId,
        reopenedEventId: event.eventId,
        completedAt: completed.occurredAt,
        reopenedAt: event.occurredAt,
        reopenedToState: event.toState,
        evidenceEventIds: [completed.eventId, event.eventId],
        reason: "explicit_completed_then_reopened_sequence",
      };
    }
  }
  return {
    status: "not_detected",
    confidence: "high",
    completedEventId: null,
    reopenedEventId: null,
    completedAt: null,
    reopenedAt: null,
    reopenedToState: null,
    evidenceEventIds: [],
    reason: "no_completed_then_reopened_sequence",
  };
}

/**
 * Projection consistency is data quality, not friction. It is reported
 * separately so a stale task snapshot cannot overwrite event evidence.
 */
export function assessTaskProjectionConsistency(input: {
  currentStatus: string | null;
  isBlocked: boolean | null;
  events: readonly LivingGraphCanonicalEvent[];
}): ProjectionConsistencyAssessment {
  const latestStateEvent = orderedEvents(input.events)
    .filter((event) => event.toState != null && event.toState.trim() !== "")
    .at(-1);
  if (!latestStateEvent?.toState) {
    return {
      status: "unknown",
      confidence: "unknown",
      evidenceEventIds: [],
      reason: "no_state_event",
    };
  }

  const normalizeState = (value: string): string => {
    const normalized = value.trim().toLowerCase().replaceAll("-", "_");
    if (normalized === "completed") return "done";
    if (normalized === "canceled") return "cancelled";
    return normalized;
  };
  const eventState = normalizeState(latestStateEvent.toState);
  const snapshotState = input.currentStatus
    ? normalizeState(input.currentStatus)
    : null;
  const blockedMismatch =
    input.isBlocked != null && (eventState === "blocked") !== input.isBlocked;
  const statusMismatch = snapshotState != null && snapshotState !== eventState;

  return {
    status: blockedMismatch || statusMismatch ? "inconsistent" : "consistent",
    confidence: hasDataQualityFlag(latestStateEvent, /mapping_low_confidence/i)
      ? "low"
      : "high",
    evidenceEventIds: [latestStateEvent.eventId],
    reason: blockedMismatch || statusMismatch
      ? "latest_event_disagrees_with_task_snapshot"
      : "latest_event_agrees_with_task_snapshot",
  };
}
