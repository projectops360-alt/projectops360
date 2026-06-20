"use client";

import { useTranslation } from "react-i18next";
import { LandingNav } from "./nav";
import { ExecutionMap } from "./execution-map";
import { LogosStrip } from "./logos-strip";
import { Reveal } from "./reveal";
import { useAuthPaths } from "./auth-links";

export function Hero() {
  const { t } = useTranslation();
  const auth = useAuthPaths();
  return (
    <section className="relative overflow-hidden bg-[#07120D]">
      {/* decorative layers */}
      <div className="lp-grid-overlay lp-anim-grid pointer-events-none absolute inset-0" />
      <div
        className="lp-anim-glow pointer-events-none absolute left-1/2 top-[-160px] h-[580px] w-[900px] -translate-x-1/2 blur-[34px]"
        style={{ background: "radial-gradient(ellipse, rgba(31,181,135,.38), transparent 64%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 60%, #07120D)" }}
      />

      <LandingNav />

      {/* hero copy */}
      <div className="relative mx-auto max-w-[1100px] px-6 pt-[70px] text-center md:px-10">
        <Reveal index={0} className="mb-[34px] inline-flex items-center gap-[9px] rounded-full border border-[#3CE5A4]/30 bg-[#3CE5A4]/10 px-4 py-2 text-[13.5px] font-bold text-[#3CE5A4]">
          <span className="lp-anim-dot h-2 w-2 rounded-full bg-[#3CE5A4]" />
          {t("hero.badge")}
        </Reveal>

        <Reveal index={1}>
          <h1 className="lp-display m-0 mb-7 text-[clamp(40px,8vw,82px)] font-extrabold leading-[0.96] tracking-[-.03em] text-white">
            {t("hero.title1")}
            <br />
            {t("hero.title2")}
            <br />
            <span className="lp-grad-text">
              {t("hero.titleAccent1")}
              <br />
              {t("hero.titleAccent2")}
            </span>
          </h1>
        </Reveal>

        <Reveal index={2}>
          <p className="mx-auto mb-[38px] max-w-[620px] text-[20px] leading-[1.55] text-[#A9BAB1]">
            {t("hero.subhead")}
            <strong className="font-bold text-white">{t("hero.subheadStrong")}</strong>
          </p>
        </Reveal>

        <Reveal index={3} className="flex flex-wrap justify-center gap-[14px]">
          <a
            href={auth.signup}
            className="inline-flex items-center gap-2.5 rounded-full bg-[#3CE5A4] px-[30px] py-[17px] text-[16px] font-extrabold text-[#06231a] shadow-[0_18px_38px_-12px_rgba(60,229,164,.65)] transition-transform hover:-translate-y-0.5"
          >
            {t("hero.ctaPrimary")} <span className="text-[18px]">→</span>
          </a>
          <a
            href="#capabilities"
            className="inline-flex items-center gap-[11px] rounded-full border-[1.5px] border-white/[0.18] px-7 py-[17px] text-[16px] font-bold text-white transition-colors hover:border-white/30 hover:bg-white/[0.06]"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#3CE5A4]/[0.16] text-[10px] text-[#3CE5A4]">▶</span>
            {t("hero.ctaSecondary")}
          </a>
        </Reveal>
      </div>

      {/* wide product mockup */}
      <Reveal index={4} className="relative mx-auto mt-[50px] max-w-[1040px] px-6 md:px-10">
        <ExecutionMap />
      </Reveal>

      <LogosStrip />
    </section>
  );
}
