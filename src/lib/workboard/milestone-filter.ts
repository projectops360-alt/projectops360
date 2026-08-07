// ============================================================================
// Every milestone belongs in the filter — especially the empty ones
// ============================================================================
// The Workboard's milestone filter listed only milestones that ALREADY had
// tasks. On the SAP plan that meant 5 chips for 16 milestones: the eleven
// missing ones were the Q-Gates and sign-offs, which are real phases a PM has
// to plan work into.
//
// The trap is circular. A milestone with no tasks is hidden, so it cannot be
// selected, so no task can be added to it from here — the filter hid precisely
// the milestones that most needed work adding. And a plan that shows 5 of its
// 16 phases reads as a plan that HAS 5 phases.
//
// So the list is complete, and each chip carries its task count. An empty
// milestone looks empty rather than looking like it does not exist.
// ============================================================================

export interface MilestoneLike {
  id: string;
  title: string;
}

export interface TaskLike {
  milestone_id?: string | null;
}

export interface MilestoneFilterOption {
  id: string;
  title: string;
  /** Tasks currently under this milestone. Zero is shown, never hidden. */
  taskCount: number;
}

/**
 * Every milestone, in plan order, with how many tasks each holds.
 *
 * Order comes from the milestones array, which the page already sorts by
 * order_index — so the chips read in the order the work happens, not
 * alphabetically and not by task count.
 */
export function milestoneFilterOptions(
  milestones: readonly MilestoneLike[],
  tasks: readonly TaskLike[],
): MilestoneFilterOption[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.milestone_id) continue;
    counts.set(task.milestone_id, (counts.get(task.milestone_id) ?? 0) + 1);
  }
  return milestones.map((m) => ({
    id: m.id,
    title: m.title,
    taskCount: counts.get(m.id) ?? 0,
  }));
}

/**
 * Whether the board is empty because of the filter rather than because the
 * project is.
 *
 * A board showing nothing looks broken. Knowing the selected milestone simply
 * has no tasks yet turns the same screen into an invitation to add the first
 * one — which is the whole reason empty milestones are now selectable.
 */
export function isEmptyByMilestoneFilter(
  options: readonly MilestoneFilterOption[],
  selectedId: string | null,
): boolean {
  if (!selectedId) return false;
  const selected = options.find((o) => o.id === selectedId);
  return selected != null && selected.taskCount === 0;
}
