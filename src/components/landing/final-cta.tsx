"use client";

import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  const { t } = useTranslation();
  return (
    <section id="cta" className="bg-white">
      <div className="mx-auto max-w-[1180px] px-6 py-[84px]">
        <div
          className="flex flex-col items-start justify-between gap-8 rounded-3xl px-8 py-12 md:flex-row md:items-center md:px-14"
          style={{ background: "linear-gradient(135deg, #1B4D3D, #26715b)" }}
        >
          <div className="max-w-[620px]">
            <div className="lp-head mb-3 text-[13px] font-semibold uppercase tracking-[.12em] text-[#5fd3c0]">
              {t("cta.eyebrow")}
            </div>
            <h2 className="lp-head text-[clamp(26px,3.2vw,38px)] leading-[1.12] tracking-[-.025em] text-white">
              {t("cta.title")}
            </h2>
            <p className="mt-4 max-w-[520px] text-[16px] leading-[1.6] text-[#c6ddd5]">{t("cta.desc")}</p>
          </div>
          <a
            href="#"
            className="inline-flex min-h-[54px] flex-shrink-0 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-[#1B4D3D] transition-transform hover:scale-[1.02]"
          >
            {t("cta.button")}
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
