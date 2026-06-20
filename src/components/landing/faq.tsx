"use client";

import { useTranslation } from "react-i18next";

export function Faq() {
  const { t } = useTranslation();
  const items = t("faq.items", { returnObjects: true }) as { q: string; a: string }[];
  return (
    <section className="border-b border-[#eef2f3] bg-white">
      <div className="mx-auto max-w-[880px] px-6 py-[84px]">
        <h2 className="lp-head mb-10 text-center text-[clamp(28px,3.2vw,40px)] leading-[1.1] tracking-[-.03em] text-[#1B4D3D]">
          {t("faq.title")}
        </h2>
        <div className="flex flex-col gap-3.5">
          {items.map((item) => (
            <div key={item.q} className="rounded-2xl border border-[#e8eef0] bg-[#fafcfb] p-6">
              <strong className="lp-head block text-[16.5px] tracking-[-.01em] text-[#16302a]">{item.q}</strong>
              <p className="mt-2 text-[14.5px] leading-[1.65] text-[#5b6e6e]">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
