"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Globe } from "lucide-react";

const locales = [
  { code: "en" as const, label: "EN" },
  { code: "es" as const, label: "ES" },
];

export function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: "en" | "es") {
    router.replace(pathname, { locale: newLocale });
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