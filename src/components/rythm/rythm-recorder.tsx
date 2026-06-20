"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Mic, Pause, Play, Square, Save, Trash2, Loader2, AlertCircle } from "lucide-react";
import {
  RythmRecorder as Recorder,
  isRecordingSupported,
  listAudioInputDevices,
  type AudioInputDevice,
} from "@/lib/rythm/recording-service";
import { saveBrowserRecording } from "@/lib/rythm/storage-service";

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
  const rafRef = useRef<number | null>(null);
  const lowTicksRef = useRef(0);

  const [uiState, setUiState] = useState<UiState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [lowSignal, setLowSignal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>("audio/webm");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  // Capability detection without a setState-in-effect: server renders optimistic
  // (true); the client snapshot resolves after hydration with no mismatch.
  const supported = useSyncExternalStore(
    () => () => {},
    () => isRecordingSupported(),
    () => true,
  );

  const loadDevices = useCallback(async (unlock: boolean) => {
    try {
      setDevices(await listAudioInputDevices(unlock));
    } catch {
      /* enumeration is best-effort */
    }
  }, []);

  useEffect(() => {
    // Enumerate inputs on mount (labels may be blank until permission granted).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDevices(false);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      recorderRef.current?.dispose();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDevices]);

  function startTimer() {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Live mic-level meter: polls the recorder's RMS level each frame so the user
  // can SEE whether sound is reaching the microphone (catches a muted/wrong device).
  function startMeter() {
    lowTicksRef.current = 0;
    setLowSignal(false);
    const tick = () => {
      const lvl = recorderRef.current?.getLevel() ?? 0;
      setLevel(lvl);
      if (lvl < 0.02) {
        lowTicksRef.current += 1;
        if (lowTicksRef.current > 180) setLowSignal(true); // ~3s of silence
      } else {
        lowTicksRef.current = 0;
        setLowSignal(false);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }
  function stopMeter() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setLevel(0);
  }

  async function handleStart() {
    setError(null);
    try {
      const recorder = new Recorder();
      await recorder.start(deviceId || undefined);
      recorderRef.current = recorder;
      setSeconds(0);
      setUiState("recording");
      startTimer();
      startMeter();
      // Permission is now granted → re-list devices with real labels.
      void loadDevices(false);
    } catch (err) {
      console.error(err);
      setError(tErr("micPermission"));
      setUiState("idle");
    }
  }

  function handlePause() {
    recorderRef.current?.pause();
    stopTimer();
    stopMeter();
    setUiState("paused");
  }

  function handleResume() {
    recorderRef.current?.resume();
    startTimer();
    startMeter();
    setUiState("recording");
  }

  async function handleStop() {
    stopTimer();
    stopMeter();
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

      {/* Live mic-level meter */}
      {isActive && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-[width] duration-75 ${
                  lowSignal ? "bg-amber-400" : "bg-brand-500"
                }`}
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          </div>
          {lowSignal && uiState === "recording" && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("noSignal")}
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      {uiState === "preview" && previewUrl && (
        <audio controls src={previewUrl} className="mt-4 w-full" />
      )}

      {/* Microphone picker (idle only) — lets the user switch away from a
          silent/wrong default input device. */}
      {uiState === "idle" && devices.length > 0 && (
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("micLabel")}
          </label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">{t("micDefault")}</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
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
