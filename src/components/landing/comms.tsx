"use client";

import { useTranslation } from "react-i18next";
import { Bell, Calendar, Check, Hash, Mail, MessageCircle, MessageSquare, Users, type LucideIcon } from "lucide-react";
import { Reveal } from "./reveal";

// Icons map 1:1 to the channels array order in i18n.
const CHANNEL_ICONS: LucideIcon[] = [Mail, Calendar, Users, Hash, MessageSquare, Bell];

export function Comms() {
  const { t } = useTranslation();
  const channels = t("comms.channels", { returnObjects: true }) as string[];
  const connected = t("comms.connected", { returnObjects: true }) as string[];
  const answers = t("comms.answers", { returnObjects: true }) as string[];

  return (
    <section className="relative overflow-hidden bg-[#07120D] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[440px] w-[900px] -translate-x-1/2 blur-[44px]"
        style={{ background: "radial-gradient(ellipse, rgba(31,181,135,.14), transparent 68%)" }}
      />
      <div className="relative mx-auto max-w-[1000px]">
        <Reveal className="mx-auto max-w-[760px] text-center">
          <div className="mb-4 flex items-center justify-center gap-2 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#3CE5A4]">
            <MessageCircle size={15} strokeWidth={2} />
            {t("comms.eyebrow")}
          </div>
          <h2 className="lp-display m-0 text-[clamp(30px,4.2vw,46px)] font-extrabold leading-[1.05] tracking-[-.025em] text-white [text-wrap:balance]">
            {t("comms.title")}
            <span className="lp-grad-text">{t("comms.titleAccent")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[640px] text-[17px] leading-[1.6] text-[#A9BAB1]">{t("comms.lead")}</p>
        </Reveal>

        {/* channels */}
        <Reveal className="mt-10">
          <div className="mb-3 text-center text-[12px] font-extrabold uppercase tracking-[.14em] text-[#6F8278]">{t("comms.channelsLabel")}</div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {channels.map((ch, i) => {
              const Icon = CHANNEL_ICONS[i] ?? MessageCircle;
              return (
                <span key={ch} className="inline-flex items-center gap-2 rounded-full border border-[#3CE5A4]/20 bg-white/[0.03] px-4 py-2 text-[14px] font-semibold text-[#D6E2DA]">
                  <Icon size={15} strokeWidth={1.9} className="text-[#3CE5A4]" />
                  {ch}
                </span>
              );
            })}
          </div>
        </Reveal>

        {/* connected to the project record */}
        <Reveal className="mx-auto mt-9 max-w-[820px] rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-7 text-center">
          <p className="text-[15px] leading-[1.6] text-[#A9BAB1]">{t("comms.connectedLabel")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {connected.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-[#E7ECE8]/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3CE5A4]" />
                {c}
              </span>
            ))}
          </div>
        </Reveal>

        {/* what the memory answers */}
        <Reveal className="mt-10">
          <div className="mb-4 text-center text-[12px] font-extrabold uppercase tracking-[.14em] text-[#6F8278]">{t("comms.memoryLabel")}</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {answers.map((a) => (
              <div key={a} className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[14px] font-medium text-[#D6E2DA]">
                <Check size={16} strokeWidth={2.4} className="flex-shrink-0 text-[#3CE5A4]" />
                {a}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <p className="lp-display mx-auto mt-11 max-w-[720px] text-center text-[clamp(19px,2.4vw,26px)] font-semibold leading-[1.35] tracking-[-.01em] text-white [text-wrap:balance]">
            {t("comms.closingPre")}
            <span className="lp-grad-text">{t("comms.closingAccent")}</span>
            {t("comms.closingPost")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
