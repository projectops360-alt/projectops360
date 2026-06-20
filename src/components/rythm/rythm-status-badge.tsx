"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { RythmMeetingStatus } from "@/lib/rythm/types";

const STATUS_CLASS: Record<RythmMeetingStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  recording: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  audio_uploaded: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ready_for_transcription: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  transcribing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  transcribed: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  summary_ready: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function RythmStatusBadge({
  status,
  className,
}: {
  status: RythmMeetingStatus;
  className?: string;
}) {
  const t = useTranslations("rythm.status");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
