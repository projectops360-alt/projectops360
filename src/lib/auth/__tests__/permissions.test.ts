import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Configurable mock of the Supabase admin client ──────────────────────────
// Each table returns a `single` (for maybeSingle) and a `list` (for awaited
// queries). Tests mutate `responses` to model who-can-see-what.
const h = vi.hoisted(() => {
  const responses: Record<string, { single?: unknown; list?: unknown[] }> = {};
  function builder(table: string) {
    const r = responses[table] ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: () => b,
      neq: () => b,
      is: () => b,
      in: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => ({ data: r.single ?? null, error: null }),
      single: async () => ({ data: r.single ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: r.list ?? [], error: null }),
    };
    return b;
  }
  const client = { from: (t: string) => builder(t) };
  return { responses, client };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import {
  getProjectAccess,
  getAccessibleProjectIds,
  canAssignTask,
  canManageProjectMembers,
  canViewProjectMemory,
  type ProjectAccess,
} from "@/lib/auth/permissions";
import { legacyRoleToOrgRole, type OrgContext } from "@/lib/auth/org-context";
import { navGroupForRole } from "@/config/navigation";
import { workspaceRoleToOrgRole, seatTypeToOrgRole } from "@/lib/billing/config";

function ctx(over: Partial<OrgContext>): OrgContext {
  return {
    userId: "u-pm", email: "pm@a.com", displayName: "PM", avatarUrl: null, locale: "en",
    role: "member", orgRole: "PROJECT_MANAGER", isPmoLevel: false,
    organizationId: "org-A", organizationName: { en: "A" }, organizationSlug: "a",
    ...over,
  };
}

beforeEach(() => {
  for (const k of Object.keys(h.responses)) delete h.responses[k];
});

describe("role → org_role mappings", () => {
  it("maps legacy roles", () => {
    expect(legacyRoleToOrgRole("owner")).toBe("COMPANY_OWNER");
    expect(legacyRoleToOrgRole("admin")).toBe("PMO_ADMIN");
    expect(legacyRoleToOrgRole("member")).toBe("TEAM_MEMBER");
    expect(legacyRoleToOrgRole("viewer")).toBe("VIEWER");
    expect(legacyRoleToOrgRole(undefined)).toBe("TEAM_MEMBER");
  });
  it("maps workspace + seat roles", () => {
    expect(workspaceRoleToOrgRole("Project Manager")).toBe("PROJECT_MANAGER");
    expect(workspaceRoleToOrgRole("PMO Manager")).toBe("PMO_ADMIN");
    expect(seatTypeToOrgRole("full_seat")).toBe("PROJECT_MANAGER");
    expect(seatTypeToOrgRole("viewer_free")).toBe("VIEWER");
  });
});

describe("navGroupForRole", () => {
  it("routes roles to the right audience", () => {
    expect(navGroupForRole("PMO_ADMIN", true)).toBe("pmo");
    expect(navGroupForRole("PROJECT_MANAGER", false)).toBe("pm");
    expect(navGroupForRole("TEAM_MEMBER", false)).toBe("member");
    expect(navGroupForRole("VIEWER", false)).toBe("member");
  });
});

describe("getProjectAccess — project isolation", () => {
  it("PMO-level sees any project in the org without membership", async () => {
    h.responses.projects = { single: { id: "p1", organization_id: "org-A", project_manager_id: "someone", created_by: "someone" } };
    const a = await getProjectAccess(ctx({ orgRole: "PMO_ADMIN", isPmoLevel: true, userId: "u-pmo" }), "p1");
    expect(a.canView).toBe(true);
    expect(a.isPmo).toBe(true);
  });

  it("a PM sees a project they manage", async () => {
    h.responses.projects = { single: { id: "p1", organization_id: "org-A", project_manager_id: "u-pm", created_by: "x" } };
    const a = await getProjectAccess(ctx({ userId: "u-pm" }), "p1");
    expect(a.canView).toBe(true);
    expect(a.isManager).toBe(true);
  });

  it("a PM CANNOT see another PM's project (no membership)", async () => {
    h.responses.projects = { single: { id: "p2", organization_id: "org-A", project_manager_id: "other-pm", created_by: "other-pm" } };
    h.responses.project_team_members = { single: null };
    h.responses.stakeholder_access = { single: null };
    const a = await getProjectAccess(ctx({ userId: "u-pm" }), "p2");
    expect(a.canView).toBe(false);
  });

  it("a team member sees a project where they are an active member", async () => {
    h.responses.projects = { single: { id: "p3", organization_id: "org-A", project_manager_id: "other", created_by: "other" } };
    h.responses.project_team_members = { single: { permission_level: "contributor", can_manage_tasks: true } };
    const a = await getProjectAccess(ctx({ orgRole: "TEAM_MEMBER", userId: "u-tm" }), "p3");
    expect(a.canView).toBe(true);
    expect(a.isMember).toBe(true);
    expect(canAssignTask(a)).toBe(true); // has can_manage_tasks flag
  });

  it("cross-org access is impossible (project not in user's org → not found)", async () => {
    // The org-filtered lookup returns null for a project in another org.
    h.responses.projects = { single: null };
    const a = await getProjectAccess(ctx({ orgRole: "PMO_ADMIN", isPmoLevel: true, userId: "u-pmo", organizationId: "org-A" }), "p-in-org-B");
    expect(a.canView).toBe(false);
  });
});

describe("getAccessibleProjectIds", () => {
  it("returns null (all) for PMO-level", async () => {
    const ids = await getAccessibleProjectIds(ctx({ orgRole: "PMO_ADMIN", isPmoLevel: true }));
    expect(ids).toBeNull();
  });

  it("unions managed/created/member/stakeholder projects for non-PMO", async () => {
    h.responses.projects = { list: [{ id: "p1" }] };           // managed AND created both hit projects
    h.responses.project_team_members = { list: [{ project_id: "p2" }] };
    h.responses.stakeholder_access = { list: [{ project_id: "p3" }] };
    const ids = await getAccessibleProjectIds(ctx({ userId: "u-pm" }));
    expect(ids).not.toBeNull();
    expect(new Set(ids!)).toEqual(new Set(["p1", "p2", "p3"]));
  });
});

describe("capability helpers", () => {
  const base: ProjectAccess = {
    projectId: "p", canView: true, isPmo: false, isManager: false, isMember: true,
    isStakeholder: false, permissionLevel: "contributor",
    flags: { can_manage_tasks: false, can_manage_team: false, can_access_memory: false, can_manage_risks: false } as Record<string, boolean>,
  };
  it("PM/manager can do everything project-level", () => {
    const mgr = { ...base, isManager: true };
    expect(canAssignTask(mgr)).toBe(true);
    expect(canManageProjectMembers(mgr)).toBe(true);
    expect(canViewProjectMemory(mgr)).toBe(true);
  });
  it("a plain contributor without flags cannot manage members or view memory", () => {
    expect(canManageProjectMembers(base)).toBe(false);
    expect(canViewProjectMemory(base)).toBe(false);
  });
});
