"use client";

import { useState, useCallback } from "react";
import { localizedHref } from "@/i18n/href";
import {
  FileText,
  Loader2,
  MessageSquare,
  Gavel,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import type {
  CommSummaryResult,
  SourceRecordRef,
  KeyPoint,
} from "@/app/[locale]/(app)/projects/[projectId]/ai-summary-action";
import { summarizeCommunicationHistoryAction } from "@/app/[locale]/(app)/projects/[projectId]/ai-summary-action";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface AiCommSummaryTranslations {
  button: string;
  buttonTooltip: string;
  title: string;
  empty: string;
  summary: string;
  keyPoints: string;
  sourceRecords: string;
  openItems: string;
  none: string;
  recordCount: string;
  generating: string;
  communicationLabel: string;
  decisionLabel: string;
  errors: {
    noRecords: string;
    aiFailed: string;
    noApiKey: string;
    unexpected: string;
  };
}

interface CommunicationSummaryPanelProps {
  projectId: string;
  locale: string;
  translations: AiCommSummaryTranslations;
}

// ── Source record badge ──────────────────────────────────────────────────────────

function SourceRecordBadge({
  record,
  projectId,
  locale,
  translations: t,
}: {
  record: SourceRecordRef;
  projectId: string;
  locale: string;
  translations: AiCommSummaryTranslations;
}) {
  const isComm = record.type === "communication";
  const route = isComm
    ? localizedHref(locale, `/projects/${projectId}/communications`)
    : localizedHref(locale, `/projects/${projectId}/decisions`);
  const Icon = isComm ? MessageSquare : Gavel;
  const label = isComm ? t.communicationLabel : t.decisionLabel;
  const color = isComm
    ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";

  return (
    <a
      href={route}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 ${color}`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}:</span>
      <span className="max-w-[160px] truncate">{record.title}</span>
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────

export function CommunicationSummaryPanel({
  projectId,
  locale,
  translations: t,
}: CommunicationSummaryPanelProps) {
  const [result, setResult] = useState<CommSummaryResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    const res = await summarizeCommunicationHistoryAction({
      projectId,
      locale,
    });

    setIsGenerating(false);

    if (res.error) {
      const errorKey = res.error as keyof typeof t.errors;
      setError(t.errors[errorKey] || t.errors.unexpected);
      return;
    }

    setResult(res);
  }, [projectId, locale, t.errors]);

  // Build source records lookup map
  const sourceMap = new Map<string, SourceRecordRef>();
  if (result) {
    for (const sr of result.sourceRecords) {
      sourceMap.set(sr.id, sr);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-500" />
          <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
        </div>
        {!result && !error && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.generating}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                {t.button}
              </>
            )}
          </button>
        )}
      </div>

      {/* Loading */}
      {isGenerating && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
          <p className="text-sm text-muted-foreground">{t.generating}</p>
        </div>
      )}

      {/* Error */}
      {error && !isGenerating && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty */}
      {result && result.summary === "" && !isGenerating && !error && (
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        </div>
      )}

      {/* Summary content */}
      {result && result.summary && (
        <>
          {/* Record count */}
          <p className="text-xs text-muted-foreground">
            {t.recordCount
              .replace("[commCount]", String(result.recordCount.communications))
              .replace("[decCount]", String(result.recordCount.decisions))}
          </p>

          {/* Overview */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2">{t.summary}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
          </div>

          {/* Key points */}
          {result.keyPoints.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">{t.keyPoints}</h4>
              <div className="space-y-3">
                {result.keyPoints.map((kp, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm text-foreground">{kp.point}</p>
                    {kp.source_ids.length > 0 && (
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          {t.sourceRecords}
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {kp.source_ids.map((id) => {
                            const ref = sourceMap.get(id);
                            if (!ref) return null;
                            return (
                              <SourceRecordBadge
                                key={id}
                                record={ref}
                                projectId={projectId}
                                locale={locale}
                                translations={t}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open items */}
          {result.openItems && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">{t.openItems}</h4>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/50">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">{result.openItems}</p>
              </div>
            </div>
          )}

          {/* Regenerate */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              ↻ {t.button}
            </button>
          </div>
        </>
      )}
    </div>
  );
}