import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adaptFinancialRows } from "../adapters";
import { getPmoAggregateSnapshot } from "../engine";
import {
  BASE_REQUEST,
  PMO_ACCESS,
  financial,
  money,
  processFixture,
  project,
} from "../__fixtures__/canonical-fixtures";

describe("PMO adapters and integration boundaries", () => {
  it("does not leak a future cockpit into a historical financial fact", () => {
    const facts = adaptFinancialRows(
      [{
        organization_id: "org-a",
        project_id: "p-a",
        currency: "USD",
        data_date: "2026-03-31",
        original_budget: 1_000,
        current_baseline: 1_000,
        authorized_funding: 1_000,
        current_commitment: 200,
        actual_cost: 100,
        open_accrual: 50,
        remaining_reserve: 20,
        latest_eac: 900,
      }],
      [{
        id: "measurement-jan",
        organization_id: "org-a",
        project_id: "p-a",
        data_date: "2026-01-15",
        formula_version: "evm-1",
        currency: "USD",
        bac: 800,
        pv: 100,
        ev: 90,
        ac: 80,
      }],
      "2026-01-31T23:59:59.000Z",
    );
    expect(facts).toHaveLength(1);
    expect(facts[0]?.factId).toBe("measurement-jan");
    expect(facts[0]?.currentBaseline).toBeNull();
    expect(facts[0]?.actualCost?.amount).toBe(80);
  });

  it("weights delay by approved budget before strategic fallbacks", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, {
      access: { ...PMO_ACCESS, authorizedProjectIds: ["p-a", "p-c"] },
      projects: [
        project("p-a", {
          strategicWeight: 100,
          baselineFinishDate: "2026-01-05",
          forecastFinishDate: "2026-01-19",
        }),
        project("p-c", {
          strategicWeight: 1,
          baselineFinishDate: "2026-01-05",
          forecastFinishDate: "2026-02-02",
        }),
      ],
      financialFacts: [
        financial("p-a", { approvedBudget: money(100) }),
        financial("p-c", { approvedBudget: money(900) }),
      ],
    });
    expect(snapshot.metrics.weighted_delay_days.value).toBe(19);
    expect(snapshot.metrics.weighted_delay_days.explanation).toContain("approved budget");
  });

  it("uses batch tenant-scoped reads and never the admin client or N+1 cockpit helper", () => {
    const source = readFileSync(
      new URL("../read-model.server.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("Promise.all");
    expect(source).toContain('.eq("organization_id", org.organizationId)');
    expect(source).toContain('.in("project_id", projectIds)');
    expect(source).toContain('from "@/lib/supabase/server"');
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("getFinancialCockpitSummary");
  });

  it("returns process labels separately from numeric project-state metrics", () => {
    const snapshot = getPmoAggregateSnapshot(
      { ...BASE_REQUEST, activeLayer: "process-flow" },
      processFixture(),
    );
    expect(snapshot.processSummary.dominantVariantId).toBe("variant-1");
    expect(snapshot.metrics.total_projects.value).toBe(1);
    expect(snapshot.metrics.total_cases.value).toBe(3);
    expect(snapshot.lineage.filters.activeLayer).toBe("process-flow");
  });
});
