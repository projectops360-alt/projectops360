"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AudioLines, FileText, Sparkles, Play, Loader2, Clock, Trash2 } from "lucide-react";
import { RythmRecorder } from "./rythm-recorder";
import { RythmAudioUploader } from "./rythm-audio-uploader";
import {
  listRythmAudioAction,
  getRythmAudioUrlAction,
  deleteRythmAudioAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/audio-actions";
import type { RythmAudioFile } from "@/lib/rythm/types";

interface RythmAudioPanelProps {
  projectId: string;
  meetingId: string;
  locale: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RythmAudioPanel({ projectId, meetingId, locale }: RythmAudioPanelProps) {
  const t = useTranslations("rythm.detail");
  const [audioFiles, setAudioFiles] = useState<RythmAudioFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await listRythmAudioAction({ meetingId });
    setAudioFiles(result.audioFiles ?? []);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    // Fetch-on-mount: setState happens after an await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Capture controls */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RythmRecorder projectId={projectId} meetingId={meetingId} onSaved={load} />
        <RythmAudioUploader projectId={projectId} meetingId={meetingId} onUploaded={load} />
      </div>

      {/* Audio records */}
      <div className="rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 py-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("audioRecords")}
          </h4>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </p>
        ) : audioFiles.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("noAudio")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {audioFiles.map((a) => (
              <AudioRow key={a.id} audio={a} locale={locale} onDeleted={load} />
            ))}
          </ul>
        )}
      </div>

      {/* Transcript / Summary placeholders (engine wired in a later phase) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SoonCard icon={FileText} title={t("transcriptSoonTitle")} body={t("transcriptSoonBody")} />
        <SoonCard icon={Sparkles} title={t("summarySoonTitle")} body={t("summarySoonBody")} />
      </div>
    </div>
  );
}

function AudioRow({
  audio,
  locale,
  onDeleted,
}: {
  audio: RythmAudioFile;
  locale: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("rythm.detail");
  const tErr = useTranslations("rythm.errors");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUrl() {
    setLoading(true);
    setError(null);
    const result = await getRythmAudioUrlAction({ audioFileId: audio.id });
    setLoading(false);
    if (result.error || !result.url) {
      setError(tErr.has(result.error ?? "") ? tErr(result.error as string) : tErr("playFailed"));
      return;
    }
    setUrl(result.url);
  }

  async function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    setError(null);
    const result = await deleteRythmAudioAction({ audioFileId: audio.id });
    if (result.error) {
      setDeleting(false);
      setError(tErr.has(result.error) ? tErr(result.error) : tErr("deleteFailed"));
      return;
    }
    onDeleted();
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30">
          <AudioLines className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{audio.fileName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{t(`source_${audio.source}`)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(audio.durationSeconds)}
            </span>
            <span>{formatBytes(audio.fileSize)}</span>
            <span>{new Date(audio.createdAt).toLocaleString(locale)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!url && (
            <button
              type="button"
              onClick={loadUrl}
              disabled={loading || deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {t("play")}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            title={t("delete")}
            aria-label={t("delete")}
            className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-900/20"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      {url && <audio controls src={url} className="mt-2.5 w-full" />}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function SoonCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
