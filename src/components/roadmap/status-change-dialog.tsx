"use client";

import { useState, useRef, useEffect } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";
import type { TaskStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatusChangeTranslations {
  title: string;
  movingTo: string;
  noteLabel: string;
  notePlaceholder: Record<string, string>;
  moveWithout: string;
  moveWith: string;
  cancel: string;
  statusLabels: Record<string, string>;
}

interface StatusChangeDialogProps {
  taskTitle: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  translations: StatusChangeTranslations;
  onConfirm: (note?: string) => Promise<void>;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────────

export function StatusChangeDialog({
  taskTitle,
  fromStatus,
  toStatus,
  translations: t,
  onConfirm,
  onCancel,
}: StatusChangeDialogProps) {
  const [note, setNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus the textarea when dialog opens
    const timer = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const fromLabel = t.statusLabels[fromStatus] || fromStatus;
  const toLabel = t.statusLabels[toStatus] || toStatus;
  const placeholder = t.notePlaceholder[toStatus] || t.notePlaceholder.default || "";

  async function handleConfirm(withNote: boolean) {
    setIsConfirming(true);
    try {
      await onConfirm(withNote && note.trim() ? note.trim() : undefined);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Task info */}
        <p className="text-sm font-medium text-foreground truncate mb-3">
          {taskTitle}
        </p>

        {/* Status transition */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="rounded-md border border-border bg-muted px-2 py-1 text-muted-foreground">
            {fromLabel}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="rounded-md border border-brand-500/40 bg-brand-50 px-2 py-1 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
            {toLabel}
          </span>
        </div>

        {/* Note textarea */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t.noteLabel}
          </label>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={placeholder}
            disabled={isConfirming}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(false)}
            disabled={isConfirming}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t.moveWithout}
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(true)}
            disabled={isConfirming || !note.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.moveWith}
          </button>
        </div>
      </div>
    </div>
  );
}