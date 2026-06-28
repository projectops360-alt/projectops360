"use client";

import { useTranslation } from "react-i18next";
import { Reveal } from "./reveal";

const WORDMARKS = ["NorthPeak", "Vela Labs", "Quanta", "Orbital", "Lumen PMO"];

export function LogosStrip() {
  const { t } = useTranslation();
  return (
    <Reveal className="relative mx-auto flex max-w-[1040px] flex-wrap items-center justify-center gap-x-11 gap-y-4 px-6 pb-14 pt-[34px] md:px-10">
      <span className="text-[13px] font-semibold text-[#7b877f]">{t("logos.title")}</span>
      {WORDMARKS.map((w) => (
        <span key={w} className="lp-display whitespace-nowrap text-[19px] font-bold text-[#9aa69f]">
          {w}
        </span>
      ))}
    </Reveal>
  );
}
