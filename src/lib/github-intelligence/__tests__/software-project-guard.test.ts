import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The guard is server-only (imports `server-only`, the SSR supabase client and
// auth). We mock those three so the gating logic is executable in vitest without
// a live DB. This proves the software-project-only + flag + tenancy + RBAC
// enforcement that navigation, settings, dashboard and Isabella all funnel
// through.

const h = vi.hoisted(() => ({
  projectRow: null as null | { id: string; project_type: string },
  role: "admin" as "owner" | "admin" | "member" | "viewer",
  orgThrows: false,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth", () => ({
  getOrgContext: vi.fn(async () => {
    if (h.orgThrows) throw new Error("Not authenticated");
    return {
      userId: "user-1", email: "a@b.c", displayName: null, avatarUrl: null,
      locale: "en", role: h.role, organizationId: "org-A",
      organizationName: {}, organizationSlug: "acme",
    };
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: async () => ({ data: h.projectRow }),
      };
      return builder;
    },
  })),
}));

import { assertGitHubIntelligenceAvailable } from "../software-project-guard";

const original = process.env.GITHUB_INTELLIGENCE_ENABLED;
beforeEach(() => {
  process.env.GITHUB_INTELLIGENCE_ENABLED = "true"; // flag ON for most cases
  h.projectRow = { id: "proj-A", project_type: "software_development" };
  h.role = "admin";
  h.orgThrows = false;
});
afterEach(() => {
  if (original === undefined) delete process.env.GITHUB_INTELLIGENCE_ENABLED;
  else process.env.GITHUB_INTELLIGENCE_ENABLED = original;
});

describe("assertGitHubIntelligenceAvailable", () => {
  it("flag OFF → feature_disabled (module fully dark)", async () => {
    process.env.GITHUB_INTELLIGENCE_ENABLED = "false";
    const r = await assertGitHubIntelligenceAvailable("proj-A");
    expect(r).toEqual({ ok: false, reason: "feature_disabled" });
  });

  it("unauthenticated → not_authenticated", async () => {
    h.orgThrows = true;
    const r = await assertGitHubIntelligenceAvailable("proj-A");
    expect(r).toEqual({ ok: false, reason: "not_authenticated" });
  });

  it("project not in org (cross-org / missing) → project_not_found (no leak)", async () => {
    h.projectRow = null;
    const r = await assertGitHubIntelligenceAvailable("proj-A");
    expect(r).toEqual({ ok: false, reason: "project_not_found" });
  });

  it("NON-software project → not_software_project", async () => {
    h.projectRow = { id: "proj-A", project_type: "residential_construction" };
    const r = await assertGitHubIntelligenceAvailable("proj-A");
    expect(r).toEqual({ ok: false, reason: "not_software_project" });
  });

  it("software project + flag ON → ok (viewer can read, canManage=false)", async () => {
    h.role = "viewer";
    const r = await assertGitHubIntelligenceAvailable("proj-A");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.projectType).toBe("software_development");
      expect(r.canManage).toBe(false);
    }
  });

  it("manager can read + manage", async () => {
    h.role = "admin";
    const r = await assertGitHubIntelligenceAvailable("proj-A", { requireManage: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.canManage).toBe(true);
  });

  it("viewer requesting a manage action → forbidden", async () => {
    h.role = "viewer";
    const r = await assertGitHubIntelligenceAvailable("proj-A", { requireManage: true });
    expect(r).toEqual({ ok: false, reason: "forbidden" });
  });
});
