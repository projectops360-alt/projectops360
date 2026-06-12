"use client";

import { useState } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { Project, ProjectStatus, Locale } from "@/types/database";

interface ProjectWithLabel extends Project {
  statusLabel: string;
}

interface ProjectListClientProps {
  projects: ProjectWithLabel[];
  locale: string;
  emptyTitle: string;
  emptyDescription: string;
  createLabel: string;
}

export function ProjectListClient({
  projects,
  locale,
  emptyTitle,
  emptyDescription,
  createLabel,
}: ProjectListClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <Plus className="h-4 w-4" />
          {createLabel}
        </button>
      </div>

      {/* Project list or empty state */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50">
            <FolderKanban className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              locale={locale}
              statusLabel={project.statusLabel}
              href={`/${locale}/projects/${project.id}`}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {isDialogOpen && (
        <CreateProjectDialog
          locale={locale as Locale}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
}