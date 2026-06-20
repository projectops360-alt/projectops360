"use client";

import { useTranslation } from "react-i18next";
import { Reveal } from "./reveal";

export function Quote() {
  const { t } = useTranslation();
  return (
    <section className="bg-white px-6 py-24 md:px-10">
      <Reveal className="mx-auto max-w-[880px] text-center">
        <p className="lp-display text-[clamp(24px,3.4vw,34px)] font-semibold leading-[1.3] tracking-[-.02em] text-[#10271E] [text-wrap:balance]">
          {t("quote.pre")}
          <span className="text-[#1FB587]">{t("quote.accent")}</span>
          {t("quote.post")}
        </p>
        <div className="mt-8 flex items-center justify-center gap-[13px]">
          <span
            className="lp-display inline-flex h-[46px] w-[46px] items-center justify-center rounded-full font-extrabold text-white"
            style={{ background: "linear-gradient(150deg, #1FB587, #0C3A2A)" }}
          >
            D
          </span>
          <div className="text-left">
            <div className="text-[15px] font-bold text-[#10271E]">{t("quote.name")}</div>
            <div className="text-[14px] text-[#7B877F]">{t("quote.role")}</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
