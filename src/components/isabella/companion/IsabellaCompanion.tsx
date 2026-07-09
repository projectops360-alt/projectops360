"use client";

// ============================================================================
// <IsabellaCompanion /> — Project Intelligence Companion (holograma flotante)
//
// Port fiel del comportamiento del prototipo isabella-holograma-prototipo.html
// (burbuja, voz, señalamiento, proactividad). La FIGURA holográfica vive en
// ../hologram/hologram-figure.tsx — única fuente de verdad del SVG (regla 5),
// compartida con el panel IsabellaExperience.
//
// Punto de integración con el LLM real: prop `brain` (contrato
// { text, state, focus? } en isabellaBrain.ts). El disparo proactivo real es
// por eventos vía handle.notify(evento); el timer demo va tras `proactiveDemo`.
// ============================================================================

import {
  useCallback,
  useEffect,
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
import { HologramFigure, emotionGlow } from "../hologram/hologram-figure";
import styles from "./isabella-companion.module.css";

const ALL_STATES: IsabellaState[] = ["calma", "analiza", "alerta", "habla"];

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

  // refs DOM (el haz se manipula directo, sin re-render)
  const isabellaRef = useRef<HTMLDivElement | null>(null);
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

  // limpieza de timers al desmontar
  useEffect(() => {
    return () => {
      if (typeTimerRef.current !== null) window.clearInterval(typeTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      document.querySelectorAll(".spotlight").forEach((el) => el.classList.remove("spotlight"));
    };
  }, []);

  const glow = emotionGlow(emotion);
  const typingDone = fullText.length > 0 && typedLen >= fullText.length;

  return (
    <div className={styles.root} style={{ "--state-glow": glow } as CSSProperties}>
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

      {/* holograma (figura compartida con el panel IsabellaExperience) */}
      <div ref={isabellaRef} className={cx(styles.isabella, minimized && styles.hiddenHolo)}>
        <div className={styles.holoStage}>
          <HologramFigure emotion={emotion} size={250} stage label="Isabella" />
        </div>

        {/* dock de estados — solo desarrollo */}
        {debug && (
          <div className={styles.dock}>
            {ALL_STATES.map((name) => (
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
