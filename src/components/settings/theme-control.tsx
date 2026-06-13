"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { type Theme, getStoredTheme, setStoredTheme, applyTheme } from "@/lib/theme";

interface ThemeControlProps {
  labels: { light: string; dark: string; system: string };
}

const OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export function ThemeControl({ labels }: ThemeControlProps) {
  const [theme, setTheme] = useState<Theme>("system");

  // Read the persisted choice after mount (localStorage is client-only).
  // Deferred so it isn't a synchronous in-effect setState.
  useEffect(() => {
    const id = setTimeout(() => setTheme(getStoredTheme()), 0);
    return () => clearTimeout(id);
  }, []);

  // When on "system", re-apply if the OS preference changes.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    setStoredTheme(next);
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={theme === value}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            theme === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
