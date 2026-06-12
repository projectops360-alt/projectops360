"use client";

import { useActionState } from "react";
import { X, Loader2, Sparkles, ChevronDown, Calendar } from "lucide-react";
import { useState } from "react";
import {
  createTaskAction,
  updateTaskAction,
} from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import type { Milestone, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskFormMode = "create" | "edit";

type FormState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

const TASK_STATUS_OPTIONS: TaskStatus[] = [
  "not_started", "prompt_ready", "sent_to_ai", "in_progress",
  "implemented", "tested", "done", "blocked", "deferred",
];
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ["p1", "p2", "p3"];

export interface TaskFormTranslations {
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

interface TaskFormDialogProps {
  mode: TaskFormMode;
  projectId: string;
  locale: Locale;
  milestones: Milestone[];
  preselectedMilestoneId?: string;
  task?: RoadmapTask; // required for edit mode
  onClose: () => void;
  onSaved: () => void;
  translations: TaskFormTranslations;
}

// ── Component ────────────────────────────────────────────────────────────────────

export function TaskFormDialog({
  mode,
  projectId,
  milestones,
  preselectedMilestoneId,
  task,
  onClose,
  onSaved,
  translations: t,
}: TaskFormDialogProps) {
  const isEdit = mode === "edit";

  async function handleSubmit(_prevState: FormState, formData: FormData): Promise<FormState> {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const milestoneId = (formData.get("milestone_id") as string) || "";
    const status = (formData.get("status") as string) || "not_started";
    const priority = (formData.get("priority") as string) || "p2";
    const sprintName = (formData.get("sprint_name") as string)?.trim();
    const estimateHours = formData.get("estimate_hours") as string;
    const acceptanceCriteria = (formData.get("acceptance_criteria") as string)?.trim();
    const dependencyNotes = (formData.get("dependency_notes") as string)?.trim();
    const promptBody = (formData.get("prompt_body") as string)?.trim();
    const promptContext = (formData.get("prompt_context") as string)?.trim();
    const aiToolTarget = (formData.get("ai_tool_target") as string)?.trim();
    const implementationNotes = (formData.get("implementation_notes") as string)?.trim();
    const testNotes = (formData.get("test_notes") as string)?.trim();
    const executionNotes = (formData.get("execution_notes") as string)?.trim();
    const blockerReason = (formData.get("blocker_reason") as string)?.trim();
    const startDate = (formData.get("start_date") as string) || "";
    const endDate = (formData.get("end_date") as string) || "";
    const progress = parseInt(formData.get("progress") as string) || 0;

    if (!title) {
      return { error: t.errors.titleRequired || "Title is required" };
    }

    const parsedEstimate = estimateHours ? parseFloat(estimateHours) : null;

    if (isEdit && task) {
      const result = await updateTaskAction({
        taskId: task.id,
        title,
        description,
        milestone_id: milestoneId || null,
        status,
        priority,
        sprint_name: sprintName,
        estimate_hours: parsedEstimate,
        dependency_notes: dependencyNotes,
        acceptance_criteria: acceptanceCriteria,
        start_date: startDate,
        end_date: endDate,
        progress,
        prompt_body: promptBody,
        prompt_context: promptContext,
        ai_tool_target: aiToolTarget,
        implementation_notes: implementationNotes,
        test_notes: testNotes,
        execution_notes: executionNotes,
        blocker_reason: blockerReason,
        projectId,
      });
      if (result.error) {
        return { error: t.errors[result.error] || t.errors.unexpected || "Error" };
      }
    } else {
      const result = await createTaskAction({
        title,
        description,
        milestone_id: milestoneId || undefined,
        status,
        priority,
        sprint_name: sprintName,
        estimate_hours: parsedEstimate,
        dependency_notes: dependencyNotes,
        acceptance_criteria: acceptanceCriteria,
        start_date: startDate,
        end_date: endDate,
        progress,
        prompt_body: promptBody,
        prompt_context: promptContext,
        ai_tool_target: aiToolTarget,
        implementation_notes: implementationNotes,
        test_notes: testNotes,
        execution_notes: executionNotes,
        blocker_reason: blockerReason,
        order_index: 0,
        projectId,
      });
      if (result.error) {
        return { error: t.errors[result.error] || t.errors.unexpected || "Error" };
      }
    }

    onSaved();
    onClose();
    return { success: true };
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [progressValue, setProgressValue] = useState(isEdit ? (task?.progress ?? 0) : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? t.editTitle : t.createTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="task-title" className="block text-sm font-medium text-foreground">
              {t.fields.title} <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              name="title"
              type="text"
              required
              maxLength={200}
              autoFocus
              defaultValue={isEdit ? task?.title : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t.fields.titlePlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Milestone + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="task-milestone" className="block text-sm font-medium text-foreground">
                {t.fields.milestone}
              </label>
              <select
                id="task-milestone"
                name="milestone_id"
                defaultValue={isEdit ? task?.milestone_id ?? "" : preselectedMilestoneId ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">{t.fields.noMilestone}</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="task-status" className="block text-sm font-medium text-foreground">
                {t.fields.status}
              </label>
              <select
                id="task-status"
                name="status"
                defaultValue={isEdit ? task?.status : "not_started"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{t.statusLabels[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority + Sprint */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="task-priority" className="block text-sm font-medium text-foreground">
                {t.fields.priority}
              </label>
              <select
                id="task-priority"
                name="priority"
                defaultValue={isEdit ? task?.priority : "p2"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                {TASK_PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{t.priorityLabels[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="task-sprint" className="block text-sm font-medium text-foreground">
                {t.fields.sprintName}
              </label>
              <input
                id="task-sprint"
                name="sprint_name"
                type="text"
                maxLength={100}
                defaultValue={isEdit ? task?.sprint_name ?? "" : ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t.fields.sprintNamePlaceholder}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Estimate hours */}
          <div className="space-y-2">
            <label htmlFor="task-estimate" className="block text-sm font-medium text-foreground">
              {t.fields.estimateHours}
            </label>
            <input
              id="task-estimate"
              name="estimate_hours"
              type="number"
              step="0.5"
              min="0"
              max="9999.99"
              defaultValue={isEdit ? task?.estimate_hours ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t.fields.estimateHoursPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="task-description" className="block text-sm font-medium text-foreground">
              {t.fields.description}
            </label>
            <textarea
              id="task-description"
              name="description"
              rows={2}
              maxLength={2000}
              defaultValue={isEdit ? task?.description ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.fields.descriptionPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Acceptance criteria */}
          <div className="space-y-2">
            <label htmlFor="task-acceptance" className="block text-sm font-medium text-foreground">
              {t.fields.acceptanceCriteria}
            </label>
            <textarea
              id="task-acceptance"
              name="acceptance_criteria"
              rows={2}
              maxLength={2000}
              defaultValue={isEdit ? task?.acceptance_criteria ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.fields.acceptanceCriteriaPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Dependency notes */}
          <div className="space-y-2">
            <label htmlFor="task-dependencies" className="block text-sm font-medium text-foreground">
              {t.fields.dependencyNotes}
            </label>
            <textarea
              id="task-dependencies"
              name="dependency_notes"
              rows={2}
              maxLength={2000}
              defaultValue={isEdit ? task?.dependency_notes ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.fields.dependencyNotesPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Execution notes */}
          <div className="space-y-2">
            <label htmlFor="task-execution-notes" className="block text-sm font-medium text-foreground">
              {t.fields.executionNotes}
            </label>
            <textarea
              id="task-execution-notes"
              name="execution_notes"
              rows={3}
              maxLength={5000}
              defaultValue={isEdit ? task?.execution_notes ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.fields.executionNotesPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Blocker reason */}
          <div className="space-y-2">
            <label htmlFor="task-blocker-reason" className="block text-sm font-medium text-foreground">
              {t.fields.blockerReason}
            </label>
            <textarea
              id="task-blocker-reason"
              name="blocker_reason"
              rows={2}
              maxLength={2000}
              defaultValue={isEdit ? task?.blocker_reason ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.fields.blockerReasonPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Scheduling section */}
          <div className="border border-border rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground">
              <Calendar className="h-4 w-4 text-brand-500" />
              {t.fields.scheduling}
            </div>
            <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">
              {/* Start Date + End Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="task-start-date" className="block text-sm font-medium text-foreground">
                    {t.fields.startDate}
                  </label>
                  <input
                    id="task-start-date"
                    name="start_date"
                    type="date"
                    defaultValue={isEdit ? task?.start_date ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="task-end-date" className="block text-sm font-medium text-foreground">
                    {t.fields.endDate}
                  </label>
                  <input
                    id="task-end-date"
                    name="end_date"
                    type="date"
                    defaultValue={isEdit ? task?.end_date ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <label htmlFor="task-progress" className="block text-sm font-medium text-foreground">
                  {t.fields.progress}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="task-progress"
                    name="progress"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progressValue}
                    onChange={(e) => setProgressValue(Number(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none bg-muted accent-brand-600 cursor-pointer"
                    disabled={isPending}
                  />
                  <span className="text-sm font-medium text-muted-foreground w-12 text-right">
                    {progressValue}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Prompt section (collapsible) */}
          <div className="border border-border rounded-lg">
            <button
              type="button"
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              {t.fields.promptSection}
              <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${showPrompt ? "rotate-180" : ""}`} />
            </button>
            {showPrompt && (
              <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">
                {/* Prompt body */}
                <div className="space-y-2">
                  <label htmlFor="task-prompt-body" className="block text-sm font-medium text-foreground">
                    {t.fields.promptBody}
                  </label>
                  <textarea
                    id="task-prompt-body"
                    name="prompt_body"
                    rows={4}
                    maxLength={10000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.prompt_body ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none font-mono"
                    placeholder={t.fields.promptBodyPlaceholder}
                    disabled={isPending}
                  />
                </div>

                {/* Prompt context */}
                <div className="space-y-2">
                  <label htmlFor="task-prompt-context" className="block text-sm font-medium text-foreground">
                    {t.fields.promptContext}
                  </label>
                  <input
                    id="task-prompt-context"
                    name="prompt_context"
                    type="text"
                    maxLength={2000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.prompt_context ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    placeholder={t.fields.promptContextPlaceholder}
                    disabled={isPending}
                  />
                </div>

                {/* AI tool target */}
                <div className="space-y-2">
                  <label htmlFor="task-ai-tool" className="block text-sm font-medium text-foreground">
                    {t.fields.aiToolTarget}
                  </label>
                  <select
                    id="task-ai-tool"
                    name="ai_tool_target"
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.ai_tool_target ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    disabled={isPending}
                  >
                    <option value="">—</option>
                    <option value="claude">Claude</option>
                    <option value="codex">Codex</option>
                    <option value="cursor">Cursor</option>
                    <option value="copilot">GitHub Copilot</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Implementation notes */}
                <div className="space-y-2">
                  <label htmlFor="task-implementation-notes" className="block text-sm font-medium text-foreground">
                    {t.fields.implementationNotes}
                  </label>
                  <textarea
                    id="task-implementation-notes"
                    name="implementation_notes"
                    rows={2}
                    maxLength={5000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.implementation_notes ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                    placeholder={t.fields.implementationNotesPlaceholder}
                    disabled={isPending}
                  />
                </div>

                {/* Test notes */}
                <div className="space-y-2">
                  <label htmlFor="task-test-notes" className="block text-sm font-medium text-foreground">
                    {t.fields.testNotes}
                  </label>
                  <textarea
                    id="task-test-notes"
                    name="test_notes"
                    rows={2}
                    maxLength={5000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.test_notes ?? "" : ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
                    placeholder={t.fields.testNotesPlaceholder}
                    disabled={isPending}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? (isEdit ? t.saving : t.creating) : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}