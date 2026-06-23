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

  const [scope, info] = await Promise.all([
    charterScope(supabase, org.organizationId, projectId),
    projectInfo(supabase, org.organizationId, projectId, locale),
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
