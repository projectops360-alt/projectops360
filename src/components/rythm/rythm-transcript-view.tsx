"use client";

import { useTranslations } from "next-intl";
import { FileText, Loader2, AlertCircle, Languages, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RythmTranscript } from "@/lib/rythm/types";

const SPEAKER_COLORS = [
  "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
];

function speakerColor(speaker: string): string {
  const code = (speaker.charCodeAt(0) || 65) - 65;
  return SPEAKER_COLORS[((code % SPEAKER_COLORS.length) + SPEAKER_COLORS.length) % SPEAKER_COLORS.length];
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function RythmTranscriptView({
  transcript,
  locale,
}: {
  transcript: RythmTranscript;
  locale: string;
}) {
  const t = useTranslations("rythm.transcript");
  const tStatus = useTranslations("rythm.transcriptStatus");

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <FileText className="h-3.5 w-3.5 text-brand-600" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h4>
      </div>

      {/* Summary header */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:grid-cols-5">
        <HeaderItem icon={Languages} label={t("language")} value={transcript.languageCode ?? "—"} />
        <HeaderItem icon={Clock} label={t("duration")} value={formatDuration(transcript.durationSeconds)} />
        <HeaderItem icon={Users} label={t("speakers")} value={String(transcript.speakerCount || "—")} />
        <HeaderItem label={t("status")} value={tStatus(transcript.status)} />
        <HeaderItem
          label={t("created")}
          value={new Date(transcript.createdAt).toLocaleString(locale)}
        />
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {transcript.status === "processing" || transcript.status === "pending" ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("processing")}
          </p>
        ) : transcript.status === "failed" ? (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {transcript.errorMessage || t("failed")}
          </p>
        ) : transcript.utterances.length > 0 ? (
          <div className="space-y-3">
            {transcript.utterances.map((u, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className={cn(
                    "h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    speakerColor(u.speaker),
                  )}
                >
                  {t("speaker")} {u.speaker}
                </span>
                <p className="text-sm leading-relaxed text-foreground">{u.text}</p>
              </div>
            ))}
          </div>
        ) : transcript.transcriptText ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {transcript.transcriptText}
          </p>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}

function HeaderItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}
