// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE — deterministic filter/sort/group
// ============================================================================

import { describe, it, expect } from "vitest";
import { applyFilters, applySort, applyGrouping } from "@/lib/isabella/query-engine/filter-engine";
import type { TaskReportRow } from "@/lib/isabella/task-report";

let seq = 0;
function row(o: Partial<TaskReportRow> = {}): TaskReportRow {
  seq += 1;
  return {
    id: o.id ?? `t${seq}`,
    title: o.title ?? `Task ${seq}`,
    status: o.status ?? "not_started",
    milestoneId: o.milestoneId ?? null,
    milestoneTitle: o.milestoneTitle ?? null,
    priority: o.priority ?? "p2",
    ownerId: o.ownerId ?? null,
    ownerName: o.ownerName ?? null,
    dueDate: o.dueDate ?? null,
    updatedAt: o.updatedAt ?? "2026-07-01T00:00:00Z",
    createdAt: o.createdAt ?? "2026-07-01T00:00:00Z",
    isBlocked: o.isBlocked ?? false,
    blockerReason: o.blockerReason ?? null,
    isSubtask: o.isSubtask ?? false,
  };
}
const ctx = { asOf: "2026-07-15" };

describe("applyFilters — milestone is_null (the no-milestone case)", () => {
  const rows = [
    row({ id: "a", milestoneId: "m1", milestoneTitle: "Design" }),
    row({ id: "b", milestoneId: null }),
    row({ id: "c", milestoneId: "m2", milestoneTitle: "Build" }),
    row({ id: "d", milestoneId: null }),
  ];

  it("includes ONLY tasks without a milestone", () => {
    const out = applyFilters(rows, [{ field: "milestone", operator: "is_null" }], ctx);
    expect(out.map((r) => r.id).sort()).toEqual(["b", "d"]);
  });

  it("is_not_null excludes tasks without a milestone", () => {
    const out = applyFilters(rows, [{ field: "milestone", operator: "is_not_null" }], ctx);
    expect(out.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });
});

describe("applyFilters — generic operators", () => {
  it("equals/not_equals on enum + boolean, contains, in", () => {
    const rows = [
      row({ id: "a", status: "done", priority: "p1", ownerName: "Ana", isBlocked: true }),
      row({ id: "b", status: "in_progress", priority: "p2", ownerName: "Beto" }),
    ];
    expect(applyFilters(rows, [{ field: "status", operator: "equals", value: "done" }], ctx).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rows, [{ field: "status", operator: "not_equals", value: "done" }], ctx).map((r) => r.id)).toEqual(["b"]);
    expect(applyFilters(rows, [{ field: "priority", operator: "equals", value: "p1" }], ctx).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rows, [{ field: "blocked", operator: "equals", value: true }], ctx).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rows, [{ field: "owner", operator: "contains", value: "bet" }], ctx).map((r) => r.id)).toEqual(["b"]);
  });

  it("overdue = dueDate before asOf (null due never matches)", () => {
    const rows = [
      row({ id: "past", dueDate: "2026-07-01" }),
      row({ id: "future", dueDate: "2026-08-01" }),
      row({ id: "none", dueDate: null }),
    ];
    const out = applyFilters(rows, [{ field: "dueDate", operator: "before", value: "today" }], ctx);
    expect(out.map((r) => r.id)).toEqual(["past"]);
  });

  it("ANDs multiple filters", () => {
    const rows = [
      row({ id: "a", milestoneId: null, ownerId: null }),
      row({ id: "b", milestoneId: null, ownerId: "u1", ownerName: "X" }),
    ];
    const out = applyFilters(rows, [
      { field: "milestone", operator: "is_null" },
      { field: "owner", operator: "is_null" },
    ], ctx);
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("does not mutate the input", () => {
    const rows = [row({ id: "a" })];
    const copy = [...rows];
    applyFilters(rows, [{ field: "blocked", operator: "equals", value: true }], ctx);
    expect(rows).toEqual(copy);
  });
});

describe("applySort + applyGrouping", () => {
  it("sorts by title desc deterministically", () => {
    const rows = [row({ title: "b" }), row({ title: "A" }), row({ title: "c" })];
    expect(applySort(rows, [{ field: "title", direction: "desc" }]).map((r) => r.title)).toEqual(["c", "b", "A"]);
  });

  it("groups by a field with an explicit __none__ bucket last", () => {
    const rows = [
      row({ milestoneTitle: "Design" }),
      row({ milestoneTitle: null }),
      row({ milestoneTitle: "Design" }),
    ];
    const groups = applyGrouping(rows, "milestone");
    expect(groups.map((g) => g.key)).toEqual(["Design", "__none__"]);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].rows).toHaveLength(1);
  });
});
