"use client";

import { cn } from "@/lib/utils";

interface GuidedOnboardingProgressProps {
  done: number;
  total: number;
  label: string;
  className?: string;
}

export function GuidedOnboardingProgress({ done, total, label, className }: GuidedOnboardingProgressProps) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}