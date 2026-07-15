import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260847000000_project_knowledge_objects.sql"), "utf8").toLowerCase();
const eventReferenceFix = readFileSync(resolve(process.cwd(), "supabase/migrations/20260848000000_fix_project_knowledge_event_reference.sql"), "utf8").toLowerCase();
const pgcryptoPathFix = readFileSync(resolve(process.cwd(), "supabase/migrations/20260848010000_fix_project_knowledge_pgcrypto_path.sql"), "utf8").toLowerCase();

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

  it("validates canonical evidence against project_event_log.event_id", () => {
    expect(eventReferenceFix).toContain("e.event_id = (item->>'evidence_ref')::uuid");
    expect(eventReferenceFix).not.toContain("e.id = (item->>'evidence_ref')::uuid");
    expect(eventReferenceFix).toContain("e.organization_id = p_organization_id");
    expect(eventReferenceFix).toContain("e.project_id = p_project_id");
  });

  it("makes pgcrypto digest resolvable inside security-definer mutations", () => {
    expect(pgcryptoPathFix).toContain("alter function public.create_project_knowledge_object(jsonb)");
    expect(pgcryptoPathFix).toContain("alter function public.revise_project_knowledge_object(uuid, integer, jsonb)");
    expect(pgcryptoPathFix.match(/set search_path = public, extensions, pg_temp/g)).toHaveLength(2);
  });
});
