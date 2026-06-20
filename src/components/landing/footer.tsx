"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

const LINKS = ["nav.features", "nav.methodology", "nav.teams", "nav.pricing", "footer.privacy"] as const;

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-white/[0.06] bg-[#07120D] px-6 py-[54px] md:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6">
        <Image src="/logo-full.png" alt="ProjectOps 360°" width={2953} height={1024} className="h-11 w-auto brightness-0 invert" />
        <div className="flex flex-wrap gap-x-[30px] gap-y-2 text-[14px] font-semibold text-[#7E9389]">
          {LINKS.map((k) => (
            <a key={k} href="#" className="transition-colors hover:text-white">
              {t(k)}
            </a>
          ))}
        </div>
        <div className="text-[13px] text-[#5E7269]">{t("footer.copyright")}</div>
      </div>
    </footer>
  );
}
