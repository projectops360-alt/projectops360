// ============================================================================
// Responsive layout tokens — single source of truth for the app shell
// ============================================================================
// The app shell used to hard-code `pl-64` on the content wrapper with no
// breakpoint, so the desktop sidebar kept reserving 256px of a 360px phone
// viewport. Everything downstream (page headers, cards, the Living Graph
// canvas) then had ~100px to lay out in and looked "broken", when the real
// defect was here.
//
// Breakpoints match the Tailwind v4 defaults so the class strings below and
// the numeric helpers can never drift:
//   mobile  : < 768px   → no sidebar gutter; nav lives in a drawer
//   tablet  : 768–1023  → compact (icon-only) sidebar
//   desktop : >= 1024   → sidebar follows the user's collapse preference
// ============================================================================

/** Tailwind's `md` / `lg` breakpoints, in px. Keep in sync with globals.css. */
export const BREAKPOINTS = {
  /** `md:` — tablet and up. */
  tablet: 768,
  /** `lg:` — desktop and up. */
  desktop: 1024,
} as const;

export type ViewportKind = "mobile" | "tablet" | "desktop";

/** Media queries used by `useViewport` — centralised so tests can assert them. */
export const MEDIA_QUERIES = {
  tablet: `(min-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
} as const;

/** Classify a viewport width. Widths below 0 are treated as mobile. */
export function viewportFor(width: number): ViewportKind {
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}

/**
 * Sidebar width in px, by viewport.
 * On mobile the sidebar is an overlay drawer: it floats *above* the content
 * rather than displacing it, so it contributes no width to the layout.
 */
export const SIDEBAR_WIDTH_PX = {
  /** Drawer width when open — it overlays, so it never offsets content. */
  drawer: 256,
  /** Icon-only rail. */
  compact: 64,
  /** Full sidebar with labels. */
  expanded: 256,
} as const;

/**
 * Horizontal space the sidebar steals from the main content, in px.
 * MUST be 0 on mobile — this is the regression the whole fix hinges on.
 */
export function contentOffsetFor(viewport: ViewportKind, collapsed: boolean): number {
  if (viewport === "mobile") return 0;
  if (viewport === "tablet") return SIDEBAR_WIDTH_PX.compact;
  return collapsed ? SIDEBAR_WIDTH_PX.compact : SIDEBAR_WIDTH_PX.expanded;
}

/** Is the sidebar rendered icon-only (no labels) at this viewport? */
export function isRailFor(viewport: ViewportKind, collapsed: boolean): boolean {
  if (viewport === "mobile") return false; // drawer always shows labels
  if (viewport === "tablet") return true; // compact by default
  return collapsed;
}

// ── Tailwind class builders ─────────────────────────────────────────────────
// These are plain strings (no runtime interpolation of Tailwind names) so the
// v4 scanner still sees every class literally.

/** Width of the `<aside>`: full drawer on mobile, rail on tablet, pref on desktop. */
export function sidebarWidthClass(collapsed: boolean): string {
  return collapsed ? "w-64 md:w-16" : "w-64 md:w-16 lg:w-64";
}

/** Left padding of the content wrapper. No gutter below `md`. */
export function contentOffsetClass(collapsed: boolean): string {
  return collapsed ? "md:pl-16" : "md:pl-16 lg:pl-64";
}

/**
 * Visibility of sidebar text labels: shown in the mobile drawer, hidden on the
 * tablet rail, and on desktop they follow the collapse preference. Driven by
 * CSS rather than JS so SSR and hydration agree at every width.
 */
export function sidebarLabelClass(collapsed: boolean): string {
  return collapsed ? "md:hidden" : "md:hidden lg:inline";
}

/** Nav item alignment: labelled rows on mobile/desktop, centred icons on the rail. */
export function sidebarItemLayoutClass(collapsed: boolean): string {
  return collapsed
    ? "justify-start px-3 md:justify-center md:px-2"
    : "justify-start px-3 md:justify-center md:px-2 lg:justify-start lg:px-3";
}

/** Blocks (logo, language switcher) that only make sense when labels show. */
export function sidebarChromeClass(collapsed: boolean): string {
  return collapsed ? "md:hidden" : "md:hidden lg:block";
}

/**
 * Page gutter for the `<main>` element.
 * ~12px on phones, ~16px on tablets, unchanged 24px on desktop.
 */
export const PAGE_PADDING_CLASS = "p-3 sm:p-4 lg:p-6";

/** Horizontal gutter for the global header — tighter on phones. */
export const HEADER_PADDING_CLASS = "px-3 sm:px-4 lg:px-6";
