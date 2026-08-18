// ============================================================================
// ProjectOps360° — Friction Radar task evidence qualification (read-only)
// ============================================================================
// Pure evidence qualification. This module never writes data and never turns
// missing events into operational facts.
// ============================================================================

import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import { frictionEventSemantics } from "./event-taxonomy";

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

export interface ExplicitBackwardTransition {
  eventId: string;
  eventType: string;
  occurredAt: string | null;
  fromState: string;
  toState: string;
  confidence: FrictionEvidenceConfidence;
}

export interface TaskLifecycleAssessment {
  implementedAt: string | null;
  testedAt: string | null;
  lastCompletedAt: string | null;
  completionCount: number;
  reopenedCount: number;
  reworkCycles: number;
  repeatedCompletionStatus: "confirmed" | "not_detected";
  regressionStatus: "confirmed" | "not_detected";
  backwardTransitions: ExplicitBackwardTransition[];
  skippedExpectedStatesStatus: "unknown";
  skippedExpectedStatesReason: "workflow_expectation_not_configured";
  lastMeaningfulActivityAt: string | null;
  lastMeaningfulActivityEventIds: string[];
  lastMeaningfulActivityRecords: EvidenceRecordRef[];
  evidenceEventIds: string[];
}

export interface StagnationAssessment {
  status: EvidenceAssessmentStatus;
  observedAt: string | null;
  inactiveForMs: number | null;
  severityScore: number | null;
  confidence: FrictionEvidenceConfidence;
  evidenceEventIds: string[];
  evidenceRecords: EvidenceRecordRef[];
  reason: string;
}

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

const STAGNATION_ELIGIBLE_STATES = new Set([
  ...ACTIVE_TASK_STATES,
  "blocked",
]);

const TASK_STATE_RANK: Record<string, number> = {
  not_started: 0,
  prompt_ready: 1,
  sent_to_ai: 2,
  active: 3,
  doing: 3,
  in_progress: 3,
  implemented: 4,
  testing: 5,
  review: 5,
  tested: 5,
  done: 6,
  completed: 6,
};

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

function normalizeTaskState(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "complete") return "completed";
  return normalized;
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
  const semantics = frictionEventSemantics(event.eventType);
  if (semantics?.observedStart === true) return true;
  if (semantics?.observedStart === "current_entry_required") return true;
  return (
    semantics?.observedStart === "active_state_only" &&
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

  // Task baselines are dates, not timestamps. When the plan has day
  // granularity, work anywhere on that UTC date is on time. Measuring from
  // midnight would manufacture 8+ hours of queue for a same-day start.
  const plannedBoundaryMs = validDateOnly(input.plannedStart)
    ? Date.parse(dateOnlyTimestamp(input.plannedStart)) + 24 * 60 * 60 * 1000
    : Date.parse(input.plannedStart);
  const queueTimeMs = Math.max(
    0,
    Date.parse(input.observedStart.timestamp) - plannedBoundaryMs,
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
  return frictionEventSemantics(event.eventType)?.effort === "contribution";
}

/**
 * Derives only lifecycle facts that are explicit in the event sequence.
 * Missing Implemented/Tested events are never treated as skipped workflow
 * states because ProjectOps360 has no project-level mandatory workflow policy.
 */
export function assessTaskLifecycle(
  events: readonly LivingGraphCanonicalEvent[],
  timeEntries: readonly TaskWorkDateEvidence[] = [],
): TaskLifecycleAssessment {
  const ordered = orderedEvents(events);
  const completions = ordered.filter((event) => event.eventType === "TaskCompleted");
  const reopenings = ordered.filter((event) => event.eventType === "TaskReopened");
  const implemented = ordered.find((event) => event.eventType === "TaskImplemented");
  const tested = ordered.find((event) => event.eventType === "TaskTested");
  const lastCompletion = completions.at(-1) ?? null;

  const backwardTransitions = ordered.flatMap((event) => {
    if (!event.fromState || !event.toState) return [];
    const fromState = normalizeTaskState(event.fromState);
    const toState = normalizeTaskState(event.toState);
    const fromRank = TASK_STATE_RANK[fromState];
    const toRank = TASK_STATE_RANK[toState];
    if (fromRank == null || toRank == null || toRank >= fromRank) return [];
    return [{
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      fromState,
      toState,
      confidence: hasDataQualityFlag(event, /mapping_low_confidence/i)
        ? ("low" as const)
        : qualifyEventBusinessTime(event).confidence,
    }];
  });

  let reworkCycles = 0;
  let completedSeen = false;
  for (const event of ordered) {
    if (event.eventType === "TaskCompleted") completedSeen = true;
    if (event.eventType === "TaskReopened" && completedSeen) {
      reworkCycles += 1;
      completedSeen = false;
    }
  }

  const currentEntryDates = timeEntries
    .filter((entry) => entry.deletedAt == null && validDateOnly(entry.workDate))
    .map((entry) => dateOnlyTimestamp(entry.workDate))
    .sort();
  const eventActivity = ordered
    .filter(isMeaningfulTaskWorkEvent)
    // Current rows supersede TimeLogged audit payload/timestamps for work date.
    .filter((event) => currentEntryDates.length === 0 || event.eventType !== "TimeLogged")
    .map((event) => ({ event, time: qualifyEventBusinessTime(event) }))
    .filter((candidate) => candidate.time.timestamp != null)
    .sort((a, b) => Date.parse(a.time.timestamp!) - Date.parse(b.time.timestamp!));
  const lastEventActivity = eventActivity.at(-1)?.time.timestamp ?? null;
  const lastEntryActivity = currentEntryDates.at(-1) ?? null;
  const lastMeaningfulActivityAt = [lastEventActivity, lastEntryActivity]
    .filter((value): value is string => value != null)
    .sort()
    .at(-1) ?? null;
  const lastMeaningfulActivityEventIds = lastMeaningfulActivityAt == null
    ? []
    : eventActivity
        .filter(({ time }) => time.timestamp === lastMeaningfulActivityAt)
        .map(({ event }) => event.eventId);
  const lastMeaningfulActivityRecords = lastMeaningfulActivityAt == null
    ? []
    : timeEntries
        .filter(
          (entry) =>
            entry.deletedAt == null &&
            validDateOnly(entry.workDate) &&
            dateOnlyTimestamp(entry.workDate) === lastMeaningfulActivityAt,
        )
        .map((entry) => ({
          table: "subtask_time_entries" as const,
          id: entry.id,
        }));

  return {
    implementedAt: implemented?.occurredAt ?? null,
    testedAt: tested?.occurredAt ?? null,
    lastCompletedAt: lastCompletion?.occurredAt ?? null,
    completionCount: completions.length,
    reopenedCount: reopenings.length,
    reworkCycles,
    repeatedCompletionStatus:
      completions.length > 1 ? "confirmed" : "not_detected",
    regressionStatus:
      tested && ordered.some((event) =>
        event.sequenceNumber > tested.sequenceNumber &&
        (event.eventType === "TaskReopened" ||
          (event.toState != null &&
            ["implemented", "in_progress"].includes(normalizeTaskState(event.toState))))
      )
        ? "confirmed"
        : "not_detected",
    backwardTransitions,
    skippedExpectedStatesStatus: "unknown",
    skippedExpectedStatesReason: "workflow_expectation_not_configured",
    lastMeaningfulActivityAt,
    lastMeaningfulActivityEventIds,
    lastMeaningfulActivityRecords,
    evidenceEventIds: [
      ...completions.map((event) => event.eventId),
      ...reopenings.map((event) => event.eventId),
      ...backwardTransitions.map((transition) => transition.eventId),
    ].filter((id, index, all) => all.indexOf(id) === index),
  };
}

/**
 * Stagnation requires an active/interrupted current state plus positive evidence
 * of prior work. A task with no TaskStarted and no work evidence stays UNKNOWN.
 */
export function assessTaskStagnation(input: {
  currentStatus: string | null;
  lifecycle: TaskLifecycleAssessment;
  observedAt: string | null;
  candidateThresholdMs?: number;
}): StagnationAssessment {
  const threshold = input.candidateThresholdMs ?? 7 * 24 * 60 * 60 * 1000;
  const status = input.currentStatus
    ? normalizeTaskState(input.currentStatus)
    : null;
  if (!status || !STAGNATION_ELIGIBLE_STATES.has(status)) {
    return {
      status: "not_detected",
      observedAt: validIso(input.observedAt) ? input.observedAt : null,
      inactiveForMs: 0,
      severityScore: 0,
      confidence: "high",
      evidenceEventIds: [],
      evidenceRecords: [],
      reason: "task_not_in_stagnation_eligible_state",
    };
  }
  if (!validIso(input.observedAt) || !validIso(input.lifecycle.lastMeaningfulActivityAt)) {
    return {
      status: "unknown",
      observedAt: validIso(input.observedAt) ? input.observedAt : null,
      inactiveForMs: null,
      severityScore: null,
      confidence: "unknown",
      evidenceEventIds: input.lifecycle.lastMeaningfulActivityEventIds,
      evidenceRecords: input.lifecycle.lastMeaningfulActivityRecords,
      reason: "last_meaningful_activity_unavailable",
    };
  }
  const inactiveForMs = Date.parse(input.observedAt) -
    Date.parse(input.lifecycle.lastMeaningfulActivityAt);
  if (inactiveForMs < 0) {
    return {
      status: "unknown",
      observedAt: input.observedAt,
      inactiveForMs: null,
      severityScore: null,
      confidence: "low",
      evidenceEventIds: input.lifecycle.lastMeaningfulActivityEventIds,
      evidenceRecords: input.lifecycle.lastMeaningfulActivityRecords,
      reason: "analysis_time_precedes_activity",
    };
  }
  const candidate = inactiveForMs >= threshold;
  return {
    status: candidate ? "candidate" : "not_detected",
    observedAt: input.observedAt,
    inactiveForMs,
    severityScore: candidate
      ? Math.min(100, Math.round((inactiveForMs / threshold) * 35))
      : 0,
    confidence: "high",
    evidenceEventIds: input.lifecycle.lastMeaningfulActivityEventIds,
    evidenceRecords: input.lifecycle.lastMeaningfulActivityRecords,
    reason: candidate
      ? "active_task_without_recent_meaningful_activity"
      : "recent_meaningful_activity_observed",
  };
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
