// ============================================================================
// ProjectOps360° — Living Graph · Milestone Focus Map layout (pure)
// ============================================================================
// LIVING-GRAPH-MILESTONE-FOCUS-LAYOUT-READABILITY
//
// When a user drills into ONE milestone ("View flow"), the generic auto-layout
// scatters its tasks. This module computes a DETERMINISTIC, compact, status-
// grouped, dependency-ordered focus layout — a readable execution mind map —
// WITHOUT touching canonical data, the global graph, or the graph system.
//
// Pure + deterministic: same input → same positions. Synthetic milestone_chain
// edges are NOT real dependencies (LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY).
// ============================================================================

import type { LivingGraphNode, LivingGraphEdge } from "@/types/living-graph";
import type { SavedGraphLayout } from "./graph-layout-storage";

export type MilestoneFocusLayoutMode = "flow" | "mind_map";

export type MilestoneFocusGroupKey =
  | "blocked"
  | "in_progress"
  | "not_started"
  | "done"
  | "unsequenced"
  | "cycle_conflict"
  | "external_dependencies";

/** Lane order (top-priority first). External deps render as compact summaries. */
export const FOCUS_GROUP_ORDER: MilestoneFocusGroupKey[] = [
  "blocked",
  "in_progress",
  "not_started",
  "done",
  "unsequenced",
  "cycle_conflict",
];

export interface PositionedFocusNode {
  id: string;
  x: number;
  y: number;
  group: MilestoneFocusGroupKey;
  /** Deterministic topological level within the milestone (0 = no predecessor). */
  level: number;
}

export interface MilestoneFocusGroup {
  key: MilestoneFocusGroupKey;
  nodeIds: string[];
}

export interface ExternalDependencySummary {
  direction: "predecessor" | "successor";
  /** The external node id (opaque) and its label. */
  nodeId: string;
  label: string;
  /** The focus task id it connects to. */
  relatedTaskId: string;
}

export interface CycleWarning {
  nodeIds: string[];
}

export interface MilestoneFocusLayoutInput {
  selectedMilestoneId: string;
  nodes: LivingGraphNode[];
  edges: LivingGraphEdge[];
  savedLayout?: SavedGraphLayout | null;
  mode?: MilestoneFocusLayoutMode;
}

export interface MilestoneFocusLayoutResult {
  nodes: PositionedFocusNode[];
  groups: MilestoneFocusGroup[];
  externalDependencySummaries: ExternalDependencySummary[];
  cycleWarnings: CycleWarning[];
  appliedSavedLayout: boolean;
  ignoredSavedLayoutReason?: string;
  fitView: true;
}

// ── Spacing (compact, bounded) ───────────────────────────────────────────────
const GROUP_X_SPACING = 320;
const TASK_Y_SPACING = 108;
const GROUP_TOP_PADDING = 0;
// Mind-map (radial fan): tasks fan out to the RIGHT of a central root, spread
// vertically around the center with a gentle horizontal arc — the NotebookLM look.
const MINDMAP_RADIUS_X = 380;
const MINDMAP_TASK_Y = 96;
const MINDMAP_ARC_STEP = 10;
/** Center anchor for the (conceptual/rendered) milestone root node. */
export const MILESTONE_FOCUS_ROOT_POSITION = { x: 0, y: 0 } as const;

// ── Status → group ───────────────────────────────────────────────────────────
const DONE = new Set(["done", "completed", "tested"]);
const STARTED = new Set(["in_progress", "implemented", "sent_to_ai"]);
const PLANNED = new Set(["not_started", "prompt_ready", "planned", "deferred"]);

/** Belongs to the selected milestone (defensive; the caller usually pre-filters). */
function isMilestoneTask(n: LivingGraphNode, milestoneId: string): boolean {
  return n.milestoneId === milestoneId;
}

function groupForNode(n: LivingGraphNode, inCycle: boolean): MilestoneFocusGroupKey {
  if (inCycle) return "cycle_conflict";
  const s = (n.status ?? "").toLowerCase();
  if (n.isBlocked || s === "blocked") return "blocked";
  if (DONE.has(s)) return "done";
  if (STARTED.has(s)) return "in_progress";
  if (PLANNED.has(s)) return "not_started";
  return "unsequenced";
}

// ── Real internal dependency edges (exclude synthetic milestone_chain) ───────
const DEPENDENCY_EDGE_TYPES = new Set([
  "caused", "enabled", "blocked", "requires_material", "requires_resource", "requires_approval", "supplied_by",
]);

function isRealDependencyEdge(e: LivingGraphEdge): boolean {
  if (!DEPENDENCY_EDGE_TYPES.has(e.edgeType)) return false;
  if (e.metadata?.milestone_chain === true) return false;
  return true;
}

/** Adjacency (predecessor → successors) over INTERNAL real dependencies only. */
export function buildInternalDepGraph(
  taskIds: Set<string>,
  edges: LivingGraphEdge[],
): { succ: Map<string, string[]>; indeg: Map<string, number> } {
  const succ = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of taskIds) {
    succ.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    if (!isRealDependencyEdge(e)) continue;
    if (!taskIds.has(e.sourceNodeId) || !taskIds.has(e.targetNodeId)) continue;
    if (e.sourceNodeId === e.targetNodeId) continue;
    succ.get(e.sourceNodeId)!.push(e.targetNodeId);
    indeg.set(e.targetNodeId, (indeg.get(e.targetNodeId) ?? 0) + 1);
  }
  return { succ, indeg };
}

/**
 * Deterministic topological levels (Kahn). Returns a level per node and the set
 * of nodes that could NOT be leveled (i.e. participate in a cycle). Never throws.
 */
export function topologicallyOrderMilestoneTasks(
  taskIds: Set<string>,
  edges: LivingGraphEdge[],
): { level: Map<string, number>; cycleNodeIds: Set<string> } {
  const { succ, indeg } = buildInternalDepGraph(taskIds, edges);
  const level = new Map<string, number>();
  const localIndeg = new Map(indeg);
  // Deterministic queue: sorted ids at each wave.
  let frontier = [...taskIds].filter((id) => (localIndeg.get(id) ?? 0) === 0).sort();
  let lvl = 0;
  const seen = new Set<string>();
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      level.set(id, lvl);
      for (const t of (succ.get(id) ?? []).slice().sort()) {
        localIndeg.set(t, (localIndeg.get(t) ?? 0) - 1);
        if ((localIndeg.get(t) ?? 0) === 0) next.push(t);
      }
    }
    frontier = [...new Set(next)].sort();
    lvl += 1;
  }
  const cycleNodeIds = new Set<string>();
  for (const id of taskIds) if (!seen.has(id)) cycleNodeIds.add(id);
  return { level, cycleNodeIds };
}

/** The set of node ids inside a dependency cycle (never throws / never crashes). */
export function detectMilestoneTaskCycles(taskIds: Set<string>, edges: LivingGraphEdge[]): Set<string> {
  return topologicallyOrderMilestoneTasks(taskIds, edges).cycleNodeIds;
}

/** Assign each milestone task to exactly one deterministic status group. */
export function groupMilestoneTasks(
  tasks: LivingGraphNode[],
  cycleNodeIds: Set<string>,
): Map<MilestoneFocusGroupKey, LivingGraphNode[]> {
  const groups = new Map<MilestoneFocusGroupKey, LivingGraphNode[]>();
  for (const key of FOCUS_GROUP_ORDER) groups.set(key, []);
  for (const t of tasks) {
    const key = groupForNode(t, cycleNodeIds.has(t.id));
    groups.get(key)!.push(t);
  }
  return groups;
}

/** Compact external predecessor/successor summaries (never scattered nodes). */
export function summarizeExternalDependencies(
  selectedMilestoneId: string,
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): ExternalDependencySummary[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inMilestone = new Set(nodes.filter((n) => isMilestoneTask(n, selectedMilestoneId)).map((n) => n.id));
  const out: ExternalDependencySummary[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!isRealDependencyEdge(e)) continue;
    const srcIn = inMilestone.has(e.sourceNodeId);
    const tgtIn = inMilestone.has(e.targetNodeId);
    if (srcIn === tgtIn) continue; // internal or fully-external
    const externalId = srcIn ? e.targetNodeId : e.sourceNodeId;
    const relatedTaskId = srcIn ? e.sourceNodeId : e.targetNodeId;
    const key = `${externalId}->${relatedTaskId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      direction: srcIn ? "successor" : "predecessor",
      nodeId: externalId,
      label: byId.get(externalId)?.label ?? externalId,
      relatedTaskId,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label) || a.nodeId.localeCompare(b.nodeId));
}

// ── Saved-layout scoping ─────────────────────────────────────────────────────

/** Layout-context key for a milestone focus map (distinct from global keys). */
export function getMilestoneFocusLayoutKey(projectId: string, selectedMilestoneId: string): string {
  return `milestone-focus:${projectId}:${selectedMilestoneId}`;
}

/**
 * A saved layout may apply to focus mode ONLY when it was saved for THIS focus
 * key AND its node set exactly matches the focused nodes. A global saved layout
 * (different key / different node set) is NEVER partially applied to focus mode.
 */
export function shouldApplySavedFocusLayout(input: {
  saved: SavedGraphLayout | null | undefined;
  focusKey: string;
  nodeIds: readonly string[];
}): { apply: boolean; reason?: string } {
  const { saved, focusKey, nodeIds } = input;
  if (!saved) return { apply: false, reason: "no_saved_layout" };
  if (saved.layoutKey !== focusKey) return { apply: false, reason: "different_context" };
  const savedIds = Object.keys(saved.nodes);
  if (savedIds.length !== nodeIds.length) return { apply: false, reason: "node_set_mismatch" };
  const live = new Set(nodeIds);
  for (const id of savedIds) if (!live.has(id)) return { apply: false, reason: "node_set_mismatch" };
  return { apply: true };
}

// ── Main layout ──────────────────────────────────────────────────────────────

function priorityRank(n: LivingGraphNode): number {
  const p = (n.metadata?.priority as string) ?? "";
  if (p === "p1") return 0;
  if (p === "p2") return 1;
  if (p === "p3") return 2;
  return 3;
}

/**
 * Compute the deterministic milestone focus layout. Positions EVERY input node
 * (milestone tasks in status lanes ordered by dependency level; any non-matching
 * node falls into `unsequenced` so nothing is left at 0,0). Compact + bounded.
 */
export function computeMilestoneFocusLayout(input: MilestoneFocusLayoutInput): MilestoneFocusLayoutResult {
  const { selectedMilestoneId, nodes, edges } = input;
  const mode: MilestoneFocusLayoutMode = input.mode ?? "mind_map";

  const milestoneTasks = nodes.filter((n) => isMilestoneTask(n, selectedMilestoneId));
  // Leftover = nodes that belong via a parent (subtasks / misc with NO milestone).
  // Nodes with a DIFFERENT milestoneId are external → summarized, never positioned.
  const leftover = nodes.filter((n) => n.milestoneId == null);
  const taskIds = new Set(milestoneTasks.map((n) => n.id));

  const { level, cycleNodeIds } = topologicallyOrderMilestoneTasks(taskIds, edges);
  const groups = groupMilestoneTasks(milestoneTasks, cycleNodeIds);
  // Leftover nodes (e.g. expanded subtasks with no milestoneId) → unsequenced.
  for (const n of leftover) groups.get("unsequenced")!.push(n);

  const resultGroups: MilestoneFocusGroup[] = [];
  // Deterministic within-lane order: level → priority → title → id.
  const orderInLane = (a: LivingGraphNode, b: LivingGraphNode): number => {
    const la = level.get(a.id) ?? 0;
    const lb = level.get(b.id) ?? 0;
    if (la !== lb) return la - lb;
    const pa = priorityRank(a);
    const pb = priorityRank(b);
    if (pa !== pb) return pa - pb;
    const byLabel = (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" });
    if (byLabel !== 0) return byLabel;
    return a.id.localeCompare(b.id);
  };

  // Ordered groups (drives both the groups report and the flat mind-map order).
  const orderedGroups = FOCUS_GROUP_ORDER.map((key) => {
    const ordered = [...(groups.get(key) ?? [])].sort(orderInLane);
    resultGroups.push({ key, nodeIds: ordered.map((n) => n.id) });
    return { key, nodes: ordered };
  });

  const positioned: PositionedFocusNode[] = [];

  if (mode === "flow") {
    // Compact status lanes (columns): milestone root at left, groups to the right.
    orderedGroups.forEach(({ key, nodes: laneNodes }, columnIndex) => {
      const x = columnIndex * GROUP_X_SPACING;
      laneNodes.forEach((n, i) => {
        positioned.push({ id: n.id, x, y: GROUP_TOP_PADDING + i * TASK_Y_SPACING, group: key, level: level.get(n.id) ?? 0 });
      });
    });
  } else {
    // Mind-map (NotebookLM): tasks fan out to the RIGHT of the central root,
    // spread vertically around the center with a gentle horizontal arc so the
    // curved branches read like a mind map. Order preserved (group → lane order).
    const flat = orderedGroups.flatMap((g) => g.nodes.map((n) => ({ node: n, group: g.key })));
    const n = flat.length;
    flat.forEach(({ node, group }, i) => {
      const rel = i - (n - 1) / 2; // signed distance from vertical center
      const x = MINDMAP_RADIUS_X + Math.abs(rel) * MINDMAP_ARC_STEP;
      const y = rel * MINDMAP_TASK_Y;
      positioned.push({ id: node.id, x, y, group, level: level.get(node.id) ?? 0 });
    });
  }

  const cycleWarnings: CycleWarning[] = cycleNodeIds.size > 0 ? [{ nodeIds: [...cycleNodeIds].sort() }] : [];

  return {
    nodes: positioned,
    groups: resultGroups,
    externalDependencySummaries: summarizeExternalDependencies(selectedMilestoneId, nodes, edges),
    cycleWarnings,
    appliedSavedLayout: false,
    fitView: true,
  };
}

/** Adapter for the React Flow view: a positions map for every input node. */
export function computeMilestoneFocusPositions(
  input: MilestoneFocusLayoutInput,
): Map<string, { x: number; y: number }> {
  const result = computeMilestoneFocusLayout(input);
  const map = new Map<string, { x: number; y: number }>();
  for (const n of result.nodes) map.set(n.id, { x: n.x, y: n.y });
  return map;
}
