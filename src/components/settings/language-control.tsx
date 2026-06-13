"use client";

import { useLocale } from "next-intl";
import { Check } from "lucide-react";
import { routing } from "@/i18n/routing";
import { buildLocaleSwitchPath } from "@/i18n/switch-path";

const LOCALES = [
  { code: "en" as const, label: "English", native: "English" },
  { code: "es" as const, label: "Spanish", native: "Español" },
];

/** Persist the locale and hard-navigate to the localized URL. Module-scope so
 *  the side effects are plain DOM work, not flagged as in-render mutations. */
function applyLocale(newLocale: "en" | "es") {
  if (typeof window === "undefined") return;
  const target = buildLocaleSwitchPath(
    window.location.pathname,
    newLocale,
    routing.locales,
    routing.defaultLocale,
  );
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; samesite=lax`;
  window.location.assign(`${target}${window.location.search}${window.location.hash}`);
}

export function LanguageControl() {
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {LOCALES.map(({ code, native }) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => !active && applyLocale(code)}
            aria-pressed={active}
            className={`inline-flex min-w-[8rem] items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300"
                : "border-border text-foreground hover:border-brand-400 hover:bg-muted/40"
            }`}
          >
            {native}
            {active && <Check className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}
