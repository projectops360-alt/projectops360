"use client";

// ============================================================================
// Isabella — HologramFigure (la mujer holográfica del prototipo validado)
// ============================================================================
// Port fiel del SVG de isabella-holograma-prototipo.html: mujer joven (26),
// profesional, blazer, cabello con ondas, ojos con esclerótica + iris +
// pupila oscura (#0B1020) + brillo, labios llenos. Seguimiento de mirada
// (grupo iris+pupila+brillo, ±2/±1.5px), parpadeo aleatorio 2.8–6s,
// respiración, glitch, scanlines recortadas a la silueta.
//
// Única fuente de verdad del SVG de Isabella (CLAUDE.md regla 5): la consumen
// el panel IsabellaExperience (contrato PresenceState) y el IsabellaCompanion
// (emoción directa). NO redibujar los paths.
//
// Estados emocionales (4): calma / analiza / alerta / habla — en `habla` la
// boca se oculta y aparece el ecualizador de 4 barras.
// ============================================================================

import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { PresenceState } from "../avatar";
import styles from "./hologram-figure.module.css";

export type HologramEmotion = "calma" | "analiza" | "alerta" | "habla";

// glow, boca y cejas por estado — valores exactos del prototipo
const EMOTIONS: Record<
  HologramEmotion,
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

/** Color de glow del estado (para superficies que acompañan al holograma,
 * como la burbuja del companion). */
export function emotionGlow(emotion: HologramEmotion): string {
  return EMOTIONS[emotion].glow;
}

/** Mapea el contrato PresenceState del panel al estado emocional del holograma. */
export function presenceToEmotion(state: PresenceState): HologramEmotion {
  switch (state) {
    case "thinking":
    case "listening":
      return "analiza";
    case "speaking":
      return "habla";
    case "greeting":
    case "idle":
    default:
      return "calma";
  }
}

export interface HologramFigureProps {
  /** Contrato del panel; se ignora si se pasa `emotion` directamente. */
  state?: PresenceState;
  /** Estado emocional explícito (companion / debug). Gana sobre `state`. */
  emotion?: HologramEmotion;
  /** Lado del cuadro contenedor en px. <64 = modo busto (solo rostro). */
  size?: number;
  /** Cono de proyección + base con anillos (solo tiene sentido a tamaño hero). */
  stage?: boolean;
  label?: string;
  className?: string;
}

export function HologramFigure({
  state = "idle",
  emotion,
  size = 150,
  stage = true,
  label,
  className,
}: HologramFigureProps) {
  const mood: HologramEmotion = emotion ?? presenceToEmotion(state);
  const em = EMOTIONS[mood];
  const bust = size < 64;

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = {
    holoGrad: `${uid}-holoGrad`,
    fadeGrad: `${uid}-fadeGrad`,
    silClip: `${uid}-silClip`,
    scanPattern: `${uid}-scanPattern`,
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pupLRef = useRef<SVGGElement | null>(null);
  const pupRRef = useRef<SVGGElement | null>(null);
  const lidLRef = useRef<SVGRectElement | null>(null);
  const lidRRef = useRef<SVGRectElement | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /* ---- seguimiento de mirada: mover el GRUPO iris+pupila+brillo ---- */
  useEffect(() => {
    if (bust) return; /* imperceptible en miniatura */
    const onMove = (e: MouseEvent) => {
      if (reducedRef.current) return;
      const root = rootRef.current;
      const l = pupLRef.current;
      const r = pupRRef.current;
      if (!root || !l || !r) return;
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.4;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 500));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 500));
      const transform = `translate(${dx * 2} ${dy * 1.5})`;
      l.setAttribute("transform", transform);
      r.setAttribute("transform", transform);
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [bust]);

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

  const svg = (
    <svg
      viewBox={bust ? "57 10 86 88" : "0 0 200 240"}
      width={bust ? size : 170}
      height={bust ? size : 225}
      className={bust ? styles.bust : undefined}
      aria-hidden="true"
    >
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
        <path className={styles.brow} d={em.brows[0]} stroke="var(--holo-a)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path className={styles.brow} d={em.brows[1]} stroke="var(--holo-a)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
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
          d={em.mouth}
          fill={`url(#${ids.holoGrad})`}
          opacity={mood === "habla" ? 0 : 0.95}
        />
        {/* ecualizador de voz (reemplaza la boca solo al hablar) */}
        <g className={`${styles.voice} ${mood === "habla" ? styles.voiceOn : ""}`} fill="var(--holo-a)">
          <rect x="91" y="73" width="2.8" height="10" rx="1.4" />
          <rect x="96.4" y="73" width="2.8" height="10" rx="1.4" />
          <rect x="101.8" y="73" width="2.8" height="10" rx="1.4" />
          <rect x="107.2" y="73" width="2.8" height="10" rx="1.4" />
        </g>
      </g>

      {/* puntitos de análisis */}
      {!bust && (
        <g className={`${styles.think} ${mood === "analiza" ? styles.thinkOn : ""}`} fill="var(--holo-b)">
          <circle cx="100" cy="16" r="2.4" />
          <circle cx="100" cy="16" r="2" />
          <circle cx="100" cy="16" r="1.6" />
        </g>
      )}
    </svg>
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className ?? ""}`}
      style={{ width: size, height: size, "--state-glow": em.glow } as CSSProperties}
      role="img"
      aria-label={label ?? "Isabella"}
    >
      {bust ? (
        svg
      ) : (
        <div
          className={styles.scaler}
          style={{ transform: `translateX(-50%) scale(${size / 250})` }}
        >
          {stage && <div className={styles.cone} />}
          {stage && (
            <div className={styles.base}>
              <div className={styles.disc} />
              <div className={styles.ring} />
              <div className={styles.ring} />
            </div>
          )}
          <div className={styles.figure}>{svg}</div>
        </div>
      )}
    </div>
  );
}
