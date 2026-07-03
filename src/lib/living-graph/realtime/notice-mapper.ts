// ============================================================================
// ProjectOps360° — LGRE · Change Notice Mapper (Phase 4, Task 2)
// ============================================================================
// Pure, deterministic mapping from an appended project_event_log row (as a
// transport delivers it, untrusted) to a read-only LivingGraphChangeNotice.
// Malformed rows map to null — they are rejected and counted upstream, never
// silently interpreted (Constitution §5, §9). The mapper interprets NOTHING:
// event semantics belong to the deterministic engines, not the transport.
// ============================================================================

import type { LivingGraphChangeNotice } from "./types";
import type { ProjectEventLogRowLike } from "./subscription-types";

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Map a project_event_log row to a change notice. Returns null when the row
 * is missing any identity-critical field (event id, org, project, type,
 * occurred_at) — the caller must reject-and-count, never guess.
 */
export function mapProjectEventRowToNotice(
  row: ProjectEventLogRowLike,
): LivingGraphChangeNotice | null {
  const eventId = asNonEmptyString(row.event_id);
  const organizationId = asNonEmptyString(row.organization_id);
  const projectId = asNonEmptyString(row.project_id);
  const eventType = asNonEmptyString(row.event_type);
  const occurredAt = asNonEmptyString(row.occurred_at);
  if (!eventId || !organizationId || !projectId || !eventType || !occurredAt) return null;

  const sequence =
    typeof row.sequence_number === "number" && Number.isFinite(row.sequence_number)
      ? row.sequence_number
      : null;

  return Object.freeze({
    noticeId: `peg:${eventId}`,
    source: "project_event_graph",
    organizationId,
    projectId,
    eventId,
    eventType,
    sequence,
    occurredAt,
    invalidationTags: Object.freeze(asStringArray(row.invalidation_tags)),
    lifecycleClass: asNonEmptyString(row.event_lifecycle_class),
    isCompensatingEvent: row.is_compensating_event === true,
  });
}

/** Stable at-least-once dedup key for a notice (eventId wins; sequence disambiguates). */
export function noticeDedupKey(notice: LivingGraphChangeNotice): string {
  return notice.eventId
    ? `event:${notice.eventId}`
    : `notice:${notice.noticeId}:${notice.sequence ?? "no-seq"}`;
}
