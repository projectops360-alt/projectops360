"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isPlatformAdmin } from "@/lib/admin-console/access.server";
import { LIMIT_FIELDS, FEATURE_FIELDS } from "@/lib/billing/config";

// The plan catalog is GLOBAL (it powers the landing-page pricing), so edits
// require a real platform/system admin — the same gate as the Admin Console
// (admin_authorized_users + hardcoded platform owners), NOT the org-level
// "owner" role, which every personal org has.
async function platformAdmin() {
  let org;
  try { org = await getOrgContext(); } catch { return null; }
  return (await isPlatformAdmin(org.email)) ? org : null;
}

const LIMIT_KEYS = LIMIT_FIELDS.map((f) => f.key);
const FEATURE_KEYS = FEATURE_FIELDS.map((f) => f.key);

/** Update a plan's editable pricing/metadata (platform owner only). */
export async function updatePlanAction(input: {
  planId: string; name?: string; description?: string;
  priceMonthly?: number; priceYearly?: number; currency?: string; isActive?: boolean;
}): Promise<{ error?: string }> {
  const org = await platformAdmin();
  if (!org) return { error: "not_allowed" };
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = String(input.name).trim().slice(0, 120);
  if (input.description !== undefined) patch.description = String(input.description).trim().slice(0, 500) || null;
  if (input.priceMonthly !== undefined) patch.price_monthly = Math.max(0, Number(input.priceMonthly) || 0);
  if (input.priceYearly !== undefined) patch.price_yearly = Math.max(0, Number(input.priceYearly) || 0);
  if (input.currency !== undefined) patch.currency = String(input.currency).trim().toUpperCase().slice(0, 8) || "USD";
  if (input.isActive !== undefined) patch.is_active = !!input.isActive;
  if (Object.keys(patch).length === 0) return {};

  const supabase = createAdminClient();
  const { error } = await supabase.from("plans").update(patch).eq("id", input.planId);
  if (error) return { error: "unexpected" };
  await logAudit({ org, action: "update", entityType: "plans", entityId: input.planId, metadata: patch });
  return {};
}

/** Update a plan's entitlements (limits + feature flags). Platform owner only. */
export async function updateEntitlementsAction(input: {
  planId: string; limits?: Record<string, number | null>; features?: Record<string, boolean>;
}): Promise<{ error?: string }> {
  const org = await platformAdmin();
  if (!org) return { error: "not_allowed" };
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input.limits ?? {})) {
    if (!LIMIT_KEYS.includes(k)) continue;
    patch[k] = v === null || v === undefined || (v as unknown as string) === "" ? null : Math.max(0, Math.floor(Number(v)));
  }
  for (const [k, v] of Object.entries(input.features ?? {})) {
    if (!FEATURE_KEYS.includes(k)) continue;
    patch[k] = !!v;
  }
  if (Object.keys(patch).length === 0) return {};

  const supabase = createAdminClient();
  // Ensure an entitlements row exists for the plan, then update.
  const { data: existing } = await supabase.from("plan_entitlements").select("id").eq("plan_id", input.planId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("plan_entitlements").update(patch).eq("plan_id", input.planId);
    if (error) return { error: "unexpected" };
  } else {
    const { error } = await supabase.from("plan_entitlements").insert({ plan_id: input.planId, ...patch });
    if (error) return { error: "unexpected" };
  }
  await logAudit({ org, action: "update", entityType: "plan_entitlements", entityId: input.planId, metadata: patch });
  return {};
}
