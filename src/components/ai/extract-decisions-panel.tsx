"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import type { ImpactArea } from "@/types/database";
import type {
  ExtractedDecision,
  ExtractionResult,
} from "@/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-extract-actions";
import { extractDecisionsFromMeetingAction } from "@/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-extract-actions";
import { ExtractedDecisionCard } from "./extracted-decision-card";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface AiExtractionTranslations {
  title: string;
  description: string;
  empty: string;
  confidence: string;
  sourceExcerpt: string;
  impactArea: string;
  decisionDate: string;
  decisionMaker: string;
  approve: string;
  approved: string;
  reject: string;
  rejected: string;
  edit: string;
  save: string;
  cancel: string;
  extracting: string;
  extractedOn: string;
  aiRunId: string;
  allReviewed: string;
  impactAreaLabels: Record<ImpactArea, string>;
  errors: {
    noNotes: string;
    noContent: string;
    aiFailed: string;
    noApiKey: string;
    approvalFailed: string;
    unexpected: string;
  };
}

interface ExtractDecisionsPanelProps {
  meetingId: string;
  projectId: string;
  locale: string;
  translations: AiExtractionTranslations;
  onDecisionCreated?: (decisionId: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────────────

export function ExtractDecisionsPanel({
  meetingId,
  projectId,
  locale,
  translations: t,
  onDecisionCreated,
}: ExtractDecisionsPanelProps) {
  const [suggestions, setSuggestions] = useState<ExtractedDecision[]>([]);
  const [aiRunId, setAiRunId] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which suggestions have been resolved (approved or rejected)
  const [resolvedIndices, setResolvedIndices] = useState<Set<number>>(new Set());

  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setError(null);
    setSuggestions([]);
    setResolvedIndices(new Set());

    const result: ExtractionResult = await extractDecisionsFromMeetingAction({
      meetingId,
      projectId,
      locale,
    });

    setIsExtracting(false);
    setHasExtracted(true);

    if (result.error) {
      const errorKey = result.error as keyof typeof t.errors;
      setError(t.errors[errorKey] || t.errors.unexpected);
      return;
    }

    setSuggestions(result.suggestions);
    setAiRunId(result.aiRunId);
  }, [meetingId, projectId, locale, t.errors]);

  const handleApproved = useCallback(
    (index: number, decisionId: string) => {
      setResolvedIndices((prev) => new Set(prev).add(index));
      onDecisionCreated?.(decisionId);
    },
    [onDecisionCreated],
  );

  const handleRejected = useCallback((index: number) => {
    setResolvedIndices((prev) => new Set(prev).add(index));
  }, []);

  const allResolved =
    suggestions.length > 0 && resolvedIndices.size === suggestions.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
        </div>
        {!hasExtracted && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.extracting}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t.title}
              </>
            )}
          </button>
        )}
      </div>

      {/* Loading state */}
      {isExtracting && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          <p className="text-sm text-muted-foreground">{t.extracting}</p>
        </div>
      )}

      {/* Error state */}
      {error && !isExtracting && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty results */}
      {hasExtracted && !isExtracting && suggestions.length === 0 && !error && (
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        </div>
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {t.description.replace("[count]", String(suggestions.length))}
          </p>

          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <ExtractedDecisionCard
                key={index}
                suggestion={suggestion}
                index={index}
                meetingId={meetingId}
                projectId={projectId}
                aiRunId={aiRunId}
                locale={locale}
                translations={{
                  confidence: t.confidence,
                  sourceExcerpt: t.sourceExcerpt,
                  impactArea: t.impactArea,
                  decisionDate: t.decisionDate,
                  decisionMaker: t.decisionMaker,
                  approve: t.approve,
                  approved: t.approved,
                  reject: t.reject,
                  rejected: t.rejected,
                  edit: t.edit,
                  save: t.save,
                  cancel: t.cancel,
                  impactAreaLabels: t.impactAreaLabels,
                  approvalFailed: t.errors.approvalFailed,
                  unexpected: t.errors.unexpected,
                }}
                onApproved={handleApproved}
                onRejected={handleRejected}
              />
            ))}
          </div>

          {/* All reviewed indicator */}
          {allResolved && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-950/50">
              <CheckCircle2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
                {t.allReviewed}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}