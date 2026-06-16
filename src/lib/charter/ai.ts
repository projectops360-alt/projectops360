// ============================================================================
// ProjectOps360° — Project Charter AI (server-only)
// ============================================================================
// Reuses runAi('custom', { prompt }) (requiresJson). Five functions:
//   A. generateCharterDraft   B. runGapAnalysis   C. detectScopeCreep
//   D. generateStakeholderSummary   E. askCharter (Q&A)
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { CHARTER_SECTIONS, CHARTER_FIELDS, ROLE_OPTIONS, RULE_TYPES, APPROVAL_AREAS, type CharterFieldKey } from "./fields";
import { getCharterByProject } from "./service";

type Supabase = ReturnType<typeof createAdminClient>;

export interface GapItem { area: string; severity: "high" | "medium" | "low"; recommendation: string; }
export interface ScopeCreepFlag { item: string; reason: string; }

function charterToText(charter: Record<string, unknown>, locale: Locale): string {
  const isEs = locale === "es";
  const out: string[] = [];
  for (const s of CHARTER_SECTIONS) {
    const lines = s.fields
      .map((f) => { const v = charter[f.key]; return v && String(v).trim() ? `- ${isEs ? f.es : f.en}: ${String(v).trim()}` : null; })
      .filter(Boolean);
    if (lines.length) out.push(`## ${isEs ? s.es : s.en}\n${lines.join("\n")}`);
  }
  return out.join("\n\n");
}

async function projectContext(supabase: Supabase, organizationId: string, projectId: string, locale: Locale): Promise<string> {
  const { data } = await supabase
    .from("projects").select("title_i18n, description_i18n, project_type, start_date, target_end_date")
    .eq("id", projectId).eq("organization_id", organizationId).single();
  if (!data) return "";
  const title = getI18nValue(data.title_i18n as never, locale) || "";
  const desc = getI18nValue(data.description_i18n as never, locale) || "";
  return [
    `Project: ${title}`, desc && `Description: ${desc}`,
    `Type: ${data.project_type ?? "general"}`,
    data.start_date && `Start: ${data.start_date}`, data.target_end_date && `Target end: ${data.target_end_date}`,
  ].filter(Boolean).join("\n");
}

async function runJson(org: OrgContext, projectId: string, prompt: string): Promise<Record<string, unknown> | null> {
  const { runAi } = await import("@/lib/ai/service");
  const res = await runAi(org, {
    promptType: "custom",
    templateVars: { prompt },
    temperature: 0.3,
    sourceType: "project",
    sourceId: projectId,
  });
  if (res.status !== "completed") return null;
  return (res.parsedJson ?? null) as Record<string, unknown> | null;
}

const asArr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

// ── A. Generate Charter Draft ───────────────────────────────────────────────

export async function generateCharterDraft(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<{ fields: Partial<Record<CharterFieldKey, string>>; count: number }> {
  const supabase = createAdminClient();
  const ctx = await projectContext(supabase, org.organizationId, projectId, locale);
  const lang = locale === "es" ? "español" : "English";
  const keys = CHARTER_FIELDS.map((f) => `"${f.key}": "${locale === "es" ? f.es : f.en}"`).join(",\n  ");
  const prompt = [
    `You are a senior PMO consultant drafting a Project Charter. Write ALL content in ${lang}.`,
    "From the project info below, produce a professional first draft for EVERY field.",
    "Be concrete and realistic for this project type. Each field is plain text; use short line-separated bullets where natural.",
    "Return ONLY a JSON object whose keys are EXACTLY these field keys (values are the drafted text):",
    `{\n  ${keys}\n}`,
    "",
    "=== PROJECT INFO ===",
    ctx,
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  const fields: Partial<Record<CharterFieldKey, string>> = {};
  if (json) {
    for (const f of CHARTER_FIELDS) {
      const v = str(json[f.key]);
      if (v) fields[f.key] = v;
    }
  }
  return { fields, count: Object.keys(fields).length };
}

// ── B. Gap Analysis ─────────────────────────────────────────────────────────

export async function runGapAnalysis(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<GapItem[]> {
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  if (!charter) return [];
  const lang = locale === "es" ? "español" : "English";
  const prompt = [
    `You are a PMO reviewer auditing a Project Charter. Respond in ${lang}.`,
    "Identify gaps: missing required sections, weak/non-measurable objectives, scope ambiguity, missing out-of-scope boundaries, missing approval rules, missing stakeholder roles, missing success criteria, missing communication cadence, missing escalation paths.",
    'Return ONLY JSON: { "items": [ { "area": "short label", "severity": "high|medium|low", "recommendation": "one concrete sentence" } ] }. Max 12 items, most important first. If the charter is solid, return an empty array.',
    "",
    "=== CHARTER ===",
    charterToText(charter, locale) || "(empty charter)",
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  return asArr(json?.items).map((it) => {
    const o = it as Record<string, unknown>;
    const sev = str(o.severity).toLowerCase();
    return {
      area: str(o.area) || "—",
      severity: (sev === "high" || sev === "medium" || sev === "low" ? sev : "medium") as GapItem["severity"],
      recommendation: str(o.recommendation),
    };
  }).filter((i) => i.area !== "—" || i.recommendation);
}

// ── C. Scope Creep Detection ────────────────────────────────────────────────

export async function detectScopeCreep(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<ScopeCreepFlag[]> {
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  if (!charter) return [];
  const inScope = str(charter.in_scope), outScope = str(charter.out_of_scope);
  const deliverables = str(charter.major_deliverables), success = str(charter.success_criteria), objectives = str(charter.objectives);
  if (!inScope && !deliverables && !objectives) return []; // nothing approved to compare against

  const { data: tasks } = await supabase
    .from("roadmap_tasks").select("title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(120);
  const titles = (tasks ?? []).map((t) => (t as { title: string }).title).filter(Boolean);
  if (titles.length === 0) return [];

  const lang = locale === "es" ? "español" : "English";
  const prompt = [
    `You are a PMO scope-control assistant. Respond in ${lang}.`,
    "Compare the project's TASKS against the approved Charter scope. Flag ONLY tasks that clearly do NOT align with the objectives, in-scope, deliverables or success criteria (possible scope creep). Do not flag tasks that plausibly fit.",
    'Return ONLY JSON: { "flags": [ { "item": "the task title", "reason": "why it may be scope creep (one sentence)" } ] }. If everything aligns, return an empty array.',
    "",
    `OBJECTIVES:\n${objectives || "(none)"}`,
    `IN SCOPE:\n${inScope || "(none)"}`,
    `OUT OF SCOPE:\n${outScope || "(none)"}`,
    `DELIVERABLES:\n${deliverables || "(none)"}`,
    `SUCCESS CRITERIA:\n${success || "(none)"}`,
    "",
    `TASKS:\n${titles.map((t) => `- ${t}`).join("\n")}`,
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  return asArr(json?.flags).map((f) => {
    const o = f as Record<string, unknown>;
    return { item: str(o.item), reason: str(o.reason) };
  }).filter((f) => f.item);
}

// ── D. Stakeholder Summary ──────────────────────────────────────────────────

export async function generateStakeholderSummary(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<string> {
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  if (!charter) return "";
  const lang = locale === "es" ? "español" : "English";
  const prompt = [
    `You are writing a short stakeholder-friendly explanation of a project. Respond in ${lang}, 1-2 short paragraphs, plain non-technical language.`,
    "Cover: what the project is, why it matters, the current governance status, and what needs attention.",
    'Return ONLY JSON: { "summary": "..." }.',
    "",
    "=== CHARTER ===",
    charterToText(charter, locale) || "(empty charter)",
    `Charter status: ${charter.status}`,
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  return str(json?.summary);
}

// ── F. Generate Governance (roles + rules + approval matrix by project type) ─

export interface GeneratedRole { role_name: string; responsibility: string; authority_level: string; decision_rights: string; escalation_level: number; }
export interface GeneratedRule { rule_type: string; rule_name: string; description: string; trigger_condition: string; required_approval_role: string; escalation_role: string; }
export interface GeneratedApproval { approval_area: string; approval_required_from: string; threshold_type: string; threshold_value: string; escalation_path: string; required_response_time: string; }
export interface GeneratedGovernance { roles: GeneratedRole[]; governanceRules: GeneratedRule[]; approvalMatrix: GeneratedApproval[]; }

export async function generateGovernance(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<GeneratedGovernance> {
  const supabase = createAdminClient();
  const { data: proj } = await supabase
    .from("projects").select("project_type, title_i18n, description_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).single();
  const projectType = (proj?.project_type as string) ?? "general";
  const ctx = await projectContext(supabase, org.organizationId, projectId, locale);
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  const scope = charter ? charterToText(charter, locale) : "";
  const lang = locale === "es" ? "español" : "English";

  const prompt = [
    `You are a PMO governance expert. Design the project's GOVERNANCE following best practices (PMI / PMBOK and the domain practices relevant to this project's nature). Respond in ${lang}.`,
    `Tailor EVERYTHING to the project's nature/type: "${projectType}". For construction-type projects emphasize RFIs, submittals, inspections, safety, change orders and milestone acceptance; for software projects emphasize releases, QA gates, sprint reviews and technical decisions; adapt accordingly.`,
    "Produce a coherent, realistic governance model: who decides, who approves what (with thresholds), how issues/risks/changes escalate, and the reporting cadence.",
    "Return ONLY JSON with exactly these arrays:",
    `{`,
    `  "roles": [ { "role_name", "responsibility", "authority_level", "decision_rights", "escalation_level" } ],          // 5-7 roles`,
    `  "governanceRules": [ { "rule_type", "rule_name", "description", "trigger_condition", "required_approval_role", "escalation_role" } ],  // 6-9 rules`,
    `  "approvalMatrix": [ { "approval_area", "approval_required_from", "threshold_type", "threshold_value", "escalation_path", "required_response_time" } ]  // 6-8 areas`,
    `}`,
    `Use "role_name" from this set when possible: ${ROLE_OPTIONS.join(", ")}.`,
    `Use "rule_type" from this set: ${RULE_TYPES.join(", ")}.`,
    `Use "approval_area" from this set: ${APPROVAL_AREAS.join(", ")}.`,
    `"escalation_level" is an integer 1-4 (1 = highest authority). Keep each text field short and concrete.`,
    "",
    "=== PROJECT ===",
    ctx,
    scope ? `\n=== CHARTER SCOPE (for alignment) ===\n${scope}` : "",
  ].join("\n");

  const json = await runJson(org, projectId, prompt);
  const roles: GeneratedRole[] = asArr(json?.roles).map((r) => {
    const o = r as Record<string, unknown>;
    const lvl = Number(o.escalation_level);
    return { role_name: str(o.role_name), responsibility: str(o.responsibility), authority_level: str(o.authority_level), decision_rights: str(o.decision_rights), escalation_level: Number.isFinite(lvl) ? lvl : 0 };
  }).filter((r) => r.role_name);
  const governanceRules: GeneratedRule[] = asArr(json?.governanceRules).map((r) => {
    const o = r as Record<string, unknown>;
    return { rule_type: str(o.rule_type) || "Change Management", rule_name: str(o.rule_name), description: str(o.description), trigger_condition: str(o.trigger_condition), required_approval_role: str(o.required_approval_role), escalation_role: str(o.escalation_role) };
  }).filter((r) => r.rule_name);
  const approvalMatrix: GeneratedApproval[] = asArr(json?.approvalMatrix).map((r) => {
    const o = r as Record<string, unknown>;
    return { approval_area: str(o.approval_area), approval_required_from: str(o.approval_required_from), threshold_type: str(o.threshold_type), threshold_value: str(o.threshold_value), escalation_path: str(o.escalation_path), required_response_time: str(o.required_response_time) };
  }).filter((r) => r.approval_area);

  return { roles, governanceRules, approvalMatrix };
}

// ── E. Charter Q&A ──────────────────────────────────────────────────────────

export async function askCharter(
  org: OrgContext, projectId: string, question: string, locale: Locale,
): Promise<string> {
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  if (!charter) return "";
  const lang = locale === "es" ? "español" : "English";
  const prompt = [
    `Answer the user's question about this Project Charter. Respond in ${lang}, concise and factual, based ONLY on the charter below. If the answer is not in the charter, say so.`,
    'Return ONLY JSON: { "answer": "..." }.',
    "",
    "=== CHARTER ===",
    charterToText(charter, locale) || "(empty charter)",
    "",
    `QUESTION: ${question}`,
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  return str(json?.answer);
}
