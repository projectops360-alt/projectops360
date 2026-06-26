"use client";

// ============================================================================
// Living Guide™ — Assistant presentation layer (DECOUPLED from knowledge)
// ============================================================================
// This is the ONLY component that should ever know how the assistant is shown.
// Phase 1 renders a clean animated orb. Later, a `hologram` mode can render a
// 3D avatar / voice / walkthrough here WITHOUT touching retrieval or generation.
// Knowledge retrieval must never import this file.
// ============================================================================

export type AvatarState = "idle" | "thinking" | "speaking";
export type AvatarMode = "orb" | "hologram"; // 'hologram' reserved for a future phase

export function LivingGuideAvatar({
  state = "idle",
  mode = "orb",
  size = 36,
  initial,
  accent,
}: {
  state?: AvatarState;
  mode?: AvatarMode;
  size?: number;
  /** Persona monogram (e.g. "I" for Isabella). Presentation hint only. */
  initial?: string;
  /** Persona accent color (hex). Presentation hint only. */
  accent?: string;
}) {
  // mode is intentionally accepted now so call sites are stable when the
  // immersive presentation layer lands; only 'orb' is implemented in Phase 1.
  void mode;

  const pulse = state === "thinking" ? "animate-ping" : "";
  const glow =
    state === "speaking"
      ? "shadow-[0_0_20px_rgba(99,102,241,0.65)]"
      : "shadow-[0_0_12px_rgba(99,102,241,0.4)]";

  // When a persona accent is given, tint the orb with it; otherwise use the
  // default brand gradient. Either way this is pure presentation.
  const orbStyle = accent
    ? { width: size, height: size, background: `radial-gradient(circle at 30% 25%, ${accent}cc, ${accent} 55%, #1e1b4b)` }
    : { width: size, height: size };
  const orbClass = accent
    ? `relative inline-flex items-center justify-center rounded-full ${glow}`
    : `relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-brand-400 via-brand-500 to-indigo-600 ${glow}`;

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {state === "thinking" && (
        <span className={`absolute inset-0 rounded-full bg-brand-500/40 ${pulse}`} />
      )}
      <span className={orbClass} style={orbStyle}>
        <span className="absolute h-1/3 w-1/3 rounded-full bg-white/70 blur-[1px]" style={{ top: "20%", left: "22%" }} />
        {initial && (
          <span className="relative font-semibold text-white" style={{ fontSize: Math.round(size * 0.42) }}>
            {initial}
          </span>
        )}
      </span>
    </span>
  );
}
