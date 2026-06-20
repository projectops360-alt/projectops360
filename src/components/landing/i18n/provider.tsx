"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { LANDING_LANG_KEY, LANDING_LANGS, type LandingLang } from "./config";

/** Resolve the initial landing language from localStorage, then the browser. */
function resolveInitialLang(): LandingLang {
  try {
    const saved = localStorage.getItem(LANDING_LANG_KEY) as LandingLang | null;
    if (saved && (LANDING_LANGS as readonly string[]).includes(saved)) return saved;
  } catch {
    /* localStorage unavailable */
  }
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")) return "es";
  return "en";
}

export function LandingI18nProvider({ children }: { children: React.ReactNode }) {
  // Apply the persisted/detected language after hydration so the first client
  // render still matches the server's `en` output.
  useEffect(() => {
    const lang = resolveInitialLang();
    if (lang !== i18n.language) void i18n.changeLanguage(lang);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
