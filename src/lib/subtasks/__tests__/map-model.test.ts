// ============================================================================
// TASK-EXECUTION-MAP — Map view-model guards
// ============================================================================
// Protects the execution mind-map model: parent central node, subtask branch
// nodes, blocker nodes attached to the affected subtask, dependency nodes with
// dotted edges, critical-path emphasis, muted completed/cancelled, filters
// (status/owner/blocked/overdue/critical), search, grouping, three layouts,
// and the dashboard aggregation (blocked/overdue chips).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildExecutionMapModel,
  filterSubtasks,
  groupSubtasks,
  aggregateSubtaskSignals,
  type ParentTaskInfo,
} from "@/lib/subtasks/map-model";
import type { Subtask } from "@/lib/subtasks/types";

const ASOF = new Date("2026-07-03T12:00:00.000Z");

let seq = 0;
function subtask(overrides: Partial<Subtask> = {}): Subtask {
  seq += 1;
  return {
    id: overrides.id ?? `sub-${seq}`,
    task_id: "task-1",
    project_id: "proj-1",
    organization_id: "org-1",
    title: `Subtask ${seq}`,
    description: null,
    status: "in_progress",
    priority: "p2",
    owner_id: null,
    start_date: null,
    due_date: null,
    completed_at: null,
    estimated_hours: null,
    actual_hours: null,
    weight: null,
    progress: 40,
    is_critical: false,
    blocked_reason: null,
    blocked_at: null,
    sort_order: seq,
    created_by: null,
    updated_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

const PARENT: ParentTaskInfo = {
  id: "task-1",
  title: "Build QA pipeline",
  status: "in_progress",
  progress: 10,
  ownerId: "u1",
  ownerName: "Ana PM",
  isCritical: false,
  estimateHours: null,
  actualHours: null,
};

function build(subtasks: Subtask[], extra: Partial<Parameters<typeof buildExecutionMapModel>[0]> = {}) {
  return buildExecutionMapModel({ parent: PARENT, subtasks, asOf: ASOF, ...extra });
}

describe("map structure", () => {
  it("renders the parent task as the central node with calculated progress + counters", () => {
    const model = build([
      subtask({ status: "completed" }),
      subtask({ status: "in_progress", progress: 50 }),
    ]);
    const parent = model.nodes.find((n) => n.kind === "parent");
    expect(parent).toBeDefined();
    expect(parent!.id).toBe("task:task-1");
    expect(parent!.x).toBe(0);
    expect(parent!.y).toBe(0);
    expect(parent!.data.progressSource).toBe("subtasks");
    expect(parent!.data.progress).toBe(75); // (100+50)/2
    expect(parent!.data.completedCount).toBe(1);
  });

  it("without subtasks the parent keeps its MANUAL progress", () => {
    const model = build([]);
    const parent = model.nodes.find((n) => n.kind === "parent")!;
    expect(parent.data.progressSource).toBe("manual");
    expect(parent.data.progress).toBe(10);
  });

  it("renders one branch node + edge per subtask", () => {
    const model = build([subtask(), subtask(), subtask()]);
    const subtaskNodes = model.nodes.filter((n) => n.kind === "subtask");
    expect(subtaskNodes).toHaveLength(3);
    for (const n of subtaskNodes) {
      expect(model.edges.some((e) => e.source === "task:task-1" && e.target === n.id && e.kind === "branch")).toBe(true);
    }
  });

  it("attaches a blocker node to the AFFECTED subtask with an alert edge", () => {
    const blocked = subtask({
      id: "sub-blocked",
      status: "blocked",
      blocked_reason: "Waiting for QA approval",
      blocked_at: "2026-07-01T00:00:00.000Z",
      is_critical: true,
    });
    const model = build([blocked, subtask()]);
    const blockerNode = model.nodes.find((n) => n.kind === "blocker");
    expect(blockerNode).toBeDefined();
    expect(blockerNode!.id).toBe("blocker:sub-blocked");
    expect(blockerNode!.data.reason).toBe("Waiting for QA approval");
    expect(blockerNode!.data.ageDays).toBe(2);
    expect(blockerNode!.data.affectsCriticalPath).toBe(true);
    const edge = model.edges.find((e) => e.kind === "blocker");
    expect(edge).toBeDefined();
    expect(edge!.source).toBe("blocker:sub-blocked");
    expect(edge!.target).toBe("subtask:sub-blocked");
    expect(edge!.alert).toBe(true);
    expect(edge!.emphasized).toBe(true); // critical path shouts
  });

  it("renders external dependencies as dotted-edge nodes", () => {
    const model = build([subtask()], {
      dependencies: [{ id: "dep-1", title: "API contract", status: "in_progress", gatesSubtaskId: null }],
    });
    const dep = model.nodes.find((n) => n.kind === "dependency");
    expect(dep).toBeDefined();
    const edge = model.edges.find((e) => e.kind === "dependency");
    expect(edge!.dashed).toBe(true);
    expect(edge!.target).toBe("task:task-1");
  });

  it("completed and cancelled subtasks are muted; cancelled excluded from active math", () => {
    const model = build([
      subtask({ status: "completed" }),
      subtask({ status: "cancelled" }),
      subtask({ status: "in_progress" }),
    ]);
    const muted = model.nodes.filter((n) => n.kind === "subtask" && n.data.muted === true);
    expect(muted).toHaveLength(2);
    expect(model.signals.activeCount).toBe(2); // cancelled excluded
  });

  it("overdue subtasks carry the warning flag", () => {
    const model = build([subtask({ due_date: "2026-07-01" })]);
    const node = model.nodes.find((n) => n.kind === "subtask")!;
    expect(node.data.isOverdue).toBe(true);
  });
});

describe("filters + search", () => {
  const fixtures = () => [
    subtask({ id: "a", status: "blocked", blocked_reason: "x", owner_id: "u1", title: "QA cert" }),
    subtask({ id: "b", status: "in_progress", owner_id: "u2", due_date: "2026-07-01" }),
    subtask({ id: "c", status: "completed", owner_id: "u1", is_critical: true }),
  ];

  it("filters by status", () => {
    const { visible } = filterSubtasks(fixtures(), { statuses: ["blocked"] }, ASOF);
    expect(visible.map((s) => s.id)).toEqual(["a"]);
  });

  it("filters by owner", () => {
    const { visible } = filterSubtasks(fixtures(), { ownerId: "u1" }, ASOF);
    expect(visible.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("filters by blocked / overdue / critical", () => {
    expect(filterSubtasks(fixtures(), { onlyBlocked: true }, ASOF).visible.map((s) => s.id)).toEqual(["a"]);
    expect(filterSubtasks(fixtures(), { onlyOverdue: true }, ASOF).visible.map((s) => s.id)).toEqual(["b"]);
    expect(filterSubtasks(fixtures(), { onlyCritical: true }, ASOF).visible.map((s) => s.id)).toEqual(["c"]);
  });

  it("search matches titles case-insensitively", () => {
    const { visible } = filterSubtasks(fixtures(), { search: "qa" }, ASOF);
    expect(visible.map((s) => s.id)).toEqual(["a"]);
  });

  it("hidden subtasks are reported honestly on the model", () => {
    const model = build(fixtures(), { filters: { onlyBlocked: true } });
    expect(model.hiddenSubtaskIds.sort()).toEqual(["b", "c"]);
  });
});

describe("grouping + layouts", () => {
  it("groups by status / owner / priority", () => {
    const rows = [
      subtask({ status: "blocked", blocked_reason: "x", owner_id: "u1", priority: "p1" }),
      subtask({ status: "blocked", blocked_reason: "y", owner_id: null, priority: "p2" }),
      subtask({ status: "completed", owner_id: "u1", priority: "p1" }),
    ];
    expect([...groupSubtasks(rows, "status").keys()].sort()).toEqual(["blocked", "completed"]);
    expect([...groupSubtasks(rows, "owner").keys()].sort()).toEqual(["u1", "unassigned"]);
    expect([...groupSubtasks(rows, "priority").keys()].sort()).toEqual(["p1", "p2"]);
  });

  it("auto-groups into collapsed group nodes above the threshold (clutter control)", () => {
    const many = Array.from({ length: 30 }, () => subtask());
    const model = build(many, { autoGroupThreshold: 24 });
    expect(model.nodes.filter((n) => n.kind === "group").length).toBeGreaterThan(0);
    expect(model.nodes.filter((n) => n.kind === "subtask")).toHaveLength(0);
  });

  it("expanded groups render their member subtasks", () => {
    const many = Array.from({ length: 30 }, () => subtask({ status: "in_progress" }));
    const model = build(many, { autoGroupThreshold: 24, expandedGroups: ["in_progress"] });
    expect(model.nodes.filter((n) => n.kind === "subtask")).toHaveLength(30);
  });

  it("all three layouts produce distinct deterministic coordinates", () => {
    const rows = [subtask(), subtask(), subtask()];
    const radial = build(rows, { layout: "radial" });
    const hier = build(rows, { layout: "hierarchical" });
    const ltr = build(rows, { layout: "left_to_right" });
    const coords = (m: typeof radial) =>
      m.nodes.filter((n) => n.kind === "subtask").map((n) => `${n.x},${n.y}`);
    expect(coords(radial)).not.toEqual(coords(hier));
    expect(coords(hier)).not.toEqual(coords(ltr));
    // Determinism: same input → same coordinates.
    expect(coords(build(rows, { layout: "radial" }))).toEqual(coords(radial));
    // left_to_right puts children to the RIGHT of the parent.
    for (const n of build(rows, { layout: "left_to_right" }).nodes.filter((n) => n.kind === "subtask")) {
      expect(n.x).toBeGreaterThan(0);
    }
  });
});

describe("dashboard aggregation (Workboard chips)", () => {
  it("aggregates blocked and overdue per task + totals", () => {
    const summary = aggregateSubtaskSignals(
      [
        { task_id: "t1", status: "blocked", due_date: null },
        { task_id: "t1", status: "in_progress", due_date: "2026-07-01" },
        { task_id: "t1", status: "completed", due_date: null },
        { task_id: "t2", status: "cancelled", due_date: "2026-07-01" },
      ],
      ASOF,
    );
    expect(summary.byTask["t1"]).toEqual({ total: 3, active: 3, completed: 1, blocked: 1, overdue: 1 });
    // Cancelled never counts as overdue.
    expect(summary.byTask["t2"]).toEqual({ total: 1, active: 0, completed: 0, blocked: 0, overdue: 0 });
    expect(summary.totals).toEqual({ blocked: 1, overdue: 1 });
  });
});
