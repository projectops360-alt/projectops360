"use client";

import { useState } from "react";
import {
  Sparkles,
  Check,
  X,
  Pencil,
  User,
  Calendar,
  Target,
  Quote,
} from "lucide-react";
import type { ImpactArea } from "@/types/database";
import type { ExtractedDecision } from "@/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-extract-actions";
import { approveExtractedDecisionAction } from "@/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-extract-actions";
import { ImpactBadge } from "@/components/decisions/impact-badge";

// ── Types ───────────────────────────────────────────────────────────────────────

type SuggestionStatus = "pending" | "approving" | "approved" | "rejecting" | "rejected";

export interface ExtractedDecisionCardProps {
  suggestion: ExtractedDecision;
  index: number;
  meetingId: string;
  projectId: string;
  aiRunId: string;
  locale: string;
  translations: {
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
    impactAreaLabels: Record<ImpactArea, string>;
    approvalFailed: string;
    unexpected: string;
  };
  onApproved: (index: number, decisionId: string) => void;
  onRejected: (index: number) => void;
}

// ── Confidence color helper ──────────────────────────────────────────────────────

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-brand-700 dark:text-brand-400";
  if (confidence >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function confidenceBg(confidence: number): string {
  if (confidence >= 0.8) return "bg-brand-50 dark:bg-brand-950/50";
  if (confidence >= 0.5) return "bg-amber-50 dark:bg-amber-950/50";
  return "bg-red-50 dark:bg-red-950/50";
}

// ── Component ───────────────────────────────────────────────────────────────────

export function ExtractedDecisionCard({
  suggestion,
  index,
  meetingId,
  projectId,
  aiRunId,
  locale,
  translations: t,
  onApproved,
  onRejected,
}: ExtractedDecisionCardProps) {
  const [status, setStatus] = useState<SuggestionStatus>("pending");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title);
  const [editDescription, setEditDescription] = useState(suggestion.description);
  const [editDecisionMaker, setEditDecisionMaker] = useState(suggestion.decision_maker || "");
  const [editDecisionDate, setEditDecisionDate] = useState(suggestion.decision_date || "");
  const [editImpactArea, setEditImpactArea] = useState<ImpactArea | null>(suggestion.impact_area);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setStatus("approving");
    setError(null);

    const result = await approveExtractedDecisionAction({
      meetingId,
      projectId,
      title: isEditing ? editTitle : suggestion.title,
      description: isEditing ? editDescription : suggestion.description,
      decisionMaker: isEditing ? editDecisionMaker : suggestion.decision_maker || "",
      decisionDate: isEditing ? editDecisionDate : suggestion.decision_date || "",
      impactArea: isEditing ? (editImpactArea || undefined) : suggestion.impact_area || undefined,
      aiRunId,
      locale,
    });

    if (result.error) {
      setStatus("pending");
      setError(t.approvalFailed);
    } else if (result.decisionId) {
      setStatus("approved");
      onApproved(index, result.decisionId);
    }
  };

  const handleReject = () => {
    setStatus("rejected");
    onRejected(index);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(suggestion.title);
    setEditDescription(suggestion.description);
    setEditDecisionMaker(suggestion.decision_maker || "");
    setEditDecisionDate(suggestion.decision_date || "");
    setEditImpactArea(suggestion.impact_area);
    setIsEditing(false);
  };

  // Approved/rejected state — minimal display
  if (status === "approved") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950/50">
        <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
          {isEditing ? editTitle : suggestion.title}
        </span>
        <span className="ml-auto text-xs text-brand-500 dark:text-brand-400">
          {t.approved}
        </span>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 opacity-60">
        <X className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground line-through">
          {suggestion.title}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {t.rejected}
        </span>
      </div>
    );
  }

  const displayTitle = isEditing ? editTitle : suggestion.title;
  const displayDescription = isEditing ? editDescription : suggestion.description;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header: title + confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : (
            <h4 className="text-sm font-semibold text-foreground">{displayTitle}</h4>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceBg(suggestion.confidence)} ${confidenceColor(suggestion.confidence)}`}
        >
          {t.confidence}: {Math.round(suggestion.confidence * 100)}%
        </span>
      </div>

      {/* Description */}
      {isEditing ? (
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      ) : (
        displayDescription && (
          <p className="text-sm text-muted-foreground">{displayDescription}</p>
        )
      )}

      {/* Metadata row */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {suggestion.decision_maker && !isEditing && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {t.decisionMaker}: {suggestion.decision_maker}
          </span>
        )}
        {suggestion.decision_date && !isEditing && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {t.decisionDate}: {suggestion.decision_date}
          </span>
        )}
        {suggestion.impact_area && !isEditing && (
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" />
            <ImpactBadge
              impactArea={suggestion.impact_area}
              label={t.impactAreaLabels[suggestion.impact_area]}
              compact
            />
          </span>
        )}
      </div>

      {/* Edit-mode metadata fields */}
      {isEditing && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground">{t.decisionMaker}</label>
              <input
                type="text"
                value={editDecisionMaker}
                onChange={(e) => setEditDecisionMaker(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground">{t.decisionDate}</label>
              <input
                type="date"
                value={editDecisionDate}
                onChange={(e) => setEditDecisionDate(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t.impactArea}</label>
            <select
              value={editImpactArea || ""}
              onChange={(e) => setEditImpactArea((e.target.value || null) as ImpactArea | null)}
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">—</option>
              {Object.entries(t.impactAreaLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Source excerpt */}
      {suggestion.source_excerpt && (
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            <Quote className="h-3 w-3" />
            {t.sourceExcerpt}
          </div>
          <p className="text-xs text-muted-foreground italic leading-relaxed">
            &ldquo;{suggestion.source_excerpt}&rdquo;
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editTitle.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {t.save}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              {t.cancel}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={status === "approving"}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {status === "approving" ? "…" : t.approve}
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3 w-3" />
              {t.reject}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <Pencil className="h-3 w-3" />
              {t.edit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}