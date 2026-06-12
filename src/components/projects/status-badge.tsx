import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/database";

const statusConfig: Record<
  ProjectStatus,
  { className: string }
> = {
  planning: {
    className: "bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-300",
  },
  active: {
    className: "bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400",
  },
  on_hold: {
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
  completed: {
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
  cancelled: {
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  label: string;
  className?: string;
}

export function ProjectStatusBadge({ status, label, className }: ProjectStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {label}
    </span>
  );
}