"use client";

// ============================================================================
// Isabella Voice — live conversation control (client)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// Self-contained, flag-gated control rendered inside the Isabella panel. It
// does NOT alter the panel's existing behavior (UX-001 hero lifecycle, text
// conversation, browser speech): it only adds a live-voice session on top.
// Bilingual inline (EN/ES) following the panel's established tt() pattern.
// ============================================================================

import { useMemo } from "react";
import { Mic, PhoneOff, Radio } from "lucide-react";
import type { Locale } from "@/types/database";
import type { VoiceClientContext } from "@/lib/isabella/voice/types";
import { useRealtimeVoice, type VoiceActivity } from "./useRealtimeVoice";

export function IsabellaVoiceLive({
  locale,
  context,
}: {
  locale: Locale;
  context: VoiceClientContext;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const voice = useRealtimeVoice({ locale, context });

  const activityLabel: Record<VoiceActivity, string> = useMemo(
    () => ({
      none: tt("In conversation", "En conversación"),
      listening: tt("Listening…", "Escuchándote…"),
      speaking: tt("Isabella is speaking", "Isabella está hablando"),
      consulting: tt("Checking your project data…", "Consultando tus datos del proyecto…"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEs],
  );

  const errorLabel = (code: string | null): string => {
    if (code === "not_configured")
      return tt("Live voice is not configured on this server.", "La voz en vivo no está configurada en este servidor.");
    return tt(
      "I couldn't start the live conversation. Check your microphone permission and try again.",
      "No pude iniciar la conversación en vivo. Revisa el permiso del micrófono e inténtalo de nuevo.",
    );
  };

  if (voice.status === "idle" || voice.status === "error") {
    return (
      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={() => void voice.start()}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-500/20 dark:text-brand-300"
          title={tt(
            "Start a live voice conversation with Isabella",
            "Inicia una conversación de voz en vivo con Isabella",
          )}
        >
          <Radio className="h-3.5 w-3.5" />
          {tt("Live voice conversation", "Conversación de voz en vivo")}
        </button>
        {voice.status === "error" && (
          <p className="mt-1 text-[11px] text-muted-foreground">{errorLabel(voice.errorNote)}</p>
        )}
      </div>
    );
  }

  const lastUser = [...voice.transcript].reverse().find((t) => t.role === "user");
  const lastIsabella = [...voice.transcript].reverse().find((t) => t.role === "assistant");

  return (
    <div className="mx-3 mt-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
          {voice.status === "connecting" ? (
            <>
              <Mic className="h-3.5 w-3.5 animate-pulse" />
              {tt("Connecting…", "Conectando…")}
            </>
          ) : (
            <>
              <span
                className={`h-2 w-2 rounded-full ${
                  voice.activity === "listening"
                    ? "animate-pulse bg-red-500"
                    : voice.activity === "speaking"
                    ? "animate-pulse bg-brand-500"
                    : "bg-brand-500/70"
                }`}
                aria-hidden
              />
              {activityLabel[voice.activity]}
            </>
          )}
        </span>
        <button
          type="button"
          onClick={voice.stop}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition hover:border-red-500/60 hover:text-red-500"
          title={tt("End the live conversation", "Terminar la conversación en vivo")}
        >
          <PhoneOff className="h-3 w-3" />
          {tt("End", "Terminar")}
        </button>
      </div>
      {(lastUser || lastIsabella) && (
        <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {lastUser && (
            <p className="truncate">
              <span className="font-medium text-foreground">{tt("You:", "Tú:")}</span> {lastUser.text}
            </p>
          )}
          {lastIsabella && (
            <p className="line-clamp-2">
              <span className="font-medium text-foreground">Isabella:</span> {lastIsabella.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
