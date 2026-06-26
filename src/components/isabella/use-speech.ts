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

// Isabella is always female. SpeechSynthesis rarely exposes a gender flag, so we
// score voices by known female/male voice names per platform (Windows/macOS/
// Chrome/Android) and pick the best FEMALE voice in the conversation language.
const FEMALE_NAMES = [
  // Spanish (LatAm + ES)
  "mónica", "monica", "paulina", "sabina", "helena", "laura", "esperanza", "marisol",
  "lupe", "camila", "sofía", "sofia", "elena", "ximena", "dalia", "luciana", "valentina",
  // English (NA + others)
  "samantha", "victoria", "karen", "moira", "tessa", "fiona", "allison", "ava", "susan",
  "zira", "aria", "jenny", "michelle", "joanna", "salli", "kimberly", "amy", "emma",
  "google us english", "google español", "female", "mujer", "femenina", "femenino",
];
const MALE_NAMES = [
  "jorge", "diego", "carlos", "juan", "pablo", "miguel", "raul", "raúl", "enrique",
  "daniel", "alex", "fred", "david", "mark", "george", "james", "guy", "ravi", "rishi",
  "male", "hombre", "masculina", "masculino",
];

function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const n = v.name.toLowerCase();
  if (MALE_NAMES.some((m) => n.includes(m))) return false;
  return FEMALE_NAMES.some((f) => n.includes(f));
}

export interface SpeechApi {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  /** Whether a female voice exists for the language (so the UI can inform gracefully). */
  hasFemaleVoice: (lang: Locale) => boolean;
  toggleEnabled: () => void;
  /** Speaks ONLY with a female voice. Returns false (and does NOT speak) when no
   *  female voice exists — Isabella never speaks with a male voice. */
  speak: (text: string, lang: Locale) => boolean;
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

  const voicesFor = useCallback((lang: Locale): SpeechSynthesisVoice[] => {
    const want = lang === "es" ? "es" : "en";
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    return voices.filter((v) => v.lang?.toLowerCase().startsWith(want));
  }, []);

  // Isabella speaks ONLY with a FEMALE voice. Prefer LatAm Spanish / US English
  // exact locales. If no female voice exists for the language → return null and
  // the caller shows text only (NEVER a male voice).
  const pickFemaleVoice = useCallback(
    (lang: Locale): SpeechSynthesisVoice | null => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
      const female = voicesFor(lang).filter(isFemaleVoice);
      if (female.length === 0) return null;
      const preferLocale = lang === "es" ? ["es-mx", "es-us", "es-419", "es-co", "es-ar", "es-es"] : ["en-us", "en-ca", "en-gb"];
      for (const loc of preferLocale) {
        const hit = female.find((v) => v.lang?.toLowerCase() === loc);
        if (hit) return hit;
      }
      return female[0];
    },
    [voicesFor],
  );

  const hasFemaleVoice = useCallback(
    (lang: Locale): boolean => voicesFor(lang).some(isFemaleVoice),
    [voicesFor],
  );

  const speak = useCallback(
    (text: string, lang: Locale): boolean => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
      const clean = plainForSpeech(text);
      if (!clean) return false;
      // Female-only: if there is no female voice for this language, do NOT speak
      // (Isabella never uses a male voice) — the UI shows text only + a notice.
      const v = pickFemaleVoice(lang);
      if (!v) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang === "es" ? "es-ES" : "en-US";
      u.voice = v;
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      return true;
    },
    [pickFemaleVoice],
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

  return { supported, enabled, speaking, hasFemaleVoice, toggleEnabled, speak, stop };
}
