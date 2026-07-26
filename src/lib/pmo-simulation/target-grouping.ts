// ============================================================================
// PMO Simulation — grouping the target picker by project (CAP-049 §6)
// ============================================================================
// A portfolio scenario may target any entity in the organization, so the picker
// lists every project's milestones, tasks and risks at once. Flat, that list is
// not usable: milestone names repeat across projects ("M1", "Design Phase",
// "Feature Implementation" are not unique), and the user is asked to aim an
// intervention at an entity they cannot attribute to anything.
//
// Grouping is presentation only. It does not narrow what a scenario MAY target
// — V1 deliberately simulates the whole portfolio and the scope field says so.
// It only makes the choice legible.
// ============================================================================

export interface GroupableTarget {
  kind: string;
  id: string;
  label: string;
  projectId: string | null;
  projectLabel: string | null;
}

/**
 * Group targets under their project, ordered by project title then by label.
 *
 * Entities with no project (a resource shared across the portfolio) collect
 * under `fallbackLabel` and are placed LAST — they are the exception, and
 * leading with them would bury the projects the user came for.
 */
export function groupTargetsByProject<T extends GroupableTarget>(
  targets: readonly T[],
  fallbackLabel: string,
): [string, T[]][] {
  const groups = new Map<string, T[]>();

  for (const target of targets) {
    const key = target.projectLabel?.trim() || fallbackLabel;
    const bucket = groups.get(key);
    if (bucket) bucket.push(target);
    else groups.set(key, [target]);
  }

  for (const bucket of groups.values()) {
    // Kind first so a project's own node and its milestones do not interleave
    // with its tasks, then alphabetically within the kind.
    bucket.sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        a.label.localeCompare(b.label),
    );
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === fallbackLabel) return 1;
    if (b === fallbackLabel) return -1;
    return a.localeCompare(b);
  });
}

/** Broad to narrow: a project, then its milestones, then the work inside them. */
const KIND_ORDER = ["project", "milestone", "task", "risk", "resource"];
