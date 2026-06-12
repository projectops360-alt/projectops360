"use client";

import { useState } from "react";
import {
  Zap,
  Check,
  X,
  Pencil,
  User,
  Calendar,
  Flag,
  Quote,
} from "lucide-react";
import type { ActionItemPriority } from "@/types/database";
import type { ExtractedActionItem } from "@/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-action-extract-actions";
import { approveExtractedActionItemAction } from "@/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-action-extract-actions";

// ── Types ───────────────────────────────────────────────────────────────────────

type SuggestionStatus = "pending" | "approving" | "approved" | "rejecting" | "rejected";

// ── Priority badge colors ────────────────────────────────────────────────────────

const priorityColors: Record<ActionItemPriority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

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

// ── Props ────────────────────────────────────────────────────────────────────────

export interface ExtractedActionItemCardProps {
  suggestion: ExtractedActionItem;
  index: number;
  meetingId: string;
  projectId: string;
  aiRunId: string;
  locale: string;
  translations: {
    confidence: string;
    sourceExcerpt: string;
    priority: string;
    dueDate: string;
    ownerName: string;
    approve: string;
    approved: string;
    reject: string;
    rejected: string;
    edit: string;
    save: string;
    cancel: string;
    priorityLabels: Record<ActionItemPriority, string>;
    approvalFailed: string;
    unexpected: string;
  };
  onApproved: (index: number, actionItemId: string) => void;
  onRejected: (index: number) => void;
}

// ── Component ───────────────────────────────────────────────────────────────────

export function ExtractedActionItemCard({
  suggestion,
  index,
  meetingId,
  projectId,
  aiRunId,
  locale,
  translations: t,
  onApproved,
  onRejected,
}: ExtractedActionItemCardProps) {
  const [status, setStatus] = useState<SuggestionStatus>("pending");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title);
  const [editDescription, setEditDescription] = useState(suggestion.description);
  const [editOwnerName, setEditOwnerName] = useState(suggestion.owner_name || "");
  const [editDueDate, setEditDueDate] = useState(suggestion.due_date || "");
  const [editPriority, setEditPriority] = useState<ActionItemPriority>(suggestion.priority);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setStatus("approving");
    setError(null);

    const result = await approveExtractedActionItemAction({
      meetingId,
      projectId,
      title: isEditing ? editTitle : suggestion.title,
      description: isEditing ? editDescription : suggestion.description,
      ownerName: isEditing ? editOwnerName : suggestion.owner_name || "",
      dueDate: isEditing ? editDueDate : suggestion.due_date || "",
      priority: isEditing ? editPriority : suggestion.priority,
      aiRunId,
      locale,
    });

    if (result.error) {
      setStatus("pending");
      setError(t.approvalFailed);
    } else if (result.actionItemId) {
      setStatus("approved");
      onApproved(index, result.actionItemId);
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
    setEditOwnerName(suggestion.owner_name || "");
    setEditDueDate(suggestion.due_date || "");
    setEditPriority(suggestion.priority);
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
          <Zap className="h-4 w-4 text-blue-500 shrink-0" />
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
        {suggestion.owner_name && !isEditing && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {t.ownerName}: {suggestion.owner_name}
          </span>
        )}
        {suggestion.due_date && !isEditing && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {t.dueDate}: {suggestion.due_date}
          </span>
        )}
        {!isEditing && (
          <span className="inline-flex items-center gap-1">
            <Flag className="h-3 w-3" />
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium ${priorityColors[suggestion.priority]}`}
            >
              {t.priorityLabels[suggestion.priority]}
            </span>
          </span>
        )}
      </div>

      {/* Edit-mode metadata fields */}
      {isEditing && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground">{t.ownerName}</label>
              <input
                type="text"
                value={editOwnerName}
                onChange={(e) => setEditOwnerName(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground">{t.dueDate}</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t.priority}</label>
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as ActionItemPriority)}
              className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {Object.entries(t.priorityLabels).map(([key, label]) => (
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