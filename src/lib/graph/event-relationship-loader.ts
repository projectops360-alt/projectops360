// ============================================================================
// Living Graph — Canonical-event projection LOADER (CAP-045 extension)
// ============================================================================
// Server-side helper that reads the canonical event store through an
// AUTHENTICATED Supabase client (RLS — never the admin/service role for an
// ordinary read) and builds the read-only event-relationship projection.
//
// Extracted from the Living Graph page so the security contract is unit-testable:
//   * requires BOTH organizationId and projectId (no global reads);
//   * scopes every query by project_id AND organization_id;
//   * the projection itself rejects any cross-project rows that slip through;
//   * uses ONLY the client the caller supplies — it never constructs an admin
//     client, so ordinary reads can never bypass RLS.
//
// Failure is non-fatal: any query error yields an empty projection (the view
// simply keeps its current behavior). The log read is bounded by an explicit,
// documented limit and reports truncation (never silently truncated).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  projectEventRelationships,
  type CanonicalEventLogRow,
  type CanonicalEventObjectRow,
} from "@/lib/graph/event-relationship-projection";
import type {
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
} from "@/types/living-graph";

export interface CanonicalEventLoadResult {
  canonicalEvents: LivingGraphCanonicalEvent[];
  eventRelationships: LivingGraphEventRelationship[];
  eventsTruncated: boolean;
  /** Explicit load status so the caller (page) can map to
   *  `CanonicalEventProjectionStatus` without guessing from emptiness.
   *  - "ok": projection computed (possibly with 0 events → caller maps to "empty").
   *  - "error": the log read itself failed (caller maps to "error").
   *  - "missing-input": org/project absent (caller maps to "disabled"/"error"). */
  status: "ok" | "error" | "missing-input";
  /** Machine-readable failure code when status !== "ok". */
  errorCode?: "log_read_failed" | "object_read_partial" | "missing-input";
}

export const EVENT_LOG_LIMIT = 1000; // explicit, documented bound

const EVENT_LOG_COLUMNS =
  "event_id, organization_id, project_id, event_category, event_type, "
  + "event_schema_version, event_importance, event_lifecycle_class, "
  + "subject_type, subject_id, actor_type, actor_id, occurred_at, recorded_at, "
  + "sequence_number, source_module, source_entity_type, source_entity_id, "
  + "from_state, to_state, caused_by, is_compensating_event, compensates_event_id, "
  + "event_hash, previous_event_hash, provenance, confidence, payload, visibility";

/**
 * Load the canonical-event projection for one project. PURE w.r.t. the client:
 * uses ONLY the supplied (authenticated) client.
 *
 * Returns an empty projection (truncated=false) when org/project are missing or
 * the read errors — the caller treats that as "feature unavailable".
 */
export async function loadCanonicalEventProjection(
  client: SupabaseClient,
  organizationId: string,
  projectId: string,
): Promise<CanonicalEventLoadResult> {
  const empty: CanonicalEventLoadResult = {
    canonicalEvents: [],
    eventRelationships: [],
    eventsTruncated: false,
    status: "ok",
  };
  if (!organizationId || !projectId) {
    return { ...empty, status: "missing-input", errorCode: "missing-input" };
  }

  // +1 to detect truncation without a second query.
  const logResult = await client
    .from("project_event_log")
    .select(EVENT_LOG_COLUMNS)
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .order("sequence_number", { ascending: true })
    .limit(EVENT_LOG_LIMIT + 1);

  if (logResult.error || !logResult.data) {
    return { ...empty, status: "error", errorCode: "log_read_failed" };
  }

  const logRowsAll = logResult.data as unknown as CanonicalEventLogRow[];
  const eventsTruncated = logRowsAll.length > EVENT_LOG_LIMIT;
  const logRows = eventsTruncated ? logRowsAll.slice(0, EVENT_LOG_LIMIT) : logRowsAll;

  // Fetch object refs ONLY for the recovered event_ids (bounded by the log read).
  let objectRows: CanonicalEventObjectRow[] = [];
  let objectReadPartial = false;
  if (logRows.length > 0) {
    const eventIds = logRows.map((r) => r.event_id);
    const objsResult = await client
      .from("project_event_objects")
      .select("event_id, object_type, object_id, role")
      .in("event_id", eventIds);
    if (!objsResult.error && objsResult.data) {
      objectRows = objsResult.data as unknown as CanonicalEventObjectRow[];
    } else {
      // Non-fatal: events still render, just without their object refs. Surface
      // the partial failure via errorCode so the page can flag degraded data.
      objectReadPartial = true;
    }
  }

  const projection = projectEventRelationships(logRows, objectRows, projectId);
  return {
    canonicalEvents: projection.canonicalEvents,
    eventRelationships: projection.eventRelationships,
    eventsTruncated,
    status: "ok",
    ...(objectReadPartial ? { errorCode: "object_read_partial" } : {}),
  };
}