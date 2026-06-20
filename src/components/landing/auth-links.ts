"use client";

import { useTranslation } from "react-i18next";

/**
 * Locale-aware paths into the app's auth flow. The landing manages its own
 * EN/ES (react-i18next), so we mirror it onto the next-intl routes: default
 * locale (en) has no prefix, Spanish lives under /es.
 */
export function useAuthPaths() {
  const { i18n } = useTranslation();
  const es = i18n.language?.startsWith("es");
  return {
    login: es ? "/es/login" : "/login",
    signup: es ? "/es/signup" : "/signup",
  };
}
