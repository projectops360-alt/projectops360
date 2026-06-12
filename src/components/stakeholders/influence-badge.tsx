import { cn } from "@/lib/utils";
import type { InfluenceLevel, InterestLevel } from "@/types/database";

type Level = InfluenceLevel | InterestLevel;

const levelConfig: Record<Level, { className: string }> = {
  high: {
    className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  },
  medium: {
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
  low: {
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

interface InfluenceBadgeProps {
  level: Level;
  label: string;
  className?: string;
}

export function InfluenceBadge({ level, label, className }: InfluenceBadgeProps) {
  const config = levelConfig[level];

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