"use client";

import { useTranslation } from "react-i18next";
import { LANDING_LANG_KEY, LANDING_LANGS, type LandingLang } from "./i18n/config";

/** EN/ES toggle in the nav (dark pill). Persists the choice to localStorage. */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current: LandingLang = i18n.language?.startsWith("es") ? "es" : "en";

  const set = (lang: LandingLang) => {
    void i18n.changeLanguage(lang);
    try {
      localStorage.setItem(LANDING_LANG_KEY, lang);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="inline-flex rounded-full bg-white/[0.06] p-[3px] text-[13px] font-bold">
      {LANDING_LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => set(lang)}
          aria-pressed={current === lang}
          className={`rounded-full px-3 py-[5px] uppercase transition-colors ${
            current === lang ? "bg-[#3CE5A4] text-[#06231a]" : "text-[#9FB0A6] hover:text-white"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
