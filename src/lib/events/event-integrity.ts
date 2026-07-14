export interface EventIntegrityObjectRef {
  objectType: string;
  objectId: string;
  role: string;
}

export interface EventIntegrityRow {
  eventId: string;
  organizationId: string;
  projectId: string;
  caseId: string;
  eventType: string;
  eventCategory: string;
  subjectType: string | null;
  subjectId: string | null;
  actorType: string | null;
  occurredAt: string | null;
  recordedAt: string | null;
  sequenceNumber: number;
  sourceModule: string | null;
  provenance: Record<string, unknown> | null;
  eventHash: string | null;
  previousEventHash: string | null;
  dedupKey?: string | null;
  objectRefs: EventIntegrityObjectRef[];
}

export type EventIntegrityIssueSeverity = "error" | "warning";

export interface EventIntegrityIssue {
  code:
    | "cross_project_event"
    | "cross_organization_event"
    | "duplicate_event_id"
    | "duplicate_sequence"
    | "duplicate_dedup_key"
    | "non_monotonic_sequence"
    | "sequence_gap"
    | "missing_event_hash"
    | "broken_hash_chain"
    | "missing_traceability"
    | "invalid_case_scope"
    | "missing_focal_ref"
    | "missing_project_ref"
    | "missing_dependency_ref";
  severity: EventIntegrityIssueSeverity;
  eventId?: string;
  detail: string;
}

export interface EventIntegrityReport {
  valid: boolean;
  projectId: string | null;
  eventCount: number;
  caseCount: number;
  dataQualityFlagCount: number;
  issues: EventIntegrityIssue[];
}

const MINING_CATEGORIES = new Set(["task", "milestone", "dependency"]);

function hasRef(
  event: EventIntegrityRow,
  objectType: string,
  objectId: string,
  role: string,
): boolean {
  return event.objectRefs.some(
    (ref) => ref.objectType === objectType && ref.objectId === objectId && ref.role === role,
  );
}

function dataQualityFlags(event: EventIntegrityRow): string[] {
  const value = event.provenance?.data_quality_flags;
  return Array.isArray(value) ? value.filter((flag): flag is string => typeof flag === "string") : [];
}

/**
 * Audit one complete, project-scoped event window. Pure and read-only: it
 * validates order/hash linkage, traceability, mining case framing and OCEL refs
 * without exposing payloads or inferring causality.
 */
export function validateEventIntegrity(events: readonly EventIntegrityRow[]): EventIntegrityReport {
  const ordered = [...events].sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  const projectId = ordered[0]?.projectId ?? null;
  const organizationId = ordered[0]?.organizationId ?? null;
  const issues: EventIntegrityIssue[] = [];
  const seenEventIds = new Set<string>();
  const seenSequences = new Set<number>();
  const seenDedupKeys = new Set<string>();

  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];
    const previous = ordered[index - 1];

    if (projectId && event.projectId !== projectId) {
      issues.push({ code: "cross_project_event", severity: "error", eventId: event.eventId, detail: "Event belongs to another project." });
    }
    if (organizationId && event.organizationId !== organizationId) {
      issues.push({ code: "cross_organization_event", severity: "error", eventId: event.eventId, detail: "Event belongs to another organization." });
    }
    if (seenEventIds.has(event.eventId)) {
      issues.push({ code: "duplicate_event_id", severity: "error", eventId: event.eventId, detail: "event_id is duplicated." });
    }
    seenEventIds.add(event.eventId);

    if (seenSequences.has(event.sequenceNumber)) {
      issues.push({ code: "duplicate_sequence", severity: "error", eventId: event.eventId, detail: "sequence_number is duplicated." });
    }
    seenSequences.add(event.sequenceNumber);

    if (event.dedupKey) {
      if (seenDedupKeys.has(event.dedupKey)) {
        issues.push({ code: "duplicate_dedup_key", severity: "error", eventId: event.eventId, detail: "dedup_key is duplicated." });
      }
      seenDedupKeys.add(event.dedupKey);
    }

    if (previous) {
      if (event.sequenceNumber <= previous.sequenceNumber) {
        issues.push({ code: "non_monotonic_sequence", severity: "error", eventId: event.eventId, detail: "Sequence is not strictly increasing." });
      } else if (event.sequenceNumber > previous.sequenceNumber + 1) {
        issues.push({ code: "sequence_gap", severity: "warning", eventId: event.eventId, detail: "Sequence contains a gap; inspect failed or omitted writes." });
      }
      if (event.previousEventHash !== previous.eventHash) {
        issues.push({ code: "broken_hash_chain", severity: "error", eventId: event.eventId, detail: "previous_event_hash does not match the preceding event hash." });
      }
    } else if (event.sequenceNumber === 1 && event.previousEventHash !== null) {
      issues.push({ code: "broken_hash_chain", severity: "error", eventId: event.eventId, detail: "The first project event must not reference a previous hash." });
    }

    if (!event.eventHash) {
      issues.push({ code: "missing_event_hash", severity: "error", eventId: event.eventId, detail: "event_hash is missing." });
    }

    const captureMethod = event.provenance?.capture_method;
    const missingTraceability = [
      event.organizationId,
      event.projectId,
      event.caseId,
      event.eventType,
      event.subjectType,
      event.subjectId,
      event.actorType,
      event.occurredAt,
      event.recordedAt,
      event.sourceModule,
      typeof captureMethod === "string" ? captureMethod : null,
    ].some((value) => value == null || value === "");
    if (missingTraceability) {
      issues.push({ code: "missing_traceability", severity: "error", eventId: event.eventId, detail: "Required identity, actor, time, source or capture-method traceability is missing." });
    }

    if (MINING_CATEGORIES.has(event.eventCategory) && event.subjectId) {
      if (event.caseId !== event.subjectId) {
        issues.push({ code: "invalid_case_scope", severity: "error", eventId: event.eventId, detail: "Mining case_id must equal the focal task or milestone subject_id." });
      }
      if (event.subjectType && !hasRef(event, event.subjectType, event.subjectId, "focal")) {
        issues.push({ code: "missing_focal_ref", severity: "error", eventId: event.eventId, detail: "The focal subject OCEL ref is missing." });
      }
      if (!hasRef(event, "project", event.projectId, "context")) {
        issues.push({ code: "missing_project_ref", severity: "error", eventId: event.eventId, detail: "The project context OCEL ref is missing." });
      }
      if (
        event.eventCategory === "dependency"
        && (!event.objectRefs.some((ref) => ref.objectType === "task" && ref.role === "predecessor")
          || !event.objectRefs.some((ref) => ref.objectType === "dependency" && ref.role === "relation"))
      ) {
        issues.push({ code: "missing_dependency_ref", severity: "error", eventId: event.eventId, detail: "Dependency events require predecessor-task and dependency-relation refs." });
      }
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    projectId,
    eventCount: ordered.length,
    caseCount: new Set(ordered.map((event) => event.caseId)).size,
    dataQualityFlagCount: ordered.reduce((count, event) => count + dataQualityFlags(event).length, 0),
    issues,
  };
}
