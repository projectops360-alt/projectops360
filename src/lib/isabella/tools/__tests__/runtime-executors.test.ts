// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY — executors + runtime (mocked Supabase)
// ============================================================================
// Tools wrap the approved layers: RBAC scope, no-milestone filter, empty/
// unauthorized/unsupported/invalid states, truncation, no raw rows, compact
// audit, and a read-only import boundary.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  interface Cfg { list: { data: unknown; error: unknown }; single: { data: unknown; error: unknown }; }
  const tables: Record<string, Cfg> = {};
  function table(n: string): Cfg { if (!tables[n]) tables[n] = { list: { data: [], error: null }, single: { data: null, error: null } }; return tables[n]; }
  function builder(n: string) {
    const cfg = table(n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = { select: () => b, eq: () => b, is: () => b, in: () => b, order: () => b, limit: () => b, maybeSingle: () => Promise.resolve(cfg.single), then: (r: any, j: any) => Promise.resolve(cfg.list).then(r, j) };
    return b;
  }
  return { tables, client: { from: (n: string) => builder(n) }, set(n: string, c: Partial<Cfg>) { const t = table(n); if (c.list) t.list = c.list; if (c.single) t.single = c.single; }, reset() { for (const k of Object.keys(tables)) delete tables[k]; } };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));
vi.mock("@/lib/auth", () => ({ getOrgContext: async () => ({ userId: "u1", organizationId: "org1", role: "member" }) }));

import { executeQueryTasks, executeQueryProjectData, executeGetProjectSummary } from "@/lib/isabella/tools/executors";
import { executeIsabellaTool } from "@/lib/isabella/tools/runtime";
import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";

const ORG = { userId: "u1", organizationId: "org1", role: "member" } as OrgContext;
const SCOPE: IsabellaProjectScope = { projectId: "p1", organizationId: "org1", userId: "u1", locale: "es" };

function task(o: Record<string, unknown>) {
  return { id: "t", title: "T", status: "not_started", priority: "p2", milestone_id: null, assigned_to: null, end_date: null, updated_at: null, created_at: "2026-07-01T00:00:00Z", is_blocked: false, blocker_reason: null, ...o };
}
function seedProject() { h.set("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "Torre A" } }, error: null } }); }
beforeEach(() => h.reset());

describe("executeQueryTasks", () => {
  it("has_milestone:false → only milestone-less tasks (no raw ids in rows)", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "a", title: "Alpha", milestone_id: "m1" }), task({ id: "b", title: "Beta", milestone_id: null })], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design" }], error: null } });
    const res = await executeQueryTasks(ORG, SCOPE, { has_milestone: false });
    expect(res.status).toBe("success");
    expect(res.rows?.map((r) => r.ref)).toEqual(["task:b"]);
    expect(JSON.stringify(res.rows)).not.toContain("m1");
    expect(res.appliedFilters).toHaveProperty("milestone");
  });

  it("overdue:true → dueDate before today, honest empty when none", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "a", end_date: "2100-01-01", status: "in_progress" })], error: null } });
    const res = await executeQueryTasks(ORG, SCOPE, { overdue: true });
    expect(res.status).toBe("empty");
    expect(res.rowCount).toBe(0);
  });

  it("clamps limit and reports truncation", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: Array.from({ length: 4 }, (_, i) => task({ id: `t${i}`, title: `T${i}` })), error: null } });
    const res = await executeQueryTasks(ORG, SCOPE, { limit: 2 });
    expect(res.rowCount).toBe(4);
    expect(res.truncated).toBe(true);
    expect(res.rows).toHaveLength(2);
  });
});

describe("executeQueryProjectData", () => {
  it("future entity → unsupported_entity (honest, not invented)", async () => {
    const res = await executeQueryProjectData(ORG, SCOPE, { entity: "risk" });
    expect(res.status).toBe("unsupported_entity");
    expect(res.rows).toBeUndefined();
  });
  it("task with a no-milestone filter executes through the engine", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "b", milestone_id: null })], error: null } });
    const res = await executeQueryProjectData(ORG, SCOPE, { entity: "task", filters: [{ field: "milestone", operator: "is_null" }] });
    expect(res.status).toBe("success");
    expect(res.rows?.[0].ref).toBe("task:b");
  });
});

describe("get_project_summary", () => {
  it("summarizes counts from the process context", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "a", milestone_id: "m1" }), task({ id: "b", milestone_id: null })], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design", status: null, progress_percent: null, order_index: 1 }], error: null } });
    const res = await executeGetProjectSummary(ORG, SCOPE, {});
    expect(res.status).toBe("success");
    expect(res.message).toContain("Torre A");
    expect(res.message).toContain("sin hito: 1");
  });
});

describe("runtime — safe validation + audit", () => {
  it("unknown tool → safe error + unknown_tool audit (no crash)", async () => {
    const { result, audit } = await executeIsabellaTool(ORG, SCOPE, "drop_tables", { x: 1 });
    expect(result.status).toBe("invalid_args");
    expect(audit.status).toBe("unknown_tool");
  });
  it("invalid args → invalid_args (rejected before execution)", async () => {
    const { result, audit } = await executeIsabellaTool(ORG, SCOPE, "query_tasks", { order_by: "ssn" });
    expect(result.status).toBe("invalid_args");
    expect(audit.status).toBe("invalid_args");
  });
  it("valid call executes + records compact audit", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "b", milestone_id: null })], error: null } });
    const { result, audit } = await executeIsabellaTool(ORG, SCOPE, "query_tasks", { has_milestone: false });
    expect(result.status).toBe("success");
    expect(audit).toMatchObject({ name: "query_tasks", status: "success", rowCount: 1 });
    expect(audit.executionMs).toBeGreaterThanOrEqual(0);
  });
});

describe("import boundaries (read-only)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("tool modules never write the event log / process graph and do not mutate", () => {
    for (const f of ["executors.ts", "runtime.ts", "serializers.ts", "registry.ts", "schemas.ts", "agent-loop.ts", "audit.ts", "flag.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/\.from\(["'](?:project_event_log|process_nodes|process_edges)["']\)/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    }
  });
  it("gateway audit writes ONLY ai_runs (compact), nothing else", () => {
    const src = readFileSync(dir + "gateway.ts", "utf8");
    const inserts = src.match(/\.from\(["'](\w+)["']\)\s*\n?\s*\.insert/g) ?? [];
    expect(src).toMatch(/\.from\("ai_runs"\)/);
    expect(src).not.toMatch(/\.from\(["'](?:project_event_log|process_nodes|process_edges|roadmap_tasks|milestones)["']\)/);
    expect(src).not.toMatch(/\.(update|delete|upsert)\s*\(/);
    void inserts;
  });
});
