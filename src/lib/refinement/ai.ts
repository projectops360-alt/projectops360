// ============================================================================
// ProjectOps360° — Work Refinement AI (server-only). Reuses runAi('custom').
// ============================================================================
// Mirrors the runJson + charterScope/projectInfo pattern of
// src/lib/delivery/ai.ts. One assistant entry point: refineWorkItem(), which is
// template-aware (terminology, Definition of Ready, AI questions, destinations)
// and separates known facts / AI assumptions / AI recommendations.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { DELIVERY_METHODS, type DeliveryMethod } from "@/lib/delivery/config";
import { getFrameworkByProject, mapProjectType } from "@/lib/delivery/service";
import { templateFor, PLANNING_DESTINATIONS } from "./templates";

type Supabase = ReturnType<typeof createAdminClient>;

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const strArr = (x: unknown) => arr(x).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);

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

/** Phase 3: pull the most relevant Project Memory items as grounding context.
 *  Ranks by importance then recency (lightweight; no embedding round-trip).
 *  Returns a formatted block or "" when the project has no memory. */
async function projectMemoryContext(supabase: Supabase, organizationId: string, projectId: string, limit = 8): Promise<string> {
  const { data } = await supabase.from("project_memory_items")
    .select("title, summary, content, importance_level, created_at")
    .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(40);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return "";
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  rows.sort((a, b) => (rank[String(a.importance_level)] ?? 2) - (rank[String(b.importance_level)] ?? 2));
  return rows.slice(0, limit).map((m) => {
    const body = str(m.summary) || str(m.content).slice(0, 200);
    return `- [${str(m.importance_level) || "med"}] ${str(m.title)}${body ? `: ${body}` : ""}`;
  }).join("\n");
}

// ── Refine a single work item ────────────────────────────────────────────────

export interface RefineWorkItemResult {
  ai_summary: string;
  questions: string[];
  suggested_acceptance_criteria: string;
  suggested_completion_criteria: string;
  suggested_dor: string[];
  suggested_dependencies: string[];
  suggested_risks: string[];
  suggested_estimate: string;
  suggested_priority: string;
  suggested_destination: string;
  readiness_explanation: string;
  split_suggestion: string;
  facts: string[];
  assumptions: string[];
}

const EMPTY: RefineWorkItemResult = {
  ai_summary: "", questions: [], suggested_acceptance_criteria: "", suggested_completion_criteria: "",
  suggested_dor: [], suggested_dependencies: [], suggested_risks: [], suggested_estimate: "",
  suggested_priority: "", suggested_destination: "", readiness_explanation: "", split_suggestion: "",
  facts: [], assumptions: [],
};

/**
 * Template-aware AI refinement for one work item. Pulls the project's delivery
 * method + refinement template + charter scope as context, and asks the model
 * to fill the refinement gaps while separating facts/assumptions/recommendations.
 */
export async function refineWorkItem(
  org: OrgContext, projectId: string, itemId: string, locale: Locale,
): Promise<RefineWorkItemResult> {
  const supabase = createAdminClient();

  const { data: item } = await supabase.from("project_backlog_items")
    .select("title, description, item_type, priority, acceptance_criteria, completion_criteria, risk_level, estimation_method, estimate_value, linked_charter_objective")
    .eq("id", itemId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle();
  if (!item) return EMPTY;
  const it = item as Record<string, unknown>;

  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  const method = (fw?.delivery_method ?? null) as DeliveryMethod | null;
  const projectType = fw?.project_type ?? mapProjectType(null);
  const tpl = templateFor(method, projectType);
  const isEs = locale === "es";
  const lang = isEs ? "español" : "English";

  const [scope, info, memory] = await Promise.all([
    charterScope(supabase, org.organizationId, projectId),
    projectInfo(supabase, org.organizationId, projectId, locale),
    projectMemoryContext(supabase, org.organizationId, projectId),
  ]);

  const dorList = tpl.definitionOfReady.map((d) => `- ${isEs ? d.es : d.en}`).join("\n");
  const questionList = tpl.aiQuestions.map((q) => `- ${isEs ? q.es : q.en}`).join("\n");
  const destinations = tpl.planningDestinations
    .map((v) => PLANNING_DESTINATIONS.find((p) => p.value === v))
    .filter(Boolean)
    .map((p) => (isEs ? p!.es : p!.en))
    .join(", ");
  const methodName = method ? (isEs ? DELIVERY_METHODS[method].es : DELIVERY_METHODS[method].en) : (isEs ? "no definido" : "undefined");

  const prompt = [
    `You are an AI Project Manager helping refine a single WORK ITEM before it moves to execution. Respond in ${lang}.`,
    `The project's delivery method is "${methodName}" and the refinement approach is "${isEs ? tpl.secondaryLabel.es : tpl.secondaryLabel.en}". Use this terminology: ${isEs ? tpl.terminology.es : tpl.terminology.en}.`,
    "Your job: clarify scope, propose acceptance/completion criteria, identify dependencies and risks, suggest an estimate, priority and the best planning destination, and explain readiness.",
    "CRITICAL: clearly separate what is a KNOWN PROJECT FACT (grounded in the provided context) from an AI ASSUMPTION (something you inferred). Recommendations go in their own fields.",
    "",
    "=== DEFINITION OF READY FOR THIS TYPE ===", dorList,
    "", "=== REFINEMENT QUESTIONS TO CONSIDER ===", questionList,
    "", `Planning destinations to choose from: ${destinations}.`,
    `Estimation method for this project: ${tpl.defaultEstimationMethod}.`,
    "",
    "Return ONLY JSON with this exact shape:",
    `{
  "ai_summary": "1-2 sentence plain summary of what this item is and its readiness",
  "questions": ["open refinement questions still unanswered"],
  "suggested_acceptance_criteria": "bulleted text or empty",
  "suggested_completion_criteria": "bulleted text or empty",
  "suggested_dor": ["Definition of Ready items still missing"],
  "suggested_dependencies": ["likely dependencies / predecessors"],
  "suggested_risks": ["likely risks"],
  "suggested_estimate": "a concrete estimate suggestion in the project's method",
  "suggested_priority": "High|Medium|Low",
  "suggested_destination": "one of the planning destinations above",
  "readiness_explanation": "why it is or isn't ready, and what to do next",
  "split_suggestion": "if too large, how to split it; else empty",
  "facts": ["known project facts used"],
  "assumptions": ["AI assumptions made"]
}`,
    "",
    `PROJECT: ${info}`,
    "", "=== CHARTER SCOPE ===", scope || "(charter not filled — infer reasonably)",
    memory ? `\n=== PROJECT MEMORY (known facts — prefer these over assumptions) ===\n${memory}` : "",
    "",
    "=== WORK ITEM ===",
    `Title: ${str(it.title)}`,
    `Type: ${str(it.item_type)}`,
    `Description: ${str(it.description) || "(none)"}`,
    `Current acceptance criteria: ${str(it.acceptance_criteria) || "(none)"}`,
    `Current completion criteria: ${str(it.completion_criteria) || "(none)"}`,
    `Current priority: ${str(it.priority) || "(none)"} · risk: ${str(it.risk_level) || "(none)"} · estimate: ${str(it.estimate_value) || "(none)"}`,
    it.linked_charter_objective ? `Linked objective: ${str(it.linked_charter_objective)}` : "",
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  if (!json) return EMPTY;

  const pr = str(json.suggested_priority);
  return {
    ai_summary: str(json.ai_summary),
    questions: strArr(json.questions),
    suggested_acceptance_criteria: str(json.suggested_acceptance_criteria),
    suggested_completion_criteria: str(json.suggested_completion_criteria),
    suggested_dor: strArr(json.suggested_dor),
    suggested_dependencies: strArr(json.suggested_dependencies),
    suggested_risks: strArr(json.suggested_risks),
    suggested_estimate: str(json.suggested_estimate),
    suggested_priority: pr === "High" || pr === "Medium" || pr === "Low" ? pr : "",
    suggested_destination: str(json.suggested_destination),
    readiness_explanation: str(json.readiness_explanation),
    split_suggestion: str(json.split_suggestion),
    facts: strArr(json.facts),
    assumptions: strArr(json.assumptions),
  };
}

// ── Prepare a refinement session ──────────────────────────────────────────────

export interface SessionTalkingPoints { backlog_item_id: string; talking_points: string[]; open_questions: string[]; }

/**
 * AI-prepare a refinement review: for each selected work item, produce concise
 * talking points and the open questions to resolve during the session. Template
 * + charter aware. Returns one entry per item (best-effort).
 */
export async function prepareRefinementSession(
  org: OrgContext, projectId: string, itemIds: string[], locale: Locale,
): Promise<SessionTalkingPoints[]> {
  if (itemIds.length === 0) return [];
  const supabase = createAdminClient();

  const { data: rows } = await supabase.from("project_backlog_items")
    .select("id, title, item_type, description, acceptance_criteria, priority, risk_level, readiness_score")
    .in("id", itemIds).eq("organization_id", org.organizationId).is("deleted_at", null);
  const items = (rows ?? []) as Record<string, unknown>[];
  if (items.length === 0) return [];

  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  const method = (fw?.delivery_method ?? null) as DeliveryMethod | null;
  const tpl = templateFor(method, fw?.project_type ?? mapProjectType(null));
  const isEs = locale === "es";
  const lang = isEs ? "español" : "English";
  const [scope, memory] = await Promise.all([
    charterScope(supabase, org.organizationId, projectId),
    projectMemoryContext(supabase, org.organizationId, projectId, 6),
  ]);
  const methodName = method ? (isEs ? DELIVERY_METHODS[method].es : DELIVERY_METHODS[method].en) : "n/a";

  const list = items.map((it) => `- id:${String(it.id)} | "${str(it.title)}" | type:${str(it.item_type)} | readiness:${it.readiness_score ?? "?"} | ${str(it.description).slice(0, 160)}`).join("\n");
  const prompt = [
    `You are facilitating a "${isEs ? tpl.secondaryLabel.es : tpl.secondaryLabel.en}" review for a ${methodName} project. Respond in ${lang}.`,
    "For EACH work item, give 2-4 concise TALKING POINTS the team should discuss and the OPEN QUESTIONS to resolve so the item becomes ready. Be specific to the item and the delivery method.",
    'Return ONLY JSON: { "items": [ { "backlog_item_id": "<exact id>", "talking_points": ["..."], "open_questions": ["..."] } ] }.',
    "", scope ? `=== CHARTER SCOPE ===\n${scope}\n` : "", memory ? `=== PROJECT MEMORY ===\n${memory}\n` : "", "=== WORK ITEMS ===", list,
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  const valid = new Set(items.map((i) => String(i.id)));
  return arr(json?.items).map((x) => {
    const o = x as Record<string, unknown>;
    return { backlog_item_id: str(o.backlog_item_id), talking_points: strArr(o.talking_points), open_questions: strArr(o.open_questions) };
  }).filter((e) => valid.has(e.backlog_item_id));
}
