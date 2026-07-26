// ============================================================================
// PMO Portfolio Living Graph — shared resource detection (CAP-048)
// ============================================================================
// The one INFERRED relationship in Phase 1, and it is arithmetic, not opinion:
// two projects share a resource when they hold allocations for the same
// resource profile over overlapping dates. No LLM, no heuristics, no guessing.
//
// This is the edge that traditional dashboards structurally cannot show — each
// one looks at a single project, so the collision is invisible from inside it.
// ============================================================================

import type { GraphEvidenceRef } from "./contracts";

export interface ResourceAllocationRow {
  id: string;
  organization_id: string;
  project_id: string;
  resource_profile_id: string | null;
  display_name: string | null;
  allocation_percent: number | null;
  /** Inclusive. Null means open-ended in the past. */
  start_date: string | null;
  /** Inclusive. Null means open-ended in the future. */
  end_date: string | null;
  status: string | null;
}

export interface SharedResourceLink {
  resourceProfileId: string;
  resourceLabel: string;
  projectAId: string;
  projectBId: string;
  /** Inclusive overlap window, ISO dates. */
  overlapStart: string;
  overlapEnd: string | null;
  /** Combined allocation across both projects; >100 means over-committed. */
  combinedAllocationPercent: number | null;
  evidenceRefs: GraphEvidenceRef[];
}

/** Open-ended bounds are treated as infinite, which is what "no end date" means. */
function startsAtOrBefore(a: string | null, b: string | null): boolean {
  if (a === null) return true;
  if (b === null) return false;
  return a <= b;
}

/**
 * Do two date ranges intersect? Bounds are inclusive: two allocations that meet
 * on a single day genuinely collide on that day.
 */
export function rangesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  // a must begin before b ends, and b before a ends.
  const aBeforeBEnds = bEnd === null || aStart === null || aStart <= bEnd;
  const bBeforeAEnds = aEnd === null || bStart === null || bStart <= aEnd;
  return aBeforeBEnds && bBeforeAEnds;
}

function overlapWindow(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): { start: string; end: string | null } | null {
  const start = startsAtOrBefore(aStart, bStart) ? bStart : aStart;
  // Both open-ended in the past: there is no concrete date to report.
  if (start === null) return null;
  const end = aEnd === null ? bEnd : bEnd === null ? aEnd : aEnd <= bEnd ? aEnd : bEnd;
  return { start, end };
}

/** Allocations that never took effect must not create edges. */
function isLive(row: ResourceAllocationRow): boolean {
  return row.status !== "removed" && row.status !== "inactive";
}

/**
 * Find every pair of *different* projects competing for the same resource.
 *
 * A pair is reported once, not twice — this is an undirected relationship, and
 * emitting both directions would double every cross-project count downstream.
 */
export function detectSharedResources(
  allocations: readonly ResourceAllocationRow[],
  organizationId: string,
): SharedResourceLink[] {
  const byResource = new Map<string, ResourceAllocationRow[]>();

  for (const row of allocations) {
    // Cross-tenant rows can never form an edge, and an allocation without a
    // resource profile cannot be matched to anything.
    if (row.organization_id !== organizationId) continue;
    if (!row.resource_profile_id) continue;
    if (!isLive(row)) continue;
    const bucket = byResource.get(row.resource_profile_id);
    if (bucket) bucket.push(row);
    else byResource.set(row.resource_profile_id, [row]);
  }

  const links: SharedResourceLink[] = [];

  for (const [resourceProfileId, rows] of byResource) {
    // Deduplicate per project pair: one resource may hold several allocations
    // in the same project, and that is one collision, not many.
    const seenPairs = new Set<string>();

    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i];
        const b = rows[j];
        if (a.project_id === b.project_id) continue;
        if (!rangesOverlap(a.start_date, a.end_date, b.start_date, b.end_date)) {
          continue;
        }
        const window = overlapWindow(
          a.start_date,
          a.end_date,
          b.start_date,
          b.end_date,
        );
        if (!window) continue;

        // Order the pair so A↔B and B↔A collapse into one link.
        const [projectAId, projectBId] =
          a.project_id < b.project_id
            ? [a.project_id, b.project_id]
            : [b.project_id, a.project_id];
        const pairKey = `${projectAId}|${projectBId}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const combined =
          a.allocation_percent != null && b.allocation_percent != null
            ? a.allocation_percent + b.allocation_percent
            : null;

        links.push({
          resourceProfileId,
          resourceLabel: a.display_name ?? b.display_name ?? resourceProfileId,
          projectAId,
          projectBId,
          overlapStart: window.start,
          overlapEnd: window.end,
          combinedAllocationPercent: combined,
          evidenceRefs: [
            {
              sourceTable: "project_resource_allocations",
              sourceId: a.id,
              note: `${a.start_date ?? "open"} → ${a.end_date ?? "open"}`,
            },
            {
              sourceTable: "project_resource_allocations",
              sourceId: b.id,
              note: `${b.start_date ?? "open"} → ${b.end_date ?? "open"}`,
            },
          ],
        });
      }
    }
  }

  return links;
}

/**
 * Resources committed beyond 100% across projects during an overlap.
 *
 * Reported separately from the sharing links themselves: sharing a resource is
 * normal, over-committing one is a scheduling conflict.
 */
export function detectCapacityConflicts(
  links: readonly SharedResourceLink[],
): SharedResourceLink[] {
  return links.filter(
    (link) =>
      link.combinedAllocationPercent != null &&
      link.combinedAllocationPercent > 100,
  );
}
