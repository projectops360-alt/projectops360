"use client";

// ============================================================================
// ProjectOps360° — Living Graph timeline playback control
// ============================================================================
// Controlled component: the playhead index lives in the parent view so it can
// drive node/edge visual state. This component renders transport controls and
// advances the playhead while playing.
// ============================================================================

import { memo, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import type { LivingGraphEvent } from "@/types/living-graph";

const SPEEDS = [0.5, 1, 2, 4] as const;

export interface LivingGraphTimelineProps {
  events: LivingGraphEvent[];
  /** -1 = before the first event. */
  currentIndex: number;
  playing: boolean;
  speed: number;
  onIndexChange: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void;
}

function LivingGraphTimelineComponent({
  events,
  currentIndex,
  playing,
  speed,
  onIndexChange,
  onPlayingChange,
  onSpeedChange,
}: LivingGraphTimelineProps) {
  const t = useTranslations("livingGraph");
  const locale = useLocale();

  // Advance the playhead while playing
  useEffect(() => {
    if (!playing || events.length === 0) return;
    const interval = setInterval(() => {
      if (currentIndex >= events.length - 1) {
        onPlayingChange(false);
      } else {
        onIndexChange(currentIndex + 1);
      }
    }, 1200 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, currentIndex, events.length, onIndexChange, onPlayingChange]);

  const currentEvent = currentIndex >= 0 ? events[currentIndex] : null;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  if (events.length === 0) {
    return (
      <div
        role="status"
        className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
      >
        {t("timeline.noEvents")}
      </div>
    );
  }

  const buttonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      <button
        type="button"
        onClick={() => {
          onPlayingChange(false);
          onIndexChange(-1);
        }}
        title={t("timeline.reset")}
        aria-label={t("timeline.reset")}
        className={buttonClass}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onIndexChange(Math.max(-1, currentIndex - 1))}
        disabled={currentIndex < 0}
        title={t("timeline.stepBack")}
        aria-label={t("timeline.stepBack")}
        className={buttonClass}
      >
        <SkipBack className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onPlayingChange(!playing)}
        title={playing ? t("timeline.pause") : t("timeline.play")}
        aria-label={playing ? t("timeline.pause") : t("timeline.play")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700"
      >
        {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => onIndexChange(Math.min(events.length - 1, currentIndex + 1))}
        disabled={currentIndex >= events.length - 1}
        title={t("timeline.stepForward")}
        aria-label={t("timeline.stepForward")}
        className={buttonClass}
      >
        <SkipForward className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* Speed */}
      <select
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        aria-label={t("timeline.speed")}
        className="h-8 rounded-md border border-border bg-card px-1.5 text-xs text-foreground"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>

      {/* Scrubber */}
      <input
        type="range"
        min={-1}
        max={events.length - 1}
        value={currentIndex}
        onChange={(e) => onIndexChange(Number(e.target.value))}
        aria-label={t("timeline.scrub")}
        className="min-w-[120px] flex-1 accent-brand-600"
      />

      {/* Position + current event */}
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-medium text-foreground">
          {currentIndex + 1} / {events.length}
        </p>
        {currentEvent ? (
          <p className="max-w-[260px] truncate text-[10px] text-muted-foreground" title={currentEvent.label}>
            {dateFormatter.format(new Date(currentEvent.occurredAt))} — {currentEvent.label}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t("timeline.start")}</p>
        )}
      </div>
    </div>
  );
}

export const LivingGraphTimeline = memo(LivingGraphTimelineComponent);
LivingGraphTimeline.displayName = "LivingGraphTimeline";
