"use client";

import { useTranslation } from "react-i18next";
import { Reveal } from "./reveal";

export function FinalCta() {
  const { t } = useTranslation();
  return (
    <section className="bg-[#07120D] px-6 pb-24 md:px-10">
      <Reveal
        id="cta"
        className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[30px] px-8 py-20 text-center md:px-[60px]"
        style={{ background: "linear-gradient(150deg, #0C3A2A, #06231a)" }}
      >
        <div className="lp-grid-overlay-cta pointer-events-none absolute inset-0" />
        <div
          className="lp-anim-glow pointer-events-none absolute bottom-[-160px] left-1/2 h-[400px] w-[700px] -translate-x-1/2 blur-[34px]"
          style={{ background: "radial-gradient(ellipse, rgba(60,229,164,.3), transparent 65%)" }}
        />
        <div className="relative">
          <div className="mb-[26px] inline-flex items-center gap-[9px] rounded-full border border-[#3CE5A4]/30 bg-[#3CE5A4]/[0.12] px-[15px] py-[7px] text-[13px] font-bold text-[#3CE5A4]">
            <span className="lp-anim-dot h-2 w-2 rounded-full bg-[#3CE5A4]" />
            {t("cta.badge")}
          </div>
          <h2 className="lp-display m-0 mb-5 text-[clamp(32px,5vw,54px)] font-extrabold leading-[1.02] tracking-[-.03em] text-white [text-wrap:balance]">
            {t("cta.title1")}
            <br />
            {t("cta.title2")}
          </h2>
          <p className="mx-auto mb-[38px] max-w-[520px] text-[18px] leading-[1.55] text-[#A9BAB1]">{t("cta.desc")}</p>
          <div className="flex flex-wrap justify-center gap-[14px]">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-full bg-[#3CE5A4] px-8 py-[17px] text-[16px] font-extrabold text-[#06231a] shadow-[0_18px_38px_-12px_rgba(60,229,164,.6)] transition-transform hover:-translate-y-0.5"
            >
              {t("cta.primary")} <span className="text-[18px]">→</span>
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-full border-[1.5px] border-white/20 px-7 py-[17px] text-[16px] font-bold text-white transition-colors hover:bg-white/[0.06]"
            >
              {t("cta.secondary")}
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
