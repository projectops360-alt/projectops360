import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260847000000_project_knowledge_objects.sql"), "utf8").toLowerCase();

describe("project knowledge object migration contract", () => {
  it("defines lifecycle persistence and service-only mutations", () => {
    for (const name of ["project_knowledge_objects", "project_knowledge_object_versions", "project_knowledge_object_evidence", "project_knowledge_object_transitions"]) {
      expect(migration).toContain(`create table public.${name}`);
      expect(migration).toContain(`alter table public.${name} enable row level security`);
    }
    expect(migration).toContain("create_project_knowledge_object");
    expect(migration).toContain("revise_project_knowledge_object");
    expect(migration).toContain("transition_project_knowledge_object");
    expect(migration).toContain("knowledge_invalid_transition");
    expect(migration).toContain("knowledge_insufficient_evidence");
    expect(migration).toContain("revoke insert, update, delete");
  });

  it("does not write graph or Knowledge OS storage", () => {
    expect(migration).not.toMatch(/insert into public\.(process_nodes|process_edges|knowledge_packages)/);
    expect(migration).not.toMatch(/update public\.(process_nodes|process_edges|knowledge_packages)/);
  });
});
