"use client";

import { useTranslation } from "react-i18next";
import { Check, Lock, Zap } from "lucide-react";
import { Reveal } from "./reveal";

export function Industries() {
  const { t } = useTranslation();
  const tags = t("industries.tags", { returnObjects: true }) as string[];
  const predictive = t("industries.predictive", { returnObjects: true }) as string[];
  const agile = t("industries.agile", { returnObjects: true }) as string[];

  const Mode = ({ icon: Icon, title, items }: { icon: typeof Lock; title: string; items: string[] }) => (
    <div className="rounded-[20px] border border-[#E7ECE8] bg-white p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#EAF6F0] text-[#1FB587]">
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <h3 className="lp-display text-[20px] font-bold text-[#10271E]">{title}</h3>
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[15px] text-[#10271E]">
            <Check size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0 text-[#1FB587]" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="bg-[#F6F8F6] px-6 py-24 md:px-10">
      <div className="mx-auto max-w-[1100px]">
        <Reveal className="mx-auto max-w-[780px] text-center">
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#1FB587]">{t("industries.eyebrow")}</div>
          <h2 className="lp-display m-0 text-[clamp(30px,4.2vw,46px)] font-extrabold leading-[1.05] tracking-[-.025em] text-[#10271E] [text-wrap:balance]">
            {t("industries.title")}
            <span className="text-[#1FB587]">{t("industries.titleAccent")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-[1.6] text-[#5C6B62]">{t("industries.lead")}</p>
        </Reveal>

        {/* industry tags */}
        <Reveal className="mt-9 flex flex-wrap justify-center gap-2.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-[#E7ECE8] bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-[#10271E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1FB587]" />
              {tag}
            </span>
          ))}
        </Reveal>

        {/* two execution modes */}
        <Reveal className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Mode icon={Lock} title={t("industries.predictiveTitle")} items={predictive} />
          <Mode icon={Zap} title={t("industries.agileTitle")} items={agile} />
        </Reveal>

        <Reveal>
          <p className="lp-display mx-auto mt-11 max-w-[720px] text-center text-[clamp(19px,2.4vw,26px)] font-semibold leading-[1.35] tracking-[-.01em] text-[#10271E] [text-wrap:balance]">
            {t("industries.closingPre")}
            <span className="text-[#1FB587]">{t("industries.closingAccent")}</span>
            {t("industries.closingPost")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
