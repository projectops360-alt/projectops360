"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Loader2 } from "lucide-react";
import { createRythmMeetingAction } from "@/app/[locale]/(app)/projects/[projectId]/rythm/actions";
import type { RythmMeetingType, RythmParticipant } from "@/lib/rythm/types";

interface RythmMeetingFormProps {
  projectId: string;
  defaultMeetingType?: RythmMeetingType;
  onClose: () => void;
  onCreated: (meetingId: string) => void;
}

const MEETING_TYPES: RythmMeetingType[] = ["in_person", "video_call", "uploaded_audio"];

export function RythmMeetingForm({
  projectId,
  defaultMeetingType = "in_person",
  onClose,
  onCreated,
}: RythmMeetingFormProps) {
  const t = useTranslations("rythm.form");
  const tErr = useTranslations("rythm.errors");

  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState<RythmMeetingType>(defaultMeetingType);
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [date, setDate] = useState("");
  const [participants, setParticipants] = useState<RythmParticipant[]>([]);
  const [participantName, setParticipantName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = meetingType === "video_call";

  function addParticipant() {
    const name = participantName.trim();
    if (!name) return;
    setParticipants((prev) => [...prev, { name }]);
    setParticipantName("");
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(tErr("titleRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await createRythmMeetingAction({
      projectId,
      title: title.trim(),
      meetingType,
      meetingPlatform: isVideo ? platform.trim() || null : null,
      meetingUrl: isVideo ? url.trim() || null : null,
      meetingDate: date ? new Date(date).toISOString() : null,
      participants,
    });

    setSubmitting(false);

    if (result.error || !result.meetingId) {
      setError(tErr.has(result.error ?? "") ? tErr(result.error as string) : tErr("create_failed"));
      return;
    }
    onCreated(result.meetingId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{t("newMeetingTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("title")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>

          {/* Meeting type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("meetingType")}
            </label>
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value as RythmMeetingType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {MEETING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type_${type}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Video-call specific */}
          {isVideo && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {t("platform")}
                </label>
                <input
                  type="text"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder={t("platformPlaceholder")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t("url")}</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t("date")}</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Participants */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("participants")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addParticipant();
                  }
                }}
                placeholder={t("participantPlaceholder")}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={addParticipant}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {participants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {participants.map((p, i) => (
                  <span
                    key={`${p.name}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => removeParticipant(i)}
                      className="text-brand-500 hover:text-brand-700"
                      aria-label={t("remove")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
