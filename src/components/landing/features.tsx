"use client";

import { useTranslation } from "react-i18next";
import { BarChart3, Brain, ClipboardCheck, LayoutDashboard, RefreshCw, Users, type LucideIcon } from "lucide-react";

const ITEMS: { key: string; Icon: LucideIcon }[] = [
  { key: "memory", Icon: Brain },
  { key: "governance", Icon: ClipboardCheck },
  { key: "framework", Icon: RefreshCw },
  { key: "teams", Icon: Users },
  { key: "command", Icon: LayoutDashboard },
  { key: "reporting", Icon: BarChart3 },
];

export function Features() {
  const { t } = useTranslation();
  return (
    <section id="features" className="border-b border-[#eef2f3] bg-[#f7faf9]">
      <div className="mx-auto max-w-[1800px] px-6 py-[84px]">
        <div className="mb-[46px] max-w-[760px]">
          <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[.08em] text-[#2A9D8F]">{t("features.kicker")}</div>
          <h2 className="lp-head text-[clamp(30px,3.6vw,44px)] leading-[1.1] tracking-[-.03em] text-[#1B4D3D]">
            {t("features.title")}
            <span className="text-[#2A9D8F]">{t("features.titleAccent")}</span>
            {t("features.titleEnd")}
          </h2>
          <p className="mt-4 max-w-[620px] text-[17px] leading-[1.65] text-[#5b6e6e]">{t("features.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item) => (
            <div key={item.key} className="rounded-2xl border border-[#e8eef0] bg-white p-7">
              <span className="mb-[18px] inline-flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-[#ecf6f4] text-[#2A9D8F]">
                <item.Icon size={22} strokeWidth={1.7} />
              </span>
              <h3 className="lp-head mb-[7px] text-[18px] tracking-[-.02em] text-[#16302a]">{t(`features.items.${item.key}.title`)}</h3>
              <p className="text-[14px] leading-[1.6] text-[#5b6e6e]">{t(`features.items.${item.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
