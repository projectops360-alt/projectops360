"use server";

// ============================================================================
// Pinning a KPI to a milestone
// ============================================================================
// The write side of milestone_kpi_pins. Every call: trusted session
// (getOrgContext) → zod validation → the project must belong to the caller's
// org (deny-by-default) → role guard → org-scoped write through the RLS client.
//
// A pin is an ASSIGNMENT, never a value. Nothing here computes or stores a
// number: the figure is derived live by the KPI engine from the canonical
// tables, so there is no second source to drift (REG-010).
//
// Guarded by MILESTONE-KPI-PINS.
// ============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { findKpiDefinition } from "./catalog";
import { MAX_PINS_PER_MILESTONE } from "./milestone-pins";

export interface MilestoneKpiPinResult {
  ok: boolean;
  error?: string;
}

const pinSchema = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  kpiSlug: z.string().min(1).max(120),
});

async function authorize(projectId: string, milestoneId: string) {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "Unauthorized." as const };
  }
  if (org.role === "viewer") return { error: "Viewers cannot change KPIs." as const };

  const supabase = await createClient();

  // Deny-by-default: the project must be this org's, and the milestone must
  // belong to THAT project — otherwise a valid milestone id from another
  // project would be enough to write into it.
  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, project_id")
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!milestone) return { error: "Unauthorized." as const };

  return { org, supabase };
}

export async function pinKpiToMilestone(
  input: z.infer<typeof pinSchema>,
): Promise<MilestoneKpiPinResult> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { projectId, milestoneId, kpiSlug } = parsed.data;

  const auth = await authorize(projectId, milestoneId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { org, supabase } = auth;

  // The slug must name something real: a built-in, or a custom KPI belonging to
  // this project (or org-wide). Pinning a slug that resolves to nothing would
  // put a permanently broken chip on a card.
  if (!findKpiDefinition(kpiSlug)) {
    const { data: custom } = await supabase
      .from("kpi_definitions")
      .select("id")
      .eq("slug", kpiSlug)
      .eq("organization_id", org.organizationId)
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .maybeSingle();
    if (!custom) return { ok: false, error: "Unknown KPI." };
  }

  const { count } = await supabase
    .from("milestone_kpi_pins")
    .select("id", { count: "exact", head: true })
    .eq("milestone_id", milestoneId);
  if ((count ?? 0) >= MAX_PINS_PER_MILESTONE) {
    return { ok: false, error: `A milestone can carry at most ${MAX_PINS_PER_MILESTONE} KPIs.` };
  }

  // Pinning twice is idempotent, not an error: the user's intent ("I want this
  // measured here") is already satisfied, and the unique constraint says so.
  const { error } = await supabase.from("milestone_kpi_pins").upsert(
    {
      organization_id: org.organizationId,
      project_id: projectId,
      milestone_id: milestoneId,
      kpi_slug: kpiSlug,
      order_index: count ?? 0,
      created_by: org.userId,
    },
    { onConflict: "milestone_id,kpi_slug", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "Could not pin the KPI." };

  revalidatePath(`/projects/${projectId}/execution-map/living-graph`);
  return { ok: true };
}

export async function unpinKpiFromMilestone(
  input: z.infer<typeof pinSchema>,
): Promise<MilestoneKpiPinResult> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { projectId, milestoneId, kpiSlug } = parsed.data;

  const auth = await authorize(projectId, milestoneId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { org, supabase } = auth;

  const { error } = await supabase
    .from("milestone_kpi_pins")
    .delete()
    .eq("milestone_id", milestoneId)
    .eq("kpi_slug", kpiSlug)
    .eq("organization_id", org.organizationId);
  if (error) return { ok: false, error: "Could not remove the KPI." };

  revalidatePath(`/projects/${projectId}/execution-map/living-graph`);
  return { ok: true };
}
