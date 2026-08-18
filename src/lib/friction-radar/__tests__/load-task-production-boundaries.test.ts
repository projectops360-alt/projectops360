import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../load-task-production.ts", import.meta.url),
  "utf8",
);

describe("Friction Radar production source boundary", () => {
  it("uses the authenticated server client and never an admin/service-role client", () => {
    expect(source).toContain('import { createClient } from "@/lib/supabase/server"');
    expect(source).toContain("getOrgContext");
    expect(source).not.toMatch(/createAdminClient|service[_-]?role/i);
  });

  it("contains no mutation-capable Supabase calls", () => {
    expect(source).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it("loads the documented operational sources without process-node fallbacks", () => {
    for (const table of [
      "roadmap_tasks",
      "milestones",
      "project_event_log",
      "project_event_objects",
      "subtask_time_entries",
      "task_dependencies",
      "task_subtasks",
      "resources",
      "resource_assignments",
      "project_team_members",
      "project_resource_allocations",
      "resource_profiles",
      "resource_workload_snapshots",
      "resource_availability_exceptions",
      "organization_members",
      "risks",
      "issues",
      "decisions",
      "budget_items",
      "cost_actuals",
      "financial_measurement_snapshots",
      "financial_project_cockpit",
      "critical_path_snapshots",
    ]) {
      expect(source, table).toContain(`"${table}"`);
    }
    expect(source).not.toMatch(/process_nodes|process_edges/);
  });

  it("scopes every project-owned operational query by tenant and project", () => {
    const projectOwnedTables = [
      "roadmap_tasks",
      "milestones",
      "subtask_time_entries",
      "task_dependencies",
      "task_subtasks",
      "resource_assignments",
      "project_team_members",
      "project_resource_allocations",
      "resource_workload_snapshots",
      "resource_availability_exceptions",
      "risks",
      "issues",
      "decisions",
      "budget_items",
      "cost_actuals",
      "financial_measurement_snapshots",
      "financial_project_cockpit",
      "critical_path_snapshots",
    ];

    for (const table of projectOwnedTables) {
      const start = source.indexOf(`client.from("${table}")`);
      expect(start, `${table} query exists`).toBeGreaterThanOrEqual(0);
      const boundary = source.indexOf("client.from(", start + 1);
      const query = source.slice(start, boundary === -1 ? undefined : boundary);
      expect(query, `${table} organization scope`).toContain(
        '.eq("organization_id", organizationId)',
      );
      expect(query, `${table} project scope`).toContain(
        '.eq("project_id", projectId)',
      );
    }
  });

  it("reports unavailable sources instead of treating absence as zero friction", () => {
    expect(source).toContain('missing ? "not_present" : "error"');
    expect(source).toContain('`${item.table}:read_error`');
    expect(source).toContain('`${item.table}:truncated`');
    expect(source).toContain('`${item.table}:not_present`');
    expect(source).toContain(
      '"financial_project_cockpit:insufficient_inputs"',
    );
  });
});
