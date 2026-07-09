"use client";

// ============================================================================
// Isabella Companion — voz (síntesis + reconocimiento), solo Web APIs nativas.
//
// Reglas no negociables (ver prototipo isabella-holograma-prototipo.html):
// - Español = voz femenina LATINOAMERICANA. Jamás es-ES, jamás una voz
//   inglesa leyendo español.
// - Si no existe ninguna voz en español: NO emitir audio (speak devuelve
//   "no-voice" y el componente pasa a solo-texto con aviso).
// - rate 1.02, pitch 1.12 (tono joven). Manejar voiceschanged (async).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IsabellaLang } from "./isabellaBrain";

// --- Tipos mínimos de SpeechRecognition (no están en lib.dom) ---------------
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// --- Ranking de voces (copiado del prototipo: scoreVoice) --------------------
const LATAM = /^es[-_](MX|US|419|CO|AR|CL|PE|VE|DO|GT|HN|NI|PA|PR|SV|UY|BO|CR|EC|PY)/i;
const ES_ES = /^es[-_]ES/i;
const FEM_ES = /dalia|paulina|camila|luciana|francisca|isidora|sabina|sof[ií]a|ximena|andrea|valentina|salome|renata|marina|female|mujer/i;
const FEM_EN = /aria|jenny|zira|michelle|emma|samantha|allison|ava|joanna|salli|female/i;

export function scoreVoice(v: SpeechSynthesisVoice, lang: IsabellaLang): number {
  let s = 0;
  if (lang === "es") {
    if (LATAM.test(v.lang)) s += 5; /* latinoamericana */
    if (ES_ES.test(v.lang)) s -= 3; /* evitar España */
    if (FEM_ES.test(v.name)) s += 3; /* femenina */
    if (/estados unidos|m[eé]xico|mexicano/i.test(v.name)) s += 2;
  } else {
    if (/^en[-_]US/i.test(v.lang)) s += 5;
    if (FEM_EN.test(v.name)) s += 3;
  }
  if (/natural|neural|online/i.test(v.name)) s += 3; /* voces modernas de Edge */
  if (/google/i.test(v.name)) s += 2;
  return s;
}

export type SpeakStatus = "spoken" | "no-voice" | "unsupported";

export interface IsabellaVoiceApi {
  ttsSupported: boolean;
  srSupported: boolean;
  /** Voces del idioma actual ordenadas por score (para el selector). */
  voices: SpeechSynthesisVoice[];
  chosenVoiceURI: string;
  setChosenVoiceURI: (uri: string) => void;
  /**
   * Habla el texto. Devuelve "no-voice" si NO hay ninguna voz del idioma
   * actual instalada (en ese caso no se emite audio: mejor texto que una voz
   * inglesa leyendo español).
   */
  speak: (text: string, opts?: { onEnd?: () => void }) => SpeakStatus;
  cancelSpeech: () => void;
  /** true si el reconocimiento arrancó; false si el navegador no lo soporta. */
  startListening: (opts: {
    onResult: (transcript: string) => void;
    onError?: (error: string) => void;
    onEnd?: () => void;
  }) => boolean;
  stopListening: () => void;
  listening: boolean;
}

export function useIsabellaVoice(lang: IsabellaLang): IsabellaVoiceApi {
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [chosenVoiceURI, setChosenVoiceURIState] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Ref espejo: permite que speak() use la voz recién elegida en el mismo
  // tick (el sample "Así suena mi voz" suena con la voz nueva, no la anterior).
  const chosenRef = useRef("");
  const setChosenVoiceURI = useCallback((uri: string) => {
    chosenRef.current = uri;
    setChosenVoiceURIState(uri);
  }, []);

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const srSupported = getSpeechRecognitionCtor() !== null;

  // Las voces cargan de forma asíncrona: escuchar voiceschanged + reintento.
  useEffect(() => {
    if (!ttsSupported) return;
    const refresh = () => setAllVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    const retry = window.setTimeout(refresh, 300);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
      window.clearTimeout(retry);
    };
  }, [ttsSupported]);

  // Al cambiar de idioma se descarta la voz elegida manualmente.
  useEffect(() => {
    setChosenVoiceURI("");
  }, [lang, setChosenVoiceURI]);

  const voices = useMemo(() => {
    const prefix = lang === "es" ? /^es/i : /^en/i;
    return allVoices
      .filter((v) => prefix.test(v.lang))
      .slice()
      .sort((a, b) => scoreVoice(b, lang) - scoreVoice(a, lang));
  }, [allVoices, lang]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    if (chosenRef.current) {
      const chosen = voices.find((v) => v.voiceURI === chosenRef.current);
      if (chosen) return chosen;
    }
    return voices[0];
  }, [voices]);

  const speak = useCallback(
    (text: string, opts?: { onEnd?: () => void }): SpeakStatus => {
      if (!ttsSupported) return "unsupported";
      const v = pickVoice();
      if (!v) return "no-voice"; /* sin voz del idioma: no emitir audio */
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang || (lang === "es" ? "es-MX" : "en-US");
      u.rate = 1.02;
      u.pitch = 1.12;
      const done = () => opts?.onEnd?.();
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
      return "spoken";
    },
    [ttsSupported, pickVoice, lang],
  );

  const cancelSpeech = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [ttsSupported]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const startListening = useCallback(
    (opts: {
      onResult: (transcript: string) => void;
      onError?: (error: string) => void;
      onEnd?: () => void;
    }): boolean => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return false;
      cancelSpeech(); /* nunca escuchar mientras habla */
      const rec = new Ctor();
      recRef.current = rec;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.lang = lang === "es" ? "es-MX" : "en-US";
      rec.onresult = (e) => opts.onResult(e.results[0][0].transcript);
      rec.onend = () => {
        setListening(false);
        opts.onEnd?.();
      };
      rec.onerror = (ev) => {
        setListening(false);
        opts.onError?.(ev.error);
      };
      setListening(true);
      try {
        rec.start();
      } catch {
        /* start() lanza si ya está corriendo; el estado lo corrige onend */
      }
      return true;
    },
    [lang, cancelSpeech],
  );

  // Limpieza al desmontar: silencio total.
  useEffect(() => {
    return () => {
      recRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    ttsSupported,
    srSupported,
    voices,
    chosenVoiceURI,
    setChosenVoiceURI,
    speak,
    cancelSpeech,
    startListening,
    stopListening,
    listening,
  };
}
