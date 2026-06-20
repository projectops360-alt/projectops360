"use client";

import { useTranslation } from "react-i18next";
import { LandingLogo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";

const LINKS = [
  { key: "nav.features", href: "#features" },
  { key: "nav.methodology", href: "#workflow" },
  { key: "nav.teams", href: "#teams" },
  { key: "nav.pricing", href: "#pricing" },
] as const;

export function LandingNav() {
  const { t } = useTranslation();
  return (
    <nav className="sticky top-0 z-50 border-b border-[#e8eef0] bg-white/[0.86] backdrop-blur-[10px]">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-[13px]">
        <a href="#" className="flex items-center" aria-label="Project Ops 360°">
          <LandingLogo className="h-8 w-auto" />
        </a>

        <div className="hidden items-center gap-[30px] text-[14.5px] font-medium text-[#5b6e6e] md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[#16302a]">
              {t(l.key)}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <a
            href="#"
            className="hidden min-h-[42px] items-center px-4 text-sm font-semibold text-[#5b6e6e] transition-colors hover:text-[#16302a] sm:inline-flex"
          >
            {t("nav.signIn")}
          </a>
          <a
            href="#cta"
            className="inline-flex min-h-[42px] items-center rounded-full bg-[#1B4D3D] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#16302a]"
          >
            {t("nav.requestAccess")}
          </a>
        </div>
      </div>
    </nav>
  );
}
