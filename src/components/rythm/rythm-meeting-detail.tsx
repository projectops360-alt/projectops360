"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AudioLines,
  FileText,
  Sparkles,
  Info,
  Play,
  Loader2,
  Clock,
  Users,
  Calendar,
  Link2,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RythmRecorder } from "./rythm-recorder";
import { RythmAudioUploader } from "./rythm-audio-uploader";
import { RythmStatusBadge } from "./rythm-status-badge";
import { getRythmAudioUrlAction } from "@/app/[locale]/(app)/projects/[projectId]/rythm/actions";
import type { RythmMeeting, RythmAudioFile } from "@/lib/rythm/types";

type TabKey = "overview" | "audio" | "transcript" | "summary";

interface RythmMeetingDetailProps {
  projectId: string;
  locale: string;
  meeting: RythmMeeting;
  audioFiles: RythmAudioFile[];
  initialTab?: TabKey;
}

const TABS: { key: TabKey; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", icon: Info },
  { key: "audio", icon: AudioLines },
  { key: "transcript", icon: FileText },
  { key: "summary", icon: Sparkles },
];

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

export function RythmMeetingDetail({
  projectId,
  locale,
  meeting,
  audioFiles,
  initialTab = "audio",
}: RythmMeetingDetailProps) {
  const t = useTranslations("rythm.detail");
  const tType = useTranslations("rythm.form");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);

  function reload() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}/rythm`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{meeting.title}</h1>
          <RythmStatusBadge status={meeting.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{tType(`type_${meeting.meetingType}`)}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(`tab_${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label={t("field_type")} value={tType(`type_${meeting.meetingType}`)} />
            <Field
              label={t("field_date")}
              value={meeting.meetingDate ? new Date(meeting.meetingDate).toLocaleString(locale) : "—"}
              icon={Calendar}
            />
            {meeting.meetingPlatform && (
              <Field label={t("field_platform")} value={meeting.meetingPlatform} />
            )}
            {meeting.meetingUrl && (
              <Field
                label={t("field_url")}
                value={
                  <a
                    href={meeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {t("openLink")}
                  </a>
                }
              />
            )}
            <Field
              label={t("field_participants")}
              icon={Users}
              value={
                meeting.participants.length > 0
                  ? meeting.participants.map((p) => p.name).join(", ")
                  : "—"
              }
            />
            <Field
              label={t("field_created")}
              value={new Date(meeting.createdAt).toLocaleString(locale)}
            />
          </dl>
        </div>
      )}

      {/* Audio */}
      {tab === "audio" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <RythmRecorder projectId={projectId} meetingId={meeting.id} onSaved={reload} />
            <RythmAudioUploader projectId={projectId} meetingId={meeting.id} onUploaded={reload} />
          </div>

          {/* Audio records */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">{t("audioRecords")}</h3>
            </div>
            {audioFiles.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                {t("noAudio")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {audioFiles.map((a) => (
                  <AudioRow key={a.id} audio={a} locale={locale} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Transcript placeholder */}
      {tab === "transcript" && (
        <Placeholder
          icon={FileText}
          title={t("transcriptSoonTitle")}
          body={t("transcriptSoonBody")}
        />
      )}

      {/* Summary placeholder */}
      {tab === "summary" && (
        <Placeholder icon={Sparkles} title={t("summarySoonTitle")} body={t("summarySoonBody")} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </dd>
    </div>
  );
}

function AudioRow({ audio, locale }: { audio: RythmAudioFile; locale: string }) {
  const t = useTranslations("rythm.detail");
  const tErr = useTranslations("rythm.errors");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30">
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
        {!url && (
          <button
            type="button"
            onClick={loadUrl}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {t("play")}
          </button>
        )}
      </div>
      {url && <audio controls src={url} className="mt-3 w-full" autoPlay />}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function Placeholder({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
