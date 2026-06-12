"use client";

import { useEffect, useState } from "react";
import {
  X, Loader2, ScanSearch, Crosshair, ScrollText, RotateCcw, FileText,
  AlertTriangle, Sparkles, ChevronDown, Braces, History, StickyNote,
} from "lucide-react";
import {
  getDrawingDetailAction,
  retryDrawingProcessingJobAction,
  processDrawingFileAction,
} from "@/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/actions";
import type { Locale } from "@/types/database";
import type {
  DrawingEvidence,
  DrawingExtraction,
  DrawingFile,
  DrawingPage,
  DrawingProcessingJob,
  DrawingProcessingStatus,
} from "@/types/drawing-intelligence";

// Shapes stored by the extraction pipeline in extracted_json
interface TitleBlockJson {
  fields?: { field: string; value: string; confidence_score: number; method: string; evidence?: { page_number?: number; text_excerpt?: string } }[];
  values?: Record<string, string>;
}
interface RevisionJson {
  entries?: { revision: string; revision_date: string | null; description: string | null; issued_by: string | null; confidence_score: number }[];
}
interface NotesJson {
  category?: string;
  notes?: { note_id: string; text: string; category: string; page_number: number; confidence_score: number }[];
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DetailPanelTranslations {
  title: string;
  metadata: string;
  pipeline: string;
  pages: string;
  extractionsPlaceholder: string;
  evidencePlaceholder: string;
  retry: string;
  noJobs: string;
  titleBlock: string;
  revisions: string;
  notes: string;
  evidence: string;
  rawJson: string;
  confidence: string;
  needsReviewBanner: string;
  runExtraction: string;
  running: string;
  fields: {
    fileName: string;
    fileType: string;
    fileSize: string;
    source: string;
    drawingNumber: string;
    revision: string;
    discipline: string;
    uploaded: string;
  };
  processingStatus: Record<DrawingProcessingStatus, string>;
  pipelineHints: Record<DrawingProcessingStatus, string>;
  jobTypes: Record<string, string>;
}

interface DrawingDetailPanelProps {
  fileId: string;
  projectId: string;
  locale: Locale;
  translations: DetailPanelTranslations;
  processingBadgeClass: Record<DrawingProcessingStatus, string>;
  onClose: () => void;
  onChanged: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DrawingDetailPanel({
  fileId,
  projectId,
  locale,
  translations: t,
  processingBadgeClass,
  onClose,
  onChanged,
}: DrawingDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<DrawingFile | null>(null);
  const [pages, setPages] = useState<DrawingPage[]>([]);
  const [extractions, setExtractions] = useState<DrawingExtraction[]>([]);
  const [jobs, setJobs] = useState<DrawingProcessingJob[]>([]);
  const [evidence, setEvidence] = useState<DrawingEvidence[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const load = async () => {
    const result = await getDrawingDetailAction({ fileId, projectId });
    if (result.file) {
      setFile(result.file);
      setPages(result.pages ?? []);
      setExtractions(result.extractions ?? []);
      setJobs(result.jobs ?? []);
      setEvidence(result.evidence ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Lazy-load the drawing detail when the panel opens / the file changes.
    // State updates happen after the server action resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  const formatDate = (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const formatSize = (bytes: number | null): string => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    const result = await retryDrawingProcessingJobAction({ jobId, projectId });
    setRetrying(null);
    if (!result.error) {
      await load();
      onChanged();
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    await processDrawingFileAction({ fileId, projectId });
    setProcessing(false);
    await load();
    onChanged();
  };

  // Parsed extraction sections
  const titleBlockRow = extractions.find((e) => e.extraction_type === "title_block");
  const titleBlock = (titleBlockRow?.extracted_json ?? {}) as TitleBlockJson;
  const revisionEntries = extractions
    .filter((e) => e.extraction_type === "revision_block")
    .flatMap((e) => ((e.extracted_json as RevisionJson).entries ?? []));
  const noteRows = extractions.filter(
    (e) => e.extraction_type === "general_notes" || e.extraction_type === "keynotes",
  );
  const allNotes = noteRows.flatMap((e) => ((e.extracted_json as NotesJson).notes ?? []));
  const isPdf = file?.file_type === "pdf";
  const needsReview =
    file?.processing_status === "needs_review" ||
    extractions.some((e) => e.extraction_status === "needs_review");
  const canonical = (file?.metadata as Record<string, unknown> | undefined)?.canonical_extraction;

  const pct = (score: number | null | undefined): string =>
    score != null ? `${Math.round(score * 100)}%` : "—";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading || !file ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Header + status */}
              <div>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold text-foreground">
                      {file.drawing_title ?? file.file_name}
                    </p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${processingBadgeClass[file.processing_status]}`}>
                      {t.processingStatus[file.processing_status]}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.pipelineHints[file.processing_status]}</p>
              </div>

              {/* Needs-review banner — never pretend uncertain data is correct */}
              {needsReview && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t.needsReviewBanner}</span>
                </div>
              )}

              {/* Run / re-run extraction */}
              {isPdf && (
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => void handleProcess()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {processing ? t.running : t.runExtraction}
                </button>
              )}

              {/* Metadata */}
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t.metadata}</h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <MetaItem label={t.fields.drawingNumber} value={file.drawing_number ?? "—"} mono />
                  <MetaItem label={t.fields.revision} value={file.revision ?? "—"} />
                  <MetaItem label={t.fields.discipline} value={file.discipline ?? "—"} />
                  <MetaItem label={t.fields.fileType} value={(file.file_extension ?? file.file_type ?? "—").toUpperCase()} />
                  <MetaItem label={t.fields.fileSize} value={formatSize(file.file_size)} />
                  <MetaItem label={t.fields.source} value={file.source_system} />
                  <MetaItem label={t.fields.uploaded} value={formatDate(file.created_at)} />
                  <MetaItem label={t.fields.fileName} value={file.original_file_name ?? file.file_name} breakAll />
                </dl>
              </section>

              {/* Processing pipeline */}
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t.pipeline}</h3>
                {jobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.noJobs}</p>
                ) : (
                  <div className="space-y-1.5">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs">
                        <ScrollText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {t.jobTypes[job.job_type] ?? job.job_type}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${processingBadgeClass[job.status]}`}>
                          {t.processingStatus[job.status]}
                        </span>
                        {(job.status === "failed" || job.status === "cancelled") && (
                          <button
                            type="button"
                            disabled={retrying === job.id}
                            onClick={() => void handleRetry(job.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                          >
                            {retrying === job.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RotateCcw className="h-3 w-3" />}
                            {t.retry}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {jobs.some((j) => j.error_message) && (
                  <div className="mt-2 space-y-1">
                    {jobs.filter((j) => j.error_message).map((j) => (
                      <p key={j.id} className="text-[11px] text-red-600 dark:text-red-400">
                        {t.jobTypes[j.job_type] ?? j.job_type}: {j.error_message}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              {/* Pages (populated by Prompt 3 page_split) */}
              {pages.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t.pages}</h3>
                  <div className="space-y-1">
                    {pages.map((page) => (
                      <div key={page.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{page.page_number}</span>
                        <span>{page.sheet_number ?? ""}</span>
                        <span className="truncate">{page.sheet_name ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Title block */}
              {titleBlock.fields && titleBlock.fields.length > 0 ? (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <ScanSearch className="h-3 w-3" /> {t.titleBlock}
                    <span className="ml-auto font-normal normal-case text-muted-foreground">
                      {t.confidence}: {pct(titleBlockRow?.confidence_score)}
                    </span>
                  </h3>
                  <div className="space-y-1">
                    {titleBlock.fields.map((field) => (
                      <div key={field.field} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                        <span className="w-28 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">{field.field.replace(/_/g, " ")}</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={field.evidence?.text_excerpt}>{field.value}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0 text-[9px] font-semibold tabular-nums ${field.confidence_score >= 0.7 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          {pct(field.confidence_score)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-lg border border-dashed border-border p-3 text-center">
                  <ScanSearch className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">{t.extractionsPlaceholder}</p>
                </section>
              )}

              {/* Revision block */}
              {revisionEntries.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <History className="h-3 w-3" /> {t.revisions}
                  </h3>
                  <div className="space-y-1">
                    {revisionEntries.map((rev, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                        <span className="w-8 shrink-0 font-mono font-semibold text-foreground">{rev.revision}</span>
                        <span className="shrink-0 text-muted-foreground">{rev.revision_date ?? "—"}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{rev.description ?? ""}</span>
                        {rev.issued_by && <span className="shrink-0 text-[10px] text-muted-foreground">{rev.issued_by}</span>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Notes */}
              {allNotes.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <StickyNote className="h-3 w-3" /> {t.notes}
                    <span className="ml-auto font-normal normal-case text-muted-foreground">{allNotes.length}</span>
                  </h3>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {allNotes.map((note, i) => (
                      <div key={`${note.note_id}-${i}`} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-brand-600 dark:text-brand-400">{note.note_id}</span>
                          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">{note.category.replace(/_/g, " ")}</span>
                          <span className="ml-auto text-[9px] text-muted-foreground">p.{note.page_number} · {pct(note.confidence_score)}</span>
                        </div>
                        <p className="mt-0.5 text-foreground">{note.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Evidence */}
              {evidence.length > 0 ? (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <Crosshair className="h-3 w-3" /> {t.evidence}
                    <span className="ml-auto font-normal normal-case text-muted-foreground">{evidence.length}</span>
                  </h3>
                  <div className="max-h-44 space-y-1 overflow-y-auto">
                    {evidence.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px]">
                        <span className="shrink-0 font-mono text-[9px] text-muted-foreground">p.{ev.page_number ?? "?"}</span>
                        <span className="min-w-0 flex-1 break-words text-muted-foreground">{ev.text_excerpt ?? ev.evidence_type}</span>
                        <span className="shrink-0 text-[9px] text-muted-foreground">{pct(ev.confidence_score)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-lg border border-dashed border-border p-3 text-center">
                  <Crosshair className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">{t.evidencePlaceholder}</p>
                </section>
              )}

              {/* Raw extracted JSON */}
              {canonical != null && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
                  >
                    <Braces className="h-3 w-3" />
                    {t.rawJson}
                    <ChevronDown className={`h-3 w-3 transition-transform ${showRawJson ? "" : "-rotate-90"}`} />
                  </button>
                  {showRawJson && (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-[10px] leading-relaxed text-foreground">
                      {JSON.stringify(canonical, null, 2)}
                    </pre>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function MetaItem({
  label,
  value,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</dt>
      <dd className={`mt-0.5 text-foreground ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : "truncate"}`}>
        {value}
      </dd>
    </div>
  );
}
