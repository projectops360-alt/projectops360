"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectManager, requireProjectContributor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import {
  getFrameworkByProject, createFrameworkForProject, saveFrameworkEvent, syncFrameworkToMemory, mapProjectType,
} from "@/lib/delivery/service";
import { templateFor } from "@/lib/refinement/templates";
import { computeReadiness, type WorkItemLike } from "@/lib/refinement/readiness";
import { recommendFramework, type FrameworkInputs } from "@/lib/delivery/recommend";
import { BOARD_TEMPLATES, boardTemplateFor, MEETING_RHYTHM, type DeliveryMethod } from "@/lib/delivery/config";

/** Framework setup/governance is a PM/PMO concern. */
async function managerOrg(projectId: string) {
  const gate = await requireProjectManager(projectId);
  return gate.ok ? gate.org : null;
}

/** Rule-based recommendation (instant, no AI). Stored in the history table. */
export async function recommendFrameworkAction(input: { projectId: string; inputs: FrameworkInputs }) {
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" as const };
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
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };
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
  const org = await managerOrg(input.projectId);
  if (!org) return { error: "forbidden" };
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, input.projectId);
  if (!fw) return { error: "no_framework" };
  await supabase.from("project_delivery_frameworks").update({ status: "active" }).eq("id", fw.id).eq("organization_id", org.organizationId);
  await saveFrameworkEvent(supabase, org, input.projectId, fw.id, "activated", "Framework activated — execution started");
  return {};
}

// ── Backlog ─────────────────────────────────────────────────────────────────

async function ctx(projectId: string) {
  const gate = await requireProjectContributor(projectId);
  if (!gate.ok) return null;
  const org = gate.org;
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
/** Resolve a work item's owner (a user) into a roadmap_tasks assignment, keeping
 *  the project_team_member link in sync so Team & Roles / the Workboard show it. */
async function ownerToAssignment(
  c: NonNullable<Awaited<ReturnType<typeof ctx>>>, projectId: string, ownerId: string | null,
): Promise<{ assigned_to: string | null; project_team_member_id: string | null; assignment_type: string | null }> {
  if (!ownerId) return { assigned_to: null, project_team_member_id: null, assignment_type: null };
  const { data: tm } = await c.supabase.from("project_team_members")
    .select("id").eq("project_id", projectId).eq("organization_id", c.org.organizationId)
    .eq("user_id", ownerId).neq("status", "removed").limit(1).maybeSingle();
  return { assigned_to: ownerId, project_team_member_id: (tm?.id as string) ?? null, assignment_type: "person" };
}

export async function promoteBacklogItemAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { data: item } = await c.supabase.from("project_backlog_items").select("*").eq("id", input.id).eq("organization_id", c.org.organizationId).is("deleted_at", null).maybeSingle();
  if (!item) return { error: "not_found" };
  const it = item as Record<string, unknown>;

  const asg = await ownerToAssignment(c, input.projectId, (it.owner_id as string) || null);
  const { error } = await c.supabase.from("roadmap_tasks").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    title: String(it.title), description: (it.description as string) || null,
    status: "not_started", priority: PRIORITY_MAP[String(it.priority)] ?? "p2",
    milestone_id: (it.linked_milestone_id as string) || null,
    acceptance_criteria: (it.acceptance_criteria as string) || null,
    end_date: (it.due_date as string) || null,
    assigned_to: asg.assigned_to, project_team_member_id: asg.project_team_member_id, assignment_type: asg.assignment_type,
    order_index: 0, external_key: `backlog:${input.id}`,
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

  const taskRows = [];
  for (let i = 0; i < rows.length; i++) {
    const it = rows[i];
    const asg = await ownerToAssignment(c, input.projectId, (it.owner_id as string) || null);
    taskRows.push({
      organization_id: c.org.organizationId, project_id: input.projectId,
      title: String(it.title), description: (it.description as string) || null,
      status: "not_started", priority: PRIORITY_MAP[String(it.priority)] ?? "p2",
      milestone_id: (it.linked_milestone_id as string) || null,
      acceptance_criteria: (it.acceptance_criteria as string) || null,
      end_date: (it.due_date as string) || null,
      assigned_to: asg.assigned_to, project_team_member_id: asg.project_team_member_id, assignment_type: asg.assignment_type,
      order_index: i, external_key: `backlog:${it.id}`,
    });
  }
  const { error } = await c.supabase.from("roadmap_tasks").insert(taskRows);
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
    order_index: i, external_key: `backlog:${it.id}`,
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
  const gate = await requireProjectContributor(input.projectId);
  if (!gate.ok) return { error: "forbidden", summary: "" };
  const org = gate.org;
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
  const gate = await requireProjectContributor(input.projectId);
  if (!gate.ok) return { error: "forbidden", recommendation: "" };
  const org = gate.org;
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

// ── Work Refinement Center ───────────────────────────────────────────────────

const STATUS_ALLOWED = new Set([
  "new", "needs_clarification", "ready_for_refinement", "in_refinement",
  "split_required", "refined", "ready_for_planning", "planned",
  "in_execution", "done", "rejected", "deferred",
]);

/** Resolve the project's refinement template from its delivery framework. */
async function refinementTemplate(c: NonNullable<Awaited<ReturnType<typeof ctx>>>, projectId: string) {
  const fw = await getFrameworkByProject(c.supabase, c.org.organizationId, projectId);
  return templateFor((fw?.delivery_method ?? null) as never, fw?.project_type ?? mapProjectType(null));
}

/** Count dependencies whose predecessor item isn't refined/planned yet. */
async function unresolvedDepCount(c: NonNullable<Awaited<ReturnType<typeof ctx>>>, itemId: string): Promise<number> {
  const { data: deps } = await c.supabase.from("work_item_dependencies")
    .select("depends_on_item_id").eq("backlog_item_id", itemId).eq("organization_id", c.org.organizationId);
  const ids = (deps ?? []).map((d) => String((d as { depends_on_item_id: string }).depends_on_item_id));
  if (ids.length === 0) return 0;
  const { data: preds } = await c.supabase.from("project_backlog_items")
    .select("refinement_status").in("id", ids).eq("organization_id", c.org.organizationId).is("deleted_at", null);
  const resolved = new Set(["ready_for_planning", "planned", "in_execution", "done"]);
  return (preds ?? []).filter((p) => !resolved.has(String((p as { refinement_status: string }).refinement_status))).length;
}

export interface RefinementInput {
  id: string;
  description?: string | null;
  acceptance_criteria?: string | null;
  completion_criteria?: string | null;
  item_type?: string | null;
  priority?: string | null;
  risk_level?: string | null;
  owner_id?: string | null;
  business_value?: number | null;
  customer_value?: number | null;
  strategic_value?: number | null;
  stakeholders?: string | null;
  source_reference?: string | null;
  estimation_method?: string | null;
  estimate_value?: number | null;
  estimate_unit?: string | null;
  estimate_optimistic?: number | null;
  estimate_most_likely?: number | null;
  estimate_pessimistic?: number | null;
  due_date?: string | null;
  definition_of_ready?: { key: string; label: string; checked: boolean }[];
  target_planning_destination?: string | null;
}

/** Save the refinement fields of a work item and recompute its readiness. */
export async function saveRefinementAction(input: { projectId: string; item: RefinementInput }): Promise<{ error?: string; readiness?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const it = input.item;
  if (!it.id) return { error: "id_required" };

  const tpl = await refinementTemplate(c, input.projectId);
  const unresolved = await unresolvedDepCount(c, it.id);
  const itemForScore: WorkItemLike = {
    description: it.description, acceptance_criteria: it.acceptance_criteria, completion_criteria: it.completion_criteria,
    definition_of_ready: it.definition_of_ready, estimation_method: it.estimation_method, estimate_value: it.estimate_value,
    estimate_optimistic: it.estimate_optimistic, estimate_most_likely: it.estimate_most_likely, estimate_pessimistic: it.estimate_pessimistic,
    owner_id: it.owner_id, priority: it.priority, risk_level: it.risk_level, business_value: it.business_value,
  };
  const readiness = computeReadiness(itemForScore, tpl, unresolved);

  const { error } = await c.supabase.from("project_backlog_items").update({
    description: it.description?.trim() || null,
    acceptance_criteria: it.acceptance_criteria?.trim() || null,
    completion_criteria: it.completion_criteria?.trim() || null,
    item_type: it.item_type || null,
    priority: it.priority || null,
    risk_level: it.risk_level || null,
    owner_id: it.owner_id || null,
    business_value: it.business_value ?? null,
    customer_value: it.customer_value ?? null,
    strategic_value: it.strategic_value ?? null,
    stakeholders: it.stakeholders?.trim() || null,
    source_reference: it.source_reference?.trim() || null,
    estimation_method: it.estimation_method || null,
    estimate_value: it.estimate_value ?? null,
    estimate_unit: it.estimate_unit || null,
    estimate_optimistic: it.estimate_optimistic ?? null,
    estimate_most_likely: it.estimate_most_likely ?? null,
    estimate_pessimistic: it.estimate_pessimistic ?? null,
    due_date: it.due_date || null,
    definition_of_ready: it.definition_of_ready ?? [],
    target_planning_destination: it.target_planning_destination || null,
    readiness_score: readiness.score,
  }).eq("id", it.id).eq("organization_id", c.org.organizationId);
  if (error) return { error: "unexpected" };
  return { readiness: readiness.score };
}

/** Set the refinement status (PM review outcome). */
export async function setRefinementStatusAction(input: { projectId: string; id: string; status: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!STATUS_ALLOWED.has(input.status)) return { error: "bad_status" };
  const patch: Record<string, unknown> = { refinement_status: input.status };
  if (input.status === "refined" || input.status === "ready_for_planning") patch.refined_at = new Date().toISOString();
  const { error } = await c.supabase.from("project_backlog_items").update(patch).eq("id", input.id).eq("organization_id", c.org.organizationId);
  if (!error) await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "item_refinement_status", `Work item set to ${input.status}`);
  return error ? { error: "unexpected" } : {};
}

/** AI refine: generate summary, questions and recommendations; persist them. */
export async function aiRefineItemAction(input: { projectId: string; id: string; locale: string }) {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" as const, result: null };
  const { refineWorkItem } = await import("@/lib/refinement/ai");
  const result = await refineWorkItem(c.org, input.projectId, input.id, (input.locale === "es" ? "es" : "en") as Locale);
  if (!result.ai_summary && result.questions.length === 0) return { error: "ai_failed" as const, result: null };
  await c.supabase.from("project_backlog_items").update({
    ai_summary: result.ai_summary || null,
    ai_refinement_questions: result.questions,
    ai_recommendations: result,
  }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return { result };
}

/** Inline AI assistant for a single field (acceptance / completion criteria),
 *  using whatever the user has typed so far (no save required). */
export async function aiSuggestFieldAction(input: {
  projectId: string; field: "acceptance_criteria" | "completion_criteria" | "description"; locale: string;
  title: string; description?: string; itemType?: string; acceptanceCriteria?: string;
}): Promise<{ error?: string; text?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!input.title?.trim()) return { error: "no_context" };
  const { suggestWorkItemField } = await import("@/lib/refinement/ai");
  const text = await suggestWorkItemField(
    c.org, input.projectId, input.field,
    { title: input.title, description: input.description, itemType: input.itemType, acceptanceCriteria: input.acceptanceCriteria },
    (input.locale === "es" ? "es" : "en") as Locale,
  );
  return text ? { text } : { error: "ai_failed" };
}

/** Add a dependency: this item depends on another work item. */
export async function saveWorkItemDependencyAction(input: { projectId: string; itemId: string; dependsOnId: string; type?: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (input.itemId === input.dependsOnId) return { error: "self_dependency" };
  const { error } = await c.supabase.from("work_item_dependencies").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    backlog_item_id: input.itemId, depends_on_item_id: input.dependsOnId,
    dependency_type: input.type || "finish_to_start",
  });
  // Unique violation = already exists; treat as success.
  if (error && !String(error.code).startsWith("23505")) return { error: "unexpected" };
  return {};
}

export async function deleteWorkItemDependencyAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("work_item_dependencies").delete().eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

/** Move a refined item into planning/execution. Gated on ready_for_planning.
 *  Reuses the backlog→Workboard promotion (single execution board), records the
 *  chosen destination, and marks the item planned. */
export async function moveToPlanningAction(input: { projectId: string; id: string; destination?: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { data: item } = await c.supabase.from("project_backlog_items").select("*").eq("id", input.id).eq("organization_id", c.org.organizationId).is("deleted_at", null).maybeSingle();
  if (!item) return { error: "not_found" };
  const it = item as Record<string, unknown>;
  if (String(it.refinement_status) !== "ready_for_planning") return { error: "not_ready" };

  const destination = input.destination || (it.target_planning_destination as string) || "execution_board";

  // PMO governance gate: governance-style templates need approval first.
  const tpl = await refinementTemplate(c, input.projectId);
  if (tpl.key === "pmo") {
    const gov = String(it.governance_status ?? "not_required");
    if (gov === "pending" || gov === "rejected") return { error: "governance_required" };
  }

  // Schedule-aware promotion: seed start/duration so the task lands on the
  // Timeline and critical path (which read roadmap_tasks) ready to schedule.
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); // next Monday
  const duration = it.estimation_method === "days" && Number(it.estimate_value) > 0 ? Math.max(1, Math.round(Number(it.estimate_value))) : 1;
  const end = new Date(start); end.setDate(start.getDate() + duration - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // Honor the captured/refined delivery date as the task's end date.
  let startIso = iso(start);
  let endIso = iso(end);
  let durationDays = duration;
  const dueStr = (it.due_date as string) || null;
  if (dueStr) {
    endIso = dueStr;
    if (dueStr < startIso) startIso = dueStr;
    durationDays = Math.max(1, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 86400000) + 1);
  }

  const asg = await ownerToAssignment(c, input.projectId, (it.owner_id as string) || null);
  const { error } = await c.supabase.from("roadmap_tasks").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    title: String(it.title), description: (it.description as string) || null,
    status: "not_started", priority: PRIORITY_MAP[String(it.priority)] ?? "p2",
    milestone_id: (it.linked_milestone_id as string) || null,
    acceptance_criteria: (it.acceptance_criteria as string) || null,
    start_date: startIso, end_date: endIso, duration_days: durationDays,
    assigned_to: asg.assigned_to, project_team_member_id: asg.project_team_member_id, assignment_type: asg.assignment_type,
    order_index: 0, external_key: `backlog:${input.id}`,
  });
  if (error) return { error: "unexpected" };

  await c.supabase.from("project_backlog_items").update({
    status: "promoted", refinement_status: "planned", target_planning_destination: destination,
  }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "item_moved_to_planning", `Work item moved to planning (${destination}): ${String(it.title)}`);
  return {};
}

/** PMO governance approval on a work item (request / approve / reject). */
export async function setGovernanceAction(input: { projectId: string; id: string; status: string; notes?: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!["not_required", "pending", "approved", "rejected"].includes(input.status)) return { error: "bad_status" };
  const decided = input.status === "approved" || input.status === "rejected";
  const { error } = await c.supabase.from("project_backlog_items").update({
    governance_status: input.status,
    governance_notes: input.notes?.trim() || null,
    governance_approver_id: decided ? c.org.userId : null,
    governance_approved_at: decided ? new Date().toISOString() : null,
  }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  if (!error) await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "governance_status", `Governance ${input.status}`);
  return error ? { error: "unexpected" } : {};
}

// ── Work Refinement — Phase 2 (sessions, split, links) ──────────────────────

/** Create a refinement session over selected work items; optionally let AI
 *  prepare talking points for each. */
export async function createRefinementSessionAction(input: { projectId: string; title: string; itemIds: string[]; locale: string; prepare?: boolean }): Promise<{ error?: string; sessionId?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!input.title.trim()) return { error: "title_required" };
  if (!input.itemIds?.length) return { error: "no_items" };

  const fw = await getFrameworkByProject(c.supabase, c.org.organizationId, input.projectId);
  const { data: session, error } = await c.supabase.from("refinement_sessions").insert({
    organization_id: c.org.organizationId, project_id: input.projectId, framework_id: fw?.id ?? null,
    title: input.title.trim(), delivery_method: fw?.delivery_method ?? null, status: "active",
    facilitator_id: c.org.userId, started_at: new Date().toISOString(), created_by: c.org.userId,
  }).select("id").single();
  if (error || !session) return { error: "unexpected" };
  const sessionId = String((session as { id: string }).id);

  // Optional AI talking points (best-effort).
  let pointsByItem = new Map<string, { talking_points: string[]; open_questions: string[] }>();
  if (input.prepare) {
    try {
      const { prepareRefinementSession } = await import("@/lib/refinement/ai");
      const prepared = await prepareRefinementSession(c.org, input.projectId, input.itemIds, (input.locale === "es" ? "es" : "en") as Locale);
      pointsByItem = new Map(prepared.map((p) => [p.backlog_item_id, { talking_points: p.talking_points, open_questions: p.open_questions }]));
    } catch { /* talking points are optional */ }
  }

  await c.supabase.from("refinement_session_items").insert(input.itemIds.map((id, i) => ({
    organization_id: c.org.organizationId, project_id: input.projectId, session_id: sessionId,
    backlog_item_id: id, position: i,
    talking_points: pointsByItem.get(id)
      ? [...pointsByItem.get(id)!.talking_points.map((t) => ({ kind: "point", text: t })), ...pointsByItem.get(id)!.open_questions.map((t) => ({ kind: "question", text: t }))]
      : [],
  })));

  // Items entering a session are at least "in_refinement" (don't downgrade).
  await c.supabase.from("project_backlog_items").update({ refinement_status: "in_refinement" })
    .in("id", input.itemIds).eq("organization_id", c.org.organizationId)
    .in("refinement_status", ["new", "needs_clarification", "ready_for_refinement"]);

  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "refinement_session_started", `Refinement session "${input.title.trim()}" with ${input.itemIds.length} item(s)`);
  return { sessionId };
}

export async function setSessionStatusAction(input: { projectId: string; id: string; status: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!["planned", "active", "completed", "canceled"].includes(input.status)) return { error: "bad_status" };
  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === "completed") patch.completed_at = new Date().toISOString();
  const { error } = await c.supabase.from("refinement_sessions").update(patch).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

export async function deleteRefinementSessionAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("refinement_sessions").update({ deleted_at: new Date().toISOString() }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

/** Save the outcome of reviewing one item in a session. If the outcome is a
 *  refinement status, propagate it to the backlog item. */
export async function saveSessionItemOutcomeAction(input: { projectId: string; sessionItemId: string; backlogItemId: string; outcome?: string; decisions?: string; notes?: string; actionItems?: string; reviewed?: boolean }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("refinement_session_items").update({
    outcome: input.outcome || null, decisions: input.decisions?.trim() || null,
    notes: input.notes?.trim() || null, action_items: input.actionItems?.trim() || null,
    reviewed: input.reviewed ?? true,
  }).eq("id", input.sessionItemId).eq("organization_id", c.org.organizationId);
  if (error) return { error: "unexpected" };

  if (input.outcome && STATUS_ALLOWED.has(input.outcome)) {
    const patch: Record<string, unknown> = { refinement_status: input.outcome };
    if (input.outcome === "refined" || input.outcome === "ready_for_planning") patch.refined_at = new Date().toISOString();
    await c.supabase.from("project_backlog_items").update(patch).eq("id", input.backlogItemId).eq("organization_id", c.org.organizationId);
  }
  return {};
}

/** Split a work item into child items (carry over type/priority/milestone).
 *  The parent is marked split_required and the children point back to it. */
export async function splitWorkItemAction(input: { projectId: string; id: string; childTitles: string[] }): Promise<{ error?: string; count?: number }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const titles = input.childTitles.map((t) => t.trim()).filter(Boolean);
  if (titles.length < 2) return { error: "need_two_children" };
  const { data: parent } = await c.supabase.from("project_backlog_items").select("*").eq("id", input.id).eq("organization_id", c.org.organizationId).is("deleted_at", null).maybeSingle();
  if (!parent) return { error: "not_found" };
  const pt = parent as Record<string, unknown>;

  const { count } = await c.supabase.from("project_backlog_items").select("id", { count: "exact", head: true }).eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).is("deleted_at", null);
  const base = count ?? 0;
  const { error } = await c.supabase.from("project_backlog_items").insert(titles.map((title, i) => ({
    organization_id: c.org.organizationId, project_id: input.projectId, framework_id: c.frameworkId,
    title, item_type: (pt.item_type as string) || null, priority: (pt.priority as string) || null,
    linked_milestone_id: (pt.linked_milestone_id as string) || null,
    parent_item_id: input.id, status: "backlog", refinement_status: "new",
    position: base + i, source: "split",
  })));
  if (error) return { error: "unexpected" };
  await c.supabase.from("project_backlog_items").update({ refinement_status: "split_required" }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  await saveFrameworkEvent(c.supabase, c.org, input.projectId, c.frameworkId, "work_item_split", `Split "${String(pt.title)}" into ${titles.length} item(s)`);
  return { count: titles.length };
}

/** Link a work item to a decision / meeting / communication / document / risk. */
export async function linkWorkItemAction(input: { projectId: string; itemId: string; entityType: string; entityId: string; label?: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  if (!["decision", "meeting", "communication", "document", "risk", "issue"].includes(input.entityType)) return { error: "bad_type" };
  const { error } = await c.supabase.from("work_item_links").insert({
    organization_id: c.org.organizationId, project_id: input.projectId, backlog_item_id: input.itemId,
    entity_type: input.entityType, entity_id: input.entityId, label: input.label || null, created_by: c.org.userId,
  });
  if (error && !String(error.code).startsWith("23505")) return { error: "unexpected" };
  return {};
}

export async function unlinkWorkItemAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("work_item_links").delete().eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
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
