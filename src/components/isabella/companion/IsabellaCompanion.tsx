"use client";

// ============================================================================
// <IsabellaCompanion /> — Project Intelligence Companion (holograma)
//
// Port fiel del prototipo validado isabella-holograma-prototipo.html.
// Los paths SVG, estados emocionales, voz y comportamiento están APROBADOS:
// no rediseñar. Ver los invariantes en el prompt de integración y el
// Product Brain (16-isabella-ai-workforce.md).
//
// Punto de integración con el LLM real: prop `brain` (contrato
// { text, state, focus? } en isabellaBrain.ts). El disparo proactivo real es
// por eventos vía handle.notify(evento); el timer demo va tras `proactiveDemo`.
// ============================================================================

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type Ref,
  type RefObject,
} from "react";
import {
  createDemoRiskEvent,
  createIsabellaBrain,
  type IsabellaBrainFn,
  type IsabellaLang,
  type IsabellaNotifyEvent,
  type IsabellaState,
} from "./isabellaBrain";
import { useIsabellaVoice } from "./useIsabellaVoice";
import styles from "./isabella-companion.module.css";

// --- estados emocionales (glow, boca, cejas) — valores exactos del prototipo
const STATES: Record<
  IsabellaState,
  { glow: string; mouth: string; brows: [string, string] }
> = {
  calma: {
    glow: "#8CBEFF",
    mouth: "M92 76 Q96 74.2 100 75.4 Q104 74.2 108 76 Q100 83 92 76 Z",
    brows: ["M84.5 50.5 Q90.5 47.5 96 49.5", "M104 49.5 Q109.5 47.5 115.5 50.5"],
  },
  analiza: {
    glow: "#B79CFF",
    mouth: "M93 77 Q100 75.6 107 77 Q100 80.6 93 77 Z",
    brows: ["M84.5 49 Q90.5 46 96 48", "M104 48 Q109.5 46 115.5 49"],
  },
  alerta: {
    glow: "#FFB454",
    mouth: "M93 78.5 Q100 76.4 107 78.5 Q100 80.8 93 78.5 Z",
    brows: ["M84.5 48 Q90.5 50.5 96 51.5", "M104 51.5 Q109.5 50.5 115.5 48"],
  },
  habla: {
    glow: "#9BE8FF",
    mouth: "M93 77 Q100 75.6 107 77 Q100 80.6 93 77 Z",
    brows: ["M84.5 50.5 Q90.5 47.5 96 49.5", "M104 49.5 Q109.5 47.5 115.5 50.5"],
  },
};

const TYPE_MS = 16; /* efecto de tipeo por carácter (~18ms en el spec) */
const AUTO_HIDE_MS = 5000; /* autocierre de burbuja tras hablar (solo con voz) */

interface BubbleAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface IsabellaCompanionHandle {
  /** Disparo proactivo por eventos del dominio (Nivel 6). */
  notify: (evento: IsabellaNotifyEvent) => void;
  /** Habla/escribe el texto tal cual. */
  say: (text: string) => void;
  /** Señala un elemento por id de `focusTargets` (o id del DOM). */
  pointAt: (focusId: string) => void;
  clearSpotlight: () => void;
  setEmotion: (state: IsabellaState) => void;
}

export interface IsabellaCompanionProps {
  /** Mapa de elementos señalables: id → ref o selector CSS. Si un `focus`
   * no está en el mapa, se intenta `document.getElementById(focus)`. */
  focusTargets?: Record<string, RefObject<HTMLElement | null> | string>;
  /** Cerebro de respuestas; por defecto el demo determinista. Sustituir por
   * la llamada al backend LLM manteniendo el contrato { text, state, focus? }. */
  brain?: IsabellaBrainFn;
  /** Contexto que saluda al restaurar desde el orbe ("Seguimos en …"). */
  contextLabel?: string;
  /** Muestra el dock de estados (solo desarrollo). */
  debug?: boolean;
  /** Activa el timer demo del escenario proactivo (riesgo a los 4s).
   * En la app real usar handle.notify(evento) por eventos, no timers. */
  proactiveDemo?: boolean;
  initialLang?: IsabellaLang;
  ref?: Ref<IsabellaCompanionHandle>;
}

function cx(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export function IsabellaCompanion({
  focusTargets,
  brain,
  contextLabel = "Migración CRM, Fase 2",
  debug = false,
  proactiveDemo = false,
  initialLang = "es",
  ref,
}: IsabellaCompanionProps): ReactElement {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = {
    holoGrad: `${uid}-holoGrad`,
    fadeGrad: `${uid}-fadeGrad`,
    silClip: `${uid}-silClip`,
    scanPattern: `${uid}-scanPattern`,
  };

  const [lang, setLang] = useState<IsabellaLang>(initialLang);
  const [emotion, setEmotion] = useState<IsabellaState>("calma");
  const [minimized, setMinimized] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ask, setAsk] = useState("");

  // burbuja + tipeo
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [fullText, setFullText] = useState("");
  const [typedLen, setTypedLen] = useState(0);
  const [bubbleActions, setBubbleActions] = useState<BubbleAction[]>([]);
  const [youText, setYouText] = useState<string | null>(null);

  // haz señalador
  const [beamOn, setBeamOn] = useState(false);

  const es = lang === "es";
  const t = useCallback((a: string, b: string) => (es ? a : b), [es]);

  const voice = useIsabellaVoice(lang);

  // refs DOM (gaze/parpadeo/haz se manipulan directo, sin re-render)
  const isabellaRef = useRef<HTMLDivElement | null>(null);
  const pupLRef = useRef<SVGGElement | null>(null);
  const pupRRef = useRef<SVGGElement | null>(null);
  const lidLRef = useRef<SVGRectElement | null>(null);
  const lidRRef = useRef<SVGRectElement | null>(null);
  const beamRef = useRef<SVGLineElement | null>(null);
  const spotTargetRef = useRef<HTMLElement | null>(null);

  // refs de control
  const reducedRef = useRef(false);
  const typeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const noSpanishWarnedRef = useRef(false);
  const voiceOnRef = useRef(true);
  const langRef = useRef<IsabellaLang>(initialLang);
  voiceOnRef.current = voiceOn;
  langRef.current = lang;

  const brainRef = useRef<IsabellaBrainFn | null>(null);
  if (brainRef.current === null) brainRef.current = brain ?? createIsabellaBrain();
  useEffect(() => {
    if (brain) brainRef.current = brain;
  }, [brain]);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /* ---- burbuja con efecto de tipeo (port de say()) ---- */
  const sayTyped = useCallback(
    (text: string, actions: BubbleAction[] = [], opts: { silent?: boolean; after?: IsabellaState } = {}) => {
      if (typeTimerRef.current !== null) window.clearInterval(typeTimerRef.current);
      setBubbleVisible(true);
      setFullText(text);
      setTypedLen(0);
      setBubbleActions([]);
      if (!opts.silent) setEmotion("habla");
      let i = 0;
      typeTimerRef.current = window.setInterval(() => {
        i += 1;
        setTypedLen(i);
        if (i >= text.length) {
          if (typeTimerRef.current !== null) window.clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
          if (!opts.silent) setEmotion(opts.after ?? "calma");
          setBubbleActions(actions);
        }
      }, reducedRef.current ? 1 : TYPE_MS);
    },
    [],
  );

  const hideBubble = useCallback(() => {
    setBubbleVisible(false);
    if (typeTimerRef.current !== null) window.clearInterval(typeTimerRef.current);
    typeTimerRef.current = null;
  }, []);

  /* ---- haz señalador ---- */
  const positionBeam = useCallback((el: HTMLElement) => {
    const beam = beamRef.current;
    const holo = isabellaRef.current;
    if (!beam || !holo) return;
    const r = el.getBoundingClientRect();
    const h = holo.getBoundingClientRect();
    beam.setAttribute("x1", String(h.left + h.width / 2 - 20));
    beam.setAttribute("y1", String(h.top + 70));
    beam.setAttribute("x2", String(r.right + 6));
    beam.setAttribute("y2", String(r.top + r.height / 2));
  }, []);

  const pointAtEl = useCallback(
    (el: HTMLElement) => {
      positionBeam(el);
      spotTargetRef.current = el;
      setBeamOn(true);
      el.classList.add("spotlight");
    },
    [positionBeam],
  );

  const clearSpotlight = useCallback(() => {
    setBeamOn(false);
    spotTargetRef.current = null;
    /* limpiar TODOS los .spotlight de la página, no solo el último */
    document.querySelectorAll(".spotlight").forEach((el) => el.classList.remove("spotlight"));
  }, []);

  const resolveTarget = useCallback(
    (focusId: string): HTMLElement | null => {
      const target = focusTargets?.[focusId];
      if (typeof target === "string") return document.querySelector<HTMLElement>(target);
      if (target?.current) return target.current;
      return document.getElementById(focusId);
    },
    [focusTargets],
  );

  const pointAtId = useCallback(
    (focusId: string) => {
      const el = resolveTarget(focusId);
      if (el) pointAtEl(el);
    },
    [resolveTarget, pointAtEl],
  );

  // el haz sigue al elemento si la página hace scroll o cambia de tamaño
  useEffect(() => {
    if (!beamOn) return;
    const update = () => {
      if (spotTargetRef.current) positionBeam(spotTargetRef.current);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [beamOn, positionBeam]);

  /* ---- hablar (port de speak()) ---- */
  const speakOut = useCallback(
    (text: string, userText?: string, afterState: IsabellaState = "calma") => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      setYouText(userText ?? null);
      sayTyped(text, [], { silent: true });
      setEmotion("habla");
      const done = () => {
        setEmotion(afterState);
        /* con voz apagada la burbuja se queda para leer; se cierra con ✕
           o al llegar el siguiente mensaje */
        if (voiceOnRef.current) {
          hideTimerRef.current = window.setTimeout(() => {
            hideBubble();
            setYouText(null);
            clearSpotlight();
          }, AUTO_HIDE_MS);
        }
      };
      if (voiceOnRef.current) {
        const status = voice.speak(text, { onEnd: done });
        if (status === "spoken") return;
        /* sin voz del idioma: mejor texto que acento gringo */
        window.setTimeout(done, text.length * 18 + 400);
        if (status === "no-voice" && langRef.current === "es" && !noSpanishWarnedRef.current) {
          noSpanishWarnedRef.current = true;
          window.setTimeout(() => {
            sayTyped(
              "Tu sistema no tiene ninguna voz en español instalada, por eso no hablo (una voz en inglés leyendo español suena fatal). En Windows: Configuración → Hora e idioma → Voz → Agregar voces → Español (México). O ábreme en Microsoft Edge, que trae voces naturales en español sin instalar nada.",
              [],
              { silent: true },
            );
          }, text.length * 18 + 900);
        }
      } else {
        /* modo lectura: el estado "hablando" dura lo que tarda el tipeo */
        window.setTimeout(done, text.length * 18 + 400);
      }
    },
    [sayTyped, hideBubble, clearSpotlight, voice],
  );

  /* ---- conversación ---- */
  const handleUser = useCallback(
    (txt: string) => {
      clearSpotlight();
      const r = (brainRef.current ?? createIsabellaBrain())(txt, langRef.current);
      if (r.focus) pointAtId(r.focus);
      speakOut(r.text, txt, r.state);
    },
    [clearSpotlight, pointAtId, speakOut],
  );

  const onSend = useCallback(() => {
    const v = ask.trim();
    if (!v) return;
    setAsk("");
    handleUser(v);
  }, [ask, handleUser]);

  const onMic = useCallback(() => {
    if (voice.listening) {
      voice.stopListening();
      return;
    }
    const started = voice.startListening({
      onResult: handleUser,
      onError: (error) => {
        if (error === "not-allowed") {
          speakOut(
            t(
              "Necesito permiso para usar el micrófono. Revisa el candado en la barra del navegador.",
              "I need microphone permission. Check the lock icon in the browser bar.",
            ),
          );
        }
      },
    });
    if (!started) {
      speakOut(
        t(
          "Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.",
          "Your browser doesn't support speech recognition. Try Chrome or Edge.",
        ),
      );
      return;
    }
    setEmotion("analiza");
  }, [voice, handleUser, speakOut, t]);

  const toggleVoiceOn = useCallback(() => {
    setVoiceOn((prev) => {
      if (prev) voice.cancelSpeech();
      return !prev;
    });
  }, [voice]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === "es" ? "en" : "es"));
  }, []);

  const onVoicePick = useCallback(
    (uri: string) => {
      voice.setChosenVoiceURI(uri);
      speakOut(t("Así suena mi voz. ¿Te gusta?", "This is how my voice sounds. Do you like it?"));
    },
    [voice, speakOut, t],
  );

  const closeBubbleManual = useCallback(() => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideBubble();
    setYouText(null);
    clearSpotlight();
  }, [hideBubble, clearSpotlight]);

  /* ---- proactividad (Nivel 6): notify(evento) ---- */
  const resetCalm = useCallback(() => {
    hideBubble();
    clearSpotlight();
    setEmotion("calma");
  }, [hideBubble, clearSpotlight]);

  const showEvent = useCallback(
    (ev: IsabellaNotifyEvent) => {
      hideBubble();
      setEmotion("alerta");
      if (ev.focus) pointAtId(ev.focus);
      window.setTimeout(() => {
        const actions: BubbleAction[] = [];
        if (ev.actionLabel) {
          actions.push({
            label: ev.actionLabel,
            primary: true,
            onClick: () => {
              ev.onAction?.();
              if (ev.confirmation) {
                sayTyped(
                  ev.confirmation,
                  [{ label: t("Entendido", "Got it"), onClick: resetCalm }],
                  { after: "calma" },
                );
              } else {
                resetCalm();
              }
            },
          });
        }
        actions.push({ label: t("Cerrar", "Close"), onClick: resetCalm });
        sayTyped(ev.detail, actions, { after: "alerta" });
      }, 900);
    },
    [hideBubble, pointAtId, sayTyped, resetCalm, t],
  );

  const notify = useCallback(
    (ev: IsabellaNotifyEvent) => {
      setEmotion("analiza");
      window.setTimeout(() => {
        sayTyped(
          ev.prompt,
          [
            { label: t("Muéstrame", "Show me"), primary: true, onClick: () => showEvent(ev) },
            {
              label: t("Ahora no", "Not now"),
              onClick: () => {
                hideBubble();
                setEmotion("calma");
              },
            },
          ],
          { after: "calma" },
        );
      }, 1800);
    },
    [sayTyped, showEvent, hideBubble, t],
  );

  // timer DEMO del prototipo (en la app real: eventos → handle.notify)
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  useEffect(() => {
    if (!proactiveDemo) return;
    const timer = window.setTimeout(
      () => notifyRef.current(createDemoRiskEvent(langRef.current)),
      4000,
    );
    return () => window.clearTimeout(timer);
  }, [proactiveDemo]);

  /* ---- minimizar / restaurar (Nivel 1) ---- */
  const minimize = useCallback(() => {
    hideBubble();
    clearSpotlight();
    setMinimized(true);
  }, [hideBubble, clearSpotlight]);

  const restore = useCallback(() => {
    setMinimized(false);
    sayTyped(
      t(`Aquí estoy. Seguimos en ${contextLabel}.`, `I'm here. We're still on ${contextLabel}.`),
      [],
      { after: "calma" },
    );
    window.setTimeout(hideBubble, 3800);
  }, [sayTyped, hideBubble, contextLabel, t]);

  /* ---- API imperativa ---- */
  useImperativeHandle(
    ref,
    () => ({
      notify: (evento: IsabellaNotifyEvent) => notifyRef.current(evento),
      say: (text: string) => speakOut(text),
      pointAt: pointAtId,
      clearSpotlight,
      setEmotion,
    }),
    [speakOut, pointAtId, clearSpotlight],
  );

  /* ---- seguimiento de mirada (grupo iris+pupila+brillo, ±2 / ±1.5px) ---- */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (reducedRef.current) return;
      const holo = isabellaRef.current;
      const l = pupLRef.current;
      const r = pupRRef.current;
      if (!holo || !l || !r) return;
      const rect = holo.getBoundingClientRect();
      const cx0 = rect.left + rect.width / 2;
      const cy0 = rect.top + rect.height * 0.4;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx0) / 500));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy0) / 500));
      const transform = `translate(${dx * 2} ${dy * 1.5})`;
      l.setAttribute("transform", transform);
      r.setAttribute("transform", transform);
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  /* ---- parpadeo aleatorio ---- */
  useEffect(() => {
    let nextTimer = 0;
    let closeTimer = 0;
    const blink = () => {
      if (!reducedRef.current) {
        lidLRef.current?.setAttribute("height", "13");
        lidRRef.current?.setAttribute("height", "13");
        closeTimer = window.setTimeout(() => {
          lidLRef.current?.setAttribute("height", "0");
          lidRRef.current?.setAttribute("height", "0");
        }, 130);
      }
      nextTimer = window.setTimeout(blink, 2800 + Math.random() * 3200);
    };
    nextTimer = window.setTimeout(blink, 2000);
    return () => {
      window.clearTimeout(nextTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  // limpieza de timers al desmontar
  useEffect(() => {
    return () => {
      if (typeTimerRef.current !== null) window.clearInterval(typeTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      document.querySelectorAll(".spotlight").forEach((el) => el.classList.remove("spotlight"));
    };
  }, []);

  const st = STATES[emotion];
  const typingDone = fullText.length > 0 && typedLen >= fullText.length;

  return (
    <div className={styles.root} style={{ "--state-glow": st.glow } as CSSProperties}>
      {/* burbuja de diálogo */}
      <div className={cx(styles.bubble, bubbleVisible && styles.bubbleShow)} role="status" aria-live="polite">
        <button
          type="button"
          className={styles.bubbleClose}
          title={t("Cerrar", "Close")}
          onClick={closeBubbleManual}
        >
          ✕
        </button>
        <div className={styles.who}>Isabella</div>
        {youText !== null && (
          <div className={styles.you}>{es ? `Tú: “${youText}”` : `You: “${youText}”`}</div>
        )}
        <div>{fullText.slice(0, typedLen)}</div>
        {typingDone && bubbleActions.length > 0 && (
          <div className={styles.actions}>
            {bubbleActions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={a.primary ? styles.primary : undefined}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* haz señalador */}
      <svg className={styles.beamLayer} aria-hidden="true">
        <line ref={beamRef} className={cx(styles.beam, beamOn && styles.beamOn)} x1="0" y1="0" x2="0" y2="0" />
      </svg>

      {/* holograma */}
      <div ref={isabellaRef} className={cx(styles.isabella, minimized && styles.hiddenHolo)}>
        <div className={styles.holoStage}>
          <div className={styles.cone} />
          <div className={styles.base}>
            <div className={styles.disc} />
            <div className={styles.ring} />
            <div className={styles.ring} />
          </div>

          <div className={styles.figure}>
            <svg viewBox="0 0 200 240" width="170" height="225" aria-label="Isabella">
              <defs>
                <linearGradient id={ids.holoGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--holo-a)" />
                  <stop offset="1" stopColor="var(--holo-b)" />
                </linearGradient>
                <linearGradient id={ids.fadeGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--holo-a)" stopOpacity=".22" />
                  <stop offset=".75" stopColor="var(--holo-b)" stopOpacity=".14" />
                  <stop offset="1" stopColor="var(--holo-b)" stopOpacity="0" />
                </linearGradient>
                <clipPath id={ids.silClip}>
                  <path d="M100 14 C70 14 57 34 58 62 C59 92 58 120 50 144 C47 154 52 162 60 158 C70 153 76 140 79 126 C81 116 83 106 84 96 L116 96 C117 106 119 116 121 126 C124 140 130 153 140 158 C148 162 153 154 150 144 C142 120 141 92 142 62 C143 34 130 14 100 14 Z" />
                  <path d="M92 84 C92 94 92 99 90 103 C77 107 63 112 59 126 C55 141 61 158 72 172 C64 186 58 198 58 212 C58 224 56 232 54 240 L146 240 C144 232 142 224 142 212 C142 198 136 186 128 172 C139 158 145 141 141 126 C137 112 123 107 110 103 C108 99 108 94 108 84 Z" />
                  <path d="M100 34 C85 34 78 46 78 62 C78 77 87 90 100 90 C113 90 122 77 122 62 C122 46 115 34 100 34 Z" />
                </clipPath>
                <pattern id={ids.scanPattern} width="4" height="4" patternUnits="userSpaceOnUse">
                  <rect width="4" height="1" fill="rgba(255,255,255,.09)" />
                </pattern>
              </defs>

              {/* cabello: capa trasera con volumen y ondas */}
              <path
                d="M100 14 C70 14 57 34 58 62 C59 92 58 120 50 144 C47 154 52 162 60 158 C70 153 76 140 79 126 C81 116 83 106 84 96 L116 96 C117 106 119 116 121 126 C124 140 130 153 140 158 C148 162 153 154 150 144 C142 120 141 92 142 62 C143 34 130 14 100 14 Z"
                fill={`url(#${ids.fadeGrad})`}
                stroke={`url(#${ids.holoGrad})`}
                strokeWidth="1.2"
                strokeOpacity=".8"
              />

              {/* ondas del cabello */}
              <g clipPath={`url(#${ids.silClip})`} stroke={`url(#${ids.holoGrad})`} strokeOpacity=".3" strokeWidth="1" fill="none">
                <path d="M66 60 C63 90 64 120 56 148" />
                <path d="M134 60 C137 90 136 120 144 148" />
                <path d="M72 100 C70 118 68 134 62 150" />
                <path d="M128 100 C130 118 132 134 138 150" />
              </g>

              {/* cuerpo: cuello, hombros, cintura y caderas */}
              <path
                d="M92 84 C92 94 92 99 90 103 C77 107 63 112 59 126 C55 141 61 158 72 172 C64 186 58 198 58 212 C58 224 56 232 54 240 L146 240 C144 232 142 224 142 212 C142 198 136 186 128 172 C139 158 145 141 141 126 C137 112 123 107 110 103 C108 99 108 94 108 84 Z"
                fill={`url(#${ids.fadeGrad})`}
                stroke={`url(#${ids.holoGrad})`}
                strokeWidth="1.4"
                strokeOpacity=".9"
              />

              {/* contornos del cuerpo (busto, cintura, cadera) */}
              <g clipPath={`url(#${ids.silClip})`} stroke={`url(#${ids.holoGrad})`} strokeOpacity=".3" strokeWidth=".8" fill="none">
                <path d="M61 132 Q100 143 139 132" />
                <path d="M73 172 Q100 181 127 172" />
                <path d="M58 212 Q100 223 142 212" />
              </g>

              {/* blazer: solapas */}
              <g stroke={`url(#${ids.holoGrad})`} strokeOpacity=".45" strokeWidth="1" fill="none">
                <path d="M90 105 L100 134 L96 180" />
                <path d="M110 105 L100 134 L104 180" />
                <path d="M93 104 Q100 116 107 104" />
              </g>

              {/* rostro: cara redondeada, mejillas llenas */}
              <path
                d="M100 34 C85 34 78 46 78 62 C78 77 87 90 100 90 C113 90 122 77 122 62 C122 46 115 34 100 34 Z"
                fill={`url(#${ids.fadeGrad})`}
                stroke={`url(#${ids.holoGrad})`}
                strokeWidth="1.1"
                strokeOpacity=".7"
              />

              {/* mechones frontales suaves */}
              <g stroke={`url(#${ids.holoGrad})`} strokeOpacity=".55" strokeWidth="1.8" fill="none" strokeLinecap="round">
                <path d="M85 36 C77 50 76 72 83 92" />
                <path d="M115 36 C123 50 124 72 117 92" />
                <path d="M96 16 C86 20 81 28 79 40" strokeWidth="1" strokeOpacity=".4" />
              </g>

              {/* aretes */}
              <circle cx="79" cy="82" r="1.7" fill="var(--holo-a)" opacity=".85" />
              <circle cx="121" cy="82" r="1.7" fill="var(--holo-a)" opacity=".85" />

              {/* scanlines recortadas a la silueta */}
              <g clipPath={`url(#${ids.silClip})`}>
                <g className={styles.scan}>
                  <rect x="0" y="-40" width="200" height="320" fill={`url(#${ids.scanPattern})`} />
                </g>
              </g>

              {/* rasgos faciales */}
              <g>
                {/* rubor sutil en las mejillas */}
                <ellipse cx="86" cy="71" rx="5" ry="3" fill="var(--holo-b)" opacity=".14" />
                <ellipse cx="114" cy="71" rx="5" ry="3" fill="var(--holo-b)" opacity=".14" />
                {/* cejas arqueadas, altas */}
                <path className={styles.brow} d={st.brows[0]} stroke="var(--holo-a)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path className={styles.brow} d={st.brows[1]} stroke="var(--holo-a)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                {/* ojos grandes: esclerótica, iris, pupila oscura y brillo */}
                <g>
                  <circle cx="90.5" cy="63" r="5.2" fill="rgba(255,255,255,.5)" />
                  <g ref={pupLRef}>
                    <circle cx="90.5" cy="63" r="3" fill={`url(#${ids.holoGrad})`} opacity=".95" />
                    <circle cx="90.5" cy="63" r="1.55" fill="#0B1020" />
                    <circle cx="89.4" cy="61.8" r="0.75" fill="#FFFFFF" opacity=".95" />
                  </g>
                  <path d="M85 60.5 Q90.5 56.5 96 60.5" stroke="var(--holo-a)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M85.5 60 L83 58" stroke="var(--holo-a)" strokeWidth="1.2" strokeLinecap="round" />
                </g>
                <g>
                  <circle cx="109.5" cy="63" r="5.2" fill="rgba(255,255,255,.5)" />
                  <g ref={pupRRef}>
                    <circle cx="109.5" cy="63" r="3" fill={`url(#${ids.holoGrad})`} opacity=".95" />
                    <circle cx="109.5" cy="63" r="1.55" fill="#0B1020" />
                    <circle cx="108.4" cy="61.8" r="0.75" fill="#FFFFFF" opacity=".95" />
                  </g>
                  <path d="M104 60.5 Q109.5 56.5 115 60.5" stroke="var(--holo-a)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M114.5 60 L117 58" stroke="var(--holo-a)" strokeWidth="1.2" strokeLinecap="round" />
                </g>
                {/* párpados (parpadeo) */}
                <rect ref={lidLRef} x="84.5" y="56" width="13" height="0" fill="#0E1220" opacity=".9" />
                <rect ref={lidRRef} x="102.5" y="56" width="13" height="0" fill="#0E1220" opacity=".9" />
                {/* nariz corta y sutil */}
                <path d="M100 67.5 Q99 70 101 70.8" stroke="var(--holo-a)" strokeWidth="1" fill="none" strokeLinecap="round" opacity=".3" />
                {/* labios llenos (forma rellena — se ocultan en estado habla) */}
                <path
                  className={styles.mouth}
                  d={st.mouth}
                  fill={`url(#${ids.holoGrad})`}
                  opacity={emotion === "habla" ? 0 : 0.95}
                />
                {/* ecualizador de voz (reemplaza la boca solo al hablar) */}
                <g className={cx(styles.voice, emotion === "habla" && styles.voiceOn)} fill="var(--holo-a)">
                  <rect x="91" y="73" width="2.8" height="10" rx="1.4" />
                  <rect x="96.4" y="73" width="2.8" height="10" rx="1.4" />
                  <rect x="101.8" y="73" width="2.8" height="10" rx="1.4" />
                  <rect x="107.2" y="73" width="2.8" height="10" rx="1.4" />
                </g>
              </g>

              {/* puntitos de análisis */}
              <g className={cx(styles.think, emotion === "analiza" && styles.thinkOn)} fill="var(--holo-b)">
                <circle cx="100" cy="16" r="2.4" />
                <circle cx="100" cy="16" r="2" />
                <circle cx="100" cy="16" r="1.6" />
              </g>
            </svg>
          </div>
        </div>

        {/* dock de estados — solo desarrollo */}
        {debug && (
          <div className={styles.dock}>
            {(Object.keys(STATES) as IsabellaState[]).map((name) => (
              <button
                key={name}
                type="button"
                className={cx(emotion === name && styles.dockOn)}
                onClick={() => {
                  hideBubble();
                  clearSpotlight();
                  setEmotion(name);
                }}
              >
                {name === "calma" ? "Calma" : name === "analiza" ? "Analizando" : name === "alerta" ? "Alerta" : "Hablando"}
              </button>
            ))}
            <div className={styles.sep} />
          </div>
        )}

        {/* barra de conversación: los 4 canales (hablar/escribir/oír/leer) */}
        <div className={styles.chatbar}>
          <button
            type="button"
            className={cx(voice.listening && styles.rec)}
            title={t("Hablarle con el micrófono", "Talk with the microphone")}
            onClick={onMic}
          >
            🎤
          </button>
          <input
            type="text"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            placeholder={t("Háblale o escríbele…", "Talk or type to her…")}
          />
          <button type="button" title={t("Enviar", "Send")} onClick={onSend}>
            ➤
          </button>
          <button
            type="button"
            title={
              voiceOn
                ? t("Voz activada — clic para silenciar", "Voice on — click to mute")
                : t("Modo lectura — clic para activar voz", "Reading mode — click for voice")
            }
            onClick={toggleVoiceOn}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
          <button type="button" className={styles.langBtn} title={t("Cambiar idioma", "Change language")} onClick={toggleLang}>
            {lang.toUpperCase()}
          </button>
          <button type="button" title={t("Minimizar", "Minimize")} onClick={minimize}>
            —
          </button>
        </div>

        {/* selector de voz */}
        <select
          className={styles.voiceSel}
          title={t("Elegir la voz de Isabella", "Choose Isabella's voice")}
          value={voice.chosenVoiceURI}
          onChange={(e) => onVoicePick(e.target.value)}
        >
          <option value="">{t("Voz: automática", "Voice: automatic")}</option>
          {voice.voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* orbe minimizado */}
      <button
        type="button"
        className={cx(styles.orb, minimized && styles.orbShow)}
        title="Isabella"
        onClick={restore}
      />
    </div>
  );
}
