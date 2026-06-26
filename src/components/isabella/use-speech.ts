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

  const voicesFor = useCallback((lang: Locale): SpeechSynthesisVoice[] => {
    const want = lang === "es" ? "es" : "en";
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    return voices.filter((v) => v.lang?.toLowerCase().startsWith(want));
  }, []);

  // Always prefer a FEMALE voice in the language; prefer LatAm Spanish / US
  // English exact locales; never fall back to a known-male voice when avoidable.
  const pickVoice = useCallback(
    (lang: Locale): SpeechSynthesisVoice | null => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
      const inLang = voicesFor(lang);
      if (inLang.length === 0) return null;
      const female = inLang.filter(isFemaleVoice);
      const preferLocale = lang === "es" ? ["es-mx", "es-us", "es-419", "es-co", "es-ar", "es-es"] : ["en-us", "en-ca", "en-gb"];
      const byLocale = (list: SpeechSynthesisVoice[]) => {
        for (const loc of preferLocale) {
          const hit = list.find((v) => v.lang?.toLowerCase() === loc);
          if (hit) return hit;
        }
        return list[0];
      };
      if (female.length) return byLocale(female);
      // No female voice → avoid known-male voices if any neutral ones exist.
      const notMale = inLang.filter((v) => !MALE_NAMES.some((m) => v.name.toLowerCase().includes(m)));
      return byLocale(notMale.length ? notMale : inLang);
    },
    [voicesFor],
  );

  const hasFemaleVoice = useCallback(
    (lang: Locale): boolean => voicesFor(lang).some(isFemaleVoice),
    [voicesFor],
  );

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

  return { supported, enabled, speaking, hasFemaleVoice, toggleEnabled, speak, stop };
}
