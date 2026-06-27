"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sun, Moon } from "lucide-react";
import { getStoredTheme, resolveTheme, setStoredTheme } from "@/lib/theme";

/** One-click light/dark toggle in the header. Reuses the persisted theme system
 *  (localStorage + .dark on <html>); the full light/dark/system picker still
 *  lives in Settings. */
export function ThemeToggle() {
  const t = useTranslations("auth.userMenu");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setMode(resolveTheme(getStoredTheme()));
      setMounted(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    setStoredTheme(next);
  }

  // Avoid hydration mismatch: render a neutral button until mounted.
  const isDark = mounted && mode === "dark";
  const label = isDark ? t("themeLight") : t("themeDark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
