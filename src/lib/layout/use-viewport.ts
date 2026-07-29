"use client";

import { useEffect, useState } from "react";
import { MEDIA_QUERIES, type ViewportKind } from "@/lib/layout/responsive";

/**
 * Current viewport bucket, kept in sync with `matchMedia`.
 *
 * Returns `"desktop"` during SSR and on the first client render — the same
 * assumption the shell's collapse preference makes — then corrects itself after
 * mount. Layout that must be right *before* hydration (the sidebar gutter, the
 * drawer's off-canvas position) is expressed in CSS via the class builders in
 * `responsive.ts`; this hook is only for behaviour that CSS cannot express,
 * such as trapping focus or locking body scroll while the drawer is open.
 */
export function useViewport(): ViewportKind {
  const [viewport, setViewport] = useState<ViewportKind>("desktop");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const tablet = window.matchMedia(MEDIA_QUERIES.tablet);
    const desktop = window.matchMedia(MEDIA_QUERIES.desktop);

    function sync() {
      setViewport(desktop.matches ? "desktop" : tablet.matches ? "tablet" : "mobile");
    }

    sync();
    tablet.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      tablet.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  return viewport;
}

/** Convenience wrapper: true below the `md` breakpoint (drawer territory). */
export function useIsMobile(): boolean {
  return useViewport() === "mobile";
}
