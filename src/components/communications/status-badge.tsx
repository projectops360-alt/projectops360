import { cn } from "@/lib/utils";
import type { CommunicationStatus } from "@/types/database";

const statusConfig: Record<CommunicationStatus, { className: string }> = {
  draft: {
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  logged: {
    className: "bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-300",
  },
};

interface StatusBadgeProps {
  status: CommunicationStatus;
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
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