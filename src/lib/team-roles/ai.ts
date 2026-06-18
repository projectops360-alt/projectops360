// ============================================================================
// ProjectOps360° — Team & Roles AI (server-only). Reuses runAi('custom').
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const arr = (x: unknown) => (Array.isArray(x) ? x : []);

async function runJson(org: OrgContext, projectId: string, prompt: string): Promise<Record<string, unknown> | null> {
  const { runAi } = await import("@/lib/ai/service");
  const res = await runAi(org, { promptType: "custom", templateVars: { prompt }, temperature: 0.3, sourceType: "project", sourceId: projectId });
  return res.status === "completed" ? ((res.parsedJson ?? null) as Record<string, unknown> | null) : null;
}

async function context(org: OrgContext, projectId: string, locale: Locale): Promise<string> {
  const supabase = createAdminClient();
  const [{ data: project }, { data: charter }, { data: fw }] = await Promise.all([
    supabase.from("projects").select("title_i18n, description_i18n, project_type").eq("id", projectId).eq("organization_id", org.organizationId).maybeSingle(),
    supabase.from("project_charters").select("project_goal, objectives, major_deliverables, in_scope").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle(),
    supabase.from("project_delivery_frameworks").select("delivery_method, governance_level, vendor_dependency_level, change_control_required").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle(),
  ]);
  const p = (project ?? {}) as Record<string, unknown>;
  const c = (charter ?? {}) as Record<string, string | null>;
  const f = (fw ?? {}) as Record<string, string | null>;
  return [
    `PROJECT: ${getI18nValue(p.title_i18n as never, locale)} — type: ${p.project_type ?? "general"}`,
    getI18nValue(p.description_i18n as never, locale) && `DESCRIPTION: ${getI18nValue(p.description_i18n as never, locale)}`,
    c.project_goal && `GOAL: ${c.project_goal}`,
    c.major_deliverables && `DELIVERABLES: ${c.major_deliverables}`,
    c.in_scope && `IN SCOPE: ${c.in_scope}`,
    f.delivery_method && `DELIVERY METHOD: ${f.delivery_method}`,
    f.governance_level && `GOVERNANCE: ${f.governance_level}`,
    f.vendor_dependency_level && `VENDOR DEPENDENCY: ${f.vendor_dependency_level}`,
    f.change_control_required && `CHANGE CONTROL: ${f.change_control_required}`,
  ].filter(Boolean).join("\n");
}

// ── Recommend project roles ─────────────────────────────────────────────────

export interface RecommendedRole { project_role: string; delivery_role: string; governance_role: string; permission_level: string; rationale: string }

export async function recommendProjectRoles(org: OrgContext, projectId: string, locale: Locale): Promise<RecommendedRole[]> {
  const ctx = await context(org, projectId, locale);
  const lang = locale === "es" ? "español" : "English";
  const prompt = [
    `You are a PMO advisor. Respond in ${lang}. Recommend the project ROLES needed for this project, adapted to its type, scope, delivery method and governance.`,
    "Include execution roles AND governance roles (sponsor, approver, steering, change control owner) where the governance/change-control level warrants. Add vendor/consultant roles if there is vendor dependency.",
    'For each role return permission_level from: project_owner, project_manager, contributor, approver, stakeholder_viewer, external_contributor, external_viewer, read_only.',
    'Return ONLY JSON: { "roles": [ { "project_role", "delivery_role", "governance_role", "permission_level", "rationale" } ] }. 5-10 roles.',
    "", ctx,
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  return arr(json?.roles).map((x) => {
    const o = x as Record<string, unknown>;
    return { project_role: str(o.project_role), delivery_role: str(o.delivery_role), governance_role: str(o.governance_role), permission_level: str(o.permission_level) || "contributor", rationale: str(o.rationale) };
  }).filter((r) => r.project_role);
}

// ── Generate a RACI draft over milestones ───────────────────────────────────

export interface RaciDraftItem { entity_label: string; role_hint: string; raci_role: string }

export async function generateRaciDraft(org: OrgContext, projectId: string, locale: Locale, teamRoles: string[]): Promise<RaciDraftItem[]> {
  const supabase = createAdminClient();
  const { data: milestones } = await supabase.from("milestones").select("title").eq("project_id", projectId).is("deleted_at", null).order("order_index").limit(20);
  const titles = (milestones ?? []).map((m) => (m as { title: string }).title).filter(Boolean);
  if (titles.length === 0 || teamRoles.length === 0) return [];
  const lang = locale === "es" ? "español" : "English";

  const prompt = [
    `You are building a RACI matrix. Respond in ${lang}. For each milestone, assign RACI using ONLY the available team roles.`,
    "Each milestone should have exactly one Accountable (A) and at least one Responsible (R). Use Consulted (C) and Informed (I) where useful. Don't invent roles.",
    'Return ONLY JSON: { "items": [ { "entity_label": "<milestone>", "role_hint": "<exact team role>", "raci_role": "responsible|accountable|consulted|informed" } ] }.',
    "", `TEAM ROLES: ${teamRoles.join(", ")}`, "", `MILESTONES:\n${titles.map((t) => `- ${t}`).join("\n")}`,
  ].join("\n");
  const json = await runJson(org, projectId, prompt);
  const valid = new Set(["responsible", "accountable", "consulted", "informed"]);
  return arr(json?.items).map((x) => {
    const o = x as Record<string, unknown>;
    return { entity_label: str(o.entity_label), role_hint: str(o.role_hint), raci_role: str(o.raci_role).toLowerCase() };
  }).filter((i) => i.entity_label && i.role_hint && valid.has(i.raci_role));
}
