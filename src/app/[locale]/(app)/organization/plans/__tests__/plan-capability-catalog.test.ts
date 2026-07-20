import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getCapabilitiesForPlan,
  type PlanCapability,
  type PlanCode,
} from "@/lib/billing/config";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260854000000_plan_capability_catalog.sql",
);

function catalogFromMigration(): PlanCapability[] {
  const sql = readFileSync(migrationPath, "utf8");
  return Array.from(
    sql.matchAll(
      /\('([^']+)', '(personal|team|business|enterprise)', '([^']+)', '([^']+)', (\d+)\)/g,
    ),
    ([, key, minimumPlanCode, labelEn, labelEs, sortOrder]) => ({
      key,
      minimumPlanCode: minimumPlanCode as PlanCode,
      labelEn,
      labelEs,
      sortOrder: Number(sortOrder),
    }),
  );
}

describe("plan capability catalog", () => {
  it("defines a unique localized catalog for every membership tier", () => {
    const capabilities = catalogFromMigration();
    const tierCounts = capabilities.reduce<Record<string, number>>(
      (counts, capability) => ({
        ...counts,
        [capability.minimumPlanCode]:
          (counts[capability.minimumPlanCode] ?? 0) + 1,
      }),
      {},
    );

    expect(tierCounts).toEqual({
      personal: 6,
      team: 15,
      business: 21,
      enterprise: 18,
    });
    expect(capabilities).toHaveLength(60);
    expect(new Set(capabilities.map((capability) => capability.key)).size).toBe(
      capabilities.length,
    );
    expect(
      capabilities.every(
        (capability) => capability.labelEn && capability.labelEs,
      ),
    ).toBe(true);
  });

  it("inherits every capability from lower membership tiers", () => {
    const capabilities = catalogFromMigration();

    expect(getCapabilitiesForPlan("personal", capabilities)).toHaveLength(6);
    expect(getCapabilitiesForPlan("team", capabilities)).toHaveLength(21);
    expect(getCapabilitiesForPlan("business", capabilities)).toHaveLength(42);
    expect(getCapabilitiesForPlan("enterprise", capabilities)).toHaveLength(60);
  });

  it("keeps the catalog server-only with RLS enabled", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.plan_capabilities FROM anon, authenticated",
    );
    expect(sql).toContain("ON CONFLICT (capability_key) DO UPDATE");
  });
});
