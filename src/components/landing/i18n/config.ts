"use client";

// ============================================================================
// Landing-scoped i18next instance (react-i18next). Independent from the app's
// next-intl setup — this powers ONLY the public marketing landing at /landing.
// SSR renders in `en`; the persisted/detected language is applied after mount
// (see provider) so the first client render matches the server (no hydration
// mismatch).
// ============================================================================

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";

export const LANDING_LANGS = ["en", "es"] as const;
export type LandingLang = (typeof LANDING_LANGS)[number];
export const LANDING_LANG_KEY = "po360.landing.lang";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: LANDING_LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    returnObjects: true,
  });
}

export default i18n;
