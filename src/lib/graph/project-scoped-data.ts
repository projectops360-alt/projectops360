// ============================================================================
// Living Graph — project isolation filter (CAP-045 §C.2 / Part B)
// ============================================================================
// PURE: no I/O, no mutation of inputs. Filters a `LivingGraphData` payload to
// rows whose `projectId` matches `requestedProjectId`, so a row from another
// project can NEVER render in a project's graph — even if a payload were ever
// reused across mounts. Defense-in-depth on top of the page's server-side
// project_id scoping.
//
// Preserves the byte-identical invariant for flag-OFF: when `canonicalEvents`/
// `eventRelationships` are absent on the input, they stay absent on the output
// (we never synthesize an empty array that wasn't there).
// ============================================================================

import type { LivingGraphData } from "@/types/living-graph";

export function scopeLivingGraphDataToProject(
  data: LivingGraphData,
  requestedProjectId: string,
): LivingGraphData {
  const nodes = data.nodes.filter((n) => n.projectId === requestedProjectId);
  const edges = data.edges.filter((e) => e.projectId === requestedProjectId);
  const events = data.events.filter((ev) => ev.projectId === requestedProjectId);

  const hasCanonical = data.canonicalEvents !== undefined;
  const hasRelationships = data.eventRelationships !== undefined;

  return {
    ...data,
    nodes,
    edges,
    events,
    ...(hasCanonical
      ? {
          canonicalEvents: (data.canonicalEvents ?? []).filter(
            (e) => e.projectId === requestedProjectId,
          ),
        }
      : {}),
    ...(hasRelationships
      ? {
          eventRelationships: (data.eventRelationships ?? []).filter(
            (r) => r.projectId === requestedProjectId,
          ),
        }
      : {}),
  };
}