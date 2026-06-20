import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, Milestone, RoadmapTask, TaskStatus, TaskDependency } from "@/types/database";
import { computeRoadmapProgress } from "@/lib/roadmap/progress";
import { computeNextStep } from "@/lib/roadmap/recommendation";
import { topologicalSortTasks } from "@/lib/roadmap/topological-sort";
import { ExecutionMapClient } from "./execution-map-client";

export default async function ExecutionMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, projectId } = await params;
  const sp = await searchParams;
  const onboard = sp.onboard === "true";
  setRequestLocale(locale);

  const t = await getTranslations("roadmap");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Project, milestones, tasks and dependencies only depend on projectId/org,
  // so we fan them out together. Dependencies is wrapped to tolerate a missing
  // table before its migration has been applied.
  const [projectResult, milestonesResult, tasksResult, dependencies] = await Promise.all([
    supabase.from("projects").select("id, slug, title_i18n").eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single(),
    supabase.from("milestones").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("order_index", { ascending: true }),
    supabase.from("roadmap_tasks").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("milestone_id", { ascending: true }).order("order_index", { ascending: true }).order("created_at", { ascending: true }),
    Promise.resolve(supabase.from("task_dependencies").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).order("created_at", { ascending: true })).then((r) => (r.data as TaskDependency[] | null) ?? []).catch(() => [] as TaskDependency[]),
  ]);

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
  const milestones = milestonesResult.data;
  const tasks = tasksResult.data;

  // Compute task counts per milestone
  const taskCounts: Record<string, { total: number; done: number; inProgress: number }> = {};
  const activeStatuses: TaskStatus[] = ["in_progress", "sent_to_ai", "implemented", "tested"];
  for (const task of tasks ?? []) {
    const mid = task.milestone_id ?? "__unassigned";
    if (!taskCounts[mid]) {
      taskCounts[mid] = { total: 0, done: 0, inProgress: 0 };
    }
    taskCounts[mid].total++;
    if (task.status === "done") taskCounts[mid].done++;
    if (activeStatuses.includes(task.status)) taskCounts[mid].inProgress++;
  }

  // Compute roadmap progress from task data
  const progress = computeRoadmapProgress(
    (milestones ?? []) as Milestone[],
    (tasks ?? []) as RoadmapTask[],
  );

  // Compute recommended next step
  const nextStep = computeNextStep(
    (tasks ?? []) as RoadmapTask[],
    (milestones ?? []) as Milestone[],
  );

  // task_dependencies was fetched concurrently above (the `.catch` tolerates a
  // missing table before its migration has been applied).

  // Sort tasks respecting dependency order (predecessors before successors),
  // grouped by milestone in milestone order_index order
  const { sorted: sortedTasks } = topologicalSortTasks(
    (tasks ?? []) as RoadmapTask[],
    dependencies,
    (milestones ?? []) as Milestone[],
  );

  return (
    <ExecutionMapClient
      projectId={projectId}
      projectTitle={projectTitle}
      onboard={onboard}
      milestones={(milestones ?? []) as Milestone[]}
      tasks={sortedTasks}
      taskCounts={taskCounts}
      progress={progress}
      nextStep={nextStep}
      dependencies={(dependencies ?? []) as TaskDependency[]}
      locale={locale as Locale}
      translations={{
        title: t("title"),
        description: t("description"),
        milestones: t("milestones"),
        tasks: t("tasks"),
        empty: t("empty"),
        emptyDescription: t("emptyDescription"),
        noTasks: t("noTasks"),
        dateRange: t.raw("dateRange"),
        noDate: t("noDate"),
        taskCount: t.raw("taskCount"),
        sprint: t.raw("sprint"),
        hours: t.raw("hours"),
        statusLabels: {
          planned: t("status.planned"),
          in_progress: t("status.in_progress"),
          completed: t("status.completed"),
          blocked: t("status.blocked"),
          deferred: t("status.deferred"),
          not_started: t("status.not_started"),
          prompt_ready: t("status.prompt_ready"),
          sent_to_ai: t("status.sent_to_ai"),
          implemented: t("status.implemented"),
          tested: t("status.tested"),
          done: t("status.done"),
        },
        priorityLabels: {
          p1: t("priority.p1"),
          p2: t("priority.p2"),
          p3: t("priority.p3"),
        },
        taskList: {
          title: t("taskList.title"),
          filterByStatus: t("taskList.filterByStatus"),
          allStatuses: t("taskList.allStatuses"),
          selectMilestone: t("taskList.selectMilestone"),
          noTasksForMilestone: t("taskList.noTasksForMilestone"),
          progressCount: t.raw("taskList.progressCount"),
          remaining: t("taskList.remaining"),
          dependencyNotes: t("taskList.dependencyNotes"),
          executionNotes: t("taskList.executionNotes"),
          blockerReason: t("taskList.blockerReason"),
          acceptanceCriteria: t("taskList.acceptanceCriteria"),
          updateStatus: t("taskList.updateStatus"),
          statusUpdated: t("taskList.statusUpdated"),
          statusUpdateFailed: t("taskList.statusUpdateFailed"),
          estimate: t("taskList.estimate"),
          actual: t("taskList.actual"),
          noEstimate: t("taskList.noEstimate"),
          unassigned: t("taskList.unassigned"),
          copyPrompt: t("taskList.copyPrompt"),
          copiedPrompt: t("taskList.copiedPrompt"),
          markAsSentToAi: t("taskList.markAsSentToAi"),
          promptWarning: t("taskList.promptWarning"),
          promptLabel: t("taskList.promptLabel"),
          promptContextLabel: t("taskList.promptContextLabel"),
          aiToolLabel: t("taskList.aiToolLabel"),
          lastSentLabel: t("taskList.lastSentLabel"),
          implementationNotesLabel: t("taskList.implementationNotesLabel"),
          testNotesLabel: t("taskList.testNotesLabel"),
          dependencyWarning: t("taskList.dependencyWarning"),
          dependencyComplete: t("taskList.dependencyComplete"),
          dependencyIncomplete: t("taskList.dependencyIncomplete"),
          auditTrail: t("taskList.auditTrail"),
          auditTrailEmpty: t("taskList.auditTrailEmpty"),
          statusChanged: t("taskList.statusChanged"),
          promptCopied: t("taskList.promptCopied"),
          promptSent: t("taskList.promptSent"),
          taskBlocked: t("taskList.taskBlocked"),
          taskCompleted: t("taskList.taskCompleted"),
          taskUnblocked: t("taskList.taskUnblocked"),
          editTask: t("taskList.editTask"),
          archiveTask: t("taskList.archiveTask"),
          confirmArchiveTask: t("taskList.confirmArchiveTask"),
          editMilestone: t("taskList.editMilestone"),
          archiveMilestone: t("taskList.archiveMilestone"),
          confirmArchiveMilestone: t("taskList.confirmArchiveMilestone"),
          addPredecessor: t("taskList.addPredecessor"),
          addPredecessorPlaceholder: t("taskList.addPredecessorPlaceholder"),
          predecessorAdded: t("taskList.predecessorAdded"),
          predecessorExists: t("taskList.predecessorExists"),
          cancel: t("taskList.cancel"),
          noMatchingTasks: t("taskList.noMatchingTasks"),
          circularDependencyError: t("taskList.circularDependencyError"),
          dependencyAddError: t("taskList.dependencyAddError"),
          dependsOn: t("taskList.dependsOn"),
          showPrompt: t("taskList.showPrompt"),
          hidePrompt: t("taskList.hidePrompt"),
        },
        form: {
          createMilestone: t("form.createMilestone"),
          editMilestone: t("form.editMilestone"),
          createTask: t("form.createTask"),
          editTask: t("form.editTask"),
          cancel: t("form.cancel"),
          save: t("form.save"),
          creating: t("form.creating"),
          saving: t("form.saving"),
          milestoneCreated: t("form.milestoneCreated"),
          milestoneUpdated: t("form.milestoneUpdated"),
          taskCreated: t("form.taskCreated"),
          taskUpdated: t("form.taskUpdated"),
          errors: {
            not_authenticated: t("form.errors.not_authenticated"),
            validation_error: t("form.errors.validation_error"),
            unexpected: t("form.errors.unexpected"),
            titleRequired: t("form.errors.titleRequired"),
            titleTooLong: t("form.errors.titleTooLong"),
            descriptionTooLong: t("form.errors.descriptionTooLong"),
            invalid_milestone_id: t("form.errors.invalid_milestone_id"),
            invalid_project_id: t("form.errors.invalid_project_id"),
          },
          milestone: {
            title: t("form.milestone.title"),
            titlePlaceholder: t("form.milestone.titlePlaceholder"),
            description: t("form.milestone.description"),
            descriptionPlaceholder: t("form.milestone.descriptionPlaceholder"),
            status: t("form.milestone.status"),
            startDate: t("form.milestone.startDate"),
            targetDate: t("form.milestone.targetDate"),
            iconKey: t("form.milestone.iconKey"),
            iconKeys: {
              setup: t("form.milestone.iconKeys.setup"),
              shield_database: t("form.milestone.iconKeys.shield_database"),
              users: t("form.milestone.iconKeys.users"),
              notebook: t("form.milestone.iconKeys.notebook"),
              link: t("form.milestone.iconKeys.link"),
              sparkles: t("form.milestone.iconKeys.sparkles"),
              chart: t("form.milestone.iconKeys.chart"),
              loop: t("form.milestone.iconKeys.loop"),
              check_circle: t("form.milestone.iconKeys.check_circle"),
              rocket: t("form.milestone.iconKeys.rocket"),
            },
          },
          task: {
            title: t("form.task.title"),
            titlePlaceholder: t("form.task.titlePlaceholder"),
            description: t("form.task.description"),
            descriptionPlaceholder: t("form.task.descriptionPlaceholder"),
            milestone: t("form.task.milestone"),
            milestonePlaceholder: t("form.task.milestonePlaceholder"),
            noMilestone: t("form.task.noMilestone"),
            status: t("form.task.status"),
            priority: t("form.task.priority"),
            sprintName: t("form.task.sprintName"),
            sprintNamePlaceholder: t("form.task.sprintNamePlaceholder"),
            estimateHours: t("form.task.estimateHours"),
            estimateHoursPlaceholder: t("form.task.estimateHoursPlaceholder"),
            acceptanceCriteria: t("form.task.acceptanceCriteria"),
            acceptanceCriteriaPlaceholder: t("form.task.acceptanceCriteriaPlaceholder"),
            dependencyNotes: t("form.task.dependencyNotes"),
            dependencyNotesPlaceholder: t("form.task.dependencyNotesPlaceholder"),
            executionNotes: t("form.task.executionNotes"),
            executionNotesPlaceholder: t("form.task.executionNotesPlaceholder"),
            blockerReason: t("form.task.blockerReason"),
            blockerReasonPlaceholder: t("form.task.blockerReasonPlaceholder"),
            sectionDetails: t("form.task.sectionDetails"),
            sectionTracking: t("form.task.sectionTracking"),
            scheduling: t("form.task.scheduling"),
            startDate: t("form.task.startDate"),
            endDate: t("form.task.endDate"),
            progress: t("form.task.progress"),
            progressUnit: t("form.task.progressUnit"),
            durationDays: t("form.task.durationDays"),
            promptSection: t("form.task.promptSection"),
            promptBody: t("form.task.promptBody"),
            promptBodyPlaceholder: t("form.task.promptBodyPlaceholder"),
            promptContext: t("form.task.promptContext"),
            promptContextPlaceholder: t("form.task.promptContextPlaceholder"),
            aiToolTarget: t("form.task.aiToolTarget"),
            aiToolTargetPlaceholder: t("form.task.aiToolTargetPlaceholder"),
            implementationNotes: t("form.task.implementationNotes"),
            implementationNotesPlaceholder: t("form.task.implementationNotesPlaceholder"),
            testNotes: t("form.task.testNotes"),
            testNotesPlaceholder: t("form.task.testNotesPlaceholder"),
          },
        },
        nextStep: {
          title: t("nextStep.title"),
          onTrack: t("nextStep.onTrack"),
          viewTask: t("nextStep.viewTask"),
          resolveBlocker: t("nextStep.resolveBlocker"),
          runPrompt: t("nextStep.runPrompt"),
          markCompleted: t("nextStep.markCompleted"),
        },
        executionDashboard: {
          title: t("executionDashboard.title"),
          promptReady: t("executionDashboard.promptReady"),
          sentToAi: t("executionDashboard.sentToAi"),
          implemented: t("executionDashboard.implemented"),
          tested: t("executionDashboard.tested"),
          blocked: t("executionDashboard.blocked"),
          completed: t("executionDashboard.completed"),
          notStarted: t("executionDashboard.notStarted"),
          inProgress: t("executionDashboard.inProgress"),
          deferred: t("executionDashboard.deferred"),
          currentSprint: t("executionDashboard.currentSprint"),
          noSprint: t("executionDashboard.noSprint"),
          recentChanges: t("executionDashboard.recentChanges"),
          noRecentChanges: t("executionDashboard.noRecentChanges"),
        },
      }}
    />
  );
}