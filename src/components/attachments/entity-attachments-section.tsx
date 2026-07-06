"use client";

// ============================================================================
// ProjectOps360° — Task & Subtask Attachments · Reusable section
// ============================================================================
// One compact component for BOTH tasks and subtasks (exactly one of taskId /
// subtaskId). Lists active attachments, uploads via the browser storage service
// (RLS-enforced), opens/downloads through short-lived signed URLs, and removes
// when the server says the caller may (DTO.canRemove). A load failure degrades
// gracefully — it never blocks the surrounding task/subtask detail. All strings
// come from i18n (attachments.*). The presentational list is split out
// (AttachmentListView) so it is unit-testable. Guarded by
// TASK-SUBTASK-FILE-ATTACHMENTS.
// ============================================================================

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import {
  getAttachmentSignedUrlAction,
  listSubtaskAttachmentsAction,
  listTaskAttachmentsAction,
  removeAttachmentAction,
} from "@/lib/attachments/actions";
import { uploadAttachment } from "@/lib/attachments/storage-service";
import { ATTACHMENT_MAX_BATCH } from "@/lib/attachments/types";
import type { AttachmentDTO } from "@/lib/attachments/types";

export interface EntityAttachmentsSectionProps {
  projectId: string;
  taskId?: string;
  subtaskId?: string;
  /** Hides all write affordances (upload + remove) regardless of role. */
  readonly?: boolean;
  /** When false, the upload control is hidden (e.g., viewers). Default true. */
  canUpload?: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function AttachmentIcon({ mime }: { mime: string }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  if (mime.startsWith("image/")) return <ImageIcon className={cls} aria-hidden />;
  if (mime === "application/pdf" || mime.startsWith("text/"))
    return <FileText className={cls} aria-hidden />;
  return <FileIcon className={cls} aria-hidden />;
}

// ── Presentational list (pure; unit-tested via SSR) ─────────────────────────

export interface AttachmentListViewProps {
  attachments: AttachmentDTO[];
  loaded: boolean;
  hasError: boolean;
  readonly: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

export function AttachmentListView(props: AttachmentListViewProps) {
  const t = useTranslations("attachments");
  const { attachments, loaded, hasError, readonly, busy } = props;

  return (
    <>
      {loaded && attachments.length === 0 && !hasError && (
        <p data-testid="attachment-empty" className="text-[11px] text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <ul className="space-y-1.5">
        {attachments.map((a) => (
          <li
            key={a.id}
            data-testid="attachment-item"
            className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5"
          >
            <AttachmentIcon mime={a.mimeType} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground" title={a.fileName}>
                {a.fileName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatBytes(a.sizeBytes)} · {a.uploadedAt.slice(0, 10)}
                {a.uploadedByName ? ` · ${t("uploadedBy", { name: a.uploadedByName })}` : ""}
              </p>
            </div>
            <button
              type="button"
              data-testid="attachment-open"
              disabled={busy}
              onClick={() => props.onOpen(a.id)}
              aria-label={t("open")}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
            </button>
            {!readonly && a.canRemove && (
              <button
                type="button"
                data-testid="attachment-remove"
                disabled={busy}
                onClick={() => props.onRemove(a.id)}
                aria-label={t("remove")}
                className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Data-loading container ──────────────────────────────────────────────────

export function EntityAttachmentsSection(props: EntityAttachmentsSectionProps) {
  const t = useTranslations("attachments");
  const { projectId, taskId, subtaskId, readonly = false } = props;
  const canUpload = !readonly && props.canUpload !== false;

  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errorText = (key: string) =>
    // Any unknown key collapses to the generic message — never leak a raw code.
    t.has(`errors.${key}`) ? t(`errors.${key}`) : t("errors.unexpected");

  const load = useCallback(async () => {
    const res = taskId
      ? await listTaskAttachmentsAction({ projectId, taskId })
      : subtaskId
        ? await listSubtaskAttachmentsAction({ projectId, subtaskId })
        : { error: "errorNoParent" as const };
    if (res.error) {
      setError(res.error);
    } else {
      setAttachments(res.attachments ?? []);
      setError(null);
    }
    setLoaded(true);
  }, [projectId, taskId, subtaskId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- on-mount fetch of the attachment list
    void load();
  }, [load]);

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, ATTACHMENT_MAX_BATCH);
    const tooMany = files.length > ATTACHMENT_MAX_BATCH;
    setError(null);
    startBusy(async () => {
      if (tooMany) setError("errorTooManyFiles");
      for (const file of selected) {
        const res = await uploadAttachment({ projectId, taskId, subtaskId, file });
        if (!res.ok) {
          setError(res.errorKey);
          break;
        }
      }
      await load();
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const onOpen = (id: string) => {
    setError(null);
    startBusy(async () => {
      const res = await getAttachmentSignedUrlAction({ attachmentId: id });
      if (res.error || !res.url) {
        setError(res.error ?? "sign_failed");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const onRemove = (id: string) => {
    if (!window.confirm(t("removeConfirm"))) return;
    setError(null);
    startBusy(async () => {
      const res = await removeAttachmentAction({ attachmentId: id });
      if (res.error) {
        setError(res.error);
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    });
  };

  return (
    <section data-testid="entity-attachments" className="mt-4" aria-label={t("title")}>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> {t("title")}
          {loaded && attachments.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              {attachments.length}
            </span>
          )}
        </h4>
        {canUpload && (
          <button
            type="button"
            data-testid="attachment-upload-button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-3 w-3" aria-hidden />
            )}
            {t("add")}
          </button>
        )}
      </div>

      {canUpload && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          data-testid="attachment-file-input"
          className="sr-only"
          aria-label={t("upload")}
          onChange={(e) => onFilesSelected(e.target.files)}
        />
      )}

      {error && (
        <p
          role="alert"
          data-testid="attachment-error"
          className="mb-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-600"
        >
          {errorText(error)}
        </p>
      )}

      <AttachmentListView
        attachments={attachments}
        loaded={loaded}
        hasError={!!error}
        readonly={readonly}
        busy={busy}
        onOpen={onOpen}
        onRemove={onRemove}
      />
    </section>
  );
}
