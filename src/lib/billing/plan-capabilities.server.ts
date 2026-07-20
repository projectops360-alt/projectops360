import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPlanCode,
  type PlanCapability,
  type PlanCode,
} from "./config";

type AdminClient = ReturnType<typeof createAdminClient>;

interface PlanCapabilityRow {
  capability_key: string;
  minimum_plan_code: string;
  label_en: string;
  label_es: string;
  sort_order: number;
}

export async function getPlanCapabilityCatalog(
  client: AdminClient = createAdminClient(),
): Promise<PlanCapability[]> {
  const { data, error } = await client
    .from("plan_capabilities")
    .select(
      "capability_key, minimum_plan_code, label_en, label_es, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    throw new Error("Unable to load the plan capability catalog.");
  }

  return ((data ?? []) as PlanCapabilityRow[])
    .filter(
      (capability): capability is PlanCapabilityRow & {
        minimum_plan_code: PlanCode;
      } => isPlanCode(capability.minimum_plan_code),
    )
    .map((capability) => ({
      key: capability.capability_key,
      minimumPlanCode: capability.minimum_plan_code,
      labelEn: capability.label_en,
      labelEs: capability.label_es,
      sortOrder: capability.sort_order,
    }));
}
