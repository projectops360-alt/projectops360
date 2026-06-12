"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CommunicationSummaryPanel } from "@/components/ai";
import type { AiCommSummaryTranslations } from "@/components/ai";

// ── Types ───────────────────────────────────────────────────────────────────────

interface ProjectAiSummarySectionProps {
  projectId: string;
  locale: string;
  translations: AiCommSummaryTranslations;
  buttonTooltip: string;
}

// ── Component ───────────────────────────────────────────────────────────────────

export function ProjectAiSummarySection({
  projectId,
  locale,
  translations: t,
  buttonTooltip,
}: ProjectAiSummarySectionProps) {
  const [showAiSummary, setShowAiSummary] = useState(false);

  return (
    <div className="space-y-4">
      {/* Toggle button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAiSummary((prev) => !prev)}
          title={buttonTooltip}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            showAiSummary
              ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-teal-500/40"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AI
        </button>
      </div>

      {/* AI Summary Panel */}
      {showAiSummary && (
        <CommunicationSummaryPanel
          projectId={projectId}
          locale={locale}
          translations={t}
        />
      )}
    </div>
  );
}