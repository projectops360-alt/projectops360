// ============================================================================
// ProjectOps360° — Task Execution Map · View Model (pure, deterministic)
// ============================================================================
// Builds the mind-map view model the canvas renders: parent task as the
// central node, subtasks branching out, blocker nodes attached to affected
// subtasks (alert edges), dependency nodes with dotted edges, critical-path
// emphasis, filters, search, grouping, and three layouts (radial /
// hierarchical / left-to-right). Pure data — the map is operational, never
// decorative: every visual flag maps to a record-backed fact.
// ============================================================================

import {
  isActiveSubtask,
  isSubtaskOverdue,
  effectiveSubtaskProgress,
  type Subtask,
  type SubtaskStatus,
} from "./types";
import { computeParentProgress, deriveParentSignals, type ParentSubtaskSignals } from "./progress";

// ── Model types ───────────────────────────────────────────────────────────────

export type ExecutionMapLayout = "radial" | "hierarchical" | "left_to_right";
export type ExecutionMapGrouping = "none" | "status" | "owner" | "phase" | "priority";

export interface ExecutionMapFilters {
  statuses?: SubtaskStatus[];
  ownerId?: string | null;
  onlyBlocked?: boolean;
  onlyOverdue?: boolean;
  onlyCritical?: boolean;
  search?: string;
}

export interface ParentTaskInfo {
  id: string;
  title: string;
  status: string;
  progress: number;
  ownerId: string | null;
  ownerName: string | null;
  isCritical: boolean;
  estimateHours: number | null;
  actualHours: number | null;
}

export interface ExternalDependencyInfo {
  id: string;
  title: string;
  status: string;
  /** The subtask (or parent task) this dependency gates. */
  gatesSubtaskId: string | null;
}

export interface ExecutionMapNode {
  id: string;
  kind: "parent" | "subtask" | "blocker" | "dependency" | "group";
  x: number;
  y: number;
  data: Record<string, unknown>;
}

export interface ExecutionMapEdge {
  id: string;
  source: string;
  target: string;
  kind: "branch" | "blocker" | "dependency";
  /** Dotted rendering for dependencies; alert styling for blockers. */
  dashed: boolean;
  alert: boolean;
  emphasized: boolean; // critical-path edge treatment
}

export interface ExecutionMapModel {
  nodes: ExecutionMapNode[];
  edges: ExecutionMapEdge[];
  signals: ParentSubtaskSignals;
  /** Ids hidden by active filters (for honest "N hidden by filters" notice). */
  hiddenSubtaskIds: string[];
}

// ── Filtering / search (pure) ─────────────────────────────────────────────────

export function filterSubtasks(
  subtasks: readonly Subtask[],
  filters: ExecutionMapFilters,
  asOf: Date,
): { visible: Subtask[]; hidden: Subtask[] } {
  const visible: Subtask[] = [];
  const hidden: Subtask[] = [];
  const search = filters.search?.trim().toLowerCase() ?? "";
  for (const s of subtasks) {
    let keep = true;
    if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(s.status)) keep = false;
    if (keep && filters.ownerId !== undefined && filters.ownerId !== null && s.owner_id !== filters.ownerId) keep = false;
    if (keep && filters.onlyBlocked && s.status !== "blocked") keep = false;
    if (keep && filters.onlyOverdue && !isSubtaskOverdue(s, asOf)) keep = false;
    if (keep && filters.onlyCritical && !s.is_critical) keep = false;
    if (keep && search && !s.title.toLowerCase().includes(search)) keep = false;
    (keep ? visible : hidden).push(s);
  }
  return { visible, hidden };
}

// ── Grouping (pure) ───────────────────────────────────────────────────────────

export function groupSubtasks(
  subtasks: readonly Subtask[],
  grouping: ExecutionMapGrouping,
  sprintOf?: (s: Subtask) => string | null,
): Map<string, Subtask[]> {
  const groups = new Map<string, Subtask[]>();
  const keyOf = (s: Subtask): string => {
    switch (grouping) {
      case "status":
        return s.status;
      case "owner":
        return s.owner_id ?? "unassigned";
      case "priority":
        return s.priority;
      case "phase":
        return sprintOf?.(s) ?? "no_phase";
      default:
        return "all";
    }
  };
  for (const s of subtasks) {
    const key = keyOf(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}

// ── Layouts (pure coordinate functions) ───────────────────────────────────────

const NODE_W = 260;
const NODE_H = 120;
const GAP_X = 60;
const GAP_Y = 40;

function radialPositions(count: number, radius: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Start at -90° (top) and go clockwise, deterministic.
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, count);
    out.push({ x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) });
  }
  return out;
}

// ── Model builder ─────────────────────────────────────────────────────────────

export interface BuildExecutionMapArgs {
  parent: ParentTaskInfo;
  subtasks: readonly Subtask[];
  dependencies?: readonly ExternalDependencyInfo[];
  ownerNames?: Readonly<Record<string, string>>;
  filters?: ExecutionMapFilters;
  grouping?: ExecutionMapGrouping;
  layout?: ExecutionMapLayout;
  /** Collapse into group nodes automatically above this many visible subtasks. */
  autoGroupThreshold?: number;
  /** Group keys the user expanded (when auto-grouped). */
  expandedGroups?: readonly string[];
  sprintOf?: (s: Subtask) => string | null;
  asOf: Date;
}

export function buildExecutionMapModel(args: BuildExecutionMapArgs): ExecutionMapModel {
  const {
    parent,
    subtasks,
    dependencies = [],
    ownerNames = {},
    filters = {},
    grouping = "none",
    layout = "radial",
    autoGroupThreshold = 24,
    expandedGroups = [],
    asOf,
  } = args;

  const { visible, hidden } = filterSubtasks(subtasks, filters, asOf);
  const signals = deriveParentSignals(subtasks, asOf);
  const parentCalc = computeParentProgress(subtasks);

  const nodes: ExecutionMapNode[] = [];
  const edges: ExecutionMapEdge[] = [];

  // ── Parent (central) node ──
  nodes.push({
    id: `task:${parent.id}`,
    kind: "parent",
    x: 0,
    y: 0,
    data: {
      title: parent.title,
      status: parent.status,
      // Calculated from subtasks when they exist; manual behavior otherwise.
      progress: parentCalc ? parentCalc.progress : parent.progress,
      progressSource: parentCalc ? "subtasks" : "manual",
      modeUsed: parentCalc?.modeUsed ?? null,
      ownerId: parent.ownerId,
      ownerName: parent.ownerName,
      isCritical: parent.isCritical,
      completedCount: signals.completedCount,
      activeCount: signals.activeCount,
      blockedCount: signals.blockedCount,
      overdueCount: signals.overdueCount,
      estimatedHours: parent.estimateHours ?? signals.estimatedHours,
      actualHours: parent.actualHours ?? signals.actualHours,
      varianceHours: signals.varianceHours,
      criticalAtRisk: signals.criticalAtRisk,
    },
  });

  // ── Auto-grouping for large maps (performance + clutter control) ──
  const effectiveGrouping: ExecutionMapGrouping =
    grouping === "none" && visible.length > autoGroupThreshold ? "status" : grouping;

  type Branch =
    | { type: "subtask"; subtask: Subtask }
    | { type: "group"; key: string; members: Subtask[] };

  const branches: Branch[] = [];
  if (effectiveGrouping === "none") {
    for (const s of visible) branches.push({ type: "subtask", subtask: s });
  } else {
    const groups = groupSubtasks(visible, effectiveGrouping, args.sprintOf);
    for (const [key, members] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (expandedGroups.includes(key)) {
        for (const s of members) branches.push({ type: "subtask", subtask: s });
      } else {
        branches.push({ type: "group", key, members });
      }
    }
  }

  // ── Branch coordinates per layout ──
  const coords: { x: number; y: number }[] = (() => {
    const n = branches.length;
    if (layout === "radial") {
      const ringRadius = Math.max(360, 90 + n * 26);
      return radialPositions(n, ringRadius);
    }
    if (layout === "hierarchical") {
      // Parent on top, children in rows below.
      const perRow = Math.max(1, Math.ceil(Math.sqrt(n)));
      return branches.map((_, i) => ({
        x: (i % perRow) * (NODE_W + GAP_X) - ((perRow - 1) * (NODE_W + GAP_X)) / 2,
        y: 220 + Math.floor(i / perRow) * (NODE_H + GAP_Y),
      }));
    }
    // left_to_right: parent on the left, children in a column to the right.
    return branches.map((_, i) => ({
      x: NODE_W + 220,
      y: i * (NODE_H + GAP_Y) - ((n - 1) * (NODE_H + GAP_Y)) / 2,
    }));
  })();

  branches.forEach((branch, i) => {
    const { x, y } = coords[i];
    if (branch.type === "group") {
      const groupId = `group:${branch.key}`;
      const blockedInGroup = branch.members.filter((s) => s.status === "blocked").length;
      const overdueInGroup = branch.members.filter((s) => isSubtaskOverdue(s, asOf)).length;
      nodes.push({
        id: groupId,
        kind: "group",
        x,
        y,
        data: {
          groupKey: branch.key,
          grouping: effectiveGrouping,
          count: branch.members.length,
          blockedCount: blockedInGroup,
          overdueCount: overdueInGroup,
          completedCount: branch.members.filter((s) => s.status === "completed").length,
        },
      });
      edges.push({
        id: `edge:parent->${groupId}`,
        source: `task:${parent.id}`,
        target: groupId,
        kind: "branch",
        dashed: false,
        alert: blockedInGroup > 0,
        emphasized: false,
      });
      return;
    }

    const s = branch.subtask;
    const overdue = isSubtaskOverdue(s, asOf);
    const nodeId = `subtask:${s.id}`;
    nodes.push({
      id: nodeId,
      kind: "subtask",
      x,
      y,
      data: {
        subtaskId: s.id,
        title: s.title,
        status: s.status,
        progress: effectiveSubtaskProgress(s),
        priority: s.priority,
        ownerId: s.owner_id,
        ownerName: s.owner_id ? (ownerNames[s.owner_id] ?? null) : null,
        dueDate: s.due_date,
        weight: s.weight,
        estimatedHours: s.estimated_hours,
        actualHours: s.actual_hours,
        isCritical: s.is_critical,
        isBlocked: s.status === "blocked",
        isOverdue: overdue,
        isCompleted: s.status === "completed",
        isCancelled: s.status === "cancelled",
        /** Cancelled/completed render muted/faded; excluded from active math. */
        muted: s.status === "cancelled" || s.status === "completed",
      },
    });
    edges.push({
      id: `edge:parent->${nodeId}`,
      source: `task:${parent.id}`,
      target: nodeId,
      kind: "branch",
      dashed: false,
      alert: s.status === "blocked" || (s.is_critical && overdue),
      emphasized: s.is_critical,
    });

    // ── Blocker node attached to the affected subtask ──
    if (s.status === "blocked") {
      const blockerId = `blocker:${s.id}`;
      const blockedSince = s.blocked_at ?? s.updated_at;
      const ageDays = Math.max(
        0,
        Math.floor((asOf.getTime() - new Date(blockedSince).getTime()) / 86_400_000),
      );
      nodes.push({
        id: blockerId,
        kind: "blocker",
        x: x + (layout === "left_to_right" ? NODE_W + 80 : 0),
        y: y + (layout === "left_to_right" ? 0 : NODE_H + 50),
        data: {
          subtaskId: s.id,
          reason: s.blocked_reason ?? null,
          ageDays,
          ownerId: s.owner_id,
          ownerName: s.owner_id ? (ownerNames[s.owner_id] ?? null) : null,
          impact: s.is_critical ? "critical" : "normal",
          affectsCriticalPath: s.is_critical,
        },
      });
      edges.push({
        id: `edge:${blockerId}->${nodeId}`,
        source: blockerId,
        target: nodeId,
        kind: "blocker",
        dashed: false,
        alert: true,
        emphasized: s.is_critical,
      });
    }
  });

  // ── External dependency nodes (dotted edges) ──
  dependencies.forEach((dep, i) => {
    const depId = `dependency:${dep.id}`;
    const target = dep.gatesSubtaskId ? `subtask:${dep.gatesSubtaskId}` : `task:${parent.id}`;
    // Skip dependencies whose gated subtask is filtered out or grouped away.
    if (dep.gatesSubtaskId && !nodes.some((n) => n.id === target)) return;
    nodes.push({
      id: depId,
      kind: "dependency",
      x: -(NODE_W + 200),
      y: i * (NODE_H + GAP_Y) - ((dependencies.length - 1) * (NODE_H + GAP_Y)) / 2,
      data: { title: dep.title, status: dep.status },
    });
    edges.push({
      id: `edge:${depId}->${target}`,
      source: depId,
      target,
      kind: "dependency",
      dashed: true,
      alert: false,
      emphasized: false,
    });
  });

  return { nodes, edges, signals, hiddenSubtaskIds: hidden.map((s) => s.id) };
}

// ── Dashboard aggregation (Workboard chips / card badges) ─────────────────────

export interface SubtaskDashboardSummary {
  byTask: Record<
    string,
    { total: number; active: number; completed: number; blocked: number; overdue: number }
  >;
  totals: { blocked: number; overdue: number };
}

export function aggregateSubtaskSignals(
  subtasks: readonly Pick<Subtask, "task_id" | "status" | "due_date">[],
  asOf: Date,
): SubtaskDashboardSummary {
  const byTask: SubtaskDashboardSummary["byTask"] = {};
  let blockedTotal = 0;
  let overdueTotal = 0;
  for (const s of subtasks) {
    const entry = (byTask[s.task_id] ??= { total: 0, active: 0, completed: 0, blocked: 0, overdue: 0 });
    entry.total += 1;
    if (isActiveSubtask(s)) entry.active += 1;
    if (s.status === "completed") entry.completed += 1;
    if (s.status === "blocked") {
      entry.blocked += 1;
      blockedTotal += 1;
    }
    if (isSubtaskOverdue(s, asOf)) {
      entry.overdue += 1;
      overdueTotal += 1;
    }
  }
  return { byTask, totals: { blocked: blockedTotal, overdue: overdueTotal } };
}
