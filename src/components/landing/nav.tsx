"use client";

import { useTranslation } from "react-i18next";
import { LogoStage } from "./logo-stage";
import { LanguageSwitcher } from "./language-switcher";
import { useAuthPaths } from "./auth-links";

const LINKS = [
  { key: "nav.features", href: "#capabilities" },
  { key: "nav.methodology", href: "#methodology" },
  { key: "nav.pricing", href: "#pricing" },
] as const;

export function LandingNav() {
  const { t } = useTranslation();
  const auth = useAuthPaths();
  return (
    <nav className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-6 py-5 md:px-10 md:py-6">
      <a href="#" className="flex items-center" aria-label="ProjectOps 360°">
        <LogoStage className="h-16 md:h-[72px]" />
      </a>

      <div className="hidden items-center gap-9 text-[15px] font-semibold text-[#5f6b66] lg:flex">
        {LINKS.map((l) => (
          <a key={l.key} href={l.href} className="transition-colors hover:text-[#007a4d]">
            {t(l.key)}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3 md:gap-[18px]">
        <LanguageSwitcher />
        <a href={auth.login} className="hidden text-[15px] font-semibold text-[#07130f] transition-colors hover:text-[#007a4d] sm:inline">
          {t("nav.signIn")}
        </a>
        <a
          href={auth.signup}
          className="inline-flex items-center rounded-full bg-[#007a4d] px-[22px] py-3 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,122,77,.6)] transition-transform hover:-translate-y-px"
        >
          {t("nav.requestAccess")}
        </a>
      </div>
    </nav>
  );
}
