import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260911000000_project_person_membership_invariant.sql"),
  "utf8",
);

describe("project person membership invariant", () => {
  it("gives project team rows an explicit resource identity without making it unique across roles", () => {
    expect(migration).toMatch(/add column if not exists resource_id uuid/i);
    expect(migration).toContain("REFERENCES public.resources(id) ON DELETE SET NULL");
    expect(migration).toContain("idx_project_team_members_resource_id");
    expect(migration).not.toMatch(/unique\s+index[^;]*resource_id/is);
  });

  it("promotes task quick-add people into the canonical project roster", () => {
    expect(migration).toContain("_sync_quick_add_person_resource_to_project_team");
    expect(migration).toContain("task_form_quick_add");
    expect(migration).toContain("_ensure_person_resource_project_membership");
    expect(migration).toContain("'group_imported'");
    expect(migration).toContain("'read_only'");
  });

  it("also protects any person resource that is actually assigned to project work", () => {
    expect(migration).toContain("_sync_task_person_resource_to_project_team");
    expect(migration).toMatch(/AFTER INSERT OR UPDATE OF assigned_resource_id, deleted_at\s+ON public\.roadmap_tasks/i);
    expect(migration).toContain("t.assigned_resource_id = r.id");
  });

  it("repairs existing drift and does not promote unrelated person placeholders", () => {
    expect(migration).toContain("Repair existing drift");
    expect(migration).toContain("COALESCE(r.metadata->>'origin', '') = 'task_form_quick_add'");
    expect(migration).toContain("t.deleted_at IS NULL");
    expect(migration).not.toMatch(/from\s+public\.resources\s+r\s*;\s*$/im);
  });

  it("keeps the internal sync functions unavailable to normal clients", () => {
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      expect(migration).toContain(
        `REVOKE ALL ON FUNCTION public._ensure_person_resource_project_membership(uuid) FROM ${role}`,
      );
    }
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public._ensure_person_resource_project_membership(uuid) TO service_role",
    );
  });
});
