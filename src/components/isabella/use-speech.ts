"use client";

// ============================================================================
// Isabella — Voice (browser SpeechSynthesis + SpeechRecognition, zero backend)
// ============================================================================
// Minimal, safe text-to-speech + single-utterance listening:
//   • OFF by default; never autoplays unless the user enables it (persisted).
//   • Uses the browser's built-in SpeechSynthesis — no audio is sent anywhere.
//   • Voz validada del prototipo de Isabella: femenina LATINOAMERICANA en
//     español (jamás es-ES si hay alternativa, jamás una voz inglesa leyendo
//     español) y femenina en-US en inglés — ranking `scoreVoice` compartido
//     (companion/useIsabellaVoice.ts, única fuente). Tono joven: rate 1.02,
//     pitch 1.12. Sin voz femenina del idioma → NO habla (solo texto).
//   • Oír: SpeechRecognition de una frase (es-MX / en-US según idioma); la
//     síntesis se cancela antes de escuchar.
//   • Stop/mute is always available; nothing blocks rendering.
//   • Markdown (links/bold) is stripped before speaking.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/types/database";
import {
  scoreVoice,
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from "./companion/useIsabellaVoice";

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
  /** Oír — SpeechRecognition de una frase (es-MX / en-US). */
  srSupported: boolean;
  listening: boolean;
  /** Cancela la síntesis y escucha una frase. Devuelve false si el navegador
   *  no soporta reconocimiento de voz. */
  startListening: (opts: {
    lang: Locale;
    onResult: (transcript: string) => void;
    onError?: (error: string) => void;
  }) => boolean;
  stopListening: () => void;
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

  // Isabella speaks ONLY with a FEMALE voice, ranked by the validated
  // prototype scoring: LATAM Spanish +5 / es-ES −3 / female name +3 /
  // natural·neural·online (Edge) +3 / google +2 — en-US +5 for English.
  // If no female voice exists for the language → return null and the caller
  // shows text only (NEVER a male voice, NEVER an English voice reading
  // Spanish).
  const pickFemaleVoice = useCallback(
    (lang: Locale): SpeechSynthesisVoice | null => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
      const female = voicesFor(lang).filter(isFemaleVoice);
      if (female.length === 0) return null;
      const want = lang === "es" ? "es" : "en";
      return female
        .slice()
        .sort((a, b) => scoreVoice(b, want) - scoreVoice(a, want))[0];
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
      // El locale del utterance sigue al de la VOZ elegida (es-MX, es-US…):
      // nunca forzar es-ES sobre una voz latinoamericana.
      u.lang = v.lang || (lang === "es" ? "es-MX" : "en-US");
      u.voice = v;
      u.rate = 1.02; /* tono joven validado */
      u.pitch = 1.12;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
      return true;
    },
    [pickFemaleVoice],
  );

  // ── Oír: reconocimiento de voz de una frase ────────────────────────────────
  const [srSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const startListening = useCallback(
    (opts: {
      lang: Locale;
      onResult: (transcript: string) => void;
      onError?: (error: string) => void;
    }): boolean => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return false;
      // nunca escuchar mientras habla
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      const rec = new Ctor();
      recRef.current = rec;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      // Español = reconocimiento LATINO (es-MX), inglés = americano (en-US).
      rec.lang = opts.lang === "es" ? "es-MX" : "en-US";
      rec.onresult = (e) => opts.onResult(e.results[0][0].transcript);
      rec.onend = () => setListening(false);
      rec.onerror = (ev) => {
        setListening(false);
        opts.onError?.(ev.error);
      };
      setListening(true);
      try {
        rec.start();
      } catch {
        /* start() lanza si ya está corriendo; onend corrige el estado */
      }
      return true;
    },
    [],
  );

  // Silencio total al desmontar.
  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

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

  return {
    supported,
    enabled,
    speaking,
    hasFemaleVoice,
    toggleEnabled,
    speak,
    stop,
    srSupported,
    listening,
    startListening,
    stopListening,
  };
}
