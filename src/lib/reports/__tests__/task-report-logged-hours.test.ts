import { describe, it, expect, vi } from "vitest";

// ============================================================================
// Task report — Actual hours come from the time log
// ============================================================================
// Guard TIME-TRACKING-REPORT-ACTUAL-HOURS. A task WITH logged time must report
// the sum of that log and never the hand-typed roadmap_tasks.actual_hours. A
// task WITHOUT logged time keeps showing what was captured before the Time
// Tracking Engine existed, so no historical report silently drops to zero.
// ============================================================================

const h = vi.hoisted(() => {
  const ORG = "org-1";
  const TABLE_DATA: Record<string, Record<string, unknown>[]> = {
    projects: [{ id: "p1", organization_id: ORG, title_i18n: { en: "Delivery" }, slug: "delivery", deleted_at: null }],
    roadmap_tasks: [
      // Logged time exists → the log wins over the manual 99.
      { id: "t-logged", organization_id: ORG, project_id: "p1", title: "Has time log", status: "in_progress", priority: "p1", assigned_to: null, assigned_resource_id: null, estimate_hours: 10, actual_hours: 99, progress: 40, end_date: null, deleted_at: null },
      // No logged time → the previously captured number survives.
      { id: "t-manual", organization_id: ORG, project_id: "p1", title: "Legacy manual hours", status: "in_progress", priority: "p2", assigned_to: null, assigned_resource_id: null, estimate_hours: 8, actual_hours: 12, progress: 50, end_date: null, deleted_at: null },
      // Neither → stays empty rather than inventing a zero.
      { id: "t-none", organization_id: ORG, project_id: "p1", title: "Nothing recorded", status: "not_started", priority: "p3", assigned_to: null, assigned_resource_id: null, estimate_hours: 4, actual_hours: null, progress: 0, end_date: null, deleted_at: null },
    ],
    task_subtasks: [
      { id: "s1", organization_id: ORG, project_id: "p1", task_id: "t-logged", title: "Sub with time", status: "in_progress", priority: "p2", owner_id: null, estimated_hours: 6, progress: 50, sort_order: 1, due_date: null, start_date: null, is_critical: false, blocked_reason: null, deleted_at: null },
    ],
    subtask_time_entries: [
      { id: "e1", organization_id: ORG, project_id: "p1", task_id: "t-logged", subtask_id: "s1", duration_hours: 3, deleted_at: null },
      { id: "e2", organization_id: ORG, project_id: "p1", task_id: "t-logged", subtask_id: "s1", duration_hours: 2.5, deleted_at: null },
      // Task-level entry (no subtask) still counts toward the task total.
      { id: "e3", organization_id: ORG, project_id: "p1", task_id: "t-logged", subtask_id: null, duration_hours: 1.5, deleted_at: null },
      // Soft-deleted rows must not be summed.
      { id: "e4", organization_id: ORG, project_id: "p1", task_id: "t-logged", subtask_id: "s1", duration_hours: 40, deleted_at: "2026-07-01T00:00:00Z" },
    ],
    milestones: [],
    resources: [],
    profiles: [],
    risks: [],
    task_dependencies: [],
  };

  function makeBuilder(table: string) {
    let rows = [...(TABLE_DATA[table] ?? [])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: (col: string, val: unknown) => { rows = rows.filter((r) => r[col] === val); return b; },
      in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes(r[col])); return b; },
      is: (col: string, val: unknown) => { rows = rows.filter((r) => (r[col] ?? null) === val); return b; },
      not: (col: string, _op: string, val: unknown) => { rows = rows.filter((r) => (r[col] ?? null) !== val); return b; },
      order: () => b,
      limit: () => b,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
    };
    return b;
  }

  return { ORG, client: { from: (table: string) => makeBuilder(table) } };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import { runReport } from "../query-service";
import type { ReportConfig, ReportRow } from "../types";

const base: Omit<ReportConfig, "columns"> = {
  datasetId: "task_execution",
  filters: [],
  grouping: null,
  sort: [],
  visualization: "table",
};

async function rowsOf(includeSubtasks = false): Promise<ReportRow[]> {
  const result = await runReport(
    { ...base, columns: ["task_name", "estimated_hours", "actual_hours", "logged_hours"], includeSubtasks } as ReportConfig,
    { organizationId: h.ORG, projectId: "p1" },
  );
  if ("error" in result) throw new Error(result.error);
  return result.rows;
}

const byName = async (name: string, includeSubtasks = false) =>
  (await rowsOf(includeSubtasks)).find((r) => r.task_name === name)!;

describe("task report — actual hours source", () => {
  it("uses the time log, not the manual field, when time was logged", async () => {
    const row = await byName("Has time log");
    // 3 + 2.5 + 1.5 = 7 — the manual 99 is ignored entirely.
    expect(row.actual_hours).toBe(7);
    expect(row.logged_hours).toBe(7);
  });

  it("keeps the previously captured value when nothing was logged", async () => {
    const row = await byName("Legacy manual hours");
    expect(row.actual_hours).toBe(12);
    expect(row.logged_hours).toBe(0);
  });

  it("stays empty when there is neither a log nor a manual value", async () => {
    const row = await byName("Nothing recorded");
    expect(row.actual_hours).toBeNull();
    expect(row.logged_hours).toBe(0);
  });

  it("ignores soft-deleted entries", async () => {
    const row = await byName("Has time log");
    expect(row.actual_hours).not.toBe(47); // 7 + the deleted 40
  });

  it("recomputes variance from the logged hours", async () => {
    const row = await byName("Has time log");
    expect(row.hours_variance).toBe(-3);      // 7 logged − 10 estimated
    expect(row.hours_variance_pct).toBe(-30);
  });
});

describe("task report — subtask rows", () => {
  it("a subtask's actual hours ARE its time log", async () => {
    const row = await byName("Sub with time", true);
    expect(row.record_type).toBe("subtask");
    expect(row.actual_hours).toBe(5.5);  // only the entries tied to s1
    expect(row.logged_hours).toBe(5.5);
  });

  it("computes subtask variance against its own estimate", async () => {
    const row = await byName("Sub with time", true);
    expect(row.hours_variance).toBe(-0.5); // 5.5 logged − 6 estimated
  });
});
