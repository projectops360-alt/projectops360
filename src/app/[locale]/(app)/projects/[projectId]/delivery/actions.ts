"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import {
  getFrameworkByProject, createFrameworkForProject, saveFrameworkEvent, syncFrameworkToMemory,
} from "@/lib/delivery/service";
import { recommendFramework, type FrameworkInputs } from "@/lib/delivery/recommend";
import { BOARD_TEMPLATES, boardTemplateFor, type DeliveryMethod } from "@/lib/delivery/config";

async function authed() {
  try { return await getOrgContext(); } catch { return null; }
}

/** Rule-based recommendation (instant, no AI). Stored in the history table. */
export async function recommendFrameworkAction(input: { projectId: string; inputs: FrameworkInputs }) {
  const org = await authed();
  if (!org) return { error: "not_authenticated" as const };
  const rec = recommendFramework(input.inputs);
  const supabase = createAdminClient();
  await supabase.from("project_framework_recommendations").insert({
    organization_id: org.organizationId, project_id: input.projectId,
    recommended_method: rec.method, confidence_score: rec.confidence, reason: rec.reasonEn,
    inputs_json: input.inputs, recommendation_json: rec, created_by: org.userId,
  });
  return { rec };
}

export interface FrameworkConfig {
  projectType: string;
  deliveryMethod: DeliveryMethod;
  governance: string;
  uncertainty: string;
  executionCadence: string;
  reviewCadence: string;
  feedbackFreq: string;
  documentation: string;
  changeControl: string;
  vendorDep: string;
  regulatory: boolean;
  aiRecommended?: boolean;
  recommendationConfidence?: number;
  recommendationReason?: string;
}

/** Save/confirm the framework configuration; builds the board template;
 *  records an event + Project Memory. Sets status to "configured". */
export async function saveFrameworkAction(input: { projectId: string; config: FrameworkConfig; locale: string }): Promise<{ error?: string }> {
  const org = await authed();
  if (!org) return { error: "not_authenticated" };
  const supabase = createAdminClient();
  const c = input.config;

  let fw = await getFrameworkByProject(supabase, org.organizationId, input.projectId);
  if (!fw) {
    await createFrameworkForProject(supabase, org.organizationId, input.projectId, org.userId, c.projectType);
    fw = await getFrameworkByProject(supabase, org.organizationId, input.projectId);
  }
  if (!fw) return { error: "no_framework" };

  const { error } = await supabase.from("project_delivery_frameworks").update({
    project_type: c.projectType,
    delivery_method: c.deliveryMethod,
    governance_level: c.governance,
    uncertainty_level: c.uncertainty,
    execution_cadence: c.executionCadence,
    review_cadence: c.reviewCadence,
    stakeholder_feedback_frequency: c.feedbackFreq,
    documentation_level: c.documentation,
    change_control_required: c.changeControl,
    vendor_dependency_level: c.vendorDep,
    regulatory_requirement: c.regulatory,
    ai_recommended: c.aiRecommended ?? false,
    recommendation_confidence: c.recommendationConfidence ?? null,
    recommendation_reason: c.recommendationReason ?? null,
    status: "configured",
    selected_by: org.userId,
  }).eq("id", fw.id).eq("organization_id", org.organizationId);
  if (error) return { error: "unexpected" };

  // (Re)build the board columns from the chosen template.
  const tplId = boardTemplateFor(c.deliveryMethod, c.projectType);
  const cols = BOARD_TEMPLATES[tplId] ?? BOARD_TEMPLATES.generic;
  await supabase.from("project_board_columns").delete().eq("framework_id", fw.id).eq("organization_id", org.organizationId);
  await supabase.from("project_board_columns").insert(
    cols.map((name, idx) => ({
      organization_id: org.organizationId, project_id: input.projectId, framework_id: fw!.id,
      name, position: idx, is_done_column: idx >= cols.length - 2,
    })),
  );

  await saveFrameworkEvent(supabase, org, input.projectId, fw.id, "configured", `Framework set to ${c.deliveryMethod}`, { config: c });
  await logAudit({ org, projectId: input.projectId, action: "update", entityType: "project_delivery_frameworks", entityId: fw.id, metadata: { method: c.deliveryMethod } });
  void syncFrameworkToMemory(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale).catch(() => {});

  return {};
}

/** Activate the framework (execution starts). */
export async function activateFrameworkAction(input: { projectId: string }): Promise<{ error?: string }> {
  const org = await authed();
  if (!org) return { error: "not_authenticated" };
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, input.projectId);
  if (!fw) return { error: "no_framework" };
  await supabase.from("project_delivery_frameworks").update({ status: "active" }).eq("id", fw.id).eq("organization_id", org.organizationId);
  await saveFrameworkEvent(supabase, org, input.projectId, fw.id, "activated", "Framework activated — execution started");
  return {};
}
