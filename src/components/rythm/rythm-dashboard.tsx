"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Mic, Upload, Plus, AudioLines, Users, Calendar } from "lucide-react";
import { RythmMeetingForm } from "./rythm-meeting-form";
import { RythmStatusBadge } from "./rythm-status-badge";
import type { RythmMeeting, RythmMeetingType } from "@/lib/rythm/types";

interface RythmDashboardProps {
  projectId: string;
  locale: string;
  meetings: RythmMeeting[];
}

const TYPE_ICON: Record<RythmMeetingType, React.ComponentType<{ className?: string }>> = {
  in_person: Users,
  video_call: AudioLines,
  uploaded_audio: Upload,
};

export function RythmDashboard({ projectId, locale, meetings }: RythmDashboardProps) {
  const t = useTranslations("rythm.dashboard");
  const tType = useTranslations("rythm.form");
  const router = useRouter();

  // null = closed; otherwise the default meeting type for the form
  const [formType, setFormType] = useState<RythmMeetingType | null>(null);

  function handleCreated(meetingId: string) {
    setFormType(null);
    router.push(`/projects/${projectId}/rythm/${meetingId}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Mic className="h-5 w-5 text-brand-600" />
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setFormType("in_person")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            {t("newMeeting")}
          </button>
          <button
            type="button"
            onClick={() => setFormType("uploaded_audio")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            {t("uploadAudio")}
          </button>
        </div>
      </div>

      {/* List / empty state */}
      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/30">
            <AudioLines className="h-6 w-6 text-brand-600" />
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty")}</p>
          <button
            type="button"
            onClick={() => setFormType("in_person")}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            {t("newMeeting")}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {meetings.map((m) => {
              const Icon = TYPE_ICON[m.meetingType];
              return (
                <li key={m.id}>
                  <Link
                    href={`/projects/${projectId}/rythm/${m.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{tType(`type_${m.meetingType}`)}</span>
                        {m.meetingDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(m.meetingDate).toLocaleString(locale)}
                          </span>
                        )}
                        {m.participants.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {m.participants.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <RythmStatusBadge status={m.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {formType && (
        <RythmMeetingForm
          projectId={projectId}
          defaultMeetingType={formType}
          onClose={() => setFormType(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
