import { describe, it, expect, vi } from "vitest";

// ============================================================================
// REG-038 — Owner filter returned zero rows for multi-org assignees
// ============================================================================
// Root cause: fetchTaskExecution resolved assignee names with
//   profiles.select().eq("organization_id", ctx.organizationId)
// but a profile's organization_id is its HOME org, not every org it works in.
// Members whose home org differed from the project's org fell out of the
// lookup, so their tasks carried an empty Owner — and any Owner filter matched
// nothing, no matter how the project filter was written.
//
// The mock below applies eq/in/is the way PostgREST does, so reverting the fix
// (going back to filtering profiles by organization_id) fails these tests.
// ============================================================================

const h = vi.hoisted(() => {
  const ORG = "org-agro";

  const TABLE_DATA: Record<string, Record<string, unknown>[]> = {
    projects: [
      { id: "p-agro", organization_id: ORG, title_i18n: { en: "Agrocappture" }, slug: "agrocappture", deleted_at: null },
    ],
    roadmap_tasks: [
      { id: "t1", organization_id: ORG, project_id: "p-agro", title: "Soil survey", status: "in_progress", priority: "p1", assigned_to: "u-paul", assigned_resource_id: null, progress: 45, end_date: "2026-04-15", estimate_hours: 10, actual_hours: 12, deleted_at: null },
      { id: "t2", organization_id: ORG, project_id: "p-agro", title: "Fence install", status: "blocked", priority: "p1", assigned_to: "u-paul", assigned_resource_id: null, progress: 30, end_date: "2026-04-20", deleted_at: null },
      { id: "t3", organization_id: ORG, project_id: "p-agro", title: "Irrigation design", status: "done", priority: "p2", assigned_to: null, assigned_resource_id: "r-crew", progress: 100, end_date: "2026-05-01", deleted_at: null },
      { id: "t4", organization_id: ORG, project_id: "p-agro", title: "Training plan", status: "done", priority: "p3", assigned_to: null, assigned_resource_id: null, progress: 100, end_date: null, deleted_at: null },
    ],
    // Paul's home org is a DIFFERENT org — this is the condition that broke it.
    profiles: [
      { id: "u-paul", organization_id: "org-other", display_name: "Paul Reyes" },
      { id: "u-marta", organization_id: ORG, display_name: "Marta Solís" },
    ],
    resources: [{ id: "r-crew", organization_id: ORG, name: "Crew A", deleted_at: null }],
    milestones: [],
    risks: [],
    task_dependencies: [],
  };

  const queries: Record<string, { eq: [string, unknown][]; in: [string, unknown[]][] }> = {};

  function makeBuilder(table: string) {
    queries[table] = queries[table] ?? { eq: [], in: [] };
    let rows = [...(TABLE_DATA[table] ?? [])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: (col: string, val: unknown) => { queries[table].eq.push([col, val]); rows = rows.filter((r) => r[col] === val); return b; },
      in: (col: string, vals: unknown[]) => { queries[table].in.push([col, vals]); rows = rows.filter((r) => vals.includes(r[col])); return b; },
      is: (col: string, val: unknown) => { rows = rows.filter((r) => (r[col] ?? null) === val); return b; },
      not: (col: string, _op: string, val: unknown) => { rows = rows.filter((r) => (r[col] ?? null) !== val); return b; },
      order: () => b, limit: () => b,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
    };
    return b;
  }

  return {
    ORG,
    queries,
    client: { from: (table: string) => makeBuilder(table) },
    reset: () => { for (const k of Object.keys(queries)) delete queries[k]; },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import { runReport } from "../query-service";
import type { ReportConfig, ReportFilter } from "../types";

const base: Omit<ReportConfig, "filters"> = {
  datasetId: "task_execution",
  columns: ["project_name", "task_name", "owner", "status", "progress_pct"],
  grouping: null,
  sort: [],
  visualization: "table",
};

async function report(...filters: ReportFilter[]) {
  const result = await runReport({ ...base, filters }, { organizationId: h.ORG, projectId: null });
  if ("error" in result) throw new Error(`report failed: ${result.error} ${result.details?.join("; ") ?? ""}`);
  return result;
}

describe("REG-038 — owner resolution across organizations", () => {
  it("resolves the display name of an assignee whose home org differs", async () => {
    const { rows } = await report();
    const owners = rows.map((r) => r.owner);
    expect(owners).toContain("Paul Reyes");
  });

  it("Project = Agro* AND Responsable = Paul* returns the matching tasks", async () => {
    const { rows, totalRows } = await report(
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
    );
    expect(totalRows).toBe(2);
    expect(rows.map((r) => r.task_name).sort()).toEqual(["Fence install", "Soil survey"]);
  });

  it("the owner filter alone matches the same tasks as the two-filter report", async () => {
    const one = await report({ column: "owner", operator: "contains", value: "Paul" });
    const two = await report(
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "contains", value: "Paul" },
    );
    expect(one.totalRows).toBe(two.totalRows);
  });

  it("does not query profiles by organization_id (that was the defect)", async () => {
    await report();
    const profileQueries = h.queries["profiles"];
    expect(profileQueries.eq.some(([col]) => col === "organization_id")).toBe(false);
    expect(profileQueries.in.some(([col]) => col === "id")).toBe(true);
  });

  it("only looks up the assignee ids present in the scoped tasks", async () => {
    h.reset();
    await report();
    const [[, ids]] = h.queries["profiles"].in;
    expect(ids).toEqual(["u-paul"]);        // u-marta is never referenced
  });

  it("still resolves resource assignees and leaves unassigned tasks empty", async () => {
    const { rows } = await report();
    const byTask = new Map(rows.map((r) => [r.task_name, r.owner]));
    expect(byTask.get("Irrigation design")).toBe("Crew A");
    expect(byTask.get("Training plan")).toBe("");
  });

  it("keeps org scoping on tasks, projects and resources", async () => {
    h.reset();
    await report();
    expect(h.queries["roadmap_tasks"].eq).toContainEqual(["organization_id", h.ORG]);
    expect(h.queries["projects"].eq).toContainEqual(["organization_id", h.ORG]);
    expect(h.queries["resources"].eq).toContainEqual(["organization_id", h.ORG]);
  });

  it("combines owner with status and progress filters", async () => {
    const { rows } = await report(
      { column: "owner", operator: "equals", value: "Paul*" },
      { column: "status", operator: "not_equals", value: "done" },
      { column: "progress_pct", operator: "greater_than_or_equal", value: 30 },
    );
    expect(rows.map((r) => r.task_name).sort()).toEqual(["Fence install", "Soil survey"]);
  });

  it("derives days late, hours variance and dependency columns", async () => {
    const { rows } = await runReport(
      { ...base, columns: ["task_name", "days_late", "hours_variance", "dependency_count"], filters: [] },
      { organizationId: h.ORG, projectId: null },
    ) as { rows: Record<string, unknown>[] };
    const soil = rows.find((r) => r.task_name === "Soil survey")!;
    expect(soil.hours_variance).toBe(2);          // 12 actual − 10 estimated
    expect(soil.dependency_count).toBe(0);
    expect(typeof soil.days_late).toBe("number"); // planned finish is in the past or future, never null here
  });
});
