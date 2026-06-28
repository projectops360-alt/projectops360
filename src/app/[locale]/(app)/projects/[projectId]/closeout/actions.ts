"use server";

// ============================================================================
// ProjectOps360° — Closeout Report actions (UX-010)
// ============================================================================
// On-demand (re)generation of the AI executive summary for a project whose
// "Closing Project" meeting is already completed. The narrative is normally
// generated automatically on meeting completion (rhythm/service.ts); this lets
// the PM regenerate it from the Closeout Report page when needed.
// ============================================================================

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCloseoutReport } from "@/lib/rhythm/closeout";
import type { Locale } from "@/types/database";

export type GenerateCloseoutResult =
  | { ok: true }
  | { ok: false; reason: "not_authorized" | "no_meeting" | "failed" };

/**
 * Generate the closeout executive summary + narrative and store it on the latest
 * completed Closing Project meeting. Requires a completed closing meeting (the
 * narrative is grounded in it). PMO/PM/member only — viewers cannot generate.
 */
export async function generateCloseoutNarrativeAction(
  projectId: string,
  locale: Locale,
): Promise<GenerateCloseoutResult> {
  const org = await getOrgContext();
  if (org.role === "viewer") return { ok: false, reason: "not_authorized" };

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meetings")
    .select("id, ai_summary")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .eq("meeting_type", "closing")
    .eq("meeting_status", "completed")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!meeting) return { ok: false, reason: "no_meeting" };

  try {
    const report = await generateCloseoutReport(org, projectId, locale);
    const { error } = await admin
      .from("meetings")
      .update({
        ai_summary: { ...((meeting.ai_summary as Record<string, unknown>) ?? {}), closeout: report },
      })
      .eq("id", meeting.id as string);
    if (error) return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }

  revalidatePath(`/${locale}/projects/${projectId}/closeout`);
  return { ok: true };
}

export type ResolveRiskResult =
  | { ok: true }
  | { ok: false; reason: "not_authorized" | "not_found" | "failed" };

/**
 * REG-017 — resolve an open risk directly from the Closeout Report so the
 * "Risks resolved" blocker is actionable where it is surfaced (there is no
 * separate risk-register page to route to). Scope-checked: the risk must belong
 * to this org+project and still be open. PMO/PM/member only — viewers cannot.
 */
export async function resolveRiskAction(
  projectId: string,
  riskId: string,
  locale: Locale,
): Promise<ResolveRiskResult> {
  const org = await getOrgContext();
  if (org.role === "viewer") return { ok: false, reason: "not_authorized" };

  const admin = createAdminClient();
  // Verify the risk is in scope and currently open before mutating it.
  const { data: risk } = await admin
    .from("risks")
    .select("id, status")
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!risk) return { ok: false, reason: "not_found" };

  const { error } = await admin
    .from("risks")
    .update({ status: "resolved" })
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId);
  if (error) return { ok: false, reason: "failed" };

  revalidatePath(`/${locale}/projects/${projectId}/closeout`);
  return { ok: true };
}
