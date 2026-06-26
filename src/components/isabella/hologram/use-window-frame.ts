"use client";

// ============================================================================
// Isabella — floating window frame (drag · dock · resize · persist)
// ============================================================================
// The user OWNS Isabella: she is a floating, movable, resizable window that
// never blocks the workflow (no full-screen scrim). Position/size/dock/mode are
// remembered. Pointer-based drag + resize with edge-snap docking; everything is
// clamped to the viewport.
//
// Pure presentation state — no knowledge/conversation logic here.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

export type WindowMode = "assistant" | "guide" | "executive";
export type DockSide = "free" | "left" | "right";

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  dock: DockSide;
  mode: WindowMode;
  minimized: boolean;
  fullscreen: boolean;
}

const STORAGE = "isabella.frame.v1";
const MARGIN = 16;
const SNAP = 28;
const MIN_W = 320;
const MIN_H = 380;

/** Size presets per mode (free/floating). */
const MODE_SIZE: Record<WindowMode, { w: number; h: number }> = {
  assistant: { w: 380, h: 600 },
  guide: { w: 400, h: 620 },
  executive: { w: 560, h: 720 },
};

function viewport() {
  if (typeof window === "undefined") return { vw: 1280, vh: 800 };
  return { vw: window.innerWidth, vh: window.innerHeight };
}

function clampFrame(f: Frame): Frame {
  const { vw, vh } = viewport();
  const w = Math.min(Math.max(f.w, MIN_W), vw - MARGIN * 2);
  const h = Math.min(Math.max(f.h, MIN_H), vh - MARGIN * 2);
  const x = Math.min(Math.max(f.x, MARGIN), Math.max(MARGIN, vw - w - MARGIN));
  const y = Math.min(Math.max(f.y, MARGIN), Math.max(MARGIN, vh - h - MARGIN));
  return { ...f, x, y, w, h };
}

function defaultFrame(): Frame {
  const { vw, vh } = viewport();
  const { w, h } = MODE_SIZE.assistant;
  return clampFrame({
    x: vw - w - MARGIN,
    y: vh - h - MARGIN,
    w, h,
    dock: "right",
    mode: "assistant",
    minimized: false,
    fullscreen: false,
  });
}

function load(): Frame {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Frame>;
      return clampFrame({ ...defaultFrame(), ...parsed, fullscreen: false, minimized: false });
    }
  } catch { /* ignore */ }
  return defaultFrame();
}

export interface WindowFrameApi {
  frame: Frame;
  /** Inline style for the floating window (respects dock + fullscreen). */
  style: React.CSSProperties;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  dockTo: (side: DockSide) => void;
  setMode: (mode: WindowMode) => void;
  toggleMinimize: () => void;
  toggleFullscreen: () => void;
  resetPosition: () => void;
  dragging: boolean;
}

export function useWindowFrame(): WindowFrameApi {
  const [frame, setFrame] = useState<Frame>(() => load());
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ sx: number; sy: number; sw: number; sh: number; ox: number } | null>(null);

  // Persist (omit transient fullscreen/minimized so reopen is predictable).
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE, JSON.stringify({ ...frame, fullscreen: false }));
    } catch { /* ignore */ }
  }, [frame]);

  // Keep inside the viewport on resize.
  useEffect(() => {
    const onResize = () => setFrame((f) => clampFrame(f));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (frame.fullscreen) return;
    drag.current = { dx: e.clientX - frame.x, dy: e.clientY - frame.y };
    setDragging(true);
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      setFrame((f) => clampFrame({ ...f, dock: "free", x: ev.clientX - drag.current!.dx, y: ev.clientY - drag.current!.dy }));
    };
    const up = () => {
      drag.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // Edge-snap docking.
      setFrame((f) => {
        const { vw } = viewport();
        if (f.x <= MARGIN + SNAP) return { ...f, dock: "left", x: MARGIN };
        if (f.x + f.w >= vw - MARGIN - SNAP) return { ...f, dock: "right", x: vw - f.w - MARGIN };
        return f;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [frame.x, frame.y, frame.fullscreen]);

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const r = { sx: e.clientX, sy: e.clientY, sw: frame.w, sh: frame.h, ox: frame.x };
    resize.current = r;
    const move = (ev: PointerEvent) => {
      const dw = r.sx - ev.clientX; // resize from bottom-LEFT corner
      const dh = ev.clientY - r.sy;
      setFrame((f) => {
        const w = Math.min(Math.max(r.sw + dw, MIN_W), viewport().vw - MARGIN * 2);
        const h = Math.min(Math.max(r.sh + dh, MIN_H), viewport().vh - MARGIN * 2);
        const x = r.ox + (r.sw - w); // keep right edge fixed
        return clampFrame({ ...f, w, h, x, dock: "free" });
      });
    };
    const up = () => {
      resize.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [frame.w, frame.h, frame.x]);

  const dockTo = useCallback((side: DockSide) => {
    setFrame((f) => {
      const { vw } = viewport();
      if (side === "left") return clampFrame({ ...f, dock: "left", x: MARGIN });
      if (side === "right") return clampFrame({ ...f, dock: "right", x: vw - f.w - MARGIN });
      return { ...f, dock: "free" };
    });
  }, []);

  const setMode = useCallback((mode: WindowMode) => {
    setFrame((f) => {
      const size = MODE_SIZE[mode];
      const next = clampFrame({ ...f, mode, w: size.w, h: size.h, minimized: false });
      // Re-anchor a right-docked window to its edge after a size change.
      if (f.dock === "right") next.x = viewport().vw - next.w - MARGIN;
      return next;
    });
  }, []);

  const toggleMinimize = useCallback(() => setFrame((f) => ({ ...f, minimized: !f.minimized, fullscreen: false })), []);
  const toggleFullscreen = useCallback(() => setFrame((f) => ({ ...f, fullscreen: !f.fullscreen, minimized: false })), []);
  const resetPosition = useCallback(() => setFrame(defaultFrame()), []);

  const style: React.CSSProperties = frame.fullscreen
    ? { position: "fixed", inset: MARGIN, width: "auto", height: "auto", zIndex: 60 }
    : {
        position: "fixed",
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.minimized ? undefined : frame.h,
        zIndex: 60,
      };

  return {
    frame, style, onDragStart, onResizeStart, dockTo, setMode,
    toggleMinimize, toggleFullscreen, resetPosition, dragging,
  };
}
