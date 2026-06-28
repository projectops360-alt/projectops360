"use client";

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Reveal } from "./reveal";

export function Quote() {
  const { t } = useTranslation();
  const replaces = t("quote.replaces", { returnObjects: true }) as string[];
  return (
    <section className="bg-white px-6 py-24 md:px-10">
      <Reveal className="mx-auto max-w-[880px] text-center">
        <p className="lp-display text-[clamp(24px,3.4vw,34px)] font-semibold leading-[1.3] tracking-[-.02em] text-[#07130f] [text-wrap:balance]">
          {t("quote.pre")}
          <span className="text-[#007a4d]">{t("quote.accent")}</span>
          {t("quote.post")}
        </p>
        <div className="mt-8 flex items-center justify-center gap-[13px]">
          <span
            className="lp-display inline-flex h-[46px] w-[46px] items-center justify-center rounded-full font-extrabold text-white"
            style={{ background: "linear-gradient(150deg, #007a4d, #064e3b)" }}
          >
            D
          </span>
          <div className="text-left">
            <div className="text-[15px] font-bold text-[#07130f]">{t("quote.name")}</div>
            <div className="text-[14px] text-[#7b877f]">{t("quote.role")}</div>
          </div>
        </div>

        {/* What the "four tools" actually are */}
        <div className="mx-auto mt-10 max-w-[680px] border-t border-[#e2e8e1] pt-7">
          <div className="mb-3.5 text-[12px] font-extrabold uppercase tracking-[.14em] text-[#007a4d]">{t("quote.replacesLabel")}</div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {replaces.map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8e1] bg-[#f7f8f4] px-3.5 py-1.5 text-[13px] font-semibold text-[#07130f]">
                <Check size={14} strokeWidth={2.6} className="text-[#007a4d]" />
                {r}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
