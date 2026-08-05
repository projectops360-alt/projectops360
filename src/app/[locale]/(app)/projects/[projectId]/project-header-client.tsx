"use client";

import { useState } from "react";
import { localizedHref } from "@/i18n/href";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { ProjectStatusBadge } from "@/components/projects/status-badge";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import {
  archiveProjectAction,
  deleteProjectPermanentlyAction,
  getProjectDeletionImpactAction,
  type ProjectDeletionImpact,
} from "@/app/[locale]/(app)/projects/actions";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import type { ProjectStatus, ProjectType, Locale } from "@/types/database";

interface ProjectHeaderClientProps {
  projectId: string;
  locale: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  statusLabel: string;
  projectType: ProjectType;
  startDate: string | null;
  targetEndDate: string | null;
  editLabel: string;
  archiveLabel: string;
  archiveConfirm: string;
  /** Only owners/admins may destroy a project; the server enforces it too. */
  canDeletePermanently: boolean;
  /**
   * Plain strings only — these cross the server/client boundary, where React
   * cannot serialize a function. The count templates carry a literal `{count}`
   * that this component substitutes once the impact is known.
   */
  deleteLabels: {
    trigger: string;
    step1Title: string;
    step1Body: string;
    tasks: string;
    milestones: string;
    dependencies: string;
    events: string;
    step1Confirm: string;
    step2Title: string;
    step2Body: string;
    step2Confirm: string;
    cancel: string;
    deleting: string;
    failed: string;
  };
}

/** Fill a `{count}` template. The message itself is authored in messages/*.json. */
function withCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

export function ProjectHeaderClient({
  projectId,
  locale,
  title,
  description,
  status,
  statusLabel,
  projectType,
  startDate,
  targetEndDate,
  editLabel,
  archiveLabel,
  archiveConfirm,
  canDeletePermanently,
  deleteLabels,
}: ProjectHeaderClientProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<ProjectDeletionImpact | null>(null);
  const router = useRouter();

  // The impact is fetched before the first dialog so it can state real numbers.
  const openDeleteDialog = async () => {
    const result = await getProjectDeletionImpactAction(projectId);
    if (result.impact) setDeleteImpact(result.impact);
    else console.error("Failed to read deletion impact:", result.error);
  };

  const handlePermanentDelete = async (): Promise<string | undefined> => {
    const result = await deleteProjectPermanentlyAction(projectId);
    if (result.error) return result.error;
    router.push(localizedHref(locale, `/projects`));
    router.refresh();
    return undefined;
  };

  const handleArchive = async () => {
    if (!confirm(archiveConfirm)) return;

    const result = await archiveProjectAction(projectId);
    if (result.error) {
      console.error("Failed to archive project:", result.error);
      return;
    }

    router.push(localizedHref(locale, `/projects`));
    router.refresh();
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <ProjectStatusBadge status={status} label={statusLabel} />
          </div>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            {editLabel}
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            <Trash2 className="h-4 w-4" />
            {archiveLabel}
          </button>
          {canDeletePermanently && (
            <button
              type="button"
              onClick={openDeleteDialog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-600 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:border-red-500 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              {deleteLabels.trigger}
            </button>
          )}
        </div>
      </div>

      {deleteImpact && (
        <DeleteProjectDialog
          impact={deleteImpact}
          onConfirm={handlePermanentDelete}
          onClose={() => setDeleteImpact(null)}
          labels={{
            step1Title: deleteLabels.step1Title,
            step1Body: deleteLabels.step1Body,
            tasks: withCount(deleteLabels.tasks, deleteImpact.tasks),
            milestones: withCount(deleteLabels.milestones, deleteImpact.milestones),
            dependencies: withCount(deleteLabels.dependencies, deleteImpact.dependencies),
            events: withCount(deleteLabels.events, deleteImpact.events),
            step1Confirm: deleteLabels.step1Confirm,
            step2Title: deleteLabels.step2Title,
            step2Body: deleteLabels.step2Body,
            step2Confirm: deleteLabels.step2Confirm,
            cancel: deleteLabels.cancel,
            deleting: deleteLabels.deleting,
            failed: deleteLabels.failed,
          }}
        />
      )}

      {showEdit && (
        <EditProjectDialog
          projectId={projectId}
          locale={locale as Locale}
          name={title}
          description={description ?? ""}
          status={status}
          projectType={projectType}
          startDate={startDate}
          targetEndDate={targetEndDate}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}