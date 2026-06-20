"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Mic, Pause, Play, Square, Save, Trash2, Loader2, AlertCircle } from "lucide-react";
import { RythmRecorder as Recorder, isRecordingSupported } from "@/lib/rythm/recording-service";
import { saveBrowserRecording } from "@/lib/rythm/storage-service";
import {
  updateRythmMeetingStatusAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rythm/actions";

interface RythmRecorderProps {
  projectId: string;
  meetingId: string;
  onSaved: () => void;
}

type UiState = "idle" | "recording" | "paused" | "preview" | "saving";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function RythmRecorder({ projectId, meetingId, onSaved }: RythmRecorderProps) {
  const t = useTranslations("rythm.recorder");
  const tErr = useTranslations("rythm.errors");

  const recorderRef = useRef<Recorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [uiState, setUiState] = useState<UiState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>("audio/webm");
  const [error, setError] = useState<string | null>(null);

  // Capability detection without a setState-in-effect: server renders optimistic
  // (true); the client snapshot resolves after hydration with no mismatch.
  const supported = useSyncExternalStore(
    () => () => {},
    () => isRecordingSupported(),
    () => true,
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.dispose();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTimer() {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleStart() {
    setError(null);
    try {
      const recorder = new Recorder();
      await recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setUiState("recording");
      startTimer();
      // Status logic: recording starts → meeting status = recording.
      void updateRythmMeetingStatusAction({ projectId, meetingId, status: "recording" });
    } catch (err) {
      console.error(err);
      setError(tErr("micPermission"));
      setUiState("idle");
    }
  }

  function handlePause() {
    recorderRef.current?.pause();
    stopTimer();
    setUiState("paused");
  }

  function handleResume() {
    recorderRef.current?.resume();
    startTimer();
    setUiState("recording");
  }

  async function handleStop() {
    stopTimer();
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      const { blob, mimeType } = await recorder.stop();
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedMime(mimeType);
      setPreviewUrl(url);
      setUiState("preview");
    } catch (err) {
      console.error(err);
      setError(tErr("recordingFailed"));
      setUiState("idle");
    }
  }

  function handleDiscard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setSeconds(0);
    setUiState("idle");
    recorderRef.current?.dispose();
    recorderRef.current = null;
  }

  async function handleSave() {
    if (!recordedBlob) return;
    setUiState("saving");
    setError(null);

    const result = await saveBrowserRecording(projectId, meetingId, recordedBlob, {
      durationSeconds: seconds,
      mimeType: recordedMime,
    });

    if (!result.ok) {
      setError(tErr.has(result.errorKey) ? tErr(result.errorKey) : tErr("uploadFailed"));
      setUiState("preview");
      return;
    }

    handleDiscard();
    onSaved();
  }

  if (!supported) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {t("unsupported")}
      </div>
    );
  }

  const isActive = uiState === "recording" || uiState === "paused";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mic className="h-4 w-4 text-brand-600" />
          {t("title")}
        </h3>
        {(isActive || uiState === "preview") && (
          <span className="font-mono text-sm tabular-nums text-foreground">
            {formatTime(seconds)}
          </span>
        )}
      </div>

      {/* Recording indicator */}
      {uiState === "recording" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          {t("recording")}
        </div>
      )}
      {uiState === "paused" && (
        <div className="mt-3 text-sm text-amber-600">{t("paused")}</div>
      )}

      {/* Preview */}
      {uiState === "preview" && previewUrl && (
        <audio controls src={previewUrl} className="mt-4 w-full" />
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        {uiState === "idle" && (
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Mic className="h-4 w-4" />
            {t("start")}
          </button>
        )}

        {uiState === "recording" && (
          <>
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Pause className="h-4 w-4" />
              {t("pause")}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Square className="h-4 w-4" />
              {t("stop")}
            </button>
          </>
        )}

        {uiState === "paused" && (
          <>
            <button
              type="button"
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Play className="h-4 w-4" />
              {t("resume")}
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Square className="h-4 w-4" />
              {t("stop")}
            </button>
          </>
        )}

        {(uiState === "preview" || uiState === "saving") && (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={uiState === "saving"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {uiState === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("save")}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={uiState === "saving"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {t("discard")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
