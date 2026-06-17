import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, Milestone, RoadmapTask, TaskStatus, TaskPriority, TaskDependency } from "@/types/database";
import { topologicalSortTasks } from "@/lib/roadmap/topological-sort";
import { workboardColumnLabels, type DeliveryMethod } from "@/lib/delivery/config";
import { WorkboardClient } from "./workboard-dynamic";

// Force dynamic rendering — workboard data changes frequently
export const dynamic = "force-dynamic";

export default async function WorkboardPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("workboard");
  const tTaskForm = await getTranslations("roadmap.form");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch project, milestones, tasks and dependencies in parallel (one round trip)
  const [projectResult, milestonesResult, tasksResult, depsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title_i18n")
      .eq("id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("roadmap_tasks")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("task_dependencies")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: true }),
  ]);

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  // Adapt the Workboard column labels to the project's delivery framework
  // (the single board stays operating on TaskStatus; only labels change).
  const { data: fwRow } = await supabase
    .from("project_delivery_frameworks").select("delivery_method, project_type")
    .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle();
  const columnOverrides = workboardColumnLabels(
    (fwRow as { delivery_method?: string } | null)?.delivery_method as DeliveryMethod | null ?? null,
    (fwRow as { project_type?: string } | null)?.project_type ?? null,
    locale === "es",
  );

  const milestones = milestonesResult.data;
  const tasks = tasksResult.data;
  if (!tasks) {
    console.error(`[workboard] Tasks fetch error:`, tasksResult.error);
  }
  // Dependencies table may not exist yet (before migration is applied) — treat errors as empty
  const dependencies = (depsResult.data as TaskDependency[] | null) ?? [];

  // Sort tasks respecting dependency order (predecessors before successors),
  // grouped by milestone in milestone order_index order
  const { sorted: sortedTasks } = topologicalSortTasks(
    (tasks ?? []) as RoadmapTask[],
    dependencies,
    (milestones ?? []) as Milestone[],
  );

  return (
    <WorkboardClient
      projectId={projectId}
      projectTitle={projectTitle}
      milestones={(milestones ?? []) as Milestone[]}
      tasks={sortedTasks}
      dependencies={dependencies}
      locale={locale as Locale}
      translations={{
        title: t("title"),
        description: t("description"),
        empty: t("empty"),
        dragHint: t("dragHint"),
        columns: {
          not_started: columnOverrides.not_started ?? t("columns.not_started"),
          prompt_ready: columnOverrides.prompt_ready ?? t("columns.prompt_ready"),
          sent_to_ai: columnOverrides.sent_to_ai ?? t("columns.sent_to_ai"),
          in_progress: columnOverrides.in_progress ?? t("columns.in_progress"),
          implemented: columnOverrides.implemented ?? t("columns.implemented"),
          tested: columnOverrides.tested ?? t("columns.tested"),
          done: columnOverrides.done ?? t("columns.done"),
          blocked: columnOverrides.blocked ?? t("columns.blocked"),
          deferred: columnOverrides.deferred ?? t("columns.deferred"),
        },
        priorityLabels: {
          p1: t("priorityLabels.p1"),
          p2: t("priorityLabels.p2"),
          p3: t("priorityLabels.p3"),
        },
        groupLabels: {
          backlog: t("groupLabels.backlog"),
          active: t("groupLabels.active"),
          complete: t("groupLabels.complete"),
        },
        columnVisibility: t("columnVisibility"),
        showAll: t("showAll"),
        collapseColumn: t("collapseColumn"),
        expandColumn: t("expandColumn"),
        resetWidth: t("resetWidth"),
        filterBySprint: t("filterBySprint"),
        allSprints: t("allSprints"),
        noSprint: t("noSprint"),
        bySprint: t("bySprint"),
        byMilestone: t("byMilestone"),
        allMilestones: t("allMilestones"),
        noMilestone: t("noMilestone"),
        dependsOn: t("dependsOn"),
        errors: {
          not_authenticated: t("errors.not_authenticated"),
          unexpected: t("errors.unexpected"),
          dependency_not_met: t.raw("errors.dependency_not_met"),
        },
        statusChange: {
          title: t("statusChange.title"),
          movingTo: t("statusChange.movingTo"),
          noteLabel: t("statusChange.noteLabel"),
          notePlaceholder: {
            done: t("statusChange.notePlaceholder.done"),
            blocked: t("statusChange.notePlaceholder.blocked"),
            in_progress: t("statusChange.notePlaceholder.in_progress"),
            implemented: t("statusChange.notePlaceholder.implemented"),
            tested: t("statusChange.notePlaceholder.tested"),
            deferred: t("statusChange.notePlaceholder.deferred"),
            default: t("statusChange.notePlaceholder.default"),
          },
          moveWithout: t("statusChange.moveWithout"),
          moveWith: t("statusChange.moveWith"),
          cancel: t("statusChange.cancel"),
          statusLabels: {
            not_started: columnOverrides.not_started ?? t("columns.not_started"),
            prompt_ready: columnOverrides.prompt_ready ?? t("columns.prompt_ready"),
            sent_to_ai: columnOverrides.sent_to_ai ?? t("columns.sent_to_ai"),
            in_progress: columnOverrides.in_progress ?? t("columns.in_progress"),
            implemented: columnOverrides.implemented ?? t("columns.implemented"),
            tested: columnOverrides.tested ?? t("columns.tested"),
            done: columnOverrides.done ?? t("columns.done"),
            blocked: columnOverrides.blocked ?? t("columns.blocked"),
            deferred: columnOverrides.deferred ?? t("columns.deferred"),
          },
        },
        taskForm: {
          createTitle: tTaskForm("createTask"),
          editTitle: tTaskForm("editTask"),
          cancel: tTaskForm("cancel"),
          save: tTaskForm("save"),
          creating: tTaskForm("creating"),
          saving: tTaskForm("saving"),
          errors: {
            titleRequired: tTaskForm("errors.titleRequired"),
            unexpected: tTaskForm("errors.unexpected"),
          },
          statusLabels: {
            not_started: columnOverrides.not_started ?? t("columns.not_started"),
            prompt_ready: columnOverrides.prompt_ready ?? t("columns.prompt_ready"),
            sent_to_ai: columnOverrides.sent_to_ai ?? t("columns.sent_to_ai"),
            in_progress: columnOverrides.in_progress ?? t("columns.in_progress"),
            implemented: columnOverrides.implemented ?? t("columns.implemented"),
            tested: columnOverrides.tested ?? t("columns.tested"),
            done: columnOverrides.done ?? t("columns.done"),
            blocked: columnOverrides.blocked ?? t("columns.blocked"),
            deferred: columnOverrides.deferred ?? t("columns.deferred"),
          },
          priorityLabels: {
            p1: t("priorityLabels.p1"),
            p2: t("priorityLabels.p2"),
            p3: t("priorityLabels.p3"),
          },
          fields: {
            title: tTaskForm("task.title"),
            titlePlaceholder: tTaskForm("task.titlePlaceholder"),
            description: tTaskForm("task.description"),
            descriptionPlaceholder: tTaskForm("task.descriptionPlaceholder"),
            milestone: tTaskForm("task.milestone"),
            milestonePlaceholder: tTaskForm("task.milestonePlaceholder"),
            noMilestone: tTaskForm("task.noMilestone"),
            status: tTaskForm("task.status"),
            priority: tTaskForm("task.priority"),
            sprintName: tTaskForm("task.sprintName"),
            sprintNamePlaceholder: tTaskForm("task.sprintNamePlaceholder"),
            estimateHours: tTaskForm("task.estimateHours"),
            estimateHoursPlaceholder: tTaskForm("task.estimateHoursPlaceholder"),
            acceptanceCriteria: tTaskForm("task.acceptanceCriteria"),
            acceptanceCriteriaPlaceholder: tTaskForm("task.acceptanceCriteriaPlaceholder"),
            dependencyNotes: tTaskForm("task.dependencyNotes"),
            dependencyNotesPlaceholder: tTaskForm("task.dependencyNotesPlaceholder"),
            executionNotes: tTaskForm("task.executionNotes"),
            executionNotesPlaceholder: tTaskForm("task.executionNotesPlaceholder"),
            blockerReason: tTaskForm("task.blockerReason"),
            blockerReasonPlaceholder: tTaskForm("task.blockerReasonPlaceholder"),
            scheduling: tTaskForm("task.scheduling"),
            startDate: tTaskForm("task.startDate"),
            endDate: tTaskForm("task.endDate"),
            progress: tTaskForm("task.progress"),
            progressUnit: tTaskForm("task.progressUnit"),
            durationDays: tTaskForm("task.durationDays"),
            promptSection: tTaskForm("task.promptSection"),
            promptBody: tTaskForm("task.promptBody"),
            promptBodyPlaceholder: tTaskForm("task.promptBodyPlaceholder"),
            promptContext: tTaskForm("task.promptContext"),
            promptContextPlaceholder: tTaskForm("task.promptContextPlaceholder"),
            aiToolTarget: tTaskForm("task.aiToolTarget"),
            aiToolTargetPlaceholder: tTaskForm("task.aiToolTargetPlaceholder"),
            implementationNotes: tTaskForm("task.implementationNotes"),
            implementationNotesPlaceholder: tTaskForm("task.implementationNotesPlaceholder"),
            testNotes: tTaskForm("task.testNotes"),
            testNotesPlaceholder: tTaskForm("task.testNotesPlaceholder"),
          },
        },
      }}
    />
  );
}