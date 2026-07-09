import { describe, it, expect, beforeEach, vi } from "vitest";

// `server-only` is a Next.js build-time guard not resolvable under vitest; stub
// it so the server-only queries module can be imported in the node-env test.
vi.mock("server-only", () => ({}));

// ============================================================================
// Admin Console — data aggregation (service-role queries)
// ============================================================================
// Verifies the in-memory aggregation math the Admin Console renders: company
// counts, users-per-company, projects-per-user rollups, per-project task
// status aggregates, and paginated task drill-down. The Supabase admin client
// is mocked; filters are recorded but their row-reduction is not simulated —
// we assert the helpers derive correct counts from the rows returned.
// ============================================================================

const h = vi.hoisted(() => {
  // Per-table store: { rows: any[], count: number|null, error: any|null, headCount: number|null }
  const tables: Record<string, { rows: unknown[]; count: number | null; error: unknown; headCount: number | null }> = {};
  const calls: Record<string, Array<Record<string, unknown>>> = {};

  function get(table: string) {
    if (!tables[table]) tables[table] = { rows: [], count: null, error: null, headCount: null };
    return tables[table];
  }
  function recordCall(table: string, info: Record<string, unknown>) {
    if (!calls[table]) calls[table] = [];
    calls[table].push(info);
  }
  function makeBuilder(table: string) {
    const store = get(table);
    let headMode = false;
    let countExact = false;
    let rangeArgs: [number, number] | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: (_c: string, opts?: { count?: string; head?: boolean }) => {
        headMode = !!opts?.head;
        countExact = opts?.count === "exact";
        return b;
      },
      eq: (c: string, v: unknown) => { recordCall(table, { eq: [c, v] }); return b; },
      is: (c: string, v: unknown) => { recordCall(table, { is: [c, v] }); return b; },
      in: (c: string, v: unknown) => { recordCall(table, { in: [c, v] }); return b; },
      ilike: (c: string, v: string) => { recordCall(table, { ilike: [c, v] }); return b; },
      order: () => b,
      range: (a: number, c: number) => { rangeArgs = [a, c]; recordCall(table, { range: [a, c] }); return b; },
      limit: () => b,
      maybeSingle: () => Promise.resolve({ data: null, error: store.error }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: any, reject: any) => {
        let res: { data: unknown; count: number; error: unknown };
        if (headMode) {
          // count-only (head): no rows, count from configured headCount.
          res = { data: null, count: store.headCount ?? 0, error: store.error };
        } else if (rangeArgs && countExact) {
          // paginated list: data is the sliced page, count is the TOTAL.
          const [a, c] = rangeArgs;
          res = { data: store.rows.slice(a, c + 1), count: store.rows.length, error: store.error };
        } else {
          res = { data: store.rows, count: store.count ?? store.rows.length, error: store.error };
        }
        return Promise.resolve(res).then(resolve, reject);
      },
    };
    return b;
  }
  return {
    client: {
      from: (table: string) => makeBuilder(table),
    },
    setRows(table: string, rows: unknown[]) { get(table).rows = rows; },
    setHeadCount(table: string, n: number) { get(table).headCount = n; },
    setError(table: string, e: unknown) { get(table).error = e; },
    callsFor: (table: string) => calls[table] ?? [],
    reset() { for (const k of Object.keys(tables)) delete tables[k]; for (const k of Object.keys(calls)) delete calls[k]; },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import {
  getAdminMetrics, getCompaniesWithCounts, getUsersByCompany,
  getProjectsByUser, getProjectTaskAggregates, getProjectTasks,
} from "@/lib/admin-console/queries";

beforeEach(() => h.reset());

describe("getAdminMetrics — top-of-page KPIs", () => {
  it("aggregates counts across companies/users/projects/tasks/admins", async () => {
    h.setHeadCount("organizations", 12);
    h.setHeadCount("profiles", 48);
    h.setHeadCount("projects", 30);
    h.setHeadCount("roadmap_tasks", 210);
    h.setHeadCount("admin_authorized_users", 2);

    const m = await getAdminMetrics();
    expect(m).toEqual({
      totalCompanies: 12,
      totalUsers: 48,
      totalProjects: 30,
      totalTasks: 210,
      activeAdminUsers: 2,
    });
  });

  it("tolerates zero counts (empty platform)", async () => {
    const m = await getAdminMetrics();
    expect(m.totalCompanies).toBe(0);
    expect(m.totalUsers).toBe(0);
  });
});

describe("getCompaniesWithCounts — users / projects / tasks per company", () => {
  it("rolls up counts per organization from grouped member/project/task rows", async () => {
    h.setRows("organizations", [
      { id: "o1", slug: "acme", name_i18n: { en: "Acme", es: "Acme" }, created_at: "2026-01-01T00:00:00Z" },
      { id: "o2", slug: "beta", name_i18n: { en: "Beta" }, created_at: null },
    ]);
    h.setRows("organization_members", [
      { organization_id: "o1" }, { organization_id: "o1" }, { organization_id: "o2" },
    ]);
    h.setRows("projects", [{ organization_id: "o1" }, { organization_id: "o2" }, { organization_id: "o2" }, { organization_id: "o2" }]);
    h.setRows("roadmap_tasks", [{ organization_id: "o1" }, { organization_id: "o1" }, { organization_id: "o1" }]);

    const rows = await getCompaniesWithCounts("en");
    expect(rows).toHaveLength(2);
    const acme = rows.find((r) => r.id === "o1")!;
    const beta = rows.find((r) => r.id === "o2")!;
    expect(acme.name).toBe("Acme");
    expect(acme.userCount).toBe(2);
    expect(acme.projectCount).toBe(1);
    expect(acme.taskCount).toBe(3);
    expect(beta.userCount).toBe(1);
    expect(beta.projectCount).toBe(3);
    expect(beta.taskCount).toBe(0);
  });

  it("falls back to slug when name_i18n is empty", async () => {
    h.setRows("organizations", [{ id: "o9", slug: "org9", name_i18n: {}, created_at: null }]);
    const rows = await getCompaniesWithCounts("en");
    expect(rows[0].name).toBe("org9");
  });

  it("returns [] when there are no organizations", async () => {
    h.setRows("organizations", []);
    expect(await getCompaniesWithCounts("en")).toEqual([]);
  });
});

describe("getUsersByCompany — expandable users under a company", () => {
  it("joins membership + profile + email + project/task counts", async () => {
    h.setRows("organization_members", [
      { user_id: "u1", role: "owner", created_at: "2026-01-01T00:00:00Z", profiles: { display_name: "Alice", created_at: "2026-01-01T00:00:00Z" } },
      { user_id: "u2", role: "member", created_at: null, profiles: { display_name: null, created_at: null } },
    ]);
    h.setRows("auth.users", [{ id: "u1", email: "alice@acme.io" }, { id: "u2", email: "bob@acme.io" }]);
    h.setRows("projects", [{ created_by: "u1" }, { created_by: "u1" }]);
    h.setRows("roadmap_tasks", [{ assigned_to: "u2" }, { assigned_to: "u2" }, { assigned_to: "u2" }]);

    const users = await getUsersByCompany("o1", "en");
    expect(users).toHaveLength(2);
    const alice = users.find((u) => u.userId === "u1")!;
    const bob = users.find((u) => u.userId === "u2")!;
    expect(alice.email).toBe("alice@acme.io");
    expect(alice.role).toBe("owner");
    expect(alice.projectCount).toBe(2);
    expect(alice.assignedTaskCount).toBe(0);
    expect(bob.email).toBe("bob@acme.io");
    expect(bob.assignedTaskCount).toBe(3);
    expect(bob.projectCount).toBe(0);
    expect(bob.displayName).toBeNull();
  });
});

describe("getProjectsByUser — per-project task rollup", () => {
  it("computes total/open/completed/blocked per owned project", async () => {
    h.setRows("projects", [
      { id: "p1", organization_id: "o1", slug: "tower", title_i18n: { en: "Tower" }, status: "active", created_by: "u1", updated_at: "2026-07-01T00:00:00Z" },
    ]);
    h.setRows("roadmap_tasks", [
      { project_id: "p1", status: "done" },
      { project_id: "p1", status: "done" },
      { project_id: "p1", status: "not_started" },
      { project_id: "p1", status: "in_progress" },
      { project_id: "p1", status: "blocked" },
      { project_id: "p1", status: "deferred" },
    ]);
    h.setRows("organizations", [{ id: "o1", slug: "acme", name_i18n: { en: "Acme" } }]);
    h.setRows("profiles", [{ id: "u1", display_name: "Alice" }]);
    h.setRows("auth.users", [{ id: "u1", email: "alice@acme.io" }]);

    const rows = await getProjectsByUser("en");
    expect(rows).toHaveLength(1);
    const p = rows[0];
    expect(p.projectTitle).toBe("Tower");
    expect(p.ownerName).toBe("Alice");
    expect(p.ownerEmail).toBe("alice@acme.io");
    expect(p.totalTasks).toBe(6);
    expect(p.completedTasks).toBe(2);
    expect(p.openTasks).toBe(2); // not_started + in_progress (deferred excluded)
    expect(p.blockedTasks).toBe(1);
  });
});

describe("getProjectTaskAggregates — overview per project", () => {
  it("aggregates task statuses per project", async () => {
    h.setRows("projects", [
      { id: "p1", organization_id: "o1", slug: "a", title_i18n: { en: "A" }, created_by: "u1", updated_at: null },
      { id: "p2", organization_id: "o1", slug: "b", title_i18n: { en: "B" }, created_by: null, updated_at: null },
    ]);
    h.setRows("roadmap_tasks", [
      { project_id: "p1", status: "done" },
      { project_id: "p1", status: "blocked" },
      { project_id: "p2", status: "not_started" },
    ]);
    h.setRows("organizations", [{ id: "o1", slug: "acme", name_i18n: { en: "Acme" } }]);
    h.setRows("profiles", [{ id: "u1", display_name: "Alice" }]);

    const rows = await getProjectTaskAggregates("en");
    expect(rows).toHaveLength(2);
    const p1 = rows.find((r) => r.projectId === "p1")!;
    const p2 = rows.find((r) => r.projectId === "p2")!;
    expect(p1.totalTasks).toBe(2);
    expect(p1.completedTasks).toBe(1);
    expect(p1.blockedTasks).toBe(1);
    expect(p1.openTasks).toBe(0);
    expect(p1.ownerName).toBe("Alice");
    expect(p2.ownerName).toBeNull();
    expect(p2.openTasks).toBe(1);
  });
});

describe("getProjectTasks — paginated drill-down", () => {
  it("slices rows to the requested page and reports total", async () => {
    const tasks = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i}`, title: `Task ${i}`, status: i % 3 === 0 ? "done" : "not_started",
      priority: "p2", end_date: null, updated_at: "2026-07-01T00:00:00Z",
      milestone_id: null, assigned_to: null,
    }));
    h.setRows("roadmap_tasks", tasks);
    h.setRows("milestones", []);
    h.setRows("profiles", []);

    const res = await getProjectTasks("p1", { page: 1 }, "en");
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(25);
    expect(res.total).toBe(30);
    expect(res.rows).toHaveLength(25);

    const page2 = await getProjectTasks("p1", { page: 2 }, "en");
    expect(page2.rows).toHaveLength(5);
  });

  it("records the project_id + status filters the server applies", async () => {
    h.setRows("roadmap_tasks", []);
    h.setRows("milestones", []);
    h.setRows("profiles", []);
    await getProjectTasks("p1", { status: "blocked", search: "fix" }, "en");
    const calls = h.callsFor("roadmap_tasks");
    expect(calls.some((c) => c.eq && (c.eq as unknown[])[0] === "project_id")).toBe(true);
    expect(calls.some((c) => c.eq && (c.eq as unknown[])[0] === "status")).toBe(true);
    expect(calls.some((c) => c.ilike)).toBe(true);
  });

  it("returns an empty page on query error (degrades honestly)", async () => {
    h.setError("roadmap_tasks", { message: "boom" });
    const res = await getProjectTasks("p1", {}, "en");
    expect(res.rows).toEqual([]);
    expect(res.total).toBe(0);
  });
});