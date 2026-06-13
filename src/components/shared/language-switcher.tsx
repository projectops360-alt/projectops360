"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { routing } from "@/i18n/routing";
import { buildLocaleSwitchPath } from "@/i18n/switch-path";

const locales = [
  { code: "en" as const, label: "EN" },
  { code: "es" as const, label: "ES" },
];

/** Persist the locale choice and hard-navigate to the localized URL.
 *  Module-scope (outside the component) so the side effects are plain DOM
 *  work, not flagged as in-render mutations. */
function applyLocale(newLocale: "en" | "es") {
  if (typeof window === "undefined") return;
  const target = buildLocaleSwitchPath(
    window.location.pathname,
    newLocale,
    routing.locales,
    routing.defaultLocale,
  );
  // Persist the choice so next-intl honors it on subsequent visits.
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; samesite=lax`;
  // Hard navigation: guarantees a clean resolve regardless of the client
  // router manifest, and avoids next-intl as-needed prefix edge cases.
  window.location.assign(`${target}${window.location.search}${window.location.hash}`);
}

export function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();

  function switchLocale(newLocale: "en" | "es") {
    if (newLocale === locale) return;
    applyLocale(newLocale);
  }

  return (
    <div className="flex items-center gap-1.5" aria-label={t("label")}>
      <Globe className="h-4 w-4 text-sidebar-text" />
      {locales.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            locale === code
              ? "bg-sidebar-active/20 text-sidebar-active"
              : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
          }`}
          aria-current={locale === code ? "true" : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
