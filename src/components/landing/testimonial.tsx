"use client";

import { useTranslation } from "react-i18next";
import { Quote } from "lucide-react";

export function Testimonial() {
  const { t } = useTranslation();
  return (
    <section className="bg-[#1B4D3D]">
      <div className="mx-auto max-w-[860px] px-6 py-[84px] text-center">
        <Quote size={40} className="mx-auto mb-6 text-[#34D9A6]" fill="currentColor" stroke="none" />
        <blockquote className="lp-head text-[clamp(22px,3vw,30px)] font-medium leading-[1.4] tracking-[-.02em] text-white">
          {t("testimonial.quote")}
        </blockquote>
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="lp-head flex h-11 w-11 items-center justify-center rounded-full bg-[#2A9D8F] text-[15px] font-bold text-white">
            MR
          </span>
          <div className="text-left">
            <div className="text-[15px] font-semibold text-white">{t("testimonial.name")}</div>
            <div className="text-[13px] text-[#9fc4b8]">{t("testimonial.role")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
