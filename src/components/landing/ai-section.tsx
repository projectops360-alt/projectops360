"use client";

import { useTranslation } from "react-i18next";
import { Brain, LayoutGrid, MessageSquareText, ShieldAlert, ShieldCheck, Sparkles, Target, type LucideIcon } from "lucide-react";
import { Reveal } from "./reveal";

// Icons map 1:1 to the chips array order in i18n (ai.chips).
const CHIP_ICONS: LucideIcon[] = [Target, LayoutGrid, ShieldAlert, MessageSquareText, Brain, Sparkles];

export function AiSection() {
  const { t } = useTranslation();
  const chips = t("ai.chips", { returnObjects: true }) as string[];

  return (
    <section className="relative overflow-hidden bg-[#f8faf7] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[900px] -translate-x-1/2 blur-[44px]"
        style={{ background: "radial-gradient(ellipse, rgba(0,122,77,.06), transparent 68%)" }}
      />
      <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* left: message — AI supports the PM, never replaces them */}
        <Reveal>
          <div className="mb-4 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#007a4d]">
            <Sparkles size={15} strokeWidth={2} />
            {t("ai.eyebrow")}
          </div>
          <h2 className="lp-display m-0 text-[clamp(32px,4.6vw,50px)] font-extrabold leading-[1.04] tracking-[-.025em] text-[#07130f] [text-wrap:balance]">
            {t("ai.title")}
            <span className="lp-grad-text">{t("ai.titleAccent")}</span>
          </h2>
          <p className="mt-6 max-w-[560px] text-[18px] leading-[1.6] text-[#5f6b66]">{t("ai.lead")}</p>

          <div className="mt-8 rounded-[22px] border border-[#e2e8e1] bg-white px-7 py-7 shadow-[0_10px_34px_-22px_rgba(7,19,15,.14)]">
            <p className="lp-display text-[clamp(19px,2.4vw,25px)] font-semibold leading-[1.3] tracking-[-.01em] text-[#07130f] [text-wrap:balance]">
              {t("ai.noReplace")}
            </p>
            <p className="mt-4 max-w-[560px] text-[16px] leading-[1.6] text-[#5f6b66]">{t("ai.sharper")}</p>
          </div>

          <p className="lp-display mt-8 max-w-[560px] text-[clamp(18px,2.2vw,22px)] font-semibold leading-[1.35] tracking-[-.01em] text-[#07130f] [text-wrap:balance]">
            {t("ai.closing")}
          </p>
        </Reveal>

        {/* right: Isabella — AI advisor panel (decorative, assists not replaces) */}
        <Reveal index={1}>
          <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[24px] border border-[#e2e8e1] bg-white shadow-[0_30px_70px_-34px_rgba(6,78,59,.32)]">
            <div className="flex items-center gap-3 border-b border-[#edf0ec] bg-gradient-to-b from-white to-[#f8faf7] px-6 py-5">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#0f7c54] to-[#9fe0c4] text-[15px] font-black text-white">I</span>
              <div>
                <div className="lp-display text-[16px] font-bold text-[#07130f]">{t("ai.panelTitle")}</div>
                <div className="text-[12.5px] font-semibold text-[#5f6b66]">{t("ai.panelRole")}</div>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#c8ead8] bg-[#f0fbf5] px-2.5 py-1 text-[11px] font-extrabold text-[#064e3b]">
                <span className="lp-live-dot h-1.5 w-1.5 rounded-full bg-[#007a4d]" />
                {t("ai.panelLive")}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 px-6 py-6">
              {chips.map((c, i) => {
                const Icon = CHIP_ICONS[i] ?? Sparkles;
                return (
                  <div key={c} className="flex items-center gap-3 rounded-[13px] border border-[#e2e8e1] bg-[#f8faf7] px-3.5 py-2.5">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-[#e7f5ee] text-[#007a4d]">
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                    <span className="text-[14px] font-semibold text-[#07130f]">{c}</span>
                  </div>
                );
              })}

              <div className="mt-2 flex items-center gap-3 rounded-[14px] border border-[#c8ead8] bg-[#f0fbf5] px-4 py-3.5">
                <ShieldCheck size={20} strokeWidth={1.9} className="flex-none text-[#007a4d]" />
                <span className="lp-display text-[15px] font-bold text-[#064e3b]">{t("ai.panelControl")}</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
