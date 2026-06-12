"use client";

import { cn } from "@/lib/utils";
import type { ReadinessLevel } from "@/types/database";

// ── Readiness Badge ──────────────────────────────────────────────────────────────

const READINESS_STYLES: Record<ReadinessLevel, string> = {
  ready:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  at_risk:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  not_ready:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  blocked:
    "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

const READINESS_ICONS: Record<ReadinessLevel, string> = {
  ready: "✓",
  at_risk: "⚠",
  not_ready: "△",
  blocked: "✕",
};

interface ReadinessBadgeProps {
  readiness: ReadinessLevel;
  label: string;
  compact?: boolean;
}

export function ReadinessBadge({
  readiness,
  label,
  compact = false,
}: ReadinessBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        READINESS_STYLES[readiness]
      )}
    >
      <span className="text-[0.85em] leading-none">{READINESS_ICONS[readiness]}</span>
      {label}
    </span>
  );
}