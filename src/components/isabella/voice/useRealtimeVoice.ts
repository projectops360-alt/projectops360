"use client";

// ============================================================================
// Isabella Voice — realtime WebRTC hook (client)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// Live, interruptible voice with OpenAI Realtime over WebRTC:
//   1. POST /api/isabella/voice/session → ephemeral client secret (the
//      permanent API key never reaches the browser).
//   2. WebRTC peer connection: mic track up, Isabella's audio track down,
//      "oai-events" data channel for events. Semantic VAD server-side gives
//      natural turn-taking and barge-in (the user can interrupt Isabella).
//   3. The ONLY tool the speech model has is ask_isabella. When it calls it,
//      this hook forwards the question to the Isabella Voice Context Bridge
//      (/api/isabella/voice/bridge) and returns the result as the tool output.
//      The speech model NEVER queries data directly and NEVER writes.
// Everything is torn down on stop/unmount — mic released, audio stopped.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/types/database";
import type {
  VoiceBridgeResult,
  VoiceClientContext,
  VoiceConversationTurn,
  VoiceSessionResponse,
} from "@/lib/isabella/voice/types";

export type VoiceSessionStatus = "idle" | "connecting" | "live" | "error";
export type VoiceActivity = "none" | "listening" | "speaking" | "consulting";

const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const MAX_TRANSCRIPT_ITEMS = 40;

interface RealtimeEvent {
  type?: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
}

export interface RealtimeVoiceApi {
  status: VoiceSessionStatus;
  activity: VoiceActivity;
  transcript: VoiceConversationTurn[];
  errorNote: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useRealtimeVoice({
  locale,
  context,
}: {
  locale: Locale;
  context: VoiceClientContext;
}): RealtimeVoiceApi {
  const [status, setStatus] = useState<VoiceSessionStatus>("idle");
  const [activity, setActivity] = useState<VoiceActivity>("none");
  const [transcript, setTranscript] = useState<VoiceConversationTurn[]>([]);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Latest context for bridge calls without re-creating the session.
  const contextRef = useRef(context);
  contextRef.current = context;
  const transcriptRef = useRef<VoiceConversationTurn[]>([]);

  const pushTranscript = useCallback((turn: VoiceConversationTurn) => {
    if (!turn.text.trim()) return;
    transcriptRef.current = [...transcriptRef.current, turn].slice(-MAX_TRANSCRIPT_ITEMS);
    setTranscript(transcriptRef.current);
  }, []);

  const stop = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {
      /* noop */
    }
    try {
      pcRef.current?.close();
    } catch {
      /* noop */
    }
    micRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
    }
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    audioRef.current = null;
    setStatus("idle");
    setActivity("none");
  }, []);

  // ask_isabella → Isabella Voice Context Bridge → tool output back to the model.
  const handleAskIsabella = useCallback(
    async (callId: string, rawArgs: string) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      setActivity("consulting");

      let output: VoiceBridgeResult;
      try {
        const args = JSON.parse(rawArgs || "{}") as { question?: string; intent?: string };
        const res = await fetch("/api/isabella/voice/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: String(args.question ?? "").slice(0, 600),
            intentHint: args.intent,
            locale,
            context: contextRef.current,
            recentConversation: transcriptRef.current.slice(-6),
          }),
        });
        output = (await res.json()) as VoiceBridgeResult;
      } catch {
        output = { ok: false, error: "unavailable" };
      }

      if (dc.readyState !== "open") return;
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
      setActivity("none");
    },
    [locale],
  );

  const handleEvent = useCallback(
    (raw: string) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(raw) as RealtimeEvent;
      } catch {
        return;
      }
      switch (event.type) {
        case "conversation.item.input_audio_transcription.completed":
          pushTranscript({ role: "user", text: event.transcript ?? "" });
          break;
        // GA + legacy event names for the assistant's spoken transcript.
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done":
          pushTranscript({ role: "assistant", text: event.transcript ?? "" });
          break;
        case "response.function_call_arguments.done":
          if (event.name === "ask_isabella" && event.call_id) {
            void handleAskIsabella(event.call_id, event.arguments ?? "");
          }
          break;
        case "input_audio_buffer.speech_started":
          setActivity("listening");
          break;
        case "input_audio_buffer.speech_stopped":
          setActivity("none");
          break;
        case "output_audio_buffer.started":
          setActivity("speaking");
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setActivity("none");
          break;
        default:
          break;
      }
    },
    [handleAskIsabella, pushTranscript],
  );

  const start = useCallback(async () => {
    if (pcRef.current) return; // already live/connecting
    setErrorNote(null);
    setStatus("connecting");
    transcriptRef.current = [];
    setTranscript([]);

    try {
      // 1. Ephemeral session from OUR backend (auth + flag enforced there).
      const sessionRes = await fetch("/api/isabella/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, context: contextRef.current }),
      });
      if (!sessionRes.ok) {
        throw new Error(sessionRes.status === 503 ? "not_configured" : "session_failed");
      }
      const session = (await sessionRes.json()) as VoiceSessionResponse;

      // 2. Microphone (explicit user gesture required to get here).
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;

      // 3. WebRTC peer connection to OpenAI Realtime.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      pc.addTrack(mic.getTracks()[0], mic);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleEvent(String(e.data));
      dc.onclose = () => {
        // Session ended upstream (e.g. expiry) — release everything.
        if (pcRef.current) stop();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(`${OPENAI_CALLS_URL}?model=${encodeURIComponent(session.model)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      if (!sdpRes.ok) throw new Error("webrtc_failed");
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

      setStatus("live");
    } catch (err) {
      stop();
      setStatus("error");
      const code = err instanceof Error ? err.message : "";
      setErrorNote(code || "session_failed");
    }
  }, [locale, handleEvent, stop]);

  // Total silence + released mic on unmount.
  useEffect(() => stop, [stop]);

  return { status, activity, transcript, errorNote, start, stop };
}
