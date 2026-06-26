// ============================================================================
// ProjectOps360° — AI Workforce™ — Presence layer contract (DECOUPLED)
// ============================================================================
// The presentation layer is fully decoupled from Knowledge OS. Retrieval,
// confidence, provenance and Project Memory MUST NEVER import this file, and
// this file MUST NEVER import them.
//
// `PresenceState` is the only language the experience speaks to a renderer.
// Today the default renderer is an animated SVG executive avatar. Tomorrow a
// Lottie / Live2D / Three.js / Ready Player Me / MetaHuman renderer can register
// under the same contract and be swapped via `<IsabellaPresence renderer=…>`
// WITHOUT changing the conversation engine or the stage.
// ============================================================================

import type { ComponentType } from "react";

/** What the avatar is doing right now. Drives all micro-interactions. */
export type PresenceState =
  | "idle" // present, breathing, occasional blink
  | "greeting" // warm entrance / acknowledgement
  | "listening" // the user is typing / mic open
  | "thinking" // a request is in flight
  | "speaking"; // delivering an answer

/** Renderer kinds the architecture is designed to host. Only `svg` ships now. */
export type PresenceRendererKind =
  | "svg"
  | "lottie"
  | "live2d"
  | "three"
  | "rpm" // Ready Player Me
  | "metahuman"
  | "video";

export interface PresenceProps {
  state: PresenceState;
  /** Square render size in px. */
  size?: number;
  /** Persona accent color (hex). */
  accent?: string;
  /** Persona monogram fallback (e.g. "I"). */
  initial?: string;
  /** Persona display name, for a11y labelling. */
  name?: string;
  /** Disable looping animation (honored automatically for reduced-motion). */
  reducedMotion?: boolean;
  className?: string;
}

export type PresenceRenderer = ComponentType<PresenceProps>;
