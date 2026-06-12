"use client";

// ============================================================================
// ProjectOps360° — In-graph entity editing
// ============================================================================
// Bridges the Living Graph to the existing roadmap edit dialogs
// (MilestoneFormDialog / TaskFormDialog), building their translation
// objects from the "roadmap" namespace client-side.
// ============================================================================

import { useTranslations, useLocale } from "next-intl";
import type { Milestone, RoadmapTask, Locale } from "@/types/database";
import { MilestoneFormDialog } from "@/components/roadmap/milestone-form-dialog";
import { TaskFormDialog } from "@/components/roadmap/task-form-dialog";

export type EditingEntity =
  | { kind: "milestone"; milestone: Milestone }
  | { kind: "task"; task: RoadmapTask };

export interface LivingGraphEditDialogsProps {
  projectId: string;
  milestones: Milestone[];
  editing: EditingEntity | null;
  onClose: () => void;
  onSaved: () => void;
}

export function LivingGraphEditDialogs({
  projectId,
  milestones,
  editing,
  onClose,
  onSaved,
}: LivingGraphEditDialogsProps) {
  const t = useTranslations("roadmap");
  const locale = useLocale() as Locale;

  if (!editing) return null;

  const statusLabels: Record<string, string> = {
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
  };

  const errors: Record<string, string> = {
    not_authenticated: t("form.errors.not_authenticated"),
    validation_error: t("form.errors.validation_error"),
    unexpected: t("form.errors.unexpected"),
    titleRequired: t("form.errors.titleRequired"),
    titleTooLong: t("form.errors.titleTooLong"),
    descriptionTooLong: t("form.errors.descriptionTooLong"),
    invalid_milestone_id: t("form.errors.invalid_milestone_id"),
    invalid_project_id: t("form.errors.invalid_project_id"),
  };

  const shared = {
    cancel: t("form.cancel"),
    save: t("form.save"),
    creating: t("form.creating"),
    saving: t("form.saving"),
    errors,
    statusLabels,
  };

  if (editing.kind === "milestone") {
    return (
      <MilestoneFormDialog
        mode="edit"
        projectId={projectId}
        locale={locale}
        milestones={milestones}
        milestone={editing.milestone}
        onClose={onClose}
        onSaved={onSaved}
        translations={{
          ...shared,
          createTitle: t("form.createMilestone"),
          editTitle: t("form.editMilestone"),
          iconLabels: {
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
          fields: {
            title: t("form.milestone.title"),
            titlePlaceholder: t("form.milestone.titlePlaceholder"),
            description: t("form.milestone.description"),
            descriptionPlaceholder: t("form.milestone.descriptionPlaceholder"),
            status: t("form.milestone.status"),
            startDate: t("form.milestone.startDate"),
            targetDate: t("form.milestone.targetDate"),
            iconKey: t("form.milestone.iconKey"),
          },
          lockStatus: t("form.milestone.lockStatus") ?? "Lock status override",
          lockStatusDescription: t("form.milestone.lockStatusDescription") ?? "When locked, the status won't be auto-calculated from task completion.",
          computedStatusNote: t("form.milestone.computedStatusNote") ?? "Status is auto-computed from task completion.",
        }}
      />
    );
  }

  return (
    <TaskFormDialog
      mode="edit"
      projectId={projectId}
      locale={locale}
      milestones={milestones}
      task={editing.task}
      onClose={onClose}
      onSaved={onSaved}
      translations={{
        ...shared,
        createTitle: t("form.createTask"),
        editTitle: t("form.editTask"),
        priorityLabels: {
          p1: t("priority.p1"),
          p2: t("priority.p2"),
          p3: t("priority.p3"),
        },
        fields: {
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
      }}
    />
  );
}
