"use client";

// ============================================================================
// Isabella — default presence renderer: animated SVG executive avatar
// ============================================================================
// An ORIGINAL, stylized executive portrait — deliberately NOT a photorealistic
// recreation of any reference photo. Minimal, corporate, premium. All motion is
// CSS (transform/opacity only) and pauses under reduced-motion. This file is the
// ONLY place that knows what Isabella looks like; swap it for a richer renderer
// without touching the conversation engine.
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
  const rimId = `rim-${uid}`;

  return (
    <svg
      role="img"
      aria-label={name}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`${styles.root} ${STATE_CLASS[state] ?? ""} ${className ?? ""}`}
    >
      <defs>
        <radialGradient id={auraId} cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={skinId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbe7d6" />
          <stop offset="100%" stopColor="#f3cdb2" />
        </linearGradient>
        <linearGradient id={hairId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2a23" />
          <stop offset="100%" stopColor="#21160f" />
        </linearGradient>
        <linearGradient id={blazerId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2746" />
          <stop offset="100%" stopColor="#1c1a33" />
        </linearGradient>
        <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* Aura + frame */}
      <circle className={styles.aura} cx="100" cy="96" r="86" fill={`url(#${auraId})`} />
      <circle className={styles.ring} cx="100" cy="100" r="82" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="2" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={`url(#${rimId})`} strokeOpacity="0.35" strokeWidth="1.5" />

      {/* Thinking shimmer */}
      <g>
        <circle className={`${styles.thoughtDot} ${styles.thoughtDot1}`} cx="138" cy="40" r="3" fill={accent} />
        <circle className={`${styles.thoughtDot} ${styles.thoughtDot2}`} cx="150" cy="30" r="4" fill={accent} />
        <circle className={`${styles.thoughtDot} ${styles.thoughtDot3}`} cx="164" cy="22" r="5" fill={accent} />
      </g>

      {/* Clip the portrait to the circular frame */}
      <clipPath id={`clip-${uid}`}>
        <circle cx="100" cy="100" r="80" />
      </clipPath>

      <g clipPath={`url(#clip-${uid})`}>
        <rect x="20" y="20" width="160" height="160" fill="#0e0d1a" />
        {/* soft floor light */}
        <ellipse cx="100" cy="172" rx="70" ry="26" fill={accent} opacity="0.12" />

        <g className={styles.figure}>
          {/* Shoulders / blazer */}
          <path
            d="M40 188 C44 150 64 132 100 132 C136 132 156 150 160 188 Z"
            fill={`url(#${blazerId})`}
          />
          {/* Blouse / collar V */}
          <path d="M88 134 L100 158 L112 134 C108 132 92 132 88 134 Z" fill="#e9e6f5" />
          {/* Lapels */}
          <path d="M84 135 L100 160 L86 150 Z" fill="#221f3b" />
          <path d="M116 135 L100 160 L114 150 Z" fill="#221f3b" />

          {/* Neck */}
          <path d="M88 118 C88 132 92 138 100 138 C108 138 112 132 112 118 Z" fill={`url(#${skinId})`} />
          <path d="M88 120 C92 130 108 130 112 120 L112 126 C108 134 92 134 88 126 Z" fill="#e7b899" opacity="0.5" />

          {/* Hair (back) */}
          <path d="M58 96 C58 58 74 40 100 40 C126 40 142 58 142 96 C142 122 138 138 132 150 L128 120 C128 96 120 86 100 86 C80 86 72 96 72 120 L68 150 C62 138 58 122 58 96 Z" fill={`url(#${hairId})`} />

          <g className={styles.head}>
            {/* Face */}
            <ellipse cx="100" cy="92" rx="33" ry="38" fill={`url(#${skinId})`} />
            {/* Cheek warmth */}
            <ellipse cx="83" cy="100" rx="7" ry="5" fill="#f0a98c" opacity="0.45" />
            <ellipse cx="117" cy="100" rx="7" ry="5" fill="#f0a98c" opacity="0.45" />

            {/* Hair (front fringe framing the face) */}
            <path d="M67 86 C66 58 82 44 100 44 C118 44 134 58 133 86 C128 70 118 62 100 62 C90 62 80 66 74 76 C72 80 70 84 67 96 Z" fill={`url(#${hairId})`} />
            <path d="M67 88 C66 74 70 64 78 58 C72 70 70 80 70 96 Z" fill={`url(#${hairId})`} />
            <path d="M133 88 C134 74 130 64 122 58 C128 70 130 80 130 96 Z" fill={`url(#${hairId})`} />

            {/* Brows */}
            <g className={styles.brow}>
              <path d="M80 82 Q88 78 95 82" stroke="#3a2a23" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <path d="M105 82 Q112 78 120 82" stroke="#3a2a23" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </g>

            {/* Eyes */}
            <g>
              <ellipse cx="87" cy="92" rx="7.5" ry="5" fill="#ffffff" />
              <ellipse cx="113" cy="92" rx="7.5" ry="5" fill="#ffffff" />
              <g className={styles.gaze}>
                <circle cx="88" cy="92" r="3.1" fill="#4a342a" />
                <circle cx="114" cy="92" r="3.1" fill="#4a342a" />
                <circle cx="89.1" cy="90.9" r="1" fill="#fff" />
                <circle cx="115.1" cy="90.9" r="1" fill="#fff" />
              </g>
              {/* Eyelids (blink) */}
              <path className={`${styles.lid} ${styles.lidLeft}`} d="M79 92 a8 5 0 0 1 16 0 Z" fill={`url(#${skinId})`} />
              <path className={`${styles.lid} ${styles.lidRight}`} d="M105 92 a8 5 0 0 1 16 0 Z" fill={`url(#${skinId})`} />
            </g>

            {/* Nose */}
            <path d="M100 96 L97 106 Q100 108 103 106 Z" fill="#e7b18f" opacity="0.7" />

            {/* Mouth */}
            <path className={styles.mouth} d="M91 114 Q100 121 109 114 Q100 117 91 114 Z" fill="#c4607a" />

            {/* Earring accent */}
            <circle cx="68" cy="106" r="2.4" fill={accent} />
            <circle cx="132" cy="106" r="2.4" fill={accent} />
          </g>
        </g>
      </g>
    </svg>
  );
}
