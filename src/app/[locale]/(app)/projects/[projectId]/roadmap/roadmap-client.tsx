"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Map, LayoutList, Columns3, ListTodo, Network, PlusCircle, Calendar } from "lucide-react";
import type { Milestone, MilestoneStatus, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import type { NextStepRecommendation } from "@/lib/roadmap/recommendation";
import { RoadmapHero } from "@/components/roadmap/roadmap-hero";
import { NextStepPanel } from "@/components/roadmap/next-step-panel";
import { ExecutionDashboard } from "@/components/roadmap/execution-dashboard";
import { VisualRoadmapTimeline } from "@/components/roadmap/visual-roadmap-timeline";
import { FlowRoadmap, type FlowRoadmapTranslations } from "@/components/roadmap/flow-roadmap";
import { GanttRoadmap } from "@/components/roadmap/gantt-roadmap";
import { MilestoneBoard } from "@/components/roadmap/milestone-board";
import { TaskListByMilestone } from "@/components/roadmap/task-list-by-milestone";
import { MilestoneFormDialog } from "@/components/roadmap/milestone-form-dialog";
import { TaskFormDialog } from "@/components/roadmap/task-form-dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = "timeline" | "board" | "tasks" | "flow" | "gantt";

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

interface TaskListTranslations {
  title: string;
  filterByStatus: string;
  allStatuses: string;
  selectMilestone: string;
  noTasksForMilestone: string;
  progressCount: string;
  remaining: string;
  dependencyNotes: string;
  executionNotes: string;
  blockerReason: string;
  acceptanceCriteria: string;
  updateStatus: string;
  statusUpdated: string;
  statusUpdateFailed: string;
  estimate: string;
  actual: string;
  noEstimate: string;
  unassigned: string;
  copyPrompt: string;
  copiedPrompt: string;
  markAsSentToAi: string;
  promptWarning: string;
  promptLabel: string;
  promptContextLabel: string;
  aiToolLabel: string;
  lastSentLabel: string;
  implementationNotesLabel: string;
  testNotesLabel: string;
  dependencyWarning: string;
  dependencyComplete: string;
  dependencyIncomplete: string;
  auditTrail: string;
  auditTrailEmpty: string;
  statusChanged: string;
  promptCopied: string;
  promptSent: string;
  taskBlocked: string;
  taskCompleted: string;
  taskUnblocked: string;
  editTask: string;
  archiveTask: string;
  confirmArchiveTask: string;
  editMilestone: string;
  archiveMilestone: string;
  confirmArchiveMilestone: string;
  addPredecessor: string;
  addPredecessorPlaceholder: string;
  predecessorAdded: string;
  predecessorExists: string;
  cancel: string;
  noMatchingTasks: string;
  circularDependencyError: string;
  dependencyAddError: string;
}

interface NextStepPanelTranslations {
  title: string;
  onTrack: string;
  viewTask: string;
  resolveBlocker: string;
  runPrompt: string;
  markCompleted: string;
}

interface ExecutionDashboardTranslations {
  title: string;
  promptReady: string;
  sentToAi: string;
  implemented: string;
  tested: string;
  blocked: string;
  completed: string;
  notStarted: string;
  inProgress: string;
  deferred: string;
  currentSprint: string;
  noSprint: string;
  recentChanges: string;
  noRecentChanges: string;
}

interface MilestoneFormTranslations {
  createTitle: string;
  editTitle: string;
  cancel: string;
  save: string;
  creating: string;
  saving: string;
  errors: Record<string, string>;
  statusLabels: Record<string, string>;
  iconLabels: Record<string, string>;
  lockStatus: string;
  lockStatusDescription: string;
  computedStatusNote: string;
  fields: {
    title: string;
    titlePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    status: string;
    startDate: string;
    targetDate: string;
    iconKey: string;
  };
}

interface TaskFormTranslations {
  createTitle: string;
  editTitle: string;
  cancel: string;
  save: string;
  creating: string;
  saving: string;
  errors: Record<string, string>;
  statusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  fields: {
    title: string;
    titlePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    milestone: string;
    milestonePlaceholder: string;
    noMilestone: string;
    status: string;
    priority: string;
    sprintName: string;
    sprintNamePlaceholder: string;
    estimateHours: string;
    estimateHoursPlaceholder: string;
    acceptanceCriteria: string;
    acceptanceCriteriaPlaceholder: string;
    dependencyNotes: string;
    dependencyNotesPlaceholder: string;
    executionNotes: string;
    executionNotesPlaceholder: string;
    blockerReason: string;
    blockerReasonPlaceholder: string;
    scheduling: string;
    startDate: string;
    endDate: string;
    progress: string;
    progressUnit: string;
    durationDays: string;
    promptSection: string;
    promptBody: string;
    promptBodyPlaceholder: string;
    promptContext: string;
    promptContextPlaceholder: string;
    aiToolTarget: string;
    aiToolTargetPlaceholder: string;
    implementationNotes: string;
    implementationNotesPlaceholder: string;
    testNotes: string;
    testNotesPlaceholder: string;
  };
}

interface Translations {
  title: string;
  description: string;
  milestones: string;
  tasks: string;
  empty: string;
  emptyDescription: string;
  noTasks: string;
  dateRange: string;
  noDate: string;
  taskCount: string;
  sprint: string;
  hours: string;
  statusLabels: Record<MilestoneStatus | TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  taskList: TaskListTranslations;
  nextStep: NextStepPanelTranslations;
  executionDashboard: ExecutionDashboardTranslations;
  form: {
    createMilestone: string;
    editMilestone: string;
    createTask: string;
    editTask: string;
    cancel: string;
    save: string;
    creating: string;
    saving: string;
    milestoneCreated: string;
    milestoneUpdated: string;
    taskCreated: string;
    taskUpdated: string;
    errors: Record<string, string>;
    milestone: {
      title: string;
      titlePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      status: string;
      startDate: string;
      targetDate: string;
      iconKey: string;
      iconKeys: Record<string, string>;
    };
    task: {
      title: string;
      titlePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      milestone: string;
      milestonePlaceholder: string;
      noMilestone: string;
      status: string;
      priority: string;
      sprintName: string;
      sprintNamePlaceholder: string;
      estimateHours: string;
      estimateHoursPlaceholder: string;
      acceptanceCriteria: string;
      acceptanceCriteriaPlaceholder: string;
      dependencyNotes: string;
      dependencyNotesPlaceholder: string;
      executionNotes: string;
      executionNotesPlaceholder: string;
      blockerReason: string;
      blockerReasonPlaceholder: string;
      scheduling: string;
      startDate: string;
      endDate: string;
      progress: string;
      progressUnit: string;
      durationDays: string;
      promptSection: string;
      promptBody: string;
      promptBodyPlaceholder: string;
      promptContext: string;
      promptContextPlaceholder: string;
      aiToolTarget: string;
      aiToolTargetPlaceholder: string;
      implementationNotes: string;
      implementationNotesPlaceholder: string;
      testNotes: string;
      testNotesPlaceholder: string;
    };
  };
}

interface RoadmapClientProps {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  taskCounts: Record<string, TaskCount>;
  progress: RoadmapProgress;
  nextStep: NextStepRecommendation | null;
  locale: Locale;
  translations: Translations;
}

// ── Component ────────────────────────────────────────────────────────────────────

export function RoadmapClient({
  projectId,
  projectTitle,
  milestones,
  tasks,
  taskCounts,
  progress,
  nextStep,
  locale,
  translations: t,
}: RoadmapClientProps) {
  const router = useRouter();
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    milestones.forEach((m) => {
      if (m.status === "in_progress") initial.add(m.id);
    });
    return initial;
  });

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  const [preselectedMilestoneId, setPreselectedMilestoneId] = useState<string | undefined>(undefined);

  const toggleMilestone = (id: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = () => {
    router.refresh();
  };

  // Group tasks by milestone
  const tasksByMilestone: Record<string, RoadmapTask[]> = {};
  for (const task of tasks) {
    if (task.milestone_id) {
      const arr = tasksByMilestone[task.milestone_id] ?? [];
      arr.push(task);
      tasksByMilestone[task.milestone_id] = arr;
    }
  }

  // Milestone form translations
  const milestoneFormT: MilestoneFormTranslations = {
    createTitle: t.form.createMilestone,
    editTitle: t.form.editMilestone,
    cancel: t.form.cancel,
    save: t.form.save,
    creating: t.form.creating,
    saving: t.form.saving,
    errors: t.form.errors,
    statusLabels: t.statusLabels as Record<string, string>,
    iconLabels: t.form.milestone.iconKeys,
    lockStatus: (t.form.milestone as Record<string, unknown>).lockStatus as string ?? "Lock status override",
    lockStatusDescription: (t.form.milestone as Record<string, unknown>).lockStatusDescription as string ?? "When locked, the status won't be auto-calculated from task completion.",
    computedStatusNote: (t.form.milestone as Record<string, unknown>).computedStatusNote as string ?? "Status is auto-computed from task completion.",
    fields: t.form.milestone,
  };

  // Task form translations
  const taskFormT: TaskFormTranslations = {
    createTitle: t.form.createTask,
    editTitle: t.form.editTask,
    cancel: t.form.cancel,
    save: t.form.save,
    creating: t.form.creating,
    saving: t.form.saving,
    errors: t.form.errors,
    statusLabels: t.statusLabels as Record<string, string>,
    priorityLabels: t.priorityLabels as Record<string, string>,
    fields: {
      ...t.form.task,
      executionNotes: t.form.task.executionNotes ?? "",
      executionNotesPlaceholder: t.form.task.executionNotesPlaceholder ?? "",
      blockerReason: t.form.task.blockerReason ?? "",
      blockerReasonPlaceholder: t.form.task.blockerReasonPlaceholder ?? "",
    },
  };

  // Hero translations
  const heroTranslations = {
    currentPhase: locale === "es" ? "Fase actual" : "Current phase",
    currentMilestone: locale === "es" ? "Hito actual" : "Current milestone",
    nextMilestone: locale === "es" ? "Siguiente hito" : "Next milestone",
    overallProgress: locale === "es" ? "Progreso general" : "Overall progress",
    blockers: locale === "es" ? "Bloqueos" : "Blockers",
    noBlockers: locale === "es" ? "Sin bloqueos" : "No blockers",
    milestones: t.milestones,
    tasks: t.tasks,
    completed: locale === "es" ? "Completados" : "Completed",
    inProgress: locale === "es" ? "En progreso" : "In progress",
    planned: locale === "es" ? "Planificados" : "Planned",
    blocked: locale === "es" ? "Bloqueados" : "Blocked",
    noNext: locale === "es" ? "Sin siguiente hito" : "No next milestone",
  };

  // Flow view translations
  const es = locale === "es";
  const flowTranslations: FlowRoadmapTranslations = {
    statusLabels: t.statusLabels,
    priorityLabels: t.priorityLabels,
    liveProcessFlow: es ? "Flujo de proceso en vivo" : "Live process flow",
    conformance: es ? "conformidad" : "conformance",
    currentPhase: es ? "Fase actual" : "Current phase",
    tasks: t.tasks,
    noTasks: t.noTasks,
    reworkNeeded: es ? "{count} tareas bloqueadas — requiere retrabajo" : "{count} blocked tasks — rework needed",
    kpiMilestonesCompleted: es ? "Hitos completados" : "Milestones completed",
    kpiOverallProgress: es ? "Progreso general" : "Overall progress",
    kpiTasksCompleted: es ? "Tareas completadas" : "Tasks completed",
    kpiInProgress: es ? "En progreso" : "In progress",
    kpiBlockers: es ? "Bloqueos" : "Blockers",
    kpiRemainingEffort: es ? "Esfuerzo restante" : "Remaining effort",
    kpiOfTotal: es ? "de {total}" : "of {total}",
    kpiNoBlockers: es ? "Sin bloqueos" : "No blockers",
    kpiTracked: es ? "de {total} registradas" : "of {total} tracked",
    milestoneDistribution: es ? "Distribución de hitos" : "Milestone distribution",
    conformanceCheck: es ? "Conformidad" : "Conformance check",
    taskByPriority: es ? "Tareas por prioridad" : "Tasks by priority",
    blockersRecommendations: es ? "Bloqueos y recomendaciones" : "Blockers & recommendations",
    noBlockers: es ? "Sin bloqueos. El flujo avanza sin problemas." : "No blockers. Flow is running smoothly.",
    completed: es ? "Completados" : "Completed",
    inProgress: es ? "En progreso" : "In progress",
    planned: es ? "Planificados" : "Planned",
    blocked: es ? "Bloqueados" : "Blocked",
    unblockSuggestion: es ? "Prioriza desbloquear para restaurar el flujo" : "Prioritize unblocking to restore flow",
    legend: es ? "Leyenda" : "Legend",
    legendActiveFlow: es ? "Flujo activo" : "Active flow",
    legendPendingPath: es ? "Ruta pendiente" : "Pending path",
  };

  if (milestones.length === 0) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === "es" ? "Volver al proyecto" : "Back to project"}
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Map className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold text-foreground">{t.empty}</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">{t.emptyDescription}</p>
          <button
            type="button"
            onClick={() => { setEditingMilestone(null); setShowMilestoneForm(true); }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <PlusCircle className="h-4 w-4" />
            {t.form.createMilestone}
          </button>
        </div>

        {showMilestoneForm && (
          <MilestoneFormDialog
            mode="create"
            projectId={projectId}
            locale={locale}
            milestones={milestones}
            onClose={() => setShowMilestoneForm(false)}
            onSaved={handleRefresh}
            translations={milestoneFormT}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {locale === "es" ? "Volver al proyecto" : "Back to project"}
        </Link>
      </div>

      {/* Page title + actions */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{projectTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setEditingTask(null); setPreselectedMilestoneId(undefined); setShowTaskForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {t.form.createTask}
          </button>
          <button
            type="button"
            onClick={() => { setEditingMilestone(null); setShowMilestoneForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {t.form.createMilestone}
          </button>
        </div>
      </div>

      {/* Hero: current phase, progress, blockers */}
      <div className="mb-8">
        <RoadmapHero
          milestones={milestones}
          tasks={tasks}
          taskCounts={taskCounts}
          progress={progress}
          locale={locale}
          translations={heroTranslations}
        />
      </div>

      {/* Recommended next step */}
      {nextStep && (
        <div className="mb-6">
          <NextStepPanel
            recommendation={nextStep}
            milestones={milestones}
            locale={locale}
            translations={{
              title: t.nextStep.title,
              onTrack: t.nextStep.onTrack,
              viewTask: t.nextStep.viewTask,
              resolveBlocker: t.nextStep.resolveBlocker,
              runPrompt: t.nextStep.runPrompt,
              markCompleted: t.nextStep.markCompleted,
            }}
          />
        </div>
      )}

      {/* Execution Dashboard */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t.executionDashboard.title}
        </h3>
        <ExecutionDashboard
          tasks={tasks}
          nextStep={nextStep}
          locale={locale}
          translations={t.executionDashboard}
          onStatusFilter={(status) => {
            setViewMode("tasks");
            // Status filter is handled within TaskListByMilestone
          }}
        />
      </div>

      {/* View toggle */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t.milestones}
        </h2>
        <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "timeline"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            {locale === "es" ? "Línea de tiempo" : "Timeline"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "board"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            {locale === "es" ? "Tablero" : "Board"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tasks")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "tasks"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            {locale === "es" ? "Tareas" : "Tasks"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flow")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "flow"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            {locale === "es" ? "Flujo" : "Flow"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("gantt")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "gantt"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {locale === "es" ? "Cronograma" : "Gantt"}
          </button>
        </div>
      </div>

      {/* View: Timeline, Board, Tasks, Flow or Gantt */}
      {viewMode === "gantt" ? (
        <GanttRoadmap
          milestones={milestones}
          progress={progress}
          tasksByMilestone={tasksByMilestone}
          taskCounts={taskCounts}
          locale={locale}
          translations={{
            statusLabels: t.statusLabels,
            priorityLabels: t.priorityLabels,
            tasks: t.tasks,
            noTasks: t.noTasks,
            noDate: t.noDate,
            schedule: locale === "es" ? "Cronograma" : "Schedule",
            milestone: locale === "es" ? "Hito" : "Milestone",
          }}
        />
      ) : viewMode === "flow" ? (
        <FlowRoadmap
          milestones={milestones}
          tasks={tasks}
          progress={progress}
          tasksByMilestone={tasksByMilestone}
          taskCounts={taskCounts}
          locale={locale}
          translations={flowTranslations}
        />
      ) : viewMode === "timeline" ? (
        <VisualRoadmapTimeline
          milestones={milestones}
          progress={progress}
          tasksByMilestone={tasksByMilestone}
          taskCounts={taskCounts}
          expandedMilestones={expandedMilestones}
          onToggleMilestone={toggleMilestone}
          locale={locale}
          translations={{
            statusLabels: t.statusLabels,
            priorityLabels: t.priorityLabels,
            tasks: t.tasks,
            noTasks: t.noTasks,
            sprint: t.sprint,
          }}
        />
      ) : viewMode === "board" ? (
        <MilestoneBoard
          milestones={milestones}
          progress={progress}
          tasksByMilestone={tasksByMilestone}
          taskCounts={taskCounts}
          expandedMilestones={expandedMilestones}
          onToggleMilestone={toggleMilestone}
          locale={locale}
          translations={{
            statusLabels: t.statusLabels,
            priorityLabels: t.priorityLabels,
            tasks: t.tasks,
            noTasks: t.noTasks,
            sprint: t.sprint,
            noDate: t.noDate,
          }}
        />
      ) : (
        <TaskListByMilestone
          projectId={projectId}
          milestones={milestones}
          tasks={tasks}
          taskCounts={taskCounts}
          locale={locale}
          translations={{
            ...t.taskList,
            executionNotes: t.taskList.executionNotes,
            blockerReason: t.taskList.blockerReason,
            statusLabels: t.statusLabels,
            priorityLabels: t.priorityLabels,
            sprint: t.sprint,
            hours: t.hours,
            editTask: (t.taskList as unknown as Record<string, unknown>).editTask as string ?? "Edit task",
            archiveTask: (t.taskList as unknown as Record<string, unknown>).archiveTask as string ?? "Archive task",
            confirmArchiveTask: (t.taskList as unknown as Record<string, unknown>).confirmArchiveTask as string ?? "Are you sure?",
            editMilestone: (t.taskList as unknown as Record<string, unknown>).editMilestone as string ?? "Edit milestone",
            archiveMilestone: (t.taskList as unknown as Record<string, unknown>).archiveMilestone as string ?? "Archive milestone",
            confirmArchiveMilestone: (t.taskList as unknown as Record<string, unknown>).confirmArchiveMilestone as string ?? "Are you sure?",
          }}
          onEditTask={(task) => { setEditingTask(task); setShowTaskForm(true); }}
          onArchiveTask={async (taskId) => {
            const { archiveTaskAction } = await import("@/app/[locale]/(app)/projects/[projectId]/roadmap/actions");
            await archiveTaskAction(taskId, projectId);
            router.refresh();
          }}
          onEditMilestone={(milestone) => { setEditingMilestone(milestone); setShowMilestoneForm(true); }}
          onArchiveMilestone={async (milestoneId) => {
            const { archiveMilestoneAction } = await import("@/app/[locale]/(app)/projects/[projectId]/roadmap/actions");
            await archiveMilestoneAction(milestoneId, projectId);
            router.refresh();
          }}
        />
      )}

      {/* Forms */}
      {showMilestoneForm && (
        <MilestoneFormDialog
          mode={editingMilestone ? "edit" : "create"}
          projectId={projectId}
          locale={locale}
          milestones={milestones}
          milestone={editingMilestone ?? undefined}
          onClose={() => { setShowMilestoneForm(false); setEditingMilestone(null); }}
          onSaved={handleRefresh}
          translations={milestoneFormT}
        />
      )}

      {showTaskForm && (
        <TaskFormDialog
          mode={editingTask ? "edit" : "create"}
          projectId={projectId}
          locale={locale}
          milestones={milestones}
          preselectedMilestoneId={preselectedMilestoneId}
          task={editingTask ?? undefined}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); setPreselectedMilestoneId(undefined); }}
          onSaved={handleRefresh}
          translations={taskFormT}
        />
      )}
    </div>
  );
}