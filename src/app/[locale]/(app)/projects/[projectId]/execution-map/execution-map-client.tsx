"use client";

import { useState, Suspense } from "react";
import { localizedHref } from "@/i18n/href";
import { useRouter } from "next/navigation";
import {
  Map, LayoutList, Columns3, ListTodo, Network, Calendar,
  PlusCircle, AlertTriangle, GitBranch, Clock, Eye, Share2,
} from "lucide-react";
import type { Milestone, MilestoneStatus, RoadmapTask, TaskStatus, TaskPriority, Locale, TaskDependency, DependencyType } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import type { NextStepRecommendation, RecommendationAction } from "@/lib/roadmap/recommendation";
import { RoadmapHero } from "@/components/roadmap/roadmap-hero";
import { NextStepPanel } from "@/components/roadmap/next-step-panel";
import { ExecutionDashboard } from "@/components/roadmap/execution-dashboard";
import { VisualRoadmapTimeline } from "@/components/roadmap/visual-roadmap-timeline";
import { GanttRoadmap } from "@/components/roadmap/gantt-roadmap";
import { DependenciesView } from "@/components/roadmap/dependencies-view";
import { updateTaskDatesAction } from "./dependency-actions";
import { MilestoneBoard } from "@/components/roadmap/milestone-board";
import { TaskListByMilestone } from "@/components/roadmap/task-list-by-milestone";
import { MilestoneFormDialog } from "@/components/roadmap/milestone-form-dialog";
import { TaskFormDialog } from "@/components/roadmap/task-form-dialog";
import { OnboardingSpotlight } from "@/components/roadmap/onboarding-spotlight";
import { sortTasksByMilestoneAndDependency } from "@/lib/roadmap/topological-sort";

// ── Types ──────────────────────────────────────────────────────────────────────

type ExecutionTab = "overview" | "timeline" | "tasks" | "gantt" | "critical-path" | "dependencies";

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
  dependsOn?: string;
  showPrompt?: string;
  hidePrompt?: string;
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
    sectionDetails?: string;
    sectionTracking?: string;
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
      sectionDetails?: string;
      sectionTracking?: string;
    };
  };
}

interface ExecutionMapClientProps {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  taskCounts: Record<string, TaskCount>;
  progress: RoadmapProgress;
  nextStep: NextStepRecommendation | null;
  dependencies: TaskDependency[];
  locale: Locale;
  translations: Translations;
  onboard?: boolean;
}

// ── Tab Configuration ──────────────────────────────────────────────────────────

const TAB_CONFIG: { key: ExecutionTab; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { key: "overview", icon: Eye, labelKey: "overview" },
  { key: "timeline", icon: LayoutList, labelKey: "timeline" },
  { key: "tasks", icon: ListTodo, labelKey: "tasks" },
  { key: "gantt", icon: Calendar, labelKey: "gantt" },
  { key: "critical-path", icon: AlertTriangle, labelKey: "criticalPath" },
  { key: "dependencies", icon: GitBranch, labelKey: "dependencies" },
];

// ── Helper: Group tasks by milestone (dependency-aware) ────────────────────────────

// ── Component ────────────────────────────────────────────────────────────────────

export function ExecutionMapClient({
  projectId,
  projectTitle,
  milestones,
  tasks,
  taskCounts,
  progress,
  nextStep,
  dependencies,
  locale,
  translations: t,
  onboard,
}: ExecutionMapClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ExecutionTab>("overview");
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  const [preselectedMilestoneId, setPreselectedMilestoneId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);

  const tasksByMilestone = sortTasksByMilestoneAndDependency(tasks, dependencies, milestones);

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

  // Handle NextStepPanel actions (resolve blocker, run prompt, mark completed)
  const handleTaskAction = async (taskId: string, action: RecommendationAction) => {
    if (action === "resolve_blocker") {
      const { updateTaskStatusAction } = await import("../roadmap/actions");
      await updateTaskStatusAction({ taskId, status: "done", projectId });
      router.refresh();
    } else if (action === "mark_completed") {
      const { updateTaskStatusAction } = await import("../roadmap/actions");
      await updateTaskStatusAction({ taskId, status: "done", projectId });
      router.refresh();
    } else if (action === "run_prompt") {
      // Scroll to the task in the task list so user can copy the prompt
      const el = document.getElementById(`task-${taskId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-brand-500", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-brand-500", "ring-offset-2"), 3000);
      }
    }
  };

  // ── Tab Labels ────────────────────────────────────────────────────────────────

  const tabLabels: Record<ExecutionTab, string> = {
    overview: locale === "es" ? "Vista General" : "Overview",
    timeline: locale === "es" ? "Línea de Tiempo" : "Timeline",
    tasks: locale === "es" ? "Tareas" : "Tasks",
    gantt: locale === "es" ? "Cronograma" : "Gantt",
    "critical-path": locale === "es" ? "Ruta Crítica" : "Critical Path",
    dependencies: locale === "es" ? "Dependencias" : "Dependencies",
  };

  // ── Form Translation Helpers ──────────────────────────────────────────────────

  const milestoneFormT: MilestoneFormTranslations = {
    createTitle: t.form.createMilestone,
    editTitle: t.form.editMilestone,
    cancel: t.form.cancel,
    save: t.form.save,
    creating: t.form.creating,
    saving: t.form.saving,
    errors: t.form.errors,
    statusLabels: t.statusLabels,
    iconLabels: t.form.milestone.iconKeys,
    lockStatus: (t.form.milestone as Record<string, unknown>).lockStatus as string ?? "Lock status override",
    lockStatusDescription: (t.form.milestone as Record<string, unknown>).lockStatusDescription as string ?? "When locked, the status won't be auto-calculated from task completion.",
    computedStatusNote: (t.form.milestone as Record<string, unknown>).computedStatusNote as string ?? "Status is auto-computed from task completion.",
    fields: {
      title: t.form.milestone.title,
      titlePlaceholder: t.form.milestone.titlePlaceholder,
      description: t.form.milestone.description,
      descriptionPlaceholder: t.form.milestone.descriptionPlaceholder,
      status: t.form.milestone.status,
      startDate: t.form.milestone.startDate,
      targetDate: t.form.milestone.targetDate,
      iconKey: t.form.milestone.iconKey,
    },
  };

  const taskFormT: TaskFormTranslations = {
    createTitle: t.form.createTask,
    editTitle: t.form.editTask,
    cancel: t.form.cancel,
    save: t.form.save,
    creating: t.form.creating,
    saving: t.form.saving,
    errors: t.form.errors,
    statusLabels: t.statusLabels,
    priorityLabels: t.priorityLabels,
    fields: {
      title: t.form.task.title,
      titlePlaceholder: t.form.task.titlePlaceholder,
      description: t.form.task.description,
      descriptionPlaceholder: t.form.task.descriptionPlaceholder,
      milestone: t.form.task.milestone,
      milestonePlaceholder: t.form.task.milestonePlaceholder,
      noMilestone: t.form.task.noMilestone,
      status: t.form.task.status,
      priority: t.form.task.priority,
      sprintName: t.form.task.sprintName,
      sprintNamePlaceholder: t.form.task.sprintNamePlaceholder,
      estimateHours: t.form.task.estimateHours,
      estimateHoursPlaceholder: t.form.task.estimateHoursPlaceholder,
      acceptanceCriteria: t.form.task.acceptanceCriteria,
      acceptanceCriteriaPlaceholder: t.form.task.acceptanceCriteriaPlaceholder,
      dependencyNotes: t.form.task.dependencyNotes,
      dependencyNotesPlaceholder: t.form.task.dependencyNotesPlaceholder,
      executionNotes: t.form.task.executionNotes,
      executionNotesPlaceholder: t.form.task.executionNotesPlaceholder,
      blockerReason: t.form.task.blockerReason,
      blockerReasonPlaceholder: t.form.task.blockerReasonPlaceholder,
      scheduling: t.form.task.scheduling,
      startDate: t.form.task.startDate,
      endDate: t.form.task.endDate,
      progress: t.form.task.progress,
      progressUnit: t.form.task.progressUnit,
      durationDays: t.form.task.durationDays,
      promptSection: t.form.task.promptSection,
      promptBody: t.form.task.promptBody,
      promptBodyPlaceholder: t.form.task.promptBodyPlaceholder,
      promptContext: t.form.task.promptContext,
      promptContextPlaceholder: t.form.task.promptContextPlaceholder,
      aiToolTarget: t.form.task.aiToolTarget,
      aiToolTargetPlaceholder: t.form.task.aiToolTargetPlaceholder,
      implementationNotes: t.form.task.implementationNotes,
      implementationNotesPlaceholder: t.form.task.implementationNotesPlaceholder,
      testNotes: t.form.task.testNotes,
      testNotesPlaceholder: t.form.task.testNotesPlaceholder,
    },
  };

  const es = locale === "es";
  // ── Handle status filter from dashboard ────────────────────────────────────────

  const handleStatusFilter = (status: TaskStatus) => {
    setStatusFilter(status);
    setActiveTab("tasks");
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Onboarding spotlight for new projects */}
      {onboard && (
        <Suspense fallback={null}>
          <OnboardingSpotlight
            locale={locale}
            onCreateMilestone={() => { setShowMilestoneForm(true); setEditingMilestone(null); }}
            title={locale === "es" ? "¡Bienvenido a tu proyecto!" : "Welcome to your project!"}
            description={locale === "es" ? "Empieza creando tu primer milestone para definir las fases de tu roadmap." : "Start by creating your first milestone to define your roadmap phases."}
            ctaLabel={locale === "es" ? "Crear Milestone" : "Create Milestone"}
            dismissLabel={locale === "es" ? "Lo haré después" : "I'll do this later"}
          />
        </Suspense>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{projectTitle}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowTaskForm(true); setEditingTask(null); setPreselectedMilestoneId(undefined); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            {t.form.createTask}
          </button>
          <button
            type="button"
            onClick={() => { setShowMilestoneForm(true); setEditingMilestone(null); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            {t.form.createMilestone}
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex overflow-x-auto gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {TAB_CONFIG.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tabLabels[key]}
          </button>
        ))}
        {/* Living Graph lives on its own route (server-fetched graph data) */}
        <button
          type="button"
          onClick={() => router.push(localizedHref(locale, `/projects/${projectId}/execution-map/living-graph`))}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Share2 className="h-3.5 w-3.5" />
          {locale === "es" ? "Grafo Vivo" : "Living Graph"}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <RoadmapHero
            milestones={milestones}
            tasks={tasks}
            taskCounts={taskCounts}
            progress={progress}
            locale={locale}
            translations={{
              currentPhase: es ? "Fase actual" : "Current phase",
              currentMilestone: es ? "Hito actual" : "Current milestone",
              nextMilestone: es ? "Siguiente hito" : "Next milestone",
              overallProgress: es ? "Progreso general" : "Overall progress",
              blockers: es ? "Bloqueos" : "Blockers",
              noBlockers: es ? "Sin bloqueos" : "No blockers",
              milestones: t.milestones,
              tasks: t.tasks,
              completed: es ? "Completados" : "Completed",
              inProgress: es ? "En progreso" : "In progress",
              planned: es ? "Planificados" : "Planned",
              blocked: es ? "Bloqueados" : "Blocked",
              noNext: es ? "Sin siguiente hito" : "No next milestone",
            }}
          />
          {nextStep && (
            <NextStepPanel
              recommendation={nextStep}
              milestones={milestones}
              locale={locale}
              translations={t.nextStep}
              onTaskAction={handleTaskAction}
            />
          )}
          <ExecutionDashboard
            tasks={tasks}
            nextStep={nextStep}
            locale={locale}
            translations={t.executionDashboard}
            onStatusFilter={handleStatusFilter}
          />
        </div>
      )}

      {activeTab === "timeline" && (
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
          onArchiveMilestone={async (milestoneId) => {
            const { archiveMilestoneAction } = await import("@/app/[locale]/(app)/projects/[projectId]/roadmap/actions");
            await archiveMilestoneAction(milestoneId, projectId);
            router.refresh();
          }}
          onReorderMilestones={async (orderedIds) => {
            const { reorderMilestonesAction } = await import("@/app/[locale]/(app)/projects/[projectId]/roadmap/actions");
            await reorderMilestonesAction(projectId, orderedIds);
            router.refresh();
          }}
        />
      )}

      {activeTab === "tasks" && (
        <TaskListByMilestone
          projectId={projectId}
          milestones={milestones}
          tasks={tasks}
          taskCounts={taskCounts}
          dependencies={dependencies}
          locale={locale}
          translations={{
            ...t.taskList,
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
          initialStatusFilter={statusFilter}
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
          onAddTask={(milestoneId) => { setEditingTask(null); setPreselectedMilestoneId(milestoneId); setShowTaskForm(true); }}
          onMoveMilestone={async (milestoneId, direction) => {
            const { moveMilestoneAction } = await import("@/app/[locale]/(app)/projects/[projectId]/roadmap/actions");
            await moveMilestoneAction(milestoneId, direction, projectId);
            router.refresh();
          }}
        />
      )}

      {activeTab === "gantt" && (
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
          onTaskDatesChange={async (taskId, startDate, endDate) => {
            const res = await updateTaskDatesAction({ taskId, start_date: startDate, end_date: endDate, projectId });
            if (!res.error) {
              router.refresh();
            }
          }}
        />
      )}

      {activeTab === "critical-path" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            {locale === "es" ? "Ruta Crítica" : "Critical Path"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            {locale === "es"
              ? "El análisis de ruta crítica estará disponible próximamente. Esta vista mostrará la cadena de tareas más larga, los tiempos de holgura y las fechas más tempranas y tardías."
              : "Critical path analysis will be available soon. This view will show the longest task chain, slack times, and earliest/latest dates."}
          </p>
        </div>
      )}

      {activeTab === "dependencies" && (
        <DependenciesView
          projectId={projectId}
          milestones={milestones}
          tasks={tasks}
          dependencies={dependencies}
          locale={locale}
          translations={{
            title: locale === "es" ? "Dependencias" : "Dependencies",
            description: locale === "es"
              ? "Gestiona las dependencias entre tareas. Las dependencias definen el orden de ejecución y los impactos en cascada."
              : "Manage task dependencies. Dependencies define execution order and cascade impacts.",
            addDependency: locale === "es" ? "Agregar dependencia" : "Add Dependency",
            noDependencies: locale === "es" ? "Sin dependencias" : "No dependencies",
            noDependenciesDescription: locale === "es"
              ? "Agrega dependencias para definir el orden de ejecución entre tareas."
              : "Add dependencies to define execution order between tasks.",
            predecessor: locale === "es" ? "Predecesor" : "Predecessor",
            successor: locale === "es" ? "Sucesor" : "Successor",
            type: locale === "es" ? "Tipo" : "Type",
            lagDays: locale === "es" ? "Días de retardo" : "Lag days",
            delete: locale === "es" ? "Eliminar" : "Delete",
            selectPredecessor: locale === "es" ? "Seleccionar predecesor..." : "Select predecessor...",
            selectSuccessor: locale === "es" ? "Seleccionar sucesor..." : "Select successor...",
            dependencyType: locale === "es" ? "Tipo de dependencia" : "Dependency type",
            lagDaysLabel: locale === "es" ? "Días de retardo" : "Lag days",
            create: locale === "es" ? "Crear" : "Create",
            creating: locale === "es" ? "Creando..." : "Creating...",
            cancel: locale === "es" ? "Cancelar" : "Cancel",
            textDependencies: locale === "es" ? "Dependencias de texto" : "Text-based dependencies",
            textDependenciesDescription: locale === "es"
              ? "Dependencias detectadas desde las notas de dependencia de cada tarea."
              : "Dependencies detected from each task's dependency notes.",
            noTextDeps: locale === "es" ? "Sin dependencias de texto" : "No text dependencies",
            incompleteWarning: locale === "es" ? "Incompleta" : "Incomplete",
            complete: locale === "es" ? "Completa" : "Complete",
            errorCircular: locale === "es"
              ? "Esta dependencia crearía un ciclo. No se permiten dependencias circulares."
              : "This dependency would create a cycle. Circular dependencies are not allowed.",
            errorDuplicate: locale === "es"
              ? "Esta dependencia ya existe."
              : "This dependency already exists.",
            errorSelf: locale === "es"
              ? "Una tarea no puede depender de sí misma."
              : "A task cannot depend on itself.",
            errorNotFound: locale === "es"
              ? "Una de las tareas no fue encontrada."
              : "One of the tasks was not found.",
            errorUnexpected: locale === "es"
              ? "Ocurrió un error inesperado."
              : "An unexpected error occurred.",
            typeLabels: {
              finish_to_start: locale === "es" ? "Fin → Inicio" : "Finish → Start",
              start_to_start: locale === "es" ? "Inicio → Inicio" : "Start → Start",
              start_to_finish: locale === "es" ? "Inicio → Fin" : "Start → Finish",
              finish_to_finish: locale === "es" ? "Fin → Fin" : "Finish → Finish",
            },
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