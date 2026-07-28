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
        _projectId: p.id,
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

interface TaskExecutionSubtaskRow {
  id: string;
  task_id: string;
  project_id: string;
  title: string;
  status: string;
  priority: string;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  progress: number | null;
  is_critical: boolean | null;
  blocked_reason: string | null;
  sort_order: number | null;
}

const RISK_SEVERITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const OPEN_RISK_STATUS = new Set(["open", "mitigating"]);
const DAY_MS = 86_400_000;

/** Whole days between two YYYY-MM-DD dates, DST-safe (UTC midnight arithmetic). */
function dayDiff(from: string | null, to: string | null): number | null {
  const a = from ? Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`) : NaN;
  const b = to ? Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`) : NaN;
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

async function fetchTaskExecution(supabase: Admin, ctx: QueryContext, config: ReportConfig): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const [{ data: tasks }, { data: milestones }, { data: resources }] = await Promise.all([
    scope(supabase.from("roadmap_tasks").select("id, title, status, priority, milestone_id, assigned_to, assigned_resource_id, trade_key, discipline, start_date, end_date, completed_at, duration_days, progress, is_blocked, blocker_reason, is_critical, slack_days, estimated_labor_hours, estimate_hours, actual_hours, project_id").is("deleted_at", null).limit(ROW_CAP), ctx.organizationId, ctx.projectId),
    supabase.from("milestones").select("id, title").eq("organization_id", ctx.organizationId).is("deleted_at", null),
    supabase.from("resources").select("id, name").eq("organization_id", ctx.organizationId).is("deleted_at", null),
  ]);

  const validTasks = (tasks ?? []).filter((task) => task.project_id != null && projects.has(task.project_id));

  // Subtasks are fetched before owner names so their assignees are resolved too.
  const subtasksByTask = new Map<string, TaskExecutionSubtaskRow[]>();
  if (config.includeSubtasks && validTasks.length > 0) {
    const { data: subtasksData } = await scope(
      supabase
        .from("task_subtasks")
        .select("id, task_id, project_id, title, status, priority, owner_id, start_date, due_date, estimated_hours, progress, is_critical, blocked_reason, sort_order")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .limit(ROW_CAP),
      ctx.organizationId,
      ctx.projectId,
    );
    const validTaskIds = new Set(validTasks.map((task) => task.id));
    for (const subtask of (subtasksData ?? []) as TaskExecutionSubtaskRow[]) {
      if (!validTaskIds.has(subtask.task_id)) continue;
      const siblings = subtasksByTask.get(subtask.task_id) ?? [];
      siblings.push(subtask);
      subtasksByTask.set(subtask.task_id, siblings);
    }
  }

  // Owner names are resolved from the ids these already-org-scoped rows
  // reference. Selecting profiles by `organization_id` instead silently dropped
  // every assignee whose home org differs from the project's org (multi-org
  // members), which made any Owner filter return zero rows (REG-038).
  const ownerIds = [...new Set([
    ...validTasks.map((task) => task.assigned_to),
    ...[...subtasksByTask.values()].flat().map((subtask) => subtask.owner_id),
  ].filter((id): id is string => !!id))];
  const { data: profiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const [{ data: risks }, { data: dependencies }] = validTasks.length
    ? await Promise.all([
        scope(supabase.from("risks").select("linked_task_id, severity, status").is("deleted_at", null).not("linked_task_id", "is", null).limit(ROW_CAP), ctx.organizationId, ctx.projectId),
        scope(supabase.from("task_dependencies").select("successor_id, predecessor_id").limit(ROW_CAP * 4), ctx.organizationId, ctx.projectId),
      ])
    : [{ data: [] as { linked_task_id: string; severity: string | null; status: string }[] }, { data: [] as { successor_id: string; predecessor_id: string }[] }];

  const msName = new Map((milestones ?? []).map((m) => [m.id, m.title]));
  const personName = new Map((profiles ?? []).map((p) => [p.id, p.display_name || ""]));
  const resName = new Map((resources ?? []).map((r) => [r.id, r.name]));

  const riskByTask = new Map<string, { open: number; topRank: number }>();
  for (const r of risks ?? []) {
    if (!r.linked_task_id || !OPEN_RISK_STATUS.has(r.status)) continue;
    const entry = riskByTask.get(r.linked_task_id) ?? { open: 0, topRank: 0 };
    entry.open++;
    entry.topRank = Math.max(entry.topRank, RISK_SEVERITY_RANK[r.severity ?? ""] ?? 0);
    riskByTask.set(r.linked_task_id, entry);
  }

  const depCount = new Map<string, number>();
  for (const d of dependencies ?? []) {
    if (!d.successor_id) continue;
    depCount.set(d.successor_id, (depCount.get(d.successor_id) ?? 0) + 1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const severityLabel = (rank: number) => Object.keys(RISK_SEVERITY_RANK).find((k) => RISK_SEVERITY_RANK[k] === rank) ?? "";

  /** Days past a planned finish: 0 when on time, null when there is no date. */
  const lateness = (plannedFinish: string | null, done: boolean, completedAt: string | null): number | null => {
    if (!plannedFinish) return null;
    const ref = done ? (completedAt ? String(completedAt).slice(0, 10) : null) : today;
    const diff = ref ? dayDiff(plannedFinish, ref) : null;
    return diff === null ? null : Math.max(0, diff);
  };

  const taskRows = validTasks.map((task) => {
    const estimated = task.estimated_labor_hours != null ? Number(task.estimated_labor_hours)
      : task.estimate_hours != null ? Number(task.estimate_hours) : null;
    const actual = task.actual_hours != null ? Number(task.actual_hours) : null;
    const risk = riskByTask.get(task.id);
    const deps = depCount.get(task.id) ?? 0;
    return {
      task,
      row: {
        project_name: projects.get(task.project_id!) ?? "—",
        _projectId: task.project_id ?? null,
        _recordId: task.id,
        _rowKind: "task",
        milestone: task.milestone_id ? msName.get(task.milestone_id) ?? "—" : "—",
        record_type: "task",
        parent_task: "",
        task_name: task.title,
        status: task.status,
        priority: task.priority,
        owner: task.assigned_to ? personName.get(task.assigned_to) ?? "" : task.assigned_resource_id ? resName.get(task.assigned_resource_id) ?? "" : "",
        owner_id: task.assigned_to ?? task.assigned_resource_id ?? "",
        trade: task.trade_key ?? "",
        discipline: task.discipline ?? "",
        planned_start: task.start_date,
        planned_finish: task.end_date,
        duration_days: task.duration_days,
        days_late: lateness(task.end_date, DONE.has(task.status), task.completed_at ?? null),
        progress_pct: task.progress ?? 0,
        blocked: task.status === "blocked" || !!task.is_blocked,
        blocker_reason: task.blocker_reason ?? "",
        critical_path: !!task.is_critical,
        total_float: task.slack_days,
        estimated_hours: estimated,
        actual_hours: actual,
        hours_variance: estimated !== null && actual !== null ? Math.round((actual - estimated) * 100) / 100 : null,
        hours_variance_pct: estimated !== null && actual !== null && estimated > 0
          ? Math.round(((actual - estimated) / estimated) * 10000) / 100
          : null,
        open_risks: risk?.open ?? 0,
        risk_severity: severityLabel(risk?.topRank ?? 0),
        dependency_count: deps,
        has_dependencies: deps > 0,
      } as ReportRow,
    };
  });

  if (!config.includeSubtasks || validTasks.length === 0) return taskRows.map(({ row }) => row);

  return taskRows.flatMap(({ task, row }) => {
    const children = (subtasksByTask.get(task.id) ?? []).map((subtask) => ({
      project_name: row.project_name,
      _projectId: subtask.project_id,
      _recordId: task.id,
      _subtaskId: subtask.id,
      _rowKind: "subtask",
      milestone: row.milestone,
      record_type: "subtask",
      parent_task: task.title,
      task_name: subtask.title,
      status: subtask.status,
      priority: subtask.priority,
      owner: subtask.owner_id ? personName.get(subtask.owner_id) ?? "" : "",
      owner_id: subtask.owner_id ?? "",
      trade: row.trade,
      discipline: row.discipline,
      planned_start: subtask.start_date,
      planned_finish: subtask.due_date,
      duration_days: null,
      days_late: lateness(subtask.due_date, DONE.has(subtask.status), null),
      progress_pct: subtask.progress ?? 0,
      blocked: subtask.status === "blocked",
      blocker_reason: subtask.blocked_reason ?? "",
      critical_path: !!subtask.is_critical,
      total_float: null,
      estimated_hours: subtask.estimated_hours,
      // Subtasks carry no effort actuals, linked risks or dependencies of their own.
      actual_hours: null,
      hours_variance: null,
      hours_variance_pct: null,
      open_risks: 0,
      risk_severity: "",
      dependency_count: 0,
      has_dependencies: false,
    } as ReportRow));
    return [row, ...children];
  }).slice(0, ROW_CAP);
}

async function fetchBudget(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase.from("budget_items").select("name, category, cost_code, estimated_cost, committed_cost, actual_cost, forecast_cost, status, project_id").is("deleted_at", null).limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).filter((b) => b.project_id != null && projects.has(b.project_id)).map((b) => {
    const est = Number(b.estimated_cost ?? 0);
    const fc = b.forecast_cost != null ? Number(b.forecast_cost) : Number(b.actual_cost ?? 0);
    const variance = Math.round((fc - est) * 100) / 100;
    return {
      project_name: projects.get(b.project_id) ?? "—",
      _projectId: b.project_id ?? null,
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

async function fetchFinancialControl(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const fromView = supabase.from as unknown as (table: string) => {
    select: (columns: string) => unknown;
  };
  const query = fromView("financial_project_cockpit").select("*");
  const { data } = await scope(
    query,
    ctx.organizationId,
    ctx.projectId,
  ) as unknown as {
    data: Array<Record<string, string | number | null>> | null;
  };
  const numberOrNull = (value: string | number | null | undefined) =>
    value == null ? null : Number(value);
  return (data ?? [])
    .filter((row) => typeof row.project_id === "string" && projects.has(row.project_id))
    .map((row) => ({
      project_name: projects.get(String(row.project_id)) ?? "—",
      _projectId: String(row.project_id),
      currency: String(row.currency ?? "USD"),
      original_budget: numberOrNull(row.original_budget),
      current_baseline: numberOrNull(row.current_baseline),
      authorized_funding: numberOrNull(row.authorized_funding),
      released_funding: numberOrNull(row.released_funding),
      current_commitment: numberOrNull(row.current_commitment),
      outstanding_commitment: numberOrNull(row.outstanding_commitment),
      actual_cost: numberOrNull(row.actual_cost),
      open_accrual: numberOrNull(row.open_accrual),
      settled_payments: numberOrNull(row.settled_payments),
      remaining_reserve: numberOrNull(row.remaining_reserve),
      approved_changes_not_posted: numberOrNull(row.approved_changes_not_posted),
      latest_eac: numberOrNull(row.latest_eac),
      p50_eac: numberOrNull(row.p50_eac),
      p80_eac: numberOrNull(row.p80_eac),
      cpi: numberOrNull(row.cpi),
      spi: numberOrNull(row.spi),
      quality_status: String(row.quality_status ?? "insufficient_inputs"),
      pending_approvals: numberOrNull(row.pending_approvals),
      reconciliation_exceptions: numberOrNull(row.reconciliation_exceptions),
      unverified_actuals: numberOrNull(row.unverified_actuals),
      currency_mismatches: numberOrNull(row.currency_mismatches),
      data_date: row.data_date == null ? null : String(row.data_date),
    } as ReportRow));
}

async function fetchRisks(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase.from("risks").select("title, category, probability, impact, severity, status, mitigation_plan, origin, confidence_score, needs_review, project_id").is("deleted_at", null).limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).filter((r) => r.project_id != null && projects.has(r.project_id)).map((r) => ({
    project_name: projects.get(r.project_id) ?? "—",
    _projectId: r.project_id ?? null,
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
  return (data ?? []).filter((m) => m.project_id != null && projects.has(m.project_id)).map((m) => ({
    project_name: projects.get(m.project_id) ?? "—",
    _projectId: m.project_id ?? null,
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
  return (data ?? []).filter((r) => r.project_id != null && projects.has(r.project_id)).map((r) => ({
    project_name: projects.get(r.project_id) ?? "—",
    _projectId: r.project_id ?? null,
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

async function fetchProjectMemory(supabase: Admin, ctx: QueryContext): Promise<ReportRow[]> {
  const projects = await projectNameMap(supabase, ctx.organizationId);
  const { data } = await scope(
    supabase
      .from("project_memory_items")
      .select("title, source_type, importance_level, sentiment, author_name, occurred_at, ai_classification, project_id")
      .is("deleted_at", null)
      .limit(ROW_CAP),
    ctx.organizationId, ctx.projectId,
  );
  return (data ?? []).filter((m) => m.project_id != null && projects.has(m.project_id)).map((m) => {
    const ai = (m.ai_classification ?? {}) as Record<string, unknown>;
    const flag = (k: string) => ai[k] === true;
    return {
      project_name: projects.get(m.project_id) ?? "—",
      _projectId: m.project_id ?? null,
      title: m.title,
      source_type: m.source_type,
      importance_level: m.importance_level,
      sentiment: m.sentiment ?? (typeof ai.sentiment === "string" ? ai.sentiment : null),
      author: m.author_name ?? "",
      occurred_at: m.occurred_at,
      contains_decision: flag("contains_decision"),
      contains_risk: flag("contains_risk"),
      contains_action_item: flag("contains_action_item"),
      contains_scope_change: flag("contains_scope_change"),
      contains_schedule_impact: flag("contains_schedule_impact"),
      contains_cost_impact: flag("contains_cost_impact"),
      contains_stakeholder_concern: flag("contains_stakeholder_concern"),
      ai_confidence_pct: typeof ai.confidence === "number" ? Math.round(ai.confidence * 100) : null,
    } as ReportRow;
  });
}

const FETCHERS: Record<string, (s: Admin, c: QueryContext, config: ReportConfig) => Promise<ReportRow[]>> = {
  project_health: fetchProjectHealth,
  task_execution: fetchTaskExecution,
  budget_performance: fetchBudget,
  financial_control: fetchFinancialControl,
  risk_register: fetchRisks,
  material_requirements: fetchMaterials,
  rfi_log: fetchRfis,
  project_memory: fetchProjectMemory,
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
  const rawRows = await fetcher(supabase, ctx, config);
  const truncated = rawRows.length >= ROW_CAP;
  const allRows = applyCalculated(rawRows, calcFields);

  // Filter → sort (calculated columns participate)
  const filtered = applySort(applyFilters(allRows, config.filters, effectiveColumns), config.sort, effectiveColumns);

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
  // A single page of ROW_CAP already IS every filtered row, so one run is enough.
  const result = await runReport(config, ctx, { page: 1, pageSize: ROW_CAP });
  if ("error" in result) return result;
  return { rows: result.rows, columns: result.columns };
}
