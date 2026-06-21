"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AudioLines,
  Play,
  Loader2,
  Clock,
  Trash2,
  Ban,
  CheckCircle2,
  RefreshCw,
  ClipboardList,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RythmRecorder } from "./rythm-recorder";
import { RythmAudioUploader } from "./rythm-audio-uploader";
import { RythmTranscriptView } from "./rythm-transcript-view";
import { RythmSpeakerIdentification } from "./rythm-speaker-identification";
import { RythmIntelligencePanel } from "./rythm-intelligence";
import {
  listRythmAudioAction,
  getRythmAudioUrlAction,
  deleteRythmAudioAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/audio-actions";
import {
  prepareAudioForTranscriptionAction,
  cancelProcessingJobAction,
  listProcessingJobsAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/processing-actions";
import {
  submitTranscriptionAction,
  pollTranscriptionAction,
  getMeetingTranscriptAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/transcription-actions";
import { getSpeakerDataAction } from "@/app/[locale]/(app)/projects/[projectId]/rhythm/speaker-actions";
import { getMeetingIntelligenceAction } from "@/app/[locale]/(app)/projects/[projectId]/rhythm/intelligence-actions";
import type {
  RythmAudioFile,
  RythmAudioStatus,
  RythmProcessingJob,
  RythmJobStatus,
  RythmTranscript,
  RythmSpeakerMapping,
  RythmSpeakerOption,
  RythmIntelligence,
} from "@/lib/rythm/types";

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

// ── Badges ───────────────────────────────────────────────────────────────────

const AUDIO_STATUS_CLASS: Record<RythmAudioStatus, string> = {
  uploaded: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ready_for_transcription: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  transcribing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  transcribed: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function AudioStatusBadge({ status }: { status: RythmAudioStatus }) {
  const t = useTranslations("rythm.audioStatus");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        AUDIO_STATUS_CLASS[status],
      )}
    >
      {t(status)}
    </span>
  );
}

const JOB_STATUS_CLASS: Record<RythmJobStatus, string> = {
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function JobStatusBadge({ status }: { status: RythmJobStatus }) {
  const t = useTranslations("rythm.jobStatus");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        JOB_STATUS_CLASS[status],
      )}
    >
      {t(status)}
    </span>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function RythmAudioPanel({ projectId, meetingId, locale }: RythmAudioPanelProps) {
  const t = useTranslations("rythm.detail");
  const [audioFiles, setAudioFiles] = useState<RythmAudioFile[]>([]);
  const [jobs, setJobs] = useState<RythmProcessingJob[]>([]);
  const [transcript, setTranscript] = useState<RythmTranscript | null>(null);
  const [speakerMappings, setSpeakerMappings] = useState<RythmSpeakerMapping[]>([]);
  const [speakerOptions, setSpeakerOptions] = useState<RythmSpeakerOption[]>([]);
  const [intelligence, setIntelligence] = useState<RythmIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [audioRes, jobsRes, transRes, intelRes] = await Promise.all([
      listRythmAudioAction({ meetingId }),
      listProcessingJobsAction({ meetingId }),
      getMeetingTranscriptAction({ meetingId }),
      getMeetingIntelligenceAction({ meetingId }),
    ]);
    setAudioFiles(audioRes.audioFiles ?? []);
    setJobs(jobsRes.jobs ?? []);
    setIntelligence(intelRes.intelligence ?? null);
    const tr = transRes.transcript ?? null;
    setTranscript(tr);

    // Speaker mappings + suggestions only matter once a transcript exists.
    if (tr) {
      const sp = await getSpeakerDataAction({ projectId, meetingId, transcriptId: tr.id });
      setSpeakerMappings(sp.mappings ?? []);
      setSpeakerOptions(sp.options ?? []);
    } else {
      setSpeakerMappings([]);
      setSpeakerOptions([]);
    }
    setLoading(false);
  }, [meetingId, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // While a transcription job is active, poll AssemblyAI (server-side) every 5s.
  useEffect(() => {
    const active = jobs.find(
      (j) => j.jobType === "transcription" && (j.status === "running" || j.status === "queued"),
    );
    if (!active) return;
    const interval = setInterval(async () => {
      const r = await pollTranscriptionAction({ jobId: active.id });
      if (r.status === "completed" || r.status === "failed") await load();
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs, load]);

  return (
    <div className="space-y-4">
      {/* Capture controls */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RythmRecorder projectId={projectId} meetingId={meetingId} onSaved={load} />
        <RythmAudioUploader projectId={projectId} meetingId={meetingId} onUploaded={load} />
      </div>

      {/* Meeting Assets */}
      <div className="rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 py-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("meetingAssets")}
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
              <AssetRow key={a.id} audio={a} locale={locale} onChanged={load} />
            ))}
          </ul>
        )}
      </div>

      {/* Processing Queue */}
      <ProcessingQueue jobs={jobs} locale={locale} onChanged={load} />

      {/* Speaker Identification (above Transcript) */}
      {transcript && transcript.utterances.length > 0 && (
        <RythmSpeakerIdentification
          projectId={projectId}
          meetingId={meetingId}
          transcript={transcript}
          mappings={speakerMappings}
          options={speakerOptions}
          onSaved={load}
        />
      )}

      {/* Transcript */}
      {transcript && (
        <RythmTranscriptView transcript={transcript} mappings={speakerMappings} locale={locale} />
      )}

      {/* Meeting Intelligence */}
      <RythmIntelligencePanel
        projectId={projectId}
        meetingId={meetingId}
        locale={locale}
        transcript={transcript}
        intelligence={intelligence}
        ownerOptions={speakerOptions}
        onChanged={load}
      />
    </div>
  );
}

// ── Asset row ────────────────────────────────────────────────────────────────

function AssetRow({
  audio,
  locale,
  onChanged,
}: {
  audio: RythmAudioFile;
  locale: string;
  onChanged: () => void;
}) {
  const t = useTranslations("rythm.detail");
  const tAct = useTranslations("rythm.actions");
  const tErr = useTranslations("rythm.errors");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "play" | "prepare" | "queue" | "retry" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const showPrepare = audio.status === "uploaded";
  const showQueue = audio.status === "uploaded" || audio.status === "ready_for_transcription";
  const showRetry = audio.status === "failed";

  function showError(key: string | undefined, fallback: string) {
    setError(key && tErr.has(key) ? tErr(key) : tErr(fallback));
  }

  async function loadUrl() {
    setBusy("play");
    setError(null);
    const result = await getRythmAudioUrlAction({ audioFileId: audio.id });
    setBusy(null);
    if (result.error || !result.url) return showError(result.error, "playFailed");
    setUrl(result.url);
  }

  async function prepare() {
    setBusy("prepare");
    setError(null);
    const r = await prepareAudioForTranscriptionAction({ audioFileId: audio.id });
    if (r.error) {
      setBusy(null);
      return showError(r.error, "prepare_failed");
    }
    onChanged();
  }

  async function queue() {
    setBusy("queue");
    setError(null);
    const r = await submitTranscriptionAction({ audioFileId: audio.id });
    if (r.error) {
      setBusy(null);
      return showError(r.error, "queue_failed");
    }
    onChanged();
  }

  async function retry() {
    setBusy("retry");
    setError(null);
    // A retry creates a NEW AssemblyAI job + transcript (history is preserved).
    const r = await submitTranscriptionAction({ audioFileId: audio.id, isRetry: true });
    if (r.error) {
      setBusy(null);
      return showError(r.error, "retry_failed");
    }
    onChanged();
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy("delete");
    setError(null);
    const r = await deleteRythmAudioAction({ audioFileId: audio.id });
    if (r.error) {
      setBusy(null);
      return showError(r.error, "deleteFailed");
    }
    onChanged();
  }

  const anyBusy = busy !== null;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30">
          <AudioLines className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{audio.fileName}</p>
            <AudioStatusBadge status={audio.status} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{t(`source_${audio.source}`)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(audio.durationSeconds)}
            </span>
            <span>{formatBytes(audio.fileSize)}</span>
            <span>{new Date(audio.createdAt).toLocaleString(locale)}</span>
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AssetButton onClick={loadUrl} busy={busy === "play"} disabled={anyBusy} icon={Play}>
              {t("play")}
            </AssetButton>
            {showPrepare && (
              <AssetButton onClick={prepare} busy={busy === "prepare"} disabled={anyBusy} icon={CheckCircle2}>
                {tAct("prepare")}
              </AssetButton>
            )}
            {showQueue && (
              <AssetButton
                onClick={queue}
                busy={busy === "queue"}
                disabled={anyBusy}
                icon={ClipboardList}
                primary
              >
                {tAct("queue")}
              </AssetButton>
            )}
            {showRetry && (
              <AssetButton
                onClick={retry}
                busy={busy === "retry"}
                disabled={anyBusy}
                icon={RefreshCw}
                primary
              >
                {tAct("retry")}
              </AssetButton>
            )}
            <AssetButton onClick={remove} busy={busy === "delete"} disabled={anyBusy} icon={Trash2} danger>
              {tAct("delete")}
            </AssetButton>
          </div>

          {url && <audio controls src={url} className="mt-2.5 w-full" />}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </li>
  );
}

function AssetButton({
  onClick,
  busy,
  disabled,
  icon: Icon,
  children,
  primary,
  danger,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
        primary
          ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
          : danger
            ? "border-border text-muted-foreground hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            : "border-border text-foreground hover:bg-muted",
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

// ── Processing Queue ─────────────────────────────────────────────────────────

function ProcessingQueue({
  jobs,
  locale,
  onChanged,
}: {
  jobs: RythmProcessingJob[];
  locale: string;
  onChanged: () => void;
}) {
  const t = useTranslations("rythm.queue");
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function cancel(jobId: string) {
    setCancelling(jobId);
    await cancelProcessingJobAction({ jobId });
    setCancelling(null);
    onChanged();
  }

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(locale) : "—");

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h4>
      </div>
      {jobs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((j) => (
            <li key={j.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{t(`jobType_${j.jobType}`)}</span>
                <JobStatusBadge status={j.status} />
                <span className="text-xs text-muted-foreground">
                  {t("provider")}: {j.provider ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("attempts")}: {j.attempts} / {j.maxAttempts}
                </span>
                {(j.status === "queued" || j.status === "running") && (
                  <button
                    type="button"
                    onClick={() => cancel(j.id)}
                    disabled={cancelling === j.id}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-red-600 disabled:opacity-60"
                  >
                    {cancelling === j.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                    {t("cancel")}
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  {t("created")}: {fmt(j.createdAt)}
                </span>
                <span>
                  {t("started")}: {fmt(j.startedAt)}
                </span>
                <span>
                  {t("completed")}: {fmt(j.completedAt)}
                </span>
              </div>
              {j.errorMessage && (
                <p className="mt-1 text-[11px] text-red-600">
                  {t("error")}: {j.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

