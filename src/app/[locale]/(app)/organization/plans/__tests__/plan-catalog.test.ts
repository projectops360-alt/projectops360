import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getCapabilityGroupsForPlan,
  PLAN_CAPABILITY_GROUPS,
  PLAN_COMMERCIAL_CATALOG,
} from "../plan-catalog";

describe("membership plan catalog", () => {
  it("defines the requested prices, subtitles, and primary limits", () => {
    expect(PLAN_COMMERCIAL_CATALOG.personal).toMatchObject({
      monthlyPrice: 9,
      yearlyPrice: 96,
      subtitle: { en: "Organize your work.", es: "Organiza tu trabajo." },
      limits: {
        max_active_projects: 5,
        max_billable_users: 1,
        max_ai_credits_per_month: 25,
        max_memory_storage_mb: 500,
      },
    });
    expect(PLAN_COMMERCIAL_CATALOG.team).toMatchObject({
      monthlyPrice: 16,
      yearlyPrice: 192,
      limits: {
        max_active_projects: null,
        max_billable_users: 10,
        max_ai_credits_per_month: 300,
        max_memory_storage_mb: 5_120,
      },
    });
    expect(PLAN_COMMERCIAL_CATALOG.business).toMatchObject({
      monthlyPrice: 29,
      yearlyPrice: 348,
      limits: {
        max_active_projects: null,
        max_billable_users: 50,
        max_ai_credits_per_month: 5_000,
        max_memory_storage_mb: 51_200,
      },
    });
    expect(PLAN_COMMERCIAL_CATALOG.enterprise).toMatchObject({
      monthlyPrice: null,
      yearlyPrice: null,
      limits: {
        max_active_projects: null,
        max_billable_users: null,
        max_ai_credits_per_month: null,
        max_memory_storage_mb: null,
      },
    });
  });

  it("keeps SSO enterprise-only while enabling the requested base features", () => {
    expect(PLAN_COMMERCIAL_CATALOG.personal.features).toMatchObject({
      stakeholder_portal_enabled: true,
      scope_creep_detection_enabled: true,
      advanced_governance_enabled: false,
      sso_enabled: false,
    });
    expect(PLAN_COMMERCIAL_CATALOG.team.features).toMatchObject({
      advanced_governance_enabled: true,
      integrations_enabled: true,
      project_memory_enabled: true,
      portfolio_view_enabled: false,
      sso_enabled: false,
    });
    expect(PLAN_COMMERCIAL_CATALOG.business.features).toMatchObject({
      advanced_governance_enabled: true,
      portfolio_view_enabled: true,
      integrations_enabled: true,
      audit_logs_enabled: true,
      sso_enabled: false,
    });
    expect(Object.values(PLAN_COMMERCIAL_CATALOG.enterprise.features).every(Boolean)).toBe(true);
  });

  it("inherits intelligence capabilities by plan tier without duplicate flags", () => {
    expect(getCapabilityGroupsForPlan("personal")).toHaveLength(0);
    expect(getCapabilityGroupsForPlan("toString")).toHaveLength(0);
    expect(getCapabilityGroupsForPlan("team").map((group) => group.tier)).toEqual(["team"]);
    expect(getCapabilityGroupsForPlan("business").map((group) => group.tier)).toEqual(["team", "business"]);
    expect(getCapabilityGroupsForPlan("enterprise").map((group) => group.tier)).toEqual([
      "team",
      "business",
      "enterprise",
    ]);

    const keys = PLAN_CAPABILITY_GROUPS.flatMap((group) => group.capabilities.map((capability) => capability.key));
    expect(keys).toHaveLength(54);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses a data-only migration that preserves plan and subscription identities", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260853000000_membership_plan_catalog.sql"),
      "utf8",
    );

    expect(sql).toContain("UPDATE public.plans AS plan");
    expect(sql).toContain("ON CONFLICT (plan_id) DO UPDATE");
    expect(sql).not.toMatch(/\b(?:ALTER|CREATE|DROP|TRUNCATE|DELETE)\b/i);
    expect(sql).not.toContain("UPDATE public.subscriptions");
  });
});
