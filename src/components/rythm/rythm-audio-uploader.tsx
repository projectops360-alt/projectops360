"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, Loader2, FileAudio } from "lucide-react";
import { uploadRythmAudio, validateAudioFile } from "@/lib/rythm/storage-service";
import { RYTHM_ACCEPTED_EXTENSIONS } from "@/lib/rythm/types";

interface RythmAudioUploaderProps {
  projectId: string;
  meetingId: string;
  onUploaded: () => void;
}

const ACCEPT = RYTHM_ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function RythmAudioUploader({ projectId, meetingId, onUploaded }: RythmAudioUploaderProps) {
  const t = useTranslations("rythm.uploader");
  const tErr = useTranslations("rythm.errors");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);

    const validation = validateAudioFile(file);
    if (!validation.ok) {
      setError(tErr.has(validation.errorKey) ? tErr(validation.errorKey) : tErr("uploadFailed"));
      return;
    }

    setUploading(true);
    const result = await uploadRythmAudio(projectId, meetingId, file);
    setUploading(false);

    if (!result.ok) {
      setError(tErr.has(result.errorKey) ? tErr(result.errorKey) : tErr("uploadFailed"));
      return;
    }
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
    onUploaded();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Upload className="h-4 w-4 text-brand-600" />
        {t("title")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center transition-colors hover:border-brand-500/60 hover:bg-muted/40 disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-sm text-muted-foreground">{t("uploading")}</span>
          </>
        ) : (
          <>
            <FileAudio className="h-6 w-6 text-brand-600" />
            <span className="text-sm font-medium text-foreground">{t("choose")}</span>
            <span className="text-xs text-muted-foreground">{t("formats")}</span>
          </>
        )}
        {fileName && !uploading && (
          <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">{fileName}</span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
