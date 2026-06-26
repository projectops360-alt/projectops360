"use client";

// ============================================================================
// Isabella — default presence renderer: animated SVG executive portrait
// ============================================================================
// Stage-1 asset for the "Executive Minimal" direction in
// docs/isabella-character-bible.md. An ORIGINAL, stylized executive portrait —
// deliberately NOT a photorealistic recreation of any reference photo, and not a
// generic/cartoon avatar. Refined proportions, composed warmth, navy tailoring,
// a single violet accent + soft rim light (holographic-friendly). All motion is
// CSS (transform/opacity only) and pauses under reduced-motion. This is the ONLY
// place that knows what Isabella looks like.
// ============================================================================

import { useId } from "react";
import type { PresenceProps } from "./presence";
import styles from "./svg-avatar.module.css";

const STATE_CLASS: Record<string, string> = {
  idle: styles.idle,
  greeting: styles.greeting,
  listening: styles.listening,
  thinking: styles.thinking,
  speaking: styles.speaking,
};

export function SvgAvatar({
  state = "idle",
  size = 160,
  accent = "#7c3aed",
  name = "Isabella",
  className,
}: PresenceProps) {
  const uid = useId().replace(/[:]/g, "");
  const auraId = `aura-${uid}`;
  const skinId = `skin-${uid}`;
  const hairId = `hair-${uid}`;
  const blazerId = `blazer-${uid}`;
  const blouseId = `blouse-${uid}`;
  const rimId = `rim-${uid}`;

  return (
    <svg
      role="img"
      aria-label={name}
      viewBox="0 0 200 210"
      width={size}
      height={size * (210 / 200)}
      className={`${styles.root} ${STATE_CLASS[state] ?? ""} ${className ?? ""}`}
    >
      <defs>
        <radialGradient id={auraId} cx="50%" cy="34%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.14" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={skinId} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#f7ddc9" />
          <stop offset="100%" stopColor="#eab896" />
        </linearGradient>
        <linearGradient id={hairId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#4a352b" />
          <stop offset="55%" stopColor="#2c1d15" />
          <stop offset="100%" stopColor="#1c120c" />
        </linearGradient>
        <linearGradient id={blazerId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2950" />
          <stop offset="100%" stopColor="#191730" />
        </linearGradient>
        <linearGradient id={blouseId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f3fb" />
          <stop offset="100%" stopColor="#d9d7ea" />
        </linearGradient>
        <linearGradient id={rimId} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Aura + listening ring */}
      <circle className={styles.aura} cx="100" cy="92" r="92" fill={`url(#${auraId})`} />
      <circle className={styles.ring} cx="100" cy="96" r="86" fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth="1.5" />

      {/* Thinking shimmer */}
      <g>
        <circle className={`${styles.thoughtDot} ${styles.thoughtDot1}`} cx="150" cy="44" r="2.6" fill={accent} />
        <circle className={`${styles.thoughtDot} ${styles.thoughtDot2}`} cx="161" cy="34" r="3.4" fill={accent} />
        <circle className={`${styles.thoughtDot} ${styles.thoughtDot3}`} cx="173" cy="25" r="4.4" fill={accent} />
      </g>

      <g className={styles.figure}>
        {/* ── Shoulders / tailored blazer ─────────────────────────────── */}
        <path d="M34 206 C36 168 58 150 100 150 C142 150 164 168 166 206 Z" fill={`url(#${blazerId})`} />
        {/* Blouse / open neckline */}
        <path d="M84 152 C88 176 112 176 116 152 C112 150 88 150 84 152 Z" fill={`url(#${blouseId})`} />
        {/* Notch lapels */}
        <path d="M84 152 L100 182 L80 164 Z" fill="#15132a" />
        <path d="M116 152 L100 182 L120 164 Z" fill="#15132a" />
        <path d="M84 152 L100 182 L100 156 Z" fill="#211e3e" opacity="0.7" />
        <path d="M116 152 L100 182 L100 156 Z" fill="#211e3e" opacity="0.7" />
        {/* P360 violet lapel pin */}
        <circle cx="113" cy="168" r="3.1" fill={accent} />
        <circle cx="113" cy="168" r="1.2" fill="#fff" opacity="0.85" />

        {/* ── Hair (back mass — sleek, behind shoulders) ──────────────── */}
        <path d="M56 96 C54 56 72 34 100 34 C128 34 146 56 144 96 C144 124 140 144 134 158 C132 150 130 130 129 118 L129 92 C129 70 118 60 100 60 C82 60 71 70 71 92 L71 118 C70 130 68 150 66 158 C60 144 56 124 56 96 Z" fill={`url(#${hairId})`} />

        {/* Neck */}
        <path d="M90 128 C90 142 94 150 100 150 C106 150 110 142 110 128 Z" fill={`url(#${skinId})`} />
        <path d="M90 130 C94 141 106 141 110 130 L110 137 C106 145 94 145 90 137 Z" fill="#d89e7c" opacity="0.55" />

        <g className={styles.head}>
          {/* Face — refined, gently tapered oval (not round) */}
          <path d="M73 86 C73 60 85 47 100 47 C115 47 127 60 127 86 C127 104 119 120 108 128 C104 131 96 131 92 128 C81 120 73 104 73 86 Z" fill={`url(#${skinId})`} />
          {/* Soft jaw/cheek contour + holographic violet rim on one side */}
          <path d="M124 84 C126 102 118 120 108 127 C116 116 121 100 121 84 Z" fill={accent} opacity="0.10" />
          <path d="M127 70 C129 84 127 104 116 122 C124 104 125 86 124 72 Z" fill={`url(#${rimId})`} opacity="0.5" />
          <ellipse cx="84" cy="98" rx="6" ry="4.2" fill="#e89a78" opacity="0.4" />
          <ellipse cx="116" cy="98" rx="6" ry="4.2" fill="#e89a78" opacity="0.4" />

          {/* Hair front — sleek side part framing the face */}
          <path d="M72 88 C70 62 83 48 100 48 C112 48 122 55 126 70 C120 58 110 54 99 56 C88 58 80 66 76 80 C74 84 73 86 72 96 Z" fill={`url(#${hairId})`} />
          <path d="M126 70 C128 60 127 54 122 50 C129 58 130 74 129 92 C128 84 127 76 126 70 Z" fill={`url(#${hairId})`} />
          <path d="M72 90 C71 78 73 66 80 58 C74 70 73 80 73 96 Z" fill={`url(#${hairId})`} />

          {/* Brows */}
          <g className={styles.brow}>
            <path d="M81 82 Q89 78.5 96 81.5" stroke="#33241c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M104 81.5 Q111 78.5 119 82" stroke="#33241c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>

          {/* Eyes — almond, single catchlight */}
          <g>
            <path d="M81 91 Q88 86 95 91 Q88 95 81 91 Z" fill="#ffffff" />
            <path d="M105 91 Q112 86 119 91 Q112 95 105 91 Z" fill="#ffffff" />
            <g className={styles.gaze}>
              <circle cx="88" cy="91" r="2.9" fill="#4a342a" />
              <circle cx="112" cy="91" r="2.9" fill="#4a342a" />
              <circle cx="88" cy="91" r="1.3" fill="#241712" />
              <circle cx="112" cy="91" r="1.3" fill="#241712" />
              <circle cx="89" cy="89.8" r="0.9" fill="#fff" />
              <circle cx="113" cy="89.8" r="0.9" fill="#fff" />
            </g>
            {/* Upper lid line */}
            <path d="M81 90.5 Q88 85.5 95 90.5" stroke="#5a4030" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M105 90.5 Q112 85.5 119 90.5" stroke="#5a4030" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6" />
            {/* Blink lids */}
            <path className={`${styles.lid} ${styles.lidLeft}`} d="M80 91 a8 5 0 0 1 16 0 Z" fill={`url(#${skinId})`} />
            <path className={`${styles.lid} ${styles.lidRight}`} d="M104 91 a8 5 0 0 1 16 0 Z" fill={`url(#${skinId})`} />
          </g>

          {/* Nose — subtle */}
          <path d="M100 96 L97.5 107 Q100 109 102.5 107 Z" fill="#dca683" opacity="0.6" />
          <path d="M97.5 107 Q100 108.6 102.5 107" stroke="#cf9676" strokeWidth="0.8" fill="none" opacity="0.5" />

          {/* Mouth — composed warm smile */}
          <path className={styles.mouth} d="M91 115 Q100 121 109 115 Q100 118.5 91 115 Z" fill="#bb6178" />
          <path d="M91 115 Q100 117 109 115" stroke="#9c4d63" strokeWidth="0.7" fill="none" opacity="0.6" />

          {/* Earrings — violet accent */}
          <circle cx="74" cy="112" r="2" fill={accent} />
          <circle cx="126" cy="112" r="2" fill={accent} />
        </g>
      </g>

      {/* Subtle ground reflection / holographic base hint */}
      <ellipse cx="100" cy="204" rx="64" ry="7" fill={accent} opacity="0.16">
        <animate attributeName="opacity" values="0.10;0.22;0.10" dur="4.6s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}
