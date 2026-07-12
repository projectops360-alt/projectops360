// ============================================================================
// ProjectOps360° — Project Template Service
// ============================================================================
// Instantiates a typed template (templates.ts) into real rows:
// milestones, roadmap_tasks, task_dependencies, resources, budget_items,
// risks. Task dates come from a CPM forward pass over the template graph so
// the schedule, Gantt, and critical path are coherent from day one.
// Server-side only (uses the admin client like other server actions).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectTemplate } from "./templates";
import { calculateCriticalPath } from "./critical-path";

export interface InstantiateTemplateResult {
  milestonesCreated: number;
  tasksCreated: number;
  dependenciesCreated: number;
  resourcesCreated: number;
  budgetItemsCreated: number;
  risksCreated: number;
}

/**
 * Create the full execution structure for a new project from a template.
 * All generated records are marked origin/metadata 'template' — they are a
 * starting plan, not a final one.
 */
export async function instantiateTemplate(params: {
  organizationId: string;
  projectId: string;
  template: ProjectTemplate;
  startDate?: string; // ISO; defaults to today
  createdBy?: string | null;
}): Promise<InstantiateTemplateResult> {
  const { organizationId, projectId, template } = params;
  const supabase = createAdminClient();
  const anchor = params.startDate ?? new Date().toISOString().slice(0, 10);

  // ── Schedule the template graph with the CPM engine ───────────────────────
  const templateTasks = template.phases.flatMap((p) => p.tasks);
  const pseudoTasks = templateTasks.map((t) => ({
    id: t.key,
    start_date: null,
    end_date: null,
    duration_days: t.estimated_duration_days,
    estimate_hours: null,
    status: "not_started" as const,
  }));
  const pseudoDeps = templateTasks.flatMap((t) =>
    (t.depends_on ?? []).map((dep) => ({
      predecessor_id: dep,
      successor_id: t.key,
      dependency_type: "finish_to_start" as const,
      lag_days: 0,
    })),
  );
  const schedule = calculateCriticalPath(pseudoTasks, pseudoDeps, [], anchor);

  // ── Milestones (one per phase) ────────────────────────────────────────────
  const milestoneRows = template.phases.map((phase, idx) => {
    const phaseResults = phase.tasks
      .map((t) => schedule.tasks.get(t.key))
      .filter((r) => r != null);
    const phaseStart = phaseResults.length
      ? phaseResults.reduce((min, r) => (r.earliestStartDate < min ? r.earliestStartDate : min), phaseResults[0].earliestStartDate)
      : anchor;
    const phaseEnd = phaseResults.length
      ? phaseResults.reduce((max, r) => (r.earliestFinishDate > max ? r.earliestFinishDate : max), phaseResults[0].earliestFinishDate)
      : anchor;
    return {
      organization_id: organizationId,
      project_id: projectId,
      title: phase.title_i18n.en ?? phase.key,
      description: phase.title_i18n.es ?? null,
      status: "planned",
      start_date: phaseStart,
      target_date: phaseEnd,
      order_index: idx,
      icon_key: phase.icon_key ?? null,
      created_by: params.createdBy ?? null,
    };
  });

  const { data: milestones, error: msError } = await supabase
    .from("milestones")
    .insert(milestoneRows)
    .select("id, order_index");
  if (msError) throw new Error(`Template milestones failed: ${msError.message}`);

  const milestoneIdByPhaseIdx = new Map<number, string>();
  for (const m of milestones ?? []) milestoneIdByPhaseIdx.set(m.order_index, m.id);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const taskRows = template.phases.flatMap((phase, phaseIdx) =>
    phase.tasks.map((t, taskIdx) => {
      const sched = schedule.tasks.get(t.key);
      return {
        organization_id: organizationId,
        project_id: projectId,
        milestone_id: milestoneIdByPhaseIdx.get(phaseIdx) ?? null,
        title: t.title_i18n.en ?? t.key,
        description: t.title_i18n.es ?? null,
        status: "not_started",
        priority: "p2",
        order_index: phaseIdx * 100 + taskIdx,
        external_key: t.key,
        duration_days: t.estimated_duration_days,
        start_date: sched?.earliestStartDate ?? null,
        end_date: sched?.earliestFinishDate ?? null,
        is_critical: sched?.isCritical ?? false,
        slack_days: sched?.totalFloat ?? null,
        earliest_start: sched?.earliestStartDate ?? null,
        earliest_finish: sched?.earliestFinishDate ?? null,
        latest_start: sched?.latestStartDate ?? null,
        latest_finish: sched?.latestFinishDate ?? null,
        estimated_labor_hours: t.estimated_labor_hours ?? null,
        required_skills: t.required_skills ?? [],
        trade_key: t.trade_key ?? null,
        discipline: t.discipline ?? null,
        created_by: params.createdBy ?? null,
      };
    }),
  );

  const { data: tasks, error: taskError } = await supabase
    .from("roadmap_tasks")
    .insert(taskRows)
    .select("id, external_key");
  if (taskError) throw new Error(`Template tasks failed: ${taskError.message}`);

  const taskIdByKey = new Map<string, string>();
  for (const t of tasks ?? []) {
    if (t.external_key) taskIdByKey.set(t.external_key, t.id);
  }

  // ── Dependencies ──────────────────────────────────────────────────────────
  const depRows = templateTasks.flatMap((t) =>
    (t.depends_on ?? [])
      .filter((dep) => taskIdByKey.has(dep) && taskIdByKey.has(t.key))
      .map((dep) => ({
        organization_id: organizationId,
        project_id: projectId,
        predecessor_id: taskIdByKey.get(dep)!,
        successor_id: taskIdByKey.get(t.key)!,
        dependency_type: "finish_to_start",
        lag_days: 0,
      })),
  );

  let dependenciesCreated = 0;
  if (depRows.length > 0) {
    const { error: depError } = await supabase.from("task_dependencies").insert(depRows);
    if (depError) throw new Error(`Template dependencies failed: ${depError.message}`);
    dependenciesCreated = depRows.length;
  }

  // ── Resources ─────────────────────────────────────────────────────────────
  let resourcesCreated = 0;
  if (template.resources.length > 0) {
    const resourceRows = template.resources.map((r, idx) => ({
      organization_id: organizationId,
      project_id: projectId,
      resource_type: r.resource_type,
      name: r.name,
      status: "active",
      trade_key: r.trade_key ?? null,
      skills: r.skills ?? [],
      metadata: { origin: "template" },
      order_index: idx,
    }));
    const { error } = await supabase.from("resources").insert(resourceRows);
    if (error) throw new Error(`Template resources failed: ${error.message}`);
    resourcesCreated = resourceRows.length;
  }

  // ── Budget placeholders ───────────────────────────────────────────────────
  let budgetItemsCreated = 0;
  if (template.budget_lines.length > 0) {
    const budgetRows = template.budget_lines.map((b) => ({
      organization_id: organizationId,
      project_id: projectId,
      name: b.name_i18n.en ?? "Budget line",
      description: b.name_i18n.es ?? null,
      category: b.category,
      status: "planned",
      metadata: { origin: "template" },
    }));
    const { error } = await supabase.from("budget_items").insert(budgetRows);
    if (error) throw new Error(`Template budget failed: ${error.message}`);
    budgetItemsCreated = budgetRows.length;
  }

  // ── Risk placeholders ─────────────────────────────────────────────────────
  let risksCreated = 0;
  if (template.risks.length > 0) {
    const riskRows = template.risks.map((r) => ({
      organization_id: organizationId,
      project_id: projectId,
      title: r.title_i18n.en ?? "Risk",
      description: r.title_i18n.es ?? null,
      category: r.category,
      severity: r.severity,
      impact: r.severity,
      status: "open",
      origin: "template",
      needs_review: true,
    }));
    const { error } = await supabase
      .from("risks")
      .insert(riskRows);
    if (error) throw new Error(`Template risks failed: ${error.message}`);
    risksCreated = riskRows.length;
    // P2-T2 remediation (PD-018): "not capturable yet". Template seeding is a
    // BULK INSERT of placeholder risks; migrating it to the per-row atomic
    // capture_risk_registered RPC would alter the bulk-write contract
    // (single-statement insert → per-row RPC loop, different atomicity/round-
    // trips). Per the acceptance decision, a writer that cannot migrate
    // without altering its behavior stays without synchronous emit and is
    // reported — no silent divergence, no fire-and-forget fallback. risk_registered
    // for templates will be wired when a per-row creation path exists.
  }

  return {
    milestonesCreated: milestoneRows.length,
    tasksCreated: taskRows.length,
    dependenciesCreated,
    resourcesCreated,
    budgetItemsCreated,
    risksCreated,
  };
}
