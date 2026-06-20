"use client";

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

type Plan = { key: string; period: "perMonth" | "perUserMonth" | "none"; featured?: boolean };

const PLANS: Plan[] = [
  { key: "personal", period: "perMonth" },
  { key: "team", period: "perUserMonth" },
  { key: "business", period: "perUserMonth", featured: true },
  { key: "enterprise", period: "none" },
];

export function Pricing() {
  const { t } = useTranslation();
  return (
    <section id="pricing" className="border-b border-[#eef2f3] bg-white">
      <div className="mx-auto max-w-[1180px] px-6 py-[84px]">
        <div className="mx-auto mb-[46px] max-w-[640px] text-center">
          <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[.08em] text-[#2A9D8F]">{t("pricing.kicker")}</div>
          <h2 className="lp-head text-[clamp(30px,3.6vw,44px)] leading-[1.1] tracking-[-.03em] text-[#1B4D3D]">
            {t("pricing.title")}
            <span className="text-[#2A9D8F]">{t("pricing.titleAccent")}</span>
          </h2>
          <p className="mt-4 text-[17px] leading-[1.65] text-[#5b6e6e]">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
          {PLANS.map((plan) => {
            const features = t(`pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];
            const isDark = plan.featured;
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  isDark
                    ? "border-[#1B4D3D] bg-[#1B4D3D] text-white shadow-[0_24px_50px_-24px_rgba(27,77,61,.7)] lg:py-10"
                    : "border-[#e8eef0] bg-white"
                }`}
              >
                {plan.featured && (
                  <span className="lp-head absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#2A9D8F] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(42,157,143,.4)]">
                    {t("pricing.mostPopular")}
                  </span>
                )}
                <h3 className={`text-[15px] font-semibold ${isDark ? "text-white" : "text-[#16302a]"}`}>
                  {t(`pricing.plans.${plan.key}.name`)}
                </h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="lp-head text-[35px] font-bold leading-none">{t(`pricing.plans.${plan.key}.price`)}</span>
                  {plan.period !== "none" && (
                    <span className={`text-[13px] font-medium ${isDark ? "text-[#9fc4b8]" : "text-[#94a5a2]"}`}>
                      {t(`pricing.${plan.period}`)}
                    </span>
                  )}
                </div>
                <p className={`mt-3 text-[13.5px] leading-[1.55] ${isDark ? "text-[#c6ddd5]" : "text-[#5b6e6e]"}`}>
                  {t(`pricing.plans.${plan.key}.desc`)}
                </p>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px]">
                      <Check size={16} className={`mt-0.5 flex-shrink-0 ${isDark ? "text-[#5fd3c0]" : "text-[#2A9D8F]"}`} strokeWidth={2.4} />
                      <span className={isDark ? "text-[#e7f1ee]" : "text-[#16302a]"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#cta"
                  className={`mt-7 inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-[14px] font-semibold transition-colors ${
                    isDark
                      ? "bg-[#2A9D8F] text-white hover:bg-[#34d9a6]"
                      : "border border-[#dfe6e8] bg-white text-[#16302a] hover:border-[#2A9D8F] hover:text-[#1B4D3D]"
                  }`}
                >
                  {t(`pricing.plans.${plan.key}.cta`)}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
