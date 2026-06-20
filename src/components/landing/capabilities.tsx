"use client";

import { useTranslation } from "react-i18next";
import { BarChart3, ClipboardCheck, Database, LayoutGrid, RefreshCw, ShieldAlert, type LucideIcon } from "lucide-react";
import { Reveal } from "./reveal";

const ITEMS: { key: string; Icon: LucideIcon }[] = [
  { key: "charter", Icon: ClipboardCheck },
  { key: "framework", Icon: RefreshCw },
  { key: "memory", Icon: Database },
  { key: "risk", Icon: ShieldAlert },
  { key: "workforce", Icon: BarChart3 },
  { key: "executionMap", Icon: LayoutGrid },
];

export function Capabilities() {
  const { t } = useTranslation();
  return (
    <section id="capabilities" className="bg-[#F6F8F6] px-6 py-24 md:px-10">
      <div className="mx-auto max-w-[1180px]">
        <Reveal className="mb-[54px] flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[620px]">
            <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#1FB587]">{t("capabilities.eyebrow")}</div>
            <h2 className="lp-display m-0 text-[clamp(32px,4.4vw,46px)] font-extrabold leading-[1.04] tracking-[-.025em] text-[#10271E] [text-wrap:balance]">
              {t("capabilities.title")}
            </h2>
          </div>
          <p className="m-0 max-w-[340px] text-[17px] leading-[1.55] text-[#5C6B62]">{t("capabilities.supporting")}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item, i) => (
            <Reveal
              key={item.key}
              index={i}
              className="group rounded-[18px] border border-[#E7ECE8] bg-white p-[30px] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-24px_rgba(12,58,42,.35)]"
            >
              <div className="mb-5 flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-[#EAF6F0] text-[#1FB587]">
                <item.Icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="lp-display mb-[9px] text-[21px] font-bold text-[#10271E]">{t(`capabilities.items.${item.key}.title`)}</h3>
              <p className="text-[15px] leading-[1.55] text-[#5C6B62]">{t(`capabilities.items.${item.key}.desc`)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
