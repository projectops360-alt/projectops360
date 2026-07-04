// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY — arg schemas + result serializers (pure)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  queryTasksArgsSchema,
  queryProjectDataArgsSchema,
  TOOL_LIMIT_MAX,
} from "@/lib/isabella/tools/schemas";
import { sanitizeTaskRows, toolFailure } from "@/lib/isabella/tools/serializers";
import type { TaskReportRow } from "@/lib/isabella/task-report";

describe("query_tasks arg schema", () => {
  it("accepts valid args", () => {
    expect(queryTasksArgsSchema.safeParse({ has_milestone: false, limit: 50, order_by: "due_date", order_direction: "desc" }).success).toBe(true);
  });
  it("rejects unknown keys (strict) and bad enums", () => {
    expect(queryTasksArgsSchema.safeParse({ drop_table: "x" }).success).toBe(false);
    expect(queryTasksArgsSchema.safeParse({ order_by: "ssn" }).success).toBe(false);
    expect(queryTasksArgsSchema.safeParse({ priority: ["p9"] }).success).toBe(false);
  });
  it("rejects a limit over the max", () => {
    expect(queryTasksArgsSchema.safeParse({ limit: TOOL_LIMIT_MAX + 1 }).success).toBe(false);
  });
});

describe("query_project_data arg schema", () => {
  it("accepts a valid generic query", () => {
    const r = queryProjectDataArgsSchema.safeParse({
      entity: "task",
      filters: [{ field: "milestone", operator: "is_null" }],
      sort: [{ field: "title", direction: "desc" }],
      aggregation: "list",
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown entity + unknown operator + extra keys", () => {
    expect(queryProjectDataArgsSchema.safeParse({ entity: "users" }).success).toBe(false);
    expect(queryProjectDataArgsSchema.safeParse({ entity: "task", filters: [{ field: "x", operator: "DROP" }] }).success).toBe(false);
    expect(queryProjectDataArgsSchema.safeParse({ entity: "task", raw_sql: "select 1" }).success).toBe(false);
  });
});

describe("serializers — no raw rows to the LLM", () => {
  function row(o: Partial<TaskReportRow>): TaskReportRow {
    return {
      id: o.id ?? "abc", title: o.title ?? "T", status: o.status ?? "not_started",
      milestoneId: o.milestoneId ?? "m-uuid", milestoneTitle: o.milestoneTitle ?? "Design", priority: o.priority ?? "p1",
      ownerId: o.ownerId ?? "owner-uuid", ownerName: o.ownerName ?? "Ana", dueDate: o.dueDate ?? "2026-08-01",
      updatedAt: o.updatedAt ?? null, createdAt: o.createdAt ?? null, isBlocked: o.isBlocked ?? false,
      blockerReason: o.blockerReason ?? null, isSubtask: o.isSubtask ?? false,
    };
  }
  it("drops raw ids (ownerId/milestoneId), exposes opaque ref + names", () => {
    const { rows, truncated } = sanitizeTaskRows([row({ id: "t1" })], 50);
    expect(truncated).toBe(false);
    const r = rows[0];
    expect(r).toEqual({ ref: "task:t1", title: "T", status: "not_started", priority: "p1", milestone: "Design", owner: "Ana", dueDate: "2026-08-01", isSubtask: false });
    expect(JSON.stringify(r)).not.toContain("owner-uuid");
    expect(JSON.stringify(r)).not.toContain("m-uuid");
  });
  it("truncates to the limit and flags it", () => {
    const many = Array.from({ length: 5 }, (_, i) => row({ id: `t${i}` }));
    const { rows, truncated } = sanitizeTaskRows(many, 2);
    expect(rows).toHaveLength(2);
    expect(truncated).toBe(true);
  });
  it("toolFailure never invents rows", () => {
    const f = toolFailure("empty", "none");
    expect(f.rowCount).toBe(0);
    expect(f.rows).toBeUndefined();
  });
});
