"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import {
  getFrameworkByProject, createFrameworkForProject, saveFrameworkEvent, syncFrameworkToMemory,
} from "@/lib/delivery/service";
import { recommendFramework, type FrameworkInputs } from "@/lib/delivery/recommend";
import { BOARD_TEMPLATES, boardTemplateFor, MEETING_RHYTHM, type DeliveryMethod } from "@/lib/delivery/config";

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

/** Promote several backlog items into tasks at once. ids empty = promote all
 *  non-promoted items. */
export async function promoteBacklogItemsAction(input: { projectId: string; ids?: string[] }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };

  let q = c.supabase.from("project_backlog_items").select("*")
    .eq("project_id", input.projectId).eq("organization_id", c.org.organizationId)
    .is("deleted_at", null).neq("status", "promoted");
  if (input.ids && input.ids.length > 0) q = q.in("id", input.ids);
  const { data: items } = await q;
  const rows = (items ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return { count: 0 };

  const { error } = await c.supabase.from("roadmap_tasks").insert(rows.map((it, i) => ({
    organization_id: c.org.organizationId, project_id: input.projectId,
    title: String(it.title), description: (it.description as string) || null,
    status: "not_started", priority: PRIORITY_MAP[String(it.priority)] ?? "p2",
    milestone_id: (it.linked_milestone_id as string) || null,
    acceptance_criteria: (it.acceptance_criteria as string) || null,
    order_index: i, metadata: { origin: "delivery_backlog", backlog_item_id: it.id },
  })));
  if (error) return { error: "unexpected" };

  await c.supabase.from("project_backlog_items").update({ status: "promoted" })
    .in("id", rows.map((r) => String(r.id))).eq("organization_id", c.org.organizationId);
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "items_promoted", `${rows.length} backlog item(s) promoted to tasks`);
  return { count: rows.length };
}

// ── Milestones (schedule backbone) ──────────────────────────────────────────

const MS_ICONS = ["setup", "shield_database", "users", "notebook", "link", "sparkles", "chart", "loop", "check_circle", "rocket"];
/** Pick a valid icon: honor the AI's choice if known, else a sensible phase
 *  default (start→setup, end→rocket, middle→rotating set). */
function safeIcon(key: string, i: number, n: number): string {
  if (MS_ICONS.includes(key)) return key;
  if (i === 0) return "setup";
  if (i === n - 1) return "rocket";
  return ["notebook", "users", "chart", "loop", "link"][i % 5];
}

async function nextMilestoneOrder(c: NonNullable<Awaited<ReturnType<typeof ctx>>>, projectId: string): Promise<number> {
  const { data } = await c.supabase.from("milestones").select("order_index")
    .eq("project_id", projectId).eq("organization_id", c.org.organizationId).is("deleted_at", null)
    .order("order_index", { ascending: false }).limit(1);
  return data && data.length > 0 ? Number((data[0] as { order_index: number }).order_index) + 1 : 0;
}

/** AI: generate the milestone backbone from the charter and, when a backlog
 *  already exists, organize those items into the new phases — all in one click. */
export async function generateMilestonesAction(input: { projectId: string; locale: string }): Promise<{ error?: string; count?: number; assigned?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { generateMilestones } = await import("@/lib/delivery/ai");
  const ms = await generateMilestones(c.org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  if (ms.length === 0) return { error: "ai_failed" };

  const base = await nextMilestoneOrder(c, input.projectId);

  // Build a title→id map of the current (non-promoted) backlog for assignment.
  const { data: backlog } = await c.supabase.from("project_backlog_items").select("id, title")
    .eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).is("deleted_at", null).neq("status", "promoted");
  const byTitle = new Map((backlog ?? []).map((b) => [String((b as { title: string }).title).trim().toLowerCase(), String((b as { id: string }).id)]));

  let created = 0, assigned = 0;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const { data: row, error } = await c.supabase.from("milestones").insert({
      organization_id: c.org.organizationId, project_id: input.projectId,
      title: m.title, description: m.description || null, status: "planned",
      icon_key: safeIcon(m.icon_key, i, ms.length), order_index: base + i, progress_percent: 0,
    }).select("id").single();
    if (error || !row) continue;
    created++;
    const milestoneId = String((row as { id: string }).id);
    const ids = m.item_titles.map((t) => byTitle.get(t.trim().toLowerCase())).filter((x): x is string => Boolean(x));
    if (ids.length > 0) {
      await c.supabase.from("project_backlog_items").update({ linked_milestone_id: milestoneId }).in("id", ids).eq("organization_id", c.org.organizationId);
      assigned += ids.length;
    }
  }
  if (created === 0) return { error: "unexpected" };
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "milestones_generated", `AI generated ${created} milestone(s)${assigned ? `, organized ${assigned} backlog item(s)` : ""}`);
  return { count: created, assigned };
}

/** Quick-create one milestone (placed at the end of the backbone). */
export async function createMilestoneInlineAction(input: { projectId: string; title: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!input.title.trim()) return { error: "title_required" };
  const order = await nextMilestoneOrder(c, input.projectId);
  const { error } = await c.supabase.from("milestones").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    title: input.title.trim(), status: "planned", icon_key: "setup", order_index: order, progress_percent: 0,
  });
  return error ? { error: "unexpected" } : {};
}

/** Assign or clear a backlog item's milestone inline (from the backlog table). */
export async function setBacklogMilestoneAction(input: { projectId: string; id: string; milestoneId: string | null }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_backlog_items").update({ linked_milestone_id: input.milestoneId || null }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
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

/** Assign backlog items to a cycle (sprint). Skips items already in the cycle. */
export async function addItemsToCycleAction(input: { projectId: string; cycleId: string; ids: string[] }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!input.ids?.length) return { count: 0 };
  const { data: existing } = await c.supabase.from("project_cycle_items").select("backlog_item_id").eq("cycle_id", input.cycleId).eq("organization_id", c.org.organizationId);
  const have = new Set((existing ?? []).map((r) => String((r as { backlog_item_id: string }).backlog_item_id)));
  const fresh = input.ids.filter((id) => !have.has(id));
  if (fresh.length === 0) return { count: 0 };
  const { error } = await c.supabase.from("project_cycle_items").insert(fresh.map((id) => ({
    organization_id: c.org.organizationId, project_id: input.projectId, cycle_id: input.cycleId, backlog_item_id: id,
  })));
  return error ? { error: "unexpected" } : { count: fresh.length };
}

export async function removeCycleItemAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_cycle_items").delete().eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

/** Promote all of a cycle's backlog items to Workboard tasks, tagging them with
 *  the cycle name as the sprint so the Workboard sprint filter groups them. */
export async function promoteCycleAction(input: { projectId: string; cycleId: string }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { data: cycle } = await c.supabase.from("project_execution_cycles").select("name").eq("id", input.cycleId).eq("organization_id", c.org.organizationId).maybeSingle();
  if (!cycle) return { error: "not_found" };
  const sprintName = String((cycle as { name: string }).name);

  const { data: citems } = await c.supabase.from("project_cycle_items").select("backlog_item_id").eq("cycle_id", input.cycleId).eq("organization_id", c.org.organizationId);
  const ids = (citems ?? []).map((r) => String((r as { backlog_item_id: string }).backlog_item_id));
  if (ids.length === 0) return { count: 0 };

  const { data: items } = await c.supabase.from("project_backlog_items").select("*").in("id", ids).eq("organization_id", c.org.organizationId).is("deleted_at", null).neq("status", "promoted");
  const rows = (items ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return { count: 0 };

  const { error } = await c.supabase.from("roadmap_tasks").insert(rows.map((it, i) => ({
    organization_id: c.org.organizationId, project_id: input.projectId,
    title: String(it.title), description: (it.description as string) || null,
    status: "not_started", priority: PRIORITY_MAP[String(it.priority)] ?? "p2",
    milestone_id: (it.linked_milestone_id as string) || null, sprint_name: sprintName,
    acceptance_criteria: (it.acceptance_criteria as string) || null,
    order_index: i, metadata: { origin: "delivery_cycle", backlog_item_id: it.id, cycle_id: input.cycleId },
  })));
  if (error) return { error: "unexpected" };

  await c.supabase.from("project_backlog_items").update({ status: "promoted" }).in("id", rows.map((r) => String(r.id))).eq("organization_id", c.org.organizationId);
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "cycle_promoted", `Cycle "${sprintName}" promoted ${rows.length} item(s) to the Workboard`);
  return { count: rows.length };
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

// ── Backlog ordering & prioritization ───────────────────────────────────────

/** Move a backlog item up/down within its milestone (normalizes positions). */
export async function moveBacklogItemAction(input: { projectId: string; id: string; direction: "up" | "down" }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { data: item } = await c.supabase.from("project_backlog_items").select("id, linked_milestone_id").eq("id", input.id).eq("organization_id", c.org.organizationId).is("deleted_at", null).maybeSingle();
  if (!item) return { error: "not_found" };
  const mid = (item as { linked_milestone_id: string | null }).linked_milestone_id;

  let q = c.supabase.from("project_backlog_items").select("id").eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).is("deleted_at", null).neq("status", "promoted");
  q = mid ? q.eq("linked_milestone_id", mid) : q.is("linked_milestone_id", null);
  const { data: sibs } = await q.order("position", { ascending: true }).order("created_at", { ascending: true });
  const order = ((sibs ?? []) as { id: string }[]).map((s) => String(s.id));
  const idx = order.findIndex((id) => id === input.id);
  if (idx < 0) return { error: "not_found" };
  const swapWith = input.direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= order.length) return {}; // at the edge
  [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
  await Promise.all(order.map((id, i) =>
    c.supabase.from("project_backlog_items").update({ position: i }).eq("id", id).eq("organization_id", c.org.organizationId),
  ));
  return {};
}

/** AI-prioritize the backlog: sets priority + position by value/risk/alignment. */
export async function prioritizeBacklogAction(input: { projectId: string; locale: string }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { prioritizeBacklog } = await import("@/lib/delivery/ai");
  const ranked = await prioritizeBacklog(c.org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  if (ranked.length === 0) return { error: "ai_failed" };
  await Promise.all(ranked.map((r, i) =>
    c.supabase.from("project_backlog_items").update({ priority: r.priority, position: i }).eq("id", r.id).eq("organization_id", c.org.organizationId),
  ));
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "backlog_prioritized", `AI prioritized ${ranked.length} backlog items`);
  return { count: ranked.length };
}

// ── Rhythm Center integration ───────────────────────────────────────────────

/** Map a rhythm label (english) to a Rhythm Center event_type. */
function rhythmEventType(enLabel: string): string {
  const s = enLabel.toLowerCase();
  if (s.includes("stakeholder")) return "stakeholder_review";
  if (s.includes("risk")) return "risk_review";
  if (s.includes("change")) return "change_review";
  if (s.includes("lessons") || s.includes("acceptance") || s.includes("phase") || s.includes("technical") || s.includes("release") || s.includes("service")) return "project_review";
  return "status_update";
}

/** Create Rhythm Center events from the framework's suggested meeting rhythm.
 *  Idempotent: skips if framework-sourced events already exist. */
export async function scheduleFrameworkMeetingsAction(input: { projectId: string; locale: string }): Promise<{ error?: string; created?: number; skipped?: boolean }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const fw = await getFrameworkByProject(c.supabase, c.org.organizationId, input.projectId);
  if (!fw || !fw.delivery_method) return { error: "no_framework" };
  const rhythm = MEETING_RHYTHM[fw.delivery_method as DeliveryMethod] ?? [];
  if (rhythm.length === 0) return { created: 0 };

  const { count: existing } = await c.supabase.from("project_events").select("id", { count: "exact", head: true })
    .eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).eq("source", "framework").is("deleted_at", null);
  if ((existing ?? 0) > 0) return { skipped: true, created: 0 };

  const isEs = input.locale === "es";
  const base = new Date(); base.setHours(10, 0, 0, 0); base.setDate(base.getDate() + 7);
  const rows = rhythm.map((r, i) => {
    const start = new Date(base); start.setDate(base.getDate() + i * 7);
    const end = new Date(start); end.setHours(start.getHours() + 1);
    return {
      organization_id: c.org.organizationId, project_id: input.projectId,
      title: isEs ? r.es : r.en, event_type: rhythmEventType(r.en),
      start_datetime: start.toISOString(), end_datetime: end.toISOString(),
      status: "scheduled", priority: "medium", source: "framework", created_by: c.org.userId,
    };
  });
  const { error } = await c.supabase.from("project_events").insert(rows);
  if (error) return { error: "unexpected" };
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, fw.id, "meetings_scheduled", `Scheduled ${rows.length} framework meetings in the Rhythm Center`);
  return { created: rows.length };
}

// ── Scope alert → change request ────────────────────────────────────────────

const SEV_PRIORITY: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

/** Convert a scope-creep alert into a formal Change Request backlog item and
 *  resolve the alert. Keeps change control inside the unified backlog. */
export async function alertToChangeRequestAction(input: { projectId: string; alertId: string; locale: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { data: alert } = await c.supabase.from("project_scope_creep_alerts").select("*").eq("id", input.alertId).eq("organization_id", c.org.organizationId).maybeSingle();
  if (!alert) return { error: "not_found" };
  const a = alert as Record<string, unknown>;
  const isEs = input.locale === "es";
  const reason = String(a.detection_reason ?? "");
  const title = `${isEs ? "Solicitud de cambio" : "Change request"}: ${(reason.split(":")[0] || reason).slice(0, 120)}`;
  const description = [reason, a.recommendation ? `${isEs ? "Recomendación" : "Recommendation"}: ${String(a.recommendation)}` : ""].filter(Boolean).join("\n");

  const { error } = await c.supabase.from("project_backlog_items").insert({
    organization_id: c.org.organizationId, project_id: input.projectId, framework_id: c.frameworkId,
    title, description, item_type: "Change Request", priority: SEV_PRIORITY[String(a.severity)] ?? "Medium",
    status: "backlog", source: "scope_alert",
  });
  if (error) return { error: "unexpected" };
  await c.supabase.from("project_scope_creep_alerts").update({ status: "resolved", resolved_by: c.org.userId, resolved_at: new Date().toISOString() }).eq("id", input.alertId).eq("organization_id", c.org.organizationId);
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "change_request_created", `Scope alert converted to change request: ${title}`);
  return {};
}

// ── WIP limits (board columns) ──────────────────────────────────────────────

/** Set/clear a column's WIP limit (visible on the framework board). */
export async function setColumnWipAction(input: { projectId: string; columnId: string; wipLimit: number | null }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const wip = input.wipLimit && input.wipLimit > 0 ? Math.floor(input.wipLimit) : null;
  const { error } = await c.supabase.from("project_board_columns").update({ wip_limit: wip }).eq("id", input.columnId).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}
