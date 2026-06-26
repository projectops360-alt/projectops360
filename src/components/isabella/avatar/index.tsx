"use client";

// ============================================================================
// Isabella — Presence renderer registry
// ============================================================================
// `IsabellaPresence` selects a renderer by kind. Today only the SVG renderer is
// implemented; Lottie / Live2D / Three.js / Ready Player Me / MetaHuman / video
// can each register here later under the same `PresenceProps` contract — the
// stage and conversation engine never change. THIS is the only seam future
// holographic work needs.
// ============================================================================

import type { PresenceProps, PresenceRenderer, PresenceRendererKind } from "./presence";
import { SvgAvatar } from "./svg-avatar";

export type { PresenceProps, PresenceState, PresenceRendererKind } from "./presence";
export { SvgAvatar } from "./svg-avatar";

/**
 * Renderer registry. Unimplemented kinds intentionally fall back to the SVG
 * renderer so a future flag flip never produces a blank stage.
 */
const RENDERERS: Partial<Record<PresenceRendererKind, PresenceRenderer>> = {
  svg: SvgAvatar,
};

export function IsabellaPresence({
  renderer = "svg",
  ...props
}: PresenceProps & { renderer?: PresenceRendererKind }) {
  const Renderer = RENDERERS[renderer] ?? SvgAvatar;
  return <Renderer {...props} />;
}
