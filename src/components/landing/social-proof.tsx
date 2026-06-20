"use client";

import { useTranslation } from "react-i18next";

// Placeholder beta-customer wordmarks (per handoff — replace with real logos).
const WORDMARKS = ["NorthPeak", "Vela Labs", "Quanta", "Orbital", "Lumen PMO"];

export function SocialProof() {
  const { t } = useTranslation();
  return (
    <section className="border-y border-[#eef2f3] bg-[#fafcfb]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-10 px-6 py-[30px]">
        <span className="text-[13px] font-semibold tracking-[.02em] text-[#94a5a2]">{t("socialProof.title")}</span>
        <div className="lp-head flex flex-wrap items-center gap-10 text-[18px] font-semibold tracking-[-.01em] text-[#5b6e6e] opacity-55">
          {WORDMARKS.map((w) => (
            <span key={w} className="whitespace-nowrap">
              {w}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
