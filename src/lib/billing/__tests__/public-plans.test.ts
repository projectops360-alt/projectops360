import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const testState = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as unknown,
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
          testState.calls.push(["eq", [column, value]]);
          return query;
        },
        order: (column: string) => {
          testState.calls.push(["order", column]);
          return Promise.resolve({ data: testState.rows, error: testState.error });
        },
      };
      return query;
    },
  }),
}));

import { getPublicPricingPlans } from "@/lib/billing/public-plans";
import { getPlanPricingPeriod } from "@/lib/billing/config";

describe("getPublicPricingPlans", () => {
  beforeEach(() => {
    testState.rows = [];
    testState.error = null;
    testState.calls = [];
  });

  it("loads active commercial values from the plans table", async () => {
    testState.rows = [
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

    await expect(getPublicPricingPlans()).resolves.toEqual([
      {
        planCode: "team",
        name: "Team",
        monthlyPrice: 16,
        yearlyPrice: 192,
        currency: "USD",
        isEnterprise: false,
        sortOrder: 2,
      },
    ]);
    expect(testState.calls).toContainEqual(["from", "plans"]);
    expect(testState.calls).toContainEqual(["eq", ["is_active", true]]);
    expect(testState.calls).toContainEqual(["order", "sort_order"]);
  });

  it("does not expose unknown plan codes", async () => {
    testState.rows = [
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
