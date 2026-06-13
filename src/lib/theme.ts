// ============================================================================
// Theme — light / dark / system, persisted in localStorage, applied as a class
// on <html>. The anti-FOUC mirror of this logic lives inline in app/layout.tsx.
// ============================================================================

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "po360.theme";

/** Resolve a theme choice to the concrete mode to apply. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/** Apply a theme to the document root (adds `.light` or `.dark`). */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement.classList;
  root.remove("light", "dark");
  root.add(resolved);
}

/** Read the stored theme choice (defaults to "system"). */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

/** Persist a theme choice and apply it immediately. */
export function setStoredTheme(theme: Theme): void {
  if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
