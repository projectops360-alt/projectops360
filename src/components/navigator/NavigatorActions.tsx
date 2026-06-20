"use client";

import { ArrowRight, Compass, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigatorActionsProps {
  continueLabel: string;
  showMeHowLabel: string;
  askAiGuideLabel: string;
  aiGuideComingSoonLabel: string;
  goToModuleLabel: string;
  nextModuleTitle: string | null;
  /** Locale-less route for the next module, or null when not navigable. */
  nextRoute: string | null;
  showMeHowOpen: boolean;
  onToggleShowMeHow: () => void;
  onContinue: () => void;
  onGoToModule: () => void;
}

export function NavigatorActions({
  continueLabel,
  showMeHowLabel,
  askAiGuideLabel,
  aiGuideComingSoonLabel,
  goToModuleLabel,
  nextModuleTitle,
  nextRoute,
  showMeHowOpen,
  onToggleShowMeHow,
  onContinue,
  onGoToModule,
}: NavigatorActionsProps) {
  const canGo = Boolean(nextRoute && nextModuleTitle);
  return (
    <div className="space-y-2">
      {/* Continue in this module — primary */}
      <button
        type="button"
        onClick={onContinue}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        <Compass className="h-4 w-4" aria-hidden="true" />
        {continueLabel}
      </button>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Show me how — toggle */}
        <button
          type="button"
          onClick={onToggleShowMeHow}
          aria-expanded={showMeHowOpen}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
            showMeHowOpen
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {showMeHowLabel}
        </button>

        {/* Ask AI Guide — disabled placeholder */}
        <button
          type="button"
          disabled
          title={aiGuideComingSoonLabel}
          className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="truncate">{askAiGuideLabel}</span>
        </button>
      </div>

      {/* Go to module */}
      {canGo && (
        <button
          type="button"
          onClick={onGoToModule}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        >
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">{goToModuleLabel}:</span>
            <span className="truncate text-brand-700">{nextModuleTitle}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}