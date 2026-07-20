import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testState = vi.hoisted(() => ({
  rowsByTable: {} as Record<string, unknown[]>,
  errorsByTable: {} as Record<string, unknown>,
  calls: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      testState.calls.push(["from", table]);
      const query = {
        select: (columns: string) => {
          testState.calls.push(["select", columns]);
          return query;
        },
        eq: (column: string, value: unknown) => {
          testState.calls.push(["eq", [table, column, value]]);
          return query;
        },
        order: (column: string) => {
          testState.calls.push(["order", [table, column]]);
          return Promise.resolve({
            data: testState.rowsByTable[table] ?? [],
            error: testState.errorsByTable[table] ?? null,
          });
        },
      };
      return query;
    },
  }),
}));

import { getPlanPricingPeriod } from "@/lib/billing/config";
import { getPublicPricingPlans } from "@/lib/billing/public-plans";

describe("getPublicPricingPlans", () => {
  beforeEach(() => {
    testState.rowsByTable = {};
    testState.errorsByTable = {};
    testState.calls = [];
  });

  it("loads prices and inherited capabilities from canonical tables", async () => {
    testState.rowsByTable.plans = [
      {
        plan_code: "team",
        name: "Team",
        price_monthly: 16,
        price_yearly: 192,
        currency: "USD",
        is_enterprise: false,
        sort_order: 2,
      },
    ];
    testState.rowsByTable.plan_capabilities = [
      {
        capability_key: "personal_workspace",
        minimum_plan_code: "personal",
        label_en: "Personal workspace",
        label_es: "Workspace personal",
        sort_order: 101,
      },
      {
        capability_key: "advanced_gantt",
        minimum_plan_code: "team",
        label_en: "Gantt Advanced",
        label_es: "Gantt avanzado",
        sort_order: 201,
      },
      {
        capability_key: "portfolio_management",
        minimum_plan_code: "business",
        label_en: "Portfolio Management",
        label_es: "Gestión de portafolios",
        sort_order: 313,
      },
    ];

    await expect(getPublicPricingPlans()).resolves.toEqual([
      {
        planCode: "team",
        name: "Team",
        monthlyPrice: 16,
        yearlyPrice: 192,
        currency: "USD",
        isEnterprise: false,
        sortOrder: 2,
        capabilities: [
          {
            key: "personal_workspace",
            minimumPlanCode: "personal",
            labelEn: "Personal workspace",
            labelEs: "Workspace personal",
            sortOrder: 101,
          },
          {
            key: "advanced_gantt",
            minimumPlanCode: "team",
            labelEn: "Gantt Advanced",
            labelEs: "Gantt avanzado",
            sortOrder: 201,
          },
        ],
      },
    ]);
    expect(testState.calls).toContainEqual(["from", "plans"]);
    expect(testState.calls).toContainEqual(["from", "plan_capabilities"]);
    expect(testState.calls).toContainEqual(["eq", ["plans", "is_active", true]]);
    expect(testState.calls).toContainEqual([
      "eq",
      ["plan_capabilities", "is_active", true],
    ]);
  });

  it("does not expose unknown plan codes", async () => {
    testState.rowsByTable.plans = [
      {
        plan_code: "legacy",
        name: "Legacy",
        price_monthly: 999,
        price_yearly: 9999,
        currency: "USD",
        is_enterprise: false,
        sort_order: 99,
      },
    ];

    await expect(getPublicPricingPlans()).resolves.toEqual([]);
  });

  it("bills team and business monthly per user", () => {
    expect(getPlanPricingPeriod("personal", false)).toBe("perMonth");
    expect(getPlanPricingPeriod("team", false)).toBe("perUserMonth");
    expect(getPlanPricingPeriod("business", false)).toBe("perUserMonth");
    expect(getPlanPricingPeriod("enterprise", true)).toBe("none");
  });
});
