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

// ── Backlog ─────────────────────────────────────────────────────────────────

async function ctx(projectId: string) {
  const org = await authed();
  if (!org) return null;
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  return { org, supabase, frameworkId: fw?.id ?? null };
}

export interface BacklogInput {
  id?: string; title: string; description?: string; item_type?: string; priority?: string;
  business_value?: number; status?: string; linked_charter_objective?: string;
  linked_milestone_id?: string | null; linked_risk_id?: string | null; acceptance_criteria?: string;
}

export async function saveBacklogItemAction(input: { projectId: string; item: BacklogInput }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const it = input.item;
  if (!it.id && !it.title?.trim()) return { error: "title_required" };
  const row = {
    organization_id: c.org.organizationId, project_id: input.projectId, framework_id: c.frameworkId,
    title: it.title?.trim(), description: it.description?.trim() || null, item_type: it.item_type || null,
    priority: it.priority || null, business_value: it.business_value ?? null, status: it.status || "backlog",
    linked_charter_objective: it.linked_charter_objective?.trim() || null,
    linked_milestone_id: it.linked_milestone_id || null, linked_risk_id: it.linked_risk_id || null,
    acceptance_criteria: it.acceptance_criteria?.trim() || null,
  };
  const q = it.id
    ? c.supabase.from("project_backlog_items").update(row).eq("id", it.id).eq("organization_id", c.org.organizationId)
    : c.supabase.from("project_backlog_items").insert(row);
  const { error } = await q;
  return error ? { error: "unexpected" } : {};
}

export async function setBacklogStatusAction(input: { projectId: string; id: string; status: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_backlog_items").update({ status: input.status }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

export async function deleteBacklogItemAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_backlog_items").update({ deleted_at: new Date().toISOString() }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

const PRIORITY_MAP: Record<string, string> = { High: "p1", Medium: "p2", Low: "p3" };

/** Promote a backlog item into a real execution task (Workboard). Unifies the
 *  planning backlog with the single execution board. */
export async function promoteBacklogItemAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { data: item } = await c.supabase.from("project_backlog_items").select("*").eq("id", input.id).eq("organization_id", c.org.organizationId).is("deleted_at", null).maybeSingle();
  if (!item) return { error: "not_found" };
  const it = item as Record<string, unknown>;

  const { error } = await c.supabase.from("roadmap_tasks").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    title: String(it.title), description: (it.description as string) || null,
    status: "not_started", priority: PRIORITY_MAP[String(it.priority)] ?? "p2",
    milestone_id: (it.linked_milestone_id as string) || null,
    acceptance_criteria: (it.acceptance_criteria as string) || null,
    order_index: 0, metadata: { origin: "delivery_backlog", backlog_item_id: input.id },
  });
  if (error) return { error: "unexpected" };

  // Mark the backlog item as promoted (kept for traceability).
  await c.supabase.from("project_backlog_items").update({ status: "promoted" }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "item_promoted", `Backlog item promoted to task: ${String(it.title)}`);
  return {};
}

// ── Execution cycles ────────────────────────────────────────────────────────

export interface CycleInput {
  id?: string; name: string; cycle_type?: string; goal?: string; start_date?: string; end_date?: string;
  review_notes?: string; lessons_learned_notes?: string; stakeholder_feedback_summary?: string;
}

export async function saveCycleAction(input: { projectId: string; cycle: CycleInput }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const cy = input.cycle;
  if (!cy.id && !cy.name?.trim()) return { error: "name_required" };
  const row = {
    organization_id: c.org.organizationId, project_id: input.projectId, framework_id: c.frameworkId,
    name: cy.name?.trim(), cycle_type: cy.cycle_type || null, goal: cy.goal?.trim() || null,
    start_date: cy.start_date || null, end_date: cy.end_date || null,
    review_notes: cy.review_notes?.trim() || null, lessons_learned_notes: cy.lessons_learned_notes?.trim() || null,
    stakeholder_feedback_summary: cy.stakeholder_feedback_summary?.trim() || null,
  };
  const q = cy.id
    ? c.supabase.from("project_execution_cycles").update(row).eq("id", cy.id).eq("organization_id", c.org.organizationId)
    : c.supabase.from("project_execution_cycles").insert(row);
  const { error } = await q;
  return error ? { error: "unexpected" } : {};
}

export async function setCycleStatusAction(input: { projectId: string; id: string; status: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_execution_cycles").update({ status: input.status }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  if (!error) await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, `cycle_${input.status}`, `Cycle ${input.status}`);
  return error ? { error: "unexpected" } : {};
}

export async function deleteCycleAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_execution_cycles").update({ deleted_at: new Date().toISOString() }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

// ── Scope creep alerts ──────────────────────────────────────────────────────

export async function resolveScopeAlertAction(input: { projectId: string; id: string; status: "resolved" | "dismissed" }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_scope_creep_alerts")
    .update({ status: input.status, resolved_by: c.org.userId, resolved_at: new Date().toISOString() })
    .eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

// ── AI actions (Phase 5) ────────────────────────────────────────────────────

export async function generateBacklogAction(input: { projectId: string; locale: string }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { generateBacklogFromCharter } = await import("@/lib/delivery/ai");
  const items = await generateBacklogFromCharter(c.org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  if (items.length === 0) return { error: "ai_failed" };
  const { count } = await c.supabase.from("project_backlog_items").select("id", { count: "exact", head: true }).eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).is("deleted_at", null);
  const base = count ?? 0;
  await c.supabase.from("project_backlog_items").insert(items.map((it, i) => ({
    organization_id: c.org.organizationId, project_id: input.projectId, framework_id: c.frameworkId,
    title: it.title, description: it.description || null, item_type: it.item_type, priority: it.priority,
    status: "backlog", acceptance_criteria: it.acceptance_criteria || null, linked_charter_objective: it.linked_charter_objective || null,
    position: base + i, source: "ai_charter",
  })));
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "backlog_generated", `AI generated ${items.length} backlog items`);
  return { count: items.length };
}

export async function scopeCheckAction(input: { projectId: string; locale: string }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { detectDeliveryScopeCreep } = await import("@/lib/delivery/ai");
  const flags = await detectDeliveryScopeCreep(c.org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  // Dismiss previous open alerts, then record the fresh set.
  await c.supabase.from("project_scope_creep_alerts").update({ status: "dismissed" }).eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).eq("status", "open");
  if (flags.length > 0) {
    await c.supabase.from("project_scope_creep_alerts").insert(flags.map((f) => ({
      organization_id: c.org.organizationId, project_id: input.projectId, framework_id: c.frameworkId,
      source_type: "backlog_item", detection_reason: `${f.title}: ${f.reason}`, severity: f.severity, recommendation: f.recommendation, status: "open",
    })));
  }
  return { count: flags.length };
}

export async function deliveryStakeholderSummaryAction(input: { projectId: string; locale: string }) {
  const org = await authed();
  if (!org) return { error: "not_authenticated", summary: "" };
  const { generateDeliveryStakeholderSummary } = await import("@/lib/delivery/ai");
  const summary = await generateDeliveryStakeholderSummary(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  return { summary };
}

export async function cycleLessonsAction(input: { projectId: string; cycleId: string; locale: string }) {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated", lessons: null };
  const { generateCycleLessons } = await import("@/lib/delivery/ai");
  const lessons = await generateCycleLessons(c.org, input.projectId, input.cycleId, (input.locale === "es" ? "es" : "en") as Locale);
  const text = [
    lessons.wentWell.length ? `+ ${lessons.wentWell.join("\n+ ")}` : "",
    lessons.wentWrong.length ? `- ${lessons.wentWrong.join("\n- ")}` : "",
    lessons.improvements.length ? `> ${lessons.improvements.join("\n> ")}` : "",
  ].filter(Boolean).join("\n");
  if (text) await c.supabase.from("project_execution_cycles").update({ lessons_learned_notes: text }).eq("id", input.cycleId).eq("organization_id", c.org.organizationId);
  return { lessons };
}

export async function frameworkHealthAction(input: { projectId: string; locale: string }) {
  const org = await authed();
  if (!org) return { error: "not_authenticated", recommendation: "" };
  const { recommendFrameworkHealth } = await import("@/lib/delivery/ai");
  const recommendation = await recommendFrameworkHealth(org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  return { recommendation };
}
