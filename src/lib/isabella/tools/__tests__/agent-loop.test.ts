// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY — agent loop + flag routing
// ============================================================================
// Provider-agnostic loop with a MOCK model (no live API): live-data question
// calls a tool; help question calls none; unknown tool is safe; max iterations
// bounded; audit recorded. Plus flag-off short-circuit.
// ============================================================================

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
  const flag = { enabled: false };
  return { tables, flag, client: { from: (n: string) => builder(n) }, set(n: string, c: Partial<Cfg>) { const t = table(n); if (c.list) t.list = c.list; if (c.single) t.single = c.single; }, reset() { for (const k of Object.keys(tables)) delete tables[k]; flag.enabled = false; } };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));
vi.mock("@/lib/env", () => ({ env: { get ISABELLA_TOOL_USE_ENABLED() { return h.flag.enabled ? "true" : ""; }, OPENAI_API_KEY: "" } }));

import { runIsabellaToolLoop, type ToolCallingModel, type ModelTurn } from "@/lib/isabella/tools/agent-loop";
import { isIsabellaToolUseEnabled } from "@/lib/isabella/tools/flag";
import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";

const ORG = { userId: "u1", organizationId: "org1", role: "member" } as OrgContext;
const SCOPE: IsabellaProjectScope = { projectId: "p1", organizationId: "org1", userId: "u1", locale: "es" };

function task(o: Record<string, unknown>) {
  return { id: "t", title: "T", status: "not_started", priority: "p2", milestone_id: null, assigned_to: null, end_date: null, updated_at: null, created_at: "2026-07-01T00:00:00Z", is_blocked: false, blocker_reason: null, ...o };
}
function seedProject() { h.set("projects", { single: { data: { id: "p1", slug: "p", title_i18n: { es: "Torre A" } }, error: null } }); }

/** A scripted model that plays back a queue of turns. */
function scriptedModel(turns: ModelTurn[]): ToolCallingModel {
  let i = 0;
  return { next: async () => turns[i++] ?? { finalText: "" } };
}

beforeEach(() => h.reset());

describe("feature flag", () => {
  it("is off by default and on only when explicitly true", () => {
    expect(isIsabellaToolUseEnabled()).toBe(false);
    h.flag.enabled = true;
    expect(isIsabellaToolUseEnabled()).toBe(true);
  });
});

describe("runIsabellaToolLoop", () => {
  it("a live-data question calls query_tasks then answers from the result", async () => {
    seedProject();
    h.set("roadmap_tasks", { list: { data: [task({ id: "b", milestone_id: null })], error: null } });
    const model = scriptedModel([
      { toolCalls: [{ id: "c1", name: "query_tasks", args: { has_milestone: false } }] },
      { finalText: "Tienes 1 tarea sin hito." },
    ]);
    const res = await runIsabellaToolLoop({ org: ORG, scope: SCOPE, model, system: "sys", userQuestion: "tareas sin hito" });
    expect(res.answer).toBe("Tienes 1 tarea sin hito.");
    expect(res.audit.toolsCalled).toHaveLength(1);
    expect(res.audit.toolsCalled[0]).toMatchObject({ name: "query_tasks", status: "success", rowCount: 1 });
    expect(res.audit.maxIterationsReached).toBe(false);
  });

  it("a help question calls NO tools (RAG path preserved upstream)", async () => {
    const model = scriptedModel([{ finalText: "Para crear un proyecto, ve a…" }]);
    const res = await runIsabellaToolLoop({ org: ORG, scope: SCOPE, model, system: "sys", userQuestion: "¿cómo creo un proyecto?" });
    expect(res.answer).toContain("crear un proyecto");
    expect(res.audit.toolsCalled).toHaveLength(0);
  });

  it("an unknown tool name is handled safely and the loop continues", async () => {
    const model = scriptedModel([
      { toolCalls: [{ id: "c1", name: "run_sql", args: { q: "select 1" } }] },
      { finalText: "No pude usar esa herramienta." },
    ]);
    const res = await runIsabellaToolLoop({ org: ORG, scope: SCOPE, model, system: "sys", userQuestion: "x" });
    expect(res.audit.toolsCalled[0].status).toBe("unknown_tool");
    expect(res.answer).toContain("No pude");
  });

  it("stops at max iterations without looping forever", async () => {
    const model: ToolCallingModel = { next: async () => ({ toolCalls: [{ id: "c", name: "query_tasks", args: {} }] }) };
    seedProject();
    h.set("roadmap_tasks", { list: { data: [], error: null } });
    const res = await runIsabellaToolLoop({ org: ORG, scope: SCOPE, model, system: "sys", userQuestion: "x", maxIterations: 3 });
    expect(res.audit.maxIterationsReached).toBe(true);
    expect(res.audit.toolsCalled.length).toBe(3);
  });
});

describe("gateway flag-off short-circuit", () => {
  it("maybeAnswerWithTools returns null when the flag is off (current behavior preserved)", async () => {
    const { maybeAnswerWithTools } = await import("@/lib/isabella/tools/gateway");
    const res = await maybeAnswerWithTools(
      ORG,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { query: "tareas sin hito", intent: "question", context: { module: "", projectId: "p1" }, locale: "es" } as any,
      { key: "isabella", displayName: "Isabella", title: "Asesora" },
      "persona",
    );
    expect(res).toBeNull();
  });
});
