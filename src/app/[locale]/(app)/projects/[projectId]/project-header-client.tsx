"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { ProjectStatusBadge } from "@/components/projects/status-badge";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { archiveProjectAction } from "@/app/[locale]/(app)/projects/actions";
import type { ProjectStatus, Locale } from "@/types/database";

interface ProjectHeaderClientProps {
  projectId: string;
  locale: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  statusLabel: string;
  startDate: string | null;
  targetEndDate: string | null;
  editLabel: string;
  archiveLabel: string;
  archiveConfirm: string;
}

export function ProjectHeaderClient({
  projectId,
  locale,
  title,
  description,
  status,
  statusLabel,
  startDate,
  targetEndDate,
  editLabel,
  archiveLabel,
  archiveConfirm,
}: ProjectHeaderClientProps) {
  const [showEdit, setShowEdit] = useState(false);
  const router = useRouter();

  const handleArchive = async () => {
    if (!confirm(archiveConfirm)) return;

    const result = await archiveProjectAction(projectId);
    if (result.error) {
      console.error("Failed to archive project:", result.error);
      return;
    }

    router.push(`/${locale}/projects`);
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
        </div>
      </div>

      {showEdit && (
        <EditProjectDialog
          projectId={projectId}
          locale={locale as Locale}
          name={title}
          description={description ?? ""}
          status={status}
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