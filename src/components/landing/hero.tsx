"use client";

import Image from "next/image";
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
      <div className="relative min-h-[100svh] overflow-hidden">
        <Image
          src="/landing/projectops360-network-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="pointer-events-none object-cover object-[62%_center] sm:object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.28)_0%,rgba(255,255,255,.5)_64%,#f7f8f4_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.94)_0%,rgba(255,255,255,.68)_38%,transparent_72%)] lg:bg-[radial-gradient(ellipse_at_30%_50%,rgba(255,255,255,.96)_0%,rgba(255,255,255,.72)_38%,transparent_70%)]" />

        <LandingNav />

        <div className="relative mx-auto flex min-h-[calc(100svh-82px)] max-w-[1240px] flex-col justify-center px-6 pb-20 text-center md:px-10 lg:items-start lg:text-left">
          <Reveal index={0} className="mb-[30px] inline-flex self-center items-center gap-[9px] rounded-full border border-[#c8ead8] bg-white/80 px-4 py-2 text-[12.5px] font-extrabold uppercase tracking-[.1em] text-[#064e3b] shadow-sm backdrop-blur-md lg:self-start">
            <span className="lp-anim-dot h-[7px] w-[7px] rounded-full bg-[#007a4d]" />
            {t("hero.badge")}
          </Reveal>

          <Reveal index={1}>
            <h1 className="lp-display m-0 mb-7 max-w-[760px] text-[clamp(40px,8vw,80px)] font-extrabold leading-[0.97] tracking-[-.04em] text-[#07130f] lg:text-[clamp(52px,5vw,76px)]">
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
            <p className="mx-auto mb-[36px] max-w-[660px] text-[19px] leading-[1.6] text-[#4f5f58] lg:mx-0">
              {t("hero.subhead")}
              <strong className="font-bold text-[#07130f]">{t("hero.subheadStrong")}</strong>
            </p>
          </Reveal>

          <Reveal index={3} className="flex flex-wrap justify-center gap-[14px] lg:justify-start">
            <a
              href={auth.signup}
              className="inline-flex items-center gap-2.5 rounded-full bg-[#007a4d] px-[30px] py-[16px] text-[16px] font-extrabold text-white shadow-[0_16px_34px_-12px_rgba(0,122,77,.6)] transition-transform hover:-translate-y-0.5"
            >
              {t("hero.ctaPrimary")} <span className="text-[18px]">→</span>
            </a>
            <a
              href="#capabilities"
              className="inline-flex items-center gap-[11px] rounded-full border-[1.5px] border-[#bcd8cb] bg-white/90 px-7 py-[16px] text-[16px] font-bold text-[#07130f] shadow-[0_8px_22px_-12px_rgba(7,19,15,.18)] backdrop-blur-sm transition-colors hover:border-[#007a4d]/40"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f5ee] text-[10px] text-[#007a4d]">▶</span>
              {t("hero.ctaSecondary")}
            </a>
          </Reveal>
        </div>
      </div>

      <Reveal index={4} className="relative mx-auto max-w-[1120px] px-6 md:px-10">
        <AnimatedHeroGraph />
      </Reveal>

      <LogosStrip />
    </section>
  );
}
