// ============================================================================
// SUBTASK-OWNER-ASSIGNMENT-PERSISTENCE — server RBAC + boundary guard
// ============================================================================
// Proves getAssignableProjectOwners scopes its person source to the caller's
// org (never cross-org) and this project's team (never cross-project), degrades
// honestly, and is read-only (no mutation / no event-log / no process graph).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  interface TableCfg {
    list: { data: unknown; error: unknown };
    eqCalls: Array<[string, unknown]>;
    neqCalls: Array<[string, unknown]>;
  }
  const tables: Record<string, TableCfg> = {};
  function table(name: string): TableCfg {
    if (!tables[name]) tables[name] = { list: { data: [], error: null }, eqCalls: [], neqCalls: [] };
    return tables[name];
  }
  function makeBuilder(name: string) {
    const cfg = table(name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: (c: string, v: unknown) => { cfg.eqCalls.push([c, v]); return b; },
      neq: (c: string, v: unknown) => { cfg.neqCalls.push([c, v]); return b; },
      is: () => b,
      or: () => b,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: any, reject: any) => Promise.resolve(cfg.list).then(resolve, reject),
    };
    return b;
  }
  return {
    tables,
    orgThrows: false,
    client: { from: (name: string) => makeBuilder(name) },
    setTable(name: string, list: { data: unknown; error: unknown }) {
      table(name).list = list;
    },
    reset() {
      for (const k of Object.keys(tables)) delete tables[k];
      this.orgThrows = false;
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));
vi.mock("@/lib/auth", () => ({
  getOrgContext: async () => {
    if (h.orgThrows) throw new Error("Not authenticated");
    return { userId: "u1", organizationId: "org1", role: "member" };
  },
}));

import { getAssignableProjectOwners } from "@/lib/people/service";

beforeEach(() => h.reset());

describe("getAssignableProjectOwners — RBAC / scope", () => {
  it("scopes profiles to the caller's org and team members to org+project (non-removed)", async () => {
    h.setTable("profiles", { data: [{ id: "u1", display_name: "Ana" }], error: null });
    h.setTable("project_team_members", { data: [{ user_id: "u2", display_name: "Beto" }], error: null });

    const res = await getAssignableProjectOwners("proj1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Profiles: org scope only → no cross-org users.
    expect(h.tables.profiles.eqCalls).toContainEqual(["organization_id", "org1"]);
    // Team: org + project scope + status != removed → no cross-project leak.
    expect(h.tables.project_team_members.eqCalls).toContainEqual(["organization_id", "org1"]);
    expect(h.tables.project_team_members.eqCalls).toContainEqual(["project_id", "proj1"]);
    expect(h.tables.project_team_members.neqCalls).toContainEqual(["status", "removed"]);

    expect(res.owners.map((o) => o.id).sort()).toEqual(["u1", "u2"]);
  });

  it("returns workspace users even when the project has no team rows (the bug)", async () => {
    h.setTable("profiles", { data: [{ id: "u1", display_name: "Ana" }, { id: "u2", display_name: "Beto" }], error: null });
    h.setTable("project_team_members", { data: [], error: null });
    const res = await getAssignableProjectOwners("proj1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.owners).toHaveLength(2); // NOT empty → dropdown shows real people
  });

  it("unauthenticated → not_authorized, no data", async () => {
    h.orgThrows = true;
    const res = await getAssignableProjectOwners("proj1");
    expect(res).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("both source reads failing → unavailable (honest)", async () => {
    h.setTable("profiles", { data: null, error: { message: "x" } });
    h.setTable("project_team_members", { data: null, error: { message: "y" } });
    const res = await getAssignableProjectOwners("proj1");
    expect(res).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("import boundaries", () => {
  const svc = readFileSync(fileURLToPath(new URL("../service.ts", import.meta.url)), "utf8");

  it("reads only approved person tables, never the event log or the process graph", () => {
    expect(svc).toMatch(/\.from\(["']profiles["']\)/);
    expect(svc).toMatch(/\.from\(["']project_team_members["']\)/);
    expect(svc).not.toMatch(/\.from\(["']project_event_log["']\)/);
    expect(svc).not.toMatch(/\.from\(["'](?:process_nodes|process_edges)["']\)/);
  });

  it("never mutates anything (read-only projection)", () => {
    expect(svc).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
  });
});
