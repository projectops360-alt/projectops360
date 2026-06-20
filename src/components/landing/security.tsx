"use client";

import { useTranslation } from "react-i18next";
import { Check, ShieldCheck } from "lucide-react";

export function Security() {
  const { t } = useTranslation();
  const badges = t("security.badges", { returnObjects: true }) as string[];
  return (
    <section className="border-b border-[#eef2f3] bg-[#f7faf9]">
      <div className="mx-auto flex max-w-[1800px] flex-col items-start justify-between gap-8 px-6 py-[64px] md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#ecf6f4] text-[#2A9D8F]">
            <ShieldCheck size={24} strokeWidth={1.7} />
          </span>
          <div>
            <h2 className="lp-head text-[22px] tracking-[-.02em] text-[#1B4D3D]">{t("security.title")}</h2>
            <p className="mt-1.5 max-w-[460px] text-[15px] leading-[1.6] text-[#5b6e6e]">{t("security.desc")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {badges.map((b) => (
            <div key={b} className="flex items-center gap-2 text-[14px] font-medium text-[#16302a]">
              <Check size={16} className="flex-shrink-0 text-[#2A9D8F]" strokeWidth={2.4} />
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
