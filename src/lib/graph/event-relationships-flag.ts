// ============================================================================
// Living Graph — Canonical-event Relationships view flag (CAP-045 extension)
// ============================================================================
// Per-project pilot flag, server-evaluated, DEFAULT OFF (same pattern as the
// risk-capture flag). LIVING_GRAPH_EVENT_RELATIONSHIPS_PROJECT_IDS is a
// comma-separated list of pilot project IDs; the literal "all" enables every
// project (local testing only — never set "all" in production).
//
// With the flag OFF, the Living Graph is byte-identical to before: the "events"
// view keeps its current timeline/process behavior, no canonical-events view,
// no event-relationship edges, no new controls. The flag is INDEPENDENT of
// RISK_EVENT_CAPTURE_PROJECT_IDS — capturing events and rendering them as a
// graph projection are two separate concerns.
//
// The flag only controls the READ-ONLY projection rendered by the Living Graph.
// It never gates event capture (which lives in the risk-capture flag) and never
// writes to project_event_log / process_nodes / process_edges.
// ============================================================================

/** Pure gate (unit-tested): is the canonical-events view enabled for this
 *  project given the raw env value? */
export function isEventRelationshipsEnabledFor(
  projectId: string,
  rawEnvValue: string | undefined | null,
): boolean {
  const raw = (rawEnvValue ?? "").trim();
  if (!raw || !projectId) return false;
  if (raw === "all") return true;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(projectId);
}

/** Server-side gate reading the environment (default OFF). */
export function isEventRelationshipsEnabled(projectId: string): boolean {
  return isEventRelationshipsEnabledFor(
    projectId,
    process.env.LIVING_GRAPH_EVENT_RELATIONSHIPS_PROJECT_IDS,
  );
}