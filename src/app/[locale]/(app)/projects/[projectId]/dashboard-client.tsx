"use client";

import React from "react";
import { localizedHref } from "@/i18n/href";
import { buildBlockerResolveHref } from "@/lib/execution/blocker-resolve";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  CalendarDays,
  Scale,
  FileText,
  Zap,
  Link2,
  AlertTriangle,
  Clock,
  ChevronRight,
  CheckCircle2,
  Circle,
  ArrowRight,
  Ban,
  Target,
  TrendingUp,
  Activity,
  Loader2,
  Pause,
  MapPin,
  ShieldCheck,
  Code,
  Send,
  FileBarChart,
  Gauge,
  Sparkles,
} from "lucide-react";
import type { TraceableEntityType, Milestone, RoadmapTask, TaskStatus, TaskPriority, MilestoneStatus, TaskDependency, Locale } from "@/types/database";
import type { RoadmapProgress, MilestoneProgress } from "@/lib/roadmap/progress";
import { buildProjectBriefing } from "@/lib/project-briefing/briefing-engine";
import type { BriefingScope, ProjectBriefing } from "@/lib/project-briefing/types";
import { overallStatusLine, healthBandLabel, attentionLabel, allStableLine } from "@/lib/project-briefing/briefing-copy";
import type { OrgRole } from "@/lib/project-export/rbac";
import { ExportProjectButton } from "./export-project-modal";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  communications: number;
  meetings: number;
  decisions: number;
  documents: number;
  actionItems: number;
  links: number;
}

export interface RecentCommunication {
  id: string;
  title: string;
  date: string | null;
  sourceType: string;
  requiresFollowUp: boolean;
}

export interface RecentMeeting {
  id: string;
  title: string;
  date: string | null;
  status: string;
}

export interface RecentDecision {
  id: string;
  title: string;
  date: string | null;
  status: string;
  impactArea: string | null;
}

export interface RecentDocument {
  id: string;
  title: string;
  documentType: string | null;
  status: string;
}

export interface UnresolvedActionItem {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  status: string;
}

export interface MissingLinkEntity {
  id: string;
  type: TraceableEntityType;
  title: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentCommunications: RecentCommunication[];
  recentMeetings: RecentMeeting[];
  recentDecisions: RecentDecision[];
  recentDocuments: RecentDocument[];
  unresolvedActionItems: UnresolvedActionItem[];
  missingLinkEntities: MissingLinkEntity[];
  totalEntities: number;
  linkedEntityCount: number;
}

export interface DashboardTranslations {
  statCards: {
    communications: string;
    meetings: string;
    decisions: string;
    documents: string;
    actionItems: string;
    links: string;
  };
  recentCommunications: string;
  recentMeetings: string;
  recentDecisions: string;
  recentDocuments: string;
  unresolvedActionItems: string;
  missingLinks: string;
  missingLinksDescription: string;
  missingLinksCount: string;
  noData: string;
  viewAll: string;
  traceabilityHealth: string;
  linkedEntities: string;
  none: string;
  requiresFollowUp: string;
  overdue: string;
  noDueDate: string;
}

// ── Extended props with roadmap data ─────────────────────────────────────────

interface ProjectDashboardProps {
  projectId: string;
  locale: string;
  projectName: string;
  data: DashboardData;
  translations: DashboardTranslations;
  entityLabels: Record<string, string>;
  // Roadmap data for the new layout
  milestones: Milestone[];
  tasks: RoadmapTask[];
  roadmapProgress: RoadmapProgress;
  // REG-015 — inputs for the deterministic Status summary card (shared engine
  // with Isabella's REG-013 briefing).
  statusDependencies: { predecessorId: string; successorId: string }[];
  statusRisks: { open: number; high: number } | null;
  statusScope: BriefingScope;
  /** Org role — gates the Export Project entry (CAP — Project Export). */
  userRole: OrgRole;
}

// ── Constants ───────────────────────────────────────────────────────────────────

const SOURCE_TYPE_COLORS: Record<string, string> = {
  email: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  meeting: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  phone: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  teams: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  slack: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  in_person: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  document: "bg-slate-50 text-slate-700 dark:bg-slate-950/50 dark:text-slate-300",
  manual_note: "bg-gray-50 text-gray-700 dark:bg-gray-950/50 dark:text-gray-300",
  other: "bg-gray-50 text-gray-700 dark:bg-gray-950/50 dark:text-gray-300",
};

const PRIORITY_BADGE: Record<string, string> = {
  p1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  p2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  p3: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const PRIORITY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2 };

const TASK_STATUS_ICON: Record<TaskStatus, { icon: React.ReactNode; color: string; label: string }> = {
  done: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400", label: "Done" },
  tested: { icon: <ShieldCheck className="h-3.5 w-3.5" />, color: "text-emerald-600 dark:text-emerald-400", label: "Tested" },
  implemented: { icon: <Code className="h-3.5 w-3.5" />, color: "text-cyan-600 dark:text-cyan-400", label: "Implemented" },
  in_progress: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: "text-blue-600 dark:text-blue-400", label: "In Progress" },
  sent_to_ai: { icon: <Send className="h-3.5 w-3.5" />, color: "text-indigo-600 dark:text-indigo-400", label: "Sent to AI" },
  prompt_ready: { icon: <FileText className="h-3.5 w-3.5" />, color: "text-purple-600 dark:text-purple-400", label: "Prompt Ready" },
  not_started: { icon: <Circle className="h-3.5 w-3.5" />, color: "text-gray-400", label: "Not Started" },
  blocked: { icon: <Ban className="h-3.5 w-3.5" />, color: "text-red-600 dark:text-red-400", label: "Blocked" },
  deferred: { icon: <Pause className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400", label: "Deferred" },
};

// ── Sub-components ──────────────────────────────────────────────────────────────

function HealthCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  href,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  sub: string;
  color: string;
  href?: string;
}) {
  const card = (
    <div className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-500/40 hover:shadow-sm cursor-pointer">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}

function StatusDot({ status }: { status: string }) {
  if (
    status === "completed" ||
    status === "accepted" ||
    status === "approved" ||
    status === "logged"
  ) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  }
  if (
    status === "cancelled" ||
    status === "rejected" ||
    status === "revoked"
  ) {
    return <Circle className="h-3.5 w-3.5 text-red-400" />;
  }
  return <Circle className="h-3.5 w-3.5 text-amber-400" />;
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function ProjectDashboard({
  projectId,
  locale,
  projectName,
  data,
  translations: t,
  entityLabels,
  milestones,
  tasks,
  roadmapProgress,
  statusDependencies,
  statusRisks,
  statusScope,
  userRole,
}: ProjectDashboardProps) {
  const router = useRouter();
  const base = localizedHref(locale, `/projects/${projectId}`);

  // REG-015 — deterministic project Status briefing, computed from the SAME
  // engine Isabella uses (REG-013). No parallel metric logic; terminal tasks are
  // never active blockers, waiting ≠ blocked (task-activity rules inside).
  const statusBriefing: ProjectBriefing = React.useMemo(
    () =>
      buildProjectBriefing({
        projectId,
        projectName,
        scope: statusScope,
        tasks,
        milestones,
        dependencies: statusDependencies.map((d) => ({
          id: `${d.predecessorId}->${d.successorId}`,
          organization_id: "",
          project_id: projectId,
          predecessor_id: d.predecessorId,
          successor_id: d.successorId,
          dependency_type: "finish_to_start",
          lag_days: 0,
          created_at: "",
        })) as TaskDependency[],
        risks: statusRisks,
        memory: { recentDecisions: [], unresolvedActions: [], recentNotes: [], available: false },
      }),
    [projectId, projectName, statusScope, tasks, milestones, statusDependencies, statusRisks],
  );

  // ── Resolve blocker handler (REG-BLOCKER-RESOLVE-OPENS-TASK) ─────────────────
  // "Resolve now" OPENS the blocked task in the Workboard editor so the user
  // decides what to do — it must NEVER mutate (no status change, no auto-resolve).
  // A plain navigation, so the button can never hang on a server action.
  const handleResolveBlocker = (taskId: string) => {
    router.push(buildBlockerResolveHref(base, taskId));
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  // Current & next milestone
  const currentMilestone = roadmapProgress.currentMilestoneId
    ? milestones.find((m) => m.id === roadmapProgress.currentMilestoneId) ?? null
    : null;
  const nextMilestone = roadmapProgress.nextMilestoneId
    ? milestones.find((m) => m.id === roadmapProgress.nextMilestoneId) ?? null
    : null;
  const currentMilestoneProgress = currentMilestone
    ? roadmapProgress.milestones[currentMilestone.id]
    : null;

  // Tasks for current milestone
  const currentMilestoneTasks = currentMilestone
    ? tasks.filter((task) => task.milestone_id === currentMilestone.id)
    : [];

  // Blocked tasks
  const blockedTasks = tasks.filter((task) => task.status === "blocked");

  // Upcoming tasks (not done, sorted by priority then order)
  const upcomingTasks = tasks
    .filter((task) => task.status !== "done" && task.status !== "blocked")
    .sort((a, b) => {
      const priDiff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (priDiff !== 0) return priDiff;
      return a.order_index - b.order_index;
    })
    .slice(0, 5);

  // Next recommended step: first blocked, then first upcoming
  const nextStep = blockedTasks[0] ?? upcomingTasks[0] ?? null;
  const nextStepMilestone = nextStep?.milestone_id
    ? milestones.find((m) => m.id === nextStep.milestone_id)
    : null;

  // Traceability health
  const traceHealth = data.totalEntities > 0
    ? Math.round((data.linkedEntityCount / data.totalEntities) * 100)
    : 0;

  // Missing links grouped by type
  const missingByType = data.missingLinkEntities.reduce(
    (acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Task stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const pendingTasks = totalTasks - doneTasks;
  const remainingHours = tasks
    .filter((task) => task.status !== "done")
    .reduce((sum, task) => sum + (task.estimate_hours ?? 0), 0);

  // Milestone stats
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.status === "completed").length;

  // Activity feed: merge communications + decisions + meetings, sort by date desc
  type ActivityItem = {
    id: string;
    type: "communication" | "decision" | "meeting";
    title: string;
    date: string | null;
    meta: string;
    status?: string;
  };

  const activityFeed: ActivityItem[] = [
    ...data.recentCommunications.map((c) => ({
      id: c.id,
      type: "communication" as const,
      title: c.title,
      date: c.date,
      meta: c.sourceType,
      status: undefined,
    })),
    ...data.recentDecisions.map((d) => ({
      id: d.id,
      type: "decision" as const,
      title: d.title,
      date: d.date,
      meta: d.status,
      status: d.status,
    })),
    ...data.recentMeetings.map((m) => ({
      id: m.id,
      type: "meeting" as const,
      title: m.title,
      date: m.date,
      meta: m.status,
      status: m.status,
    })),
  ]
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 7);

  const activityTypeIcon: Record<string, { icon: React.ReactNode; color: string }> = {
    communication: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: "text-teal-500" },
    decision: { icon: <Scale className="h-3.5 w-3.5" />, color: "text-amber-500" },
    meeting: { icon: <CalendarDays className="h-3.5 w-3.5" />, color: "text-blue-500" },
  };

  const activityTypeLabel: Record<string, string> = {
    communication: locale === "es" ? "comunicación" : "communication",
    decision: locale === "es" ? "decisión" : "decision",
    meeting: locale === "es" ? "reunión" : "meeting",
  };

  const activityRouteMap: Record<string, string> = {
    communication: "communications",
    decision: "decisions",
    meeting: "meetings",
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ════════════════════════════════════════════════════════════════════════
          1. BLOCKER ALERT BANNER
          ════════════════════════════════════════════════════════════════════════ */}
      {blockedTasks.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
              <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {blockedTasks.length} Blocker{blockedTasks.length > 1 ? "s" : ""} {locale === "es" ? "impide avanzar" : "blocking progress"}
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-400/80 truncate">
                {blockedTasks.map((bt) => bt.title).join(" · ")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleResolveBlocker(blockedTasks[0].id)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
          >
            <ArrowRight className="h-3 w-3" />
            {locale === "es" ? "Resolver ahora" : "Resolve now"}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2. HEALTH STRIP — 5 KPI cards
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <HealthCard
          icon={TrendingUp}
          label={locale === "es" ? "Progreso" : "Progress"}
          value={`${roadmapProgress.overallPercent}%`}
          sub={`${completedMilestones}/${totalMilestones} milestones`}
          color="text-brand-600 dark:text-brand-400"
          href={`${base}/execution-map`}
        />
        <HealthCard
          icon={CheckCircle2}
          label={locale === "es" ? "Completadas" : "Completed"}
          value={doneTasks}
          sub={`${locale === "es" ? "de" : "of"} ${totalTasks} ${locale === "es" ? "tareas" : "tasks"}`}
          color="text-green-600 dark:text-green-400"
          href={`${base}/workboard`}
        />
        <HealthCard
          icon={Clock}
          label={locale === "es" ? "Esfuerzo rest." : "Effort left"}
          value={`${remainingHours}h`}
          sub={`${pendingTasks} ${locale === "es" ? "tareas pendientes" : "pending tasks"}`}
          color="text-blue-600 dark:text-blue-400"
          href={`${base}/workboard`}
        />
        <HealthCard
          icon={Ban}
          label="Blockers"
          value={roadmapProgress.blockersCount}
          sub={roadmapProgress.blockersCount > 0
            ? (blockedTasks[0]?.priority === "p1" ? "P1 — Critical" : blockedTasks[0]?.priority === "p2" ? "P2 — Medium" : "P3 — Low")
            : (locale === "es" ? "Sin bloqueos" : "No blockers")
          }
          color={roadmapProgress.blockersCount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
          href={`${base}/workboard`}
        />
        <HealthCard
          icon={Link2}
          label={locale === "es" ? "Trazabilidad" : "Traceability"}
          value={`${traceHealth}%`}
          sub={`${data.missingLinkEntities.length} ${locale === "es" ? "enlaces faltantes" : "missing links"}`}
          color={traceHealth >= 80 ? "text-green-600 dark:text-green-400" : traceHealth >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2b. PROJECT STATUS (REG-015) + REPORTS & EXECUTIVE OUTPUTS (UX-009)
          Status lives in Command Center now (not a buried tab); Closeout Report
          is promoted near the top instead of below all activity cards.
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Project Status — explained, deterministic (shared engine w/ Isabella) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "es" ? "Estado del Proyecto" : "Project Status"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {locale === "es"
                    ? "Salud, riesgos, progreso y áreas que requieren atención."
                    : "Explained health, risks, progress, and recommended attention areas."}
                </p>
              </div>
            </div>
            <StatusBandChip band={statusBriefing.healthBand} locale={locale} />
          </div>

          <p className="text-sm text-foreground">{overallStatusLine(statusBriefing, locale as Locale)}</p>

          {/* Quick numbers */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>{locale === "es" ? "Completado" : "Complete"}: <strong className="text-foreground">{statusBriefing.overview.percentComplete}%</strong></span>
            <span>Blockers: <strong className={statusBriefing.execution.activeBlockers > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}>{statusBriefing.execution.activeBlockers}</strong></span>
            <span>{locale === "es" ? "En espera" : "Waiting"}: <strong className="text-foreground">{statusBriefing.execution.waitingOnDependency}</strong></span>
            <span>{locale === "es" ? "Vencidas" : "Overdue"}: <strong className={statusBriefing.execution.overdue > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>{statusBriefing.execution.overdue}</strong></span>
            <span>{locale === "es" ? "Hitos en riesgo" : "At-risk milestones"}: <strong className={statusBriefing.execution.atRiskMilestones > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>{statusBriefing.execution.atRiskMilestones}</strong></span>
          </div>

          {/* Top-3 attention, or stable */}
          {statusBriefing.attention.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {statusBriefing.attention.slice(0, 3).map((a) => (
                <li key={a.key} className="flex items-center gap-2 text-xs text-foreground">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                  {attentionLabel(a.key, a.count, locale as Locale)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 py-1.5 text-xs text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
              {allStableLine(locale as Locale)}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`${base}/status`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
            >
              {locale === "es" ? "Ver estado completo" : "View full status"} <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-brand-500" />
              {locale === "es" ? "Pregúntale a Isabella sobre este estado" : "Ask Isabella to explain this status"}
            </span>
          </div>
        </div>

        {/* Reports & Executive Outputs — Closeout promoted to the top */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-foreground">
              {locale === "es" ? "Reportes y Salidas Ejecutivas" : "Reports & Executive Outputs"}
            </h3>
          </div>
          <div className="space-y-2">
            <Link
              href={`${base}/closeout`}
              className="group flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/60 p-3 transition-colors hover:bg-brand-100/60 dark:border-brand-500/20 dark:bg-brand-500/5 dark:hover:bg-brand-500/10"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileBarChart className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{locale === "es" ? "Reporte de Cierre" : "Closeout Report"}</p>
                  <p className="text-[11px] text-muted-foreground">{locale === "es" ? "Métricas y resumen ejecutivo · PDF" : "Metrics & executive summary · PDF"}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400" />
            </Link>
            <Link
              href={`${base}/status`}
              className="group flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{locale === "es" ? "Reporte de Estado" : "Status Report"}</p>
                  <p className="text-[11px] text-muted-foreground">{locale === "es" ? "Estado de proyecto explicado" : "Explained project status"}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400" />
            </Link>
            {/* CAP — Project Export: Full Archive (as executed) or Starter Blueprint (template). */}
            <ExportProjectButton locale={locale} projectId={projectId} role={userRole} />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          3. TWO COLUMNS: Main content (2/3) + Sidebar (1/3)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Left column (2/3) ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* 3a. Next recommended step */}
          {nextStep && (
            <div className="rounded-xl border border-brand-200 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-500/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {locale === "es" ? "Siguiente paso recomendado" : "Next recommended step"}
                  </h3>
                </div>
                {nextStep.status === "blocked" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
                    <Ban className="h-2.5 w-2.5" /> {locale === "es" ? "Bloqueado" : "Blocked"}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">
                    {nextStep.title}
                  </p>
                  {nextStepMilestone && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nextStepMilestone.title}
                    </p>
                  )}
                  {nextStep.status === "blocked" && nextStep.description && (
                    <p className="mt-2 text-xs text-red-700/80 dark:text-red-400/80 line-clamp-2">
                      {nextStep.description}
                    </p>
                  )}
                </div>
                <Link
                  href={`${base}/workboard`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  {locale === "es" ? "Ver tarea" : "View task"} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* 3b. Current Milestone */}
          {currentMilestone && currentMilestoneProgress && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {locale === "es" ? "Milestone Actual" : "Current Milestone"} — {currentMilestone.title}
                  </h3>
                </div>
                <Link
                  href={`${base}/execution-map`}
                  className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {locale === "es" ? "Ver roadmap" : "View roadmap"} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Milestone meta */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                {currentMilestone.start_date && currentMilestone.target_date && (
                  <span>
                    {new Date(currentMilestone.start_date).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" })}
                    {" — "}
                    {new Date(currentMilestone.target_date).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" })}
                  </span>
                )}
                <span>{currentMilestoneProgress.doneTasks}/{currentMilestoneProgress.totalTasks} {locale === "es" ? "tareas" : "tasks"} · {currentMilestoneProgress.progressPercent}%</span>
                {nextMilestone && (
                  <span className="hidden sm:inline">
                    {locale === "es" ? "Próximo" : "Next"}: {nextMilestone.title}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    currentMilestoneProgress.progressPercent === 100 ? "bg-green-500" : "bg-brand-600 dark:bg-brand-500"
                  }`}
                  style={{ width: `${currentMilestoneProgress.progressPercent}%` }}
                />
              </div>

              {/* Task list */}
              <div className="space-y-1">
                {currentMilestoneTasks.map((task) => {
                  const taskStyle = TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.not_started;
                  const priorityBadge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.p2;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className={taskStyle.color}>{taskStyle.icon}</span>
                      <span className="text-xs text-foreground truncate flex-1">{task.title}</span>
                      <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${priorityBadge}`}>
                        {task.priority.toUpperCase()}
                      </span>
                      {task.estimate_hours != null && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{task.estimate_hours}h</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3f. Upcoming Tasks */}
          {upcomingTasks.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "es" ? "Próximas tareas" : "Upcoming Tasks"}
                </h3>
                <Link
                  href={`${base}/workboard`}
                  className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {locale === "es" ? "Ver workboard" : "View workboard"} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1">
                {upcomingTasks.map((task) => {
                  const taskStyle = TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.not_started;
                  const priorityBadge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.p2;
                  const milestone = task.milestone_id
                    ? milestones.find((m) => m.id === task.milestone_id)
                    : null;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className={taskStyle.color}>{taskStyle.icon}</span>
                      <span className="text-xs text-foreground truncate flex-1">{task.title}</span>
                      <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${priorityBadge}`}>
                        {task.priority.toUpperCase()}
                      </span>
                      {milestone && (
                        <span className="shrink-0 text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                          {milestone.title.split("—")[0]?.trim()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column (1/3) ───────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* 3c. Activity feed */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "es" ? "Actividad reciente" : "Recent Activity"}
                </h3>
              </div>
              <Link
                href={`${base}/memory`}
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {t.viewAll} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {activityFeed.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground italic">{t.noData}</p>
            ) : (
              <div className="space-y-1.5">
                {activityFeed.map((item) => {
                  const typeInfo = activityTypeIcon[item.type];
                  const route = activityRouteMap[item.type];
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={`${base}/${route}`}
                      className="group flex items-start gap-2.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-muted/50"
                    >
                      <span className={`mt-0.5 shrink-0 ${typeInfo.color}`}>{typeInfo.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {activityTypeLabel[item.type]}
                          </span>
                          {item.status && <StatusDot status={item.status} />}
                          {item.date && (
                            <span className="text-[10px] text-muted-foreground">
                              · {new Date(item.date).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3d. Traceability pending */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "es" ? "Trazabilidad pendiente" : "Pending Traceability"}
                </h3>
              </div>
              {data.missingLinkEntities.length > 0 && (
                <Link
                  href={`${base}/decisions`}
                  className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  {locale === "es" ? "Resolver" : "Resolve"} <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {data.linkedEntityCount} {locale === "es" ? "de" : "of"} {data.totalEntities} {locale === "es" ? "registros enlazados" : "records linked"}
                </span>
                <span className="text-xs font-semibold text-foreground">{traceHealth}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    traceHealth >= 80 ? "bg-green-500" : traceHealth >= 50 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${traceHealth}%` }}
                />
              </div>
            </div>

            {data.missingLinkEntities.length === 0 ? (
              <div className="flex items-center gap-2 py-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="text-xs text-green-600 dark:text-green-400">{t.none}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(missingByType).map(([type, count]) => {
                  const typeLabel = entityLabels[type] || type;
                  const routeMap: Record<string, string> = {
                    decision: "decisions",
                    meeting: "meetings",
                    communication: "communications",
                    document: "documents",
                  };
                  const route = routeMap[type] || type;
                  return (
                    <Link
                      key={type}
                      href={`${base}/${route}`}
                      className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs transition-colors hover:bg-amber-100 dark:hover:bg-amber-950/50"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span className="font-medium text-amber-800 dark:text-amber-300">
                          {typeLabel} {locale === "es" ? "sin traza" : "without links"}
                        </span>
                      </div>
                      <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-200 dark:bg-amber-800 px-1.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                        {count}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3e. Key Documents */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "es" ? "Documentos clave" : "Key Documents"}
                </h3>
              </div>
              <Link
                href={`${base}/documents`}
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {t.viewAll} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {data.recentDocuments.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground italic">{t.noData}</p>
            ) : (
              <div className="space-y-1.5">
                {data.recentDocuments.map((doc) => {
                  const isLinked = !data.missingLinkEntities.some(
                    (m) => m.id === doc.id && m.type === "document",
                  );
                  return (
                    <Link
                      key={doc.id}
                      href={`${base}/documents/${doc.id}`}
                      className="group flex items-center gap-2.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-muted/50"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                      <span className="text-xs font-medium text-foreground truncate flex-1 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {doc.title}
                      </span>
                      {isLinked ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Closeout Report was promoted to "Reports & Executive Outputs" near
              the top of the dashboard (UX-009). */}
        </div>
      </div>
    </div>
  );
}

// ── Status health band chip (REG-015) ────────────────────────────────────────
function StatusBandChip({ band, locale }: { band: ProjectBriefing["healthBand"]; locale: string }) {
  const tone: Record<ProjectBriefing["healthBand"], string> = {
    healthy: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    watch: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    at_risk: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone[band]}`}>
      {healthBandLabel(band, locale === "es" ? "es" : "en")}
    </span>
  );
}
