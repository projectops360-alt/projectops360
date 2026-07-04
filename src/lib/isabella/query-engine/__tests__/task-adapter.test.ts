// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE — adapter RBAC + verified report
// ============================================================================
// The task adapter executes a validated plan against RBAC-scoped rows: the
// no-milestone filter includes/excludes correctly, cross-org/cross-project never
// leaks, the report is VERIFIED (never low-confidence), and the module is
// read-only (import-boundary guard).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  interface Cfg { list: { data: unknown; error: unknown }; single: { data: unknown; error: unknown }; eqCalls: Array<[string, unknown]>; }
  const tables: Record<string, Cfg> = {};
  function table(n: string): Cfg {
    if (!tables[n]) tables[n] = { list: { data: [], error: null }, single: { data: null, error: null }, eqCalls: [] };
    return tables[n];
  }
  function builder(n: string) {
    const cfg = table(n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b, order: () => b, limit: () => b, is: () => b,
      eq: (c: string, v: unknown) => { cfg.eqCalls.push([c, v]); return b; },
      in: () => b,
      maybeSingle: () => Promise.resolve(cfg.single),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (res: any, rej: any) => Promise.resolve(cfg.list).then(res, rej),
    };
    return b;
  }
  return {
    tables,
    client: { from: (n: string) => builder(n) },
    set(n: string, cfg: Partial<Cfg>) { const t = table(n); if (cfg.list) t.list = cfg.list; if (cfg.single) t.single = cfg.single; },
    reset() { for (const k of Object.keys(tables)) delete tables[k]; },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import { runTaskQuery, answerTaskQuery } from "@/lib/isabella/query-engine/task-adapter";
import { parseProjectDataQuery } from "@/lib/isabella/query-engine/parser";
import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectQueryPlan } from "@/lib/isabella/query-engine/query-plan";

const ORG = { userId: "u1", organizationId: "org1", role: "member" } as OrgContext;
const EXPERT = { key: "isabella", displayName: "Isabella", title: "Asesora" };

function task(o: Record<string, unknown>) {
  return {
    id: "t", title: "T", status: "not_started", priority: "p2", milestone_id: null,
    assigned_to: null, end_date: null, updated_at: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z", is_blocked: false, blocker_reason: null, ...o,
  };
}
function seedProject() {
  h.set("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "Torre A" } }, error: null } });
}

beforeEach(() => h.reset());

describe("runTaskQuery — no-milestone filter over RBAC-scoped rows", () => {
  it("includes tasks without a milestone and excludes those with one", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [
      task({ id: "a", title: "Alpha", milestone_id: "m1" }),
      task({ id: "b", title: "Beta", milestone_id: null }),
      task({ id: "c", title: "Gamma", milestone_id: null }),
    ], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design" }], error: null } });

    const plan = parseProjectDataQuery("dame las tareas sin hito", { language: "es" })!;
    const res = await runTaskQuery({ org: ORG, projectId: "p1", plan });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.view.rows.map((r) => r.id).sort()).toEqual(["b", "c"]);
    expect(res.view.total).toBe(2);
    // org+project scope enforced on the tasks query
    expect(h.tables.roadmap_tasks.eqCalls).toContainEqual(["organization_id", "org1"]);
    expect(h.tables.roadmap_tasks.eqCalls).toContainEqual(["project_id", "p1"]);
  });

  it("cross-org/unknown project → no_project, tasks never queried", async () => {
    h.set("projects", { single: { data: null, error: null } });
    const plan = parseProjectDataQuery("tareas sin hito", { language: "es" })!;
    const res = await runTaskQuery({ org: ORG, projectId: "foreign", plan });
    expect(res).toMatchObject({ ok: false, reason: "no_project" });
    expect(h.tables.roadmap_tasks).toBeUndefined();
  });

  it("unsupported entity + invalid plan are rejected before retrieval", async () => {
    const risk = parseProjectDataQuery("show open risks by severity", { language: "en" })!;
    expect((await runTaskQuery({ org: ORG, projectId: "p1", plan: risk })).ok).toBe(false);
    const bad: IsabellaProjectQueryPlan = { ...risk, entity: "task", filters: [{ field: "secret", operator: "equals", value: "x" }] };
    const res = await runTaskQuery({ org: ORG, projectId: "p1", plan: bad });
    expect(res).toMatchObject({ ok: false, reason: "invalid_plan" });
  });
});

describe("answerTaskQuery — verified report", () => {
  it("formats a VERIFIED no-milestone report with 'Sin hito', count and source", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "b", title: "Beta", milestone_id: null })], error: null } });
    const plan = parseProjectDataQuery("dame las tareas sin hito", { language: "es" })!;
    const ans = await answerTaskQuery({ org: ORG, projectId: "p1", plan, expert: EXPERT });
    expect(ans.tier).toBe("verified");
    expect(ans.tier).not.toBe("ai_suggestion");
    expect(ans.answer.toLowerCase()).not.toContain("no tengo una respuesta verificada");
    expect(ans.answer).toContain("Sin hito");
    expect(ans.answer).toContain("Total: 1 tarea");
    expect(ans.answer).toContain("Fuente: tareas visibles del proyecto actual.");
  });

  it("empty result → clear no-data message (never fabricated rows)", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "a", milestone_id: "m1" })], error: null } });
    h.set("milestones", { list: { data: [{ id: "m1", title: "Design" }], error: null } });
    const plan = parseProjectDataQuery("tareas sin hito", { language: "es" })!;
    const ans = await answerTaskQuery({ org: ORG, projectId: "p1", plan, expert: EXPERT });
    expect(ans.answer).toContain("no tiene tareas que cumplan");
    expect(ans.answer).not.toContain("| # |");
  });

  it("clarification plan asks instead of guessing", async () => {
    const plan = parseProjectDataQuery("hazme un reporte", { language: "es" })!;
    expect(plan.requiresClarification).toBe(true);
    const ans = await answerTaskQuery({ org: ORG, projectId: "p1", plan, expert: EXPERT });
    expect(ans.answer).toContain("¿De qué quieres el reporte?");
  });
});

describe("import boundaries (read-only)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("engine files never write the event log / process graph and never mutate", () => {
    for (const f of ["parser.ts", "filter-engine.ts", "formatter.ts", "task-adapter.ts", "catalog.ts", "refine.ts", "query-plan.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/\.from\(["'](?:project_event_log|process_nodes|process_edges)["']\)/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    }
  });
});
