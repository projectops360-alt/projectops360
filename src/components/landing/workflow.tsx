"use client";

import { useTranslation } from "react-i18next";

const STEPS = ["create", "charter", "framework", "team", "execute"] as const;

export function Workflow() {
  const { t } = useTranslation();
  return (
    <section id="workflow" className="border-b border-[#eef2f3] bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-6 py-[84px] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="self-start lg:sticky lg:top-[90px]">
          <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[.08em] text-[#2A9D8F]">{t("workflow.kicker")}</div>
          <h2 className="lp-head text-[clamp(30px,3.6vw,44px)] leading-[1.1] tracking-[-.03em] text-[#1B4D3D]">
            {t("workflow.title")}
            <span className="text-[#2A9D8F]">{t("workflow.titleAccent")}</span>
          </h2>
          <p className="mt-4 max-w-[460px] text-[17px] leading-[1.65] text-[#5b6e6e]">{t("workflow.subtitle")}</p>
        </div>

        <div className="relative">
          {/* gradient rail */}
          <div
            className="absolute bottom-3 left-[18px] top-3 w-0.5"
            style={{ background: "linear-gradient(#2A9D8F, #e8eef0)" }}
          />
          <div className="flex flex-col gap-7">
            {STEPS.map((step, i) => (
              <div key={step} className="relative flex gap-5">
                <span
                  className="lp-head relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold text-white shadow-[0_0_0_5px_#fff]"
                  style={{ background: i === STEPS.length - 1 ? "#1B4D3D" : "#2A9D8F" }}
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="lp-head mb-1.5 text-[18px] tracking-[-.02em] text-[#16302a]">{t(`workflow.steps.${step}.title`)}</h3>
                  <p className="max-w-[440px] text-[14.5px] leading-[1.6] text-[#5b6e6e]">{t(`workflow.steps.${step}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
