"use client";

import { useTranslation } from "react-i18next";
import { LogoStage } from "./logo-stage";

const LINKS = ["nav.features", "nav.methodology", "nav.pricing", "footer.privacy"] as const;

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-[#e2e8e1] bg-[#f7f8f4] px-6 py-[54px] md:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6">
        <LogoStage className="h-11" />
        <div className="flex flex-wrap gap-x-[30px] gap-y-2 text-[14px] font-semibold text-[#5f6b66]">
          {LINKS.map((k) => (
            <a key={k} href="#" className="transition-colors hover:text-[#007a4d]">
              {t(k)}
            </a>
          ))}
        </div>
        <div className="text-[13px] text-[#7b877f]">{t("footer.copyright")}</div>
      </div>
    </footer>
  );
}
