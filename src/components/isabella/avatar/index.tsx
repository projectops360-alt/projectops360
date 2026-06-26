"use client";

// ============================================================================
// Isabella — Presence renderer registry
// ============================================================================
// `IsabellaPresence` selects a renderer by kind. Renderers all speak the same
// `PresenceProps` contract, so the stage + conversation engine never change.
//   • svg  — lightweight 2D fallback (always available, no extra bundle).
//   • r3f  — REAL 3D character (Ready Player Me via React Three Fiber). Lazy-
//            loaded so three.js is fetched only when Isabella's window opens.
// Future Live2D / MetaHuman / video renderers register here the same way.
// ============================================================================

import dynamic from "next/dynamic";
import type { PresenceProps, PresenceRenderer, PresenceRendererKind } from "./presence";
import { SvgAvatar } from "./svg-avatar";

export type { PresenceProps, PresenceState, PresenceRendererKind } from "./presence";
export { SvgAvatar } from "./svg-avatar";

// Lazy 3D renderer — never bundled until actually requested.
const R3fAvatar = dynamic(() => import("./r3f-avatar").then((m) => m.R3fAvatar), {
  ssr: false,
  loading: () => null,
}) as PresenceRenderer;

const RENDERERS: Partial<Record<PresenceRendererKind, PresenceRenderer>> = {
  svg: SvgAvatar,
  three: R3fAvatar,
};

export function IsabellaPresence({
  renderer = "svg",
  ...props
}: PresenceProps & { renderer?: PresenceRendererKind }) {
  const Renderer = RENDERERS[renderer] ?? SvgAvatar;
  return <Renderer {...props} />;
}
