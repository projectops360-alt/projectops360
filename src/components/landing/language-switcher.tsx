"use client";

import { useTranslation } from "react-i18next";
import { LANDING_LANG_KEY, LANDING_LANGS, type LandingLang } from "./i18n/config";

/** EN/ES toggle in the nav. Persists the choice to localStorage. */
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
    <div className="inline-flex items-center rounded-full border border-[#e8eef0] p-0.5 text-[11px] font-semibold">
      {LANDING_LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => set(lang)}
          aria-pressed={current === lang}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors ${
            current === lang ? "bg-[#1B4D3D] text-white" : "text-[#5b6e6e] hover:text-[#16302a]"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
