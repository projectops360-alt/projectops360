"use client";

// ============================================================================
// Isabella — Voice (browser SpeechSynthesis, zero backend, zero data egress)
// ============================================================================
// Minimal, safe text-to-speech:
//   • OFF by default; never autoplays unless the user enables it (persisted).
//   • Uses the browser's built-in SpeechSynthesis — no audio is sent anywhere.
//   • Reads in the conversation language, picking an es-/en- voice when present.
//   • Stop/mute is always available; nothing blocks rendering.
//   • Markdown (links/bold) is stripped before speaking.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/types/database";

const STORAGE_KEY = "isabella.voice.enabled";

/** Strip the small markdown subset we render so it isn't read aloud literally. */
export function plainForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](href) → label
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → bold
    .replace(/\s+/g, " ")
    .trim();
}

export interface SpeechApi {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  toggleEnabled: () => void;
  speak: (text: string, lang: Locale) => void;
  stop: () => void;
}

export function useSpeech(): SpeechApi {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const [enabled, setEnabled] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Subscribe to voice-list changes only (no synchronous setState in the effect).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const pickVoice = useCallback((lang: Locale): SpeechSynthesisVoice | null => {
    const want = lang === "es" ? "es" : "en";
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    // Prefer an exact-ish locale, then any voice in the language family.
    return (
      voices.find((v) => v.lang?.toLowerCase().startsWith(`${want}-`)) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(want)) ||
      null
    );
  }, []);

  const speak = useCallback(
    (text: string, lang: Locale) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const clean = plainForSpeech(text);
      if (!clean) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang === "es" ? "es-ES" : "en-US";
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [pickVoice],
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      return next;
    });
  }, []);

  return { supported, enabled, speaking, toggleEnabled, speak, stop };
}
