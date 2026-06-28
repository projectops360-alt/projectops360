"use client";

import { useTranslation } from "react-i18next";
import { LandingNav } from "./nav";
import { AnimatedHeroGraph } from "./animated-hero-graph";
import { LogosStrip } from "./logos-strip";
import { Reveal } from "./reveal";
import { useAuthPaths } from "./auth-links";

export function Hero() {
  const { t } = useTranslation();
  const auth = useAuthPaths();
  return (
    <section className="relative overflow-hidden">
      {/* soft decorative layers (light) */}
      <div className="lp-grid-overlay lp-anim-grid pointer-events-none absolute inset-0 opacity-60" />
      <div
        className="lp-anim-glow pointer-events-none absolute left-1/2 top-[-180px] h-[560px] w-[920px] -translate-x-1/2 blur-[40px]"
        style={{ background: "radial-gradient(ellipse, rgba(0,122,77,.12), transparent 64%)" }}
      />

      <LandingNav />

      {/* hero copy */}
      <div className="relative mx-auto max-w-[1100px] px-6 pt-[60px] text-center md:px-10">
        <Reveal index={0} className="mb-[30px] inline-flex items-center gap-[9px] rounded-full border border-[#c8ead8] bg-[#e7f5ee] px-4 py-2 text-[12.5px] font-extrabold uppercase tracking-[.1em] text-[#064e3b]">
          <span className="lp-anim-dot h-[7px] w-[7px] rounded-full bg-[#007a4d]" />
          {t("hero.badge")}
        </Reveal>

        <Reveal index={1}>
          <h1 className="lp-display m-0 mb-7 text-[clamp(40px,8vw,80px)] font-extrabold leading-[0.97] tracking-[-.04em] text-[#07130f]">
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
          <p className="mx-auto mb-[36px] max-w-[660px] text-[19px] leading-[1.6] text-[#5f6b66]">
            {t("hero.subhead")}
            <strong className="font-bold text-[#07130f]">{t("hero.subheadStrong")}</strong>
          </p>
        </Reveal>

        <Reveal index={3} className="mb-12 flex flex-wrap justify-center gap-[14px]">
          <a
            href={auth.signup}
            className="inline-flex items-center gap-2.5 rounded-full bg-[#007a4d] px-[30px] py-[16px] text-[16px] font-extrabold text-white shadow-[0_16px_34px_-12px_rgba(0,122,77,.6)] transition-transform hover:-translate-y-0.5"
          >
            {t("hero.ctaPrimary")} <span className="text-[18px]">→</span>
          </a>
          <a
            href="#capabilities"
            className="inline-flex items-center gap-[11px] rounded-full border-[1.5px] border-[#bcd8cb] bg-white px-7 py-[16px] text-[16px] font-bold text-[#07130f] shadow-[0_8px_22px_-12px_rgba(7,19,15,.18)] transition-colors hover:border-[#007a4d]/40"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f5ee] text-[10px] text-[#007a4d]">▶</span>
            {t("hero.ctaSecondary")}
          </a>
        </Reveal>
      </div>

      {/* animated Living Graph preview (no static image) */}
      <Reveal index={4} className="relative mx-auto max-w-[1120px] px-6 md:px-10">
        <AnimatedHeroGraph />
      </Reveal>

      <LogosStrip />
    </section>
  );
}
