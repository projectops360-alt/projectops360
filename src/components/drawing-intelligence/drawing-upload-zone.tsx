"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileUp, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerDrawingFileAction } from "@/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/actions";
import {
  validateDrawingFile,
  buildDrawingStoragePath,
  SUPPORTED_EXTENSIONS,
  MAX_DRAWING_FILE_SIZE,
} from "@/lib/drawing-intelligence/ingestion";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UploadZoneTranslations {
  dropHere: string;
  browse: string;
  supportedFormats: string;
  maxSize: string;
  /** Per-file stage labels — intelligence pipeline language */
  stageValidating: string;
  stageUploading: string;
  stageRegistering: string;
  stageQueued: string;
  errors: Record<string, string>;
  /** Cost-aware processing mode selector */
  processingMode: string;
  modes: Record<ProcessingMode, string>;
  modeDescriptions: Record<ProcessingMode, string>;
  costNote: string;
}

type ProcessingMode = "quick_scan" | "standard_analysis" | "deep_analysis";

const PROCESSING_MODES: ProcessingMode[] = ["quick_scan", "standard_analysis", "deep_analysis"];

interface UploadEntry {
  id: string;
  fileName: string;
  stage: "validating" | "uploading" | "registering" | "queued" | "error";
  errorKey?: string;
}

interface DrawingUploadZoneProps {
  projectId: string;
  organizationId: string;
  translations: UploadZoneTranslations;
  /** Called after at least one file is fully registered (refresh data) */
  onUploaded: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(file: File): Promise<string | undefined> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Hashing very large files can fail in constrained browsers — dedup then
    // falls back to name+size on the server.
    return undefined;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function DrawingUploadZone({
  projectId,
  organizationId,
  translations: t,
  onUploaded,
}: DrawingUploadZoneProps) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<ProcessingMode>("standard_analysis");
  const inputRef = useRef<HTMLInputElement>(null);

  const updateEntry = useCallback((id: string, patch: Partial<UploadEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processFile = useCallback(
    async (file: File): Promise<boolean> => {
      const entryId = crypto.randomUUID();
      setEntries((prev) => [
        ...prev,
        { id: entryId, fileName: file.name, stage: "validating" },
      ]);

      // 1. Validate locally (server re-validates — client metadata not trusted alone)
      const validation = validateDrawingFile({ fileName: file.name, fileSize: file.size });
      if (!validation.ok) {
        updateEntry(entryId, { stage: "error", errorKey: validation.error });
        return false;
      }

      // 2. Checksum for duplicate detection
      const checksum = await sha256Hex(file);

      // 3. Upload to org/project-scoped storage path
      updateEntry(entryId, { stage: "uploading" });
      const storagePath = buildDrawingStoragePath(
        organizationId,
        projectId,
        file.name,
        crypto.randomUUID(),
      );
      try {
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("drawings")
          .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) {
          console.error("[drawing-upload] storage error:", uploadError);
          updateEntry(entryId, { stage: "error", errorKey: "upload_failed" });
          return false;
        }
      } catch {
        updateEntry(entryId, { stage: "error", errorKey: "upload_failed" });
        return false;
      }

      // 4. Register the drawing record + processing jobs
      updateEntry(entryId, { stage: "registering" });
      const result = await registerDrawingFileAction({
        projectId,
        fileName: file.name,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type || undefined,
        storagePath,
        checksum,
        sourceSystem: "manual_upload",
        processingMode: mode,
      });

      if (result.error) {
        updateEntry(entryId, { stage: "error", errorKey: result.error });
        return false;
      }

      updateEntry(entryId, { stage: "queued" });
      return true;
    },
    [organizationId, projectId, updateEntry, mode],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = [...fileList];
      if (files.length === 0) return;
      let anySuccess = false;
      // Sequential keeps memory bounded for large drawings
      for (const file of files) {
        const ok = await processFile(file);
        anySuccess = anySuccess || ok;
      }
      if (anySuccess) onUploaded();
    },
    [processFile, onUploaded],
  );

  const maxSizeMb = Math.round(MAX_DRAWING_FILE_SIZE / (1024 * 1024));

  return (
    <div className="space-y-3">
      {/* Cost-aware processing mode selector */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">{t.processingMode}</p>
        <div className="flex flex-wrap gap-2">
          {PROCESSING_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              title={t.modeDescriptions[m]}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m
                  ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.modes[m]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t.modeDescriptions[mode]}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">{t.costNote}</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? "border-brand-500 bg-brand-500/5"
            : "border-border bg-card hover:border-brand-500/40 hover:bg-muted/30"
        }`}
      >
        <UploadCloud className={`mb-3 h-8 w-8 ${dragActive ? "text-brand-600" : "text-muted-foreground/60"}`} />
        <p className="text-sm font-medium text-foreground">{t.dropHere}</p>
        <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-400 font-medium">{t.browse}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t.supportedFormats}: {SUPPORTED_EXTENSIONS.join(", ").toUpperCase()} · {t.maxSize}: {maxSizeMb} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Per-file upload status */}
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{entry.fileName}</span>
              {entry.stage === "validating" && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.stageValidating}
                </span>
              )}
              {entry.stage === "uploading" && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.stageUploading}
                </span>
              )}
              {entry.stage === "registering" && (
                <span className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.stageRegistering}
                </span>
              )}
              {entry.stage === "queued" && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t.stageQueued}
                </span>
              )}
              {entry.stage === "error" && (
                <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t.errors[entry.errorKey ?? "upload_failed"] ?? t.errors.upload_failed}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
