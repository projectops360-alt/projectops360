import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260912000000_project_manager_team_membership_invariant.sql"),
  "utf8",
);

describe("project manager membership invariant", () => {
  it("keeps the explicit project manager in the canonical Team & Roles roster", () => {
    expect(migration).toContain("_ensure_project_manager_team_membership");
    expect(migration).toContain("project_manager_id");
    expect(migration).toContain("'Project Manager'");
    expect(migration).toContain("'project_manager'");
  });

  it("reacts to project manager changes and backfills existing projects", () => {
    expect(migration).toContain("trg_sync_project_manager_to_project_team");
    expect(migration).toMatch(/AFTER INSERT OR UPDATE OF project_manager_id, organization_id, deleted_at/i);
    expect(migration).toContain("Repair current projects");
  });

  it("preserves multi-role semantics instead of overwriting another project role", () => {
    expect(migration).toContain("Preserve any other legitimate role");
    expect(migration).toMatch(/INSERT INTO public\.project_team_members/i);
  });

  it("keeps internal sync helpers unavailable to normal clients", () => {
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      expect(migration).toContain(
        `REVOKE ALL ON FUNCTION public._ensure_project_manager_team_membership(uuid) FROM ${role}`,
      );
    }
  });
});