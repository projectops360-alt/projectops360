import { cn } from "@/lib/utils";
import type { CommunicationSourceType } from "@/types/database";

const sourceTypeConfig: Record<CommunicationSourceType, { className: string }> = {
  email: {
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
  meeting: {
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  },
  phone: {
    className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  },
  teams: {
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  },
  slack: {
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
  in_person: {
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  },
  document: {
    className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  manual_note: {
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  },
  other: {
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
};

interface SourceTypeBadgeProps {
  sourceType: CommunicationSourceType;
  label: string;
  className?: string;
}

export function SourceTypeBadge({ sourceType, label, className }: SourceTypeBadgeProps) {
  const config = sourceTypeConfig[sourceType];

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