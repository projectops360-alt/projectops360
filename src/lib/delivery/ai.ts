// ============================================================================
// ProjectOps360° — Delivery Framework AI (server-only). Reuses runAi('custom').
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { DELIVERY_METHODS, BACKLOG_ITEM_TYPES, type DeliveryMethod } from "./config";
import { getFrameworkByProject } from "./service";

type Supabase = ReturnType<typeof createAdminClient>;

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const arr = (x: unknown) => (Array.isArray(x) ? x : []);

async function runJson(org: OrgContext, projectId: string, prompt: string): Promise<Record<string, unknown> | null> {
  const { runAi } = await import("@/lib/ai/service");
  const res = await runAi(org, { promptType: "custom", templateVars: { prompt }, temperature: 0.3, sourceType: "project", sourceId: projectId });
  return res.status === "completed" ? ((res.parsedJson ?? null) as Record<string, unknown> | null) : null;
}

async function charterScope(supabase: Supabase, organizationId: string, projectId: string): Promise<string> {
  const { data } = await supabase.from("project_charters")
    .select("project_goal, objectives, in_scope, out_of_scope, major_deliverables, success_criteria")
    .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
  if (!data) return "";
  const c = data as Record<string, string | null>;
  return [
    c.project_goal && `GOAL: ${c.project_goal}`, c.objectives && `OBJECTIVES: ${c.objectives}`,
    c.in_scope && `IN SCOPE: ${c.in_scope}`, c.out_of_scope && `OUT OF SCOPE: ${c.out_of_scope}`,
    c.major_deliverables && `DELIVERABLES: ${c.major_deliverables}`, c.success_criteria && `SUCCESS: ${c.success_criteria}`,
  ].filter(Boolean).join("\n");
}

async function projectInfo(supabase: Supabase, organizationId: string, projectId: string, locale: Locale): Promise<string> {
  const { data } = await supabase.from("projects").select("title_i18n, description_i18n, project_type").eq("id", projectId).eq("organization_id", organizationId).single();
  if (!data) return "";
  return [getI18nValue(data.title_i18n as never, locale), getI18nValue(data.description_i18n as never, locale), `type: ${data.project_type ?? "general"}`].filter(Boolean).join(" — ");
}

// ── A. Generate Backlog from Charter ────────────────────────────────────────

export interface GeneratedBacklogItem { title: string; description: string; item_type: string; priority: string; acceptance_criteria: string; linked_charter_objective: string; }

export async function generateBacklogFromCharter(org: OrgContext, projectId: string, locale: Locale): Promise<GeneratedBacklogItem[]> {
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  const scope = await charterScope(supabase, org.organizationId, projectId);
  const info = await projectInfo(supabase, org.organizationId, projectId, locale);
  const lang = locale === "es" ? "español" : "English";
  const method = fw?.delivery_method ? DELIVERY_METHODS[fw.delivery_method as DeliveryMethod] : null;

  const prompt = [
    `You are a delivery lead building the initial PROJECT BACKLOG (generic — not "product backlog"). Respond in ${lang}.`,
    "Generate 8-16 concrete work items derived from the project's charter scope and deliverables. Each must be actionable and aligned to an objective or deliverable.",
    `Use "item_type" from: ${BACKLOG_ITEM_TYPES.join(", ")}. Use "priority" of High, Medium or Low. Tailor item types to the project's nature${method ? ` and the ${method.en} delivery method` : ""}.`,
    'Return ONLY JSON: { "items": [ { "title", "description", "item_type", "priority", "acceptance_criteria", "linked_charter_objective" } ] }.',
    "", `PROJECT: ${info}`, "", "=== CHARTER SCOPE ===", scope || "(charter not filled — infer reasonable items)",
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  return arr(json?.items).map((x) => {
    const o = x as Record<string, unknown>;
    return { title: str(o.title), description: str(o.description), item_type: str(o.item_type) || "Task", priority: str(o.priority) || "Medium", acceptance_criteria: str(o.acceptance_criteria), linked_charter_objective: str(o.linked_charter_objective) };
  }).filter((i) => i.title);
}

// ── A2. Generate milestone backbone from charter (+ organize the backlog) ────

export interface GeneratedMilestone { title: string; description: string; icon_key: string; item_titles: string[]; }

/** Propose the project's milestone backbone (sequential phases) from the charter
 *  scope, and — when a backlog already exists — map each existing item to the
 *  milestone it belongs to (by exact title), so one click both creates the
 *  phases and organizes the backlog into them. */
export async function generateMilestones(org: OrgContext, projectId: string, locale: Locale): Promise<GeneratedMilestone[]> {
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  const scope = await charterScope(supabase, org.organizationId, projectId);
  const info = await projectInfo(supabase, org.organizationId, projectId, locale);
  const { data: items } = await supabase.from("project_backlog_items")
    .select("title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).neq("status", "promoted").limit(150);
  const titles = (items ?? []).map((i) => (i as { title: string }).title).filter(Boolean);
  const lang = locale === "es" ? "español" : "English";
  const method = fw?.delivery_method ? DELIVERY_METHODS[fw.delivery_method as DeliveryMethod] : null;

  const prompt = [
    `You are a delivery lead defining the MILESTONE backbone (the project's phases/stages from start to finish) for execution. Respond in ${lang}.`,
    `Propose 4-7 sequential milestones that structure the whole project, derived from the charter scope and deliverables${method ? ` and the ${method.en} delivery method` : ""}. Order them chronologically (first to last).`,
    titles.length
      ? "For each milestone, assign the EXISTING backlog items that belong to it by copying their EXACT titles into item_titles (each item should land in exactly one milestone; use an empty array if none fit)."
      : "There are no backlog items yet — return item_titles as empty arrays.",
    'Optionally set "icon_key" from: setup, notebook, users, chart, loop, link, sparkles, shield_database, check_circle, rocket.',
    'Return ONLY JSON: { "milestones": [ { "title", "description", "icon_key", "item_titles": ["..."] } ] }.',
    "", `PROJECT: ${info}`, "", "=== CHARTER SCOPE ===", scope || "(charter not filled — infer reasonable phases)",
    titles.length ? `\n=== EXISTING BACKLOG ITEMS ===\n${titles.map((t) => `- ${t}`).join("\n")}` : "",
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  return arr(json?.milestones).map((x) => {
    const o = x as Record<string, unknown>;
    return { title: str(o.title), description: str(o.description), icon_key: str(o.icon_key), item_titles: arr(o.item_titles).map((s) => String(s).trim()).filter(Boolean) };
  }).filter((m) => m.title);
}

// ── B. Detect scope creep (backlog vs charter) ──────────────────────────────

export interface ScopeFlag { title: string; reason: string; severity: string; recommendation: string; }

export async function detectDeliveryScopeCreep(org: OrgContext, projectId: string, locale: Locale): Promise<ScopeFlag[]> {
  const supabase = createAdminClient();
  const scope = await charterScope(supabase, org.organizationId, projectId);
  if (!scope) return [];
  const { data: items } = await supabase.from("project_backlog_items").select("title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(150);
  const titles = (items ?? []).map((i) => (i as { title: string }).title).filter(Boolean);
  if (titles.length === 0) return [];
  const lang = locale === "es" ? "español" : "English";

  const prompt = [
    `You are a scope-control assistant. Respond in ${lang}. Compare the BACKLOG ITEMS against the approved Charter scope. Flag ONLY items that clearly do NOT align (possible scope creep). Don't flag items that plausibly fit.`,
    'Return ONLY JSON: { "flags": [ { "title", "reason", "severity": "high|medium|low", "recommendation": "link to objective | create change request | mark exploratory | ask sponsor" } ] }. Empty array if all aligns.',
    "", "=== CHARTER SCOPE ===", scope, "", `BACKLOG ITEMS:\n${titles.map((t) => `- ${t}`).join("\n")}`,
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  return arr(json?.flags).map((x) => {
    const o = x as Record<string, unknown>;
    const sev = str(o.severity).toLowerCase();
    return { title: str(o.title), reason: str(o.reason), severity: (sev === "high" || sev === "medium" || sev === "low" ? sev : "medium"), recommendation: str(o.recommendation) };
  }).filter((f) => f.title);
}

// ── C. Stakeholder summary (framework-aware) ────────────────────────────────

export async function generateDeliveryStakeholderSummary(org: OrgContext, projectId: string, locale: Locale): Promise<string> {
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  const scope = await charterScope(supabase, org.organizationId, projectId);
  const [{ data: cycles }, { data: items }] = await Promise.all([
    supabase.from("project_execution_cycles").select("name, goal, status").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("position"),
    supabase.from("project_backlog_items").select("status").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);
  const lang = locale === "es" ? "español" : "English";
  const method = fw?.delivery_method ? DELIVERY_METHODS[fw.delivery_method as DeliveryMethod] : null;
  const cycleText = (cycles ?? []).map((c) => `- ${(c as { name: string }).name} [${(c as { status: string }).status}]: ${(c as { goal: string | null }).goal ?? ""}`).join("\n");
  const statusCounts: Record<string, number> = {};
  for (const i of items ?? []) { const s = (i as { status: string }).status; statusCounts[s] = (statusCounts[s] ?? 0) + 1; }

  const prompt = [
    `Write a short stakeholder-friendly status summary in ${lang}, plain non-technical language, 1-2 short paragraphs.`,
    "Cover: what's being delivered, the current execution status, what's in progress/blocked, what decisions are needed and what's next. Relate to the approved charter.",
    'Return ONLY JSON: { "summary": "..." }.',
    "", `Delivery method: ${method ? method.en : "n/a"}`, `Backlog by status: ${JSON.stringify(statusCounts)}`,
    cycleText ? `Cycles:\n${cycleText}` : "", "", "=== CHARTER SCOPE ===", scope || "(n/a)",
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  return str(json?.summary);
}

// ── D. Lessons learned (from a cycle) ───────────────────────────────────────

export interface Lessons { wentWell: string[]; wentWrong: string[]; improvements: string[]; }

export async function generateCycleLessons(org: OrgContext, projectId: string, cycleId: string, locale: Locale): Promise<Lessons> {
  const supabase = createAdminClient();
  const { data: cycle } = await supabase.from("project_execution_cycles").select("name, goal, review_notes, completed_work_summary, incomplete_work_summary, stakeholder_feedback_summary").eq("id", cycleId).eq("organization_id", org.organizationId).maybeSingle();
  if (!cycle) return { wentWell: [], wentWrong: [], improvements: [] };
  const c = cycle as Record<string, string | null>;
  const lang = locale === "es" ? "español" : "English";
  const prompt = [
    `You are facilitating a lessons-learned review for an execution cycle. Respond in ${lang}, concise bullets.`,
    'Return ONLY JSON: { "wentWell": ["..."], "wentWrong": ["..."], "improvements": ["..."] }.',
    "", `CYCLE: ${c.name}`, `GOAL: ${c.goal ?? ""}`, `REVIEW NOTES: ${c.review_notes ?? ""}`,
    `COMPLETED: ${c.completed_work_summary ?? ""}`, `INCOMPLETE: ${c.incomplete_work_summary ?? ""}`, `FEEDBACK: ${c.stakeholder_feedback_summary ?? ""}`,
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  const a = (k: string) => arr(json?.[k]).map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  return { wentWell: a("wentWell"), wentWrong: a("wentWrong"), improvements: a("improvements") };
}

// ── F. AI backlog prioritization ────────────────────────────────────────────

export interface PrioritizedItem { id: string; priority: string; rationale: string; }

/** Rank the (non-promoted) backlog by value, risk, dependencies and charter
 *  alignment. Returns items in priority order (first = highest). */
export async function prioritizeBacklog(org: OrgContext, projectId: string, locale: Locale): Promise<PrioritizedItem[]> {
  const supabase = createAdminClient();
  const scope = await charterScope(supabase, org.organizationId, projectId);
  const { data: items } = await supabase.from("project_backlog_items")
    .select("id, title, item_type, priority, business_value, linked_charter_objective, linked_milestone_id, linked_risk_id")
    .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).neq("status", "promoted").limit(150);
  const rows = (items ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];
  const lang = locale === "es" ? "español" : "English";

  const list = rows.map((it) => `- id:${String(it.id)} | "${String(it.title)}" | type:${String(it.item_type ?? "")} | current:${String(it.priority ?? "")}${it.linked_risk_id ? " | linked-to-risk" : ""}${it.linked_charter_objective ? ` | obj:${String(it.linked_charter_objective)}` : ""}`).join("\n");
  const prompt = [
    `You are a delivery lead prioritizing a project BACKLOG. Respond in ${lang}.`,
    "Rank items by business value, risk mitigation, dependency order (enablers first) and alignment to the charter. Items linked to risks or charter objectives usually rank higher; vague or unaligned items rank lower.",
    'Return ONLY JSON: { "ranking": [ { "id": "<exact id>", "priority": "High|Medium|Low", "rationale": "<short>" } ] }. Include EVERY id exactly once, ordered from highest to lowest priority.',
    "", "=== CHARTER SCOPE ===", scope || "(charter not filled — infer)", "", "=== BACKLOG ITEMS ===", list,
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  const validIds = new Set(rows.map((r) => String(r.id)));
  return arr(json?.ranking).map((x) => {
    const o = x as Record<string, unknown>;
    const pr = str(o.priority);
    const priority = pr === "High" || pr === "Medium" || pr === "Low" ? pr : "Medium";
    return { id: str(o.id), priority, rationale: str(o.rationale) };
  }).filter((r) => validIds.has(r.id));
}

// ── E. Framework health / change recommendation ─────────────────────────────

export async function recommendFrameworkHealth(org: OrgContext, projectId: string, locale: Locale): Promise<string> {
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  if (!fw) return "";
  const [{ count: open }, { count: alerts }, { data: cycles }] = await Promise.all([
    supabase.from("project_backlog_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).neq("status", "Done"),
    supabase.from("project_scope_creep_alerts").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("organization_id", org.organizationId).eq("status", "open"),
    supabase.from("project_execution_cycles").select("status").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);
  const lang = locale === "es" ? "español" : "English";
  const method = DELIVERY_METHODS[(fw.delivery_method ?? "hybrid") as DeliveryMethod];
  const prompt = [
    `You are a delivery coach. In ${lang}, assess whether the current delivery framework still fits, and recommend adjustments if needed (e.g., move Waterfall→Hybrid, Scrum→Kanban, shorten cycles, add change control, increase stakeholder review). Be concise: 2-4 sentences.`,
    'Return ONLY JSON: { "recommendation": "..." }.',
    "", `Current method: ${method.en}`, `Governance: ${fw.governance_level ?? ""}`, `Uncertainty: ${fw.uncertainty_level ?? ""}`,
    `Open backlog items: ${open ?? 0}`, `Open scope-creep alerts: ${alerts ?? 0}`, `Cycles: ${(cycles ?? []).length}`,
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  return str(json?.recommendation);
}
