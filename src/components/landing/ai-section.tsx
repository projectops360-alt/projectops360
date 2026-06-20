"use client";

import { useTranslation } from "react-i18next";
import { Brain, LayoutGrid, MessageSquareText, ShieldAlert, Sparkles, Target, type LucideIcon } from "lucide-react";
import { Reveal } from "./reveal";

// Icons map 1:1 to the chips array order in i18n (ai.chips).
const CHIP_ICONS: LucideIcon[] = [Target, LayoutGrid, ShieldAlert, MessageSquareText, Brain, Sparkles];

export function AiSection() {
  const { t } = useTranslation();
  const chips = t("ai.chips", { returnObjects: true }) as string[];

  return (
    <section className="relative overflow-hidden bg-[#0A1611] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[900px] -translate-x-1/2 blur-[44px]"
        style={{ background: "radial-gradient(ellipse, rgba(31,181,135,.16), transparent 68%)" }}
      />
      <div className="relative mx-auto max-w-[920px] text-center">
        <Reveal>
          <div className="mb-4 flex items-center justify-center gap-2 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#3CE5A4]">
            <Sparkles size={15} strokeWidth={2} />
            {t("ai.eyebrow")}
          </div>
          <h2 className="lp-display m-0 text-[clamp(32px,4.6vw,50px)] font-extrabold leading-[1.04] tracking-[-.025em] text-white [text-wrap:balance]">
            {t("ai.title")}
            <span className="lp-grad-text">{t("ai.titleAccent")}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[640px] text-[18px] leading-[1.6] text-[#A9BAB1]">{t("ai.lead")}</p>
        </Reveal>

        <Reveal className="mt-9 flex flex-wrap justify-center gap-2.5">
          {chips.map((c, i) => {
            const Icon = CHIP_ICONS[i] ?? Sparkles;
            return (
              <span
                key={c}
                className="inline-flex items-center gap-2 rounded-full border border-[#3CE5A4]/20 bg-white/[0.03] px-4 py-2 text-[14px] font-semibold text-[#D6E2DA]"
              >
                <Icon size={15} strokeWidth={1.9} className="text-[#3CE5A4]" />
                {c}
              </span>
            );
          })}
        </Reveal>

        <Reveal className="mx-auto mt-12 max-w-[760px] rounded-[22px] border border-[#3CE5A4]/[0.16] bg-white/[0.03] px-8 py-9">
          <p className="lp-display text-[clamp(20px,2.6vw,28px)] font-semibold leading-[1.3] tracking-[-.01em] text-white [text-wrap:balance]">
            {t("ai.noReplace")}
          </p>
          <p className="mx-auto mt-4 max-w-[620px] text-[16px] leading-[1.6] text-[#A9BAB1]">{t("ai.sharper")}</p>
        </Reveal>

        <Reveal>
          <p className="lp-display mx-auto mt-10 max-w-[680px] text-[clamp(18px,2.2vw,23px)] font-semibold leading-[1.35] tracking-[-.01em] text-white [text-wrap:balance]">
            {t("ai.closing")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
