"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Save, RotateCcw, Loader2 } from "lucide-react";
import {
  saveSpeakerMappingsAction,
  resetSpeakerMappingsAction,
} from "@/app/[locale]/(app)/projects/[projectId]/rhythm/speaker-actions";
import type { RythmTranscript, RythmSpeakerMapping, RythmSpeakerOption } from "@/lib/rythm/types";

interface Props {
  projectId: string;
  meetingId: string;
  transcript: RythmTranscript;
  mappings: RythmSpeakerMapping[];
  options: RythmSpeakerOption[];
  onSaved: () => void;
}

export function RythmSpeakerIdentification({
  projectId,
  meetingId,
  transcript,
  mappings,
  options,
  onSaved,
}: Props) {
  const t = useTranslations("rythm.speakers");
  const tErr = useTranslations("rythm.errors");

  // Distinct speaker labels, first-seen order.
  const speakers = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of transcript.utterances) {
      if (u.speaker && !seen.has(u.speaker)) {
        seen.add(u.speaker);
        out.push(u.speaker);
      }
    }
    return out;
  }, [transcript.utterances]);

  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const map of mappings) m[map.originalSpeakerLabel] = map.mappedParticipantName;
    return m;
  }, [mappings]);

  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState<null | "save" | "reset">(null);
  const [error, setError] = useState<string | null>(null);

  const listId = `rythm-speaker-options-${meetingId}`;

  function emailFor(name: string): string | null {
    const opt = options.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
    return opt?.email ?? null;
  }

  async function save() {
    setError(null);
    const entries = speakers
      .map((label) => ({ originalSpeakerLabel: label, name: (draft[label] ?? "").trim() }))
      .filter((e) => e.name.length > 0);

    if (entries.length === 0) {
      setError(tErr("errorEmptyName"));
      return;
    }

    // Duplicate-participant guard — require explicit confirmation.
    const names = entries.map((e) => e.name.toLowerCase());
    const hasDuplicate = names.length !== new Set(names).size;
    if (hasDuplicate && !window.confirm(t("duplicateConfirm"))) return;

    setBusy("save");
    const r = await saveSpeakerMappingsAction({
      projectId,
      meetingId,
      transcriptId: transcript.id,
      mappings: entries.map((e) => ({
        originalSpeakerLabel: e.originalSpeakerLabel,
        mappedParticipantName: e.name,
        mappedParticipantEmail: emailFor(e.name),
      })),
    });
    setBusy(null);
    if (r.error) {
      setError(tErr.has(r.error) ? tErr(r.error) : tErr("save_failed"));
      return;
    }
    onSaved();
  }

  async function reset() {
    setBusy("reset");
    setError(null);
    const r = await resetSpeakerMappingsAction({ projectId, meetingId, transcriptId: transcript.id });
    setBusy(null);
    if (r.error) {
      setError(tErr.has(r.error) ? tErr(r.error) : tErr("reset_failed"));
      return;
    }
    setDraft({});
    onSaved();
  }

  if (speakers.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Users className="h-3.5 w-3.5 text-brand-600" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h4>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>

        {speakers.map((label) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium text-foreground">
              {t("speaker")} {label}
            </span>
            <span className="text-muted-foreground">→</span>
            <input
              type="text"
              list={listId}
              value={draft[label] ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, [label]: e.target.value }))}
              placeholder={t("namePlaceholder")}
              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        ))}

        <datalist id={listId}>
          {options.map((o) => (
            <option key={`${o.source}-${o.name}`} value={o.name} />
          ))}
        </datalist>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("save")}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {t("reset")}
          </button>
        </div>
      </div>
    </div>
  );
}
