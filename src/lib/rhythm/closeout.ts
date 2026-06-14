// ============================================================================
// ProjectOps360° — Project Closeout Report (server-only)
// ============================================================================
// Auto-generated when a "Closing Project" meeting is completed. Computes the
// metrics we can derive from existing data (schedule, budget, risks, RFIs,
// submittals, decisions, actions, duration) and an AI executive summary
// (reuses runAi). Honest: fields we don't track (CSAT, ROI, revenue) are omitted.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale, I18nField, Milestone, RoadmapTask } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { getComputedMilestoneStatus } from "@/lib/roadmap/progress";
import { TASK_COMPLETE_STATUSES } from "@/lib/roadmap/status-mappings";

type Supabase = ReturnType<typeof createAdminClient>;

export interface CloseoutMetrics {
  schedule: {
    totalTasks: number; doneTasks: number; openTasks: number; blockedTasks: number; deferredTasks: number;
    completionPct: number; lateTasks: number;
    totalMilestones: number; completedMilestones: number; pendingMilestones: number; onTimeMilestones: number;
    plannedDays: number | null; actualDays: number | null; scheduleVariancePct: number | null;
  };
  budget: {
    estimated: number; committed: number; actual: number;
    variance: number; variancePct: number | null; currency: string; hasData: boolean; reconciled: boolean;
  };
  risks: { total: number; open: number; mitigated: number; closed: number; resolvedPct: number };
  rfis: { total: number; open: number; closed: number };
  submittals: { total: number; pending: number; approved: number };
  decisions: number;
  decisionsPending: number;
  actions: { total: number; completed: number; open: number };
  followUps: number;
  meetings: number;
}

export type ReadinessLevel = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  key: string;
  labelEs: string;
  labelEn: string;
  detailEs: string;
  detailEn: string;
  level: ReadinessLevel;
  count: number;
  blocking: boolean;
}

export interface CloseoutReadiness {
  checks: ReadinessCheck[];
  ready: boolean;
  score: number;
  failCount: number;
  warnCount: number;
}

export interface MilestoneDuration {
  title: string;
  description: string | null;
  duration: string | null;
  outcome: string;
}

export interface CloseoutNarrative {
  keyAccomplishments: string[];
  wentWell: string[];
  wentWrong: string[];
  openItems: string[];
  nextSteps: string[];
}

export interface CloseoutReport {
  generatedAt: string;
  metrics: CloseoutMetrics;
  readiness: CloseoutReadiness;
  executiveSummary: string;
  narrative: CloseoutNarrative;
  milestoneDurations: MilestoneDuration[];
  archive: string[];
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return Number.isFinite(d) ? d : null;
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export async function computeCloseoutMetrics(
  supabase: Supabase, organizationId: string, projectId: string,
): Promise<CloseoutMetrics> {
  const scoped = (table: string, cols: string) =>
    supabase.from(table).select(cols).eq("organization_id", organizationId).eq("project_id", projectId).is("deleted_at", null);

  const [proj, tasks, milestones, budget, materials, risks, rfis, submittals, decisions, actions, comms, meetings] = await Promise.all([
    supabase.from("projects").select("start_date, target_end_date").eq("id", projectId).eq("organization_id", organizationId).single(),
    scoped("roadmap_tasks", "id, milestone_id, status, end_date, completed_at, deleted_at"),
    scoped("milestones", "*"),
    scoped("budget_items", "estimated_cost, committed_cost, actual_cost, currency"),
    scoped("material_requirements", "estimated_total_cost"),
    scoped("risks", "status"),
    scoped("rfis", "status"),
    scoped("submittals", "status"),
    scoped("decisions", "status"),
    scoped("action_items", "status"),
    scoped("communication_items", "requires_follow_up"),
    scoped("meetings", "id"),
  ]);

  // Schedule — completion uses the shared TASK_COMPLETE_STATUSES; milestone
  // status is DERIVED from its tasks (same logic the app shows everywhere),
  // not the raw stored column (which can lag behind task progress).
  const taskRows = (tasks.data ?? []) as unknown as RoadmapTask[];
  const doneTasks = taskRows.filter((t) => TASK_COMPLETE_STATUSES.includes(t.status)).length;
  const blockedTasks = taskRows.filter((t) => t.status === "blocked").length;
  const deferredTasks = taskRows.filter((t) => t.status === "deferred").length;
  const openTasks = taskRows.length - doneTasks - blockedTasks - deferredTasks;
  const lateTasks = taskRows.filter((t) => t.completed_at && t.end_date && new Date(t.completed_at) > new Date(t.end_date)).length;

  const msRows = (milestones.data ?? []) as unknown as Milestone[];
  const msComputed = msRows.map((ms) => ({ ms, st: getComputedMilestoneStatus(ms, taskRows) }));
  const completedMs = msComputed.filter((x) => x.st === "completed").length;
  const deferredMs = msComputed.filter((x) => x.st === "deferred").length;
  const pendingMs = msRows.length - completedMs - deferredMs;
  const onTimeMs = msComputed.filter((x) => x.st === "completed" && x.ms.completed_date && x.ms.target_date && new Date(x.ms.completed_date) <= new Date(x.ms.target_date)).length;

  const startDate = (proj.data?.start_date as string | null) ?? null;
  const targetEnd = (proj.data?.target_end_date as string | null) ?? null;
  const lastCompleted = taskRows.map((t) => t.completed_at).filter(Boolean).sort().pop() ?? new Date().toISOString();
  const plannedDays = daysBetween(startDate, targetEnd);
  const actualDays = daysBetween(startDate, lastCompleted);
  const scheduleVariancePct = plannedDays && plannedDays > 0 && actualDays != null
    ? Math.round(((actualDays - plannedDays) / plannedDays) * 100) : null;

  // Budget
  const budgetRows = (budget.data ?? []) as unknown as { estimated_cost: number | null; committed_cost: number | null; actual_cost: number | null; currency: string | null }[];
  const sum = (k: "estimated_cost" | "committed_cost" | "actual_cost") => budgetRows.reduce((s, b) => s + Number(b[k] ?? 0), 0);
  let estimated = sum("estimated_cost");
  const committed = sum("committed_cost");
  const actual = sum("actual_cost");
  if (estimated === 0) estimated = (materials.data ?? []).reduce((s, m) => s + Number((m as unknown as { estimated_total_cost: number | null }).estimated_total_cost ?? 0), 0);
  const variance = Math.round((estimated - actual) * 100) / 100;
  const currency = budgetRows.find((b) => b.currency)?.currency ?? "USD";

  // Risks
  const riskRows = (risks.data ?? []) as unknown as { status: string }[];
  const rOpen = riskRows.filter((r) => ["open", "identified"].includes(r.status)).length;
  const rMit = riskRows.filter((r) => r.status === "mitigating").length;
  const rClosed = riskRows.filter((r) => ["resolved", "closed", "accepted"].includes(r.status)).length;

  // RFIs / submittals / decisions / follow-ups
  const rfiRows = (rfis.data ?? []) as unknown as { status: string }[];
  const rfiClosed = rfiRows.filter((r) => ["closed", "answered", "void"].includes(r.status)).length;
  const subRows = (submittals.data ?? []) as unknown as { status: string }[];
  const subApproved = subRows.filter((s) => ["approved", "approved_as_noted", "closed", "rejected"].includes(s.status)).length;
  const decRows = (decisions.data ?? []) as unknown as { status: string }[];
  const decPending = decRows.filter((d) => d.status === "proposed").length;
  const actRows = (actions.data ?? []) as unknown as { status: string }[];
  const actOpen = actRows.filter((a) => ["pending", "in_progress"].includes(a.status)).length;
  const followUps = ((comms.data ?? []) as unknown as { requires_follow_up: boolean | null }[]).filter((c) => c.requires_follow_up).length;

  return {
    schedule: {
      totalTasks: taskRows.length, doneTasks, openTasks, blockedTasks, deferredTasks,
      completionPct: pct(doneTasks, taskRows.length), lateTasks,
      totalMilestones: msRows.length, completedMilestones: completedMs, pendingMilestones: pendingMs, onTimeMilestones: onTimeMs,
      plannedDays, actualDays, scheduleVariancePct,
    },
    budget: {
      estimated: Math.round(estimated * 100) / 100, committed: Math.round(committed * 100) / 100, actual: Math.round(actual * 100) / 100,
      variance, variancePct: estimated > 0 ? Math.round((variance / estimated) * 100) : null, currency,
      hasData: estimated > 0 || actual > 0, reconciled: (estimated > 0 || actual > 0) && actual > 0,
    },
    risks: { total: riskRows.length, open: rOpen, mitigated: rMit, closed: rClosed, resolvedPct: pct(rClosed, riskRows.length) },
    rfis: { total: rfiRows.length, open: rfiRows.length - rfiClosed, closed: rfiClosed },
    submittals: { total: subRows.length, pending: subRows.length - subApproved, approved: subApproved },
    decisions: decRows.length,
    decisionsPending: decPending,
    actions: { total: actRows.length, completed: actRows.filter((a) => a.status === "completed").length, open: actOpen },
    followUps,
    meetings: (meetings.data ?? []).length,
  };
}

// ── Closeout readiness gate ─────────────────────────────────────────────────
// Maps project data to the pre-conditions for a successful closeout (PMI /
// construction practice): all work closed, no blockers, no open issues, risks
// resolved, RFIs answered, submittals/decisions resolved, budget reconciled.

const RD = (
  key: string, labelEs: string, labelEn: string, detailEs: string, detailEn: string,
  count: number, blocking: boolean, warnOnly = false,
): ReadinessCheck => ({
  key, labelEs, labelEn, detailEs, detailEn, count, blocking,
  level: count === 0 ? "pass" : blocking && !warnOnly ? "fail" : "warn",
});

export function computeCloseoutReadiness(m: CloseoutMetrics): CloseoutReadiness {
  const s = m.schedule;
  const checks: ReadinessCheck[] = [
    RD("open_tasks", "Actividades cerradas", "Activities closed",
      `${s.openTasks} actividad(es) sin completar`, `${s.openTasks} unfinished activit(ies)`, s.openTasks, true),
    RD("blockers", "Sin bloqueos", "No blockers",
      `${s.blockedTasks} tarea(s) bloqueada(s)`, `${s.blockedTasks} blocked task(s)`, s.blockedTasks, true),
    RD("milestones", "Hitos completados", "Milestones complete",
      `${s.pendingMilestones} hito(s) pendiente(s)`, `${s.pendingMilestones} pending milestone(s)`, s.pendingMilestones, true),
    RD("open_risks", "Riesgos resueltos", "Risks resolved",
      `${m.risks.open + m.risks.mitigated} riesgo(s) abierto(s)`, `${m.risks.open + m.risks.mitigated} open risk(s)`, m.risks.open + m.risks.mitigated, true),
    RD("open_rfis", "RFIs respondidos", "RFIs answered",
      `${m.rfis.open} RFI(s) abierto(s)`, `${m.rfis.open} open RFI(s)`, m.rfis.open, true),
    RD("open_actions", "Action items cerrados", "Action items closed",
      `${m.actions.open} acción(es) pendiente(s)`, `${m.actions.open} open action(s)`, m.actions.open, true),
    RD("follow_ups", "Seguimientos resueltos", "Follow-ups resolved",
      `${m.followUps} comunicación(es) con seguimiento`, `${m.followUps} item(s) needing follow-up`, m.followUps, false),
    RD("submittals", "Submittals resueltos", "Submittals resolved",
      `${m.submittals.pending} submittal(s) pendiente(s)`, `${m.submittals.pending} pending submittal(s)`, m.submittals.pending, false),
    RD("decisions", "Decisiones tomadas", "Decisions resolved",
      `${m.decisionsPending} decisión(es) propuesta(s) sin resolver`, `${m.decisionsPending} unresolved decision(s)`, m.decisionsPending, false),
    RD("budget", "Presupuesto reconciliado", "Budget reconciled",
      m.budget.reconciled ? "" : "Sin costo real registrado", m.budget.reconciled ? "" : "No actual cost recorded",
      m.budget.reconciled ? 0 : 1, false, true),
  ];

  const failCount = checks.filter((c) => c.level === "fail").length;
  const warnCount = checks.filter((c) => c.level === "warn").length;
  const passCount = checks.filter((c) => c.level === "pass").length;
  return {
    checks,
    ready: checks.every((c) => !(c.blocking && c.level === "fail")),
    score: pct(passCount, checks.length),
    failCount, warnCount,
  };
}

function metricsToText(m: CloseoutMetrics, currency: string): string {
  const lines = [
    `Schedule: ${m.schedule.doneTasks}/${m.schedule.totalTasks} tasks done (${m.schedule.completionPct}%), ${m.schedule.lateTasks} completed late, ${m.schedule.openTasks} still open, ${m.schedule.blockedTasks} blocked. Milestones: ${m.schedule.completedMilestones}/${m.schedule.totalMilestones} completed, ${m.schedule.onTimeMilestones} on time.`,
    m.schedule.plannedDays != null ? `Duration: planned ${m.schedule.plannedDays} days vs actual ${m.schedule.actualDays} days (variance ${m.schedule.scheduleVariancePct}%).` : "",
    m.budget.hasData ? `Budget (${currency}): estimated ${m.budget.estimated}, committed ${m.budget.committed}, actual ${m.budget.actual}, variance ${m.budget.variance} (${m.budget.variancePct}%, ${m.budget.variance >= 0 ? "under" : "over"} budget).` : "Budget: no cost data recorded.",
    `Risks: ${m.risks.total} total, ${m.risks.closed} resolved (${m.risks.resolvedPct}%), ${m.risks.open} open.`,
    `RFIs: ${m.rfis.closed}/${m.rfis.total} closed. Submittals: ${m.submittals.approved}/${m.submittals.total} approved.`,
    `Decisions logged: ${m.decisions}. Action items: ${m.actions.completed}/${m.actions.total} completed, ${m.actions.open} open. Meetings held: ${m.meetings}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ── Deterministic sections (computed live, no AI) ──────────────────────────

const STD_ARTIFACTS_ES = ["Plan del proyecto", "Reporte de Estado", "Registro de riesgos", "Notas y recapitulaciones de reuniones", "Análisis de stakeholders", "Reporte de Cierre del Proyecto"];
const STD_ARTIFACTS_EN = ["Project Plan", "Status Report", "Risk Register", "Meeting Notes & Recaps", "Stakeholder Analysis", "Project Closeout Report"];

/** Per-milestone duration + outcome table (Plant Pals "Task and Milestone Duration"). */
export async function computeMilestoneDurations(
  supabase: Supabase, organizationId: string, projectId: string, locale: Locale,
): Promise<MilestoneDuration[]> {
  const [msRes, taskRes] = await Promise.all([
    supabase.from("milestones").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId).is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase.from("roadmap_tasks").select("id, milestone_id, status, deleted_at")
      .eq("organization_id", organizationId).eq("project_id", projectId).is("deleted_at", null),
  ]);
  const tasks = (taskRes.data ?? []) as unknown as RoadmapTask[];
  const isEs = locale === "es";
  const wk = (a: string | null, b: string | null): string | null => {
    const d = daysBetween(a, b);
    if (d == null || d <= 0) return null;
    const w = Math.max(1, Math.round(d / 7));
    return isEs ? `${w} sem.` : `${w} wk${w > 1 ? "s" : ""}`;
  };
  return ((msRes.data ?? []) as unknown as Milestone[]).map((ms) => {
    const st = getComputedMilestoneStatus(ms, tasks);
    return {
      title: ms.title,
      description: ms.description,
      duration: wk(ms.start_date, ms.completed_date ?? ms.target_date),
      outcome: st === "completed"
        ? (isEs ? "Completado" : "Completed")
        : st === "deferred" ? (isEs ? "Diferido" : "Deferred")
        : (isEs ? "Pendiente" : "Pending"),
    };
  });
}

/** Project archive list: system-generated artifacts + actual project documents. */
export async function computeArchive(
  supabase: Supabase, organizationId: string, projectId: string, locale: Locale,
): Promise<string[]> {
  const { data } = await supabase
    .from("documents").select("title_i18n")
    .eq("organization_id", organizationId).eq("project_id", projectId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(40);
  const std = locale === "es" ? STD_ARTIFACTS_ES : STD_ARTIFACTS_EN;
  const docTitles = ((data ?? []) as unknown as { title_i18n: I18nField }[])
    .map((d) => getI18nValue(d.title_i18n, locale))
    .filter((t): t is string => Boolean(t));
  return Array.from(new Set([...std, ...docTitles]));
}

// ── AI narrative (grounded in accumulated meetings / decisions / risks) ─────

const EMPTY_NARRATIVE: CloseoutNarrative = { keyAccomplishments: [], wentWell: [], wentWrong: [], openItems: [], nextSteps: [] };

async function gatherContext(
  supabase: Supabase, organizationId: string, projectId: string, locale: Locale,
): Promise<string> {
  const scoped = (table: string, cols: string) =>
    supabase.from(table).select(cols).eq("organization_id", organizationId).eq("project_id", projectId).is("deleted_at", null);
  const [meetings, decisions, risks, actions, milestones] = await Promise.all([
    scoped("meetings", "title_i18n, summary_i18n, notes_i18n, meeting_date").order("meeting_date", { ascending: false }).limit(15),
    scoped("decisions", "title_i18n, rationale_i18n, status").limit(30),
    scoped("risks", "title, status, mitigation_plan").limit(30),
    scoped("action_items", "title_i18n, status").in("status", ["pending", "in_progress"]).limit(30),
    scoped("milestones", "title, status").order("order_index", { ascending: true }),
  ]);
  const v = (f: unknown) => getI18nValue(f as I18nField, locale);
  const parts: string[] = [];
  const ms = (milestones.data ?? []) as unknown as { title: string; status: string }[];
  if (ms.length) parts.push(`MILESTONES:\n${ms.map((m) => `- ${m.title} [${m.status}]`).join("\n")}`);
  const mt = ((meetings.data ?? []) as unknown as { title_i18n: I18nField; summary_i18n: I18nField; notes_i18n: I18nField }[])
    .map((m) => [v(m.title_i18n), v(m.summary_i18n) || v(m.notes_i18n)].filter(Boolean).join(": ")).filter(Boolean);
  if (mt.length) parts.push(`MEETINGS:\n${mt.map((t) => `- ${t.slice(0, 400)}`).join("\n")}`);
  const dc = ((decisions.data ?? []) as unknown as { title_i18n: I18nField; rationale_i18n: I18nField; status: string }[])
    .map((d) => `- ${v(d.title_i18n)} [${d.status}]${v(d.rationale_i18n) ? ` — ${v(d.rationale_i18n)}` : ""}`).filter((s) => s.length > 4);
  if (dc.length) parts.push(`DECISIONS:\n${dc.join("\n")}`);
  const rk = ((risks.data ?? []) as unknown as { title: string; status: string; mitigation_plan: string | null }[])
    .map((r) => `- ${r.title} [${r.status}]${r.mitigation_plan ? ` — ${r.mitigation_plan}` : ""}`);
  if (rk.length) parts.push(`RISKS:\n${rk.join("\n")}`);
  const ai = ((actions.data ?? []) as unknown as { title_i18n: I18nField; status: string }[])
    .map((a) => `- ${v(a.title_i18n)} [${a.status}]`).filter((s) => s.length > 4);
  if (ai.length) parts.push(`OPEN ACTION ITEMS:\n${ai.join("\n")}`);
  return parts.join("\n\n");
}

const asStrArray = (x: unknown): string[] =>
  Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean).slice(0, 8) : [];

/** Full closeout report: metrics + readiness + AI narrative + deterministic sections. */
export async function generateCloseoutReport(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<CloseoutReport> {
  const supabase = createAdminClient();
  const [metrics, milestoneDurations, archive, context] = await Promise.all([
    computeCloseoutMetrics(supabase, org.organizationId, projectId),
    computeMilestoneDurations(supabase, org.organizationId, projectId, locale),
    computeArchive(supabase, org.organizationId, projectId, locale),
    gatherContext(supabase, org.organizationId, projectId, locale),
  ]);
  const readiness = computeCloseoutReadiness(metrics);
  const metricsText = metricsToText(metrics, metrics.budget.currency);

  let executiveSummary = "";
  let narrative: CloseoutNarrative = EMPTY_NARRATIVE;

  try {
    const { runAi } = await import("@/lib/ai/service");
    const lang = locale === "es" ? "español" : "English";
    const prompt = [
      `You are a senior project manager writing a Project Closeout Report. Write ALL output strictly in ${lang}.`,
      "Base everything ONLY on the project data below — do NOT invent facts, names, numbers or events. If a section has no supporting evidence, return an empty array for it.",
      "Be factual, concise and professional. Each bullet is one short sentence.",
      "",
      "Return ONLY a JSON object with exactly these keys:",
      `{`,
      `  "executiveSummary": "1 paragraph (4-6 sentences) summarizing what the project set out to do, what was delivered, and the overall outcome",`,
      `  "keyAccomplishments": ["bullet", ...],   // concrete completed deliverables / milestones`,
      `  "wentWell": ["bullet", ...],             // what went well (lessons learned)`,
      `  "wentWrong": ["bullet", ...],            // challenges and how they were handled`,
      `  "openItems": ["bullet", ...],            // items still open / to monitor after closeout`,
      `  "nextSteps": ["bullet", ...]             // recommendations and future considerations`,
      `}`,
      "",
      "=== PROJECT METRICS ===",
      metricsText,
      "",
      "=== ACCUMULATED PROJECT CONTEXT (meetings, decisions, risks, open items) ===",
      context || "(no additional context recorded)",
    ].join("\n");

    const res = await runAi(org, {
      promptType: "custom",
      templateVars: { prompt },
      temperature: 0.3,
      sourceType: "project",
      sourceId: projectId,
    });
    if (res.status === "completed") {
      const p = (res.parsedJson ?? {}) as Record<string, unknown>;
      executiveSummary = typeof p.executiveSummary === "string" ? p.executiveSummary : (typeof p.summary === "string" ? p.summary : res.content);
      narrative = {
        keyAccomplishments: asStrArray(p.keyAccomplishments),
        wentWell: asStrArray(p.wentWell),
        wentWrong: asStrArray(p.wentWrong),
        openItems: asStrArray(p.openItems),
        nextSteps: asStrArray(p.nextSteps),
      };
    }
  } catch (err) {
    console.error("[closeout] narrative generation failed:", err);
  }

  return { generatedAt: new Date().toISOString(), metrics, readiness, executiveSummary, narrative, milestoneDurations, archive };
}
