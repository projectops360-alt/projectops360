import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCapabilitiesForPlan,
  isPlanCode,
  type PlanCode,
  type PublicPricingPlan,
} from "./config";
import { getPlanCapabilityCatalog } from "./plan-capabilities.server";

export type { PublicPricingPlan } from "./config";

interface PlanRow {
  plan_code: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  is_enterprise: boolean;
  sort_order: number;
}

export async function getPublicPricingPlans(): Promise<PublicPricingPlan[]> {
  const supabase = createAdminClient();
  const [{ data, error }, capabilities] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "plan_code, name, price_monthly, price_yearly, currency, is_enterprise, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order"),
    getPlanCapabilityCatalog(supabase),
  ]);

  if (error) {
    throw new Error("Unable to load the public plan catalog.");
  }

  return ((data ?? []) as PlanRow[])
    .filter((plan): plan is PlanRow & { plan_code: PlanCode } =>
      isPlanCode(plan.plan_code),
    )
    .map((plan) => ({
      planCode: plan.plan_code,
      name: plan.name,
      monthlyPrice: Number(plan.price_monthly),
      yearlyPrice: Number(plan.price_yearly),
      currency: plan.currency,
      isEnterprise: plan.is_enterprise,
      sortOrder: plan.sort_order,
      capabilities: getCapabilitiesForPlan(plan.plan_code, capabilities),
    }));
}
