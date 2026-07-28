// ============================================================================
// REG-038 — Live verification against the DEV database (read-only)
// ============================================================================
// NOT part of the CI suite: gated by REPORT_FILTERS_VERIFY=1 (skipped
// otherwise), because it asserts against real rows that change over time.
//
// It runs the actual Report Builder pipeline (runReport → Supabase → filter
// engine) for the combination the defect was reported with:
//   Project = Agro*  AND  Owner = Paul*
// and proves it returns rows instead of an empty report.
//
// Read-only: issues SELECTs only. Uses .env.local, which points at DEV.
//   set -a && source .env.local && set +a
//   REPORT_FILTERS_VERIFY=1 npx vitest run src/lib/reports/__tests__/task-report-filters.live.test.ts
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const RUN = process.env.REPORT_FILTERS_VERIFY === "1";

/** Organization that owns the Agro* projects from the first bug report. */
const ORG = process.env.REPORT_FILTERS_VERIFY_ORG ?? "5124cdfd-061f-4c6e-96ca-08989c6bd03c";
/** Ascendia — owns Mobile App Design, whose owners are stored with accents. */
const ORG_ACCENTS = process.env.REPORT_FILTERS_VERIFY_ORG_ACCENTS ?? "dc8205c1-c4a2-4f3c-83b9-0e1589590c13";

describe.runIf(RUN)("REG-038 live — Project = Agro* AND Owner = Paul* (DEV data)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let runReport: any;

  beforeAll(async () => {
    loadEnvLocal();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    // Guard: never point this at production.
    expect(url, "NEXT_PUBLIC_SUPABASE_URL must be set").not.toBe("");
    expect(url, "refusing to run against the production project").not.toContain("ocopmlnkvidvmxgiwvxw");
    ({ runReport } = await import("../query-service"));
  });

  const base = {
    datasetId: "task_execution",
    columns: ["project_name", "task_name", "owner", "status", "progress_pct"],
    grouping: null,
    sort: [],
    visualization: "table" as const,
  };

  const report = async (filters: unknown[], organizationId = ORG) => {
    const r = await runReport({ ...base, filters }, { organizationId, projectId: null }, { page: 1, pageSize: 500 });
    if ("error" in r) throw new Error(`report failed: ${r.error} ${r.details?.join("; ") ?? ""}`);
    return r;
  };

  it("the project filter alone returns Agro* tasks", async () => {
    const { totalRows } = await report([{ column: "project_name", operator: "equals", value: "Agro*" }]);
    expect(totalRows).toBeGreaterThan(0);
  });

  it("the owner filter alone returns Paul* tasks", async () => {
    const { totalRows } = await report([{ column: "owner", operator: "equals", value: "Paul*" }]);
    expect(totalRows).toBeGreaterThan(0);
  });

  it("BOTH filters together still return rows (the reported defect)", async () => {
    const { rows, totalRows } = await report([
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
    ]);
    expect(totalRows).toBeGreaterThan(0);
    for (const r of rows) {
      expect(String(r.project_name).toLowerCase().startsWith("agro")).toBe(true);
      expect(String(r.owner).toLowerCase().startsWith("paul")).toBe(true);
    }
    console.log(`[REG-038] Project=Agro* AND Owner=Paul* → ${totalRows} rows`);
  });

  it("adding a progress filter narrows without emptying", async () => {
    const two = await report([
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
    ]);
    const three = await report([
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
      { column: "progress_pct", operator: "greater_than_or_equal", value: 0 },
    ]);
    expect(three.totalRows).toBe(two.totalRows);
    console.log(`[REG-038] with Progress >= 0 → ${three.totalRows} rows`);
  });

  it("Proyecto = mobil* AND Responsable = Sofia* (unaccented input) returns rows", async () => {
    const only = await report([{ column: "project_name", operator: "equals", value: "mobil*" }], ORG_ACCENTS);
    const both = await report([
      { column: "project_name", operator: "equals", value: "mobil*" },
      { column: "owner", operator: "equals", value: "Sofia*" },
    ], ORG_ACCENTS);
    expect(only.totalRows).toBeGreaterThan(0);
    expect(both.totalRows).toBeGreaterThan(0);
    expect(both.totalRows).toBeLessThanOrEqual(only.totalRows);
    console.log(`[REG-038] mobil* → ${only.totalRows} rows; + Sofia* → ${both.totalRows} rows`);
    console.log(`[REG-038] owners matched: ${[...new Set(both.rows.map((r: Record<string, unknown>) => r.owner))].join(", ")}`);
  });

  it("owners are resolved to names, not left blank", async () => {
    const { rows } = await report([{ column: "project_name", operator: "equals", value: "Agro*" }]);
    const assigned = rows.filter((r: Record<string, unknown>) => r.owner !== "");
    expect(assigned.length).toBeGreaterThan(0);
    console.log(`[REG-038] owners resolved: ${new Set(assigned.map((r: Record<string, unknown>) => r.owner)).size} distinct`);
  });
});
