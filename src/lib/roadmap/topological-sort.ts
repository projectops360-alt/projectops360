// ============================================================================
// ProjectOps360° — Dependency-Aware Task Ordering
// ============================================================================
// Topological sort based on Kahn's algorithm. Sorts tasks so that
// predecessors always appear before successors, preserving milestone grouping
// and original order_index as tiebreaker within each dependency level.
// ============================================================================

import type { RoadmapTask, TaskDependency, DependencyType, Milestone } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TopologicalSortResult {
  /** Tasks sorted in dependency order (predecessors before successors).
   *  Within the same topological level, tasks maintain their original order
   *  (milestone_id, then order_index, then id as stable tiebreaker). */
  sorted: RoadmapTask[];
  /** IDs of tasks that are part of dependency cycles (placed at end). */
  cycleTaskIds: Set<string>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Dependency types that imply ordering: predecessor must come before successor.
 * - finish_to_start: B cannot start until A finishes
 * - start_to_start: B starts when A starts, but A is still conceptually first
 *
 * start_to_finish and finish_to_finish are synchronization types
 * that don't imply sequential ordering.
 */
const ORDERING_DEPENDENCY_TYPES: Set<DependencyType> = new Set([
  "finish_to_start",
  "start_to_start",
]);

// ── Internal: Stable comparison key ────────────────────────────────────────────

/**
 * Builds a map from milestone_id to its rank (position by milestone order_index).
 * Tasks without a milestone, or whose milestone is not in the list, rank last.
 */
function buildMilestoneRank(milestones: Milestone[]): Map<string, number> {
  const rank = new Map<string, number>();
  [...milestones]
    .sort((a, b) => a.order_index - b.order_index)
    .forEach((m, i) => rank.set(m.id, i));
  return rank;
}

/**
 * Returns a sort key for stable ordering within the same topological level.
 * Sort order: milestone rank (by milestone order_index, unassigned last),
 * then task order_index, then id.
 */
function stableSortKey(
  task: RoadmapTask,
  milestoneRank: Map<string, number>,
): [number, number, string] {
  const rank = task.milestone_id
    ? milestoneRank.get(task.milestone_id) ?? Number.MAX_SAFE_INTEGER - 1
    : Number.MAX_SAFE_INTEGER;
  return [rank, task.order_index, task.id];
}

function compareStableKeys(
  a: [number, number, string],
  b: [number, number, string],
): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
}

// ── Topological Sort ──────────────────────────────────────────────────────────

/**
 * Sort tasks respecting dependency ordering using Kahn's algorithm.
 *
 * Algorithm:
 * 1. Build adjacency list from dependencies (only ordering types)
 * 2. Initialize processing queue with all zero in-degree nodes,
 *    sorted by stable key (milestone, order_index, id)
 * 3. Dequeue, append to result, decrement successor in-degrees
 * 4. Nodes remaining with non-zero in-degree are cycle members → appended at end
 *
 * Performance: O(V + E) where V = tasks.length, E = dependencies.length.
 * For typical projects (< 500 tasks, < 1000 dependencies), this is negligible.
 */
export function topologicalSortTasks(
  tasks: RoadmapTask[],
  dependencies: TaskDependency[],
  milestones: Milestone[] = [],
): TopologicalSortResult {
  if (tasks.length === 0) {
    return { sorted: [], cycleTaskIds: new Set() };
  }

  const milestoneRank = buildMilestoneRank(milestones);

  // Milestone grouping key: rank by milestone order_index when available,
  // falling back to milestone_id (legacy behavior when milestones not provided).
  const milestoneKey = (t: RoadmapTask): string => {
    if (!t.milestone_id) return "￿"; // unassigned last
    const rank = milestoneRank.get(t.milestone_id);
    return rank !== undefined
      ? String(rank).padStart(10, "0")
      : "￾" + t.milestone_id; // unknown milestones near the end, stable
  };

  if (dependencies.length === 0) {
    // No dependencies — preserve the input order (which comes from the DB query)
    // but group by milestone (in milestone order_index order) and sort by
    // order_index within each milestone. Tasks with the same order_index
    // maintain their DB order (insertion order).
    const sorted = [...tasks].sort((a, b) => {
      const mA = milestoneKey(a);
      const mB = milestoneKey(b);
      if (mA !== mB) return mA < mB ? -1 : 1;
      // Secondary: order_index
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      // Tertiary: preserve original array order (insertion order)
      return tasks.indexOf(a) - tasks.indexOf(b);
    });
    return { sorted, cycleTaskIds: new Set() };
  }

  // Build lookup maps
  const taskMap = new Map<string, RoadmapTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Build adjacency list and in-degree map
  const outEdges = new Map<string, string[]>(); // predecessor -> successors[]
  const inDegree = new Map<string, number>();

  // Initialize in-degree for all tasks
  for (const task of tasks) {
    inDegree.set(task.id, 0);
  }

  // Process only ordering dependency types
  for (const dep of dependencies) {
    if (!ORDERING_DEPENDENCY_TYPES.has(dep.dependency_type)) continue;
    // Skip edges referencing tasks not in our list (orphan protection)
    if (!taskMap.has(dep.predecessor_id) || !taskMap.has(dep.successor_id)) continue;
    // Skip self-referencing edges (shouldn't exist, but defensive)
    if (dep.predecessor_id === dep.successor_id) continue;

    if (!outEdges.has(dep.predecessor_id)) {
      outEdges.set(dep.predecessor_id, []);
    }
    outEdges.get(dep.predecessor_id)!.push(dep.successor_id);
    inDegree.set(dep.successor_id, (inDegree.get(dep.successor_id) ?? 0) + 1);
  }

  // Initialize queue with zero in-degree nodes, sorted by stable key
  const queue: RoadmapTask[] = tasks.filter((t) => inDegree.get(t.id) === 0);
  queue.sort((a, b) =>
    compareStableKeys(stableSortKey(a, milestoneRank), stableSortKey(b, milestoneRank)),
  );

  const result: RoadmapTask[] = [];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const task = queue.shift()!;
    if (processed.has(task.id)) continue;

    processed.add(task.id);
    result.push(task);

    // Decrement in-degree of successors
    const successors = outEdges.get(task.id) ?? [];
    for (const succId of successors) {
      const currentDeg = inDegree.get(succId) ?? 0;
      const newDeg = currentDeg - 1;
      inDegree.set(succId, newDeg);
      if (newDeg === 0 && !processed.has(succId)) {
        queue.push(taskMap.get(succId)!);
      }
    }

    // Re-sort queue to maintain stable ordering within the same level
    queue.sort((a, b) =>
      compareStableKeys(stableSortKey(a, milestoneRank), stableSortKey(b, milestoneRank)),
    );
  }

  // Nodes not processed are part of cycles
  const cycleTaskIds = new Set<string>();
  for (const task of tasks) {
    if (!processed.has(task.id)) {
      cycleTaskIds.add(task.id);
    }
  }

  // Append cycle members in stable order at the end
  const cycleTasks = tasks
    .filter((t) => cycleTaskIds.has(t.id))
    .sort((a, b) =>
      compareStableKeys(stableSortKey(a, milestoneRank), stableSortKey(b, milestoneRank)),
    );

  result.push(...cycleTasks);

  return { sorted: result, cycleTaskIds };
}

// ── Milestone Grouped Sort ─────────────────────────────────────────────────────

/**
 * Sort tasks within each milestone group using topological sort.
 *
 * Milestones themselves are ordered by milestone `order_index`.
 * Cross-milestone dependencies are respected — the global topological sort
 * ensures predecessors appear before successors even across milestone boundaries.
 * After the global sort, tasks are grouped by milestone_id in milestone order.
 *
 * Tasks without a milestone are placed in a "__unassigned" group at the end.
 *
 * @returns Record where keys are milestone IDs (or "__unassigned"),
 *          with values being the topologically-sorted tasks for that milestone.
 */
export function sortTasksByMilestoneAndDependency(
  tasks: RoadmapTask[],
  dependencies: TaskDependency[],
  milestones: Milestone[],
): Record<string, RoadmapTask[]> {
  const { sorted } = topologicalSortTasks(tasks, dependencies, milestones);

  // Build milestone order map for sorting keys
  const milestoneOrder = new Map<string, number>();
  const sortedMilestones = [...milestones].sort(
    (a, b) => a.order_index - b.order_index,
  );
  sortedMilestones.forEach((m, i) => milestoneOrder.set(m.id, i));

  // Group by milestone_id
  const grouped: Record<string, RoadmapTask[]> = {};

  // Initialize milestone keys in order
  for (const m of sortedMilestones) {
    grouped[m.id] = [];
  }
  grouped["__unassigned"] = [];

  // Distribute sorted tasks into groups
  for (const task of sorted) {
    const key = task.milestone_id ?? "__unassigned";
    if (!grouped[key]) {
      grouped[key] = []; // milestone not in the provided list
    }
    grouped[key].push(task);
  }

  return grouped;
}