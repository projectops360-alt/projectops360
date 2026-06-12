import Link from "next/link";
import { FolderKanban, Calendar, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types/database";
import { ProjectStatusBadge } from "./status-badge";

interface ProjectCardProps {
  project: Project;
  locale: string;
  statusLabel: string;
  href: string;
}

export function ProjectCard({ project, statusLabel, href }: ProjectCardProps) {
  const title =
    project.title_i18n?.en || project.slug || "Untitled";
  const description =
    project.description_i18n?.en || "";

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-card p-5 transition-all hover:border-brand-500/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
            <FolderKanban className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProjectStatusBadge status={project.status as ProjectStatus} label={statusLabel} />
        {project.start_date && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(project.start_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
}