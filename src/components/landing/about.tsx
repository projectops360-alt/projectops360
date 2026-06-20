"use client";

import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Reveal } from "./reveal";

export function About() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden bg-[#07120D] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 blur-[44px]"
        style={{ background: "radial-gradient(ellipse, rgba(31,181,135,.13), transparent 68%)" }}
      />
      <div className="relative mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        {/* left: title + stat */}
        <Reveal className="self-start lg:sticky lg:top-[90px]">
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#3CE5A4]">{t("about.eyebrow")}</div>
          <h2 className="lp-display m-0 text-[clamp(30px,4.2vw,46px)] font-extrabold leading-[1.05] tracking-[-.025em] text-white [text-wrap:balance]">
            {t("about.title")}
            <span className="lp-grad-text">{t("about.titleAccent")}</span>
          </h2>
          <div className="mt-8 inline-flex flex-col rounded-[20px] border border-[#3CE5A4]/[0.16] bg-white/[0.03] px-7 py-6">
            <span className="lp-display text-[44px] font-extrabold leading-none text-[#3CE5A4]">{t("about.statNumber")}</span>
            <span className="mt-2 max-w-[230px] text-[14px] leading-[1.45] text-[#A9BAB1]">{t("about.statLabel")}</span>
          </div>
        </Reveal>

        {/* right: narrative */}
        <Reveal index={1} className="flex flex-col gap-5 text-[17px] leading-[1.7] text-[#A9BAB1]">
          <p>{t("about.belief")}</p>
          <p>{t("about.team")}</p>
          <p>{t("about.seen")}</p>
          <p className="text-[#D6E2DA]">{t("about.building")}</p>
          <p>{t("about.aiHelps")}</p>
          <div className="mt-1 flex items-center gap-3 rounded-[16px] border border-[#3CE5A4]/20 bg-[#3CE5A4]/[0.06] px-5 py-4">
            <ShieldCheck size={22} strokeWidth={1.9} className="flex-shrink-0 text-[#3CE5A4]" />
            <span className="lp-display text-[19px] font-bold text-white">{t("about.control")}</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
