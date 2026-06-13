// ============================================================================
// ProjectOps360° — PMO Command Center service (server-only)
// ============================================================================
// Aggregates real, org-scoped execution data into the Command Center model.
// No fabricated data: sections compute from live tables and return empty when
// there is nothing, so the UI can show honest empty states.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { I18nField } from "@/types/database";

const DONE = new Set(["done", "tested"]);
const STARTED = new Set(["prompt_ready", "sent_to_ai", "in_progress", "implemented"]);

export type HealthBand = "green" | "amber" | "red";
export function band(score: number): HealthBand {
  return score >= 80 ? "green" : score >= 60 ? "amber" : "red";
}

export interface HealthDimension { key: string; score: number }
export interface PortfolioHealth {
  overall: number;
  dimensions: HealthDimension[];
  derivedFrom: string;
}

export interface KpiCard {
  key: string;
  value: string;
  subtitle: string;
  tone: "green" | "blue" | "amber" | "red" | "purple";
}

export type Severity = "critical" | "high" | "review" | "ready" | "info";
export interface FocusItem { id: string; title: string; explanation: string; severity: Severity; project: string | null; action: string }
export interface AiRecommendation { id: string; title: string; explanation: string; confidence: number | null; impact: string; action: string; status: string }
export interface CriticalPathItem { order: number; task: string; project: string; status: string; risk: HealthBand; blocker: string | null; float: number | null }
export interface DecisionItem { id: string; title: string; impact: string; project: string | null; status: string }
export interface ResourceRow { name: string; type: string; trade: string | null; utilization: number | null; status: string; assignedTasks: number }
export interface MaterialRow { name: string; quantity: string; project: string; requiredBy: string | null; confidence: number | null; status: string; needsReview: boolean }
export interface GraphSignal { key: string; value: number; label: string }
export interface LookaheadItem { date: string; event: string; project: string; impact: string; kind: "milestone" | "task" }
export interface BudgetSignal { area: string; project: string; estimate: number; forecast: number; variance: number; signal: string }
export interface ActivityItem { id: string; event: string; entity: string; at: string; source: string }

export interface CommandCenterData {
  hasProjects: boolean;
  hasGraph: boolean;
  portfolioHealth: PortfolioHealth;
  kpis: KpiCard[];
  pmoFocus: FocusItem[];
  aiRecommendations: AiRecommendation[];
  criticalPath: CriticalPathItem[];
  decisionQueue: DecisionItem[];
  resourceCapacity: ResourceRow[];
  materialProcurementRisk: MaterialRow[];
  livingGraphSignals: GraphSignal[];
  upcomingLookahead: LookaheadItem[];
  budgetForecastSignals: BudgetSignal[];
  recentActivity: ActivityItem[];
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }

export async function getCommandCenterSummary(organizationId: string, locale = "en"): Promise<CommandCenterData> {
  const supabase = createAdminClient();
  const i18n = (f: I18nField | null, fallback = "—") => (f?.[locale as "en" | "es"] ?? f?.en ?? fallback);

  const [
    projectsRes, tasksRes, milestonesRes, risksRes, materialsRes, rfisRes,
    budgetRes, resourcesRes, decisionsRes, nodesRes, edgesRes, depsRes, auditRes,
  ] = await Promise.all([
    supabase.from("projects").select("id, title_i18n, slug, project_type, status, start_date, target_end_date").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("roadmap_tasks").select("id, title, project_id, milestone_id, status, is_blocked, is_critical, slack_days, assigned_to, assigned_resource_id, end_date, blocker_reason").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("milestones").select("id, title, project_id, target_date, status").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("risks").select("project_id, title, severity, status").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("material_requirements").select("project_id, name, status, needs_review, confidence_score, required_by_date, quantity, unit_of_measure").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rfis").select("project_id, subject, status, blocks_task_id").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("budget_items").select("project_id, name, estimated_cost, actual_cost, forecast_cost, status").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("resources").select("id, name, resource_type, trade_key, status, project_id").eq("organization_id", organizationId).is("deleted_at", null).in("resource_type", ["person", "crew", "team", "vendor", "subcontractor"]),
    supabase.from("decisions").select("project_id, title_i18n, status, impact_area").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("process_nodes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("process_edges").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("task_dependencies").select("predecessor_id, successor_id").eq("organization_id", organizationId),
    supabase.from("audit_logs").select("action, entity_type, metadata, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(12),
  ]);

  const projects = projectsRes.data ?? [];
  // Only surface records whose parent project is still alive (not archived /
  // soft-deleted). Child rows (tasks, risks, materials, …) are NOT cascade
  // soft-deleted when a project is archived, so without this gate the PMO
  // views would list orphaned records that 404 when opened (their project row
  // is gone). Resources can be org-level (null project_id) — keep those.
  const aliveIds = new Set(projects.map((p) => p.id));
  const alive = <T extends { project_id?: string | null }>(rows: T[] | null) =>
    (rows ?? []).filter((r) => r.project_id != null && aliveIds.has(r.project_id));
  const tasks = alive(tasksRes.data);
  const milestones = alive(milestonesRes.data);
  const risks = alive(risksRes.data);
  const materials = alive(materialsRes.data);
  const rfis = alive(rfisRes.data);
  const budget = alive(budgetRes.data);
  const resources = (resourcesRes.data ?? []).filter((r) => r.project_id == null || aliveIds.has(r.project_id));
  const decisions = alive(decisionsRes.data);
  const projectName = new Map(projects.map((p) => [p.id, i18n(p.title_i18n as I18nField, p.slug)]));

  // ── Aggregates ──────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const blocked = tasks.filter((t) => t.status === "blocked" || t.is_blocked);
  const overdue = tasks.filter((t) => t.end_date && t.end_date < new Date().toISOString().slice(0, 10) && !DONE.has(t.status));
  const critical = tasks.filter((t) => t.is_critical);
  const blockedCritical = critical.filter((t) => t.status === "blocked" || t.is_blocked);
  const openTasks = tasks.filter((t) => !DONE.has(t.status) && t.status !== "deferred");
  const unassigned = openTasks.filter((t) => !t.assigned_to && !t.assigned_resource_id);
  const openRisks = risks.filter((r) => r.status === "open" || r.status === "mitigating");
  const highRisks = openRisks.filter((r) => r.severity === "high" || r.severity === "critical");
  const matProblem = materials.filter((m) => m.status === "delayed" || m.status === "unavailable");
  const matReview = materials.filter((m) => m.needs_review);
  const openRfis = rfis.filter((r) => r.status === "draft" || r.status === "open");
  const blockingRfis = openRfis.filter((r) => r.blocks_task_id);
  const unavailableRes = resources.filter((r) => r.status === "unavailable");
  const pendingDecisions = decisions.filter((d) => d.status === "proposed");

  const estTotal = budget.reduce((s, b) => s + Number(b.estimated_cost ?? 0), 0);
  const fcTotal = budget.reduce((s, b) => s + (b.forecast_cost != null ? Number(b.forecast_cost) : Number(b.actual_cost ?? 0)), 0);
  const variancePctVal = estTotal > 0 ? ((fcTotal - estTotal) / estTotal) * 100 : 0;

  // ── Portfolio health (org-level, derived) ─────────────────────────────────
  const scheduleHealth = clamp(100 - pct(blocked.length, totalTasks) * 1.2 - pct(overdue.length, totalTasks) * 1.0);
  const budgetHealth = budget.length === 0 ? 100 : clamp(100 - Math.max(0, variancePctVal) * 4 - pct(budget.filter((b) => b.status === "overrun" || b.status === "at_risk").length, budget.length));
  const resourceHealth = clamp(100 - pct(unassigned.length, Math.max(1, openTasks.length)) * 0.6 - unavailableRes.length * 8);
  const materialHealth = materials.length === 0 ? 100 : clamp(100 - pct(matProblem.length, materials.length) * 1.5);
  const riskHealth = clamp(100 - highRisks.length * 12 - (openRisks.length - highRisks.length) * 3);
  const cpHealth = critical.length === 0 ? 100 : clamp(100 - pct(blockedCritical.length, critical.length) * 1.5);
  const dims: HealthDimension[] = [
    { key: "schedule", score: scheduleHealth },
    { key: "budget", score: budgetHealth },
    { key: "resources", score: resourceHealth },
    { key: "materials", score: materialHealth },
    { key: "risk", score: riskHealth },
    { key: "critical_path", score: cpHealth },
  ];
  const overall = totalTasks === 0 && budget.length === 0 ? 0 : clamp(dims.reduce((s, d) => s + d.score, 0) / dims.length);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "planning");
  const typeCounts = projects.reduce<Record<string, number>>((acc, p) => { acc[p.project_type ?? "general"] = (acc[p.project_type ?? "general"] ?? 0) + 1; return acc; }, {});
  const typeSummary = Object.entries(typeCounts).map(([k, v]) => `${v} ${k.replace(/_/g, " ").split(" ")[0]}`).join(" · ");

  const kpis: KpiCard[] = [
    { key: "portfolio_health", value: String(overall), subtitle: overall >= 80 ? "Healthy across the board" : overall >= 60 ? `Stable, ${dims.filter((d) => d.score < 60).length} area(s) need attention` : "Multiple areas need attention", tone: band(overall) === "green" ? "green" : band(overall) === "amber" ? "amber" : "red" },
    { key: "active_projects", value: String(activeProjects.length), subtitle: projects.length > 0 ? typeSummary : "No projects yet", tone: "blue" },
    { key: "blocked_tasks", value: String(blocked.length), subtitle: `${blockedCritical.length} affect critical path`, tone: blocked.length > 0 ? "red" : "green" },
    { key: "critical_path_risks", value: String(blockedCritical.length + openTasks.filter((t) => t.is_critical && (t.slack_days ?? 99) <= 3).length), subtitle: matProblem.length || blockingRfis.length ? "Procurement and RFIs are main drivers" : "Schedule-driven", tone: "amber" },
    { key: "budget_variance", value: `${variancePctVal >= 0 ? "+" : ""}${variancePctVal.toFixed(1)}%`, subtitle: budget.length === 0 ? "No budget recorded yet" : variancePctVal > 0 ? "Forecast above approved baseline" : "Within baseline", tone: variancePctVal > 5 ? "red" : variancePctVal > 0 ? "amber" : "green" },
    { key: "pm_decisions", value: String(pendingDecisions.length), subtitle: pendingDecisions.length > 0 ? `${pendingDecisions.filter((d) => d.impact_area === "budget" || d.impact_area === "schedule").length} high-impact pending` : "Nothing waiting on you", tone: pendingDecisions.length > 0 ? "amber" : "green" },
  ];

  // ── PMO Focus ──────────────────────────────────────────────────────────
  const pmoFocus: FocusItem[] = [];
  for (const t of blockedCritical.slice(0, 3)) {
    pmoFocus.push({ id: `bc-${t.id}`, title: `"${t.title}" is blocked on the critical path`, explanation: t.blocker_reason || "A critical-path task is on hold; it will push the finish date.", severity: "critical", project: t.project_id ? projectName.get(t.project_id) ?? null : null, action: "Resolve the blocker or re-sequence work." });
  }
  if (matReview.length > 0) pmoFocus.push({ id: "mat-review", title: `${matReview.length} material(s) need validation`, explanation: "Extracted or AI-suggested materials are below the review threshold.", severity: "review", project: null, action: "Confirm quantities before purchasing." });
  if (unassigned.length > 0) pmoFocus.push({ id: "unassigned", title: `${unassigned.length} open task(s) have no owner`, explanation: "Work cannot be accountable without an owner.", severity: "review", project: null, action: "Assign owners from the Workboard." });
  if (blockingRfis.length > 0) pmoFocus.push({ id: "rfis", title: `${blockingRfis.length} open RFI(s) are blocking work`, explanation: "Unanswered RFIs hold up dependent tasks.", severity: "high", project: null, action: "Expedite RFI responses." });
  if (pmoFocus.length === 0 && totalTasks > 0) pmoFocus.push({ id: "ok", title: "No critical items need attention today", explanation: "No blocked critical work, unassigned tasks, or blocking RFIs right now.", severity: "ready", project: null, action: "Keep the schedule and risks current." });

  // ── AI recommendations (deterministic, evidence-based) ────────────────────
  const aiRecommendations: AiRecommendation[] = [];
  if (matProblem.length > 0 || matReview.length > 0) aiRecommendations.push({ id: "ai-mat", title: "Turn material risk into a procurement action", explanation: `${matProblem.length + matReview.length} material(s) are delayed, unavailable, or low-confidence. Validate and order before they hit the schedule.`, confidence: 0.82, impact: "Schedule · Budget", action: "Open Materials", status: "pending" });
  if (blockedCritical.length > 0) aiRecommendations.push({ id: "ai-cp", title: "Recalculate the critical path", explanation: "Critical-path tasks are blocked, so the current finish-date baseline is weak.", confidence: 0.9, impact: "Schedule", action: "Recalculate critical path", status: "pending" });
  if (unassigned.length > 0) aiRecommendations.push({ id: "ai-owner", title: "Assign missing accountability", explanation: `${unassigned.length} open task(s) have no accountable owner.`, confidence: 0.88, impact: "Execution", action: "Assign owners", status: "pending" });

  // ── Critical Path Monitor (representative project = most critical tasks) ──
  const critByProject = new Map<string, typeof critical>();
  for (const t of critical) { const k = t.project_id ?? ""; if (!critByProject.has(k)) critByProject.set(k, []); critByProject.get(k)!.push(t); }
  let repProject = ""; let repCount = 0;
  for (const [k, arr] of critByProject) if (arr.length > repCount) { repProject = k; repCount = arr.length; }
  const criticalPath: CriticalPathItem[] = (critByProject.get(repProject) ?? [])
    .slice(0, 8)
    .map((t, i) => ({
      order: i + 1, task: t.title, project: t.project_id ? projectName.get(t.project_id) ?? "—" : "—",
      status: t.status === "blocked" ? "Blocked" : DONE.has(t.status) ? "On Track" : STARTED.has(t.status) ? "In Progress" : "Ready",
      risk: (t.status === "blocked" || t.is_blocked) ? "red" : (t.slack_days ?? 99) <= 3 ? "amber" : "green",
      blocker: t.blocker_reason || null, float: t.slack_days,
    }));

  // ── Decision Queue ────────────────────────────────────────────────────────
  const decisionQueue: DecisionItem[] = pendingDecisions.slice(0, 6).map((d, i) => ({
    id: `dec-${i}`, title: i18n(d.title_i18n as I18nField, "Decision"), impact: d.impact_area ?? "general",
    project: d.project_id ? projectName.get(d.project_id) ?? null : null, status: d.status,
  }));

  // ── Resource & Labor Capacity (utilization from open-task assignment) ─────
  const taskCountByResource = new Map<string, number>();
  for (const t of openTasks) if (t.assigned_resource_id) taskCountByResource.set(t.assigned_resource_id, (taskCountByResource.get(t.assigned_resource_id) ?? 0) + 1);
  const resourceCapacity: ResourceRow[] = resources.slice(0, 8).map((r) => {
    const assigned = taskCountByResource.get(r.id) ?? 0;
    const util = assigned === 0 ? 0 : Math.min(140, 50 + assigned * 18); // heuristic when no calendar data
    return {
      name: r.name, type: r.resource_type, trade: r.trade_key, utilization: assigned > 0 ? util : null,
      status: r.status === "unavailable" ? "Unconfirmed" : util > 100 ? "Overloaded" : util === 0 ? "Underallocated" : "Available",
      assignedTasks: assigned,
    };
  });

  // ── Material & Procurement Risk ─────────────────────────────────────────
  const materialProcurementRisk: MaterialRow[] = materials
    .filter((m) => m.needs_review || ["planned", "required", "requested", "quoted", "delayed", "unavailable"].includes(m.status))
    .slice(0, 8)
    .map((m) => ({
      name: m.name, quantity: m.quantity != null ? `${m.quantity} ${m.unit_of_measure ?? ""}`.trim() : "—",
      project: m.project_id ? projectName.get(m.project_id) ?? "—" : "—", requiredBy: m.required_by_date,
      confidence: m.confidence_score != null ? Math.round(Number(m.confidence_score) * 100) : null,
      status: m.status, needsReview: !!m.needs_review,
    }));

  // ── Living Graph Signals ──────────────────────────────────────────────────
  const nodeCount = nodesRes.count ?? 0;
  const edgeCount = edgesRes.count ?? 0;
  const livingGraphSignals: GraphSignal[] = [
    { key: "relationships", value: edgeCount, label: "Tasks, resources, materials, risks" },
    { key: "nodes", value: nodeCount, label: "Connected entities" },
    { key: "dependencies", value: (depsRes.data ?? []).length, label: "Task dependencies" },
  ];

  // ── Upcoming 14 days ──────────────────────────────────────────────────────
  const today = new Date(); const horizon = new Date(today.getTime() + 14 * 86400000);
  const inWindow = (d: string | null) => !!d && new Date(d) >= today && new Date(d) <= horizon;
  const lookahead: LookaheadItem[] = [
    ...milestones.filter((m) => inWindow(m.target_date)).map((m) => ({ date: m.target_date as string, event: m.title, project: m.project_id ? projectName.get(m.project_id) ?? "—" : "—", impact: "Milestone", kind: "milestone" as const })),
    ...tasks.filter((t) => inWindow(t.end_date) && !DONE.has(t.status)).map((t) => ({ date: t.end_date as string, event: t.title, project: t.project_id ? projectName.get(t.project_id) ?? "—" : "—", impact: t.is_critical ? "Critical path" : "Execution", kind: "task" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

  // ── Budget & Forecast Signals ──────────────────────────────────────────────
  const budgetForecastSignals: BudgetSignal[] = budget
    .map((b) => {
      const est = Number(b.estimated_cost ?? 0);
      const fc = b.forecast_cost != null ? Number(b.forecast_cost) : Number(b.actual_cost ?? 0);
      const v = Math.round((fc - est) * 100) / 100;
      return { area: b.name, project: b.project_id ? projectName.get(b.project_id) ?? "—" : "—", estimate: est, forecast: fc, variance: v, signal: v > 0 ? (est > 0 && v / est > 0.1 ? "Over baseline" : "Watch") : "Stable" };
    })
    .sort((a, b) => b.variance - a.variance)
    .slice(0, 6);

  // ── Recent activity ────────────────────────────────────────────────────────
  const recentActivity: ActivityItem[] = (auditRes.data ?? []).map((a, i) => ({
    id: `act-${i}`, event: a.action, entity: a.entity_type,
    at: a.created_at, source: (a.metadata as Record<string, unknown>)?.source as string ?? "user",
  }));

  return {
    hasProjects: projects.length > 0,
    hasGraph: nodeCount > 0,
    portfolioHealth: { overall, dimensions: dims, derivedFrom: "Computed from connected schedule, budget, resource, material, and risk data." },
    kpis, pmoFocus, aiRecommendations, criticalPath, decisionQueue,
    resourceCapacity, materialProcurementRisk, livingGraphSignals,
    upcomingLookahead: lookahead, budgetForecastSignals, recentActivity,
  };
}
