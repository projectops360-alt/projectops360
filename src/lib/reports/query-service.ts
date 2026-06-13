// ============================================================================
// ProjectOps360° — Report Query Service (server-only)
// ============================================================================
// Fetches business-friendly rows for a curated dataset, always scoped to the
// caller's organization (and optionally a project), then runs the pure
// filter/sort/group engine. The Report Builder never reaches raw tables — it
// only calls runReport() with a dataset id + config.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getDataset } from "./registry";
import { applyFilters, applySort, applyGrouping, validateFilters } from "./filter-engine";
import { evaluateFormula, validateFormula } from "./formula";
import type { ReportConfig, ReportResult, ReportRow, DatasetColumn, CalculatedField } from "./types";

const ROW_CAP = 5000;
const DONE = new Set(["done", "tested"]);

type Admin = ReturnType<typeof createAdminClient>;

export interface QueryContext {
  organizationId: string;
  projectId?: string | null;
}

// ── Shared lookups ────────────────────────────────────────────────────────────

async function projectNameMap(supabase: Admin, organizationId: string, locale = "en"): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("projects")
    .select("id, title_i18n, slug")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const t = p.title_i18n as Record<string, string> | null;
    map.set(p.id, t?.[locale] ?? t?.en ?? p.slug);
  }
  return map;
}

function scope<T>(q: T, organizationId: string, projectId: string | null | undefined, projectCol = "project_id"): T {
  // PostgREST builder — chained eq() calls. Always org-scoped.
  let b = (q as { eq: (c: string, v: string) => unknown }).eq("organization_id", organizationId);
  if (projectId) b = (b as { eq: (c: string, v: string) => unknown }).eq(projectCol, projectId);
  return b as T;
}

// ── Per-dataset fetchers (db → business rows) ─────────────────────────────────

async function fetchProjectHealth(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title_i18n, slug, project_type, status, start_date, target_end_date")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  const ids = (projects ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const [{ data: tasks }, { data: risks }, { data: rfis }] = await Promise.all([
    supabase.from("roadmap_tasks").select("project_id, status").eq("organization_id", ctx.organizationId).is("deleted_at", null),
    supabase.from("risks").select("project_id, status").eq("organization_id", ctx.organizationId).is("deleted_at", null),
    supabase.from("rfis").select("project_id, status").eq("organization_id", ctx.organizationId).is("deleted_at", null),
  ]);

  const agg = new Map<string, { total: number; done: number; blocked: number; risks: number; rfis: number }>();
  const get = (id: string) => {
    if (!agg.has(id)) agg.set(id, { total: 0, done: 0, blocked: 0, risks: 0, rfis: 0 });
    return agg.get(id)!;
  };
  for (const t of tasks ?? []) { const a = get(t.project_id); a.total++; if (DONE.has(t.status)) a.done++; if (t.status === "blocked") a.blocked++; }
  for (const r of risks ?? []) { if (["open", "mitigating"].includes(r.status)) get(r.project_id).risks++; }
  for (const r of rfis ?? []) { if (["draft", "open"].includes(r.status)) get(r.project_id).rfis++; }

  return (projects ?? [])
    .filter((p) => !ctx.projectId || p.id === ctx.projectId)
    .map((p) => {
      const t = p.title_i18n as Record<string, string> | null;
      const a = agg.get(p.id) ?? { total: 0, done: 0, blocked: 0, risks: 0, rfis: 0 };
      return {
        project_name: t?.en ?? p.slug,
        project_type: p.project_type ?? "general",
        status: p.status,
        start_date: p.start_date,
        target_finish: p.target_end_date,
        progress_pct: a.total > 0 ? Math.round((a.done / a.total) * 100) : 0,
        total_tasks: a.total,
        done_tasks: a.done,
        blocked_tasks: a.blocked,
        open_risks: a.risks,
        open_rfis: a.rfis,
      } as ReportRow;
    });
}

async function fetchTaskExecution(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const [{ data: tasks }, { data: milestones }, { data: profiles }, { data: resources }] = await Promise.all([
    scope(supabase.from("roadmap_tasks").select("id, title, status, priority, milestone_id, assigned_to, assigned_resource_id, trade_key, discipline, start_date, end_date, duration_days, progress, is_blocked, blocker_reason, is_critical, slack_days, estimated_labor_hours, project_id").is("deleted_at", null).limit(ROW_CAP), ctx.organizationId, ctx.projectId),
    supabase.from("milestones").select("id, title").eq("organization_id", ctx.organizationId).is("deleted_at", null),
    supabase.from("profiles").select("id, display_name").eq("organization_id", ctx.organizationId),
    supabase.from("resources").select("id, name").eq("organization_id", ctx.organizationId).is("deleted_at", null),
  ]);
  const msName = new Map((milestones ?? []).map((m) => [m.id, m.title]));
  const personName = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "—"]));
  const resName = new Map((resources ?? []).map((r) => [r.id, r.name]));

  return (tasks ?? []).map((t) => ({
    project_name: projects.get(t.project_id) ?? "—",
    milestone: t.milestone_id ? msName.get(t.milestone_id) ?? "—" : "—",
    task_name: t.title,
    status: t.status,
    priority: t.priority,
    owner: t.assigned_to ? personName.get(t.assigned_to) ?? "" : t.assigned_resource_id ? resName.get(t.assigned_resource_id) ?? "" : "",
    trade: t.trade_key ?? "",
    discipline: t.discipline ?? "",
    planned_start: t.start_date,
    planned_finish: t.end_date,
    duration_days: t.duration_days,
    progress_pct: t.progress ?? 0,
    blocked: t.status === "blocked" || !!t.is_blocked,
    blocker_reason: t.blocker_reason ?? "",
    critical_path: !!t.is_critical,
    total_float: t.slack_days,
    estimated_hours: t.estimated_labor_hours,
  } as ReportRow));
}

async function fetchBudget(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase.from("budget_items").select("name, category, cost_code, estimated_cost, committed_cost, actual_cost, forecast_cost, status, project_id").is("deleted_at", null).limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).map((b) => {
    const est = Number(b.estimated_cost ?? 0);
    const fc = b.forecast_cost != null ? Number(b.forecast_cost) : Number(b.actual_cost ?? 0);
    const variance = Math.round((fc - est) * 100) / 100;
    return {
      project_name: projects.get(b.project_id) ?? "—",
      budget_item: b.name,
      category: b.category,
      cost_code: b.cost_code ?? "",
      estimated_cost: est,
      committed_cost: Number(b.committed_cost ?? 0),
      actual_cost: Number(b.actual_cost ?? 0),
      forecast_cost: b.forecast_cost != null ? Number(b.forecast_cost) : null,
      variance,
      variance_pct: est > 0 ? Math.round((variance / est) * 10000) / 100 : null,
      budget_status: b.status,
    } as ReportRow;
  });
}

async function fetchRisks(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase.from("risks").select("title, category, probability, impact, severity, status, mitigation_plan, origin, confidence_score, needs_review, project_id").is("deleted_at", null).limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).map((r) => ({
    project_name: projects.get(r.project_id) ?? "—",
    risk_title: r.title,
    category: r.category,
    probability: r.probability,
    impact: r.impact,
    severity: r.severity,
    status: r.status,
    mitigation: r.mitigation_plan ?? "",
    ai_generated: r.origin !== "manual" && r.origin !== "import",
    confidence_pct: r.confidence_score != null ? Math.round(Number(r.confidence_score) * 100) : null,
    needs_review: !!r.needs_review,
  } as ReportRow));
}

async function fetchMaterials(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase.from("material_requirements").select("name, quantity, unit_of_measure, estimated_total_cost, status, lead_time_days, required_by_date, origin, confidence_score, needs_review, project_id").is("deleted_at", null).limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).map((m) => ({
    project_name: projects.get(m.project_id) ?? "—",
    material_name: m.name,
    quantity: m.quantity != null ? Number(m.quantity) : null,
    unit: m.unit_of_measure ?? "",
    estimated_total_cost: m.estimated_total_cost != null ? Number(m.estimated_total_cost) : null,
    status: m.status,
    lead_time_days: m.lead_time_days,
    required_by_date: m.required_by_date,
    origin: m.origin,
    confidence_pct: m.confidence_score != null ? Math.round(Number(m.confidence_score) * 100) : null,
    needs_review: !!m.needs_review,
  } as ReportRow));
}

async function fetchRfis(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase.from("rfis").select("rfi_number, subject, status, priority, due_date, blocks_task_id, origin, needs_review, project_id").is("deleted_at", null).limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).map((r) => ({
    project_name: projects.get(r.project_id) ?? "—",
    rfi_number: r.rfi_number ?? "",
    subject: r.subject,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    blocks_work: !!r.blocks_task_id && ["draft", "open"].includes(r.status),
    origin: r.origin,
    needs_review: !!r.needs_review,
  } as ReportRow));
}

const FETCHERS: Record<string, (s: Admin, c: QueryContext) => Promise<ReportRow[]>> = {
  project_health: fetchProjectHealth,
  task_execution: fetchTaskExecution,
  budget_performance: fetchBudget,
  risk_register: fetchRisks,
  material_requirements: fetchMaterials,
  rfi_log: fetchRfis,
};

// ── Calculated fields ─────────────────────────────────────────────────────────

/** Turn calculated-field definitions into number columns + validate them. */
function buildCalcColumns(dataset: ReturnType<typeof getDataset>, fields: CalculatedField[]): { calcCols: DatasetColumn[]; error?: string } {
  if (!dataset || fields.length === 0) return { calcCols: [] };
  // Identifiers may reference numeric dataset columns OR earlier calculated fields.
  const numericKeys = new Set(dataset.columns.filter((c) => c.type === "number").map((c) => c.key));
  const calcCols: DatasetColumn[] = [];
  for (const f of fields) {
    const v = validateFormula(f.expression, numericKeys);
    if (!v.ok) return { calcCols: [], error: `"${f.label}": ${v.error}` };
    numericKeys.add(f.key); // allow chaining
    calcCols.push({ key: f.key, label: f.label, group: "Calculated", type: "number", filterable: true, sortable: true, aggregatable: true, description: f.expression });
  }
  return { calcCols };
}

/** Add computed values to each row, in field order (supports chaining). */
function applyCalculated(rows: ReportRow[], fields: CalculatedField[]): ReportRow[] {
  if (fields.length === 0) return rows;
  return rows.map((row) => {
    const r: ReportRow = { ...row };
    for (const f of fields) r[f.key] = evaluateFormula(f.expression, r);
    return r;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RunReportError {
  error: string;
  details?: string[];
}

/** Run a report config against a dataset, scoped to org/project. */
export async function runReport(
  config: ReportConfig,
  ctx: QueryContext,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 100 },
): Promise<ReportResult | RunReportError> {
  const started = Date.now();
  const dataset = getDataset(config.datasetId);
  if (!dataset) return { error: "unknown_dataset" };

  const calcFields = config.calculatedFields ?? [];
  const { calcCols, error: calcError } = buildCalcColumns(dataset, calcFields);
  if (calcError) return { error: "invalid_formula", details: [calcError] };
  const effectiveColumns = [...dataset.columns, ...calcCols];

  const colErrors = validateFilters(config.filters, effectiveColumns);
  if (colErrors.length > 0) return { error: "invalid_filters", details: colErrors.map((e) => e.message) };

  const fetcher = FETCHERS[config.datasetId];
  if (!fetcher) return { error: "dataset_not_implemented" };

  const supabase = createAdminClient();
  const rawRows = await fetcher(supabase, ctx);
  const truncated = rawRows.length >= ROW_CAP;
  const allRows = applyCalculated(rawRows, calcFields);

  // Filter → sort (calculated columns participate)
  const filtered = applySort(applyFilters(allRows, config.filters), config.sort, effectiveColumns);

  // Selected columns metadata (preserve order, fall back to defaults)
  const selected = config.columns.length > 0
    ? (config.columns.map((k) => effectiveColumns.find((c) => c.key === k)).filter(Boolean) as DatasetColumn[])
    : dataset.columns.filter((c) => dataset.defaultColumns.includes(c.key));

  let grouped: ReportRow[] | undefined;
  if (config.grouping) grouped = applyGrouping(filtered, config.grouping);

  const totalRows = filtered.length;
  const start = (pagination.page - 1) * pagination.pageSize;
  const pageRows = filtered.slice(start, start + pagination.pageSize);

  return { columns: selected, rows: pageRows, totalRows, grouped, durationMs: Date.now() - started, truncated };
}

/** Run and return ALL filtered rows (for CSV export, capped at ROW_CAP). */
export async function runReportForExport(config: ReportConfig, ctx: QueryContext): Promise<{ rows: ReportRow[]; columns: DatasetColumn[] } | RunReportError> {
  const result = await runReport(config, ctx, { page: 1, pageSize: ROW_CAP });
  if ("error" in result) return result;
  const dataset = getDataset(config.datasetId)!;
  const fetcher = FETCHERS[config.datasetId]!;
  const calcFields = config.calculatedFields ?? [];
  const { calcCols } = buildCalcColumns(dataset, calcFields);
  const effectiveColumns = [...dataset.columns, ...calcCols];
  const supabase = createAdminClient();
  const allRows = applyCalculated(await fetcher(supabase, ctx), calcFields);
  const filtered = applySort(applyFilters(allRows, config.filters), config.sort, effectiveColumns);
  return { rows: filtered, columns: result.columns };
}
