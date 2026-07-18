import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read("supabase/migrations/20260852000000_security_rpc_and_membership_hardening.sql");
const memberActions = read("src/app/[locale]/(app)/organization/members/actions.ts");
const memberPage = read("src/app/[locale]/(app)/organization/members/page.tsx");
const teamActions = read("src/app/[locale]/(app)/team/actions.ts");
const teamPage = read("src/app/[locale]/(app)/team/page.tsx");
const orgContext = read("src/lib/auth/org-context.ts");
const adminClient = read("src/lib/supabase/admin.ts");
const middleware = read("src/middleware.ts");

describe("security hardening contracts", () => {
  it("keeps privileged graph implementations outside the exposed schema", () => {
    for (const signature of [
      "find_path(uuid, uuid, uuid, integer)",
      "detect_cycles(uuid, text)",
      "extract_subgraph(uuid, text, uuid, integer)",
      "get_process_timeline(uuid, date, date)",
      "get_node_neighbors(uuid, uuid, text, text[])",
    ]) {
      expect(migration).toContain(`alter function public.${signature} set schema private`);
      expect(migration).toContain(`revoke execute on function public.${signature} from public, anon`);
    }

    expect(migration.match(/not coalesce\(public\.can_access_project\(p_project_id\), false\)/g)).toHaveLength(5);
  });

  it("treats only active organization memberships as authorization", () => {
    expect(migration).toContain("membership.status = 'active'");
    expect(orgContext).toContain('.eq("status", "active")');
    expect(orgContext).toContain('throw new Error("No active organization membership")');
  });

  it("prevents tenant administrators from taking over global identities", () => {
    expect(memberActions).not.toContain("auth.admin.listUsers");
    expect(memberActions).not.toContain("auth.admin.updateUserById");
    expect(memberActions).not.toContain("auth.admin.deleteUser");
    expect(memberActions).toContain('return { error: "password_recovery_required" }');
    expect(memberActions).toContain('return { error: "platform_admin_required" }');
    expect(memberActions).toContain('return { error: "identity_change_requires_user" }');
    expect(teamActions).not.toContain("auth.admin.listUsers");
  });

  it("never enumerates the global Auth directory for tenant screens", () => {
    expect(memberPage).not.toContain("auth.admin.listUsers");
    expect(teamPage).not.toContain("auth.admin.listUsers");
    expect(memberPage).toContain('rpc("admin_get_user_emails"');
    expect(teamPage).toContain('rpc("admin_get_user_emails"');
  });

  it("keeps the service-role client out of client bundles", () => {
    expect(adminClient).toMatch(/^import "server-only";/);
  });

  it("keeps temporary preview surfaces behind authentication", () => {
    expect(middleware).not.toContain('"/auth/callback", "/navigator-preview"');
    expect(middleware).toContain('pathname === "/navigator-preview"');
    expect(middleware).toContain("const { response, user } = await updateSession(request)");
  });
});
