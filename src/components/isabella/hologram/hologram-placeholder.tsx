"use client";

// ============================================================================
// Isabella — holographic placeholder
// ============================================================================
// A premium holographic projector base + light column that stands in for the
// real-time 3D figure (Ready Player Me + Mixamo, rendered with React Three
// Fiber) which drops into this exact area next. It is deliberately NOT the old
// SVG portrait — that prototype is discarded. It reads as "3D presence coming
// online", reacting to the same PresenceState the 3D character will use.
// ============================================================================

import type { PresenceState } from "../avatar";
import styles from "./hologram-placeholder.module.css";

export function HologramPlaceholder({
  state = "idle",
  size = 150,
  accent = "#7c3aed",
  label,
}: {
  state?: PresenceState;
  size?: number;
  accent?: string;
  label?: string;
}) {
  const core = Math.round(size * 0.34);
  const speaking = state === "speaking";
  const thinking = state === "thinking";

  return (
    <div className={styles.stage} style={{ width: size, height: size }} aria-label={label ?? "Isabella"}>
      <div className={styles.column} style={{ opacity: speaking ? 0.95 : undefined }} />

      {/* Base projector rings */}
      <div className={`${styles.ring} ${styles.ringOuter}`} style={{ width: size * 0.86, height: size * 0.28, bottom: "8%" }} />
      <div className={`${styles.ring} ${styles.ringInner}`} style={{ width: size * 0.6, height: size * 0.2, bottom: "12%" }} />

      {/* Rising scan particles */}
      {[0, 1, 2, 3].map((p) => (
        <span
          key={p}
          className={styles.particle}
          style={{ left: `${38 + p * 8}%`, bottom: "22%", animationDelay: `${p * 0.5}s` }}
        />
      ))}

      {/* Presence core */}
      <div
        className={styles.core}
        style={{
          width: core,
          height: core,
          marginBottom: size * 0.12,
          background: `radial-gradient(circle at 35% 30%, ${accent}f2, ${accent}d9 55%, #312e81e6)`,
          animationDuration: thinking ? "2.2s" : speaking ? "2.6s" : undefined,
        }}
      >
        <span style={{ fontSize: Math.round(core * 0.42), fontWeight: 700, color: "white" }}>I</span>
      </div>
    </div>
  );
}
