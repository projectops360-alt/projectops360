import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock the Supabase admin client ────────────────────────────────────────────
// A chainable recording builder: every .eq(col,val) is logged per table so we
// can assert that project scoping reaches the query layer. The builder is
// awaitable and resolves to per-table seed data.
const h = vi.hoisted(() => {
  const eqCalls: Record<string, [string, unknown][]> = {};
  const TABLE_DATA: Record<string, unknown[]> = {
    projects: [{ id: "p1", title_i18n: { en: "Project One" }, slug: "project-one" }],
    roadmap_tasks: [
      { id: "t1", title: "Task 1", status: "in_progress", priority: "p2", project_id: "p1" },
      { id: "t2", title: "Task 2", status: "done", priority: "p3", project_id: "p2" },
    ],
    milestones: [],
    profiles: [],
    resources: [],
  };
  function makeBuilder(table: string) {
    eqCalls[table] = eqCalls[table] ?? [];
    const data = TABLE_DATA[table] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: (col: string, val: unknown) => { eqCalls[table].push([col, val]); return b; },
      is: () => b,
      ilike: () => b,
      in: () => b,
      order: () => b,
      limit: () => b,
      single: async () => ({ data: data[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
      // Thenable: `await builder` resolves to { data }.
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data, error: null }),
    };
    return b;
  }
  const client = { from: (table: string) => makeBuilder(table) };
  return {
    eqCalls,
    client,
    reset: () => { for (const k of Object.keys(eqCalls)) delete eqCalls[k]; },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import { runReport } from "../query-service";
import type { ReportConfig } from "../types";

const config: ReportConfig = {
  datasetId: "task_execution",
  columns: ["project_name", "task_name", "status"],
  filters: [],
  grouping: null,
  sort: [],
  visualization: "table",
};

describe("project-scoped report execution", () => {
  beforeEach(() => h.reset());

  it("All Projects (projectId = null) does NOT filter by project_id", async () => {
    const result = await runReport(config, { organizationId: "org1", projectId: null });
    expect("error" in result).toBe(false);
    const taskEqs = h.eqCalls["roadmap_tasks"] ?? [];
    expect(taskEqs).toContainEqual(["organization_id", "org1"]);
    expect(taskEqs.some(([c]) => c === "project_id")).toBe(false);
  });

  it("specific project passes project_id into the query layer", async () => {
    const result = await runReport(config, { organizationId: "org1", projectId: "p1" });
    expect("error" in result).toBe(false);
    const taskEqs = h.eqCalls["roadmap_tasks"] ?? [];
    expect(taskEqs).toContainEqual(["organization_id", "org1"]);
    expect(taskEqs).toContainEqual(["project_id", "p1"]);
  });

  it("switching scope changes whether project_id is applied", async () => {
    await runReport(config, { organizationId: "org1", projectId: "p1" });
    expect((h.eqCalls["roadmap_tasks"] ?? []).some(([c, v]) => c === "project_id" && v === "p1")).toBe(true);

    h.reset();
    await runReport(config, { organizationId: "org1", projectId: null });
    expect((h.eqCalls["roadmap_tasks"] ?? []).some(([c]) => c === "project_id")).toBe(false);
  });

  it("always scopes to the organization regardless of project scope", async () => {
    await runReport(config, { organizationId: "orgX", projectId: "p1" });
    expect((h.eqCalls["roadmap_tasks"] ?? []).some(([c, v]) => c === "organization_id" && v === "orgX")).toBe(true);
    // project name lookup is also org-scoped (no cross-org exposure)
    expect((h.eqCalls["projects"] ?? []).some(([c, v]) => c === "organization_id" && v === "orgX")).toBe(true);
  });
});
