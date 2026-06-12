"use client";

// ============================================================================
// ProjectOps360° — Live Processing Progress Gauge
// ============================================================================
// Shows, per drawing, what the intelligence pipeline is doing right now and
// how far along it is: 4 stage chips (ingest → page split → OCR/text → AI
// interpretation), a progress bar with %, and the current activity label.
// Polls a lightweight server action every 2.5s ONLY while something is
// pending/processing; refreshes the page data once when a file finishes.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Circle, AlertCircle, FileText, Activity } from "lucide-react";
import {
  getDrawingProcessingProgressAction,
  type FileProcessingProgress,
} from "@/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProcessingProgressTranslations {
  title: string;
  /** Stage labels keyed by job_type (reuse jobTypes translations) */
  jobTypes: Record<string, string>;
  /** Long activity phrases keyed by processing status */
  pipelineHints: Record<string, string>;
  done: string;
  failed: string;
  needsReview: string;
}

interface DrawingProcessingProgressProps {
  projectId: string;
  /** Files with pending/processing status at page render time */
  initialActive: boolean;
  translations: ProcessingProgressTranslations;
}

const PIPELINE_ORDER = ["ingest", "page_split", "ocr_extraction", "ai_interpretation"];
const ACTIVE_STATUSES = new Set(["pending", "processing"]);
const POLL_MS = 2500;

// ── Progress math ─────────────────────────────────────────────────────────────

function fileProgress(file: FileProcessingProgress): {
  percent: number;
  currentStage: string | null;
  terminal: boolean;
} {
  const ordered = PIPELINE_ORDER.map(
    (type) => file.jobs.find((job) => job.job_type === type) ?? { job_type: type, status: "pending" },
  );
  let score = 0;
  let currentStage: string | null = null;
  for (const job of ordered) {
    if (job.status === "completed" || job.status === "needs_review" || job.status === "cancelled") {
      score += 1;
    } else if (job.status === "processing") {
      score += 0.5;
      if (!currentStage) currentStage = job.job_type;
    } else if (job.status === "failed") {
      if (!currentStage) currentStage = job.job_type;
    } else if (!currentStage) {
      currentStage = job.job_type; // first pending
    }
  }
  const terminal = !ACTIVE_STATUSES.has(file.processingStatus);
  return {
    percent: terminal ? 100 : Math.min(95, Math.round((score / PIPELINE_ORDER.length) * 100)),
    currentStage,
    terminal,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function DrawingProcessingProgress({
  projectId,
  initialActive,
  translations: t,
}: DrawingProcessingProgressProps) {
  const router = useRouter();
  const [files, setFiles] = useState<FileProcessingProgress[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const knownActive = useRef<Set<string>>(new Set());

  const shouldPoll = initialActive && !exhausted;

  const tick = useCallback(async () => {
    const result = await getDrawingProcessingProgressAction({ projectId });
    if (!result.files) return;
    setFiles(result.files);

    const nowActive = new Set(
      result.files.filter((f) => ACTIVE_STATUSES.has(f.processingStatus)).map((f) => f.fileId),
    );
    // A previously-active file finished → refresh library/badges once
    const finished = [...knownActive.current].some((id) => !nowActive.has(id));
    knownActive.current = nowActive;
    if (finished) {
      setJustFinished(true);
      router.refresh();
    }
    if (nowActive.size === 0) setExhausted(true);
  }, [projectId, router]);

  useEffect(() => {
    if (!shouldPoll) return;
    // Async polling loop: state updates happen after the server action
    // resolves, never synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(interval);
  }, [shouldPoll, tick]);

  const activeFiles = files.filter((file) => ACTIVE_STATUSES.has(file.processingStatus));
  if (activeFiles.length === 0 && !justFinished) return null;
  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Activity className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <span className="text-xs font-semibold text-foreground">{t.title}</span>
      </div>

      <div className="space-y-3">
        {(activeFiles.length > 0 ? activeFiles : files.slice(0, 3)).map((file) => {
          const { percent, currentStage, terminal } = fileProgress(file);
          const failed = file.processingStatus === "failed";
          const needsReview = file.processingStatus === "needs_review";

          return (
            <div key={file.fileId}>
              {/* File + current activity */}
              <div className="flex items-center gap-2 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{file.fileName}</span>
                <span className={`shrink-0 tabular-nums font-semibold ${failed ? "text-red-600 dark:text-red-400" : "text-brand-700 dark:text-brand-300"}`}>
                  {percent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    failed ? "bg-red-500" : needsReview ? "bg-amber-500" : terminal ? "bg-green-500" : "bg-brand-600"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Stage chips */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {PIPELINE_ORDER.map((stage) => {
                  const job = file.jobs.find((j) => j.job_type === stage);
                  const status = job?.status ?? "pending";
                  return (
                    <span key={stage} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      {status === "completed" || status === "needs_review" ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : status === "processing" ? (
                        <Loader2 className="h-3 w-3 animate-spin text-brand-600 dark:text-brand-400" />
                      ) : status === "failed" ? (
                        <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span className={status === "processing" ? "font-medium text-foreground" : ""}>
                        {t.jobTypes[stage] ?? stage}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* Current activity phrase */}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {terminal
                  ? failed
                    ? t.failed
                    : needsReview
                      ? t.needsReview
                      : t.done
                  : currentStage
                    ? `${t.jobTypes[currentStage] ?? currentStage}…`
                    : t.pipelineHints[file.processingStatus] ?? ""}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
