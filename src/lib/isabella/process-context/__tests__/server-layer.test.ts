// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL — access / context / executor RBAC
// ============================================================================
// Server-layer behavior with a mocked Supabase + session: deny-by-default
// access, ready/empty/partial/unauthorized context, deterministic query
// execution with the no-milestone filter, and a read-only import boundary.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  interface Cfg { list: { data: unknown; error: unknown }; single: { data: unknown; error: unknown }; }
  const tables: Record<string, Cfg> = {};
  const state = { orgThrows: false };
  function table(n: string): Cfg {
    if (!tables[n]) tables[n] = { list: { data: [], error: null }, single: { data: null, error: null } };
    return tables[n];
  }
  function builder(n: string) {
    const cfg = table(n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b, eq: () => b, is: () => b, in: () => b, order: () => b, limit: () => b,
      maybeSingle: () => Promise.resolve(cfg.single),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (res: any, rej: any) => Promise.resolve(cfg.list).then(res, rej),
    };
    return b;
  }
  return {
    tables, state,
    client: { from: (n: string) => builder(n) },
    set(n: string, cfg: Partial<Cfg>) { const t = table(n); if (cfg.list) t.list = cfg.list; if (cfg.single) t.single = cfg.single; },
    reset() { for (const k of Object.keys(tables)) delete tables[k]; state.orgThrows = false; },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));
vi.mock("@/lib/auth", () => ({
  getOrgContext: async () => {
    if (h.state.orgThrows) throw new Error("Not authenticated");
    return { userId: "u1", organizationId: "org1", role: "member" };
  },
}));

import { resolveIsabellaProjectAccess } from "@/lib/isabella/process-context/access";
import { buildIsabellaProcessContext } from "@/lib/isabella/process-context/context-builder";
import { executeDeterministicProjectDataRequest } from "@/lib/isabella/process-context/query-executor";
import { parseProjectDataQuery } from "@/lib/isabella/query-engine/parser";
import type { OrgContext } from "@/lib/auth";

const ORG = { userId: "u1", organizationId: "org1", role: "member" } as OrgContext;
const SCOPE = { projectId: "p1", organizationId: "org1", userId: "u1", locale: "es" as const };

function seedProject() {
  h.set("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "Torre A" } }, error: null } });
}
function task(o: Record<string, unknown>) {
  return { id: "t", title: "T", status: "not_started", priority: "p2", milestone_id: null, assigned_to: null,
    end_date: null, updated_at: null, created_at: "2026-07-01T00:00:00Z", is_blocked: false, blocker_reason: null, ...o };
}

beforeEach(() => h.reset());

describe("resolveIsabellaProjectAccess — deny by default", () => {
  it("missing project → missing_context (no DB touch)", async () => {
    const r = await resolveIsabellaProjectAccess({ projectId: null, locale: "es" });
    expect(r.status).toBe("missing_context");
    expect(Object.keys(h.tables)).toHaveLength(0);
  });
  it("unauthenticated → unauthorized", async () => {
    h.state.orgThrows = true;
    expect((await resolveIsabellaProjectAccess({ projectId: "p1" })).status).toBe("unauthorized");
  });
  it("cross-org / unknown project → unauthorized, no data, no existence disclosure", async () => {
    h.set("projects", { single: { data: null, error: null } });
    const r = await resolveIsabellaProjectAccess({ projectId: "foreign" });
    expect(r.status).toBe("unauthorized");
    expect(r.scope).toBeUndefined();
  });
  it("read error → unavailable", async () => {
    h.set("projects", { single: { data: null, error: { message: "x" } } });
    expect((await resolveIsabellaProjectAccess({ projectId: "p1" })).status).toBe("unavailable");
  });
  it("same-org project → authorized with trusted scope", async () => {
    seedProject();
    const r = await resolveIsabellaProjectAccess({ projectId: "p1", locale: "es" });
    expect(r.status).toBe("authorized");
    expect(r.scope).toMatchObject({ projectId: "p1", organizationId: "org1", userId: "u1" });
  });
});

describe("buildIsabellaProcessContext", () => {
  it("ready: project + tasks + milestones with evidence packets", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "a", milestone_id: "m1" }), task({ id: "b", milestone_id: null })], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design", status: "in_progress", progress_percent: 40, order_index: 1 }], error: null } });
    const ctx = await buildIsabellaProcessContext({ projectId: "p1", locale: "es", include: ["project", "tasks", "milestones", "blockers"] });
    expect(ctx.status).toBe("ready");
    expect(ctx.taskContext?.totalVisibleTasks).toBe(2);
    expect(ctx.taskContext?.withoutMilestoneCount).toBe(1);
    expect(ctx.milestoneContext?.totalVisibleMilestones).toBe(1);
    expect(ctx.evidencePackets.length).toBeGreaterThan(0);
    expect(ctx.citations.length).toBeGreaterThan(0);
  });

  it("empty: authorized but no data", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [], error: null } });
    h.set("milestones", { list: { data: [], error: null } });
    const ctx = await buildIsabellaProcessContext({ projectId: "p1", include: ["tasks", "milestones"] });
    expect(ctx.status).toBe("empty");
  });

  it("partial: a future source (risks) is disclosed as a limitation", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "a", milestone_id: "m1" })], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design", status: null, progress_percent: null, order_index: 1 }], error: null } });
    const ctx = await buildIsabellaProcessContext({ projectId: "p1", locale: "en", include: ["tasks", "milestones", "risks"] });
    expect(ctx.status).toBe("partial");
    expect(ctx.limitations.join(" ")).toMatch(/risk/i);
  });

  it("unauthorized project → no data", async () => {
    h.set("projects", { single: { data: null, error: null } });
    const ctx = await buildIsabellaProcessContext({ projectId: "foreign" });
    expect(ctx.status).toBe("unauthorized");
    expect(ctx.taskContext).toBeUndefined();
    expect(ctx.evidencePackets).toHaveLength(0);
  });
});

describe("executeDeterministicProjectDataRequest", () => {
  it("executes a no-milestone plan (includes only milestone-less tasks) + evidence", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [
      task({ id: "a", title: "Alpha", milestone_id: "m1" }),
      task({ id: "b", title: "Beta", milestone_id: null }),
    ], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design" }], error: null } });
    const plan = parseProjectDataQuery("tareas sin hito", { language: "es" })!;
    const res = await executeDeterministicProjectDataRequest(ORG, SCOPE, plan);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.view.rows.map((r) => r.id)).toEqual(["b"]);
    expect(res.packets.every((p) => p.confidence === "verified")).toBe(true);
  });

  it("rejects an invalid plan before retrieval", async () => {
    const plan = parseProjectDataQuery("tareas sin hito", { language: "es" })!;
    const bad = { ...plan, filters: [{ field: "secret", operator: "equals" as const, value: "x" }] };
    const res = await executeDeterministicProjectDataRequest(ORG, SCOPE, bad);
    expect(res).toMatchObject({ ok: false, reason: "invalid_plan" });
  });
});

describe("import boundaries (read-only)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("no module writes the event log / process graph or mutates", () => {
    for (const f of ["access.ts", "context-builder.ts", "task-evidence.ts", "milestone-evidence.ts", "process-signals.ts", "evidence-builder.ts", "query-executor.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/\.from\(["'](?:project_event_log|process_nodes|process_edges)["']\)/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    }
  });
});
