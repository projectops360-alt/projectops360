"use server";

// ============================================================================
// PMO Global Search — across all projects and company data
// ============================================================================
// Org-scoped full-organization search over projects, tasks, milestones, risks,
// materials, RFIs, resources (people/crews), decisions, and budget items.
// Returns grouped, linkable results. Never crosses organization boundaries.
// ============================================================================

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue, type I18nField } from "@/types/database";
import { localizedHref } from "@/i18n/href";

export type SearchEntityType =
  | "project" | "task" | "milestone" | "risk" | "material" | "rfi" | "resource" | "decision" | "budget";

export interface SearchResult {
  type: SearchEntityType;
  title: string;
  subtitle: string;
  href: string;
  projectId: string | null;
}

const LIMIT_PER_TYPE = 6;

export async function globalSearchAction(input: { query: string; locale?: string }): Promise<{ error?: string; results?: SearchResult[] }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ query: z.string().min(2).max(120), locale: z.string().max(5).optional() }).safeParse(input);
  if (!parsed.success) return { results: [] };
  const q = parsed.data.query.trim();
  const locale = parsed.data.locale ?? "en";
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const supabase = createAdminClient();
  const orgId = org.organizationId;
  const P = localizedHref(locale, "/projects");

  // Project name map (for sublabels/links)
  const { data: projectRows } = await supabase
    .from("projects").select("id, title_i18n, slug, status").eq("organization_id", orgId).is("deleted_at", null);
  const projectName = new Map((projectRows ?? []).map((p) => [p.id, getI18nValue(p.title_i18n as I18nField, locale as "en" | "es") || p.slug]));
  // Only surface child records whose parent project is still alive. Archived
  // projects leave their tasks/risks/etc. behind (no cascade soft-delete), and
  // those would 404 when opened. Resources may be org-level (null project_id).
  const aliveIds = new Set((projectRows ?? []).map((p) => p.id));
  const aliveChild = (pid: string | null) => pid != null && aliveIds.has(pid);

  const [tasksRes, milestonesRes, risksRes, materialsRes, rfisRes, resourcesRes, decisionsRes, budgetRes] = await Promise.all([
    supabase.from("roadmap_tasks").select("id, title, status, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("title", like).limit(LIMIT_PER_TYPE),
    supabase.from("milestones").select("id, title, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("title", like).limit(LIMIT_PER_TYPE),
    supabase.from("risks").select("id, title, severity, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("title", like).limit(LIMIT_PER_TYPE),
    supabase.from("material_requirements").select("id, name, status, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("name", like).limit(LIMIT_PER_TYPE),
    supabase.from("rfis").select("id, subject, status, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("subject", like).limit(LIMIT_PER_TYPE),
    supabase.from("resources").select("id, name, resource_type, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("name", like).limit(LIMIT_PER_TYPE),
    supabase.from("decisions").select("id, title_i18n, status, project_id").eq("organization_id", orgId).is("deleted_at", null).limit(40),
    supabase.from("budget_items").select("id, name, category, project_id").eq("organization_id", orgId).is("deleted_at", null).ilike("name", like).limit(LIMIT_PER_TYPE),
  ]);

  const results: SearchResult[] = [];
  const proj = (id: string | null) => (id ? projectName.get(id) ?? "—" : "—");

  // Projects (match name)
  const qlower = q.toLowerCase();
  for (const p of (projectRows ?? []).filter((p) => (projectName.get(p.id) ?? "").toLowerCase().includes(qlower)).slice(0, LIMIT_PER_TYPE)) {
    results.push({ type: "project", title: projectName.get(p.id) ?? p.slug, subtitle: String(p.status), href: `${P}/${p.id}`, projectId: p.id });
  }
  for (const t of tasksRes.data ?? []) if (aliveChild(t.project_id)) results.push({ type: "task", title: t.title, subtitle: `${proj(t.project_id)} · ${t.status}`, href: `${P}/${t.project_id}/workboard?task=${t.id}`, projectId: t.project_id });
  for (const m of milestonesRes.data ?? []) if (aliveChild(m.project_id)) results.push({ type: "milestone", title: m.title, subtitle: proj(m.project_id), href: `${P}/${m.project_id}/execution-map`, projectId: m.project_id });
  for (const r of risksRes.data ?? []) if (aliveChild(r.project_id)) results.push({ type: "risk", title: r.title, subtitle: `${proj(r.project_id)} · ${r.severity}`, href: `${P}/${r.project_id}`, projectId: r.project_id });
  for (const m of materialsRes.data ?? []) if (aliveChild(m.project_id)) results.push({ type: "material", title: m.name, subtitle: `${proj(m.project_id)} · ${m.status}`, href: `${P}/${m.project_id}`, projectId: m.project_id });
  for (const r of rfisRes.data ?? []) if (aliveChild(r.project_id)) results.push({ type: "rfi", title: r.subject, subtitle: `${proj(r.project_id)} · ${r.status}`, href: `${P}/${r.project_id}`, projectId: r.project_id });
  for (const r of resourcesRes.data ?? []) if (r.project_id == null || aliveIds.has(r.project_id)) results.push({ type: "resource", title: r.name, subtitle: r.resource_type, href: localizedHref(locale, "/team"), projectId: r.project_id });
  for (const d of (decisionsRes.data ?? [])) {
    const title = getI18nValue(d.title_i18n as I18nField, locale as "en" | "es");
    if (aliveChild(d.project_id) && title.toLowerCase().includes(qlower)) results.push({ type: "decision", title, subtitle: `${proj(d.project_id)} · ${d.status}`, href: `${P}/${d.project_id}/decisions`, projectId: d.project_id });
  }
  for (const b of budgetRes.data ?? []) if (aliveChild(b.project_id)) results.push({ type: "budget", title: b.name, subtitle: `${proj(b.project_id)} · ${b.category}`, href: `${P}/${b.project_id}`, projectId: b.project_id });

  return { results: results.slice(0, 40) };
}
