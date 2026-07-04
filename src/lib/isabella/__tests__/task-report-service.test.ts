// ============================================================================
// ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA — retrieval RBAC + boundary guards
// ============================================================================
// Proves the server-side retrieval (`buildTaskReport`) enforces org/project
// scope (mirrors the REG-013 Briefing access path), never leaks cross-org /
// cross-project tasks, degrades honestly, and returns deterministic structured
// data. Plus a source-level import boundary: the module never reads/writes the
// event log, never touches process_nodes/process_edges, and the pure formatter
// never imports a DB client.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocked Supabase admin client (chainable, thenable) ───────────────────────
const h = vi.hoisted(() => {
  interface TableCfg {
    list: { data: unknown; error: unknown };
    single: { data: unknown; error: unknown };
    eqCalls: Array<[string, unknown]>;
    isCalls: Array<[string, unknown]>;
    inCalls: Array<[string, unknown]>;
  }
  const tables: Record<string, TableCfg> = {};
  function table(name: string): TableCfg {
    if (!tables[name]) {
      tables[name] = { list: { data: [], error: null }, single: { data: null, error: null }, eqCalls: [], isCalls: [], inCalls: [] };
    }
    return tables[name];
  }
  function makeBuilder(name: string) {
    const cfg = table(name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      order: () => b,
      limit: () => b,
      eq: (c: string, v: unknown) => { cfg.eqCalls.push([c, v]); return b; },
      is: (c: string, v: unknown) => { cfg.isCalls.push([c, v]); return b; },
      in: (c: string, v: unknown) => { cfg.inCalls.push([c, v]); return b; },
      maybeSingle: () => Promise.resolve(cfg.single),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: any, reject: any) => Promise.resolve(cfg.list).then(resolve, reject),
    };
    return b;
  }
  return {
    tables,
    client: { from: (name: string) => makeBuilder(name) },
    setTable(name: string, cfg: Partial<Pick<TableCfg, "list" | "single">>) {
      const t = table(name);
      if (cfg.list) t.list = cfg.list;
      if (cfg.single) t.single = cfg.single;
    },
    reset() {
      for (const k of Object.keys(tables)) delete tables[k];
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import { buildTaskReport } from "@/lib/isabella/task-report-service";
import type { OrgContext } from "@/lib/auth";

const ORG: OrgContext = {
  userId: "u1",
  email: "a@b.io",
  displayName: "A",
  avatarUrl: null,
  locale: "es",
  role: "member",
  organizationId: "org1",
  organizationName: { en: "Org" } as OrgContext["organizationName"],
  organizationSlug: "org",
};

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "Task",
    status: "not_started",
    priority: "p2",
    milestone_id: null,
    assigned_to: null,
    end_date: null,
    updated_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    is_blocked: false,
    blocker_reason: null,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("buildTaskReport — RBAC / org+project scope", () => {
  it("gates the project by BOTH id and organization_id, and scopes tasks to org+project", async () => {
    h.setTable("projects", { single: { data: { id: "p1", slug: "tower", title_i18n: { es: "Torre A" } }, error: null } });
    h.setTable("roadmap_tasks", { list: { data: [task({ id: "t1", title: "Beta" }), task({ id: "t2", title: "Alpha" })], error: null } });

    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "desc", language: "es" });

    expect(res.ok).toBe(true);
    // Project gate uses the trusted org — cross-org projects can't be reached.
    expect(h.tables.projects.eqCalls).toContainEqual(["id", "p1"]);
    expect(h.tables.projects.eqCalls).toContainEqual(["organization_id", "org1"]);
    expect(h.tables.projects.isCalls).toContainEqual(["deleted_at", null]);
    // Tasks scoped by org + project + not-deleted.
    expect(h.tables.roadmap_tasks.eqCalls).toContainEqual(["organization_id", "org1"]);
    expect(h.tables.roadmap_tasks.eqCalls).toContainEqual(["project_id", "p1"]);
    expect(h.tables.roadmap_tasks.isCalls).toContainEqual(["deleted_at", null]);
  });

  it("no project param → no_project WITHOUT touching the database", async () => {
    const res = await buildTaskReport({ org: ORG, projectId: undefined, sortBy: "title", sortDirection: "desc", language: "es" });
    expect(res).toEqual({ ok: false, reason: "no_project" });
    expect(Object.keys(h.tables)).toHaveLength(0);
  });

  it("cross-org / unknown project (gate returns nothing) → no_project and NEVER queries tasks (no leak)", async () => {
    h.setTable("projects", { single: { data: null, error: null } }); // not in caller's org
    const res = await buildTaskReport({ org: ORG, projectId: "foreign", sortBy: "title", sortDirection: "desc", language: "es" });
    expect(res).toEqual({ ok: false, reason: "no_project" });
    // roadmap_tasks was never queried → no cross-org/cross-project task leak.
    expect(h.tables.roadmap_tasks).toBeUndefined();
  });

  it("project read error → unavailable (honest, no data)", async () => {
    h.setTable("projects", { single: { data: null, error: { message: "boom" } } });
    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "desc", language: "es" });
    expect(res).toEqual({ ok: false, reason: "unavailable" });
    expect(h.tables.roadmap_tasks).toBeUndefined();
  });

  it("task read error → unavailable, never a fabricated list", async () => {
    h.setTable("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "P" } }, error: null } });
    h.setTable("roadmap_tasks", { list: { data: null, error: { message: "down" } } });
    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "desc", language: "es" });
    expect(res).toEqual({ ok: false, reason: "unavailable" });
  });

  it("resolves owner display names ONLY within the caller's org (no cross-org identity leak)", async () => {
    h.setTable("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "P" } }, error: null } });
    h.setTable("roadmap_tasks", {
      list: { data: [task({ id: "t1", title: "A", assigned_to: "owner-in-org" }), task({ id: "t2", title: "B", assigned_to: "owner-elsewhere" })], error: null },
    });
    // profiles query is org-scoped; only the same-org owner is returned.
    h.setTable("profiles", { list: { data: [{ id: "owner-in-org", display_name: "Carla" }], error: null } });

    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "asc", language: "es" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(h.tables.profiles.eqCalls).toContainEqual(["organization_id", "org1"]);
    expect(h.tables.profiles.inCalls).toContainEqual(["id", ["owner-in-org", "owner-elsewhere"]]);
    const byId = Object.fromEntries(res.data.rows.map((r) => [r.id, r.ownerName]));
    expect(byId.t1).toBe("Carla");
    expect(byId.t2).toBeNull(); // unresolved (other org) → honest null, no leak
  });
});

describe("buildTaskReport — deterministic structured output", () => {
  it("returns rows sorted by the requested field/direction with mapped fields", async () => {
    h.setTable("projects", { single: { data: { id: "p1", slug: "tower", title_i18n: { es: "Torre A" } }, error: null } });
    h.setTable("roadmap_tasks", {
      list: {
        data: [
          task({ id: "t1", title: "apple", status: "done", priority: "p1", milestone_id: "m1", end_date: "2026-08-01" }),
          task({ id: "t2", title: "Cherry", status: "in_progress", priority: "p3" }),
        ],
        error: null,
      },
    });
    h.setTable("milestones", { list: { data: [{ id: "m1", title: "Design" }], error: null } });

    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "desc", language: "es" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.projectName).toBe("Torre A");
    expect(res.data.total).toBe(2);
    expect(res.data.rows.map((r) => r.title)).toEqual(["Cherry", "apple"]); // title DESC
    const apple = res.data.rows.find((r) => r.id === "t1")!;
    expect(apple.milestoneTitle).toBe("Design");
    expect(apple.dueDate).toBe("2026-08-01");
    expect(apple.status).toBe("done");
  });

  it("empty project → ok with zero rows (formatter renders the honest no-tasks state)", async () => {
    h.setTable("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "P" } }, error: null } });
    h.setTable("roadmap_tasks", { list: { data: [], error: null } });
    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "desc", language: "es" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.total).toBe(0);
    expect(res.data.rows).toHaveLength(0);
  });

  it("truncates to the display window and flags it", async () => {
    h.setTable("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "P" } }, error: null } });
    const many = Array.from({ length: 5 }, (_, i) => task({ id: `t${i}`, title: `Task ${i}` }));
    h.setTable("roadmap_tasks", { list: { data: many, error: null } });
    const res = await buildTaskReport({ org: ORG, projectId: "p1", sortBy: "title", sortDirection: "asc", language: "es", displayLimit: 2 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.total).toBe(5);
    expect(res.data.displayed).toBe(2);
    expect(res.data.rows).toHaveLength(2);
    expect(res.data.truncated).toBe(true);
  });
});

describe("import boundaries", () => {
  const svc = readFileSync(fileURLToPath(new URL("../task-report-service.ts", import.meta.url)), "utf8");
  const pure = readFileSync(fileURLToPath(new URL("../task-report.ts", import.meta.url)), "utf8");

  // Target actual code constructs (.from("…") calls / imports), not doc prose —
  // the files legitimately NAME the forbidden tables in their comments.
  it("the retrieval reads only approved tables, never the event log or the process graph", () => {
    expect(svc).toMatch(/\.from\(["']roadmap_tasks["']\)/);
    expect(svc).toMatch(/\.eq\(["']organization_id["']/);
    expect(svc).not.toMatch(/\.from\(["']project_event_log["']\)/);
    expect(svc).not.toMatch(/\.from\(["'](?:process_nodes|process_edges)["']\)/);
  });

  it("the retrieval never mutates anything (read-only)", () => {
    expect(svc).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
  });

  it("the pure formatter never imports a DB client (client-safe)", () => {
    expect(pure).not.toMatch(/from\s+["']@\/lib\/supabase/);
    expect(pure).not.toMatch(/createAdminClient\s*\(|createClient\s*\(/);
  });
});
