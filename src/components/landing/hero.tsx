"use client";

import { useTranslation } from "react-i18next";
import { ArrowRight, Brain, ClipboardCheck, Play, RefreshCw, type LucideIcon } from "lucide-react";
import { ExecutionMap } from "./execution-map";

const TRUST: { Icon: LucideIcon; title: string; desc: string }[] = [
  { Icon: ClipboardCheck, title: "hero.trust.charterTitle", desc: "hero.trust.charterDesc" },
  { Icon: RefreshCw, title: "hero.trust.frameworkTitle", desc: "hero.trust.frameworkDesc" },
  { Icon: Brain, title: "hero.trust.memoryTitle", desc: "hero.trust.memoryDesc" },
];

export function Hero() {
  const { t } = useTranslation();
  return (
    <section
      id="hero-grid"
      className="mx-auto grid max-w-[1180px] items-center gap-[60px] px-6 pb-14 pt-20 lg:grid-cols-[1fr_1.08fr]"
    >
      <div>
        <div className="mb-6 inline-flex items-center gap-[9px] rounded-full border border-[#2a9d8f]/[0.18] bg-[#ecf6f4] px-3.5 py-[5px] pl-[11px] text-[12.5px] font-semibold text-[#1B4D3D]">
          <span className="lp-anim-pulse h-[7px] w-[7px] rounded-full bg-[#2A9D8F]" />
          {t("hero.badge")}
        </div>

        <h1 className="lp-head mb-[22px] text-[clamp(40px,5vw,62px)] font-bold leading-[1.04] tracking-[-.035em] text-[#1B4D3D]">
          {t("hero.title")}
          <span className="text-[#2A9D8F]">{t("hero.titleAccent")}</span>
        </h1>

        <p className="mb-[30px] max-w-[520px] text-[18px] leading-[1.65] text-[#5b6e6e]">
          {t("hero.lede")}
          <strong className="font-semibold text-[#16302a]">{t("hero.ledeStrong")}</strong>
        </p>

        <div className="mb-10 flex flex-wrap gap-3">
          <a
            href="#cta"
            className="inline-flex min-h-[50px] items-center gap-2 rounded-full bg-[#2A9D8F] px-[26px] text-[15px] font-semibold text-white transition-colors hover:bg-[#1B4D3D]"
          >
            {t("hero.ctaPrimary")}
            <ArrowRight size={17} />
          </a>
          <a
            href="#workflow"
            className="inline-flex min-h-[50px] items-center gap-[9px] rounded-full border border-[#dfe6e8] bg-white px-6 text-[15px] font-semibold text-[#16302a] transition-colors hover:border-[#c7d3d4]"
          >
            <Play size={16} fill="currentColor" stroke="none" />
            {t("hero.ctaSecondary")}
          </a>
        </div>

        <div className="grid max-w-[640px] grid-cols-1 gap-[18px] border-t border-[#e8eef0] pt-[26px] sm:grid-cols-3">
          {TRUST.map((item) => (
            <div key={item.title} className="flex items-start gap-[11px]">
              <span className="mt-px flex-shrink-0 text-[#2A9D8F]">
                <item.Icon size={20} strokeWidth={1.7} />
              </span>
              <div>
                <strong className="block text-[14px] text-[#16302a]">{t(item.title)}</strong>
                <span className="text-[13px] leading-[1.4] text-[#5b6e6e]">{t(item.desc)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <ExecutionMap />
      </div>
    </section>
  );
}
