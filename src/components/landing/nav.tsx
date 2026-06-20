"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./language-switcher";

const LINKS = [
  { key: "nav.features", href: "#capabilities" },
  { key: "nav.methodology", href: "#methodology" },
  { key: "nav.teams", href: "#cta" },
  { key: "nav.pricing", href: "#cta" },
] as const;

export function LandingNav() {
  const { t } = useTranslation();
  return (
    <nav className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-6 py-5 md:px-10 md:py-6">
      <a href="#" className="flex items-center" aria-label="ProjectOps 360°">
        <Image src="/logo-3d.webp" alt="ProjectOps 360°" width={1344} height={768} className="h-28 w-auto rounded-2xl md:h-36" priority />
      </a>

      <div className="hidden items-center gap-9 text-[15px] font-semibold text-[#B8C7BF] lg:flex">
        {LINKS.map((l) => (
          <a key={l.key} href={l.href} className="transition-colors hover:text-white">
            {t(l.key)}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3 md:gap-[18px]">
        <LanguageSwitcher />
        <a href="#" className="hidden text-[15px] font-semibold text-[#D6E2DA] transition-colors hover:text-white sm:inline">
          {t("nav.signIn")}
        </a>
        <a
          href="#cta"
          className="inline-flex items-center rounded-full bg-[#3CE5A4] px-[22px] py-3 text-[15px] font-bold text-[#06231a] shadow-[0_10px_24px_-8px_rgba(60,229,164,.6)] transition-transform hover:-translate-y-px"
        >
          {t("nav.requestAccess")}
        </a>
      </div>
    </nav>
  );
}
