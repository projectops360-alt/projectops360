// ============================================================================
// ProjectOps360° — Team resource merge planning (pure)
// ============================================================================
// Decides which duplicate resource to keep when merging, and which to fold in.
// Keep priority: a resource already linked to a user > most projects/usage >
// lowest (stable) id. Pure + testable; the server action applies the plan.
// ============================================================================

export interface MergeableResource {
  id: string;
  linkedUserId: string | null;
  /** Number of projects / assignments this resource appears in (usage weight). */
  usage: number;
}

export interface MergePlan {
  keepId: string;
  mergeIds: string[];
}

/** Choose the survivor and the ids to merge into it. Returns null if < 2. */
export function planMerge(resources: MergeableResource[]): MergePlan | null {
  if (resources.length < 2) return null;
  const ranked = [...resources].sort((a, b) => {
    // user-linked wins
    if (!!a.linkedUserId !== !!b.linkedUserId) return a.linkedUserId ? -1 : 1;
    // then higher usage
    if (a.usage !== b.usage) return b.usage - a.usage;
    // then stable by id
    return a.id.localeCompare(b.id);
  });
  const keep = ranked[0];
  return { keepId: keep.id, mergeIds: ranked.slice(1).map((r) => r.id) };
}
