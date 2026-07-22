// ============================================================================
// Living Graph — Canonical-event Relationships view rollout (CAP-045)
// ============================================================================
// The read-only projection is available automatically to existing and newly
// created projects. LIVING_GRAPH_EVENT_RELATIONSHIPS_ENABLED=false is the
// global rollback switch; LIVING_GRAPH_EVENT_RELATIONSHIPS_DISABLED_PROJECT_IDS
// optionally quarantines specific projects without introducing an allowlist.
//
// These controls only affect the READ-ONLY projection rendered by the Living
// Graph. They never gate event capture and never write to project_event_log,
// process_nodes, or process_edges.
// ============================================================================

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);

function isGloballyEnabled(rawEnvValue: string | undefined | null): boolean {
  const raw = (rawEnvValue ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (ENABLED_VALUES.has(raw)) return true;
  if (DISABLED_VALUES.has(raw)) return false;
  return false;
}

/** Pure gate for the global switch and optional project denylist. */
export function isEventRelationshipsEnabledFor(
  projectId: string,
  rawEnabledValue: string | undefined | null,
  rawDisabledProjectIds?: string | undefined | null,
): boolean {
  if (!projectId || !isGloballyEnabled(rawEnabledValue)) return false;

  const disabledProjectIds = (rawDisabledProjectIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return !disabledProjectIds.includes("all") && !disabledProjectIds.includes(projectId);
}

/** Server-side gate reading the environment (default ON). */
export function isEventRelationshipsEnabled(projectId: string): boolean {
  return isEventRelationshipsEnabledFor(
    projectId,
    process.env.LIVING_GRAPH_EVENT_RELATIONSHIPS_ENABLED,
    process.env.LIVING_GRAPH_EVENT_RELATIONSHIPS_DISABLED_PROJECT_IDS,
  );
}
