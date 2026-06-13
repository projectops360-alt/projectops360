"use server";

// ============================================================================
// Reports & Intelligence — Server Actions
// ============================================================================
// Thin server boundary over the reporting layer. Every action resolves the
// org from the session and scopes queries to it (and optionally a project).
// ============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getDataset } from "@/lib/reports/registry";
import { runReport, runReportForExport } from "@/lib/reports/query-service";
import { rowsToCsv } from "@/lib/reports/filter-engine";
import { validateFormula } from "@/lib/reports/formula";
import { runAi } from "@/lib/ai";
import type { ReportConfig, ReportResult, VisualizationType } from "@/lib/reports/types";
import { getI18nValue, type I18nField } from "@/types/database";

// ── Config validation ─────────────────────────────────────────────────────────

const filterSchema = z.object({
  column: z.string().min(1).max(64),
  operator: z.string().min(1).max(32),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()])), z.null()]).optional(),
});

const calcFieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(80),
  expression: z.string().min(1).max(500),
  source: z.enum(["manual", "ai"]).optional(),
});

const configSchema = z.object({
  datasetId: z.string().min(1).max(64),
  columns: z.array(z.string().max(64)).max(40),
  filters: z.array(filterSchema).max(20),
  grouping: z
    .object({
      column: z.string().max(64),
      metrics: z.array(z.object({ column: z.string().max(64), fn: z.string().max(20), label: z.string().max(80).optional() })).max(10),
    })
    .nullable(),
  sort: z.array(z.object({ column: z.string().max(64), direction: z.enum(["asc", "desc"]) })).max(10),
  visualization: z.enum(["table", "kpi_cards", "bar", "line", "donut", "pivot"]),
  calculatedFields: z.array(calcFieldSchema).max(10).optional(),
});

function sanitizeConfig(input: unknown): ReportConfig | null {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data as ReportConfig;
}

async function assertProjectInOrg(supabase: ReturnType<typeof createAdminClient>, orgId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase.from("projects").select("id").eq("id", projectId).eq("organization_id", orgId).is("deleted_at", null).maybeSingle();
  return !!data;
}

// ── Project scope selector data ───────────────────────────────────────────────

export interface ReportProject {
  id: string;
  name: string;
  status: string;
  code: string;          // human-facing identifier (slug)
  projectType: string | null;
}

/**
 * Projects the current user can run reports against. Org-scoped via
 * getOrgContext, so only the caller's organization is ever returned — no
 * unauthorized projects are exposed.
 */
export async function listProjectsForReportsAction(
  locale = "en",
): Promise<{ error?: string; projects?: ReportProject[] }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title_i18n, slug, status, project_type")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return { error: "unexpected" };
  const projects: ReportProject[] = (data ?? []).map((p) => ({
    id: p.id,
    name: getI18nValue(p.title_i18n as I18nField, locale as "en" | "es") || p.slug,
    status: p.status,
    code: p.slug,
    projectType: p.project_type ?? null,
  }));
  return { projects };
}

// ── Run a report config ─────────────────────────────────────────────────────

export async function runReportAction(input: {
  config: ReportConfig;
  projectId?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<{ error?: string; details?: string[]; result?: ReportResult }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const config = sanitizeConfig(input.config);
  if (!config) return { error: "invalid_config" };

  const supabase = createAdminClient();
  if (input.projectId && !(await assertProjectInOrg(supabase, org.organizationId, input.projectId))) {
    return { error: "project_not_found" };
  }

  const result = await runReport(
    config,
    { organizationId: org.organizationId, projectId: input.projectId ?? null },
    { page: input.page ?? 1, pageSize: Math.min(input.pageSize ?? 100, 200) },
  );
  if ("error" in result) return { error: result.error, details: result.details };

  // Fire-and-forget run log
  supabase.from("report_runs").insert({
    organization_id: org.organizationId,
    project_id: input.projectId ?? null,
    dataset_id: config.datasetId,
    run_status: "completed",
    row_count: result.totalRows,
    run_duration_ms: result.durationMs,
    executed_by: org.userId,
  }).then(() => {}, () => {});

  return { result };
}

// ── Export CSV ────────────────────────────────────────────────────────────────

export async function exportReportCsvAction(input: {
  config: ReportConfig;
  projectId?: string | null;
  reportName?: string;
}): Promise<{ error?: string; csv?: string; fileName?: string; rowCount?: number }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const config = sanitizeConfig(input.config);
  if (!config) return { error: "invalid_config" };

  const supabase = createAdminClient();
  if (input.projectId && !(await assertProjectInOrg(supabase, org.organizationId, input.projectId))) {
    return { error: "project_not_found" };
  }

  const out = await runReportForExport(config, { organizationId: org.organizationId, projectId: input.projectId ?? null });
  if ("error" in out) return { error: out.error };

  const csv = rowsToCsv(out.rows, out.columns);
  const safeName = (input.reportName || getDataset(config.datasetId)?.displayName || "report").replace(/[^\w-]+/g, "_").toLowerCase();
  const fileName = `${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;

  supabase.from("report_exports").insert({
    organization_id: org.organizationId,
    project_id: input.projectId ?? null,
    report_name: input.reportName || getDataset(config.datasetId)?.displayName,
    export_format: "csv",
    row_count: out.rows.length,
    status: "completed",
    exported_by: org.userId,
  }).then(() => {}, () => {});

  return { csv, fileName, rowCount: out.rows.length };
}

// ── AI-suggested calculated field ─────────────────────────────────────────────

/**
 * Ask the AI to turn a plain-language description into a calculated-field
 * formula over the dataset's numeric columns. The AI only produces the formula
 * text — it is validated and evaluated by the deterministic engine, never run
 * as code. Degrades gracefully when no AI provider is configured.
 */
export async function suggestCalculatedFieldAction(input: {
  datasetId: string;
  prompt: string;
}): Promise<{ error?: string; label?: string; expression?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const dataset = getDataset(input.datasetId);
  if (!dataset) return { error: "unknown_dataset" };
  if (!input.prompt || input.prompt.length > 500) return { error: "invalid_prompt" };
  if (!process.env.OPENAI_API_KEY) return { error: "ai_not_configured" };

  const numericCols = dataset.columns.filter((c) => c.type === "number");
  const numericKeys = new Set(numericCols.map((c) => c.key));
  const colList = numericCols.map((c) => `${c.key} (${c.label})`).join(", ");

  const aiPrompt = `You define a calculated field for a project report. Available NUMERIC columns (use these exact keys): ${colList}.
Allowed syntax: + - * / %, parentheses, and functions round(x[,n]), abs(x), min(...), max(...), coalesce(...), if(cond,a,b) with comparisons > < >= <= == !=. Only reference the column keys above. Do NOT invent columns.
Return strict JSON: { "label": "<short human label>", "expression": "<formula>" }.
Request: ${input.prompt}`;

  try {
    const res = await runAi(org, { promptType: "custom", templateVars: { prompt: aiPrompt }, temperature: 0.1 });
    if (res.status !== "completed" || !res.parsedJson) return { error: "ai_failed" };
    const label = typeof res.parsedJson.label === "string" ? res.parsedJson.label.slice(0, 80) : "";
    const expression = typeof res.parsedJson.expression === "string" ? res.parsedJson.expression.slice(0, 500) : "";
    if (!expression) return { error: "ai_failed" };
    const v = validateFormula(expression, numericKeys);
    if (!v.ok) return { error: "ai_invalid_formula" };
    return { label: label || "AI field", expression };
  } catch {
    return { error: "ai_failed" };
  }
}

// ── Saved reports ──────────────────────────────────────────────────────────

const saveSchema = z.object({
  reportName: z.string().min(1, "nameRequired").max(160).transform((s) => s.trim()),
  description: z.string().max(2000).optional().default(""),
  category: z.string().max(40).optional().default(""),
  visibility: z.enum(["private", "project", "organization"]).default("private"),
  projectId: z.string().uuid().nullable().optional(),
});

export interface SavedReportRow {
  id: string;
  report_name: string;
  report_description: string | null;
  dataset_id: string;
  category: string | null;
  visualization_type: VisualizationType;
  columns_json: string[];
  filters_json: ReportConfig["filters"];
  grouping_json: ReportConfig["grouping"];
  sorting_json: ReportConfig["sort"];
  calculated_fields_json: NonNullable<ReportConfig["calculatedFields"]>;
  visibility: "private" | "project" | "organization";
  project_id: string | null;
  created_by: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function saveReportAction(input: {
  config: ReportConfig;
  reportName: string;
  description?: string;
  category?: string;
  visibility?: string;
  projectId?: string | null;
}): Promise<{ error?: string; reportId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const config = sanitizeConfig(input.config);
  if (!config) return { error: "invalid_config" };
  const meta = saveSchema.safeParse(input);
  if (!meta.success) return { error: meta.error.issues[0]?.message ?? "validation_error" };
  const d = meta.data;

  const supabase = createAdminClient();
  if (d.projectId && !(await assertProjectInOrg(supabase, org.organizationId, d.projectId))) {
    return { error: "project_not_found" };
  }

  const { data: row, error } = await supabase
    .from("saved_reports")
    .insert({
      organization_id: org.organizationId,
      project_id: d.projectId ?? null,
      report_name: d.reportName,
      report_description: d.description || null,
      dataset_id: config.datasetId,
      category: d.category || getDataset(config.datasetId)?.category || null,
      visualization_type: config.visualization,
      columns_json: config.columns,
      filters_json: config.filters,
      grouping_json: config.grouping,
      sorting_json: config.sort,
      calculated_fields_json: config.calculatedFields ?? [],
      visibility: d.visibility,
      created_by: org.userId,
    })
    .select("id")
    .single();
  if (error || !row) return { error: "unexpected" };

  await logAudit({ org, projectId: d.projectId ?? undefined, action: "create", entityType: "saved_reports", entityId: row.id, metadata: { name: d.reportName, dataset: config.datasetId } });
  revalidatePath("/(app)/reports", "page");
  return { reportId: row.id };
}

export async function listSavedReportsAction(): Promise<{ error?: string; reports?: SavedReportRow[] }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("saved_reports")
    .select("*")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  return { reports: (data ?? []) as SavedReportRow[] };
}

export async function deleteSavedReportAction(input: { reportId: string }): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!z.string().uuid().safeParse(input.reportId).success) return { error: "validation_error" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("saved_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.reportId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };
  revalidatePath("/(app)/reports", "page");
  return {};
}

export async function duplicateSavedReportAction(input: { reportId: string }): Promise<{ error?: string; reportId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const { data: src } = await supabase
    .from("saved_reports").select("*").eq("id", input.reportId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!src) return { error: "not_found" };
  const { data: row, error } = await supabase
    .from("saved_reports")
    .insert({
      organization_id: org.organizationId,
      project_id: src.project_id,
      report_name: `${src.report_name} (copy)`,
      report_description: src.report_description,
      dataset_id: src.dataset_id,
      category: src.category,
      visualization_type: src.visualization_type,
      columns_json: src.columns_json,
      filters_json: src.filters_json,
      grouping_json: src.grouping_json,
      sorting_json: src.sorting_json,
      calculated_fields_json: src.calculated_fields_json ?? [],
      visibility: src.visibility,
      created_by: org.userId,
    })
    .select("id")
    .single();
  if (error || !row) return { error: "unexpected" };
  revalidatePath("/(app)/reports", "page");
  return { reportId: row.id };
}
