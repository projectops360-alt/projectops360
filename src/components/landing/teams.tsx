"use client";

import { useTranslation } from "react-i18next";
import { Building2, ShieldCheck, User, Users, type LucideIcon } from "lucide-react";

const ITEMS: { key: string; Icon: LucideIcon }[] = [
  { key: "solo", Icon: User },
  { key: "small", Icon: Users },
  { key: "pmo", Icon: Building2 },
  { key: "enterprise", Icon: ShieldCheck },
];

export function Teams() {
  const { t } = useTranslation();
  return (
    <section id="teams" className="border-b border-[#eef2f3] bg-[#f7faf9]">
      <div className="mx-auto max-w-[1180px] px-6 py-[84px]">
        <div className="mb-[46px] max-w-[760px]">
          <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[.08em] text-[#2A9D8F]">{t("teams.kicker")}</div>
          <h2 className="lp-head text-[clamp(30px,3.6vw,44px)] leading-[1.1] tracking-[-.03em] text-[#1B4D3D]">
            {t("teams.title")}
            <span className="text-[#2A9D8F]">{t("teams.titleAccent")}</span>
          </h2>
          <p className="mt-4 max-w-[620px] text-[17px] leading-[1.65] text-[#5b6e6e]">{t("teams.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <div key={item.key} className="rounded-2xl border border-[#e8eef0] bg-white p-7">
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#ecf6f4] text-[#2A9D8F]">
                <item.Icon size={20} strokeWidth={1.7} />
              </span>
              <h3 className="lp-head mb-[7px] text-[18px] tracking-[-.02em] text-[#16302a]">{t(`teams.items.${item.key}.title`)}</h3>
              <p className="text-[14px] leading-[1.6] text-[#5b6e6e]">{t(`teams.items.${item.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
