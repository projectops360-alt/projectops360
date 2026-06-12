"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud, Library, ScanSearch, AlertTriangle, MessageSquareQuote,
  ClipboardCheck, Calculator, GitCompareArrows, CalendarClock, DollarSign,
  Lightbulb, Crosshair, ScrollText, DraftingCompass, Sparkles,
  Cloud, HardDrive, FolderGit2, Eye, RotateCcw, Archive, Loader2,
} from "lucide-react";
import { DrawingUploadZone, type UploadZoneTranslations } from "@/components/drawing-intelligence/drawing-upload-zone";
import { DrawingDetailPanel, type DetailPanelTranslations } from "@/components/drawing-intelligence/drawing-detail-panel";
import { DrawingInsightCard, type InsightCardTranslations } from "@/components/drawing-intelligence/drawing-insight-card";
import { DrawingProcessingProgress } from "@/components/drawing-intelligence/drawing-processing-progress";
import {
  retryDrawingProcessingJobAction,
  archiveDrawingFileAction,
} from "./actions";
import type { Locale } from "@/types/database";
import type {
  DrawingExtraction,
  DrawingFile,
  DrawingFileStatus,
  DrawingInsight,
  DrawingProcessingJob,
  DrawingProcessingStatus,
  DrawingVersion,
} from "@/types/drawing-intelligence";

// ── Types ──────────────────────────────────────────────────────────────────────

type DrawingTab =
  | "upload" | "library" | "extractions" | "risks" | "rfis" | "submittals"
  | "takeoff" | "versions" | "schedule" | "cost" | "actions" | "evidence" | "logs";

interface DrawingIntelligenceTranslations {
  title: string;
  subtitle: string;
  notStorageNote: string;
  emptyTitle: string;
  emptyDescription: string;
  comingSoon: string;
  tabs: Record<DrawingTab, string>;
  library: {
    drawingNumber: string;
    drawingTitle: string;
    discipline: string;
    revision: string;
    source: string;
    fileStatus: string;
    processingStatus: string;
    added: string;
    empty: string;
  };
  processingStatus: Record<DrawingProcessingStatus, string>;
  fileStatus: Record<DrawingFileStatus, string>;
  upload: {
    title: string;
    description: string;
    manual: string;
    manualDescription: string;
    autodesk: string;
    autodeskDescription: string;
    procore: string;
    procoreDescription: string;
    googleDrive: string;
    googleDriveDescription: string;
    comingSoonBadge: string;
  };
  uploadZone: UploadZoneTranslations;
  actionsMenu: {
    view: string;
    retry: string;
    archive: string;
    confirmArchive: string;
  };
  pipelineHints: Record<DrawingProcessingStatus, string>;
  jobTypes: Record<string, string>;
  extractionsTable: {
    file: string;
    type: string;
    confidence: string;
  };
  takeoffTab: {
    category: string;
    item: string;
    specification: string;
    quantity: string;
    unit: string;
    location: string;
    sheetRef: string;
    status: string;
    drawing: string;
    confidence: string;
    empty: string;
    statusLabels: Record<string, string>;
  };
  insights: InsightCardTranslations & { empty: string };
  versionsTab: {
    drawing: string;
    fromRevision: string;
    toRevision: string;
    summary: string;
    date: string;
    empty: string;
  };
  connector: {
    notConfigured: string;
    notConfiguredHint: string;
    configured: string;
  };
  sourceBadges: Record<string, string>;
  progress: {
    title: string;
    done: string;
    failed: string;
    needsReview: string;
  };
  detail: Omit<DetailPanelTranslations, "processingStatus" | "pipelineHints" | "jobTypes">;
}

interface DrawingIntelligenceClientProps {
  projectId: string;
  projectTitle: string;
  organizationId: string;
  files: DrawingFile[];
  jobs: DrawingProcessingJob[];
  extractions: DrawingExtraction[];
  insights: DrawingInsight[];
  tasks: { id: string; title: string }[];
  versions: DrawingVersion[];
  /** Autodesk connector readiness (checked server-side, env never exposed) */
  autodeskConfigured: boolean;
  locale: Locale;
  translations: DrawingIntelligenceTranslations;
}

/** Which insight types feed each intelligence tab */
const INSIGHT_TAB_TYPES: Partial<Record<DrawingTab, string[]>> = {
  risks: ["risk"],
  rfis: ["rfi_candidate"],
  submittals: ["submittal_requirement", "inspection_requirement"],
  schedule: ["schedule_impact"],
  cost: ["cost_impact"],
  actions: [], // all actionable insights, grouped by recommended action
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ── Constants ────────────────────────────────────────────────────────────────

const TAB_CONFIG: { key: DrawingTab; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "upload", icon: UploadCloud },
  { key: "library", icon: Library },
  { key: "extractions", icon: ScanSearch },
  { key: "risks", icon: AlertTriangle },
  { key: "rfis", icon: MessageSquareQuote },
  { key: "submittals", icon: ClipboardCheck },
  { key: "takeoff", icon: Calculator },
  { key: "versions", icon: GitCompareArrows },
  { key: "schedule", icon: CalendarClock },
  { key: "cost", icon: DollarSign },
  { key: "actions", icon: Lightbulb },
  { key: "evidence", icon: Crosshair },
  { key: "logs", icon: ScrollText },
];

const PROCESSING_BADGE: Record<DrawingProcessingStatus, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

const FILE_STATUS_BADGE: Record<DrawingFileStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  superseded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  archived: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

// ── Component ────────────────────────────────────────────────────────────────

export function DrawingIntelligenceClient({
  projectId,
  projectTitle,
  organizationId,
  files,
  jobs,
  extractions,
  insights,
  tasks,
  versions,
  autodeskConfigured,
  locale,
  translations: t,
}: DrawingIntelligenceClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DrawingTab>(files.length > 0 ? "library" : "upload");
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  const formatDate = (dateStr: string): string =>
    new Date(dateStr).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });

  const hasFiles = files.length > 0;

  // Latest failed job per file (for the row-level retry action)
  const failedJobByFile = new Map<string, DrawingProcessingJob>();
  for (const job of jobs) {
    if ((job.status === "failed" || job.status === "cancelled") && job.drawing_file_id) {
      if (!failedJobByFile.has(job.drawing_file_id)) {
        failedJobByFile.set(job.drawing_file_id, job);
      }
    }
  }

  const handleRetryFile = async (fileId: string) => {
    const job = failedJobByFile.get(fileId);
    if (!job) return;
    setBusyFileId(fileId);
    await retryDrawingProcessingJobAction({ jobId: job.id, projectId });
    setBusyFileId(null);
    router.refresh();
  };

  const handleArchiveFile = async (fileId: string) => {
    if (!confirm(t.actionsMenu.confirmArchive)) return;
    setBusyFileId(fileId);
    await archiveDrawingFileAction({ fileId, projectId });
    setBusyFileId(null);
    if (detailFileId === fileId) setDetailFileId(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{projectTitle}</p>
        <div className="flex items-center gap-2">
          <DraftingCompass className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {t.notStorageNote}
        </p>
      </div>

      {/* Live processing gauge — visible while the pipeline works */}
      <DrawingProcessingProgress
        projectId={projectId}
        initialActive={files.some((file) =>
          file.processing_status === "pending" || file.processing_status === "processing",
        )}
        translations={{
          title: t.progress.title,
          jobTypes: t.jobTypes,
          pipelineHints: t.pipelineHints,
          done: t.progress.done,
          failed: t.progress.failed,
          needsReview: t.progress.needsReview,
        }}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px scrollbar-hide">
        {TAB_CONFIG.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === key
                ? "border-brand-600 text-brand-700 dark:text-brand-300 bg-brand-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.tabs[key]}
          </button>
        ))}
      </div>

      {/* ── Upload / Connect tab ── */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          {!hasFiles && <EmptyState t={t} />}
          <div>
            <h2 className="text-base font-semibold text-foreground">{t.upload.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.upload.description}</p>
          </div>

          {/* Manual upload — functional */}
          <DrawingUploadZone
            projectId={projectId}
            organizationId={organizationId}
            translations={t.uploadZone}
            onUploaded={() => router.refresh()}
          />

          {/* Connectors — Autodesk shows real configuration state */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`relative rounded-xl border bg-card p-4 ${autodeskConfigured ? "border-green-300 dark:border-green-800" : "border-border opacity-90"}`}>
              <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                autodeskConfigured
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}>
                {autodeskConfigured ? t.connector.configured : t.connector.notConfigured}
              </span>
              <Cloud className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">{t.upload.autodesk}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.upload.autodeskDescription}</p>
              {!autodeskConfigured && (
                <p className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-400">{t.connector.notConfiguredHint}</p>
              )}
            </div>
            <ConnectorCard icon={FolderGit2} title={t.upload.procore} description={t.upload.procoreDescription} badge={t.upload.comingSoonBadge} />
            <ConnectorCard icon={HardDrive} title={t.upload.googleDrive} description={t.upload.googleDriveDescription} badge={t.upload.comingSoonBadge} />
          </div>
        </div>
      )}

      {/* ── Drawing Library tab ── */}
      {activeTab === "library" && (
        hasFiles ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t.library.drawingNumber}</th>
                  <th className="px-3 py-2 font-medium">{t.library.drawingTitle}</th>
                  <th className="px-3 py-2 font-medium">{t.library.discipline}</th>
                  <th className="px-3 py-2 font-medium">{t.library.revision}</th>
                  <th className="px-3 py-2 font-medium">{t.library.source}</th>
                  <th className="px-3 py-2 font-medium">{t.library.fileStatus}</th>
                  <th className="px-3 py-2 font-medium">{t.library.processingStatus}</th>
                  <th className="px-3 py-2 font-medium">{t.library.added}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs font-medium text-foreground">{file.drawing_number ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground max-w-[260px] truncate">
                      <button
                        type="button"
                        onClick={() => setDetailFileId(file.id)}
                        className="truncate text-left hover:text-brand-600 hover:underline"
                      >
                        {file.drawing_title ?? file.file_name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{file.discipline ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{file.revision ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        file.source_system === "manual_upload"
                          ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                      }`}>
                        {t.sourceBadges[file.source_system] ?? file.source_system}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${FILE_STATUS_BADGE[file.status]}`}>
                        {t.fileStatus[file.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ProcessingBadge status={file.processing_status} t={t} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(file.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {busyFileId === file.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setDetailFileId(file.id)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={t.actionsMenu.view}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {failedJobByFile.has(file.id) && (
                              <button
                                type="button"
                                onClick={() => void handleRetryFile(file.id)}
                                className="rounded-md p-1 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                title={t.actionsMenu.retry}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleArchiveFile(file.id)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title={t.actionsMenu.archive}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState t={t} />
        )
      )}

      {/* ── Processing Logs tab ── */}
      {activeTab === "logs" && (
        jobs.length > 0 ? (
          <div className="space-y-2">
            {jobs.map((job) => {
              const fileName = files.find((f) => f.id === job.drawing_file_id)?.file_name;
              return (
                <div key={job.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{t.jobTypes[job.job_type] ?? job.job_type}</span>
                      <ProcessingBadge status={job.status} t={t} />
                      {job.retry_count > 0 && (
                        <span className="text-[10px] text-muted-foreground">×{job.retry_count + 1}</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {fileName ?? ""}
                      {job.started_at && ` · ${formatDate(job.started_at)}`}
                      {job.completed_at && ` → ${formatDate(job.completed_at)}`}
                    </p>
                    {job.error_message && (
                      <p className="mt-0.5 truncate text-[11px] text-red-600 dark:text-red-400">{job.error_message}</p>
                    )}
                  </div>
                  <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDate(job.created_at)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <PlaceholderPanel icon={ScrollText} label={t.tabs.logs} message={hasFiles ? t.comingSoon : t.emptyDescription} />
        )
      )}

      {/* ── AI Extraction Results tab ── */}
      {activeTab === "extractions" && (
        extractions.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t.extractionsTable.file}</th>
                  <th className="px-3 py-2 font-medium">{t.extractionsTable.type}</th>
                  <th className="px-3 py-2 font-medium">{t.extractionsTable.confidence}</th>
                  <th className="px-3 py-2 font-medium">{t.library.processingStatus}</th>
                  <th className="px-3 py-2 font-medium">{t.library.added}</th>
                </tr>
              </thead>
              <tbody>
                {extractions.map((extraction) => {
                  const file = files.find((f) => f.id === extraction.drawing_file_id);
                  return (
                    <tr
                      key={extraction.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      onClick={() => extraction.drawing_file_id && setDetailFileId(extraction.drawing_file_id)}
                    >
                      <td className="max-w-[220px] truncate px-3 py-2 text-foreground">{file?.drawing_number ?? file?.file_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{extraction.extraction_type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 tabular-nums text-xs text-foreground">
                        {extraction.confidence_score != null ? `${Math.round(extraction.confidence_score * 100)}%` : "—"}
                      </td>
                      <td className="px-3 py-2"><ProcessingBadge status={extraction.extraction_status} t={t} /></td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(extraction.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <PlaceholderPanel icon={ScanSearch} label={t.tabs.extractions} message={hasFiles ? t.comingSoon : t.emptyDescription} />
        )
      )}

      {/* ── Insight tabs: risks / RFIs / submittals / schedule / cost / actions ── */}
      {INSIGHT_TAB_TYPES[activeTab] !== undefined && (() => {
        const types = INSIGHT_TAB_TYPES[activeTab]!;
        const tabInsights = insights
          .filter((insight) =>
            types.length === 0
              ? insight.status !== "dismissed"
              : types.includes(insight.insight_type),
          )
          .sort((a, b) =>
            (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
            (b.confidence_score ?? 0) - (a.confidence_score ?? 0),
          );
        if (tabInsights.length === 0) {
          return (
            <PlaceholderPanel
              icon={TAB_CONFIG.find((tab) => tab.key === activeTab)?.icon ?? ScanSearch}
              label={t.tabs[activeTab]}
              message={hasFiles ? t.insights.empty : t.emptyDescription}
            />
          );
        }
        return (
          <div className="grid gap-3 lg:grid-cols-2">
            {tabInsights.map((insight) => {
              const file = files.find((f) => f.id === insight.drawing_file_id);
              return (
                <DrawingInsightCard
                  key={insight.id}
                  insight={insight}
                  projectId={projectId}
                  drawingLabel={file?.drawing_number ?? file?.file_name ?? null}
                  tasks={tasks}
                  translations={t.insights}
                  onChanged={() => router.refresh()}
                />
              );
            })}
          </div>
        );
      })()}

      {/* ── Version Changes tab ── */}
      {activeTab === "versions" && (
        versions.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t.versionsTab.drawing}</th>
                  <th className="px-3 py-2 font-medium">{t.versionsTab.fromRevision}</th>
                  <th className="px-3 py-2 font-medium">{t.versionsTab.toRevision}</th>
                  <th className="px-3 py-2 font-medium">{t.versionsTab.summary}</th>
                  <th className="px-3 py-2 font-medium">{t.versionsTab.date}</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr
                    key={version.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    onClick={() => setDetailFileId(version.drawing_file_id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-medium text-foreground">{version.drawing_number ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{version.previous_revision ?? "—"}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{version.current_revision ?? "—"}</td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-xs text-muted-foreground">{version.summary ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(version.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PlaceholderPanel icon={GitCompareArrows} label={t.tabs.versions} message={hasFiles ? t.versionsTab.empty : t.emptyDescription} />
        )
      )}

      {/* ── Quantity / Material Takeoff tab ── */}
      {activeTab === "takeoff" && (() => {
        const takeoffRows = extractions.filter(
          (e) => e.extraction_type === "material_takeoff" || e.extraction_type === "quantity_takeoff",
        );
        if (takeoffRows.length === 0) {
          return (
            <PlaceholderPanel
              icon={Calculator}
              label={t.tabs.takeoff}
              message={hasFiles ? t.takeoffTab.empty : t.emptyDescription}
            />
          );
        }
        // Group rows by category for estimator-friendly reading
        const byCategory = new Map<string, typeof takeoffRows>();
        for (const row of takeoffRows) {
          const category = String((row.extracted_json as { category?: string }).category ?? "—");
          if (!byCategory.has(category)) byCategory.set(category, []);
          byCategory.get(category)!.push(row);
        }
        return (
          <div className="space-y-4">
            {[...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, rows]) => (
              <div key={category} className="overflow-x-auto rounded-xl border border-border">
                <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground">
                  {category}
                  <span className="ml-2 font-normal text-muted-foreground">({rows.length})</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.item}</th>
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.specification}</th>
                      <th className="px-3 py-2 font-medium text-right">{t.takeoffTab.quantity}</th>
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.unit}</th>
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.location}</th>
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.sheetRef}</th>
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.status}</th>
                      <th className="px-3 py-2 font-medium">{t.takeoffTab.drawing}</th>
                      <th className="px-3 py-2 font-medium text-right">{t.takeoffTab.confidence}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const json = row.extracted_json as {
                        item?: string; specification?: string; quantity?: number | null;
                        unit?: string | null; location?: string | null; sheet_ref?: string | null;
                        status?: string | null;
                      };
                      const file = files.find((f) => f.id === row.drawing_file_id);
                      return (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          onClick={() => row.drawing_file_id && setDetailFileId(row.drawing_file_id)}
                        >
                          <td className="max-w-[180px] truncate px-3 py-2 font-medium text-foreground">{json.item ?? "—"}</td>
                          <td className="max-w-[320px] truncate px-3 py-2 text-xs text-muted-foreground" title={json.specification ?? undefined}>
                            {json.specification ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{json.quantity ?? "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{json.unit ?? "—"}</td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-xs text-muted-foreground">{json.location ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{json.sheet_ref ?? "—"}</td>
                          <td className="px-3 py-2">
                            {json.status ? (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                json.status === "new"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : json.status === "demo"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                              }`}>
                                {t.takeoffTab.statusLabels[json.status] ?? json.status}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                            {file?.drawing_number ?? file?.file_name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-foreground">
                            {row.confidence_score != null ? `${Math.round(row.confidence_score * 100)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Remaining tabs (evidence viewer) ── */}
      {activeTab !== "upload" && activeTab !== "library" && activeTab !== "logs" &&
        activeTab !== "extractions" && activeTab !== "versions" && activeTab !== "takeoff" &&
        INSIGHT_TAB_TYPES[activeTab] === undefined && (
        <PlaceholderPanel
          icon={TAB_CONFIG.find((tab) => tab.key === activeTab)?.icon ?? ScanSearch}
          label={t.tabs[activeTab]}
          message={hasFiles ? t.comingSoon : t.emptyDescription}
        />
      )}

      {/* ── Drawing detail side panel ── */}
      {detailFileId && (
        <DrawingDetailPanel
          fileId={detailFileId}
          projectId={projectId}
          locale={locale}
          translations={{
            ...t.detail,
            processingStatus: t.processingStatus,
            pipelineHints: t.pipelineHints,
            jobTypes: t.jobTypes,
          }}
          processingBadgeClass={PROCESSING_BADGE}
          onClose={() => setDetailFileId(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ProcessingBadge({ status, t }: { status: DrawingProcessingStatus; t: DrawingIntelligenceTranslations }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PROCESSING_BADGE[status]}`}>
      {status === "processing" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {t.processingStatus[status]}
    </span>
  );
}

function EmptyState({ t }: { t: DrawingIntelligenceTranslations }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10">
        <DraftingCompass className="h-7 w-7 text-brand-600 dark:text-brand-400" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{t.emptyTitle}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{t.emptyDescription}</p>
    </div>
  );
}

function PlaceholderPanel({
  icon: Icon,
  label,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function ConnectorCard({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-4 opacity-80">
      <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {badge}
      </span>
      <Icon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
      <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
