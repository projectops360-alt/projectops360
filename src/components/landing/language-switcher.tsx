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
    <div className="inline-flex rounded-full border border-[#e2e8e1] bg-white p-[3px] text-[13px] font-bold">
      {LANDING_LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => set(lang)}
          aria-pressed={current === lang}
          className={`rounded-full px-3 py-[5px] uppercase transition-colors ${
            current === lang ? "bg-[#007a4d] text-white" : "text-[#5f6b66] hover:text-[#07130f]"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
